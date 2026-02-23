import XLSX from "xlsx";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });

interface ScanConfigRow {
  container: string;
  label: string;
  startIp: string;
  endIp: string;
  type: string;
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npx tsx server/import-ip-ranges.ts <path-to-excel-file>");
    console.error("Example: npx tsx server/import-ip-ranges.ts IP_RANGES.xlsx");
    process.exit(1);
  }

  console.log(`Reading Excel file: ${filePath}`);
  const wb = XLSX.readFile(filePath);

  const allConfigs: ScanConfigRow[] = [];

  const airSheet = wb.Sheets["IP Ranges - Air"];
  if (airSheet) {
    const airData = XLSX.utils.sheet_to_json(airSheet) as any[];
    for (const row of airData) {
      if (!row.Container || !row["Group A"]) continue;
      if (row["Miner Type"] === "Empty") continue;
      const c = row.Container;
      const groups = [row["Group A"], row["Group B"], row["Group C"], row["Group D"]].filter(Boolean);
      for (let i = 0; i < groups.length; i++) {
        const base = groups[i];
        allConfigs.push({
          container: c,
          label: `${c} Group ${String.fromCharCode(65 + i)}`,
          startIp: `${base}.1`,
          endIp: `${base}.254`,
          type: "air",
        });
      }
    }
    console.log(`Parsed ${allConfigs.length} air-cooled scan configs from ${[...new Set(allConfigs.map(c => c.container))].length} containers`);
  }

  const immSheet = wb.Sheets["IP Ranges - Immersion"];
  if (immSheet) {
    const immData = XLSX.utils.sheet_to_json(immSheet) as any[];
    let immCount = 0;
    for (const row of immData) {
      if (!row.Container) continue;
      const c = row.Container;
      const tanks = ["Tank 1", "Tank 2", "Tank 3", "Tank 4", "Tank 5", "Tank 6", "Tank 7", "Tank 8"];
      for (let i = 0; i < tanks.length; i++) {
        const val = row[tanks[i]];
        if (!val || val === "---" || val === "---|" || typeof val !== "string") continue;
        if (!val.match(/^\d+\.\d+\.\d+\.\d+$/)) continue;
        const base = val.replace(/\.0$/, "");
        allConfigs.push({
          container: c,
          label: `${c} Tank ${i + 1}`,
          startIp: `${base}.1`,
          endIp: `${base}.254`,
          type: "immersion",
        });
        immCount++;
      }
    }
    console.log(`Parsed ${immCount} immersion scan configs`);
  }

  console.log(`\nTotal scan configs to import: ${allConfigs.length}`);

  const existing = await pool.query("SELECT COUNT(*) as count FROM scan_configs");
  console.log(`Existing scan configs in database: ${existing.rows[0].count}`);

  const { rows: existingConfigs } = await pool.query("SELECT name FROM scan_configs");
  const existingNames = new Set(existingConfigs.map((r: any) => r.name));

  let inserted = 0;
  let skipped = 0;
  const BATCH_SIZE = 100;

  for (let i = 0; i < allConfigs.length; i += BATCH_SIZE) {
    const batch = allConfigs.slice(i, i + BATCH_SIZE);
    const toInsert = batch.filter(c => !existingNames.has(c.label));
    skipped += batch.length - toInsert.length;

    if (toInsert.length === 0) continue;

    const values: string[] = [];
    const params: any[] = [];
    for (let j = 0; j < toInsert.length; j++) {
      const c = toInsert[j];
      const offset = j * 3;
      values.push(`(gen_random_uuid(), $${offset + 1}, $${offset + 2}, $${offset + 3}, 4028, true, NOW())`);
      params.push(c.label, c.startIp, c.endIp);
    }

    await pool.query(
      `INSERT INTO scan_configs (id, name, start_ip, end_ip, port, enabled, created_at)
       VALUES ${values.join(", ")}`,
      params
    );
    inserted += toInsert.length;
    process.stdout.write(`\rInserted ${inserted}/${allConfigs.length - skipped}...`);
  }

  console.log(`\n\n=== DONE ===`);
  console.log(`Inserted: ${inserted} new scan configs`);
  console.log(`Skipped: ${skipped} (already existed)`);

  const final = await pool.query("SELECT COUNT(*) as count FROM scan_configs");
  console.log(`Total scan configs now: ${final.rows[0].count}`);

  console.log(`\nYour IP ranges are loaded! Here's how scanning works:`);
  console.log(`1. Go to Settings > Network Scanner in the dashboard`);
  console.log(`2. You'll see all ${inserted} scan configs listed`);
  console.log(`3. Click "Scan" on any config to probe those IPs for miners`);
  console.log(`4. The scanner connects to port 4028 (CGMiner API) on each IP`);
  console.log(`5. When a miner responds, it captures the MAC address`);
  console.log(`6. If the MAC matches a miner from your CSV import, the IP gets linked`);
  console.log(`7. The poller then automatically starts monitoring that miner every 30 seconds`);
  console.log(`\nIMPORTANT: Scanning only works when the server is running on a machine`);
  console.log(`that can reach the 10.x.x.x addresses (i.e., at the mine site).`);

  await pool.end();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});

import pg from "pg";
import net from "net";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });

function queryCgminer(ip: string, port: number, cmd: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error("timeout"));
    }, 5000);

    const socket = new net.Socket();
    let data = "";

    socket.connect(port, ip, () => {
      socket.write(JSON.stringify({ cmd }) + "\n");
    });

    socket.on("data", (chunk) => { data += chunk.toString(); });
    socket.on("end", () => {
      clearTimeout(timeout);
      try {
        resolve(JSON.parse(data.replace(/\0/g, "").trim()));
      } catch {
        resolve(null);
      }
    });
    socket.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function normalizeMac(mac: string): string {
  return mac.toLowerCase().replace(/[:\-]/g, "");
}

async function main() {
  console.log("=== MERGE SCANNED MINERS INTO CSV MINERS ===\n");

  const { rows: scannedMiners } = await pool.query(`
    SELECT m.id, m.name, m.ip_address, m.port, m.mac_address, m.latest_snapshot_id
    FROM miners m
    LEFT JOIN slot_assignments sa ON sa.miner_id = m.id
    WHERE m.source = 'scanned' AND sa.id IS NULL
  `);

  console.log(`Found ${scannedMiners.length} scanned miners without slot assignments (duplicates)\n`);

  if (scannedMiners.length === 0) {
    console.log("Nothing to merge!");
    await pool.end();
    return;
  }

  let merged = 0;
  let macNotFound = 0;
  let mappingNotFound = 0;
  let csvMinerNotFound = 0;
  let errors = 0;

  for (const scanned of scannedMiners) {
    const ip = scanned.ip_address;
    const port = scanned.port || 4028;

    try {
      const info = await queryCgminer(ip, port, "get_miner_info");
      let mac: string | undefined;

      if (info?.Msg && typeof info.Msg === "object") {
        const msg = info.Msg;
        mac = msg.mac || msg.Mac || msg.MAC || msg.MacAddr || msg.mac_address;
      }

      if (!mac) {
        console.log(`  [SKIP] ${ip} - get_miner_info returned no MAC`);
        macNotFound++;
        continue;
      }

      mac = mac.toLowerCase();
      const normalized = normalizeMac(mac);

      const { rows: mappings } = await pool.query(
        `SELECT * FROM mac_location_mappings WHERE replace(replace(lower(mac_address), ':', ''), '-', '') = $1`,
        [normalized]
      );

      if (mappings.length === 0) {
        console.log(`  [SKIP] ${ip} - MAC ${mac} not found in location mappings`);
        mappingNotFound++;
        continue;
      }

      const mapping = mappings[0];
      const slot = (mapping.row - 1) * 4 + mapping.col;

      const { rows: containers } = await pool.query(
        `SELECT id FROM containers WHERE name = $1`,
        [mapping.container_name]
      );

      if (containers.length === 0) {
        console.log(`  [SKIP] ${ip} - Container ${mapping.container_name} not found`);
        csvMinerNotFound++;
        continue;
      }

      const { rows: assignments } = await pool.query(
        `SELECT miner_id FROM slot_assignments WHERE container_id = $1 AND rack = $2 AND slot = $3 AND miner_id IS NOT NULL`,
        [containers[0].id, mapping.rack, slot]
      );

      if (assignments.length === 0) {
        console.log(`  [SKIP] ${ip} - No miner assigned to ${mapping.container_name} R${mapping.rack} S${slot}`);
        csvMinerNotFound++;
        continue;
      }

      const csvMinerId = assignments[0].miner_id;

      await pool.query(
        `UPDATE miners SET ip_address = $1, port = $2, mac_address = $3, status = 'online', source = 'scanned' WHERE id = $4`,
        [ip, port, mac, csvMinerId]
      );

      await pool.query(
        `UPDATE miner_snapshots SET miner_id = $1 WHERE miner_id = $2`,
        [csvMinerId, scanned.id]
      );

      if (scanned.latest_snapshot_id) {
        await pool.query(
          `UPDATE miners SET latest_snapshot_id = $1 WHERE id = $2`,
          [scanned.latest_snapshot_id, csvMinerId]
        );
      }

      await pool.query(`DELETE FROM alerts WHERE miner_id = $1`, [scanned.id]);
      await pool.query(`DELETE FROM miners WHERE id = $1`, [scanned.id]);

      console.log(`  [MERGED] ${ip} MAC=${mac} → ${mapping.container_name} R${mapping.rack} S${slot} (miner ${csvMinerId})`);
      merged++;
    } catch (err: any) {
      console.log(`  [ERROR] ${ip} - ${err.message}`);
      errors++;
    }
  }

  console.log(`\n=== RESULTS ===`);
  console.log(`Merged: ${merged}`);
  console.log(`MAC not found from API: ${macNotFound}`);
  console.log(`MAC not in location mappings: ${mappingNotFound}`);
  console.log(`CSV miner not found: ${csvMinerNotFound}`);
  console.log(`Errors: ${errors}`);

  const { rows: [{ count }] } = await pool.query("SELECT COUNT(*) as count FROM miners");
  console.log(`\nTotal miners remaining: ${count}`);

  const { rows: [{ count: onlineCount }] } = await pool.query("SELECT COUNT(*) as count FROM miners WHERE status = 'online'");
  console.log(`Online miners: ${onlineCount}`);

  await pool.end();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});

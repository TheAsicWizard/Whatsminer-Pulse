import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function main() {
  console.log("Cleaning up duplicate scanned miners...\n");

  const { rows: dupes } = await pool.query(`
    SELECT id, name, ip_address, mac_address, source
    FROM miners
    WHERE source = 'scanned'
    AND id NOT IN (SELECT miner_id FROM slot_assignments WHERE miner_id IS NOT NULL)
  `);

  console.log(`Found ${dupes.length} scanned miners with no slot assignment (duplicates)`);

  if (dupes.length === 0) {
    console.log("Nothing to clean up!");
    await pool.end();
    return;
  }

  const ids = dupes.map((d: any) => d.id);

  const snapDel = await pool.query(
    `DELETE FROM miner_snapshots WHERE miner_id = ANY($1::varchar[])`,
    [ids]
  );
  console.log(`Deleted ${snapDel.rowCount} snapshots from duplicate miners`);

  const alertDel = await pool.query(
    `DELETE FROM alerts WHERE miner_id = ANY($1::varchar[])`,
    [ids]
  );
  console.log(`Deleted ${alertDel.rowCount} alerts from duplicate miners`);

  const minerDel = await pool.query(
    `DELETE FROM miners WHERE id = ANY($1::varchar[])`,
    [ids]
  );
  console.log(`Deleted ${minerDel.rowCount} duplicate miners`);

  const { rows: [{ count }] } = await pool.query("SELECT COUNT(*) as count FROM miners");
  console.log(`\nMiners remaining: ${count}`);

  await pool.end();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});

import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function main() {
  console.log("=== DIAGNOSTIC REPORT ===\n");

  const { rows: [minerCount] } = await pool.query("SELECT COUNT(*) as count FROM miners");
  console.log(`Total miners: ${minerCount.count}`);

  const { rows: sourceCounts } = await pool.query(
    "SELECT source, status, COUNT(*) as count FROM miners GROUP BY source, status ORDER BY source, status"
  );
  console.log("\nMiners by source/status:");
  sourceCounts.forEach((r: any) => console.log(`  ${r.source || 'null'} / ${r.status}: ${r.count}`));

  const { rows: [assignCount] } = await pool.query("SELECT COUNT(*) as count FROM slot_assignments");
  console.log(`\nTotal slot_assignments: ${assignCount.count}`);

  const { rows: [withMiner] } = await pool.query("SELECT COUNT(*) as count FROM slot_assignments WHERE miner_id IS NOT NULL");
  console.log(`Slot assignments with miner_id: ${withMiner.count}`);

  const { rows: [orphanSlots] } = await pool.query(
    `SELECT COUNT(*) as count FROM slot_assignments sa 
     LEFT JOIN miners m ON sa.miner_id = m.id 
     WHERE sa.miner_id IS NOT NULL AND m.id IS NULL`
  );
  console.log(`Orphan slot assignments (miner_id doesn't exist): ${orphanSlots.count}`);

  const { rows: [orphanContainers] } = await pool.query(
    `SELECT COUNT(*) as count FROM slot_assignments sa 
     LEFT JOIN containers c ON sa.container_id = c.id 
     WHERE c.id IS NULL`
  );
  console.log(`Orphan slot assignments (container_id doesn't exist): ${orphanContainers.count}`);

  const { rows: [containerCount] } = await pool.query("SELECT COUNT(*) as count FROM containers");
  console.log(`\nTotal containers: ${containerCount.count}`);

  const { rows: [mappingCount] } = await pool.query("SELECT COUNT(*) as count FROM mac_location_mappings");
  console.log(`Total MAC location mappings: ${mappingCount.count}`);

  const { rows: sampleMappings } = await pool.query("SELECT mac_address, container_name, rack, row, col FROM mac_location_mappings LIMIT 3");
  console.log("\nSample MAC mappings:");
  sampleMappings.forEach((r: any) => console.log(`  MAC: ${r.mac_address} → ${r.container_name} R${r.rack} row=${r.row} col=${r.col}`));

  const { rows: [macOnMiners] } = await pool.query("SELECT COUNT(*) as count FROM miners WHERE mac_address IS NOT NULL AND mac_address != ''");
  console.log(`\nMiners with MAC address set: ${macOnMiners.count}`);

  const { rows: sampleMiners } = await pool.query(
    "SELECT id, name, ip_address, mac_address, source, status FROM miners WHERE mac_address IS NOT NULL LIMIT 3"
  );
  console.log("\nSample miners with MAC:");
  sampleMiners.forEach((r: any) => console.log(`  ${r.name} | IP: ${r.ip_address} | MAC: ${r.mac_address} | source: ${r.source} | status: ${r.status}`));

  const { rows: sampleMinersNoMac } = await pool.query(
    "SELECT id, name, ip_address, source, status FROM miners WHERE (mac_address IS NULL OR mac_address = '') LIMIT 3"
  );
  console.log("\nSample miners WITHOUT MAC:");
  sampleMinersNoMac.forEach((r: any) => console.log(`  ${r.name} | IP: ${r.ip_address} | source: ${r.source} | status: ${r.status}`));

  const { rows: containerSampleSlots } = await pool.query(
    `SELECT c.name, COUNT(sa.id) as slot_count 
     FROM containers c 
     LEFT JOIN slot_assignments sa ON c.id = sa.container_id 
     GROUP BY c.name 
     ORDER BY slot_count DESC 
     LIMIT 5`
  );
  console.log("\nTop containers by slot assignment count:");
  containerSampleSlots.forEach((r: any) => console.log(`  ${r.name}: ${r.slot_count} slots`));

  const { rows: [snapshotCount] } = await pool.query("SELECT COUNT(*) as count FROM miner_snapshots");
  console.log(`\nTotal snapshots: ${snapshotCount.count}`);

  const { rows: [latestSnapMiners] } = await pool.query("SELECT COUNT(*) as count FROM miners WHERE latest_snapshot_id IS NOT NULL");
  console.log(`Miners with latest_snapshot_id: ${latestSnapMiners.count}`);

  await pool.end();
  console.log("\n=== END DIAGNOSTIC ===");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});

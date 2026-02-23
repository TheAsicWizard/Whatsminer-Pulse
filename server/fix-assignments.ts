import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

function normalizeMac(mac: string): string {
  return mac.replace(/[:\-\.]/g, "").toLowerCase();
}

async function fixAssignments() {
  const client = await pool.connect();
  
  try {
    console.log("=== Fix Slot Assignments ===\n");

    const { rows: mappings } = await client.query(
      "SELECT mac_address, container_name, rack, row, col, miner_type FROM mac_location_mappings"
    );
    console.log(`Found ${mappings.length} MAC mappings`);

    if (mappings.length === 0) {
      console.log("No MAC mappings found. Upload your CSV first via the web UI, then run this script.");
      process.exit(1);
    }

    const { rows: allContainers } = await client.query("SELECT id, name FROM containers");
    const containerMap = new Map(allContainers.map((c: any) => [c.name, c.id]));
    console.log(`Found ${allContainers.length} containers`);

    const { rows: allMiners } = await client.query("SELECT id, mac_address FROM miners");
    const minerByMac = new Map<string, string>();
    for (const m of allMiners) {
      if (m.mac_address) {
        minerByMac.set(normalizeMac(m.mac_address), m.id);
      }
    }
    console.log(`Found ${allMiners.length} miners (${minerByMac.size} with MAC addresses)`);

    await client.query("DELETE FROM slot_assignments");
    console.log("Cleared all existing slot assignments\n");

    let assigned = 0;
    let created = 0;
    let skipped = 0;
    const slotRows: Array<{ containerId: string; rack: number; slot: number; minerId: string }> = [];

    const batchSize = 500;
    for (let i = 0; i < mappings.length; i += batchSize) {
      const batch = mappings.slice(i, i + batchSize);
      const toCreate: Array<{ mapping: any; containerId: string }> = [];

      for (const mapping of batch) {
        const containerId = containerMap.get(mapping.container_name);
        if (!containerId) {
          skipped++;
          continue;
        }

        const stripped = normalizeMac(mapping.mac_address);
        const existingMinerId = minerByMac.get(stripped);

        if (existingMinerId) {
          const slot = (mapping.row - 1) * 4 + mapping.col;
          slotRows.push({ containerId, rack: mapping.rack, slot, minerId: existingMinerId });
          assigned++;
        } else {
          toCreate.push({ mapping, containerId });
        }
      }

      if (toCreate.length > 0) {
        const values: string[] = [];
        const params: any[] = [];
        let paramIdx = 1;

        for (const { mapping, containerId } of toCreate) {
          const slot = (mapping.row - 1) * 4 + mapping.col;
          const cName = mapping.container_name;
          const location = `${cName}-R${String(mapping.rack).padStart(2, "0")}-S${String(slot).padStart(2, "0")}`;
          const model = mapping.miner_type || "WhatsMiner";

          values.push(`($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}, $${paramIdx + 5}, $${paramIdx + 6})`);
          params.push(location, "", mapping.mac_address, model, "offline", "csv", location);
          paramIdx += 7;
        }

        const insertSQL = `INSERT INTO miners (name, ip_address, mac_address, model, status, source, location) VALUES ${values.join(", ")} RETURNING id, mac_address`;
        const { rows: newMiners } = await client.query(insertSQL, params);

        for (let idx = 0; idx < newMiners.length; idx++) {
          const miner = newMiners[idx];
          const { mapping, containerId } = toCreate[idx];
          const slot = (mapping.row - 1) * 4 + mapping.col;
          slotRows.push({ containerId, rack: mapping.rack, slot, minerId: miner.id });
          if (miner.mac_address) minerByMac.set(normalizeMac(miner.mac_address), miner.id);
        }

        created += newMiners.length;
        assigned += newMiners.length;
      }

      const processed = Math.min(i + batchSize, mappings.length);
      if (processed % 2000 === 0 || processed >= mappings.length) {
        console.log(`Processed ${processed}/${mappings.length} mappings (${created} new miners created, ${skipped} skipped)`);
      }
    }

    console.log(`\nInserting ${slotRows.length} slot assignments in bulk...`);
    const slotBatchSize = 1000;
    for (let i = 0; i < slotRows.length; i += slotBatchSize) {
      const batch = slotRows.slice(i, i + slotBatchSize);
      const values: string[] = [];
      const params: any[] = [];
      let paramIdx = 1;

      for (const row of batch) {
        values.push(`($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3})`);
        params.push(row.containerId, row.rack, row.slot, row.minerId);
        paramIdx += 4;
      }

      await client.query(
        `INSERT INTO slot_assignments (container_id, rack, slot, miner_id) VALUES ${values.join(", ")}`,
        params
      );
      console.log(`  Inserted batch ${Math.floor(i / slotBatchSize) + 1}/${Math.ceil(slotRows.length / slotBatchSize)}`);
    }

    const { rows: verify } = await client.query("SELECT COUNT(*) as cnt FROM slot_assignments");
    console.log(`\n=== DONE ===`);
    console.log(`Created: ${created} new miners`);
    console.log(`Assigned: ${assigned} miners to rack slots`);
    console.log(`Skipped: ${skipped} (no matching container in database)`);
    console.log(`Verified: ${verify[0].cnt} slot_assignments in database`);
    console.log(`\nNow start your server and refresh the browser!`);

  } finally {
    client.release();
    await pool.end();
  }
}

fixAssignments().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});

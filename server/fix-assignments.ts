import { db } from "./db";
import { miners, slotAssignments, macLocationMappings, containers } from "@shared/schema";
import { eq } from "drizzle-orm";

function normalizeMac(mac: string): string {
  return mac.replace(/[:\-\.]/g, "").toLowerCase();
}

async function fixAssignments() {
  console.log("=== Fix Slot Assignments ===");
  
  const allMappings = await db.select().from(macLocationMappings);
  console.log(`Found ${allMappings.length} MAC mappings`);
  
  if (allMappings.length === 0) {
    console.log("No MAC mappings found. Upload your CSV first, then run this script.");
    process.exit(1);
  }

  const allContainers = await db.select().from(containers);
  const containerMap = new Map(allContainers.map(c => [c.name, c]));
  console.log(`Found ${allContainers.length} containers`);

  const allMiners = await db.select().from(miners);
  const minerByMac = new Map<string, typeof allMiners[0]>();
  for (const m of allMiners) {
    if (m.macAddress) {
      minerByMac.set(normalizeMac(m.macAddress), m);
    }
  }
  console.log(`Found ${allMiners.length} miners (${minerByMac.size} with MAC addresses)`);

  await db.delete(slotAssignments);
  console.log("Cleared all existing slot assignments");

  let assigned = 0;
  let created = 0;
  let skipped = 0;
  const allSlotValues: Array<{ containerId: string; rack: number; slot: number; minerId: string }> = [];

  const batchSize = 500;
  for (let i = 0; i < allMappings.length; i += batchSize) {
    const batch = allMappings.slice(i, i + batchSize);
    const minersToCreate: Array<{ mapping: typeof batch[0]; container: typeof allContainers[0] }> = [];

    for (const mapping of batch) {
      const container = containerMap.get(mapping.containerName);
      if (!container) {
        skipped++;
        continue;
      }

      const stripped = normalizeMac(mapping.macAddress);
      const existingMiner = minerByMac.get(stripped);

      if (existingMiner) {
        const slot = (mapping.row - 1) * 4 + mapping.col;
        allSlotValues.push({ containerId: container.id, rack: mapping.rack, slot, minerId: existingMiner.id });
        assigned++;
      } else {
        minersToCreate.push({ mapping, container });
      }
    }

    if (minersToCreate.length > 0) {
      const newMinerValues = minersToCreate.map(({ mapping, container }) => {
        const slot = (mapping.row - 1) * 4 + mapping.col;
        const location = `${container.name}-R${String(mapping.rack).padStart(2, "0")}-S${String(slot).padStart(2, "0")}`;
        return {
          name: location,
          ipAddress: "",
          macAddress: mapping.macAddress,
          model: mapping.minerType || "WhatsMiner",
          status: "offline" as const,
          source: "csv" as const,
          location,
        };
      });

      const createdMiners = await db.insert(miners).values(newMinerValues).returning();

      for (let idx = 0; idx < createdMiners.length; idx++) {
        const miner = createdMiners[idx];
        const { mapping, container } = minersToCreate[idx];
        const slot = (mapping.row - 1) * 4 + mapping.col;
        allSlotValues.push({ containerId: container.id, rack: mapping.rack, slot, minerId: miner.id });
        if (miner.macAddress) minerByMac.set(normalizeMac(miner.macAddress), miner);
      }

      created += createdMiners.length;
      assigned += createdMiners.length;
    }

    const processed = Math.min(i + batchSize, allMappings.length);
    if (processed % 2000 === 0 || processed >= allMappings.length) {
      console.log(`Processed ${processed}/${allMappings.length} mappings (${created} new miners, ${skipped} skipped)`);
    }
  }

  console.log(`\nInserting ${allSlotValues.length} slot assignments in bulk...`);
  const slotBatchSize = 1000;
  for (let i = 0; i < allSlotValues.length; i += slotBatchSize) {
    const slotBatch = allSlotValues.slice(i, i + slotBatchSize);
    await db.insert(slotAssignments).values(slotBatch);
    console.log(`  Inserted batch ${Math.floor(i / slotBatchSize) + 1}/${Math.ceil(allSlotValues.length / slotBatchSize)}`);
  }

  console.log(`\n=== DONE ===`);
  console.log(`Created: ${created} new miners`);
  console.log(`Assigned: ${assigned} miners to rack slots`);
  console.log(`Skipped: ${skipped} (no matching container)`);
  console.log(`\nRestart your server and refresh the browser to see the results.`);
  
  process.exit(0);
}

fixAssignments().catch((err) => {
  console.error("ERROR:", err);
  process.exit(1);
});

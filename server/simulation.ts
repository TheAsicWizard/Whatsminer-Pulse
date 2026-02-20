import { db } from "./db";
import { miners, minerSnapshots, alerts, alertRules } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { log } from "./index";

function jitter(base: number, pct: number): number {
  return base * (1 + (Math.random() - 0.5) * 2 * pct);
}

const MINER_PROFILES: Record<string, { hashGhs: number; power: number; targetFreq: number }> = {
  "WhatsMiner M60S": { hashGhs: 170000, power: 3420, targetFreq: 600 },
  "WhatsMiner M60": { hashGhs: 156000, power: 3420, targetFreq: 580 },
  "WhatsMiner M50S": { hashGhs: 126000, power: 3276, targetFreq: 575 },
  "WhatsMiner M50": { hashGhs: 114000, power: 3306, targetFreq: 550 },
  "WhatsMiner M30S++": { hashGhs: 112000, power: 3472, targetFreq: 530 },
  "WhatsMiner M50S+": { hashGhs: 140000, power: 3500, targetFreq: 600 },
  "WhatsMiner M56S": { hashGhs: 212000, power: 5550, targetFreq: 650 },
};

function generateSnap(miner: { id: string; model: string | null; status: string }) {
  const profile = MINER_PROFILES[miner.model || ""] || MINER_PROFILES["WhatsMiner M60S"];
  const isWarning = miner.status === "warning";
  const isCritical = miner.status === "critical";

  const baseTemp = isCritical ? jitter(92, 0.05) : isWarning ? jitter(78, 0.05) : jitter(62, 0.08);
  const hashrate = isCritical
    ? jitter(profile.hashGhs * 0.25, 0.15)
    : isWarning
    ? jitter(profile.hashGhs * 0.65, 0.08)
    : jitter(profile.hashGhs, 0.05);
  const power = isCritical
    ? jitter(profile.power * 0.85, 0.04)
    : isWarning
    ? jitter(profile.power * 0.8, 0.04)
    : jitter(profile.power, 0.03);

  const fanIn = isCritical ? jitter(6200, 0.05) : jitter(4800, 0.06);
  const fanOut = isCritical ? jitter(6100, 0.05) : jitter(4700, 0.06);

  return {
    minerId: miner.id,
    hashrate: Math.max(0, hashrate),
    temperature: baseTemp,
    envTemp: jitter(28, 0.1),
    chipTempMin: baseTemp - jitter(5, 0.2),
    chipTempMax: baseTemp + jitter(8, 0.2),
    chipTempAvg: baseTemp + jitter(2, 0.2),
    fanSpeedIn: Math.round(Math.max(0, fanIn)),
    fanSpeedOut: Math.round(Math.max(0, fanOut)),
    power: Math.round(Math.max(0, power)),
    powerLimit: profile.power + 200,
    powerMode: isWarning ? "Low" : "Normal",
    elapsed: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 86400 * 20),
    accepted: Math.floor(Math.random() * 80000) + 20000,
    rejected: Math.floor(Math.random() * 80),
    poolRejectedPct: Math.random() * 0.5,
    poolStalePct: Math.random() * 0.25,
    efficiency: power > 0 && hashrate > 0 ? power / (hashrate / 1000) : 0,
    freqAvg: Math.round(jitter(profile.targetFreq - 8, 0.03)),
    targetFreq: profile.targetFreq,
    factoryGhs: profile.hashGhs,
  };
}

async function simulateSnapshots() {
  try {
    const simMiners = await db.select().from(miners).where(eq(miners.source, "simulation"));
    const activeMiners = simMiners.filter((m) => m.status !== "offline");

    if (activeMiners.length === 0) return;

    const batchSize = 500;
    for (let i = 0; i < activeMiners.length; i += batchSize) {
      const batch = activeMiners.slice(i, i + batchSize);
      const snaps = batch.map((m) => generateSnap(m));
      const inserted = await db.insert(minerSnapshots).values(snaps).returning({ id: minerSnapshots.id, minerId: minerSnapshots.minerId });

      if (inserted.length > 0) {
        const values = inserted.map((s) => sql`(${s.minerId}::varchar, ${s.id}::varchar)`);
        await db.execute(sql`
          UPDATE miners SET latest_snapshot_id = v.snap_id
          FROM (VALUES ${sql.join(values, sql`, `)}) AS v(miner_id, snap_id)
          WHERE miners.id = v.miner_id
        `);
      }
    }

    const rules = await db.select().from(alertRules).where(eq(alertRules.enabled, true));
    if (rules.length > 0) {
      const problemMiners = activeMiners.filter(
        (m) => m.status === "critical" || m.status === "warning"
      );

      for (const miner of problemMiners) {
        const snap = generateSnap(miner);
        for (const rule of rules) {
          const metricValue = (snap as any)[rule.metric];
          if (metricValue === undefined) continue;

          let triggered = false;
          switch (rule.operator) {
            case ">": triggered = metricValue > rule.threshold; break;
            case "<": triggered = metricValue < rule.threshold; break;
            case ">=": triggered = metricValue >= rule.threshold; break;
            case "<=": triggered = metricValue <= rule.threshold; break;
          }

          if (triggered) {
            const existingAlerts = await db
              .select()
              .from(alerts)
              .where(
                and(
                  eq(alerts.minerId, miner.id),
                  eq(alerts.ruleId, rule.id),
                  eq(alerts.acknowledged, false)
                )
              );

            if (existingAlerts.length === 0) {
              await db.insert(alerts).values({
                minerId: miner.id,
                ruleId: rule.id,
                severity: rule.severity,
                message: `${miner.name}: ${rule.name} (${rule.metric} ${rule.operator} ${rule.threshold}, current: ${typeof metricValue === "number" ? metricValue.toFixed(1) : metricValue})`,
                acknowledged: false,
              });
            }
          }
        }
      }
    }

    log(`Simulation tick: ${activeMiners.length} snapshots`, "simulation");
  } catch (err) {
    console.error("Simulation error:", err);
  }
}

async function cleanOldSnapshots() {
  try {
    const result = await db.execute(sql`
      DELETE FROM miner_snapshots 
      WHERE created_at < now() - interval '2 hours'
      AND id NOT IN (SELECT latest_snapshot_id FROM miners WHERE latest_snapshot_id IS NOT NULL)
    `);
    log(`Snapshot cleanup done`, "simulation");
  } catch (err) {
    console.error("Snapshot cleanup error:", err);
  }
}

export function startSimulation() {
  log("Starting miner simulation (60s interval)", "simulation");
  setInterval(simulateSnapshots, 60000);
  setInterval(cleanOldSnapshots, 300000);
  simulateSnapshots();
}

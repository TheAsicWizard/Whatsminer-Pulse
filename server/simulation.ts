import { db } from "./db";
import { miners, minerSnapshots, alerts, alertRules } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { log } from "./index";

function jitter(base: number, pct: number): number {
  return base * (1 + (Math.random() - 0.5) * 2 * pct);
}

const MINER_PROFILES: Record<string, { hashGhs: number; power: number; targetFreq: number }> = {
  "WhatsMiner M50S": { hashGhs: 126000, power: 3276, targetFreq: 575 },
  "WhatsMiner M50": { hashGhs: 114000, power: 3306, targetFreq: 550 },
  "WhatsMiner M30S++": { hashGhs: 112000, power: 3472, targetFreq: 530 },
  "WhatsMiner M50S+": { hashGhs: 140000, power: 3500, targetFreq: 600 },
  "WhatsMiner M56S": { hashGhs: 212000, power: 5550, targetFreq: 650 },
};

async function simulateSnapshots() {
  try {
    const allMiners = await db.select().from(miners);
    const rules = await db.select().from(alertRules).where(eq(alertRules.enabled, true));

    for (const miner of allMiners) {
      if (miner.status === "offline") continue;

      const profile = MINER_PROFILES[miner.model || ""] || MINER_PROFILES["WhatsMiner M50S"];
      const isWarning = miner.status === "warning";
      const isCritical = miner.status === "critical";

      const baseTemp = isCritical ? jitter(92, 0.05) : isWarning ? jitter(78, 0.05) : jitter(62, 0.08);
      const hashrate = isCritical
        ? jitter(profile.hashGhs * 0.3, 0.15)
        : isWarning
        ? jitter(profile.hashGhs * 0.7, 0.08)
        : jitter(profile.hashGhs, 0.04);
      const power = isCritical
        ? jitter(profile.power * 0.9, 0.04)
        : isWarning
        ? jitter(profile.power * 0.8, 0.04)
        : jitter(profile.power, 0.03);

      const fanIn = isCritical ? jitter(6200, 0.05) : jitter(4800, 0.06);
      const fanOut = isCritical ? jitter(6100, 0.05) : jitter(4700, 0.06);

      const snap = {
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
        elapsed: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 86400 * 3),
        accepted: Math.floor(Math.random() * 50000) + 10000,
        rejected: Math.floor(Math.random() * 50),
        poolRejectedPct: Math.random() * 0.5,
        poolStalePct: Math.random() * 0.3,
        efficiency: power > 0 && hashrate > 0 ? power / (hashrate / 1000) : 0,
        freqAvg: Math.round(jitter(profile.targetFreq - 10, 0.03)),
        targetFreq: profile.targetFreq,
        factoryGhs: profile.hashGhs,
      };

      await db.insert(minerSnapshots).values(snap);

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
              message: `${miner.name}: ${rule.name} (${rule.metric} ${rule.operator} ${rule.threshold}, current: ${typeof metricValue === 'number' ? metricValue.toFixed(1) : metricValue})`,
              acknowledged: false,
            });
          }
        }
      }
    }
  } catch (err) {
    console.error("Simulation error:", err);
  }
}

export function startSimulation() {
  log("Starting miner simulation (30s interval)", "simulation");
  setInterval(simulateSnapshots, 30000);
  simulateSnapshots();
}

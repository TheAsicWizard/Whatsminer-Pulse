import { db } from "./db";
import { miners, minerSnapshots, alertRules, alerts } from "@shared/schema";
import { sql } from "drizzle-orm";
import { log } from "./index";

const MINER_SEED_DATA = [
  { name: "Rack A - Unit 1", ipAddress: "10.21.29.173", port: 4028, location: "Building A", model: "WhatsMiner M50S", status: "online" },
  { name: "Rack A - Unit 2", ipAddress: "10.21.29.174", port: 4028, location: "Building A", model: "WhatsMiner M50S", status: "online" },
  { name: "Rack A - Unit 3", ipAddress: "10.21.29.175", port: 4028, location: "Building A", model: "WhatsMiner M50", status: "online" },
  { name: "Rack B - Unit 1", ipAddress: "10.21.30.101", port: 4028, location: "Building B", model: "WhatsMiner M30S++", status: "online" },
  { name: "Rack B - Unit 2", ipAddress: "10.21.30.102", port: 4028, location: "Building B", model: "WhatsMiner M30S++", status: "warning" },
  { name: "Rack C - Unit 1", ipAddress: "10.21.31.50", port: 4028, location: "Building C", model: "WhatsMiner M50S+", status: "online" },
  { name: "Rack C - Unit 2", ipAddress: "10.21.31.51", port: 4028, location: "Building C", model: "WhatsMiner M50S+", status: "critical" },
  { name: "Rack D - Unit 1", ipAddress: "10.21.32.10", port: 4028, location: "Building D", model: "WhatsMiner M56S", status: "offline" },
];

function jitter(base: number, pct: number): number {
  return base * (1 + (Math.random() - 0.5) * 2 * pct);
}

const MINER_PROFILES: Record<string, { hashGhs: number; power: number; factoryGhs: number; targetFreq: number }> = {
  "WhatsMiner M50S": { hashGhs: 126000, power: 3276, factoryGhs: 126000, targetFreq: 575 },
  "WhatsMiner M50": { hashGhs: 114000, power: 3306, factoryGhs: 114000, targetFreq: 550 },
  "WhatsMiner M30S++": { hashGhs: 112000, power: 3472, factoryGhs: 112000, targetFreq: 530 },
  "WhatsMiner M50S+": { hashGhs: 140000, power: 3500, factoryGhs: 140000, targetFreq: 600 },
  "WhatsMiner M56S": { hashGhs: 212000, power: 5550, factoryGhs: 212000, targetFreq: 650 },
};

function generateSnapshot(minerId: string, model: string, status: string, timeOffset: number) {
  const profile = MINER_PROFILES[model] || MINER_PROFILES["WhatsMiner M50S"];
  const isOnline = status === "online" || status === "warning";
  const isCritical = status === "critical";
  const isOffline = status === "offline";

  const baseTemp = isCritical ? 92 : isOnline ? 62 : 0;
  const envTemp = isOnline || isCritical ? jitter(28, 0.1) : 0;
  const hashrate = isOffline ? 0 : isCritical ? jitter(profile.hashGhs * 0.3, 0.2) : isOnline ? jitter(profile.hashGhs, 0.05) : jitter(profile.hashGhs * 0.7, 0.1);
  const power = isOffline ? 0 : isCritical ? jitter(profile.power * 0.9, 0.05) : isOnline ? jitter(profile.power, 0.03) : jitter(profile.power * 0.8, 0.05);
  const fanIn = isOffline ? 0 : isCritical ? jitter(6200, 0.05) : isOnline ? jitter(4800, 0.08) : jitter(3500, 0.1);
  const fanOut = isOffline ? 0 : isCritical ? jitter(6100, 0.05) : isOnline ? jitter(4700, 0.08) : jitter(3400, 0.1);
  const elapsed = isOffline ? 0 : Math.floor(jitter(86400 * 3, 0.5));

  const now = new Date();
  now.setMinutes(now.getMinutes() - timeOffset * 30);

  return {
    minerId,
    hashrate: Math.max(0, hashrate),
    temperature: jitter(baseTemp, 0.08),
    envTemp,
    chipTempMin: jitter(baseTemp - 5, 0.05),
    chipTempMax: jitter(baseTemp + 8, 0.05),
    chipTempAvg: jitter(baseTemp + 2, 0.05),
    fanSpeedIn: Math.round(Math.max(0, fanIn)),
    fanSpeedOut: Math.round(Math.max(0, fanOut)),
    power: Math.round(Math.max(0, power)),
    powerLimit: profile.power + 200,
    powerMode: status === "warning" ? "Low" : "Normal",
    elapsed: Math.max(0, elapsed),
    accepted: Math.floor(Math.random() * 50000) + 10000,
    rejected: Math.floor(Math.random() * 50),
    poolRejectedPct: Math.random() * 0.5,
    poolStalePct: Math.random() * 0.3,
    efficiency: power > 0 && hashrate > 0 ? power / (hashrate / 1000) : 0,
    freqAvg: Math.round(jitter(profile.targetFreq - 10, 0.03)),
    targetFreq: profile.targetFreq,
    factoryGhs: profile.factoryGhs,
    createdAt: now,
  };
}

export async function seedDatabase() {
  const existingMiners = await db.select({ count: sql<number>`count(*)::int` }).from(miners);
  if (existingMiners[0].count > 0) {
    log("Database already seeded, skipping", "seed");
    return;
  }

  log("Seeding database...", "seed");

  const createdMiners = [];
  for (const data of MINER_SEED_DATA) {
    const [miner] = await db.insert(miners).values(data).returning();
    createdMiners.push(miner);
  }

  for (const miner of createdMiners) {
    for (let i = 23; i >= 0; i--) {
      const snap = generateSnapshot(miner.id, miner.model || "WhatsMiner M50S", miner.status, i);
      await db.insert(minerSnapshots).values(snap);
    }
  }

  await db.insert(alertRules).values([
    { name: "High Board Temperature", metric: "temperature", operator: ">", threshold: 85, severity: "critical", enabled: true },
    { name: "Low Hashrate", metric: "hashrate", operator: "<", threshold: 50000, severity: "warning", enabled: true },
    { name: "Fan Failure", metric: "fanSpeedIn", operator: "<", threshold: 1000, severity: "critical", enabled: true },
    { name: "High Rejection Rate", metric: "poolRejectedPct", operator: ">", threshold: 2, severity: "warning", enabled: true },
  ]);

  const criticalMiner = createdMiners.find(m => m.status === "critical");
  const warningMiner = createdMiners.find(m => m.status === "warning");

  if (criticalMiner) {
    await db.insert(alerts).values([
      { minerId: criticalMiner.id, severity: "critical", message: `${criticalMiner.name}: Board temperature exceeds 85°C (92.3°C)`, acknowledged: false },
      { minerId: criticalMiner.id, severity: "critical", message: `${criticalMiner.name}: Hashrate dropped below 50% of factory rating`, acknowledged: false },
    ]);
  }

  if (warningMiner) {
    await db.insert(alerts).values([
      { minerId: warningMiner.id, severity: "warning", message: `${warningMiner.name}: Running in Low power mode`, acknowledged: false },
    ]);
  }

  await db.insert(alerts).values([
    { minerId: createdMiners[0].id, severity: "info", message: `${createdMiners[0].name}: Miner restarted after firmware update`, acknowledged: true },
  ]);

  log("Database seeded successfully", "seed");
}

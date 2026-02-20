import { db } from "./db";
import { miners, minerSnapshots, alertRules, alerts, containers, slotAssignments } from "@shared/schema";
import { sql } from "drizzle-orm";
import { log } from "./index";

const AIR_COOLED_CONTAINERS = [
  { name: "C188", model: "WhatsMiner M60S", capacity: 486, ipStart: "10.31.0.1", ipEnd: "10.31.3.255" },
  { name: "C209", model: "WhatsMiner M60S", capacity: 486, ipStart: "10.31.4.1", ipEnd: "10.31.7.255" },
  { name: "C223", model: "WhatsMiner M60S", capacity: 486, ipStart: "10.31.12.1", ipEnd: "10.31.15.255" },
  { name: "C224", model: "WhatsMiner M60S", capacity: 486, ipStart: "10.31.16.1", ipEnd: "10.31.19.255" },
  { name: "C226", model: "WhatsMiner M60S", capacity: 486, ipStart: "10.31.24.1", ipEnd: "10.31.27.255" },
  { name: "C239", model: "WhatsMiner M60", capacity: 486, ipStart: "10.31.28.1", ipEnd: "10.31.31.255" },
  { name: "C241", model: "WhatsMiner M60S", capacity: 486, ipStart: "10.31.36.1", ipEnd: "10.31.39.255" },
  { name: "C242", model: "WhatsMiner M60S", capacity: 486, ipStart: "10.31.40.1", ipEnd: "10.31.43.255" },
  { name: "C245", model: "WhatsMiner M60 / M60S", capacity: 486, ipStart: "10.31.52.1", ipEnd: "10.31.55.255" },
  { name: "C247", model: "WhatsMiner M60 / M60S", capacity: 486, ipStart: "10.31.60.1", ipEnd: "10.31.63.255" },
  { name: "C248", model: "WhatsMiner M60 / M60S", capacity: 560, ipStart: "10.31.64.1", ipEnd: "10.31.67.255" },
  { name: "C249", model: "WhatsMiner M60S", capacity: 486, ipStart: "10.31.68.1", ipEnd: "10.31.71.255" },
  { name: "C250", model: "WhatsMiner M60 / M60S", capacity: 486, ipStart: "10.31.72.1", ipEnd: "10.31.75.255" },
  { name: "C251", model: "WhatsMiner M60", capacity: 486, ipStart: "10.31.76.1", ipEnd: "10.31.79.255" },
  { name: "C252", model: "WhatsMiner M60", capacity: 486, ipStart: "10.31.80.1", ipEnd: "10.31.83.255" },
  { name: "C253", model: "WhatsMiner M60 / M60S", capacity: 486, ipStart: "10.31.84.1", ipEnd: "10.31.87.255" },
  { name: "C254", model: "WhatsMiner M60 / M60S", capacity: 486, ipStart: "10.31.88.1", ipEnd: "10.31.91.255" },
  { name: "C255", model: "WhatsMiner M60 / M60S", capacity: 486, ipStart: "10.31.92.1", ipEnd: "10.31.95.255" },
  { name: "C256", model: "WhatsMiner M60 / M60S", capacity: 486, ipStart: "10.31.96.1", ipEnd: "10.31.99.255" },
  { name: "C257", model: "WhatsMiner M60 / M60S", capacity: 486, ipStart: "10.31.100.1", ipEnd: "10.31.103.255" },
  { name: "C258", model: "WhatsMiner M60S", capacity: 486, ipStart: "10.31.104.1", ipEnd: "10.31.107.255" },
  { name: "C259", model: "WhatsMiner M60S", capacity: 486, ipStart: "10.31.108.1", ipEnd: "10.31.111.255" },
  { name: "C260", model: "WhatsMiner M60S", capacity: 486, ipStart: "10.31.112.1", ipEnd: "10.31.115.255" },
  { name: "C261", model: "WhatsMiner M60 / M60S", capacity: 486, ipStart: "10.31.116.1", ipEnd: "10.31.119.255" },
  { name: "C262", model: "WhatsMiner M60S", capacity: 486, ipStart: "10.31.120.1", ipEnd: "10.31.123.255" },
  { name: "C263", model: "WhatsMiner M60S", capacity: 486, ipStart: "10.31.124.1", ipEnd: "10.31.127.255" },
  { name: "C264", model: "WhatsMiner M60 / M60S", capacity: 486, ipStart: "10.31.128.1", ipEnd: "10.31.131.255" },
  { name: "C265", model: "WhatsMiner M60", capacity: 486, ipStart: "10.31.132.1", ipEnd: "10.31.135.255" },
  { name: "C266", model: "WhatsMiner M60 / M60S", capacity: 486, ipStart: "10.31.136.1", ipEnd: "10.31.139.255" },
  { name: "C267", model: "WhatsMiner M60S", capacity: 486, ipStart: "10.31.140.1", ipEnd: "10.31.143.255" },
  { name: "C268", model: "WhatsMiner M60S", capacity: 486, ipStart: "10.31.144.1", ipEnd: "10.31.147.255" },
  { name: "C269", model: "WhatsMiner M60S", capacity: 486, ipStart: "10.31.148.1", ipEnd: "10.31.151.255" },
  { name: "C270", model: "WhatsMiner M60S", capacity: 486, ipStart: "10.31.152.1", ipEnd: "10.31.155.255" },
  { name: "C271", model: "WhatsMiner M60S", capacity: 486, ipStart: "10.31.156.1", ipEnd: "10.31.159.255" },
  { name: "C272", model: "WhatsMiner M60S", capacity: 486, ipStart: "10.31.160.1", ipEnd: "10.31.163.255" },
  { name: "C273", model: "WhatsMiner M60S", capacity: 486, ipStart: "10.31.164.1", ipEnd: "10.31.167.255" },
  { name: "C274", model: "WhatsMiner M60S", capacity: 486, ipStart: "10.31.168.1", ipEnd: "10.31.171.255" },
  { name: "C275", model: "WhatsMiner M60S", capacity: 486, ipStart: "10.31.172.1", ipEnd: "10.31.175.255" },
  { name: "C276", model: "WhatsMiner M60S", capacity: 486, ipStart: "10.31.176.1", ipEnd: "10.31.179.255" },
  { name: "C277", model: "WhatsMiner M60S", capacity: 486, ipStart: "10.31.180.1", ipEnd: "10.31.183.255" },
  { name: "C278", model: "WhatsMiner M60S", capacity: 486, ipStart: "10.31.184.1", ipEnd: "10.31.187.255" },
  { name: "C279", model: "WhatsMiner M60S", capacity: 486, ipStart: "10.31.188.1", ipEnd: "10.31.191.255" },
  { name: "C280", model: "WhatsMiner M60S", capacity: 486, ipStart: "10.31.192.1", ipEnd: "10.31.195.255" },
  { name: "C281", model: "WhatsMiner M60S", capacity: 486, ipStart: "10.31.196.1", ipEnd: "10.31.199.255" },
  { name: "C282", model: "WhatsMiner M60S", capacity: 486, ipStart: "10.31.200.1", ipEnd: "10.31.203.255" },
  { name: "C283", model: "WhatsMiner M60S", capacity: 486, ipStart: "10.31.204.1", ipEnd: "10.31.207.255" },
  { name: "C284", model: "WhatsMiner M60 / M60S", capacity: 486, ipStart: "10.31.208.1", ipEnd: "10.31.211.255" },
];

const RACKS_PER_CONTAINER = 14;
const SLOTS_PER_RACK = 40;

const MINER_PROFILES: Record<string, { hashGhs: number; power: number; factoryGhs: number; targetFreq: number }> = {
  "WhatsMiner M60S": { hashGhs: 170000, power: 3420, factoryGhs: 170000, targetFreq: 600 },
  "WhatsMiner M60": { hashGhs: 156000, power: 3420, factoryGhs: 156000, targetFreq: 580 },
  "WhatsMiner M60 / M60S": { hashGhs: 163000, power: 3420, factoryGhs: 163000, targetFreq: 590 },
};

function jitter(base: number, pct: number): number {
  return base * (1 + (Math.random() - 0.5) * 2 * pct);
}

function pickStatus(): string {
  const r = Math.random();
  if (r < 0.88) return "online";
  if (r < 0.93) return "warning";
  if (r < 0.96) return "critical";
  return "offline";
}

function generateSnapshot(minerId: string, model: string, status: string, timeOffset: number) {
  const profile = MINER_PROFILES[model] || MINER_PROFILES["WhatsMiner M60S"];
  const isOnline = status === "online";
  const isWarning = status === "warning";
  const isCritical = status === "critical";
  const isOffline = status === "offline";

  const baseTemp = isCritical ? 92 : isWarning ? 76 : isOnline ? jitter(62, 0.12) : 0;
  const envTemp = isOffline ? 0 : jitter(28, 0.12);
  const hashrate = isOffline ? 0 : isCritical ? jitter(profile.hashGhs * 0.25, 0.2) : isWarning ? jitter(profile.hashGhs * 0.65, 0.1) : jitter(profile.hashGhs, 0.06);
  const power = isOffline ? 0 : isCritical ? jitter(profile.power * 0.85, 0.05) : isWarning ? jitter(profile.power * 0.8, 0.05) : jitter(profile.power, 0.04);
  const fanIn = isOffline ? 0 : isCritical ? jitter(6200, 0.05) : jitter(4800, 0.08);
  const fanOut = isOffline ? 0 : isCritical ? jitter(6100, 0.05) : jitter(4700, 0.08);
  const elapsed = isOffline ? 0 : Math.floor(jitter(86400 * 20, 0.5));

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
    powerMode: isWarning ? "Low" : "Normal",
    elapsed: Math.max(0, elapsed),
    accepted: Math.floor(Math.random() * 80000) + 20000,
    rejected: Math.floor(Math.random() * 80),
    poolRejectedPct: Math.random() * 0.5,
    poolStalePct: Math.random() * 0.25,
    efficiency: power > 0 && hashrate > 0 ? power / (hashrate / 1000) : 0,
    freqAvg: Math.round(jitter(profile.targetFreq - 8, 0.03)),
    targetFreq: profile.targetFreq,
    factoryGhs: profile.factoryGhs,
    createdAt: now,
  };
}

function ipFromParts(a: number, b: number, c: number, d: number): string {
  return `${a}.${b}.${c}.${d}`;
}

function parseIp(ip: string): [number, number, number, number] {
  const parts = ip.split(".").map(Number) as [number, number, number, number];
  return parts;
}

function generateMinersForContainer(
  containerName: string,
  model: string,
  capacity: number,
  ipStart: string,
  ipEnd: string
) {
  const start = parseIp(ipStart);
  const minerData = [];
  let [a, b, c, d] = start;

  for (let i = 0; i < capacity; i++) {
    if (d === 0) d = 1;
    const ip = ipFromParts(a, b, c, d);
    const rack = Math.floor(i / SLOTS_PER_RACK) + 1;
    const slot = (i % SLOTS_PER_RACK) + 1;
    const location = `${containerName}-${String(rack).padStart(2, "0")}-${String(slot).padStart(2, "0")}`;
    const status = pickStatus();

    const actualModel = model.includes("/") ? (Math.random() < 0.5 ? "WhatsMiner M60" : "WhatsMiner M60S") : model;

    minerData.push({
      name: location,
      ipAddress: ip,
      port: 4028,
      location: containerName,
      model: actualModel,
      status,
      source: "simulation" as const,
    });

    d++;
    if (d > 255) {
      d = 1;
      c++;
    }
  }

  return minerData;
}

export async function seedDatabase() {
  const existingMiners = await db.select({ count: sql<number>`count(*)::int` }).from(miners);
  if (existingMiners[0].count > 0) {
    log("Database already seeded, skipping", "seed");
    return;
  }

  log("Seeding database with air-cooled WhatsMiner site layout...", "seed");

  const createdContainers = [];
  for (const c of AIR_COOLED_CONTAINERS) {
    const rackCount = RACKS_PER_CONTAINER;
    const slotsPerRack = SLOTS_PER_RACK;

    const [container] = await db.insert(containers).values({
      name: c.name,
      rackCount,
      slotsPerRack,
      ipRangeStart: c.ipStart,
      ipRangeEnd: c.ipEnd,
    }).returning();
    createdContainers.push({ ...container, ...c });
  }
  log(`Created ${createdContainers.length} containers`, "seed");

  let totalMinersCreated = 0;
  const allCreatedMiners: Array<{ id: string; model: string; status: string; containerId: string; rack: number; slot: number }> = [];

  for (const containerDef of createdContainers) {
    const minerDataList = generateMinersForContainer(
      containerDef.name,
      containerDef.model,
      containerDef.capacity,
      containerDef.ipStart,
      containerDef.ipEnd
    );

    const batchSize = 50;
    for (let i = 0; i < minerDataList.length; i += batchSize) {
      const batch = minerDataList.slice(i, i + batchSize);
      const created = await db.insert(miners).values(batch).returning();

      for (let j = 0; j < created.length; j++) {
        const miner = created[j];
        const idx = i + j;
        const rack = Math.floor(idx / SLOTS_PER_RACK) + 1;
        const slot = (idx % SLOTS_PER_RACK) + 1;

        allCreatedMiners.push({
          id: miner.id,
          model: miner.model || "WhatsMiner M60S",
          status: miner.status,
          containerId: containerDef.id,
          rack,
          slot,
        });
      }
    }

    totalMinersCreated += minerDataList.length;
    if (totalMinersCreated % 1000 === 0 || totalMinersCreated === minerDataList.length) {
      log(`Created ${totalMinersCreated} miners so far...`, "seed");
    }
  }
  log(`Created ${totalMinersCreated} total miners`, "seed");

  log("Creating slot assignments...", "seed");
  const assignBatchSize = 100;
  for (let i = 0; i < allCreatedMiners.length; i += assignBatchSize) {
    const batch = allCreatedMiners.slice(i, i + assignBatchSize).map((m) => ({
      containerId: m.containerId,
      rack: m.rack,
      slot: m.slot,
      minerId: m.id,
    }));
    await db.insert(slotAssignments).values(batch);
  }
  log(`Created ${allCreatedMiners.length} slot assignments`, "seed");

  log("Generating initial snapshots (latest only)...", "seed");
  for (let i = 0; i < allCreatedMiners.length; i += assignBatchSize) {
    const batch = allCreatedMiners.slice(i, i + assignBatchSize).map((m) =>
      generateSnapshot(m.id, m.model, m.status, 0)
    );
    await db.insert(minerSnapshots).values(batch);
  }
  log("Initial snapshots created", "seed");

  await db.insert(alertRules).values([
    { name: "High Board Temperature", metric: "temperature", operator: ">", threshold: 85, severity: "critical", enabled: true },
    { name: "Low Hashrate", metric: "hashrate", operator: "<", threshold: 50000, severity: "warning", enabled: true },
    { name: "Fan Failure", metric: "fanSpeedIn", operator: "<", threshold: 1000, severity: "critical", enabled: true },
    { name: "High Rejection Rate", metric: "poolRejectedPct", operator: ">", threshold: 2, severity: "warning", enabled: true },
  ]);

  const criticalMiners = allCreatedMiners.filter((m) => m.status === "critical").slice(0, 5);
  const warningMiners = allCreatedMiners.filter((m) => m.status === "warning").slice(0, 5);

  const alertValues = [];
  for (const m of criticalMiners) {
    alertValues.push({
      minerId: m.id,
      severity: "critical",
      message: `Board temperature exceeds 85°C`,
      acknowledged: false,
    });
  }
  for (const m of warningMiners) {
    alertValues.push({
      minerId: m.id,
      severity: "warning",
      message: `Hashrate below expected threshold`,
      acknowledged: false,
    });
  }
  if (alertValues.length > 0) {
    await db.insert(alerts).values(alertValues);
  }

  log(`Seed complete: ${createdContainers.length} containers, ${totalMinersCreated} miners, ${alertValues.length} alerts`, "seed");
}

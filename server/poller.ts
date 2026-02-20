import { db } from "./db";
import { miners, minerSnapshots, alerts, alertRules } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { pollRealMiner } from "./scanner";
import { log } from "./index";

const POLL_BATCH_SIZE = 30;
let isPolling = false;

async function processMiner(miner: any, rules: any[]) {
  try {
    const data = await pollRealMiner(miner.ipAddress, miner.port);

    if (!data) {
      if (miner.status !== "offline") {
        await db.update(miners).set({ status: "offline" }).where(eq(miners.id, miner.id));
      }
      return;
    }

    let status = "online";
    if (data.temperature > 85) status = "critical";
    else if (data.temperature > 75) status = "warning";
    else if (data.hashrate === 0) status = "offline";

    if (miner.status !== status) {
      await db.update(miners).set({ status }).where(eq(miners.id, miner.id));
    }

    const snap = {
      minerId: miner.id,
      ...data,
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
  } catch (err) {
    log(`Error polling ${miner.name} (${miner.ipAddress}): ${err}`, "poller");
  }
}

async function pollRealMiners() {
  if (isPolling) {
    log("Previous poll cycle still running, skipping", "poller");
    return;
  }

  isPolling = true;
  const startTime = Date.now();

  try {
    const allMiners = await db.select().from(miners);
    const realMiners = allMiners.filter((m) => m.source === "scanned");

    if (realMiners.length === 0) {
      isPolling = false;
      return;
    }

    const rules = await db.select().from(alertRules).where(eq(alertRules.enabled, true));

    log(`Polling ${realMiners.length} miners in batches of ${POLL_BATCH_SIZE}...`, "poller");

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < realMiners.length; i += POLL_BATCH_SIZE) {
      const batch = realMiners.slice(i, i + POLL_BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((miner) => processMiner(miner, rules))
      );

      for (const result of results) {
        if (result.status === "fulfilled") successCount++;
        else failCount++;
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`Poll complete: ${successCount} ok, ${failCount} failed in ${elapsed}s`, "poller");
  } catch (err) {
    log(`Poller error: ${err}`, "poller");
  } finally {
    isPolling = false;
  }
}

let pollerInterval: ReturnType<typeof setInterval> | null = null;

export function startRealPoller() {
  log("Starting real miner poller (30s interval)", "poller");
  if (pollerInterval) clearInterval(pollerInterval);
  pollerInterval = setInterval(pollRealMiners, 30000);
  pollRealMiners();
}

export function stopRealPoller() {
  if (pollerInterval) {
    clearInterval(pollerInterval);
    pollerInterval = null;
  }
}

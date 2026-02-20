import { db } from "./db";
import { miners, minerSnapshots, alerts, alertRules } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { pollRealMiner } from "./scanner";
import { log } from "./index";

async function pollRealMiners() {
  try {
    const allMiners = await db.select().from(miners);
    const realMiners = allMiners.filter((m) => m.source === "scanned");

    if (realMiners.length === 0) return;

    const rules = await db.select().from(alertRules).where(eq(alertRules.enabled, true));

    for (const miner of realMiners) {
      try {
        const data = await pollRealMiner(miner.ipAddress, miner.port);

        if (!data) {
          if (miner.status !== "offline") {
            await db.update(miners).set({ status: "offline" }).where(eq(miners.id, miner.id));
          }
          continue;
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
  } catch (err) {
    log(`Poller error: ${err}`, "poller");
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

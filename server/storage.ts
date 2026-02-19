import {
  type Miner, type InsertMiner,
  type MinerSnapshot, type InsertSnapshot,
  type AlertRule, type InsertAlertRule,
  type Alert, type InsertAlert,
  type MinerWithLatest, type FleetStats,
  miners, minerSnapshots, alertRules, alerts,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";

export interface IStorage {
  getMiners(): Promise<Miner[]>;
  getMiner(id: string): Promise<Miner | undefined>;
  createMiner(miner: InsertMiner): Promise<Miner>;
  updateMiner(id: string, data: Partial<InsertMiner>): Promise<Miner | undefined>;
  deleteMiner(id: string): Promise<void>;
  getMinersWithLatest(): Promise<MinerWithLatest[]>;
  getMinerWithLatest(id: string): Promise<MinerWithLatest | undefined>;

  createSnapshot(snapshot: InsertSnapshot): Promise<MinerSnapshot>;
  getSnapshots(minerId: string, limit?: number): Promise<MinerSnapshot[]>;
  getLatestSnapshot(minerId: string): Promise<MinerSnapshot | undefined>;

  getAlertRules(): Promise<AlertRule[]>;
  createAlertRule(rule: InsertAlertRule): Promise<AlertRule>;
  updateAlertRule(id: string, data: Partial<InsertAlertRule>): Promise<AlertRule | undefined>;
  deleteAlertRule(id: string): Promise<void>;

  getAlerts(): Promise<Alert[]>;
  createAlert(alert: InsertAlert): Promise<Alert>;
  acknowledgeAlert(id: string): Promise<void>;
  acknowledgeAllAlerts(): Promise<void>;

  getFleetStats(): Promise<FleetStats>;
  getFleetHistory(): Promise<Array<{ time: string; hashrate: number; power: number; temp: number }>>;
}

export class DatabaseStorage implements IStorage {
  async getMiners(): Promise<Miner[]> {
    return db.select().from(miners).orderBy(miners.name);
  }

  async getMiner(id: string): Promise<Miner | undefined> {
    const [miner] = await db.select().from(miners).where(eq(miners.id, id));
    return miner;
  }

  async createMiner(miner: InsertMiner): Promise<Miner> {
    const [created] = await db.insert(miners).values(miner).returning();
    return created;
  }

  async updateMiner(id: string, data: Partial<InsertMiner>): Promise<Miner | undefined> {
    const [updated] = await db.update(miners).set(data).where(eq(miners.id, id)).returning();
    return updated;
  }

  async deleteMiner(id: string): Promise<void> {
    await db.delete(minerSnapshots).where(eq(minerSnapshots.minerId, id));
    await db.delete(alerts).where(eq(alerts.minerId, id));
    await db.delete(miners).where(eq(miners.id, id));
  }

  async getMinersWithLatest(): Promise<MinerWithLatest[]> {
    const allMiners = await this.getMiners();
    const results: MinerWithLatest[] = [];
    for (const miner of allMiners) {
      const latest = await this.getLatestSnapshot(miner.id);
      const alertCount = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(alerts)
        .where(and(eq(alerts.minerId, miner.id), eq(alerts.acknowledged, false)));
      results.push({
        ...miner,
        latest: latest ?? null,
        alertCount: alertCount[0]?.count ?? 0,
      });
    }
    return results;
  }

  async getMinerWithLatest(id: string): Promise<MinerWithLatest | undefined> {
    const miner = await this.getMiner(id);
    if (!miner) return undefined;
    const latest = await this.getLatestSnapshot(id);
    const alertCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(alerts)
      .where(and(eq(alerts.minerId, id), eq(alerts.acknowledged, false)));
    return {
      ...miner,
      latest: latest ?? null,
      alertCount: alertCount[0]?.count ?? 0,
    };
  }

  async createSnapshot(snapshot: InsertSnapshot): Promise<MinerSnapshot> {
    const [created] = await db.insert(minerSnapshots).values(snapshot).returning();
    return created;
  }

  async getSnapshots(minerId: string, limit = 50): Promise<MinerSnapshot[]> {
    return db
      .select()
      .from(minerSnapshots)
      .where(eq(minerSnapshots.minerId, minerId))
      .orderBy(desc(minerSnapshots.createdAt))
      .limit(limit);
  }

  async getLatestSnapshot(minerId: string): Promise<MinerSnapshot | undefined> {
    const [snap] = await db
      .select()
      .from(minerSnapshots)
      .where(eq(minerSnapshots.minerId, minerId))
      .orderBy(desc(minerSnapshots.createdAt))
      .limit(1);
    return snap;
  }

  async getAlertRules(): Promise<AlertRule[]> {
    return db.select().from(alertRules).orderBy(alertRules.name);
  }

  async createAlertRule(rule: InsertAlertRule): Promise<AlertRule> {
    const [created] = await db.insert(alertRules).values(rule).returning();
    return created;
  }

  async updateAlertRule(id: string, data: Partial<InsertAlertRule>): Promise<AlertRule | undefined> {
    const [updated] = await db.update(alertRules).set(data).where(eq(alertRules.id, id)).returning();
    return updated;
  }

  async deleteAlertRule(id: string): Promise<void> {
    await db.delete(alertRules).where(eq(alertRules.id, id));
  }

  async getAlerts(): Promise<Alert[]> {
    return db.select().from(alerts).orderBy(desc(alerts.createdAt)).limit(100);
  }

  async createAlert(alert: InsertAlert): Promise<Alert> {
    const [created] = await db.insert(alerts).values(alert).returning();
    return created;
  }

  async acknowledgeAlert(id: string): Promise<void> {
    await db.update(alerts).set({ acknowledged: true }).where(eq(alerts.id, id));
  }

  async acknowledgeAllAlerts(): Promise<void> {
    await db.update(alerts).set({ acknowledged: true }).where(eq(alerts.acknowledged, false));
  }

  async getFleetStats(): Promise<FleetStats> {
    const allMiners = await this.getMiners();
    let totalHashrate = 0;
    let totalPower = 0;
    let totalTemp = 0;
    let totalEfficiency = 0;
    let onlineCount = 0;
    let tempCount = 0;
    let effCount = 0;

    for (const miner of allMiners) {
      if (miner.status === "online" || miner.status === "warning") {
        onlineCount++;
        const snap = await this.getLatestSnapshot(miner.id);
        if (snap) {
          totalHashrate += snap.hashrate ?? 0;
          totalPower += snap.power ?? 0;
          if (snap.temperature && snap.temperature > 0) {
            totalTemp += snap.temperature;
            tempCount++;
          }
          if (snap.hashrate && snap.power && snap.hashrate > 0) {
            const ths = (snap.hashrate) / 1000;
            if (ths > 0) {
              totalEfficiency += (snap.power) / ths;
              effCount++;
            }
          }
        }
      }
    }

    const activeAlerts = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(alerts)
      .where(eq(alerts.acknowledged, false));

    return {
      totalMiners: allMiners.length,
      onlineMiners: onlineCount,
      totalHashrate,
      totalPower,
      avgTemperature: tempCount > 0 ? totalTemp / tempCount : 0,
      avgEfficiency: effCount > 0 ? totalEfficiency / effCount : 0,
      activeAlerts: activeAlerts[0]?.count ?? 0,
    };
  }

  async getFleetHistory(): Promise<Array<{ time: string; hashrate: number; power: number; temp: number }>> {
    const allMiners = await this.getMiners();
    const snapMap = new Map<string, { hashrate: number; power: number; temp: number; count: number }>();

    for (const miner of allMiners) {
      const snaps = await this.getSnapshots(miner.id, 24);
      for (const snap of snaps) {
        const time = new Date(snap.createdAt!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const existing = snapMap.get(time) || { hashrate: 0, power: 0, temp: 0, count: 0 };
        existing.hashrate += snap.hashrate ?? 0;
        existing.power += snap.power ?? 0;
        existing.temp += snap.temperature ?? 0;
        existing.count++;
        snapMap.set(time, existing);
      }
    }

    return Array.from(snapMap.entries())
      .map(([time, data]) => ({
        time,
        hashrate: data.hashrate,
        power: data.power,
        temp: data.count > 0 ? data.temp / data.count : 0,
      }))
      .reverse();
  }
}

export const storage = new DatabaseStorage();

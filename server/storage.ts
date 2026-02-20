import {
  type Miner, type InsertMiner,
  type MinerSnapshot, type InsertSnapshot,
  type AlertRule, type InsertAlertRule,
  type Alert, type InsertAlert,
  type MinerWithLatest, type FleetStats,
  type ScanConfig, type InsertScanConfig,
  type Container, type InsertContainer, type ContainerWithSlots,
  type SlotAssignment, type InsertSlotAssignment,
  miners, minerSnapshots, alertRules, alerts, scanConfigs,
  containers, slotAssignments,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql, gte, lte } from "drizzle-orm";

export interface IStorage {
  getMiners(): Promise<Miner[]>;
  getMiner(id: string): Promise<Miner | undefined>;
  getMinerByIp(ip: string, port: number): Promise<Miner | undefined>;
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

  getScanConfigs(): Promise<ScanConfig[]>;
  getScanConfig(id: string): Promise<ScanConfig | undefined>;
  createScanConfig(config: InsertScanConfig): Promise<ScanConfig>;
  updateScanConfig(id: string, data: Partial<ScanConfig>): Promise<ScanConfig | undefined>;
  deleteScanConfig(id: string): Promise<void>;

  getFleetStats(): Promise<FleetStats>;
  getFleetHistory(): Promise<Array<{ time: string; hashrate: number; power: number; temp: number }>>;

  getContainers(): Promise<Container[]>;
  getContainer(id: string): Promise<Container | undefined>;
  createContainer(container: InsertContainer): Promise<Container>;
  updateContainer(id: string, data: Partial<InsertContainer>): Promise<Container | undefined>;
  deleteContainer(id: string): Promise<void>;
  getContainersWithSlots(): Promise<ContainerWithSlots[]>;

  getSlotAssignments(containerId: string): Promise<SlotAssignment[]>;
  assignMinerToSlot(containerId: string, rack: number, slot: number, minerId: string): Promise<SlotAssignment>;
  unassignSlot(containerId: string, rack: number, slot: number): Promise<void>;
  swapMinerInSlot(containerId: string, rack: number, slot: number, newMinerId: string): Promise<SlotAssignment>;
  autoAssignByIpRange(): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  async getMiners(): Promise<Miner[]> {
    return db.select().from(miners).orderBy(miners.name);
  }

  async getMiner(id: string): Promise<Miner | undefined> {
    const [miner] = await db.select().from(miners).where(eq(miners.id, id));
    return miner;
  }

  async getMinerByIp(ip: string, port: number): Promise<Miner | undefined> {
    const [miner] = await db.select().from(miners)
      .where(and(eq(miners.ipAddress, ip), eq(miners.port, port)));
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

  async getScanConfigs(): Promise<ScanConfig[]> {
    return db.select().from(scanConfigs).orderBy(scanConfigs.name);
  }

  async getScanConfig(id: string): Promise<ScanConfig | undefined> {
    const [config] = await db.select().from(scanConfigs).where(eq(scanConfigs.id, id));
    return config;
  }

  async createScanConfig(config: InsertScanConfig): Promise<ScanConfig> {
    const [created] = await db.insert(scanConfigs).values(config).returning();
    return created;
  }

  async updateScanConfig(id: string, data: Partial<ScanConfig>): Promise<ScanConfig | undefined> {
    const [updated] = await db.update(scanConfigs).set(data).where(eq(scanConfigs.id, id)).returning();
    return updated;
  }

  async deleteScanConfig(id: string): Promise<void> {
    await db.delete(scanConfigs).where(eq(scanConfigs.id, id));
  }

  async getContainers(): Promise<Container[]> {
    return db.select().from(containers).orderBy(containers.name);
  }

  async getContainer(id: string): Promise<Container | undefined> {
    const [container] = await db.select().from(containers).where(eq(containers.id, id));
    return container;
  }

  async createContainer(container: InsertContainer): Promise<Container> {
    const [created] = await db.insert(containers).values(container).returning();
    return created;
  }

  async updateContainer(id: string, data: Partial<InsertContainer>): Promise<Container | undefined> {
    const [updated] = await db.update(containers).set(data).where(eq(containers.id, id)).returning();
    return updated;
  }

  async deleteContainer(id: string): Promise<void> {
    await db.delete(slotAssignments).where(eq(slotAssignments.containerId, id));
    await db.delete(containers).where(eq(containers.id, id));
  }

  async getContainersWithSlots(): Promise<ContainerWithSlots[]> {
    const allContainers = await this.getContainers();
    const allMinersWithLatest = await this.getMinersWithLatest();
    const minerMap = new Map(allMinersWithLatest.map((m) => [m.id, m]));
    const results: ContainerWithSlots[] = [];

    for (const container of allContainers) {
      const assignments = await db
        .select()
        .from(slotAssignments)
        .where(eq(slotAssignments.containerId, container.id))
        .orderBy(slotAssignments.rack, slotAssignments.slot);

      const slotsWithMiners = assignments.map((a) => ({
        ...a,
        miner: a.minerId ? minerMap.get(a.minerId) ?? null : null,
      }));

      results.push({ ...container, slots: slotsWithMiners });
    }

    return results;
  }

  async getSlotAssignments(containerId: string): Promise<SlotAssignment[]> {
    return db
      .select()
      .from(slotAssignments)
      .where(eq(slotAssignments.containerId, containerId))
      .orderBy(slotAssignments.rack, slotAssignments.slot);
  }

  async assignMinerToSlot(containerId: string, rack: number, slot: number, minerId: string): Promise<SlotAssignment> {
    await db.delete(slotAssignments).where(eq(slotAssignments.minerId, minerId));

    const existing = await db
      .select()
      .from(slotAssignments)
      .where(
        and(
          eq(slotAssignments.containerId, containerId),
          eq(slotAssignments.rack, rack),
          eq(slotAssignments.slot, slot)
        )
      );

    if (existing.length > 0) {
      const [updated] = await db
        .update(slotAssignments)
        .set({ minerId })
        .where(eq(slotAssignments.id, existing[0].id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(slotAssignments)
      .values({ containerId, rack, slot, minerId })
      .returning();
    return created;
  }

  async unassignSlot(containerId: string, rack: number, slot: number): Promise<void> {
    await db
      .delete(slotAssignments)
      .where(
        and(
          eq(slotAssignments.containerId, containerId),
          eq(slotAssignments.rack, rack),
          eq(slotAssignments.slot, slot)
        )
      );
  }

  async swapMinerInSlot(containerId: string, rack: number, slot: number, newMinerId: string): Promise<SlotAssignment> {
    return this.assignMinerToSlot(containerId, rack, slot, newMinerId);
  }

  async autoAssignByIpRange(): Promise<number> {
    const allContainers = await this.getContainers();
    const allMiners = await this.getMiners();
    let assigned = 0;

    for (const container of allContainers) {
      if (!container.ipRangeStart || !container.ipRangeEnd) continue;

      const startParts = container.ipRangeStart.split(".").map(Number);
      const endParts = container.ipRangeEnd.split(".").map(Number);
      const startNum = (startParts[0] << 24) + (startParts[1] << 16) + (startParts[2] << 8) + startParts[3];
      const endNum = (endParts[0] << 24) + (endParts[1] << 16) + (endParts[2] << 8) + endParts[3];

      const existingAssignments = await this.getSlotAssignments(container.id);
      const assignedMinerIds = new Set(existingAssignments.filter((a) => a.minerId).map((a) => a.minerId));

      const matchingMiners = allMiners.filter((m) => {
        if (assignedMinerIds.has(m.id)) return false;
        const parts = m.ipAddress.split(".").map(Number);
        const num = (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
        return num >= startNum && num <= endNum;
      });

      let rackIdx = 1;
      let slotIdx = 1;

      const takenSlots = new Set(existingAssignments.map((a) => `${a.rack}-${a.slot}`));
      while (takenSlots.has(`${rackIdx}-${slotIdx}`)) {
        slotIdx++;
        if (slotIdx > container.slotsPerRack) {
          slotIdx = 1;
          rackIdx++;
        }
        if (rackIdx > container.rackCount) break;
      }

      for (const miner of matchingMiners) {
        if (rackIdx > container.rackCount) break;

        await this.assignMinerToSlot(container.id, rackIdx, slotIdx, miner.id);

        const location = `${container.name}-${String(rackIdx).padStart(2, "0")}-${String(slotIdx).padStart(2, "0")}`;
        await this.updateMiner(miner.id, { location, name: location });

        assigned++;
        slotIdx++;
        if (slotIdx > container.slotsPerRack) {
          slotIdx = 1;
          rackIdx++;
        }
        while (takenSlots.has(`${rackIdx}-${slotIdx}`) && rackIdx <= container.rackCount) {
          slotIdx++;
          if (slotIdx > container.slotsPerRack) {
            slotIdx = 1;
            rackIdx++;
          }
        }
      }
    }

    return assigned;
  }
}

export const storage = new DatabaseStorage();

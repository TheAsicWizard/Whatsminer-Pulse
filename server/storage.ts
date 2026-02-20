import {
  type Miner, type InsertMiner,
  type MinerSnapshot, type InsertSnapshot,
  type AlertRule, type InsertAlertRule,
  type Alert, type InsertAlert,
  type MinerWithLatest, type FleetStats,
  type ScanConfig, type InsertScanConfig,
  type Container, type InsertContainer, type ContainerWithSlots,
  type SlotAssignment, type InsertSlotAssignment,
  type MacLocationMapping, type InsertMacLocationMapping,
  miners, minerSnapshots, alertRules, alerts, scanConfigs,
  containers, slotAssignments, macLocationMappings,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql, gte, lte, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

const latestSnap = alias(minerSnapshots, "latest_snap");

export interface IStorage {
  getMiners(): Promise<Miner[]>;
  getMiner(id: string): Promise<Miner | undefined>;
  getMinerByIp(ip: string, port: number): Promise<Miner | undefined>;
  createMiner(miner: InsertMiner): Promise<Miner>;
  updateMiner(id: string, data: Partial<InsertMiner>): Promise<Miner | undefined>;
  deleteMiner(id: string): Promise<void>;
  getMinersWithLatest(): Promise<MinerWithLatest[]>;
  getMinerWithLatest(id: string): Promise<MinerWithLatest | undefined>;
  getMinersWithLatestPaginated(offset: number, limit: number, search?: string, status?: string): Promise<{ miners: MinerWithLatest[]; total: number }>;

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
  getContainerWithSlots(id: string): Promise<ContainerWithSlots | undefined>;
  getContainersSummary(): Promise<Array<Container & { onlineCount: number; warningCount: number; criticalCount: number; offlineCount: number; totalAssigned: number; totalHashrate: number; totalPower: number; avgTemp: number }>>;

  getSlotAssignments(containerId: string): Promise<SlotAssignment[]>;
  assignMinerToSlot(containerId: string, rack: number, slot: number, minerId: string): Promise<SlotAssignment>;
  unassignSlot(containerId: string, rack: number, slot: number): Promise<void>;
  swapMinerInSlot(containerId: string, rack: number, slot: number, newMinerId: string): Promise<SlotAssignment>;
  autoAssignByIpRange(): Promise<number>;

  getMacLocationMappings(): Promise<MacLocationMapping[]>;
  getMacLocationMapping(macAddress: string): Promise<MacLocationMapping | undefined>;
  bulkInsertMacLocationMappings(mappings: InsertMacLocationMapping[]): Promise<number>;
  clearMacLocationMappings(): Promise<void>;
  getMinerByMac(macAddress: string): Promise<Miner | undefined>;
  autoAssignByMac(): Promise<number>;
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
    const rows = await db
      .select({
        miner: miners,
        snapshot: latestSnap,
      })
      .from(miners)
      .leftJoin(latestSnap, eq(miners.latestSnapshotId, latestSnap.id))
      .orderBy(miners.name);

    const alertCounts = await db
      .select({
        minerId: alerts.minerId,
        count: sql<number>`count(*)::int`.as("alert_count"),
      })
      .from(alerts)
      .where(eq(alerts.acknowledged, false))
      .groupBy(alerts.minerId);

    const alertMap = new Map(alertCounts.map((a) => [a.minerId, a.count]));

    return rows.map((row) => ({
      ...row.miner,
      latest: row.snapshot ?? null,
      alertCount: alertMap.get(row.miner.id) ?? 0,
    }));
  }

  async getMinersWithLatestPaginated(offset: number, limit: number, search?: string, status?: string): Promise<{ miners: MinerWithLatest[]; total: number }> {
    let whereClause = sql`1=1`;
    if (search) {
      const s = `%${search}%`;
      whereClause = sql`(${miners.name} ILIKE ${s} OR ${miners.ipAddress} ILIKE ${s} OR ${miners.location} ILIKE ${s})`;
    }
    if (status && status !== "all") {
      whereClause = search
        ? sql`${whereClause} AND ${miners.status} = ${status}`
        : sql`${miners.status} = ${status}`;
    }

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(miners)
      .where(whereClause);

    const rows = await db
      .select({
        miner: miners,
        snapshot: latestSnap,
      })
      .from(miners)
      .leftJoin(latestSnap, eq(miners.latestSnapshotId, latestSnap.id))
      .where(whereClause)
      .orderBy(miners.name)
      .offset(offset)
      .limit(limit);

    return {
      miners: rows.map((row) => ({
        ...row.miner,
        latest: row.snapshot ?? null,
        alertCount: 0,
      })),
      total: countResult.count,
    };
  }

  async getMinerWithLatest(id: string): Promise<MinerWithLatest | undefined> {
    const [row] = await db
      .select({ miner: miners, snapshot: latestSnap })
      .from(miners)
      .leftJoin(latestSnap, eq(miners.latestSnapshotId, latestSnap.id))
      .where(eq(miners.id, id));

    if (!row) return undefined;

    const [alertCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(alerts)
      .where(and(eq(alerts.minerId, id), eq(alerts.acknowledged, false)));

    return {
      ...row.miner,
      latest: row.snapshot ?? null,
      alertCount: alertCount?.count ?? 0,
    };
  }

  async createSnapshot(snapshot: InsertSnapshot): Promise<MinerSnapshot> {
    const [created] = await db.insert(minerSnapshots).values(snapshot).returning();
    await db.update(miners).set({ latestSnapshotId: created.id }).where(eq(miners.id, snapshot.minerId));
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
    const [stats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        online: sql<number>`count(*) filter (where ${miners.status} in ('online', 'warning'))::int`,
        totalHashrate: sql<number>`coalesce(sum(case when ${miners.status} in ('online','warning') then ${latestSnap.hashrate} else 0 end), 0)`,
        totalPower: sql<number>`coalesce(sum(case when ${miners.status} in ('online','warning') then ${latestSnap.power} else 0 end), 0)`,
        avgTemp: sql<number>`coalesce(avg(case when ${miners.status} in ('online','warning') and ${latestSnap.temperature} > 0 then ${latestSnap.temperature} end), 0)`,
        avgEff: sql<number>`coalesce(avg(case when ${miners.status} in ('online','warning') and ${latestSnap.hashrate} > 0 then ${latestSnap.power}::float / (${latestSnap.hashrate}::float / 1000) end), 0)`,
      })
      .from(miners)
      .leftJoin(latestSnap, eq(miners.latestSnapshotId, latestSnap.id));

    const [activeAlerts] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(alerts)
      .where(eq(alerts.acknowledged, false));

    return {
      totalMiners: stats.total,
      onlineMiners: stats.online,
      totalHashrate: Number(stats.totalHashrate),
      totalPower: Number(stats.totalPower),
      avgTemperature: Number(stats.avgTemp),
      avgEfficiency: Number(stats.avgEff),
      activeAlerts: activeAlerts.count,
    };
  }

  async getFleetHistory(): Promise<Array<{ time: string; hashrate: number; power: number; temp: number }>> {
    const rows = await db
      .select({
        time: sql<string>`to_char(${minerSnapshots.createdAt}, 'HH24:MI')`.as("time_bucket"),
        hashrate: sql<number>`coalesce(sum(${minerSnapshots.hashrate}), 0)`,
        power: sql<number>`coalesce(sum(${minerSnapshots.power}), 0)`,
        avgTemp: sql<number>`coalesce(avg(case when ${minerSnapshots.temperature} > 0 then ${minerSnapshots.temperature} end), 0)`,
      })
      .from(minerSnapshots)
      .where(gte(minerSnapshots.createdAt, sql`now() - interval '2 hours'`))
      .groupBy(sql`to_char(${minerSnapshots.createdAt}, 'HH24:MI')`)
      .orderBy(sql`to_char(${minerSnapshots.createdAt}, 'HH24:MI')`);

    return rows.map((r) => ({
      time: r.time,
      hashrate: Number(r.hashrate),
      power: Number(r.power),
      temp: Number(r.avgTemp),
    }));
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

  async getContainerWithSlots(id: string): Promise<ContainerWithSlots | undefined> {
    const container = await this.getContainer(id);
    if (!container) return undefined;

    const assignments = await db
      .select()
      .from(slotAssignments)
      .where(eq(slotAssignments.containerId, id))
      .orderBy(slotAssignments.rack, slotAssignments.slot);

    const minerIds = assignments.filter((a) => a.minerId).map((a) => a.minerId!);
    const minerMap = new Map<string, MinerWithLatest>();

    if (minerIds.length > 0) {
      const rows = await db
        .select({ miner: miners, snapshot: latestSnap })
        .from(miners)
        .leftJoin(latestSnap, eq(miners.latestSnapshotId, latestSnap.id))
        .where(inArray(miners.id, minerIds));

      for (const row of rows) {
        minerMap.set(row.miner.id, {
          ...row.miner,
          latest: row.snapshot ?? null,
          alertCount: 0,
        });
      }
    }

    const slotsWithMiners = assignments.map((a) => ({
      ...a,
      miner: a.minerId ? minerMap.get(a.minerId) ?? null : null,
    }));

    return { ...container, slots: slotsWithMiners };
  }

  async getContainersSummary() {
    const rows = await db
      .select({
        containerId: slotAssignments.containerId,
        onlineCount: sql<number>`count(*) filter (where ${miners.status} = 'online')::int`,
        warningCount: sql<number>`count(*) filter (where ${miners.status} = 'warning')::int`,
        criticalCount: sql<number>`count(*) filter (where ${miners.status} = 'critical')::int`,
        offlineCount: sql<number>`count(*) filter (where ${miners.status} = 'offline')::int`,
        totalAssigned: sql<number>`count(${miners.id})::int`,
        totalHashrate: sql<number>`coalesce(sum(${latestSnap.hashrate}), 0)`,
        totalPower: sql<number>`coalesce(sum(${latestSnap.power}), 0)`,
        avgTemp: sql<number>`coalesce(avg(case when ${latestSnap.temperature} > 0 then ${latestSnap.temperature} end), 0)`,
      })
      .from(slotAssignments)
      .innerJoin(miners, eq(slotAssignments.minerId, miners.id))
      .leftJoin(latestSnap, eq(miners.latestSnapshotId, latestSnap.id))
      .groupBy(slotAssignments.containerId);

    const summaryMap = new Map(rows.map((r) => [r.containerId, r]));

    const allContainers = await this.getContainers();
    return allContainers.map((c) => {
      const s = summaryMap.get(c.id);
      return {
        ...c,
        onlineCount: s ? Number(s.onlineCount) : 0,
        warningCount: s ? Number(s.warningCount) : 0,
        criticalCount: s ? Number(s.criticalCount) : 0,
        offlineCount: s ? Number(s.offlineCount) : 0,
        totalAssigned: s ? Number(s.totalAssigned) : 0,
        totalHashrate: s ? Number(s.totalHashrate) : 0,
        totalPower: s ? Number(s.totalPower) : 0,
        avgTemp: s ? Number(s.avgTemp) : 0,
      };
    });
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

        while (takenSlots.has(`${rackIdx}-${slotIdx}`)) {
          slotIdx++;
          if (slotIdx > container.slotsPerRack) {
            slotIdx = 1;
            rackIdx++;
          }
          if (rackIdx > container.rackCount) break;
        }

        if (rackIdx > container.rackCount) break;

        await this.assignMinerToSlot(container.id, rackIdx, slotIdx, miner.id);
        takenSlots.add(`${rackIdx}-${slotIdx}`);
        assigned++;
        slotIdx++;
        if (slotIdx > container.slotsPerRack) {
          slotIdx = 1;
          rackIdx++;
        }
      }
    }

    return assigned;
  }

  async getMacLocationMappings(): Promise<MacLocationMapping[]> {
    return db.select().from(macLocationMappings).orderBy(macLocationMappings.containerName, macLocationMappings.rack, macLocationMappings.row, macLocationMappings.col);
  }

  async getMacLocationMapping(macAddress: string): Promise<MacLocationMapping | undefined> {
    const normalized = macAddress.toLowerCase().trim();
    const [mapping] = await db.select().from(macLocationMappings).where(eq(macLocationMappings.macAddress, normalized));
    return mapping;
  }

  async bulkInsertMacLocationMappings(mappings: InsertMacLocationMapping[]): Promise<number> {
    if (mappings.length === 0) return 0;
    const batchSize = 500;
    let inserted = 0;
    for (let i = 0; i < mappings.length; i += batchSize) {
      const batch = mappings.slice(i, i + batchSize);
      await db.insert(macLocationMappings).values(batch);
      inserted += batch.length;
    }
    return inserted;
  }

  async clearMacLocationMappings(): Promise<void> {
    await db.delete(macLocationMappings);
  }

  async getMinerByMac(macAddress: string): Promise<Miner | undefined> {
    const normalized = macAddress.toLowerCase().trim();
    const [miner] = await db.select().from(miners).where(eq(miners.macAddress, normalized));
    return miner;
  }

  async autoAssignByMac(): Promise<number> {
    const allMappings = await this.getMacLocationMappings();
    if (allMappings.length === 0) return 0;

    const allContainers = await this.getContainers();
    const containerMap = new Map(allContainers.map((c) => [c.name, c]));

    let assigned = 0;

    for (const mapping of allMappings) {
      const container = containerMap.get(mapping.containerName);
      if (!container) continue;

      const miner = await this.getMinerByMac(mapping.macAddress);
      if (!miner) continue;

      const slot = (mapping.row - 1) * 4 + mapping.col;

      await this.assignMinerToSlot(container.id, mapping.rack, slot, miner.id);

      const location = `${container.name}-R${String(mapping.rack).padStart(2, "0")}-${mapping.row}.${mapping.col}`;
      await this.updateMiner(miner.id, { location });

      assigned++;
    }

    return assigned;
  }
}

export const storage = new DatabaseStorage();

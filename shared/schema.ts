import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const miners = pgTable("miners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  ipAddress: text("ip_address").notNull(),
  port: integer("port").notNull().default(4028),
  location: text("location").default(""),
  model: text("model").default("WhatsMiner"),
  status: text("status").notNull().default("offline"),
  source: text("source").notNull().default("manual"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const minerSnapshots = pgTable("miner_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  minerId: varchar("miner_id").notNull(),
  hashrate: real("hashrate").default(0),
  temperature: real("temperature").default(0),
  envTemp: real("env_temp").default(0),
  chipTempMin: real("chip_temp_min").default(0),
  chipTempMax: real("chip_temp_max").default(0),
  chipTempAvg: real("chip_temp_avg").default(0),
  fanSpeedIn: real("fan_speed_in").default(0),
  fanSpeedOut: real("fan_speed_out").default(0),
  power: real("power").default(0),
  powerLimit: real("power_limit").default(3600),
  powerMode: text("power_mode").default("Normal"),
  elapsed: real("elapsed").default(0),
  accepted: real("accepted").default(0),
  rejected: real("rejected").default(0),
  poolRejectedPct: real("pool_rejected_pct").default(0),
  poolStalePct: real("pool_stale_pct").default(0),
  efficiency: real("efficiency").default(0),
  freqAvg: real("freq_avg").default(0),
  targetFreq: real("target_freq").default(0),
  factoryGhs: real("factory_ghs").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const alertRules = pgTable("alert_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  metric: text("metric").notNull(),
  operator: text("operator").notNull(),
  threshold: real("threshold").notNull(),
  severity: text("severity").notNull().default("warning"),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const alerts = pgTable("alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  minerId: varchar("miner_id").notNull(),
  ruleId: varchar("rule_id"),
  severity: text("severity").notNull().default("warning"),
  message: text("message").notNull(),
  acknowledged: boolean("acknowledged").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const scanConfigs = pgTable("scan_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  startIp: text("start_ip").notNull(),
  endIp: text("end_ip").notNull(),
  port: integer("port").notNull().default(4028),
  enabled: boolean("enabled").notNull().default(true),
  lastScanAt: timestamp("last_scan_at"),
  lastScanResult: text("last_scan_result"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const containers = pgTable("containers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  rackCount: integer("rack_count").notNull().default(8),
  slotsPerRack: integer("slots_per_rack").notNull().default(1),
  ipRangeStart: text("ip_range_start"),
  ipRangeEnd: text("ip_range_end"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const slotAssignments = pgTable("slot_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  containerId: varchar("container_id").notNull(),
  rack: integer("rack").notNull(),
  slot: integer("slot").notNull(),
  minerId: varchar("miner_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMinerSchema = createInsertSchema(miners).omit({ id: true, createdAt: true });
export const insertSnapshotSchema = createInsertSchema(minerSnapshots).omit({ id: true, createdAt: true });
export const insertAlertRuleSchema = createInsertSchema(alertRules).omit({ id: true, createdAt: true });
export const insertAlertSchema = createInsertSchema(alerts).omit({ id: true, createdAt: true });
export const insertScanConfigSchema = createInsertSchema(scanConfigs).omit({ id: true, createdAt: true, lastScanAt: true, lastScanResult: true });
export const insertContainerSchema = createInsertSchema(containers).omit({ id: true, createdAt: true });
export const insertSlotAssignmentSchema = createInsertSchema(slotAssignments).omit({ id: true, createdAt: true });

export type InsertMiner = z.infer<typeof insertMinerSchema>;
export type Miner = typeof miners.$inferSelect;
export type InsertSnapshot = z.infer<typeof insertSnapshotSchema>;
export type MinerSnapshot = typeof minerSnapshots.$inferSelect;
export type InsertAlertRule = z.infer<typeof insertAlertRuleSchema>;
export type AlertRule = typeof alertRules.$inferSelect;
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = typeof alerts.$inferSelect;
export type InsertScanConfig = z.infer<typeof insertScanConfigSchema>;
export type ScanConfig = typeof scanConfigs.$inferSelect;
export type InsertContainer = z.infer<typeof insertContainerSchema>;
export type Container = typeof containers.$inferSelect;
export type InsertSlotAssignment = z.infer<typeof insertSlotAssignmentSchema>;
export type SlotAssignment = typeof slotAssignments.$inferSelect;

export type ContainerWithSlots = Container & {
  slots: (SlotAssignment & { miner?: MinerWithLatest | null })[];
};

export type MinerWithLatest = Miner & {
  latest?: MinerSnapshot | null;
  alertCount?: number;
};

export type FleetStats = {
  totalMiners: number;
  onlineMiners: number;
  totalHashrate: number;
  totalPower: number;
  avgTemperature: number;
  avgEfficiency: number;
  activeAlerts: number;
};

export type ScanResult = {
  ip: string;
  port: number;
  found: boolean;
  model?: string;
  hashrate?: number;
  error?: string;
};

export type ScanProgress = {
  configId: string;
  status: "idle" | "scanning" | "completed" | "error";
  total: number;
  scanned: number;
  found: number;
  results: ScanResult[];
  startedAt?: string;
  completedAt?: string;
  error?: string;
};

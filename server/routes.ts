import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMinerSchema, insertAlertRuleSchema, insertScanConfigSchema, insertContainerSchema, type InsertMacLocationMapping } from "@shared/schema";
import { z, ZodError } from "zod";
import { scanIpRange, getScanProgress, scanIpRangeThrottled, getBulkScanProgress, isBulkScanning, initBulkScan, updateBulkProgress, completeBulkScan, generateIpRange } from "./scanner";
import multer from "multer";


const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

function handleZodError(err: ZodError) {
  const messages = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`);
  return messages.join(", ");
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/miners/export/csv", async (req, res) => {
    try {
      const allMiners = await storage.getMinersWithLatest();
      const headers = ["Name", "IP Address", "Port", "Location", "Model", "Status", "Source", "MAC Address", "Serial Number", "Hashrate (GH/s)", "Temperature (C)", "Power (W)", "Fan In", "Fan Out", "Uptime (s)", "Efficiency (J/TH)", "Notes"];
      const rows = allMiners.map((m) => {
        const s = m.latest;
        const ths = (s?.hashrate ?? 0) / 1000;
        const eff = ths > 0 && s?.power ? (s.power / ths).toFixed(1) : "";
        return [
          m.name, m.ipAddress, m.port, m.location || "", m.model || "", m.status, m.source,
          m.macAddress || "", m.serialNumber || "",
          s?.hashrate?.toFixed(2) ?? "", s?.temperature?.toFixed(1) ?? "", s?.power?.toFixed(0) ?? "",
          s?.fanSpeedIn?.toFixed(0) ?? "", s?.fanSpeedOut?.toFixed(0) ?? "", s?.elapsed?.toFixed(0) ?? "",
          eff, m.notes || "",
        ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
      });
      const csv = [headers.join(","), ...rows].join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="miners-export-${new Date().toISOString().slice(0, 10)}.csv"`);
      res.send(csv);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/miners", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const search = req.query.search as string | undefined;
      const status = req.query.status as string | undefined;
      const offset = (page - 1) * limit;
      const result = await storage.getMinersWithLatestPaginated(offset, limit, search, status);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/miners/:id", async (req, res) => {
    try {
      const miner = await storage.getMinerWithLatest(req.params.id);
      if (!miner) return res.status(404).json({ message: "Miner not found" });
      res.json(miner);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/miners", async (req, res) => {
    try {
      const parsed = insertMinerSchema.parse(req.body);
      const miner = await storage.createMiner(parsed);
      res.status(201).json(miner);
    } catch (err: any) {
      if (err instanceof ZodError) {
        return res.status(400).json({ message: handleZodError(err) });
      }
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/miners/:id", async (req, res) => {
    try {
      const { notes } = req.body;
      const miner = await storage.updateMiner(req.params.id, { notes });
      if (!miner) return res.status(404).json({ message: "Miner not found" });
      res.json(miner);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/miners/:id", async (req, res) => {
    try {
      await storage.deleteMiner(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/miners/:id/history", async (req, res) => {
    try {
      const snaps = await storage.getSnapshots(req.params.id, 50);
      res.json(snaps.reverse());
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/fleet/stats", async (_req, res) => {
    try {
      const stats = await storage.getFleetStats();
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/fleet/history", async (_req, res) => {
    try {
      const history = await storage.getFleetHistory();
      res.json(history);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/alert-rules", async (_req, res) => {
    try {
      const rules = await storage.getAlertRules();
      res.json(rules);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/alert-rules", async (req, res) => {
    try {
      const parsed = insertAlertRuleSchema.parse(req.body);
      const rule = await storage.createAlertRule(parsed);
      res.status(201).json(rule);
    } catch (err: any) {
      if (err instanceof ZodError) {
        return res.status(400).json({ message: handleZodError(err) });
      }
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/alert-rules/:id", async (req, res) => {
    try {
      const rule = await storage.updateAlertRule(req.params.id, req.body);
      if (!rule) return res.status(404).json({ message: "Rule not found" });
      res.json(rule);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/alert-rules/:id", async (req, res) => {
    try {
      await storage.deleteAlertRule(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/alerts", async (_req, res) => {
    try {
      const allAlerts = await storage.getAlerts();
      res.json(allAlerts);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/alerts/:id/acknowledge", async (req, res) => {
    try {
      await storage.acknowledgeAlert(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/alerts/acknowledge-all", async (_req, res) => {
    try {
      await storage.acknowledgeAllAlerts();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/scan-configs", async (_req, res) => {
    try {
      const configs = await storage.getScanConfigs();
      res.json(configs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/scan-configs", async (req, res) => {
    try {
      const parsed = insertScanConfigSchema.parse(req.body);
      const config = await storage.createScanConfig(parsed);
      res.status(201).json(config);
    } catch (err: any) {
      if (err instanceof ZodError) {
        return res.status(400).json({ message: handleZodError(err) });
      }
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/scan-configs/:id", async (req, res) => {
    try {
      await storage.deleteScanConfig(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/scan-configs/:id/scan", async (req, res) => {
    try {
      const config = await storage.getScanConfig(req.params.id);
      if (!config) return res.status(404).json({ message: "Scan config not found" });

      res.json({ message: "Scan started", configId: config.id });

      scanIpRange(config.id, config.startIp, config.endIp, config.port).then(async (results) => {
        let newMiners = 0;
        let updatedMiners = 0;
        let macMatched = 0;
        for (const result of results) {
          let existing = await storage.getMinerByIp(result.ip, config.port);

          if (result.mac && !existing) {
            existing = await storage.getMinerByMac(result.mac) || undefined;
            if (!existing) {
              existing = await storage.findMinerByMacMapping(result.mac) || undefined;
              if (existing) {
                console.log(`[scanner] MAC mapping match: ${result.mac} → miner ${existing.id} (${existing.name})`);
              }
            }
            if (existing) {
              await storage.updateMiner(existing.id, {
                ipAddress: result.ip,
                port: config.port,
                macAddress: result.mac,
                status: "online",
                source: "scanned",
              });
              updatedMiners++;
              macMatched++;
            }
          }

          if (!existing) {
            await storage.createMiner({
              name: `${result.model || "WhatsMiner"} @ ${result.ip}`,
              ipAddress: result.ip,
              port: config.port,
              location: config.name,
              model: result.model || "WhatsMiner",
              status: "online",
              source: "scanned",
              macAddress: result.mac || undefined,
              serialNumber: result.serial || undefined,
            });
            newMiners++;
          } else {
            const updates: any = {};
            if (existing.status === "offline") updates.status = "online";
            if (result.mac && !existing.macAddress) updates.macAddress = result.mac;
            if (result.serial && !existing.serialNumber) updates.serialNumber = result.serial;
            if (existing.source !== "scanned") updates.source = "scanned";
            if (Object.keys(updates).length > 0) {
              await storage.updateMiner(existing.id, updates);
            }
          }
        }
        console.log(`[scanner] Results: ${results.length} found, ${macMatched} MAC-matched, ${newMiners} new, ${updatedMiners} updated`);

        try {
          const macResult = await storage.autoAssignByMac();
          if (macResult.containersCreated > 0) {
            console.log(`[scanner] Created ${macResult.containersCreated} containers from MAC mappings`);
          }
          if (macResult.assigned > 0) {
            console.log(`[scanner] Auto-assigned ${macResult.assigned} miners to slots by MAC address`);
          }
        } catch (e) {
          console.error("[scanner] MAC auto-assign error:", e);
        }

        await storage.updateScanConfig(config.id, {
          lastScanAt: new Date(),
          lastScanResult: `Found ${results.length} miners (${newMiners} new, ${updatedMiners} IP-updated)`,
        });
      }).catch((err) => {
        storage.updateScanConfig(config.id, {
          lastScanResult: `Scan error: ${err.message}`,
        });
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/scan-configs/:id/progress", async (req, res) => {
    try {
      const progress = getScanProgress(req.params.id);
      if (!progress) {
        return res.json({ status: "idle", total: 0, scanned: 0, found: 0, results: [] });
      }
      res.json(progress);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/scan-all", async (_req, res) => {
    try {
      if (isBulkScanning()) {
        return res.status(409).json({ message: "A bulk scan is already in progress" });
      }

      const allContainers = await storage.getContainers();
      const scannable = allContainers.filter((c) => c.ipRangeStart && c.ipRangeEnd);

      if (scannable.length === 0) {
        return res.status(400).json({ message: "No containers have IP ranges configured" });
      }

      let totalIps = 0;
      for (const c of scannable) {
        totalIps += generateIpRange(c.ipRangeStart!, c.ipRangeEnd!).length;
      }

      initBulkScan(scannable.length, totalIps);
      res.json({ message: "Bulk scan started", containers: scannable.length, totalIps });

      (async () => {
        let ipsScannedSoFar = 0;
        try {
          for (const container of scannable) {
            const containerIps = generateIpRange(container.ipRangeStart!, container.ipRangeEnd!);
            updateBulkProgress({ currentContainer: container.name });
            console.log(`[bulk-scan] Scanning ${container.name}: ${container.ipRangeStart} - ${container.ipRangeEnd} (${containerIps.length} IPs)`);

            const results = await scanIpRangeThrottled(
              container.ipRangeStart!,
              container.ipRangeEnd!,
              4028,
              (scanned, found) => {
                updateBulkProgress({
                  scannedIps: ipsScannedSoFar + scanned,
                });
              }
            );

            ipsScannedSoFar += containerIps.length;

            let newMiners = 0;
            let updatedMiners = 0;
            for (const result of results) {
              let existing = await storage.getMinerByIp(result.ip, 4028);

              if (result.mac && !existing) {
                existing = await storage.getMinerByMac(result.mac) || undefined;
                if (!existing) {
                  existing = await storage.findMinerByMacMapping(result.mac) || undefined;
                }
                if (existing) {
                  await storage.updateMiner(existing.id, {
                    ipAddress: result.ip,
                    port: 4028,
                    macAddress: result.mac,
                    status: "online",
                    source: "scanned",
                  });
                  updatedMiners++;
                }
              }

              if (!existing) {
                await storage.createMiner({
                  name: `${result.model || "WhatsMiner"} @ ${result.ip}`,
                  ipAddress: result.ip,
                  port: 4028,
                  location: container.name,
                  model: result.model || "WhatsMiner",
                  status: "online",
                  source: "scanned",
                  macAddress: result.mac || undefined,
                  serialNumber: result.serial || undefined,
                });
                newMiners++;
              } else {
                const updates: any = {};
                if (existing.status === "offline") updates.status = "online";
                if (result.mac && !existing.macAddress) updates.macAddress = result.mac;
                if (result.serial && !existing.serialNumber) updates.serialNumber = result.serial;
                if (existing.source !== "scanned") updates.source = "scanned";
                if (Object.keys(updates).length > 0) {
                  await storage.updateMiner(existing.id, updates);
                }
              }
            }

            updateBulkProgress({
              completedContainers: (getBulkScanProgress()?.completedContainers || 0) + 1,
              scannedIps: ipsScannedSoFar,
              totalFound: (getBulkScanProgress()?.totalFound || 0) + results.length,
            });

            console.log(`[bulk-scan] ${container.name}: ${results.length} found, ${newMiners} new, ${updatedMiners} updated`);
          }

          try {
            const macResult = await storage.autoAssignByMac();
            if (macResult.assigned > 0) {
              console.log(`[bulk-scan] Auto-assigned ${macResult.assigned} miners by MAC`);
            }
          } catch (e) {
            console.error("[bulk-scan] MAC auto-assign error:", e);
          }

          completeBulkScan();
          console.log(`[bulk-scan] Complete: scanned ${scannable.length} containers, found ${getBulkScanProgress()?.totalFound || 0} miners`);
        } catch (err: any) {
          completeBulkScan(err.message);
          console.error("[bulk-scan] Error:", err.message);
        }
      })();
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/scan-all/progress", async (_req, res) => {
    try {
      const progress = getBulkScanProgress();
      if (!progress) {
        return res.json({ status: "idle", totalContainers: 0, completedContainers: 0, currentContainer: "", totalIps: 0, scannedIps: 0, totalFound: 0 });
      }
      res.json(progress);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/containers", async (_req, res) => {
    try {
      const result = await storage.getContainersWithSlots();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/containers/list", async (_req, res) => {
    try {
      const result = await storage.getContainers();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/containers/summary", async (_req, res) => {
    try {
      const result = await storage.getContainersSummary();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/containers/:id/detail", async (req, res) => {
    try {
      const result = await storage.getContainerWithSlots(req.params.id);
      if (!result) return res.status(404).json({ message: "Container not found" });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/containers", async (req, res) => {
    try {
      const parsed = insertContainerSchema.parse(req.body);
      const container = await storage.createContainer(parsed);
      res.status(201).json(container);
    } catch (err: any) {
      if (err instanceof ZodError) {
        return res.status(400).json({ message: handleZodError(err) });
      }
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/containers/:id", async (req, res) => {
    try {
      const container = await storage.updateContainer(req.params.id, req.body);
      if (!container) return res.status(404).json({ message: "Container not found" });
      res.json(container);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/containers/:id", async (req, res) => {
    try {
      await storage.deleteContainer(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/containers/:id/assign", async (req, res) => {
    try {
      const { rack, slot, minerId } = req.body;
      if (!rack || !slot || !minerId) {
        return res.status(400).json({ message: "rack, slot, and minerId are required" });
      }
      const assignment = await storage.assignMinerToSlot(req.params.id, rack, slot, minerId);

      const container = await storage.getContainer(req.params.id);
      if (container) {
        const location = `${container.name}-${String(rack).padStart(2, "0")}-${String(slot).padStart(2, "0")}`;
        await storage.updateMiner(minerId, { location, name: location });
      }

      res.json(assignment);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/containers/:id/unassign", async (req, res) => {
    try {
      const { rack, slot } = req.body;
      if (!rack || !slot) {
        return res.status(400).json({ message: "rack and slot are required" });
      }
      await storage.unassignSlot(req.params.id, rack, slot);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/containers/:id/swap", async (req, res) => {
    try {
      const { rack, slot, newMinerId } = req.body;
      if (!rack || !slot || !newMinerId) {
        return res.status(400).json({ message: "rack, slot, and newMinerId are required" });
      }
      const assignment = await storage.swapMinerInSlot(req.params.id, rack, slot, newMinerId);

      const container = await storage.getContainer(req.params.id);
      if (container) {
        const location = `${container.name}-${String(rack).padStart(2, "0")}-${String(slot).padStart(2, "0")}`;
        await storage.updateMiner(newMinerId, { location, name: location });
      }

      res.json(assignment);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/containers/auto-assign", async (_req, res) => {
    try {
      const count = await storage.autoAssignByIpRange();
      res.json({ assigned: count });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/containers/auto-assign-mac", async (_req, res) => {
    try {
      const result = await storage.autoAssignByMac();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/site-settings", async (_req, res) => {
    try {
      const settings = await storage.getSiteSettings();
      res.json(settings || { backgroundImage: null, useCustomLayout: false });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  const siteSettingsUpdateSchema = z.object({
    backgroundImage: z.string().nullable().optional(),
    useCustomLayout: z.boolean().optional(),
    containerScale: z.number().min(0.3).max(3).optional(),
    electricityCostPerKwh: z.number().min(0).max(10).optional(),
    currencySymbol: z.string().max(5).optional(),
  });

  app.patch("/api/site-settings", async (req, res) => {
    try {
      const parsed = siteSettingsUpdateSchema.parse(req.body);
      const settings = await storage.updateSiteSettings(parsed);
      res.json(settings);
    } catch (err: any) {
      if (err instanceof ZodError) return res.status(400).json({ message: handleZodError(err) });
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/site-settings/background", upload.single("image"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No image file uploaded" });
      const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
      const settings = await storage.updateSiteSettings({ backgroundImage: base64, useCustomLayout: true });
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  const containerLayoutSchema = z.object({
    id: z.string(),
    layoutX: z.number().nullable(),
    layoutY: z.number().nullable(),
    layoutRotation: z.number().nullable(),
  });
  const containerLayoutsBodySchema = z.object({
    layouts: z.array(containerLayoutSchema),
  });

  app.post("/api/containers/layouts", async (req, res) => {
    try {
      const { layouts } = containerLayoutsBodySchema.parse(req.body);
      await storage.updateContainerLayouts(layouts);
      await storage.updateSiteSettings({ useCustomLayout: true });
      res.json({ success: true });
    } catch (err: any) {
      if (err instanceof ZodError) return res.status(400).json({ message: handleZodError(err) });
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/containers/bulk-create", async (req, res) => {
    try {
      const { names } = z.object({ names: z.array(z.string()) }).parse(req.body);
      const result = await storage.bulkCreateContainers(names);
      res.json({ containers: result.containers, created: result.created });
    } catch (err: any) {
      if (err instanceof ZodError) return res.status(400).json({ message: handleZodError(err) });
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/mac-mappings", async (_req, res) => {
    try {
      const mappings = await storage.getMacLocationMappings();
      res.json(mappings);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/mac-mappings/stats", async (_req, res) => {
    try {
      const mappings = await storage.getMacLocationMappings();
      const containers = new Set(mappings.map((m) => m.containerName));
      res.json({
        totalMappings: mappings.length,
        containerCount: containers.size,
        containers: Array.from(containers).sort(),
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/mac-mappings", async (_req, res) => {
    try {
      await storage.clearMacLocationMappings();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  function parseCSVLine(line: string): string[] {
    const fields: string[] = [];
    let inQuote = false;
    let field = "";
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === ',' && !inQuote) { fields.push(field); field = ""; continue; }
      field += ch;
    }
    fields.push(field.trim());
    return fields;
  }

  app.post("/api/mac-mappings/import-foreman", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const content = req.file.buffer.toString("utf-8");
      const lines = content.split("\n").filter((l) => l.trim());
      if (lines.length < 2) {
        return res.status(400).json({ message: "CSV file is empty or has no data rows" });
      }

      const header = parseCSVLine(lines[0]);
      const macIdx = header.indexOf("miner_mac");
      const rackIdx = header.indexOf("miner_rack");
      const rowIdx = header.indexOf("miner_row");
      const indexIdx = header.indexOf("miner_index");
      const typeIdx = header.indexOf("miner_type");
      const serialIdx = header.indexOf("miner_serial");
      const ipIdx = header.indexOf("miner_ip");

      if (macIdx === -1 || rackIdx === -1 || rowIdx === -1 || indexIdx === -1) {
        return res.status(400).json({
          message: "CSV must have columns: miner_mac, miner_rack, miner_row, miner_index",
          foundColumns: header.filter((h) => ["miner_mac", "miner_rack", "miner_row", "miner_index"].includes(h)),
        });
      }

      await storage.clearMacLocationMappings();

      const mappings: InsertMacLocationMapping[] = [];
      let skipped = 0;

      for (let i = 1; i < lines.length; i++) {
        const fields = parseCSVLine(lines[i]);
        const mac = fields[macIdx]?.trim().toLowerCase();
        const rackStr = fields[rackIdx]?.trim();
        const rowStr = fields[rowIdx]?.trim();
        const colStr = fields[indexIdx]?.trim();
        const ip = ipIdx !== -1 ? fields[ipIdx]?.trim() : "";

        if (!mac || !rackStr || !rowStr || !colStr) {
          skipped++;
          continue;
        }

        const rackMatch = rackStr.match(/^(C\d+)-R0*(\d+)$/);
        if (!rackMatch) {
          skipped++;
          continue;
        }

        const containerName = rackMatch[1];
        const rack = parseInt(rackMatch[2]);
        const row = parseInt(rowStr);
        const col = parseInt(colStr);

        if (isNaN(rack) || isNaN(row) || isNaN(col) || rack < 1 || row < 1 || col < 1) {
          skipped++;
          continue;
        }

        mappings.push({
          macAddress: mac,
          containerName,
          rack,
          row,
          col,
          minerType: typeIdx !== -1 ? fields[typeIdx]?.trim() : undefined,
          serialNumber: serialIdx !== -1 ? fields[serialIdx]?.trim() : undefined,
        });
      }

      const inserted = await storage.bulkInsertMacLocationMappings(mappings);

      const containers = new Set(mappings.map((m) => m.containerName));

      res.json({
        success: true,
        imported: inserted,
        skipped,
        totalRows: lines.length - 1,
        containerCount: containers.size,
        containers: Array.from(containers).sort(),
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/fleet/analytics", async (_req, res) => {
    try {
      const allMiners = await storage.getMinersWithLatest();
      const settings = await storage.getSiteSettings();
      const costPerKwh = settings?.electricityCostPerKwh ?? 0.065;
      const currency = settings?.currencySymbol ?? "$";

      const online = allMiners.filter((m) => m.status === "online");
      const totalPowerKw = online.reduce((sum, m) => sum + ((m.latest?.power ?? 0) / 1000), 0);
      const dailyCost = totalPowerKw * 24 * costPerKwh;
      const monthlyCost = dailyCost * 30;

      const totalHashrateTh = online.reduce((sum, m) => sum + ((m.latest?.hashrate ?? 0) / 1000), 0);
      const avgEfficiency = totalHashrateTh > 0 ? (totalPowerKw * 1000 / totalHashrateTh) : 0;

      const hashrateDistribution: Record<string, number> = {};
      const tempDistribution: Record<string, number> = {};
      const modelDistribution: Record<string, number> = {};
      const statusDistribution: Record<string, number> = {};

      allMiners.forEach((m) => {
        const model = m.model || "Unknown";
        modelDistribution[model] = (modelDistribution[model] || 0) + 1;
        statusDistribution[m.status] = (statusDistribution[m.status] || 0) + 1;

        if (m.latest?.hashrate) {
          const bucket = Math.floor((m.latest.hashrate / 1000) / 10) * 10;
          const key = `${bucket}-${bucket + 10} TH/s`;
          hashrateDistribution[key] = (hashrateDistribution[key] || 0) + 1;
        }
        if (m.latest?.temperature) {
          const bucket = Math.floor(m.latest.temperature / 5) * 5;
          const key = `${bucket}-${bucket + 5}°C`;
          tempDistribution[key] = (tempDistribution[key] || 0) + 1;
        }
      });

      res.json({
        costPerKwh,
        currency,
        totalPowerKw,
        dailyCost,
        monthlyCost,
        totalHashrateTh,
        avgEfficiency,
        totalMiners: allMiners.length,
        onlineMiners: online.length,
        hashrateDistribution: Object.entries(hashrateDistribution).map(([range, count]) => ({ range, count })).sort((a, b) => a.range.localeCompare(b.range, undefined, { numeric: true })),
        tempDistribution: Object.entries(tempDistribution).map(([range, count]) => ({ range, count })).sort((a, b) => a.range.localeCompare(b.range, undefined, { numeric: true })),
        modelDistribution: Object.entries(modelDistribution).map(([model, count]) => ({ model, count })).sort((a, b) => b.count - a.count),
        statusDistribution: Object.entries(statusDistribution).map(([status, count]) => ({ status, count })),
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/miners/batch/delete", async (req, res) => {
    try {
      const { minerIds } = z.object({ minerIds: z.array(z.string()) }).parse(req.body);
      let deleted = 0;
      for (const id of minerIds) {
        await storage.deleteMiner(id);
        deleted++;
      }
      res.json({ deleted });
    } catch (err: any) {
      if (err instanceof ZodError) return res.status(400).json({ message: handleZodError(err) });
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/reset-all-data", async (_req, res) => {
    try {
      await storage.resetAllData();
      res.json({ success: true, message: "All data has been cleared" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  return httpServer;
}

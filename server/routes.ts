import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMinerSchema, insertAlertRuleSchema, insertScanConfigSchema, insertContainerSchema } from "@shared/schema";
import { ZodError } from "zod";
import { scanIpRange, getScanProgress } from "./scanner";

function handleZodError(err: ZodError) {
  const messages = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`);
  return messages.join(", ");
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

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
        for (const result of results) {
          const existing = await storage.getMinerByIp(result.ip, config.port);
          if (!existing) {
            await storage.createMiner({
              name: `${result.model || "WhatsMiner"} @ ${result.ip}`,
              ipAddress: result.ip,
              port: config.port,
              location: config.name,
              model: result.model || "WhatsMiner",
              status: "online",
              source: "scanned",
            });
          } else if (existing.status === "offline") {
            await storage.updateMiner(existing.id, { status: "online" });
          }
        }

        await storage.updateScanConfig(config.id, {
          lastScanAt: new Date(),
          lastScanResult: `Found ${results.length} miners`,
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

  app.get("/api/containers", async (_req, res) => {
    try {
      const result = await storage.getContainersWithSlots();
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

  return httpServer;
}

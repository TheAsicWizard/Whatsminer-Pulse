import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMinerSchema, insertAlertRuleSchema, insertScanConfigSchema, insertContainerSchema, type InsertMacLocationMapping } from "@shared/schema";
import { z, ZodError } from "zod";
import { scanIpRange, getScanProgress } from "./scanner";
import multer from "multer";
import { openai } from "./replit_integrations/image/client";
import Anthropic from "@anthropic-ai/sdk";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

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
        let newMiners = 0;
        let updatedMiners = 0;
        for (const result of results) {
          let existing = await storage.getMinerByIp(result.ip, config.port);

          if (result.mac && !existing) {
            existing = await storage.getMinerByMac(result.mac) || undefined;
            if (existing) {
              await storage.updateMiner(existing.id, {
                ipAddress: result.ip,
                status: "online",
              });
              updatedMiners++;
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
            if (Object.keys(updates).length > 0) {
              await storage.updateMiner(existing.id, updates);
            }
          }
        }

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

  app.post("/api/containers/ai-detect", async (req, res) => {
    try {
      const settings = await storage.getSiteSettings();
      if (!settings?.backgroundImage) {
        return res.status(400).json({ message: "No background image uploaded. Upload a site plan image first." });
      }

      const allContainers = await storage.getContainers();
      if (allContainers.length === 0) {
        return res.status(400).json({ message: "No containers exist. Create containers first." });
      }

      const containerNames = allContainers
        .map((c) => c.name)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      const containerMap = new Map(allContainers.map((c) => [c.name, c]));
      const imageData = settings.backgroundImage;

      const anthropic = new Anthropic({
        apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
      });

      const totalContainers = containerNames.length;

      const base64Match = imageData.match(/^data:([^;]+);base64,(.+)$/);
      if (!base64Match) {
        return res.status(400).json({ message: "Invalid image format. Expected base64 data URL." });
      }
      const mediaType = base64Match[1] as "image/png" | "image/jpeg" | "image/gif" | "image/webp";
      const base64Data = base64Match[2];

      const structurePrompt = `Analyze this site layout image of a mining facility. The image shows rectangular shipping containers arranged in distinct groups/regions. Each container has a text label like "C000", "C001", "C210", etc.

Your task: Identify the distinct GROUPS of containers visible in the image. For each group, provide:

1. "boundingBox": The rectangular area containing this group, as percentage coordinates (0-100). Format: {"x1": left%, "y1": top%, "x2": right%, "y2": bottom%}
2. "rotation": The angle (in degrees) that containers in this group are rotated. 0 = horizontal, negative = rotated counterclockwise. Use 325 for diagonal groups going from lower-left to upper-right.
3. "rows": Number of rows of containers in this group
4. "containersPerRow": Approximate number of containers per row
5. "readableLabels": Array of any container labels you can actually read from the image in this group. For each, include the name and its approximate position. Format: [{"name": "C210", "x": 85, "y": 54}]
6. "description": Brief description of where this group is in the image

Also determine the overall ordering: which group has the lowest-numbered containers and which has the highest.

There are ${totalContainers} containers total. Container names are: ${containerNames.slice(0, 5).join(", ")} through ${containerNames.slice(-3).join(", ")}.

Return ONLY valid JSON with this structure (no explanation, no markdown):
{
  "groups": [
    {
      "id": 1,
      "description": "Upper-left diagonal section",
      "boundingBox": {"x1": 5, "y1": 30, "x2": 45, "y2": 75},
      "rotation": 325,
      "rows": 6,
      "containersPerRow": 14,
      "readableLabels": [{"name": "C000", "x": 5, "y": 54}],
      "containerOrder": "first"
    }
  ],
  "totalVisibleContainers": 284,
  "orderingNotes": "Containers are numbered starting from the diagonal group on the left, then continuing in horizontal rows on the right"
}`;

      console.log("Phase 1: Asking Claude to analyze site layout structure...");
      const structureResponse = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64Data,
                },
              },
              { type: "text", text: structurePrompt },
            ],
          },
        ],
      });

      const structureContent = structureResponse.content[0]?.type === "text" ? structureResponse.content[0].text : "";
      console.log("Phase 1 response length:", structureContent.length, "chars");
      console.log("Phase 1 response:", structureContent.substring(0, 1000));

      let structureJsonStr = structureContent.trim();
      const structureCodeBlock = structureJsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (structureCodeBlock) {
        structureJsonStr = structureCodeBlock[1].trim();
      }

      interface DetectedGroup {
        id: number;
        description: string;
        boundingBox: { x1: number; y1: number; x2: number; y2: number };
        rotation: number;
        rows: number;
        containersPerRow: number;
        readableLabels: Array<{ name: string; x: number; y: number }>;
        containerOrder?: string;
      }

      let structureData: { groups: DetectedGroup[]; totalVisibleContainers?: number; orderingNotes?: string };
      try {
        structureData = JSON.parse(structureJsonStr);
      } catch (parseErr) {
        console.error("Phase 1 parse error. Raw:", structureContent.substring(0, 2000));
        return res.status(500).json({
          message: "AI could not analyze the image structure. Try the Wolf Hollow template instead.",
          raw: structureContent.substring(0, 500),
        });
      }

      if (!structureData.groups || !Array.isArray(structureData.groups) || structureData.groups.length === 0) {
        return res.status(500).json({ message: "AI did not identify any container groups in the image." });
      }

      console.log(`Phase 1: Identified ${structureData.groups.length} groups. Notes: ${structureData.orderingNotes || "none"}`);
      for (const g of structureData.groups) {
        console.log(`  Group ${g.id}: ${g.description}, bbox=(${g.boundingBox.x1},${g.boundingBox.y1})-(${g.boundingBox.x2},${g.boundingBox.y2}), rotation=${g.rotation}, ${g.rows}x${g.containersPerRow}, labels=${g.readableLabels?.length || 0}`);
      }

      console.log("Phase 2: Validating and distributing containers across detected groups...");

      const validGroups = structureData.groups
        .filter((g) => {
          const bb = g.boundingBox;
          if (!bb || typeof bb.x1 !== "number" || typeof bb.y1 !== "number" || typeof bb.x2 !== "number" || typeof bb.y2 !== "number") return false;
          if (bb.x1 >= bb.x2 || bb.y1 >= bb.y2) return false;
          if (bb.x1 < 0 || bb.x2 > 100 || bb.y1 < 0 || bb.y2 > 100) return false;
          if (!g.rows || g.rows <= 0 || !g.containersPerRow || g.containersPerRow <= 0) return false;
          return true;
        })
        .sort((a, b) => {
          const aLabels = (a.readableLabels || []).filter(l => l.name && l.name.match(/^C\d+$/));
          const bLabels = (b.readableLabels || []).filter(l => l.name && l.name.match(/^C\d+$/));
          const aMin = aLabels.length > 0 ? Math.min(...aLabels.map(l => parseInt(l.name.replace("C", "")))) : 9999;
          const bMin = bLabels.length > 0 ? Math.min(...bLabels.map(l => parseInt(l.name.replace("C", "")))) : 9999;
          if (aMin !== bMin) return aMin - bMin;
          if (a.containerOrder === "first") return -1;
          if (b.containerOrder === "first") return 1;
          return (a.boundingBox.x1 + a.boundingBox.y1) - (b.boundingBox.x1 + b.boundingBox.y1);
        });

      if (validGroups.length === 0) {
        return res.status(500).json({ message: "AI did not return valid container group data. Try the Wolf Hollow template." });
      }

      const rawGroupCapacities = validGroups.map(g => g.rows * g.containersPerRow);
      const totalRawCapacity = rawGroupCapacities.reduce((s, c) => s + c, 0);

      const groupAllocations: number[] = [];
      let allocated = 0;
      for (let i = 0; i < validGroups.length; i++) {
        if (i === validGroups.length - 1) {
          groupAllocations.push(totalContainers - allocated);
        } else {
          const share = Math.round((rawGroupCapacities[i] / totalRawCapacity) * totalContainers);
          groupAllocations.push(share);
          allocated += share;
        }
      }

      function generateDiagonalRow(
        count: number,
        x1: number, y1: number,
        x2: number, y2: number,
        rotation: number,
        names: string[]
      ): Array<{ name: string; x: number; y: number; rotation: number }> {
        const result: Array<{ name: string; x: number; y: number; rotation: number }> = [];
        for (let i = 0; i < count && i < names.length; i++) {
          const t = count > 1 ? i / (count - 1) : 0.5;
          result.push({
            name: names[i],
            x: Math.max(1, Math.min(99, x1 + t * (x2 - x1))),
            y: Math.max(1, Math.min(99, y1 + t * (y2 - y1))),
            rotation,
          });
        }
        return result;
      }

      function generateHorizontalRow(
        count: number,
        xStart: number, xEnd: number,
        y: number,
        rotation: number,
        names: string[]
      ): Array<{ name: string; x: number; y: number; rotation: number }> {
        const result: Array<{ name: string; x: number; y: number; rotation: number }> = [];
        for (let i = 0; i < count && i < names.length; i++) {
          const t = count > 1 ? i / (count - 1) : 0.5;
          result.push({
            name: names[i],
            x: Math.max(1, Math.min(99, xStart + t * (xEnd - xStart))),
            y: Math.max(1, Math.min(99, y)),
            rotation,
          });
        }
        return result;
      }

      const allPositions: Array<{ name: string; x: number; y: number; rotation: number }> = [];
      let containerIdx = 0;

      for (let gi = 0; gi < validGroups.length; gi++) {
        const group = validGroups[gi];
        const containersForGroup = groupAllocations[gi];
        if (containersForGroup <= 0) continue;

        const bb = group.boundingBox;
        const rotation = group.rotation || 0;
        const numRows = Math.max(1, group.rows);
        const perRow = Math.ceil(containersForGroup / numRows);
        let placedInGroup = 0;

        const isDiagonal = rotation !== 0 && rotation !== 180 && rotation !== 360;

        for (let row = 0; row < numRows && placedInGroup < containersForGroup && containerIdx < totalContainers; row++) {
          const remaining = containersForGroup - placedInGroup;
          const rowCount = Math.min(perRow, remaining);
          if (rowCount <= 0) break;

          const rowFraction = numRows > 1 ? row / (numRows - 1) : 0.5;
          const names = containerNames.slice(containerIdx, containerIdx + rowCount);

          if (isDiagonal) {
            const rowStartX = bb.x1 + rowFraction * (bb.x2 - bb.x1) * 0.15;
            const rowStartY = bb.y1 + rowFraction * (bb.y2 - bb.y1);
            const rowEndX = bb.x1 + (bb.x2 - bb.x1) * (0.65 + rowFraction * 0.35);
            const rowEndY = bb.y1 + rowFraction * (bb.y2 - bb.y1) * 0.4;

            const positions = generateDiagonalRow(rowCount, rowStartX, rowStartY, rowEndX, rowEndY, rotation, names);
            allPositions.push(...positions);
          } else {
            const y = bb.y1 + rowFraction * (bb.y2 - bb.y1);
            const positions = generateHorizontalRow(rowCount, bb.x1, bb.x2, y, rotation, names);
            allPositions.push(...positions);
          }

          placedInGroup += rowCount;
          containerIdx += rowCount;
        }

        console.log(`  Group ${gi + 1}: placed ${placedInGroup}/${containersForGroup} containers`);
      }

      if (containerIdx < totalContainers) {
        console.log(`Warning: ${totalContainers - containerIdx} containers unplaced, adding to last group`);
        const lastBb = validGroups[validGroups.length - 1].boundingBox;
        while (containerIdx < totalContainers) {
          const i = containerIdx - allPositions.length + (totalContainers - containerIdx);
          const col = i % 10;
          const row = Math.floor(i / 10);
          allPositions.push({
            name: containerNames[containerIdx],
            x: Math.max(1, Math.min(99, lastBb.x1 + col * 3)),
            y: Math.max(1, Math.min(99, lastBb.y2 + 2 + row * 4)),
            rotation: 0,
          });
          containerIdx++;
        }
      }

      console.log(`Phase 2: Distributed ${allPositions.length} containers across ${validGroups.length} groups.`);

      const validPositions = allPositions
        .filter((p) => containerMap.has(p.name))
        .map((p) => ({
          name: p.name,
          id: containerMap.get(p.name)!.id,
          x: Math.max(0, Math.min(100, p.x)),
          y: Math.max(0, Math.min(100, p.y)),
          rotation: typeof p.rotation === "number" ? p.rotation : 0,
        }));

      res.json({
        detected: validPositions,
        totalRequested: containerNames.length,
        totalDetected: validPositions.length,
        groups: structureData.groups.length,
        orderingNotes: structureData.orderingNotes,
      });
    } catch (err: any) {
      console.error("AI detect error:", err);
      res.status(500).json({ message: err.message || "AI detection failed" });
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

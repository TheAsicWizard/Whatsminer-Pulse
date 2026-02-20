import * as net from "net";
import type { ScanResult, ScanProgress } from "@shared/schema";
import { log } from "./index";

const SCAN_TIMEOUT = 3000;
const MAX_CONCURRENT = 20;

const activeScanProgress = new Map<string, ScanProgress>();

export function getScanProgress(configId: string): ScanProgress | undefined {
  return activeScanProgress.get(configId);
}

function ipToInt(ip: string): number {
  const parts = ip.split(".").map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function intToIp(n: number): string {
  return `${(n >>> 24) & 255}.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`;
}

export function generateIpRange(startIp: string, endIp: string): string[] {
  const start = ipToInt(startIp);
  const end = ipToInt(endIp);
  const ips: string[] = [];
  const maxRange = 1024;
  const count = Math.min(end - start + 1, maxRange);
  for (let i = 0; i < count; i++) {
    ips.push(intToIp(start + i));
  }
  return ips;
}

function queryCgminerApi(host: string, port: number, command: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let data = "";

    socket.setTimeout(SCAN_TIMEOUT);

    socket.connect(port, host, () => {
      socket.write(JSON.stringify({ command }));
    });

    socket.on("data", (chunk) => {
      data += chunk.toString();
    });

    socket.on("end", () => {
      try {
        const cleaned = data.replace(/\0/g, "").trim();
        if (cleaned) {
          resolve(JSON.parse(cleaned));
        } else {
          reject(new Error("Empty response"));
        }
      } catch (err) {
        reject(new Error(`Parse error: ${data.substring(0, 100)}`));
      }
    });

    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("Connection timeout"));
    });

    socket.on("error", (err) => {
      socket.destroy();
      reject(err);
    });
  });
}

async function probeMiner(ip: string, port: number): Promise<ScanResult> {
  try {
    const summary = await queryCgminerApi(ip, port, "summary");
    
    let hashrate = 0;
    let model = "WhatsMiner";

    let s: any = null;
    if (summary?.SUMMARY?.[0]) {
      s = summary.SUMMARY[0];
    } else if (summary?.Msg && typeof summary.Msg === "object") {
      s = summary.Msg;
    }

    if (s) {
      if (s["GHS av"]) hashrate = s["GHS av"];
      else if (s["MHS av"]) hashrate = s["MHS av"] / 1000;

      if (s["Factory GHS"]) {
        const fGhs = s["Factory GHS"];
        if (fGhs > 200) model = "WhatsMiner M50";
        else if (fGhs > 100) model = "WhatsMiner M30";
        else model = `WhatsMiner (${fGhs} GH/s)`;
      }
    }

    try {
      const stats = await queryCgminerApi(ip, port, "stats");
      if (stats?.STATS) {
        for (const stat of stats.STATS) {
          if (stat.Type) {
            model = `WhatsMiner ${stat.Type}`;
          }
        }
      }
    } catch {
    }

    return {
      ip,
      port,
      found: true,
      model,
      hashrate,
    };
  } catch (err: any) {
    return {
      ip,
      port,
      found: false,
      error: err.message,
    };
  }
}

async function runBatch(tasks: Array<() => Promise<ScanResult>>): Promise<ScanResult[]> {
  return Promise.all(tasks.map((t) => t()));
}

export async function scanIpRange(
  configId: string,
  startIp: string,
  endIp: string,
  port: number
): Promise<ScanResult[]> {
  const ips = generateIpRange(startIp, endIp);

  const progress: ScanProgress = {
    configId,
    status: "scanning",
    total: ips.length,
    scanned: 0,
    found: 0,
    results: [],
    startedAt: new Date().toISOString(),
  };
  activeScanProgress.set(configId, progress);

  log(`Starting scan: ${startIp} - ${endIp} (${ips.length} IPs, port ${port})`, "scanner");

  const allResults: ScanResult[] = [];

  for (let i = 0; i < ips.length; i += MAX_CONCURRENT) {
    const batch = ips.slice(i, i + MAX_CONCURRENT);
    const tasks = batch.map((ip) => () => probeMiner(ip, port));
    const results = await runBatch(tasks);

    for (const result of results) {
      allResults.push(result);
      progress.scanned++;
      if (result.found) {
        progress.found++;
        log(`Found miner at ${result.ip}:${port} - ${result.model}`, "scanner");
      }
    }
    progress.results = allResults.filter((r) => r.found);
  }

  progress.status = "completed";
  progress.completedAt = new Date().toISOString();
  activeScanProgress.set(configId, progress);

  log(`Scan complete: ${progress.found} miners found out of ${progress.total} IPs`, "scanner");

  return allResults.filter((r) => r.found);
}

let pollDebugCount = 0;

export function resetPollDebug() {
  pollDebugCount = 0;
}

export async function pollRealMiner(ip: string, port: number): Promise<{
  hashrate: number;
  temperature: number;
  envTemp: number;
  chipTempMin: number;
  chipTempMax: number;
  chipTempAvg: number;
  fanSpeedIn: number;
  fanSpeedOut: number;
  power: number;
  powerLimit: number;
  powerMode: string;
  elapsed: number;
  accepted: number;
  rejected: number;
  poolRejectedPct: number;
  poolStalePct: number;
  efficiency: number;
  freqAvg: number;
  targetFreq: number;
  factoryGhs: number;
} | null> {
  const shouldDebug = pollDebugCount < 3;

  try {
    const [summaryRes, statsRes] = await Promise.all([
      queryCgminerApi(ip, port, "summary"),
      queryCgminerApi(ip, port, "stats").catch((e) => {
        if (shouldDebug) log(`[poller-debug] Stats query failed for ${ip}: ${e.message}`, "poller-debug");
        return null;
      }),
    ]);

    if (shouldDebug) {
      pollDebugCount++;
      log(`[poller-debug] === RAW RESPONSE FOR ${ip} ===`, "poller-debug");
      log(`[poller-debug] Summary raw: ${JSON.stringify(summaryRes).substring(0, 500)}`, "poller-debug");
      log(`[poller-debug] Stats raw: ${JSON.stringify(statsRes).substring(0, 500)}`, "poller-debug");
      if (summaryRes) {
        log(`[poller-debug] Summary top-level keys: ${Object.keys(summaryRes).join(", ")}`, "poller-debug");
      }
      if (summaryRes?.SUMMARY?.[0]) {
        log(`[poller-debug] Summary[0] keys: ${Object.keys(summaryRes.SUMMARY[0]).join(", ")}`, "poller-debug");
        log(`[poller-debug] Summary[0] values: ${JSON.stringify(summaryRes.SUMMARY[0]).substring(0, 500)}`, "poller-debug");
      }
      if (statsRes?.STATS) {
        for (let i = 0; i < Math.min(statsRes.STATS.length, 3); i++) {
          log(`[poller-debug] STATS[${i}] keys: ${Object.keys(statsRes.STATS[i]).join(", ")}`, "poller-debug");
          log(`[poller-debug] STATS[${i}] values: ${JSON.stringify(statsRes.STATS[i]).substring(0, 500)}`, "poller-debug");
        }
      } else if (statsRes) {
        log(`[poller-debug] Stats top-level keys: ${Object.keys(statsRes).join(", ")}`, "poller-debug");
      }
    }

    let s: any = null;
    if (summaryRes?.SUMMARY?.[0]) {
      s = summaryRes.SUMMARY[0];
    } else if (summaryRes?.Msg && typeof summaryRes.Msg === "object") {
      s = summaryRes.Msg;
    }

    if (!s) {
      if (shouldDebug) log(`[poller-debug] No summary data found for ${ip}`, "poller-debug");
      return null;
    }

    let hashrateGhs = 0;
    if (s["GHS av"]) hashrateGhs = s["GHS av"];
    else if (s["MHS av"]) hashrateGhs = s["MHS av"] / 1000;

    let temperature = s["Temperature"] || 0;
    let envTemp = s["Env Temp"] || 0;
    let chipTempMin = s["Chip Temp Min"] || 0;
    let chipTempMax = s["Chip Temp Max"] || 0;
    let chipTempAvg = s["Chip Temp Avg"] || 0;
    let fanSpeedIn = s["Fan Speed In"] || 0;
    let fanSpeedOut = s["Fan Speed Out"] || 0;
    let power = s["Power"] || 0;
    let powerLimit = s["Power Limit"] || 0;
    let freqAvg = s["freq_avg"] || s["Freq Avg"] || 0;
    let targetFreq = s["Target Freq"] || 0;
    let factoryGhs = s["Factory GHS"] || 0;
    let powerMode = s["Power Mode"] || "Normal";

    if (statsRes?.STATS) {
      for (const stat of statsRes.STATS) {
        if (stat["Temperature"] && !temperature) temperature = stat["Temperature"];
        if (stat["Env Temp"] && !envTemp) envTemp = stat["Env Temp"];
        if (stat["Chip Temp Min"] && !chipTempMin) chipTempMin = stat["Chip Temp Min"];
        if (stat["Chip Temp Max"] && !chipTempMax) chipTempMax = stat["Chip Temp Max"];
        if (stat["Chip Temp Avg"] && !chipTempAvg) chipTempAvg = stat["Chip Temp Avg"];
        if (stat["Fan Speed In"] && !fanSpeedIn) fanSpeedIn = stat["Fan Speed In"];
        if (stat["Fan Speed Out"] && !fanSpeedOut) fanSpeedOut = stat["Fan Speed Out"];
        if (stat["Power"] && !power) power = stat["Power"];
        if (stat["Power Limit"] && !powerLimit) powerLimit = stat["Power Limit"];
        if (stat["Freq Avg"] && !freqAvg) freqAvg = stat["Freq Avg"];
        if (stat["Target Freq"] && !targetFreq) targetFreq = stat["Target Freq"];
        if (stat["Factory GHS"] && !factoryGhs) factoryGhs = stat["Factory GHS"];
        if (stat["Power Mode"] && powerMode === "Normal") powerMode = stat["Power Mode"];
      }
    }

    if (!temperature && envTemp) temperature = envTemp;

    const elapsed = s["Elapsed"] || 0;
    const accepted = s["Accepted"] || 0;
    const rejected = s["Rejected"] || 0;
    const poolRejectedPct = s["Pool Rejected%"] || 0;
    const poolStalePct = s["Pool Stale%"] || 0;
    const total = accepted + rejected;
    const efficiency = hashrateGhs > 0 ? power / (hashrateGhs / 1000) : 0;

    return {
      hashrate: hashrateGhs,
      temperature,
      envTemp,
      chipTempMin,
      chipTempMax,
      chipTempAvg,
      fanSpeedIn,
      fanSpeedOut,
      power,
      powerLimit,
      powerMode,
      elapsed,
      accepted,
      rejected,
      poolRejectedPct,
      poolStalePct,
      efficiency,
      freqAvg,
      targetFreq,
      factoryGhs,
    };
  } catch (err: any) {
    if (shouldDebug) log(`Poll failed for ${ip}: ${err.message}`, "poller-debug");
    return null;
  }
}

import * as net from "net";
import type { ScanResult, ScanProgress, BulkScanProgress } from "@shared/schema";
import { log } from "./index";

const SCAN_TIMEOUT = 3000;
const BULK_SCAN_TIMEOUT = 1500;
const MAX_CONCURRENT = 20;
const BULK_MAX_CONCURRENT = 100;
const BULK_PROBE_CONCURRENT = 20;

const activeScanProgress = new Map<string, ScanProgress>();
let bulkScanProgress: BulkScanProgress | null = null;

export function getScanProgress(configId: string): ScanProgress | undefined {
  return activeScanProgress.get(configId);
}

export function getBulkScanProgress(): BulkScanProgress | null {
  return bulkScanProgress;
}

export function isBulkScanning(): boolean {
  return bulkScanProgress?.status === "scanning";
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

function quickPortCheck(host: string, port: number, timeout: number = BULK_SCAN_TIMEOUT): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    socket.connect(port, host, () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });
  });
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

function findMacInObject(obj: any): string | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const macKeys = ["MAC", "Mac", "mac", "MacAddr", "mac_addr", "MacAddress", "mac_address"];
  for (const key of macKeys) {
    if (obj[key] && typeof obj[key] === "string" && obj[key].includes(":")) {
      return obj[key].toLowerCase();
    }
  }
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === "string" && /^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/.test(val)) {
      return val.toLowerCase();
    }
  }
  return undefined;
}

let probeDebugCount = 0;

async function probeMiner(ip: string, port: number): Promise<ScanResult> {
  const shouldDebug = probeDebugCount < 5;

  try {
    const summary = await queryCgminerApi(ip, port, "summary");
    
    let hashrate = 0;
    let model = "WhatsMiner";
    let mac: string | undefined;
    let serial: string | undefined;

    if (shouldDebug) {
      log(`[probe-debug] ${ip} summary keys: ${JSON.stringify(Object.keys(summary || {}))}`, "scanner");
    }

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

      mac = findMacInObject(s);
      if (shouldDebug && !mac) {
        const summaryKeys = Object.keys(s).filter(k => /mac|addr|net/i.test(k));
        log(`[probe-debug] ${ip} summary MAC-related keys: ${JSON.stringify(summaryKeys)} | all keys: ${Object.keys(s).join(",")}`, "scanner");
      }
    }

    try {
      const stats = await queryCgminerApi(ip, port, "stats");
      if (stats?.STATS) {
        for (const stat of stats.STATS) {
          if (stat.Type) model = `WhatsMiner ${stat.Type}`;
          if (!mac) mac = findMacInObject(stat);
          if (stat["Serial Number"] && !serial) serial = stat["Serial Number"];
        }
      }
      if (shouldDebug && !mac && stats?.STATS?.[0]) {
        const statKeys = Object.keys(stats.STATS[0]).filter(k => /mac|addr|net/i.test(k));
        log(`[probe-debug] ${ip} stats MAC-related keys: ${JSON.stringify(statKeys)}`, "scanner");
      }
    } catch (e: any) {
      if (shouldDebug) log(`[probe-debug] ${ip} stats failed: ${e.message}`, "scanner");
    }

    if (!mac) {
      try {
        const minerInfo = await queryCgminerApi(ip, port, "get_miner_info");
        if (shouldDebug) {
          log(`[probe-debug] ${ip} get_miner_info response: ${JSON.stringify(minerInfo).substring(0, 500)}`, "scanner");
        }
        if (minerInfo?.Msg) {
          const msg = typeof minerInfo.Msg === "string" ? {} : minerInfo.Msg;
          mac = findMacInObject(msg);
          if (!serial && msg["SerialNo"]) serial = msg["SerialNo"];
        }
        if (!mac) {
          mac = findMacInObject(minerInfo);
        }
      } catch (e: any) {
        if (shouldDebug) log(`[probe-debug] ${ip} get_miner_info failed: ${e.message}`, "scanner");
      }
    }

    if (!mac) {
      try {
        const devs = await queryCgminerApi(ip, port, "devs");
        if (shouldDebug) {
          log(`[probe-debug] ${ip} devs response: ${JSON.stringify(devs).substring(0, 500)}`, "scanner");
        }
        if (devs?.DEVS) {
          for (const dev of devs.DEVS) {
            if (!mac) mac = findMacInObject(dev);
          }
        }
      } catch (e: any) {
        if (shouldDebug) log(`[probe-debug] ${ip} devs failed: ${e.message}`, "scanner");
      }
    }

    if (!mac) {
      try {
        const edevs = await queryCgminerApi(ip, port, "edevs");
        if (shouldDebug) {
          log(`[probe-debug] ${ip} edevs response: ${JSON.stringify(edevs).substring(0, 500)}`, "scanner");
        }
        if (edevs?.DEVS) {
          for (const dev of edevs.DEVS) {
            if (!mac) mac = findMacInObject(dev);
          }
        }
      } catch (e: any) {
        if (shouldDebug) log(`[probe-debug] ${ip} edevs failed: ${e.message}`, "scanner");
      }
    }

    if (shouldDebug) {
      probeDebugCount++;
      log(`[probe-debug] ${ip} RESULT: mac=${mac || "NOT FOUND"}, model=${model}, serial=${serial || "none"}`, "scanner");
    }

    return {
      ip,
      port,
      found: true,
      model,
      hashrate,
      mac,
      serial,
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


export async function scanIpRangeThrottled(
  startIp: string,
  endIp: string,
  port: number,
  onProgress?: (scanned: number, found: number) => void
): Promise<ScanResult[]> {
  const ips = generateIpRange(startIp, endIp);
  const reachableIps: string[] = [];
  let scannedCount = 0;

  for (let i = 0; i < ips.length; i += BULK_MAX_CONCURRENT) {
    const batch = ips.slice(i, i + BULK_MAX_CONCURRENT);
    const checks = await Promise.all(
      batch.map(async (ip) => {
        const open = await quickPortCheck(ip, port);
        return { ip, open };
      })
    );

    for (const check of checks) {
      if (check.open) reachableIps.push(check.ip);
    }

    scannedCount = Math.min(i + BULK_MAX_CONCURRENT, ips.length);
    if (onProgress) {
      onProgress(scannedCount, reachableIps.length);
    }
  }

  log(`Port check complete: ${reachableIps.length} reachable out of ${ips.length} IPs`, "scanner");

  const allResults: ScanResult[] = [];
  for (let i = 0; i < reachableIps.length; i += BULK_PROBE_CONCURRENT) {
    const batch = reachableIps.slice(i, i + BULK_PROBE_CONCURRENT);
    const tasks = batch.map((ip) => () => probeMiner(ip, port));
    const results = await runBatch(tasks);

    for (const result of results) {
      if (result.found) {
        allResults.push(result);
        log(`Found miner at ${result.ip}:${port} - ${result.model}`, "scanner");
      }
    }
  }

  return allResults;
}

export function initBulkScan(totalContainers: number, totalIps: number): void {
  bulkScanProgress = {
    status: "scanning",
    totalContainers,
    completedContainers: 0,
    currentContainer: "",
    totalIps,
    scannedIps: 0,
    totalFound: 0,
    startedAt: new Date().toISOString(),
  };
}

export function updateBulkProgress(updates: Partial<BulkScanProgress>): void {
  if (bulkScanProgress) {
    Object.assign(bulkScanProgress, updates);
  }
}

export function completeBulkScan(error?: string): void {
  if (bulkScanProgress) {
    bulkScanProgress.status = error ? "error" : "completed";
    bulkScanProgress.completedAt = new Date().toISOString();
    if (error) bulkScanProgress.error = error;
  }
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
  try {
    const [summaryRes, statsRes] = await Promise.all([
      queryCgminerApi(ip, port, "summary"),
      queryCgminerApi(ip, port, "stats").catch(() => null),
    ]);

    let s: any = null;
    if (summaryRes?.SUMMARY?.[0]) {
      s = summaryRes.SUMMARY[0];
    } else if (summaryRes?.Msg && typeof summaryRes.Msg === "object") {
      s = summaryRes.Msg;
    }

    if (!s) {
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
    return null;
  }
}

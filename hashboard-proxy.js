const http = require("http");
const net = require("net");

const PORT = 3939;
const TIMEOUT = 5000;
const SCAN_TIMEOUT = 1500;
const SCAN_CONCURRENCY = 50;

function queryMiner(ip, port, command, timeout) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let data = "";
    let done = false;

    socket.setTimeout(timeout || TIMEOUT);
    socket.connect(port, ip, () => {
      socket.write(JSON.stringify({ command }));
    });

    socket.on("data", (chunk) => {
      data += chunk.toString();
      if (chunk.toString().includes("\0") && !done) {
        done = true;
        socket.destroy();
        try { resolve(JSON.parse(data.replace(/\0/g, "").trim())); }
        catch { resolve({ raw: data }); }
      }
    });

    socket.on("end", () => {
      if (!done) {
        done = true;
        try { resolve(JSON.parse(data.replace(/\0/g, "").trim())); }
        catch { resolve({ raw: data }); }
      }
    });

    socket.on("timeout", () => {
      if (!done) { done = true; socket.destroy(); reject(new Error("Timeout")); }
    });

    socket.on("error", (err) => {
      if (!done) { done = true; socket.destroy(); reject(err); }
    });
  });
}

function parseSubnet(cidr) {
  const parts = cidr.split("/");
  const ip = parts[0];
  const mask = parseInt(parts[1] || "24");
  const octets = ip.split(".").map(Number);
  const ipNum = (octets[0] << 24) + (octets[1] << 16) + (octets[2] << 8) + octets[3];
  const hostBits = 32 - mask;
  const networkAddr = ipNum & (~0 << hostBits);
  const count = 1 << hostBits;
  const ips = [];
  for (let i = 1; i < count - 1; i++) {
    const addr = networkAddr + i;
    ips.push(((addr >> 24) & 255) + "." + ((addr >> 16) & 255) + "." + ((addr >> 8) & 255) + "." + (addr & 255));
  }
  return ips;
}

let scanState = { running: false, total: 0, scanned: 0, found: [], currentIp: "" };

async function scanSubnet(cidr, port) {
  const ips = parseSubnet(cidr);
  scanState = { running: true, total: ips.length, scanned: 0, found: [], currentIp: "" };
  console.log("Scanning " + ips.length + " IPs in " + cidr + "...");

  const chunks = [];
  for (let i = 0; i < ips.length; i += SCAN_CONCURRENCY) {
    chunks.push(ips.slice(i, i + SCAN_CONCURRENCY));
  }

  for (const chunk of chunks) {
    if (!scanState.running) break;
    const results = await Promise.allSettled(chunk.map(async (ip) => {
      scanState.currentIp = ip;
      try {
        const summary = await queryMiner(ip, port, "summary", SCAN_TIMEOUT);
        const s = (summary.SUMMARY && summary.SUMMARY[0]) || {};
        if (s.Elapsed !== undefined || s['GHS av'] !== undefined || s['MHS av'] !== undefined) {
          const ghsAv = s['GHS av'] || 0;
          const mhsAv = s['MHS av'] || 0;
          const hashrate = ghsAv > 0 ? ghsAv / 1000 : mhsAv / 1e6;
          const entry = {
            ip: ip,
            port: port,
            temperature: s.Temperature || null,
            hashrate: hashrate,
            power: s.Power || s['Power Consumption'] || null,
            fanIn: s['Fan Speed In'] || s.FanSpeedIn || null,
            fanOut: s['Fan Speed Out'] || s.FanSpeedOut || null,
            elapsed: s.Elapsed || 0,
            accepted: s.Accepted || 0,
            rejected: s.Rejected || 0,
            factoryGHS: s['Factory GHS'] || 0,
            powerMode: s['Power Mode'] || '',
            status: 'online'
          };
          scanState.found.push(entry);
          console.log("  Found miner: " + ip + " (" + hashrate.toFixed(1) + " TH/s, " + (s.Temperature || "?") + "C)");
        }
      } catch (e) {}
    }));
    scanState.scanned += chunk.length;
  }

  scanState.running = false;
  console.log("Scan complete. Found " + scanState.found.length + " miners.");
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  if (req.method === "POST" && req.url === "/query") {
    let body = "";
    req.on("data", (c) => body += c);
    req.on("end", async () => {
      try {
        const { ip, port, command } = JSON.parse(body);
        const result = await queryMiner(ip, port || 4028, command);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end(err.message);
      }
    });
  } else if (req.method === "POST" && req.url === "/scan") {
    let body = "";
    req.on("data", (c) => body += c);
    req.on("end", () => {
      try {
        const { subnet, port } = JSON.parse(body);
        if (scanState.running) {
          res.writeHead(409, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Scan already in progress" }));
          return;
        }
        scanSubnet(subnet, port || 4028);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ started: true, total: parseSubnet(subnet).length }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end(err.message);
      }
    });
  } else if (req.method === "GET" && req.url === "/scan/progress") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(scanState));
  } else if (req.method === "POST" && req.url === "/scan/stop") {
    scanState.running = false;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ stopped: true }));
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(PORT, () => {
  console.log("Hashboard proxy running on http://localhost:" + PORT);
  console.log("Now open hashboard-monitor.html in your browser");
});

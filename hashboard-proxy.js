const http = require("http");
const net = require("net");

const PORT = 3939;
const TIMEOUT = 5000;

function queryMiner(ip, port, command) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let data = "";
    let done = false;

    socket.setTimeout(TIMEOUT);
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
      if (!done) { done = true; socket.destroy(); reject(new Error("Timeout connecting to " + ip)); }
    });

    socket.on("error", (err) => {
      if (!done) { done = true; socket.destroy(); reject(err); }
    });
  });
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
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
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});

server.listen(PORT, () => {
  console.log(`Hashboard proxy running on http://localhost:${PORT}`);
  console.log("Now open hashboard-monitor.html in your browser");
});

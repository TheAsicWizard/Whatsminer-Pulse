import net from "net";

const ip = process.argv[2] || "10.31.184.16";
const port = parseInt(process.argv[3] || "4028");

function query(cmd: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error("timeout"));
    }, 5000);

    const socket = new net.Socket();
    let data = "";

    socket.connect(port, ip, () => {
      socket.write(JSON.stringify({ cmd }) + "\n");
    });

    socket.on("data", (chunk) => { data += chunk.toString(); });
    socket.on("end", () => {
      clearTimeout(timeout);
      try {
        const cleaned = data.replace(/\0/g, "").trim();
        resolve(JSON.parse(cleaned));
      } catch {
        resolve(data);
      }
    });
    socket.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

async function main() {
  console.log(`=== PROBING ${ip}:${port} ===\n`);

  const commands = ["summary", "stats", "get_miner_info", "devs", "edevs", "get_token", "get_version"];

  for (const cmd of commands) {
    console.log(`--- ${cmd} ---`);
    try {
      const result = await query(cmd);
      console.log(JSON.stringify(result, null, 2));

      if (result?.Msg && typeof result.Msg === "object") {
        const keys = Object.keys(result.Msg);
        const macKeys = keys.filter(k => /mac|addr|net|eth/i.test(k));
        console.log(`\n  Msg keys (${keys.length}): ${keys.join(", ")}`);
        if (macKeys.length > 0) {
          console.log(`  MAC-related keys: ${macKeys.join(", ")}`);
          macKeys.forEach(k => console.log(`    ${k} = ${result.Msg[k]}`));
        }
      }

      if (result?.SUMMARY?.[0]) {
        const keys = Object.keys(result.SUMMARY[0]);
        const macKeys = keys.filter(k => /mac|addr|net|eth/i.test(k));
        console.log(`\n  SUMMARY keys (${keys.length}): ${keys.join(", ")}`);
        if (macKeys.length > 0) {
          console.log(`  MAC-related keys: ${macKeys.join(", ")}`);
          macKeys.forEach(k => console.log(`    ${k} = ${result.SUMMARY[0][k]}`));
        }
      }
    } catch (err: any) {
      console.log(`  Error: ${err.message}`);
    }
    console.log("");
  }
}

main().catch(console.error);

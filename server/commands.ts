import * as net from "net";
import * as crypto from "crypto";
import { log } from "./index";

const CMD_TIMEOUT = 5000;

interface CommandResult {
  success: boolean;
  message: string;
  data?: any;
}

function sendTcpCommand(host: string, port: number, payload: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let data = "";

    socket.setTimeout(CMD_TIMEOUT);

    socket.connect(port, host, () => {
      socket.write(JSON.stringify(payload));
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
          resolve({ STATUS: [{ STATUS: "S", Msg: "OK" }] });
        }
      } catch {
        resolve({ raw: data.substring(0, 500) });
      }
    });

    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("Connection timeout — miner not reachable"));
    });

    socket.on("error", (err) => {
      socket.destroy();
      reject(err);
    });
  });
}

async function getApiToken(host: string, port: number, password: string): Promise<string | null> {
  try {
    const tokenResp = await sendTcpCommand(host, port, { cmd: "get_token" });
    const tokenData = tokenResp?.Msg;
    if (!tokenData) return null;

    const salt = tokenData.salt || tokenData.Salt;
    const newsalt = tokenData.newsalt || tokenData.Newsalt;
    if (!salt) return null;

    const secret = crypto.createHash("md5").update(password + salt).digest("hex");

    const setResp = await sendTcpCommand(host, port, {
      cmd: "set_token",
      token: secret,
      newsalt: newsalt || salt,
    });

    const setData = setResp?.Msg;
    if (setData?.token) return setData.token;
    if (typeof setResp?.token === "string") return setResp.token;

    return secret;
  } catch {
    return null;
  }
}

const API_CMD_MAP: Record<string, string> = {
  restart: "restart_btminer",
  power_off: "power_off",
  set_power_pct: "set_power_pct",
  update_pools: "update_pools",
  set_target_freq: "set_target_freq",
  get_psu: "get_psu",
  get_version: "get_version",
  summary: "summary",
};

export async function sendMinerCommand(
  host: string,
  port: number,
  command: string,
  params: Record<string, any> = {},
  apiPassword?: string,
): Promise<CommandResult> {
  const apiCmd = API_CMD_MAP[command] || command;
  log(`Sending command '${apiCmd}' (${command}) to ${host}:${port}`, "commands");

  try {
    let token: string | undefined;
    const writeCommands = [
      "restart_btminer", "reboot", "power_off",
      "set_target_freq", "set_power_pct",
      "update_pools", "set_pools",
      "enable_btminer", "disable_btminer",
      "factory_reset",
    ];

    const needsAuth = writeCommands.includes(apiCmd);

    if (needsAuth && apiPassword) {
      const t = await getApiToken(host, port, apiPassword);
      if (t) token = t;
    }

    const payload: Record<string, any> = { cmd: apiCmd };
    if (token) payload.token = token;
    Object.assign(payload, params);

    const response = await sendTcpCommand(host, port, payload);

    const status = response?.STATUS?.[0] || response?.status?.[0];
    const msg = status?.Msg || status?.msg || response?.Msg?.msg || "";

    if (status?.STATUS === "E" || status?.status === "E") {
      return {
        success: false,
        message: msg || `Command '${command}' failed`,
        data: response,
      };
    }

    return {
      success: true,
      message: msg || `Command '${command}' sent successfully`,
      data: response,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Failed to send command",
    };
  }
}

export type MinerCommandType =
  | "restart"
  | "power_off"
  | "set_power_pct"
  | "update_pools"
  | "set_target_freq"
  | "get_psu"
  | "get_version"
  | "summary";

export const AVAILABLE_COMMANDS: {
  id: MinerCommandType;
  label: string;
  description: string;
  dangerous: boolean;
  requiresParams: boolean;
}[] = [
  { id: "restart", label: "Restart Miner", description: "Reboot the miner controller board", dangerous: false, requiresParams: false },
  { id: "power_off", label: "Power Off", description: "Shut down the miner", dangerous: true, requiresParams: false },
  { id: "set_power_pct", label: "Set Power Mode", description: "Set power percentage (e.g. 100 for normal, 50 for low power)", dangerous: false, requiresParams: true },
  { id: "update_pools", label: "Update Pools", description: "Change the mining pool configuration", dangerous: false, requiresParams: true },
  { id: "set_target_freq", label: "Set Frequency", description: "Set the target mining frequency in MHz", dangerous: false, requiresParams: true },
  { id: "get_psu", label: "Get PSU Info", description: "Read power supply unit details", dangerous: false, requiresParams: false },
  { id: "get_version", label: "Get Firmware Version", description: "Check firmware and hardware version", dangerous: false, requiresParams: false },
  { id: "summary", label: "Get Summary", description: "Query live mining summary", dangerous: false, requiresParams: false },
];

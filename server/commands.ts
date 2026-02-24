import * as net from "net";
import * as crypto from "crypto";
import md5crypt_ from "apache-md5";
const md5crypt = md5crypt_ as unknown as (password: string, salt: string) => string;
import { log } from "./index";
import { lockMinerForCommand, unlockMinerForCommand } from "./poller";

const CMD_TIMEOUT = 10000;

interface CommandResult {
  success: boolean;
  message: string;
  data?: any;
}

function sendTcpCommand(host: string, port: number, payload: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let data = "";
    let resolved = false;

    function tryResolve() {
      if (resolved) return;
      resolved = true;
      socket.destroy();
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
    }

    socket.setTimeout(CMD_TIMEOUT);

    socket.connect(port, host, () => {
      socket.write(JSON.stringify(payload));
    });

    socket.on("data", (chunk) => {
      data += chunk.toString();
      if (chunk.toString().includes("\0")) {
        tryResolve();
      }
    });

    socket.on("end", () => {
      tryResolve();
    });

    socket.on("timeout", () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        reject(new Error("Connection timeout — miner not reachable"));
      }
    });

    socket.on("error", (err) => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        reject(err);
      }
    });
  });
}

interface AuthResult {
  sign: string;
  aesKey: Buffer;
}

async function getApiToken(host: string, port: number, password: string): Promise<AuthResult | null> {
  try {
    const tokenResp = await sendTcpCommand(host, port, { cmd: "get_token" });
    log(`get_token response: ${JSON.stringify(tokenResp).substring(0, 500)}`, "commands");

    const msgData = tokenResp?.Msg || tokenResp?.msg;
    if (!msgData || typeof msgData !== "object") {
      if (msgData === "over max connect") {
        log(`get_token: over max connect - too many connections`, "commands");
      } else {
        log(`get_token: no Msg object. Full: ${JSON.stringify(tokenResp)}`, "commands");
      }
      return null;
    }

    const salt = msgData.salt || msgData.Salt;
    const newsalt = msgData.newsalt || msgData.Newsalt || msgData.newSalt;
    const time = msgData.time || msgData.Time;

    if (!salt || !newsalt || !time) {
      log(`get_token: missing fields. salt=${salt}, newsalt=${newsalt}, time=${time}`, "commands");
      return null;
    }

    const pwd = md5crypt(password, "$1$" + salt + "$");
    const pwdParts = pwd.split("$");
    const key = pwdParts[3];
    log(`md5crypt key derived, length=${key.length}`, "commands");

    const aesKeyHex = crypto.createHash("sha256").update(key).digest("hex");
    const aesKey = Buffer.from(aesKeyHex, "hex");

    const signInput = key + String(time);
    const tmp = md5crypt(signInput, "$1$" + newsalt + "$");
    const tmpParts = tmp.split("$");
    const sign = tmpParts[3];
    log(`Sign computed, length=${sign.length}`, "commands");

    return { sign, aesKey };
  } catch (err: any) {
    log(`getApiToken error: ${err.message}`, "commands");
    return null;
  }
}

function padTo16(s: string): Buffer {
  const buf = Buffer.from(s, "utf8");
  const padded = Buffer.alloc(Math.ceil(buf.length / 16) * 16, 0);
  buf.copy(padded);
  return padded;
}

function encryptCommand(cmdData: string, aesKey: Buffer): string {
  const padded = padTo16(cmdData);
  const cipher = crypto.createCipheriv("aes-256-ecb", aesKey, null);
  cipher.setAutoPadding(false);
  let encrypted = cipher.update(padded);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return encrypted.toString("base64");
}

function decryptResponse(encData: string, aesKey: Buffer): any {
  try {
    const buf = Buffer.from(encData, "base64");
    const decipher = crypto.createDecipheriv("aes-256-ecb", aesKey, null);
    decipher.setAutoPadding(false);
    let decrypted = decipher.update(buf);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    const text = decrypted.toString("utf8").replace(/\0+$/g, "");
    return JSON.parse(text);
  } catch (err: any) {
    log(`decrypt failed: ${err.message}`, "commands");
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
  log(`Sending command '${apiCmd}' (${command}) to ${host}:${port} [timeout=${CMD_TIMEOUT}ms]`, "commands");

  lockMinerForCommand(host);
  try {
    const writeCommands = [
      "restart_btminer", "reboot", "power_off",
      "set_target_freq", "set_power_pct",
      "update_pools", "set_pools",
      "enable_btminer", "disable_btminer",
      "factory_reset",
    ];

    const needsAuth = writeCommands.includes(apiCmd);
    let authResult: AuthResult | null = null;

    if (needsAuth && apiPassword) {
      authResult = await getApiToken(host, port, apiPassword);
      if (authResult) {
        log(`Auth token obtained successfully`, "commands");
      } else {
        log(`Auth token failed - command may be rejected`, "commands");
      }
    } else if (needsAuth && !apiPassword) {
      log(`Write command '${apiCmd}' requires auth but no API password provided`, "commands");
    }

    let response: any;

    if (needsAuth && authResult) {
      const cmdData = JSON.stringify({ cmd: apiCmd, token: authResult.sign, ...params });
      const enc = encryptCommand(cmdData, authResult.aesKey);
      const encPayload = { enc: 1, data: enc };
      log(`Sending encrypted payload for '${apiCmd}'`, "commands");
      const rawResp = await sendTcpCommand(host, port, encPayload);
      log(`Encrypted response: ${JSON.stringify(rawResp).substring(0, 500)}`, "commands");

      if (rawResp?.STATUS === "E") {
        log(`Command error: ${rawResp.Msg}`, "commands");
        response = rawResp;
      } else if (rawResp?.enc) {
        const encResp = typeof rawResp.enc === "string" ? rawResp.enc : rawResp.data;
        if (encResp) {
          const decrypted = decryptResponse(encResp, authResult.aesKey);
          if (decrypted) {
            log(`Decrypted response: ${JSON.stringify(decrypted).substring(0, 500)}`, "commands");
            response = decrypted;
          } else {
            response = rawResp;
          }
        } else {
          response = rawResp;
        }
      } else {
        response = rawResp;
      }
    } else {
      const payload: Record<string, any> = { cmd: apiCmd };
      Object.assign(payload, params);

      log(`Sending payload: ${JSON.stringify(payload)}`, "commands");
      response = await sendTcpCommand(host, port, payload);
      log(`Command response: ${JSON.stringify(response).substring(0, 500)}`, "commands");
    }

    const statusArr = response?.STATUS;
    const status = Array.isArray(statusArr) ? statusArr[0] : (typeof statusArr === "string" ? { STATUS: statusArr } : null);
    const statusArrLc = response?.status;
    const statusLc = Array.isArray(statusArrLc) ? statusArrLc[0] : (typeof statusArrLc === "string" ? { status: statusArrLc } : null);
    const st = status || statusLc;

    const msgRaw = st?.Msg || st?.msg || "";
    const msgFromObj = typeof response?.Msg === "string" ? response.Msg
      : typeof response?.Msg === "object" ? (response.Msg.msg || response.Msg.Msg || "") : "";
    const msg = msgRaw || msgFromObj;

    const isError = st?.STATUS === "E" || st?.status === "E" || response?.STATUS === "E";
    const msgLower = msg.toLowerCase();
    const isInvalidMsg = msgLower.includes("invalid") || msgLower.includes("error") || msgLower.includes("failed") || msgLower.includes("denied");

    if (isError || isInvalidMsg) {
      const authInfo = needsAuth
        ? (authResult ? `(auth: token obtained)` : apiPassword ? `(auth: token failed)` : `(auth: no password provided)`)
        : `(no auth needed)`;
      return {
        success: false,
        message: `${msg || `Command '${command}' failed`} ${authInfo}`,
        data: response,
      };
    }

    return {
      success: true,
      message: msg || `Command '${command}' sent successfully`,
      data: response,
    };
  } catch (err: any) {
    log(`Command error: ${err.stack || err.message}`, "commands");
    return {
      success: false,
      message: err.message || "Failed to send command",
      data: { error: err.message, stack: err.stack },
    };
  } finally {
    unlockMinerForCommand(host);
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

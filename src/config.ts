/**
 * cPanel MCP Server - Global Configuration Manager
 *
 * @author AkashJamali
 * @license MIT
 * @copyright (c) 2026 AkashJamali. All rights reserved.
 * @link https://github.com/AkashJamali/cpanel-mcp-server
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export interface CpanelConfig {
  serverUrl: string;
  username: string;
  apiToken: string;
  githubToken?: string;
  verifySsl?: boolean;
  timeoutMs?: number;
  allowInsecureHttp?: boolean;
}

export function getGlobalConfigDir(): string {
  return path.join(os.homedir(), ".cpanel-mcp");
}

export function getGlobalConfigPath(): string {
  return path.join(getGlobalConfigDir(), "config.json");
}

export function loadGlobalConfig(): CpanelConfig | null {
  const filePath = getGlobalConfigPath();
  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed.serverUrl && parsed.username && parsed.apiToken) {
      return {
        serverUrl: String(parsed.serverUrl),
        username: String(parsed.username),
        apiToken: String(parsed.apiToken),
        githubToken: parsed.githubToken ? String(parsed.githubToken) : undefined,
        verifySsl: parsed.verifySsl !== false,
        timeoutMs: Number(parsed.timeoutMs) || 30000,
        allowInsecureHttp: Boolean(parsed.allowInsecureHttp),
      };
    }
  } catch {
    // If corrupt, return null
  }
  return null;
}

export function saveGlobalConfig(config: CpanelConfig): void {
  const configDir = getGlobalConfigDir();
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
  }

  const filePath = getGlobalConfigPath();
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2), {
    mode: 0o600,
    encoding: "utf-8",
  });
}

export function deleteGlobalConfig(): boolean {
  const filePath = getGlobalConfigPath();
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

export function resolveEffectiveConfig(): CpanelConfig | null {
  // 1. Highest priority: process.env
  const envUser = process.env.CPANEL_USERNAME;
  const envToken = process.env.CPANEL_API_TOKEN;
  const envUrl = process.env.CPANEL_SERVER_URL;

  if (envUser && envToken && envUrl) {
    return {
      username: envUser,
      apiToken: envToken,
      serverUrl: envUrl,
      githubToken: process.env.GITHUB_TOKEN || loadGlobalConfig()?.githubToken,
      verifySsl: process.env.CPANEL_VERIFY_SSL !== "false",
      timeoutMs: Number(process.env.CPANEL_TIMEOUT_MS) || 30000,
      allowInsecureHttp: process.env.CPANEL_ALLOW_INSECURE_HTTP === "true",
    };
  }

  // 2. Global user config (~/.cpanel-mcp/config.json)
  const globalConfig = loadGlobalConfig();
  if (globalConfig) {
    return globalConfig;
  }

  return null;
}

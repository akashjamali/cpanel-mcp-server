/**
 * cPanel MCP Server - API Client
 *
 * @author AkashJamali
 * @license MIT
 * @copyright (c) 2026 AkashJamali. All rights reserved.
 * @link https://github.com/AkashJamali/cpanel-mcp-server
 */

import https from "node:https";
import http from "node:http";
import { URL } from "node:url";
import { resolveEffectiveConfig, type CpanelConfig } from "./config.js";

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 1000;

export interface CpanelApiResponse {
  status: number;
  errors: string[] | null;
  messages: string[] | null;
  data: unknown;
  metadata?: Record<string, unknown>;
}

export interface CpanelApi2Response {
  cpanelresult: {
    apiversion: number;
    func: string;
    module: string;
    data: unknown;
    error?: string;
  };
}

export class CpanelApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly apiErrors?: string[]
  ) {
    super(message);
    this.name = "CpanelApiError";
  }
}

function isLoopbackHostname(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "[::1]") return true;

  const octets = hostname.split(".");
  return (
    octets.length === 4 &&
    octets[0] === "127" &&
    octets.every((octet) => /^\d+$/.test(octet) && Number(octet) <= 255)
  );
}

function parseServerUrl(serverUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(serverUrl);
  } catch {
    throw new CpanelApiError("Invalid CPANEL_SERVER_URL");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new CpanelApiError("CPANEL_SERVER_URL must use HTTP or HTTPS");
  }
  if (parsed.username || parsed.password) {
    throw new CpanelApiError("CPANEL_SERVER_URL must not contain credentials");
  }
  if (parsed.search || parsed.hash) {
    throw new CpanelApiError("CPANEL_SERVER_URL must not contain a query or fragment");
  }

  return parsed;
}

export class CpanelClient {
  private baseUrl = "";
  private username = "";
  private apiToken = "";
  private githubToken?: string;
  private httpsAgent: https.Agent;
  private httpAgent: http.Agent;
  private timeoutMs: number = DEFAULT_TIMEOUT_MS;
  private configured = false;

  constructor(initialConfig?: CpanelConfig) {
    this.httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 5 });
    this.httpAgent = new http.Agent({ keepAlive: true, maxSockets: 5 });

    const config = initialConfig ?? resolveEffectiveConfig();
    if (config && config.serverUrl && config.username && config.apiToken) {
      this.configure(config);
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  getConfigSummary(): { username: string; serverUrl: string } | null {
    if (!this.configured) return null;
    return {
      username: this.username,
      serverUrl: this.baseUrl,
    };
  }

  getGithubToken(): string | undefined {
    return this.githubToken;
  }

  setGithubToken(token?: string): void {
    this.githubToken = token;
  }

  configure(config: CpanelConfig): void {
    const parsedServerUrl = parseServerUrl(config.serverUrl);
    if (parsedServerUrl.protocol === "http:") {
      const allowInsecureHttp =
        config.allowInsecureHttp ?? (process.env.CPANEL_ALLOW_INSECURE_HTTP === "true");
      if (!allowInsecureHttp || !isLoopbackHostname(parsedServerUrl.hostname)) {
        throw new CpanelApiError(
          "CPANEL_SERVER_URL must use HTTPS. Plain HTTP is only allowed for loopback hosts when CPANEL_ALLOW_INSECURE_HTTP=true."
        );
      }
      console.warn(
        "[Security Warning] CPANEL_SERVER_URL is using explicitly enabled loopback HTTP. Credentials are not encrypted."
      );
    }

    this.username = config.username;
    this.apiToken = config.apiToken;
    this.githubToken = config.githubToken;
    this.baseUrl = parsedServerUrl.href.replace(/\/+$/, "");
    this.timeoutMs = config.timeoutMs ?? (Number(process.env.CPANEL_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS);

    const rejectUnauthorized =
      config.verifySsl !== false && process.env.CPANEL_VERIFY_SSL !== "false";

    this.destroyAgents();

    this.httpsAgent = new https.Agent({
      keepAlive: true,
      maxSockets: 5,
      rejectUnauthorized,
    });

    this.httpAgent = new http.Agent({
      keepAlive: true,
      maxSockets: 5,
    });

    this.configured = true;
  }

  clearConfiguration(): void {
    this.configured = false;
    this.username = "";
    this.apiToken = "";
    this.baseUrl = "";
    this.githubToken = undefined;
  }

  private destroyAgents(): void {
    if (this.httpsAgent) this.httpsAgent.destroy();
    if (this.httpAgent) this.httpAgent.destroy();
  }

  private buildHeaders(): Record<string, string> {
    return {
      Authorization: `cpanel ${this.username}:${this.apiToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    };
  }

  private request(method: string, url: string, body?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const isHttps = parsed.protocol === "https:";
      const transport = isHttps ? https : http;

      const options: https.RequestOptions = {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method,
        headers: this.buildHeaders(),
        agent: isHttps ? this.httpsAgent : this.httpAgent,
        timeout: this.timeoutMs,
      };

      if (body) {
        options.headers = {
          ...options.headers,
          "Content-Length": Buffer.byteLength(body).toString(),
        };
      }

      const req = transport.request(options, (res) => {
        const chunks: Buffer[] = [];
        let totalBytes = 0;

        res.on("data", (chunk: Buffer) => {
          totalBytes += chunk.length;
          if (totalBytes > MAX_RESPONSE_BYTES) {
            req.destroy();
            reject(
              new CpanelApiError(
                `Response exceeded ${MAX_RESPONSE_BYTES} bytes limit`
              )
            );
            return;
          }
          chunks.push(chunk);
        });

        res.on("end", () => {
          const responseBody = Buffer.concat(chunks).toString("utf-8");
          if (res.statusCode && res.statusCode >= 400) {
            reject(
              new CpanelApiError(
                `HTTP ${res.statusCode}: ${responseBody.substring(0, 500)}`,
                res.statusCode
              )
            );
          } else {
            resolve(responseBody);
          }
        });

        res.on("error", (err) =>
          reject(new CpanelApiError(`Response error: ${err.message}`))
        );
      });

      req.on("timeout", () => {
        req.destroy();
        reject(new CpanelApiError(`Request timed out after ${this.timeoutMs}ms`));
      });

      req.on("error", (err) =>
        reject(new CpanelApiError(`Request failed: ${err.message}`))
      );

      if (body) req.write(body);
      req.end();
    });
  }

  private async requestWithRetry(
    method: string,
    url: string,
    body?: string
  ): Promise<string> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.request(method, url, body);
      } catch (err) {
        lastError = err as Error;

        if (err instanceof CpanelApiError && err.statusCode && err.statusCode < 500) {
          throw err;
        }

        if (attempt < MAX_RETRIES) {
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
          console.error(`[API] Retry ${attempt + 1}/${MAX_RETRIES} after ${delay}ms`);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    throw lastError;
  }

  async uapi(
    module: string,
    func: string,
    params: Record<string, string> = {}
  ): Promise<CpanelApiResponse> {
    if (!this.configured) {
      throw new CpanelApiError(
        "cPanel is not connected yet. Please use the 'login_cpanel' tool with your cPanel server URL, username, and API token to connect."
      );
    }

    const query = new URLSearchParams(params).toString();
    const url = `${this.baseUrl}/execute/${encodeURIComponent(module)}/${encodeURIComponent(func)}${query ? "?" + query : ""}`;

    console.error(`[API] UAPI ${module}::${func}`);

    const raw = await this.requestWithRetry("GET", url);
    let parsed: { result: CpanelApiResponse };
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new CpanelApiError(
        `Invalid JSON response from UAPI ${module}::${func}`
      );
    }

    const result = parsed.result ?? (parsed as unknown as CpanelApiResponse);

    if (result.status === 0 && result.errors?.length) {
      throw new CpanelApiError(
        `UAPI ${module}::${func} failed: ${result.errors.join(", ")}`,
        undefined,
        result.errors
      );
    }

    return result;
  }

  async uapiPost(
    module: string,
    func: string,
    params: Record<string, string> = {}
  ): Promise<CpanelApiResponse> {
    if (!this.configured) {
      throw new CpanelApiError(
        "cPanel is not connected yet. Please use the 'login_cpanel' tool with your cPanel server URL, username, and API token to connect."
      );
    }

    const url = `${this.baseUrl}/execute/${encodeURIComponent(module)}/${encodeURIComponent(func)}`;
    const body = new URLSearchParams(params).toString();

    console.error(`[API] UAPI POST ${module}::${func}`);

    const raw = await this.requestWithRetry("POST", url, body);
    let parsed: { result: CpanelApiResponse };
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new CpanelApiError(
        `Invalid JSON response from UAPI ${module}::${func}`
      );
    }

    const result = parsed.result ?? (parsed as unknown as CpanelApiResponse);

    if (result.status === 0 && result.errors?.length) {
      throw new CpanelApiError(
        `UAPI ${module}::${func} failed: ${result.errors.join(", ")}`,
        undefined,
        result.errors
      );
    }

    return result;
  }

  async api2(
    module: string,
    func: string,
    params: Record<string, string> = {}
  ): Promise<unknown> {
    if (!this.configured) {
      throw new CpanelApiError(
        "cPanel is not connected yet. Please use the 'login_cpanel' tool with your cPanel server URL, username, and API token to connect."
      );
    }

    const query = new URLSearchParams({
      cpanel_jsonapi_user: this.username,
      cpanel_jsonapi_apiversion: "2",
      cpanel_jsonapi_module: module,
      cpanel_jsonapi_func: func,
      ...params,
    }).toString();

    const url = `${this.baseUrl}/json-api/cpanel?${query}`;

    console.error(`[API] API2 ${module}::${func}`);

    const raw = await this.requestWithRetry("GET", url);
    let parsed: CpanelApi2Response;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new CpanelApiError(
        `Invalid JSON response from API2 ${module}::${func}`
      );
    }

    if (parsed.cpanelresult?.error) {
      throw new CpanelApiError(
        `API2 ${module}::${func} failed: ${parsed.cpanelresult.error}`
      );
    }

    return parsed.cpanelresult?.data;
  }

  destroy(): void {
    this.destroyAgents();
  }
}

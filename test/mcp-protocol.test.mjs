/**
 * cPanel MCP Server - MCP Protocol Compliance Tests
 *
 * @author AkashJamali
 * @license MIT
 * @copyright (c) 2026 AkashJamali. All rights reserved.
 * @link https://github.com/AkashJamali/cpanel-mcp-server
 */

import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverScript = path.resolve(__dirname, "../build/index.js");

class McpTestClient {
  constructor() {
    this.process = spawn("node", [serverScript], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.buffer = "";
    this.pending = new Map();
    this.requestId = 1;

    this.process.stdout.on("data", (chunk) => {
      this.buffer += chunk.toString("utf-8");
      const lines = this.buffer.split("\n");
      this.buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const msg = JSON.parse(trimmed);
          if (msg.id && this.pending.has(msg.id)) {
            const { resolve, reject } = this.pending.get(msg.id);
            this.pending.delete(msg.id);
            if (msg.error) {
              reject(new Error(msg.error.message || JSON.stringify(msg.error)));
            } else {
              resolve(msg.result);
            }
          }
        } catch {
          // ignore unparsed lines
        }
      }
    });
  }

  sendRequest(method, params = {}) {
    const id = this.requestId++;
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params,
    }) + "\n";

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.process.stdin.write(payload);
    });
  }

  sendNotification(method, params = {}) {
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      method,
      params,
    }) + "\n";
    this.process.stdin.write(payload);
  }

  destroy() {
    this.process.kill();
  }
}

test("MCP Server speaks valid JSON-RPC 2.0 and supports full MCP handshake", async () => {
  const client = new McpTestClient();

  try {
    // 1. Initialize Handshake
    const initResult = await client.sendRequest("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "compliance-tester", version: "1.0.0" },
    });

    assert.equal(initResult.serverInfo.name, "cpanel-mcp-server");
    assert.equal(initResult.serverInfo.version, "2.1.0");
    assert.ok(initResult.capabilities.tools, "Server must expose tools capability");
    assert.ok(initResult.capabilities.resources, "Server must expose resources capability");
    assert.ok(initResult.capabilities.prompts, "Server must expose prompts capability");

    client.sendNotification("notifications/initialized");

    // 2. tools/list verification
    const toolsResult = await client.sendRequest("tools/list");
    assert.ok(Array.isArray(toolsResult.tools), "tools/list must return an array");
    assert.ok(toolsResult.tools.length >= 200, `Expected >= 200 tools, found ${toolsResult.tools.length}`);

    // Verify key tools exist
    const toolNames = new Set(toolsResult.tools.map((t) => t.name));
    assert.ok(toolNames.has("login_cpanel"), "Must have login_cpanel");
    assert.ok(toolNames.has("setup_nodejs_app"), "Must have setup_nodejs_app");
    assert.ok(toolNames.has("setup_python_app"), "Must have setup_python_app");
    assert.ok(toolNames.has("setup_laravel_hosting"), "Must have setup_laravel_hosting");
    assert.ok(toolNames.has("redeploy_from_github"), "Must have redeploy_from_github");
    assert.ok(toolNames.has("provision_full_website"), "Must have provision_full_website");

    // 3. prompts/list verification
    const promptsResult = await client.sendRequest("prompts/list");
    assert.ok(Array.isArray(promptsResult.prompts), "prompts/list must return an array");
    assert.ok(promptsResult.prompts.length >= 5, "Must expose registered prompts");

    // 4. resources/list verification
    const resourcesResult = await client.sendRequest("resources/list");
    assert.ok(Array.isArray(resourcesResult.resources), "resources/list must return an array");
    assert.ok(resourcesResult.resources.length >= 3, "Must expose registered resources");
  } finally {
    client.destroy();
  }
});

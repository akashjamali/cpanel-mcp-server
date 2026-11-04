/**
 * cPanel MCP Server - Authentication & Easy Login Tools
 *
 * @author AkashJamali
 * @license MIT
 * @copyright (c) 2026 AkashJamali. All rights reserved.
 * @link https://github.com/AkashJamali/cpanel-mcp-server
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CpanelClient, CpanelApiError } from "../cpanel-api.js";
import { handleToolCall, formatSuccess, formatData, formatError } from "../tool-helpers.js";
import { saveGlobalConfig, deleteGlobalConfig } from "../config.js";

export function registerAuthTools(server: McpServer, client: CpanelClient): void {
  // Tool: Easy In-Chat Login
  server.tool(
    "login_cpanel",
    "Log into cPanel using your server URL, username, and API token. Credentials are saved permanently so you only have to do this once.",
    {
      server_url: z
        .string()
        .describe("Your cPanel URL, e.g. 'https://example.com:2083' or 'example.com:2083'"),
      username: z.string().describe("Your cPanel account username"),
      api_token: z
        .string()
        .describe("cPanel API Token (from cPanel dashboard -> Security -> Manage API Tokens)"),
      verify_ssl: z
        .boolean()
        .default(true)
        .describe("Verify SSL certificate. Set to false only if using self-signed certs"),
      save_permanently: z
        .boolean()
        .default(true)
        .describe("Save credentials to ~/.cpanel-mcp/config.json for automatic login in all future chats"),
    },
    async ({ server_url, username, api_token, verify_ssl, save_permanently }) =>
      handleToolCall(async () => {
        let cleanUrl = server_url.trim();
        if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
          cleanUrl = `https://${cleanUrl}`;
        }
        // Auto-append port 2083 if missing
        try {
          const parsed = new URL(cleanUrl);
          if (!parsed.port && parsed.protocol === "https:") {
            parsed.port = "2083";
            cleanUrl = parsed.toString().replace(/\/+$/, "");
          }
        } catch {
          // let CpanelClient validate
        }

        const testClient = new CpanelClient({
          serverUrl: cleanUrl,
          username: username.trim(),
          apiToken: api_token.trim(),
          verifySsl: verify_ssl,
        });

        // Test credentials live with a fast UAPI handshake
        let mainDomain = "";
        try {
          const testRes = await testClient.uapi("DomainInfo", "domains_data", { format: "hash" });
          if (
            testRes.data &&
            typeof testRes.data === "object" &&
            "main_domain" in (testRes.data as Record<string, unknown>)
          ) {
            mainDomain = String((testRes.data as Record<string, unknown>).main_domain);
          }
        } catch (err) {
          testClient.destroy();
          throw new CpanelApiError(
            `Login failed: Could not authenticate with cPanel. Please verify your URL, username, and API token.\nError details: ${err instanceof Error ? err.message : String(err)}`
          );
        }

        // Configure active client
        client.configure({
          serverUrl: cleanUrl,
          username: username.trim(),
          apiToken: api_token.trim(),
          verifySsl: verify_ssl,
        });

        testClient.destroy();

        if (save_permanently) {
          saveGlobalConfig({
            serverUrl: cleanUrl,
            username: username.trim(),
            apiToken: api_token.trim(),
            verifySsl: verify_ssl,
          });
        }

        return formatSuccess(
          `🎉 Successfully connected to cPanel!\n\n` +
            `• User: ${username.trim()}\n` +
            `• Server: ${cleanUrl}\n` +
            (mainDomain ? `• Primary Domain: ${mainDomain}\n` : "") +
            `• Saved: ${save_permanently ? "Yes (~/.cpanel-mcp/config.json)" : "Session only"}\n\n` +
            `You can now ask me to manage files, domains, emails, databases, SSL certificates, cron jobs, or anything else in your cPanel!`
        );
      })
  );

  // Tool: Check Connection Status & Help
  server.tool(
    "get_login_status",
    "Check if cPanel is currently connected and view account connection status or get login instructions",
    {},
    async () =>
      handleToolCall(async () => {
        if (client.isConfigured()) {
          const summary = client.getConfigSummary();
          return formatSuccess(
            `✅ cPanel is currently CONNECTED\n\n` +
              `• User: ${summary?.username}\n` +
              `• Server: ${summary?.serverUrl}\n` +
              `All 164+ cPanel tools are ready to use.`
          );
        }

        return formatData({
          connected: false,
          status: "Not logged in",
          instructions: {
            step1: "Log into your cPanel hosting dashboard in your browser.",
            step2: "Go to: Security -> Manage API Tokens.",
            step3: "Create a new token and copy it.",
            step4: "Call the 'login_cpanel' tool with your server_url, username, and api_token.",
          },
        });
      })
  );

  // Tool: Logout
  server.tool(
    "logout_cpanel",
    "Disconnect and remove saved cPanel credentials from this computer",
    {},
    async () =>
      handleToolCall(async () => {
        client.clearConfiguration();
        const removed = deleteGlobalConfig();
        return formatSuccess(
          `Logged out of cPanel.${removed ? " Saved credentials were removed from ~/.cpanel-mcp/config.json." : ""}`
        );
      })
  );
}

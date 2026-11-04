#!/usr/bin/env node
/**
 * cPanel MCP Server
 *
 * @author AkashJamali
 * @license MIT
 * @copyright (c) 2026 AkashJamali. All rights reserved.
 * @link https://github.com/AkashJamali/cpanel-mcp-server
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CpanelClient } from "./cpanel-api.js";
import { loadEnv } from "./env.js";

// Tools
import { registerFileTools } from "./tools/files.js";
import { registerDiskTools } from "./tools/disk.js";
import { registerMysqlTools } from "./tools/mysql.js";
import { registerEmailTools } from "./tools/email.js";
import { registerEmailAuthTools } from "./tools/email-auth.js";
import { registerEmailFilterTools } from "./tools/email-filters.js";
import { registerDnsTools } from "./tools/dns.js";
import { registerDnssecTools } from "./tools/dnssec.js";
import { registerDomainTools } from "./tools/domains.js";
import { registerCronTools } from "./tools/cron.js";
import { registerPhpTools } from "./tools/php.js";
import { registerSslTools } from "./tools/ssl.js";
import { registerSecurityTools } from "./tools/security.js";
import { registerModSecurityTools } from "./tools/modsecurity.js";
import { registerMetricsTools } from "./tools/metrics.js";
import { registerBackupTools } from "./tools/backups.js";
import { registerFtpTools } from "./tools/ftp.js";
import { registerPostgresqlTools } from "./tools/postgresql.js";
import { registerWordPressTools } from "./tools/wordpress.js";
import { registerPassengerTools } from "./tools/passenger.js";
import { registerVersionControlTools } from "./tools/version-control.js";
import { registerTwoFactorAuthTools } from "./tools/twofa.js";
import { registerVirusScannerTools } from "./tools/virus-scanner.js";
import { registerTokenTools } from "./tools/tokens.js";
import { registerFeatureTools } from "./tools/features.js";
import { registerAuthTools } from "./tools/auth.js";
import { registerWorkflowTools } from "./tools/workflows.js";
import { registerGithubTools } from "./tools/github.js";
import { registerNodeJsHostingTools } from "./tools/nodejs-hosting.js";
import { registerPythonHostingTools } from "./tools/python-hosting.js";
import { registerLaravelHostingTools } from "./tools/laravel-hosting.js";

// Resources & Prompts
import { registerResources } from "./resources.js";
import { registerPrompts } from "./prompts.js";

async function main() {
  if (
    process.argv[2] === "setup" ||
    process.argv[2] === "login" ||
    process.argv[2] === "--setup"
  ) {
    await import("./setup.js");
    return;
  }

  loadEnv();

  console.error("=================================================");
  console.error("   cPanel MCP Server - Redesigned by AkashJamali ");
  console.error("   License: MIT | Copyright (c) 2026 AkashJamali");
  console.error("=================================================");

  const cpanelClient = new CpanelClient();
  if (cpanelClient.isConfigured()) {
    const summary = cpanelClient.getConfigSummary();
    console.error(`[Setup] Connected to cPanel as: ${summary?.username} (${summary?.serverUrl})`);
  } else {
    console.error(
      "[Setup] Running in Easy Login mode. Users can authenticate in chat via 'login_cpanel' or run 'npx cpanel-mcp-server setup'."
    );
  }

  const server = new McpServer({
    name: "cpanel-mcp-server",
    version: "2.1.0",
  });

  console.error("[Setup] Registering tools...");

  // Easy Login & Authentication
  registerAuthTools(server, cpanelClient);

  // Core hosting
  registerFileTools(server, cpanelClient);
  registerDiskTools(server, cpanelClient);

  // Databases
  registerMysqlTools(server, cpanelClient);
  registerPostgresqlTools(server, cpanelClient);

  // Email
  registerEmailTools(server, cpanelClient);
  registerEmailAuthTools(server, cpanelClient);
  registerEmailFilterTools(server, cpanelClient);

  // DNS
  registerDnsTools(server, cpanelClient);
  registerDnssecTools(server, cpanelClient);

  // Domains
  registerDomainTools(server, cpanelClient);

  // Scheduling
  registerCronTools(server, cpanelClient);

  // PHP
  registerPhpTools(server, cpanelClient);

  // SSL/TLS
  registerSslTools(server, cpanelClient);

  // Security
  registerSecurityTools(server, cpanelClient);
  registerModSecurityTools(server, cpanelClient);
  registerTwoFactorAuthTools(server, cpanelClient);
  registerVirusScannerTools(server, cpanelClient);

  // Metrics & Logs
  registerMetricsTools(server, cpanelClient);

  // Backups
  registerBackupTools(server, cpanelClient);

  // FTP
  registerFtpTools(server, cpanelClient);

  // Applications & Deployment
  registerWordPressTools(server, cpanelClient);
  registerPassengerTools(server, cpanelClient);
  registerVersionControlTools(server, cpanelClient);

  // Account Management
  registerTokenTools(server, cpanelClient);
  registerFeatureTools(server, cpanelClient);

  // High-Level Composite Workflows
  registerWorkflowTools(server, cpanelClient);

  // GitHub & Automated CI/CD
  registerGithubTools(server, cpanelClient);

  // Modern Framework Hosting: Node.js, Python, & Laravel
  registerNodeJsHostingTools(server, cpanelClient);
  registerPythonHostingTools(server, cpanelClient);
  registerLaravelHostingTools(server, cpanelClient);

  console.error("[Setup] Registering MCP resources & prompts...");
  registerResources(server, cpanelClient);
  registerPrompts(server);

  console.error("[Setup] All tools, resources, and prompts registered.");
  console.error("[Setup] Starting stdio transport...");

  const transport = new StdioServerTransport();
  await server.connect(transport);

  const shutdown = () => {
    console.error("[Shutdown] Cleaning up connections...");
    cpanelClient.destroy();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.error("[Setup] cPanel MCP Server running on stdio");
}

main().catch((err) => {
  console.error("[Fatal Error]", err);
  process.exit(1);
});

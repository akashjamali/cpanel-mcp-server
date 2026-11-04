/**
 * cPanel MCP Server - Resources
 *
 * @author AkashJamali
 * @license MIT
 * @copyright (c) 2026 AkashJamali. All rights reserved.
 * @link https://github.com/AkashJamali/cpanel-mcp-server
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CpanelClient } from "./cpanel-api.js";

export function registerResources(server: McpServer, client: CpanelClient): void {
  // Resource: Account Disk Usage & Quota
  server.resource(
    "disk_usage",
    "cpanel://system/disk-usage",
    async (uri) => {
      try {
        const result = await client.uapi("Quota", "get_local_quota_info");
        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify(result.data, null, 2),
              mimeType: "application/json",
            },
          ],
        };
      } catch (err) {
        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify({ error: String(err) }, null, 2),
              mimeType: "application/json",
            },
          ],
        };
      }
    }
  );

  // Resource: Server Information & Profile
  server.resource(
    "server_info",
    "cpanel://server/info",
    async (uri) => {
      try {
        const [serverInfo, phpInfo] = await Promise.allSettled([
          client.uapi("ServerInformation", "get_information"),
          client.uapi("LangPHP", "php_get_installed_versions"),
        ]);

        const data = {
          server: serverInfo.status === "fulfilled" ? serverInfo.value.data : null,
          phpVersions: phpInfo.status === "fulfilled" ? phpInfo.value.data : null,
        };

        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify(data, null, 2),
              mimeType: "application/json",
            },
          ],
        };
      } catch (err) {
        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify({ error: String(err) }, null, 2),
              mimeType: "application/json",
            },
          ],
        };
      }
    }
  );

  // Resource: Account Overview Summary
  server.resource(
    "account_summary",
    "cpanel://account/summary",
    async (uri) => {
      try {
        const [stats, domains] = await Promise.allSettled([
          client.uapi("Stats", "get_site_usages"),
          client.uapi("DomainInfo", "domains_data", { format: "hash" }),
        ]);

        const data = {
          stats: stats.status === "fulfilled" ? stats.value.data : null,
          domains: domains.status === "fulfilled" ? domains.value.data : null,
        };

        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify(data, null, 2),
              mimeType: "application/json",
            },
          ],
        };
      } catch (err) {
        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify({ error: String(err) }, null, 2),
              mimeType: "application/json",
            },
          ],
        };
      }
    }
  );
}

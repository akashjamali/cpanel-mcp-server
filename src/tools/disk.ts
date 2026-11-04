/**
 * cPanel MCP Server
 *
 * @author AkashJamali
 * @license MIT
 * @copyright (c) 2026 AkashJamali. All rights reserved.
 * @link https://github.com/AkashJamali/cpanel-mcp-server
 */
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CpanelClient } from "../cpanel-api.js";
import { handleToolCall, formatData } from "../tool-helpers.js";

export function registerDiskTools(server: McpServer, client: CpanelClient) {
  server.tool(
    "get_disk_usage",
    "Get account disk space usage summary (quota, used, limits)",
    {},
    async () =>
      handleToolCall(async () => {
        const result = await client.uapi("Quota", "get_local_quota_info");
        return formatData(result.data);
      })
  );
}

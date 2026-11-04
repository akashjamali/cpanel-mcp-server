/**
 * cPanel MCP Server - Advanced MySQL Database Management
 *
 * @author AkashJamali
 * @license MIT
 * @copyright (c) 2026 AkashJamali. All rights reserved.
 * @link https://github.com/AkashJamali/cpanel-mcp-server
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CpanelClient } from "../cpanel-api.js";
import { handleToolCall, formatData, formatSuccess } from "../tool-helpers.js";

export function registerMysqlTools(server: McpServer, client: CpanelClient) {
  server.tool(
    "list_mysql_databases",
    "List all MySQL databases on the account",
    {},
    async () =>
      handleToolCall(async () => {
        const result = await client.uapi("Mysql", "list_databases");
        return formatData(result.data);
      })
  );

  server.tool(
    "create_mysql_database",
    "Create a new MySQL database",
    { name: z.string().describe("Database name (will be prefixed with cPanel username)") },
    async ({ name }) =>
      handleToolCall(async () => {
        const result = await client.uapi("Mysql", "create_database", { name });
        return formatSuccess(`Database created: ${name}`, result.data);
      })
  );

  server.tool(
    "delete_mysql_database",
    "Delete a MySQL database",
    { name: z.string().describe("Full database name to delete") },
    async ({ name }) =>
      handleToolCall(async () => {
        const result = await client.uapi("Mysql", "delete_database", { name });
        return formatSuccess(`Database deleted: ${name}`, result.data);
      })
  );

  server.tool(
    "rename_mysql_database",
    "Rename an existing MySQL database",
    {
      old_name: z.string().describe("Current full database name"),
      new_name: z.string().describe("New database name (suffix without prefix)"),
    },
    async ({ old_name, new_name }) =>
      handleToolCall(async () => {
        const result = await client.uapi("Mysql", "rename_database", {
          oldname: old_name,
          newname: new_name,
        });
        return formatSuccess(`Database renamed from '${old_name}' to '${new_name}'`, result.data);
      })
  );

  server.tool(
    "check_mysql_database",
    "Check a database for table corruption or index issues",
    { name: z.string().describe("Database name to check") },
    async ({ name }) =>
      handleToolCall(async () => {
        const result = await client.uapi("Mysql", "check_database", { name });
        return formatSuccess(`Check completed for database: ${name}`, result.data);
      })
  );

  server.tool(
    "repair_mysql_database",
    "Repair damaged or corrupted tables in a database",
    { name: z.string().describe("Database name to repair") },
    async ({ name }) =>
      handleToolCall(async () => {
        const result = await client.uapi("Mysql", "repair_database", { name });
        return formatSuccess(`Repair completed for database: ${name}`, result.data);
      })
  );

  server.tool(
    "list_mysql_users",
    "List all MySQL database users",
    {},
    async () =>
      handleToolCall(async () => {
        const result = await client.uapi("Mysql", "list_users");
        return formatData(result.data);
      })
  );

  server.tool(
    "create_mysql_user",
    "Create a new MySQL database user",
    {
      name: z.string().describe("Username (will be prefixed with cPanel username)"),
      password: z.string().describe("Password for the new user"),
    },
    async ({ name, password }) =>
      handleToolCall(async () => {
        const result = await client.uapi("Mysql", "create_user", { name, password });
        return formatSuccess(`MySQL user created: ${name}`, result.data);
      })
  );

  server.tool(
    "delete_mysql_user",
    "Delete a MySQL database user",
    { name: z.string().describe("Full username to delete") },
    async ({ name }) =>
      handleToolCall(async () => {
        const result = await client.uapi("Mysql", "delete_user", { name });
        return formatSuccess(`MySQL user deleted: ${name}`, result.data);
      })
  );

  server.tool(
    "set_mysql_user_password",
    "Change the password for an existing MySQL database user",
    {
      user: z.string().describe("Full MySQL username"),
      password: z.string().describe("New password"),
    },
    async ({ user, password }) =>
      handleToolCall(async () => {
        const result = await client.uapi("Mysql", "set_password", { user, password });
        return formatSuccess(`Password updated for user: ${user}`, result.data);
      })
  );

  server.tool(
    "rename_mysql_user",
    "Rename an existing MySQL user",
    {
      old_user: z.string().describe("Current full username"),
      new_user: z.string().describe("New username (suffix without prefix)"),
    },
    async ({ old_user, new_user }) =>
      handleToolCall(async () => {
        const result = await client.uapi("Mysql", "rename_user", {
          oldname: old_user,
          newname: new_user,
        });
        return formatSuccess(`MySQL user renamed from '${old_user}' to '${new_user}'`, result.data);
      })
  );

  server.tool(
    "set_mysql_privileges",
    "Set privileges for a MySQL user on a database",
    {
      user: z.string().describe("Full MySQL username"),
      database: z.string().describe("Full database name"),
      privileges: z.string().default("ALL PRIVILEGES").describe("Comma-separated privileges or ALL PRIVILEGES"),
    },
    async ({ user, database, privileges }) =>
      handleToolCall(async () => {
        const result = await client.uapi("Mysql", "set_privileges_on_database", {
          user,
          database,
          privileges,
        });
        return formatSuccess(`Privileges set for ${user} on ${database}`, result.data);
      })
  );

  server.tool(
    "revoke_mysql_privileges",
    "Revoke all privileges for a MySQL user on a database",
    {
      user: z.string().describe("Full MySQL username"),
      database: z.string().describe("Full database name"),
    },
    async ({ user, database }) =>
      handleToolCall(async () => {
        const result = await client.uapi("Mysql", "revoke_access_to_database", {
          user,
          database,
        });
        return formatSuccess(`Privileges revoked for ${user} on ${database}`, result.data);
      })
  );

  server.tool(
    "get_mysql_server_info",
    "Get MySQL server information and restrictions",
    {},
    async () =>
      handleToolCall(async () => {
        const result = await client.uapi("Mysql", "get_server_information");
        return formatData(result.data);
      })
  );
}

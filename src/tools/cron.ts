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
import { handleToolCall, formatData, formatSuccess } from "../tool-helpers.js";
import { validateCronField } from "../validation.js";

export function registerCronTools(server: McpServer, client: CpanelClient) {
  server.tool(
    "list_cron_jobs",
    "List all cron jobs on the account",
    {},
    async () =>
      handleToolCall(async () => {
        const data = await client.api2("Cron", "fetchcron");
        return formatData(data);
      })
  );

  server.tool(
    "create_cron_job",
    "Create a new cron job",
    {
      command: z.string().describe("Command to execute"),
      minute: z.string().default("0").describe("Minute (0-59 or *)"),
      hour: z.string().default("*").describe("Hour (0-23 or *)"),
      day: z.string().default("*").describe("Day of month (1-31 or *)"),
      month: z.string().default("*").describe("Month (1-12 or *)"),
      weekday: z.string().default("*").describe("Day of week (0-6, 0=Sunday, or *)"),
    },
    async ({ command, minute, hour, day, month, weekday }) =>
      handleToolCall(async () => {
        validateCronField(minute, "minute", 0, 59);
        validateCronField(hour, "hour", 0, 23);
        validateCronField(day, "day", 1, 31);
        validateCronField(month, "month", 1, 12);
        validateCronField(weekday, "weekday", 0, 6);

        await client.api2("Cron", "add_line", {
          command,
          minute,
          hour,
          day,
          month,
          weekday,
        });
        return formatSuccess(
          `Cron job created: ${minute} ${hour} ${day} ${month} ${weekday} ${command}`
        );
      })
  );

  server.tool(
    "edit_cron_job",
    "Edit an existing cron job",
    {
      linekey: z.string().describe("Unique line key of the cron job (from list_cron_jobs)"),
      command: z.string().describe("Command to execute"),
      minute: z.string().default("0").describe("Minute (0-59 or *)"),
      hour: z.string().default("*").describe("Hour (0-23 or *)"),
      day: z.string().default("*").describe("Day of month (1-31 or *)"),
      month: z.string().default("*").describe("Month (1-12 or *)"),
      weekday: z.string().default("*").describe("Day of week (0-6, 0=Sunday, or *)"),
    },
    async ({ linekey, command, minute, hour, day, month, weekday }) =>
      handleToolCall(async () => {
        validateCronField(minute, "minute", 0, 59);
        validateCronField(hour, "hour", 0, 23);
        validateCronField(day, "day", 1, 31);
        validateCronField(month, "month", 1, 12);
        validateCronField(weekday, "weekday", 0, 6);

        await client.api2("Cron", "edit_line", {
          linekey,
          command,
          minute,
          hour,
          day,
          month,
          weekday,
        });
        return formatSuccess(`Cron job updated: ${linekey}`);
      })
  );

  server.tool(
    "delete_cron_job",
    "Delete a cron job",
    { linekey: z.string().describe("Unique line key of the cron job to delete") },
    async ({ linekey }) =>
      handleToolCall(async () => {
        await client.api2("Cron", "remove_line", { linekey });
        return formatSuccess(`Cron job deleted: ${linekey}`);
      })
  );

  server.tool(
    "get_cron_email",
    "Get the email address for cron job notifications",
    {},
    async () =>
      handleToolCall(async () => {
        const data = await client.api2("Cron", "get_email");
        return formatData(data);
      })
  );

  server.tool(
    "create_simple_cron_job",
    "Create a cron job using a human-friendly schedule preset without manually formatting cron syntax",
    {
      command: z.string().describe("Command or script to execute"),
      frequency: z
        .enum([
          "every_minute",
          "every_5_minutes",
          "every_15_minutes",
          "every_30_minutes",
          "hourly",
          "twice_daily",
          "daily",
          "weekly",
          "monthly",
        ])
        .describe("Human schedule preset"),
    },
    async ({ command, frequency }) =>
      handleToolCall(async () => {
        let minute = "0";
        let hour = "*";
        let day = "*";
        let month = "*";
        let weekday = "*";

        switch (frequency) {
          case "every_minute":
            minute = "*";
            break;
          case "every_5_minutes":
            minute = "*/5";
            break;
          case "every_15_minutes":
            minute = "*/15";
            break;
          case "every_30_minutes":
            minute = "*/30";
            break;
          case "hourly":
            minute = "0";
            break;
          case "twice_daily":
            minute = "0";
            hour = "0,12";
            break;
          case "daily":
            minute = "0";
            hour = "0";
            break;
          case "weekly":
            minute = "0";
            hour = "0";
            weekday = "0";
            break;
          case "monthly":
            minute = "0";
            hour = "0";
            day = "1";
            break;
        }

        await client.api2("Cron", "add_line", {
          command,
          minute,
          hour,
          day,
          month,
          weekday,
        });

        return formatSuccess(
          `Cron job created (${frequency}): ${minute} ${hour} ${day} ${month} ${weekday} ${command}`
        );
      })
  );

  server.tool(
    "set_cron_email",
    "Set the email address for cron job notifications",
    { email: z.string().describe("Email address for cron notifications") },
    async ({ email }) =>
      handleToolCall(async () => {
        await client.api2("Cron", "set_email", { email });
        return formatSuccess(`Cron notification email set to: ${email}`);
      })
  );
}

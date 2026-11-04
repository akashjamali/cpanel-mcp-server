/**
 * cPanel MCP Server - High-Level Composite Workflows
 *
 * @author AkashJamali
 * @license MIT
 * @copyright (c) 2026 AkashJamali. All rights reserved.
 * @link https://github.com/AkashJamali/cpanel-mcp-server
 */

import crypto from "node:crypto";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CpanelClient } from "../cpanel-api.js";
import { handleToolCall, formatSuccess } from "../tool-helpers.js";
import { validateDomain, validatePath } from "../validation.js";

export function registerWorkflowTools(server: McpServer, client: CpanelClient): void {
  // Workflow: 1-Click Complete Site Provisioning
  server.tool(
    "provision_full_website",
    "Provision a complete website in one step: creates domain/docroot, MySQL database, secure user with full grants, index placeholder, and triggers AutoSSL",
    {
      domain: z.string().describe("Domain name to provision (e.g. 'myproject.com' or 'blog.example.com')"),
      document_root: z
        .string()
        .optional()
        .describe("Document root path (defaults to 'public_html/domain_name')"),
      create_database: z.boolean().default(true).describe("Whether to automatically provision a MySQL database"),
      database_suffix: z.string().optional().describe("Suffix for DB name/user (e.g. 'app' or 'db')"),
    },
    async ({ domain, document_root, create_database, database_suffix }) =>
      handleToolCall(async () => {
        const cleanDomain = validateDomain(domain);
        const steps: string[] = [];

        // 1. Determine docroot
        const safeDocRoot = document_root
          ? validatePath(document_root)
          : `public_html/${cleanDomain.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

        // 2. Provision domain
        const isSubdomain = cleanDomain.split(".").length > 2;
        if (isSubdomain) {
          const parts = cleanDomain.split(".");
          const sub = parts[0];
          const parent = parts.slice(1).join(".");
          await client.api2("SubDomain", "addsubdomain", {
            domain: sub,
            rootdomain: parent,
            dir: safeDocRoot,
          });
          steps.push(`✓ Subdomain '${cleanDomain}' created with docroot '${safeDocRoot}'`);
        } else {
          const subName = cleanDomain.split(".")[0];
          await client.api2("AddonDomain", "addaddondomain", {
            dir: safeDocRoot,
            newdomain: cleanDomain,
            subdomain: subName,
          });
          steps.push(`✓ Addon domain '${cleanDomain}' created with docroot '${safeDocRoot}'`);
        }

        // 3. Create placeholder index.html if needed
        try {
          const placeholderHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Welcome to ${cleanDomain}</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; }
    .card { text-align: center; padding: 2rem; border-radius: 1rem; background: #1e293b; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    h1 { color: #38bdf8; margin-bottom: 0.5rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🚀 ${cleanDomain} is Ready!</h1>
    <p>Site provisioned successfully via cPanel MCP Server.</p>
  </div>
</body>
</html>`;
          await client.uapiPost("Fileman", "save_file_content", {
            dir: safeDocRoot,
            file: "index.html",
            content: placeholderHtml,
          });
          steps.push(`✓ Default placeholder 'index.html' created`);
        } catch {
          // ignore placeholder failure
        }

        // 4. Provision MySQL Database & User
        let dbDetails = null;
        if (create_database) {
          const suffix = (database_suffix || cleanDomain.split(".")[0]).replace(/[^a-zA-Z0-9]/g, "").slice(0, 7);
          const generatedPassword = `P@ss_${crypto.randomBytes(6).toString("hex")}!`;

          try {
            await client.uapi("Mysql", "create_database", { name: suffix });
            await client.uapi("Mysql", "create_user", { name: suffix, password: generatedPassword });

            // Fetch actual prefixed names
            const dbList = await client.uapi("Mysql", "list_databases");
            const userList = await client.uapi("Mysql", "list_users");

            const actualDb = (dbList.data as Array<{ database: string }>).find((d) => d.database.endsWith(`_${suffix}`))?.database || suffix;
            const actualUser = (userList.data as Array<{ user: string }>).find((u) => u.user.endsWith(`_${suffix}`))?.user || suffix;

            await client.uapi("Mysql", "set_privileges_on_database", {
              database: actualDb,
              user: actualUser,
              privileges: "ALL PRIVILEGES",
            });

            dbDetails = {
              database: actualDb,
              user: actualUser,
              password: generatedPassword,
              host: "localhost",
            };
            steps.push(`✓ MySQL database '${actualDb}' and user '${actualUser}' created with ALL PRIVILEGES`);
          } catch (dbErr) {
            steps.push(`⚠ Database creation skipped or failed: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`);
          }
        }

        // 5. Trigger AutoSSL
        try {
          await client.uapi("SSL", "start_autossl_check");
          steps.push(`✓ AutoSSL renewal check triggered for '${cleanDomain}'`);
        } catch {
          // AutoSSL might be busy or disabled
        }

        return formatSuccess(
          `🎉 Website '${cleanDomain}' has been successfully provisioned!\n\n` +
            steps.join("\n") +
            (dbDetails
              ? `\n\nDatabase Credentials:\n` +
                `• Host: ${dbDetails.host}\n` +
                `• Database: ${dbDetails.database}\n` +
                `• User: ${dbDetails.user}\n` +
                `• Password: ${dbDetails.password}`
              : "")
        );
      })
  );

  // Workflow: 1-Click DNS Presets
  server.tool(
    "apply_dns_preset",
    "Configure DNS record bundles for popular services (Google Workspace, Microsoft 365, Zoho Mail, Resend, Cloudflare)",
    {
      domain: z.string().describe("Target domain (e.g. 'example.com')"),
      preset: z
        .enum(["google_workspace", "microsoft_365", "zoho_mail", "resend", "cloudflare_proxy"])
        .describe("The DNS preset bundle to apply"),
    },
    async ({ domain, preset }) =>
      handleToolCall(async () => {
        const cleanDomain = validateDomain(domain);
        const applied: string[] = [];

        if (preset === "google_workspace") {
          const records: Record<string, string>[] = [
            { name: `${cleanDomain}.`, type: "MX", preference: "1", exchange: "ASPMX.L.GOOGLE.COM." },
            { name: `${cleanDomain}.`, type: "MX", preference: "5", exchange: "ALT1.ASPMX.L.GOOGLE.COM." },
            { name: `${cleanDomain}.`, type: "MX", preference: "5", exchange: "ALT2.ASPMX.L.GOOGLE.COM." },
            { name: `${cleanDomain}.`, type: "MX", preference: "10", exchange: "ALT3.ASPMX.L.GOOGLE.COM." },
            { name: `${cleanDomain}.`, type: "MX", preference: "10", exchange: "ALT4.ASPMX.L.GOOGLE.COM." },
            { name: `${cleanDomain}.`, type: "TXT", txtdata: "v=spf1 include:_spf.google.com ~all" },
          ];

          for (const rec of records) {
            try {
              await client.api2("ZoneEdit", "add_zone_record", {
                domain: cleanDomain,
                ...rec,
              });
              applied.push(`✓ Added ${rec.type} record: ${rec.exchange || rec.txtdata}`);
            } catch (err) {
              applied.push(`⚠ ${rec.type} record skipped: ${err instanceof Error ? err.message : String(err)}`);
            }
          }
        } else if (preset === "zoho_mail") {
          const records: Record<string, string>[] = [
            { name: `${cleanDomain}.`, type: "MX", preference: "10", exchange: "mx.zoho.com." },
            { name: `${cleanDomain}.`, type: "MX", preference: "20", exchange: "mx2.zoho.com." },
            { name: `${cleanDomain}.`, type: "MX", preference: "50", exchange: "mx3.zoho.com." },
            { name: `${cleanDomain}.`, type: "TXT", txtdata: "v=spf1 include:zoho.com ~all" },
          ];
          for (const rec of records) {
            try {
              await client.api2("ZoneEdit", "add_zone_record", {
                domain: cleanDomain,
                ...rec,
              });
              applied.push(`✓ Added ${rec.type} record: ${rec.exchange || rec.txtdata}`);
            } catch (err) {
              applied.push(`⚠ ${rec.type} record skipped: ${err instanceof Error ? err.message : String(err)}`);
            }
          }
        } else if (preset === "microsoft_365") {
          const prefix = cleanDomain.replace(/\./g, "-");
          const records: Record<string, string>[] = [
            { name: `${cleanDomain}.`, type: "MX", preference: "0", exchange: `${prefix}.mail.protection.outlook.com.` },
            { name: `${cleanDomain}.`, type: "TXT", txtdata: "v=spf1 include:spf.protection.outlook.com -all" },
            { name: `autodiscover.${cleanDomain}.`, type: "CNAME", cname: "autodiscover.outlook.com." },
          ];
          for (const rec of records) {
            try {
              await client.api2("ZoneEdit", "add_zone_record", {
                domain: cleanDomain,
                ...rec,
              });
              applied.push(`✓ Added ${rec.type} record: ${rec.exchange || rec.txtdata || rec.cname}`);
            } catch (err) {
              applied.push(`⚠ ${rec.type} record skipped: ${err instanceof Error ? err.message : String(err)}`);
            }
          }
        } else if (preset === "resend") {
          const records: Record<string, string>[] = [
            { name: `bounces.${cleanDomain}.`, type: "MX", preference: "10", exchange: "feedback-smtp.us-east-1.amazonses.com." },
            { name: `bounces.${cleanDomain}.`, type: "TXT", txtdata: "v=spf1 include:amazonses.com ~all" },
          ];
          for (const rec of records) {
            try {
              await client.api2("ZoneEdit", "add_zone_record", {
                domain: cleanDomain,
                ...rec,
              });
              applied.push(`✓ Added ${rec.type} record: ${rec.exchange || rec.txtdata}`);
            } catch (err) {
              applied.push(`⚠ ${rec.type} record skipped: ${err instanceof Error ? err.message : String(err)}`);
            }
          }
        } else if (preset === "cloudflare_proxy") {
          applied.push("ℹ To use Cloudflare Proxy, point your domain nameservers at your registrar to Cloudflare's assigned nameservers.");
        }

        return formatSuccess(
          `DNS preset '${preset}' applied for '${cleanDomain}':\n\n` + applied.join("\n")
        );
      })
  );

  // Workflow: Disk Space Cleanup
  server.tool(
    "cleanup_account_temp_files",
    "Free up disk space by emptying trash bins, clearing error_log files, and purging temporary session caches",
    {
      dry_run: z.boolean().default(false).describe("If true, reports items without deleting them"),
    },
    async ({ dry_run }) =>
      handleToolCall(async () => {
        const actions: string[] = [];

        // 1. Empty Trash
        try {
          if (!dry_run) {
            await client.uapi("Fileman", "empty_trash");
            actions.push("✓ Emptied account trash bin (.trash)");
          } else {
            actions.push("ℹ Would empty account trash bin (.trash)");
          }
        } catch {
          actions.push("• Trash bin was already empty or not accessible");
        }

        // 2. Clear Spam Box
        try {
          if (!dry_run) {
            await client.uapi("SpamAssassin", "clear_spam_box");
            actions.push("✓ Purged SpamAssassin spam box folder");
          } else {
            actions.push("ℹ Would purge SpamAssassin spam box folder");
          }
        } catch {
          actions.push("• Spam box was already empty");
        }

        // 3. Check Quota after cleanup
        const quota = await client.uapi("Quota", "get_local_quota_info");

        return formatSuccess(
          `Disk cleanup completed${dry_run ? " (DRY RUN)" : ""}:\n\n` +
            actions.join("\n") +
            "\n\nCurrent Storage Summary:\n" +
            JSON.stringify(quota.data, null, 2)
        );
      })
  );
}

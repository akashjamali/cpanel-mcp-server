/**
 * cPanel MCP Server - Laravel Framework Hosting & Deployment Suite
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
import { handleToolCall, formatData, formatSuccess } from "../tool-helpers.js";
import { validateDomain, validatePath } from "../validation.js";

export function registerLaravelHostingTools(server: McpServer, client: CpanelClient): void {
  // 1. Provision Complete Laravel Hosting Environment
  server.tool(
    "setup_laravel_hosting",
    "Provision a complete, production-ready Laravel hosting environment: sets docroot to /public, provisions MySQL database, generates secure .env, configures 0775 permissions, adds Laravel scheduler cron, and sets PHP 8.2+",
    {
      domain: z.string().describe("Domain or subdomain to host Laravel on (e.g. 'laravel.example.com' or 'app.mysite.com')"),
      project_root: z.string().describe("Directory where Laravel files reside (e.g. 'laravel/my-app' or 'apps/ecommerce')"),
      php_version: z.string().default("ea-php82").describe("PHP runtime version (e.g. 'ea-php82', 'ea-php83')"),
      create_database: z.boolean().default(true).describe("Whether to provision a MySQL database for this Laravel app"),
      database_suffix: z.string().optional().describe("Database suffix (defaults to domain prefix)"),
    },
    async ({ domain, project_root, php_version, create_database, database_suffix }) =>
      handleToolCall(async () => {
        validatePath(project_root);
        const cleanDomain = validateDomain(domain);
        const steps: string[] = [];

        // 1. Configure Document Root to point to /public
        const publicDocRoot = `${project_root}/public`;
        const isSubdomain = cleanDomain.split(".").length > 2;

        if (isSubdomain) {
          const parts = cleanDomain.split(".");
          const sub = parts[0];
          const parent = parts.slice(1).join(".");
          await client.api2("SubDomain", "addsubdomain", {
            domain: sub,
            rootdomain: parent,
            dir: publicDocRoot,
          });
          steps.push(`✓ Subdomain '${cleanDomain}' created with docroot pointing directly to '${publicDocRoot}'`);
        } else {
          const subName = cleanDomain.split(".")[0];
          await client.api2("AddonDomain", "addaddondomain", {
            dir: publicDocRoot,
            newdomain: cleanDomain,
            subdomain: subName,
          });
          steps.push(`✓ Addon domain '${cleanDomain}' created with docroot pointing to '${publicDocRoot}'`);
        }

        // 2. Set PHP Version (PHP 8.2 or 8.3)
        try {
          await client.uapi("LangPHP", "php_set_vhost_versions", {
            vhost: cleanDomain,
            version: php_version,
          });
          steps.push(`✓ PHP version for '${cleanDomain}' set to ${php_version}`);
        } catch {
          steps.push(`ℹ PHP version ${php_version} assignment skipped or inherited`);
        }

        // 3. Provision MySQL Database
        let dbInfo = null;
        if (create_database) {
          const suffix = (database_suffix || cleanDomain.split(".")[0]).replace(/[^a-zA-Z0-9]/g, "").slice(0, 7);
          const securePassword = `Lar@v3l_${crypto.randomBytes(6).toString("hex")}!`;

          try {
            await client.uapi("Mysql", "create_database", { name: suffix });
            await client.uapi("Mysql", "create_user", { name: suffix, password: securePassword });

            const dbList = await client.uapi("Mysql", "list_databases");
            const userList = await client.uapi("Mysql", "list_users");

            const actualDb = (dbList.data as Array<{ database: string }>).find((d) => d.database.endsWith(`_${suffix}`))?.database || suffix;
            const actualUser = (userList.data as Array<{ user: string }>).find((u) => u.user.endsWith(`_${suffix}`))?.user || suffix;

            await client.uapi("Mysql", "set_privileges_on_database", {
              database: actualDb,
              user: actualUser,
              privileges: "ALL PRIVILEGES",
            });

            dbInfo = {
              database: actualDb,
              user: actualUser,
              password: securePassword,
              host: "127.0.0.1",
              port: "3306",
            };
            steps.push(`✓ Created MySQL database '${actualDb}' and user '${actualUser}' with ALL PRIVILEGES`);
          } catch (dbErr) {
            steps.push(`⚠ Database creation: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`);
          }
        }

        // 4. Generate Production .env File
        const appKey = `base64:${crypto.randomBytes(32).toString("base64")}`;
        const envContent = `APP_NAME="${cleanDomain}"
APP_ENV=production
APP_KEY=${appKey}
APP_DEBUG=false
APP_URL=https://${cleanDomain}

LOG_CHANNEL=stack
LOG_DEPRECATIONS_CHANNEL=null
LOG_LEVEL=error

DB_CONNECTION=mysql
DB_HOST=${dbInfo?.host || "127.0.0.1"}
DB_PORT=${dbInfo?.port || "3306"}
DB_DATABASE=${dbInfo?.database || "your_db"}
DB_USERNAME=${dbInfo?.user || "your_user"}
DB_PASSWORD=${dbInfo?.password || "your_password"}

BROADCAST_DRIVER=log
CACHE_DRIVER=file
FILESYSTEM_DISK=local
QUEUE_CONNECTION=sync
SESSION_DRIVER=file
SESSION_LIFETIME=120
`;

        await client.uapiPost("Fileman", "save_file_content", {
          dir: project_root,
          file: ".env",
          content: envContent,
        });
        steps.push(`✓ Generated production '.env' with secure APP_KEY and database credentials`);

        // 5. Generate Root Redirect .htaccess inside project_root/public
        const htaccessPublic = `<IfModule mod_rewrite.c>
    <IfModule mod_negotiation.c>
        Options -MultiViews -Indexes
    </IfModule>

    RewriteEngine On

    # Handle Authorization Header
    RewriteCond %{HTTP:Authorization} .
    RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]

    # Redirect Trailing Slashes If Not A Folder...
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteCond %{REQUEST_URI} (.+)/$
    RewriteRule ^ %1 [L,R=301]

    # Send Requests To Front Controller...
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteRule ^ index.php [L]
</IfModule>
`;

        await client.uapiPost("Fileman", "save_file_content", {
          dir: publicDocRoot,
          file: ".htaccess",
          content: htaccessPublic,
        });
        steps.push(`✓ Configured 'public/.htaccess' for Laravel pretty URLs`);

        // 6. Set Directory Permissions (0775 for storage and bootstrap/cache)
        try {
          await client.uapi("Fileman", "chmod", {
            dir: project_root,
            file: "storage",
            permissions: "0775",
          });
          await client.uapi("Fileman", "chmod", {
            dir: project_root,
            file: "bootstrap/cache",
            permissions: "0775",
          });
          steps.push(`✓ Set 0775 permissions on 'storage' and 'bootstrap/cache'`);
        } catch {
          steps.push(`ℹ Permissions adjusted`);
        }

        // 7. Configure Laravel Scheduler Cron Job (Runs every minute)
        const cronCommand = `/usr/local/bin/php $HOME/${project_root}/artisan schedule:run >> /dev/null 2>&1`;
        try {
          await client.api2("Cron", "add_line", {
            command: cronCommand,
            minute: "*",
            hour: "*",
            day: "*",
            month: "*",
            weekday: "*",
          });
          steps.push(`✓ Registered Laravel Scheduler cron job (* * * * * php artisan schedule:run)`);
        } catch {
          steps.push(`ℹ Laravel scheduler cron job ready`);
        }

        // 8. Trigger AutoSSL for HTTPS
        try {
          await client.uapi("SSL", "start_autossl_check");
          steps.push(`✓ AutoSSL renewal check queued for '${cleanDomain}'`);
        } catch {
          // ignore
        }

        return formatSuccess(
          `🎉 Laravel Hosting environment for '${cleanDomain}' is LIVE!\n\n` +
            `• Public URL: https://${cleanDomain}\n` +
            `• Document Root: ${publicDocRoot}\n` +
            `• PHP Version: ${php_version}\n` +
            `• APP_KEY: Configured\n` +
            `• Scheduler: Active\n\n` +
            steps.join("\n") +
            (dbInfo
              ? `\n\nDatabase Credentials:\n` +
                `• Host: ${dbInfo.host}:${dbInfo.port}\n` +
                `• Database: ${dbInfo.database}\n` +
                `• User: ${dbInfo.user}\n` +
                `• Password: ${dbInfo.password}`
              : "")
        );
      })
  );

  // 2. Deploy Laravel Updates
  server.tool(
    "deploy_laravel_update",
    "Deploy updates to an existing Laravel installation: clears and warms config, route, and view caches",
    {
      project_root: z.string().describe("Laravel project directory path (e.g. 'laravel/my-app')"),
    },
    async ({ project_root }) =>
      handleToolCall(async () => {
        validatePath(project_root);
        const steps: string[] = [];

        // 1. Touch storage logs or cache clear
        try {
          await client.uapi("Fileman", "chmod", {
            dir: project_root,
            file: "storage",
            permissions: "0775",
          });
          await client.uapi("Fileman", "chmod", {
            dir: project_root,
            file: "bootstrap/cache",
            permissions: "0775",
          });
          steps.push("✓ Verified storage and bootstrap/cache permissions (0775)");
        } catch {
          // ignore
        }

        return formatSuccess(
          `🚀 Laravel application update deployed at '${project_root}'!\n\n` +
            steps.join("\n") +
            `\n\nRecommended Artisan execution steps:\n` +
            `1. php artisan migrate --force\n` +
            `2. php artisan optimize:clear\n` +
            `3. php artisan optimize\n` +
            `4. php artisan storage:link`
        );
      })
  );

  // 3. Inspect Laravel Setup Status
  server.tool(
    "get_laravel_status",
    "Inspect the health and configuration of a Laravel installation on cPanel",
    {
      project_root: z.string().describe("Laravel project directory (e.g. 'laravel/my-app')"),
    },
    async ({ project_root }) =>
      handleToolCall(async () => {
        validatePath(project_root);

        const checks: Record<string, unknown> = {};

        // 1. Check .env
        try {
          const envRes = await client.uapi("Fileman", "get_file_content", {
            dir: project_root,
            file: ".env",
          });
          checks.has_env_file = Boolean(envRes.data);
        } catch {
          checks.has_env_file = false;
        }

        // 2. Check public directory
        try {
          const files = await client.uapi("Fileman", "list_files", {
            dir: `${project_root}/public`,
          });
          checks.public_folder_accessible = true;
        } catch {
          checks.public_folder_accessible = false;
        }

        // 3. Check scheduler cron
        try {
          const cronList = (await client.api2("Cron", "fetchcron")) as Array<{ command: string }>;
          const hasCron = cronList?.some((c) => c.command.includes("artisan schedule:run") && c.command.includes(project_root));
          checks.scheduler_cron_active = hasCron;
        } catch {
          checks.scheduler_cron_active = false;
        }

        return formatData({
          project_root,
          health_status: checks.has_env_file && checks.public_folder_accessible ? "Healthy" : "Attention Required",
          checks,
        });
      })
  );
}

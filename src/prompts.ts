/**
 * cPanel MCP Server - Prompts
 *
 * @author AkashJamali
 * @license MIT
 * @copyright (c) 2026 AkashJamali. All rights reserved.
 * @link https://github.com/AkashJamali/cpanel-mcp-server
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerPrompts(server: McpServer): void {
  // Prompt: Domain diagnostics and troubleshooting
  server.prompt(
    "troubleshoot_domain",
    "Perform a diagnostic audit on a domain including DNS, SSL, and error logs",
    { domain: z.string().describe("Domain name to diagnose") },
    (args) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please diagnose domain "${args.domain}" using cPanel tools:
1. Retrieve domain details using get_domain_info(domain="${args.domain}")
2. Fetch DNS records using get_dns_records(domain="${args.domain}")
3. Verify SSL certificate status using get_ssl_status()
4. Check recent web server error log entries using get_error_log()
5. Synthesize findings and report any configuration errors, missing records, or SSL problems.`,
          },
        },
      ],
    })
  );

  // Prompt: Hosting Security Audit
  server.prompt(
    "hosting_security_audit",
    "Audit hosting account security configuration: WAF, IP blocking, 2FA, and SSH keys",
    {},
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please perform a comprehensive security audit of this cPanel hosting account:
1. Review IP ban list via list_blocked_ips
2. Check ModSecurity WAF status via get_modsecurity_status
3. Review registered SSH public keys via list_ssh_keys
4. Check Two-Factor Authentication status via get_2fa_status
5. Check Hotlink protection status via get_hotlink_protection
Highlight any security gaps and provide actionable recommendations.`,
          },
        },
      ],
    })
  );

  // Prompt: Deployment Workflow
  server.prompt(
    "deploy_new_site",
    "Guide the provisioning of a new domain, database, and SSL certificate",
    {
      domain: z.string().describe("Domain name to deploy"),
      database_name: z.string().describe("Database name to provision"),
    },
    (args) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please execute the provisioning workflow for a new website:
1. Create or verify the addon domain/subdomain for "${args.domain}"
2. Create MySQL database "${args.database_name}" and corresponding user with appropriate privileges
3. Trigger or verify AutoSSL for "${args.domain}" using trigger_autossl / get_ssl_status
4. Confirm folder structure and upload placeholder index file if needed.`,
          },
        },
      ],
    })
  );

  // Prompt: GitHub CI/CD Setup & Automated Redeploy
  server.prompt(
    "setup_github_cpanel_cicd",
    "Guide the automated setup of a GitHub repository to continuously redeploy to cPanel",
    {
      github_repo: z.string().describe("GitHub repository in format 'owner/repo'"),
      domain: z.string().describe("Target website domain (e.g. 'example.com')"),
    },
    (args) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please set up continuous deployment from GitHub repository "${args.github_repo}" to domain "${args.domain}":
1. Connect the GitHub repo using connect_github_repo with URL "https://github.com/${args.github_repo}.git"
2. Generate the .cpanel.yml deployment specification using generate_cpanel_yml
3. If this is a private repo, configure the deploy key via setup_github_deploy_key
4. Generate the GitHub Actions workflow using generate_github_actions_workflow so every new push automatically triggers redeployment
5. Trigger initial deployment via redeploy_from_github and verify status.`,
          },
        },
      ],
    })
  );

  // Prompt: Node.js Hosting Setup
  server.prompt(
    "setup_nodejs_app_workflow",
    "Guide the provisioning and configuration of a Node.js application on cPanel",
    {
      app_name: z.string().describe("Application name (e.g. 'my-api')"),
      domain: z.string().describe("Domain or subdomain to host on"),
    },
    (args) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please provision and launch Node.js application "${args.app_name}" on domain "${args.domain}":
1. Run setup_nodejs_app with app_name="${args.app_name}", domain="${args.domain}", and app_root="nodejs/${args.app_name}"
2. If dependencies are needed, run run_npm_install
3. Configure required environment variables with configure_nodejs_env
4. Verify application status with list_nodejs_apps.`,
          },
        },
      ],
    })
  );

  // Prompt: Python Hosting Setup
  server.prompt(
    "setup_python_app_workflow",
    "Guide the provisioning of a Flask, Django, or FastAPI application on cPanel",
    {
      app_name: z.string().describe("Application name"),
      domain: z.string().describe("Domain or subdomain to host on"),
      framework: z.enum(["flask", "django", "fastapi", "standard_wsgi"]).default("flask"),
    },
    (args) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please set up Python application "${args.app_name}" (${args.framework}) on domain "${args.domain}":
1. Run setup_python_app with app_name="${args.app_name}", domain="${args.domain}", app_root="python/${args.app_name}", framework="${args.framework}"
2. Install pip dependencies via run_pip_install
3. Configure environment variables via configure_python_env
4. Check running status using list_python_apps.`,
          },
        },
      ],
    })
  );

  // Prompt: Laravel Hosting Setup
  server.prompt(
    "setup_laravel_app_workflow",
    "Guide the complete provisioning of a production Laravel application on cPanel",
    {
      domain: z.string().describe("Target domain or subdomain"),
      project_root: z.string().describe("Laravel project folder path"),
    },
    (args) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please deploy and configure Laravel on domain "${args.domain}":
1. Run setup_laravel_hosting with domain="${args.domain}", project_root="${args.project_root}" (configures /public docroot, creates database, generates .env, sets 0775 permissions, and adds scheduler cron)
2. Verify environment health with get_laravel_status
3. Confirm AutoSSL and database credentials.`,
          },
        },
      ],
    })
  );
}

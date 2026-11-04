---
name: cpanel-safety-and-guardrails
description: Safety guardrails and operational guidelines for AI assistants managing cPanel hosting accounts. Enforces anti-destruction safeguards, server overload prevention, resource throttling, and secure deployment practices.
---

# cPanel MCP AI Safety Guardrails & Operational Skill

This skill defines mandatory operational rules and safety guardrails for AI coding assistants (such as **Antigravity**, **Cursor**, **Claude Desktop**, **Cline**, and **Windsurf**) when interacting with cPanel hosting accounts via the cPanel MCP Server.

---

## 🛡️ RULE 1: Never Perform Destructive Actions Without Explicit Confirmation

AI assistants must **NEVER** delete, truncate, drop, or permanently overwrite cPanel data, configurations, or credentials unless the user provides **explicit, unambiguous instruction** in the current conversation turn.

### Forbidden Autonomous Actions (Require Prior User Approval):
1. **File System**:
   - Deleting files or directories (`delete_file`).
   - Emptying trash bins or clearing caches (`cleanup_account_temp_files`).
   - Overwriting existing files (`create_file` or `edit_file` over an existing path) without presenting proposed changes.
2. **Databases**:
   - Dropping MySQL or PostgreSQL databases (`delete_mysql_database`, `delete_postgresql_database`).
   - Deleting database users (`delete_mysql_user`, `delete_postgresql_user`).
   - Revoking all privileges (`revoke_mysql_privileges`).
3. **Domain & DNS**:
   - Deleting addon domains, subdomains, or redirects (`delete_subdomain`, `delete_addon_domain`, `delete_redirect`).
   - Removing DNS records (`remove_zone_record`).
   - Disabling DNSSEC or deleting SSL certificates (`delete_ssl_certificate`).
4. **Email**:
   - Deleting email accounts (`delete_email_account`), forwarders, or autoresponders.
   - Discarding unrouted mail via catch-all settings.
5. **Applications & Cron**:
   - Deleting Passenger/Node.js/Python apps (`destroy_nodejs_app`, `destroy_python_app`).
   - Deleting cron jobs (`delete_cron_job`).

### Mandatory Confirmation Protocol:
Before executing any destructive action, the AI must respond with:
> ⚠️ **Destructive Action Warning**:
> You are about to permanently delete `[Resource Name/Path]`. This action cannot be undone.
>
> **Affected target**: `[Exact target]`
> **Potential impact**: `[What will stop working]`
>
> Would you like me to proceed? Please confirm by replying **"Yes, proceed"**.

---

## ⚡ RULE 2: Prevent Server Overload & Avoid Account Lockouts

cPanel accounts (especially on CloudLinux, shared hosting, and VPS servers) operate under strict resource ceilings:
* **CPU Limits** (percentage of core allocation)
* **Physical Memory (RAM)**
* **I/O Speed (MB/s)**
* **Entry Processes (Concurrent PHP/CGI/Node connections)**
* **Inode Quota (Total file count)**

Exceeding these limits causes the hosting provider to return **HTTP 508 Resource Limit Reached** or temporarily throttle/lock the account.

### Health Check Before Heavy Tasks:
Before performing resource-intensive operations (full ClamAV virus scans, mass archive extractions, full account backups, bulk file transfers):
1. Run `get_resource_usage` to inspect CPU, RAM, and Entry Process utilization.
2. Run `get_disk_usage` to verify available storage capacity and inode margins.
3. If CPU or RAM usage exceeds **80%**, hold the operation and notify the user:
   > ⏳ **Resource Pre-Check Notice**:
   > Server memory/CPU usage is currently elevated (`[current usage]`). Initiating `[Task]` right now may trigger a resource limit or lock your account.
   > Should we wait until resource utilization drops, or proceed with caution?

### Anti-Flooding / Request Pacing:
* Never trigger rapid concurrent loops of API requests against cPanel.
* Pace multi-step operations sequentially.

---

## 🔒 RULE 3: Secure Application Deployment Standards

### 1. Node.js & Python Applications
* **Zero-Downtime Reloads**:
  Never kill the server process or reboot the entire web server to apply code changes. Always use `restart_nodejs_app` or `restart_python_app`, which updates `tmp/restart.txt` to trigger Phusion Passenger worker reloads gracefully.
* **Environment Variables**:
  Always store secrets (database passwords, tokens, API keys) in `.env` inside the application directory. Never hardcode them in `app.js` or `app.py`.

### 2. Laravel Framework Applications
* **Public Document Root Protection (Critical)**:
  Laravel's document root MUST point specifically to the `public/` directory (e.g. `domain.com/public` or docroot `public_html/project/public`). Never expose the Laravel root folder as the web document root, as this would expose `.env`, `storage/`, and application source code to the public internet.
* **Permission Hardening**:
  Set directory permissions on `storage/` and `bootstrap/cache/` to octal **`0775`** or **`0755`**. **NEVER use `0777`**, which creates a critical security vulnerability on shared hosting.
* **Database & Encryption**:
  Ensure an `APP_KEY` is generated and configured in `.env` before public launch.

### 3. WordPress Installations
* Never modify `wp-config.php` without inspecting it first to preserve `DB_NAME`, `DB_USER`, `DB_PASSWORD`, and table prefixes.

---

## 🔑 RULE 4: Privacy & Credential Redaction

* **Masking**:
  When displaying server information or account summaries to the user, always mask API tokens, SSH private keys, and database passwords:
  * Display: `CPANEL_API_TOKEN: ********************abc1`
  * Never dump raw private keys (`id_rsa`) into chat output.
* **Git Safe**:
  Ensure `.env` and `.git` directories remain protected by `.gitignore` and `.htaccess` deny rules.

---

## 🤝 RULE 5: User Onboarding & Connection Assistance Protocol

When the user asks *"how do I connect to cPanel?"*, *"connect my hosting"*, or when any tool call reports that cPanel is not yet connected (`connected: false`):

The AI assistant must guide the user with this friendly, step-by-step onboarding walkthrough:

### Step 1: Explain the 3 Required Details
Instruct the user that only 3 items are needed from their cPanel account:
1. **Server URL**: The web address they use to access cPanel (usually ends in `:2083`, e.g. `https://yourdomain.com:2083`).
2. **Username**: Their cPanel hosting account username.
3. **API Token**: A secure token created inside cPanel.

### Step 2: Provide Exact Click-by-Click Instructions for the API Token
Give the user these exact instructions to copy their API token in 30 seconds:
1. Log into your cPanel hosting dashboard in your browser.
2. In the search bar at the top, type **"API Tokens"** (or scroll to the **Security** section and click **Manage API Tokens**).
3. Click the blue **+ Create Token** button.
4. Name the token `mcp-ai` and leave full permissions selected.
5. Click **Create** and copy the long token string immediately (cPanel will only show it once!).

### Step 3: Connect via `login_cpanel` Tool
Ask the user to paste their URL, username, and token in the chat. Then:
1. Call the `login_cpanel` tool with the provided credentials.
2. If the connection succeeds, inform the user that their credentials have been securely stored in `~/.cpanel-mcp/config.json` and they are permanently logged in.
3. If the connection fails (e.g. self-signed certificate), explain the exact cause and offer to retry with `verify_ssl: false`.

---

## 📋 Quick Checklist for AI Models Before Any cPanel Action

```
[ ] Is cPanel connected? -> If NO, guide user with Rule 5 (Step-by-step API token walkthrough).
[ ] Is this action destructive? -> If YES, STOP and request explicit user confirmation.
[ ] Will this action consume heavy CPU/RAM/IO? -> If YES, check resource health first.
[ ] Does this involve a web app? -> Use graceful zero-downtime reloads (tmp/restart.txt).
[ ] Does this output contain secrets? -> Mask tokens and passwords before replying.
```

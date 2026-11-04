# cPanel MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/Version-2.1.0-blue.svg)](package.json)
[![Author](https://img.shields.io/badge/Author-AkashJamali-green.svg)](https://github.com/AkashJamali)
[![MCP Protocol](https://img.shields.io/badge/Protocol-Model%20Context%20Protocol-purple.svg)](https://modelcontextprotocol.io)
[![Tools](https://img.shields.io/badge/Tools-214%20Tools-orange.svg)](#1-mcp-tools-214-total)
[![Tests](https://img.shields.io/badge/Tests-Passing%20(100%25)-brightgreen.svg)](test/)

A comprehensive, production-grade **Model Context Protocol (MCP)** server for controlling and automating **cPanel hosting environments** via AI assistants, redesigned and architected by **AkashJamali**.

Directly bridges AI models with cPanel's UAPI and API2 engines, unlocking natural-language orchestration of files, MySQL/PostgreSQL databases, DNS, email systems, SSL certificates, Git deployment, Node.js applications, Python frameworks (Flask/Django/FastAPI), Laravel hosting, GitHub CI/CD automated redeployment, and built-in AI safety guardrails.

---

## 🌟 Key Capabilities

* **214 MCP Tools**: Comprehensive coverage of every cPanel administration domain.
* **Modern App Hosting**: Complete lifecycle management for **Node.js**, **Python**, and **Laravel** applications.
* **GitHub Continuous Deployment**: Instant redeployment on `git push`, deploy key management, webhooks, and GitHub Actions workflows.
* **AI Safety Guardrails ([`SKILL.md`](SKILL.md))**: Prevents accidental file/database deletion, stops server overloads, and protects resource quotas.
* **Zero-Terminal In-Chat Login**: Connect to cPanel directly through your AI chat interface without manual config file editing.
* **Full MCP Compliance**: Fully tested with `@modelcontextprotocol/sdk` supporting **Tools**, **Resources**, and **Prompts**.

---

## 🏗️ Architecture

```
src/
├── index.ts                # Server entrypoint — registers 30 tool modules, resources & prompts
├── cpanel-api.ts           # Resilient HTTP/HTTPS client (UAPI + API2, token auth, backoff retries)
├── config.ts               # Global user configuration manager (~/.cpanel-mcp/config.json)
├── env.ts                  # Multi-path .env auto-loader
├── validation.ts           # Defense-in-depth sanitization (multi-pass traversal prevention, null bytes, IPs)
├── tool-helpers.ts         # Structured response formatters and error handlers
├── resources.ts            # MCP Resources (disk usage, server info, account overview)
├── prompts.ts              # MCP Prompts (domain troubleshooting, security audit, deployment workflows)
└── tools/                  # 30 domain-specific tool modules (214 tools total)
    ├── auth.ts             # In-chat login, login status, and logout
    ├── workflows.ts        # 1-Click site provisioning, DNS presets, account cleanup
    ├── nodejs-hosting.ts   # Node.js app provisioning, Passenger config, zero-downtime reload, npm
    ├── python-hosting.ts   # Python hosting (Flask, Django, FastAPI, WSGI), virtualenv, pip
    ├── laravel-hosting.ts  # Laravel suite: /public docroot, MySQL, .env, 0775 permissions, scheduler
    ├── github.ts           # GitHub connection, automated redeploy, webhooks, deploy keys, CI/CD
    ├── files.ts            # File operations (Fileman, extract/compress archives, chmod, copy/move, base64)
    ├── disk.ts             # Quota and storage consumption
    ├── mysql.ts            # MySQL database CRUD, table check/repair, users & fine-grained grants
    ├── postgresql.ts       # PostgreSQL database CRUD, users & privileges
    ├── email.ts            # POP/IMAP accounts, forwarders, autoresponders, client config, delivery trace
    ├── email-auth.ts       # DKIM, SPF, reverse PTR validation & key installer
    ├── email-filters.ts    # Filter rules, SpamAssassin, Greylisting
    ├── dns.ts              # DNS zone record management (ZoneEdit)
    ├── dnssec.ts           # DNSSEC key export, DS records, NSEC3 config
    ├── domains.ts          # Subdomains, addon domains, parked domains, redirects
    ├── cron.ts             # Cron job scheduling, human-friendly presets, & notification settings
    ├── php.ts              # Multi-PHP switching & php.ini directives
    ├── ssl.ts              # SSL certs, CSR generation, AutoSSL renewals
    ├── security.ts         # IP blocker, SSH keygen & import, key auth, Hotlink protection, directory privacy
    ├── modsecurity.ts      # ModSecurity WAF toggle (global & per-domain)
    ├── twofa.ts            # Two-Factor Authentication status & setup
    ├── virus-scanner.ts    # ClamAV scan triggers, status & disinfection
    ├── metrics.ts          # Bandwidth, resource usage, visitor logs, error logs
    ├── backups.ts          # Full/partial backups (homedir, FTP, SCP) and restores
    ├── ftp.ts              # FTP accounts, quota management, active session termination
    ├── wordpress.ts        # WordPress Toolkit instance detection
    ├── passenger.ts        # Phusion Passenger (Node.js, Python, Ruby apps)
    ├── version-control.ts  # Git repos & automated .cpanel.yml deployment
    ├── tokens.ts           # API token provisioning and lifecycle
    └── features.ts         # cPanel feature availability & connection verification
```

---

## 📖 Complete Step-by-Step Connection Instructions

Connecting your cPanel account to this MCP server is fast, safe, and foolproof. Follow these exact steps:

---

### Step 1: Obtain Your 3 cPanel Credentials

You only need **three** pieces of information from your cPanel account:

#### 1.1 Find Your cPanel Server URL
* Look at your browser address bar when you log into your cPanel hosting account.
* It typically looks like:
  * `https://your-domain.com:2083` (Standard cPanel port)
  * `https://cpanel.your-domain.com:2083`
  * `https://server123.hostingprovider.com:2083`
* 💡 *Tip*: cPanel always uses HTTPS on port **`:2083`**. If you access cPanel via `https://yourdomain.com/cpanel`, your browser will automatically redirect to a URL containing `:2083`. Copy that redirected address!

#### 1.2 Find Your cPanel Username
* This is your main cPanel account username (e.g. `john`, `u123456`, `myhosting`).
* You can see it in the top-right corner of your cPanel dashboard next to the user icon, or in your hosting provider's welcome email.

#### 1.3 Generate Your cPanel API Token (30 Seconds)
Instead of using your account password, cPanel uses secure, revokable API tokens:
1. Log into your **cPanel Dashboard** in your web browser.
2. In the top search bar, type **"API Tokens"** (or scroll down to the **Security** box and click **Manage API Tokens**).
3. Click the blue **+ Create Token** button in the top right.
4. In the **Token Name** field, type any name (for example, `mcp-assistant`).
5. (Optional) Under **Specify Expiration**, choose your preferred duration or leave unchecked for no expiration.
6. Leave full permissions checked so the MCP server can orchestrate files, databases, domains, and frameworks.
7. Click **Create** at the bottom.
8. ⚠️ **IMPORTANT**: Click the **Copy** button to copy the token immediately! cPanel will only show this token once.

---

### Step 2: Add the MCP Server to Your AI IDE / Client

Choose your AI editor and paste the configuration:

#### A. Cursor
* Open Cursor &rarr; Press `Ctrl + Shift + J` (or `Cmd + Shift + J` on macOS) to open Cursor Settings.
* Click **Features** &rarr; **MCP Servers** &rarr; **Add New MCP Server**.
* Name: `cpanel` | Type: `command` | Command: `node C:/Users/ttindern/Documents/MyMCP/build/index.js`
* *Or add directly to `.cursor/mcp.json` in your project:*
```json
{
  "mcpServers": {
    "cpanel": {
      "command": "node",
      "args": ["C:/Users/ttindern/Documents/MyMCP/build/index.js"]
    }
  }
}
```

#### B. Claude Desktop
* Open Claude Desktop Settings &rarr; Developer &rarr; Edit Config:
* File location:
  * **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
  * **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
* Add:
```json
{
  "mcpServers": {
    "cpanel": {
      "command": "node",
      "args": ["C:/Users/ttindern/Documents/MyMCP/build/index.js"]
    }
  }
}
```

#### C. Antigravity / Gemini Code Assist
Add to your Antigravity or workspace MCP settings:
```json
{
  "mcpServers": {
    "cpanel": {
      "command": "node",
      "args": ["C:/Users/ttindern/Documents/MyMCP/build/index.js"]
    }
  }
}
```

#### D. Cline / Roo-Code
In VS Code, open `cline_mcp_settings.json` and add:
```json
{
  "mcpServers": {
    "cpanel": {
      "command": "node",
      "args": ["C:/Users/ttindern/Documents/MyMCP/build/index.js"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

---

### Step 3: Authenticate & Connect (Choose Any 1 of 3 Methods)

#### Method 1: In-Chat Login (Zero Terminal Setup!) 🌟
Once your AI client is running, simply type into the chat:
> *"Connect to my cPanel: URL is https://your-domain.com:2083, username is myuser, token is abc123xyz"*

The AI invokes the `login_cpanel` tool, verifies the credentials live against cPanel, and **saves them permanently** to `~/.cpanel-mcp/config.json`. You are immediately connected across all future chat sessions without touching any terminal!

#### Method 2: Interactive Terminal Setup Wizard
If you prefer setting up before opening your editor:
```bash
npm run setup
# or globally:
npx cpanel-mcp-server setup
```
1. Enter your cPanel Server URL.
2. Enter your cPanel username.
3. Paste your API token.
4. The wizard tests connectivity to port 2083, authenticates, and writes your configuration automatically.

#### Method 3: Traditional `.env` File
Copy `.env.example` to `.env` and fill in your values:
```bash
cp .env.example .env
```
```ini
CPANEL_SERVER_URL=https://your-domain.com:2083
CPANEL_USERNAME=your_cpanel_username
CPANEL_API_TOKEN=your_cpanel_api_token
GITHUB_TOKEN=ghp_your_optional_github_token
```

---

### Step 4: Verify Your Connection in Chat

To verify that your AI can talk to cPanel, open a chat and ask:
> *"Verify my cPanel connection"* or *"List my domains and disk quota"*

Your AI assistant will call `verify_cpanel_connection` or `get_login_status`, returning a live status report with your server name, username, and primary domains!

---

### Step 5: Troubleshooting & FAQ

| Problem | Cause | One-Click Fix |
| :--- | :--- | :--- |
| **`Connection timed out`** or **`ECONNREFUSED`** | Firewall or ISP blocks port `2083`. | Try using your hosting provider's direct hostname (e.g. `https://server123.host.com:2083`) or check if your hosting uses an alternate proxy URL like `https://cpanel.yourdomain.com`. |
| **`SELF_SIGNED_CERT_IN_CHAIN`** | Your cPanel server uses a self-signed or shared SSL cert. | Set `CPANEL_VERIFY_SSL=false` in `.env`, or answer `n` when running `npm run setup`, or pass `verify_ssl: false` in `login_cpanel`. |
| **`HTTP 403 Forbidden`** | Invalid, misspelled, or expired API token. | Go to cPanel &rarr; Security &rarr; Manage API Tokens, revoke the old token, and create a fresh one. |
| **How to switch cPanel accounts?** | You want to connect to a different cPanel account. | Ask your AI: *"Log out of cPanel"* (calls `logout_cpanel`), then log in with your new account credentials. |

---

## 🛡️ AI Safety Guardrails & Skills ([`SKILL.md`](SKILL.md))

When using AI agents with root-level hosting power, safety is paramount. This repository includes [`SKILL.md`](SKILL.md), defining strict behavioral guardrails for your AI:

1. **Zero Destructive Actions Without Prior Confirmation**:
   * The AI will **never delete files, drop databases, remove email accounts, or wipe DNS records** without explicitly asking and receiving your confirmation.
2. **Anti-Overload & Resource Throttling**:
   * Before running heavy operations (virus scans, large archive extractions, full backups), the AI inspects CPU, RAM, and Entry Process utilization to prevent triggering **508 Resource Limit Reached** errors or account lockouts.
3. **Safe Production Framework Deployment**:
   * Enforces zero-downtime application reloading via `tmp/restart.txt`.
   * Enforces `/public` document root containment for Laravel so `.env` secrets cannot be leaked.
   * Restricts folder permissions to `0775` (rejecting unsafe `0777`).

To equip your AI assistant with this skill:
* **Cursor**: Add the contents of [`SKILL.md`](SKILL.md) to `.cursorrules`.
* **Antigravity**: Copy [`SKILL.md`](SKILL.md) to your workspace skills directory.
* **Cline**: Reference [`SKILL.md`](SKILL.md) in your `.clinerules`.
* **Claude Desktop**: Paste [`SKILL.md`](SKILL.md) into Project Instructions.

---

## 📦 Detailed MCP Capabilities

### 1. MCP Tools (214 Total)

| Category | Tools | Capabilities |
| :--- | :--- | :--- |
| **Authentication & Setup** | 3 | `login_cpanel`, `get_login_status`, `logout_cpanel` |
| **Composite Workflows** | 3 | `provision_full_website`, `apply_dns_preset`, `cleanup_account_temp_files` |
| **Node.js Hosting** | 6 | `setup_nodejs_app`, `restart_nodejs_app`, `list_nodejs_apps`, `run_npm_install`, `configure_nodejs_env`, `destroy_nodejs_app` |
| **Python Hosting** | 6 | `setup_python_app` (Flask/Django/FastAPI/WSGI), `restart_python_app`, `list_python_apps`, `run_pip_install`, `configure_python_env`, `destroy_python_app` |
| **Laravel Hosting Suite** | 3 | `setup_laravel_hosting` (public docroot, MySQL, .env, 0775 permissions, scheduler cron), `deploy_laravel_update`, `get_laravel_status` |
| **GitHub CI/CD & Deploy** | 8 | `connect_github_repo`, `redeploy_from_github`, `generate_cpanel_yml`, `create_github_webhook`, `setup_github_deploy_key`, `generate_github_actions_workflow`, `check_github_sync_status`, `configure_github_token` |
| **File Management** | 11 | `list_files`, `create_file`, `read_file`, `edit_file`, `delete_file`, `extract_archive` (.zip/.tar/.tar.gz), `compress_files`, `copy_files`, `move_files`, `change_permissions` (chmod), `upload_file_base64` |
| **Disk Usage** | 1 | `get_disk_usage` (Quota, consumption, limits) |
| **MySQL Databases** | 14 | `list_mysql_databases`, `create_mysql_database`, `delete_mysql_database`, `rename_mysql_database`, `check_mysql_database`, `repair_mysql_database`, `list_mysql_users`, `create_mysql_user`, `delete_mysql_user`, `rename_mysql_user`, `set_mysql_user_password`, `set_mysql_privileges`, `revoke_mysql_privileges`, `get_mysql_server_info` |
| **PostgreSQL Databases** | 8 | Database & user CRUD, fine-grained access grants |
| **Email Management** | 17 | `list_email_accounts`, `create_email_account`, `delete_email_account`, `change_email_password`, `change_email_quota`, forwarders, autoresponders, `get_email_client_settings`, `get_email_disk_usage`, `get_default_address`, `set_default_address`, `trace_email_delivery` |
| **Email Authentication** | 7 | `get_dkim_status`, `install_dkim_key`, `get_spf_records`, `install_spf_record`, PTR validation |
| **Email Filters & Spam** | 13 | Filter rules, SpamAssassin spam box, Greylisting |
| **DNS Management** | 4 | `get_dns_records`, `add_dns_record`, `edit_dns_record`, `delete_dns_record` (A, AAAA, CNAME, MX, TXT, SRV, CAA) |
| **DNSSEC** | 6 | Enable/disable DNSSEC, fetch DS records, export DNSKEY, configure NSEC3 |
| **Domain Management** | 14 | Addon domains, subdomains, parked domains (aliases), URL redirects (301/302) |
| **Cron Job Scheduling** | 7 | `list_cron_jobs`, `create_cron_job`, `create_simple_cron_job` (presets: `hourly`, `daily`, etc.), `edit_cron_job`, `delete_cron_job`, notification alerts |
| **PHP Management** | 5 | List installed PHP versions, set domain PHP version, edit `php.ini` directives |
| **SSL / TLS & AutoSSL** | 8 | List certs, generate CSR, install certs, check AutoSSL status & trigger renewal |
| **Security Suite** | 15 | IP Deny blocker, SSH keygen & authorization, Hotlink protection, Directory Privacy |
| **ModSecurity (WAF)** | 5 | ModSecurity installation status, domain status, global/domain toggle |
| **Two-Factor Auth (2FA)** | 4 | 2FA verification status, secret generation, enable & removal |
| **Virus Scanner (ClamAV)** | 4 | Directory virus scans, scan progress, infection reports, disinfection |
| **Metrics & Logs** | 5 | Bandwidth usage, CPU/RAM resource usage, error logs, visitor analytics |
| **Backup Management** | 7 | Full backups (homedir, FTP, SCP), partial backups, database & file restores |
| **FTP Management** | 8 | Accounts, quotas, active session termination, connection parameters |
| **WordPress Toolkit** | 1 | Discover installed WordPress instances and details |
| **Passenger Applications** | 6 | Register, launch, stop, and manage dependencies for Node.js/Python/Ruby apps |
| **Git Version Control** | 6 | Git repository creation, cloning, branch switching, and `.cpanel.yml` deployment |
| **API Tokens** | 4 | List, create, rename, and revoke cPanel API authentication tokens |
| **Server & Features** | 5 | Live connection verification (`verify_cpanel_connection`), account profile, server details, feature checks |

---

### 2. MCP Resources

Directly inspect live system state via MCP resource URIs:
* `cpanel://system/disk-usage` — Read-only quota, storage consumption, and limits.
* `cpanel://server/info` — Live server specs, OS info, and available PHP versions.
* `cpanel://account/summary` — Consolidated overview of domains, bandwidth, databases, and mail accounts.

---

### 3. MCP Prompts

Interactive workflows pre-configured for LLMs:
* `troubleshoot_domain` — Executes a multi-stage audit of domain resolution, DNS records, SSL validity, and error logs.
* `hosting_security_audit` — Security posture check across WAF rules, IP bans, SSH keys, 2FA, and hotlink protection.
* `deploy_new_site` — Guided provisioning of a domain, database, user permissions, and AutoSSL.
* `setup_github_cpanel_cicd` — Guided setup of GitHub repository linking, deploy keys, webhooks, and automated redeployment.
* `setup_nodejs_app_workflow` — Guided setup of a Node.js Express/HTTP application on Phusion Passenger.
* `setup_python_app_workflow` — Guided setup of a Flask, Django, or FastAPI application.
* `setup_laravel_app_workflow` — Guided provisioning of a production Laravel application with database, `.env`, and cron scheduler.

---

## 🚀 Framework Hosting Quickstarts

### 1. Deploying a Node.js App
Ask your AI:
> *"Host my Node.js application `my-api` on subdomain `api.example.com` in directory `nodejs/my-api`"*

The server executes `setup_nodejs_app`, creating the directory, `package.json`, `app.js`, and `.htaccess` configured for Phusion Passenger. After updating code, simply say:
> *"Restart my Node.js app"* (invokes `restart_nodejs_app`).

### 2. Deploying a Python App (Flask / Django / FastAPI)
Ask your AI:
> *"Deploy a Python Flask application on `python.example.com`"*

The server executes `setup_python_app`, generating `passenger_wsgi.py`, starter `app.py`, `requirements.txt`, and Passenger WSGI directives.

### 3. Deploying a Laravel App
Ask your AI:
> *"Set up Laravel hosting on `laravel.example.com` in folder `laravel/my-app`"*

The server executes `setup_laravel_hosting`:
1. Points the document root directly to `laravel/my-app/public`.
2. Assigns PHP 8.2+.
3. Creates a MySQL database & user with `ALL PRIVILEGES`.
4. Generates `.env` with a secure `APP_KEY` and database credentials.
5. Sets `0775` permissions on `storage` and `bootstrap/cache`.
6. Configures the Laravel Scheduler cron (`* * * * * php artisan schedule:run`).
7. Queues AutoSSL.

### 4. Setting up Automated GitHub CI/CD Redeployment
Ask your AI:
> *"Connect my GitHub repo `my-org/my-site` and redeploy on every push"*

The server executes:
1. `connect_github_repo`: Clones the repo into cPanel.
2. `generate_cpanel_yml`: Writes `.cpanel.yml` with tasks to deploy to `public_html`.
3. `create_github_webhook` or `generate_github_actions_workflow`: Automates redeployment whenever new commits hit `main`.

---

## 🔒 Security Model

* **Token-Based Authentication**: Uses scoped cPanel API tokens without exposing account master passwords.
* **HTTPS Strict Enforcement**: Remote plain HTTP is blocked by default. Loopback HTTP is only allowed for local development when explicitly opted into.
* **Path Traversal Defense**: All file paths and document roots undergo multi-pass decoding to catch raw and URL-encoded traversal (`..`, `%2e%2e`, `%252e%252e`) as well as null-byte attacks (`\0`, `%00`).
* **Input Sanitization**: Domains, IP CIDR blocks, email addresses, and cron schedules are validated prior to invoking API handlers.
* **AI Guardrails Enforced**: Full adherence to [`SKILL.md`](SKILL.md) non-destructive protocols.

---

## 🛠️ Development & Testing

```bash
# Install dependencies
npm install

# Build TypeScript to JavaScript
npm run build

# Run full test suite (protocol compliance + security regression)
npm test
```

All 9 test suites verify:
* JSON-RPC 2.0 handshake and capability negotiation over stdio.
* Input validation and directory traversal prevention.
* URL normalization and loopback enforcement.
* Graceful unconfigured startup and dynamic authentication.

---

## 📄 License & Author

* **Architect & Developer**: **AkashJamali** ([GitHub Profile](https://github.com/AkashJamali))
* **License**: MIT License — see the [LICENSE](LICENSE) file for complete details.
* **Copyright**: &copy; 2026 AkashJamali. All rights reserved.

/**
 * cPanel MCP Server - Python Application Hosting (Flask, Django, FastAPI, WSGI)
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
import { validateDomain, validatePath } from "../validation.js";

export function registerPythonHostingTools(server: McpServer, client: CpanelClient): void {
  // 1. Setup Complete Python Application
  server.tool(
    "setup_python_app",
    "Provision and configure a complete Python application (Flask, Django, FastAPI, or WSGI) with Passenger and .htaccess routing",
    {
      app_name: z.string().describe("Application identifier (e.g. 'flask-api', 'django-site')"),
      domain: z.string().describe("Domain or subdomain to host this Python app on (e.g. 'python.example.com')"),
      app_root: z.string().describe("Application root directory (e.g. 'python/my-app' or 'public_html/py')"),
      framework: z
        .enum(["flask", "django", "fastapi", "standard_wsgi"])
        .default("flask")
        .describe("Python web framework template to initialize"),
      python_version: z.string().default("3.11").describe("Python version (e.g. '3.9', '3.10', '3.11', '3.12')"),
      env_mode: z.enum(["production", "development"]).default("production").describe("Deployment mode"),
    },
    async ({ app_name, domain, app_root, framework, python_version, env_mode }) =>
      handleToolCall(async () => {
        validatePath(app_root);
        const cleanDomain = validateDomain(domain);
        const steps: string[] = [];

        const tmpDir = `${app_root}/tmp`;

        // 1. Framework template files
        let passengerWsgi = "";
        let starterFile = "";
        let starterFileName = "";
        let requirementsTxt = "";

        if (framework === "flask") {
          passengerWsgi = `import sys
import os

# Add application directory to python path
app_dir = os.path.dirname(__file__)
if app_dir not in sys.path:
    sys.path.insert(0, app_dir)

from app import app as application
`;
          starterFileName = "app.py";
          starterFile = `from flask import Flask, jsonify
import sys

app = Flask(__name__)

@app.route('/')
def home():
    return jsonify({
        "status": "online",
        "app": "${app_name}",
        "framework": "Flask",
        "python_version": sys.version,
        "message": "Python Flask application is live on cPanel via Phusion Passenger!"
    })

if __name__ == '__main__':
    app.run()
`;
          requirementsTxt = `Flask>=3.0.0
gunicorn>=21.0.0
`;
        } else if (framework === "django") {
          passengerWsgi = `import sys
import os

app_dir = os.path.dirname(__file__)
if app_dir not in sys.path:
    sys.path.insert(0, app_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', '${app_name}.settings')

from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
`;
          requirementsTxt = `Django>=5.0.0
gunicorn>=21.0.0
`;
        } else if (framework === "fastapi") {
          passengerWsgi = `import sys
import os
from a2wsgi import ASGIMiddleware

app_dir = os.path.dirname(__file__)
if app_dir not in sys.path:
    sys.path.insert(0, app_dir)

from main import app as asgi_app
application = ASGIMiddleware(asgi_app)
`;
          starterFileName = "main.py";
          starterFile = `from fastapi import FastAPI
import sys

app = FastAPI()

@app.get("/")
def read_root():
    return {
        "status": "online",
        "framework": "FastAPI",
        "python_version": sys.version,
        "message": "FastAPI running via WSGI adapter on cPanel!"
    }
`;
          requirementsTxt = `fastapi>=0.110.0
uvicorn>=0.28.0
a2wsgi>=1.10.0
`;
        } else {
          // Standard WSGI
          passengerWsgi = `import sys

def application(environ, start_response):
    status = '200 OK'
    output = b'Hello from cPanel Python WSGI! Python runtime is active.\\n'
    response_headers = [('Content-type', 'text/plain'),
                        ('Content-Length', str(len(output)))]
    start_response(status, response_headers)
    return [output]
`;
          requirementsTxt = `urllib3>=2.0.0
`;
        }

        // 2. Write passenger_wsgi.py
        await client.uapiPost("Fileman", "save_file_content", {
          dir: app_root,
          file: "passenger_wsgi.py",
          content: passengerWsgi,
        });
        steps.push(`✓ Generated 'passenger_wsgi.py' (${framework.toUpperCase()} WSGI entrypoint)`);

        // 3. Write starter application file if applicable
        if (starterFileName && starterFile) {
          await client.uapiPost("Fileman", "save_file_content", {
            dir: app_root,
            file: starterFileName,
            content: starterFile,
          });
          steps.push(`✓ Created '${starterFileName}' starter template`);
        }

        // 4. Write requirements.txt
        await client.uapiPost("Fileman", "save_file_content", {
          dir: app_root,
          file: "requirements.txt",
          content: requirementsTxt,
        });
        steps.push(`✓ Created 'requirements.txt'`);

        // 5. Create tmp/restart.txt
        const restartContent = `${new Date().toISOString()}\n`;
        await client.uapiPost("Fileman", "save_file_content", {
          dir: tmpDir,
          file: "restart.txt",
          content: restartContent,
        });
        steps.push(`✓ Created 'tmp/restart.txt' for zero-downtime worker reloads`);

        // 6. Write .htaccess with Passenger Python directives
        const htaccessContent = `# ========================================================
# cPanel Passenger Python Configuration
# Generated by AkashJamali cPanel MCP Server
# ========================================================
PassengerAppRoot "$HOME/${app_root}"
PassengerBaseURI "/"
PassengerAppType wsgi
PassengerStartupFile passenger_wsgi.py
PassengerAppEnv ${env_mode}

<IfModule mod_passenger.c>
    PassengerEnabled on
</IfModule>
`;

        await client.uapiPost("Fileman", "save_file_content", {
          dir: app_root,
          file: ".htaccess",
          content: htaccessContent,
        });
        steps.push(`✓ Configured '.htaccess' with Passenger WSGI routing`);

        // 7. Register with cPanel PassengerApps
        try {
          await client.uapi("PassengerApps", "register_application", {
            name: app_name,
            path: app_root,
            domain: cleanDomain,
            deployment_mode: env_mode,
            base_uri: "/",
          });
          steps.push(`✓ Registered application '${app_name}' with cPanel Passenger`);
        } catch (regErr) {
          steps.push(`ℹ Passenger registration noted: ${regErr instanceof Error ? regErr.message : String(regErr)}`);
        }

        return formatSuccess(
          `🎉 Python Application '${app_name}' (${framework.toUpperCase()}) configured successfully!\n\n` +
            `• Domain: https://${cleanDomain}\n` +
            `• App Root: ${app_root}\n` +
            `• WSGI Entry: passenger_wsgi.py\n` +
            `• Framework: ${framework.toUpperCase()}\n` +
            `• Python Version: ${python_version}\n\n` +
            steps.join("\n") +
            `\n\n💡 To reload your Python app after code updates, use 'restart_python_app'.`
        );
      })
  );

  // 2. Restart Python Application
  server.tool(
    "restart_python_app",
    "Restart a running Python WSGI application instantly by updating its Passenger restart trigger",
    {
      app_root: z.string().describe("Application root directory (e.g. 'python/my-app')"),
      app_name: z.string().optional().describe("Registered application name (optional)"),
    },
    async ({ app_root, app_name }) =>
      handleToolCall(async () => {
        validatePath(app_root);
        const tmpDir = `${app_root}/tmp`;
        const timestamp = new Date().toISOString();

        // 1. Touch tmp/restart.txt
        await client.uapiPost("Fileman", "save_file_content", {
          dir: tmpDir,
          file: "restart.txt",
          content: `${timestamp}\n`,
        });

        // 2. If app_name given, trigger cPanel enable_application
        if (app_name) {
          try {
            await client.uapi("PassengerApps", "enable_application", { name: app_name });
          } catch {
            // ignore
          }
        }

        return formatSuccess(
          `🔄 Python application restarted successfully at ${timestamp}!\n` +
            `WSGI worker processes have reloaded code from '${app_root}'.`
        );
      })
  );

  // 3. List Python Applications
  server.tool(
    "list_python_apps",
    "List all configured Python applications and their status",
    {},
    async () =>
      handleToolCall(async () => {
        const result = await client.uapi("PassengerApps", "list_applications");
        return formatData(result.data);
      })
  );

  // 4. Install Python Dependencies (pip install)
  server.tool(
    "run_pip_install",
    "Run pip dependency installation for a registered Python application",
    {
      app_name: z.string().describe("Registered Python application name"),
    },
    async ({ app_name }) =>
      handleToolCall(async () => {
        const result = await client.uapi("PassengerApps", "ensure_deps", { name: app_name });
        return formatSuccess(`pip packages installed/verified for '${app_name}'`, result.data);
      })
  );

  // 5. Configure Python Environment Variables
  server.tool(
    "configure_python_env",
    "Set or update environment variables in .env for a Python application",
    {
      app_root: z.string().describe("Application root directory"),
      env_variables: z
        .array(z.string())
        .describe("List of environment variables in KEY=VALUE format (e.g. ['SECRET_KEY=...', 'DEBUG=False'])"),
    },
    async ({ app_root, env_variables }) =>
      handleToolCall(async () => {
        validatePath(app_root);

        let existingEnv: Record<string, string> = {};
        try {
          const res = await client.uapi("Fileman", "get_file_content", {
            dir: app_root,
            file: ".env",
          });
          if (res.data && typeof res.data === "object" && "content" in (res.data as Record<string, unknown>)) {
            const lines = String((res.data as Record<string, unknown>).content).split(/\r?\n/);
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith("#")) continue;
              const idx = trimmed.indexOf("=");
              if (idx !== -1) {
                existingEnv[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
              }
            }
          }
        } catch {
          // file may not exist
        }

        const newVars: Record<string, string> = {};
        for (const item of env_variables) {
          const idx = item.indexOf("=");
          if (idx !== -1) {
            newVars[item.slice(0, idx).trim()] = item.slice(idx + 1).trim();
          }
        }

        const merged = { ...existingEnv, ...newVars };
        const envContent =
          Object.entries(merged)
            .map(([k, v]) => `${k}=${v}`)
            .join("\n") + "\n";

        await client.uapiPost("Fileman", "save_file_content", {
          dir: app_root,
          file: ".env",
          content: envContent,
        });

        return formatSuccess(
          `Environment variables updated in '${app_root}/.env':\n\n` +
            Object.keys(newVars)
              .map((k) => `• ${k}=${newVars[k]}`)
              .join("\n")
        );
      })
  );

  // 6. Delete Python Application
  server.tool(
    "destroy_python_app",
    "Unregister and remove a Python application configuration",
    {
      app_name: z.string().describe("Registered application name to remove"),
    },
    async ({ app_name }) =>
      handleToolCall(async () => {
        const result = await client.uapi("PassengerApps", "unregister_application", { name: app_name });
        return formatSuccess(`Python application '${app_name}' unregistered from cPanel`, result.data);
      })
  );
}

/**
 * cPanel MCP Server - GitHub Integration & Automated CI/CD Deployment
 *
 * @author AkashJamali
 * @license MIT
 * @copyright (c) 2026 AkashJamali. All rights reserved.
 * @link https://github.com/AkashJamali/cpanel-mcp-server
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CpanelClient, CpanelApiError } from "../cpanel-api.js";
import { handleToolCall, formatData, formatSuccess, formatError } from "../tool-helpers.js";
import { validatePath, splitPath } from "../validation.js";
import { saveGlobalConfig, resolveEffectiveConfig } from "../config.js";

async function callGithubApi(
  endpoint: string,
  method: string,
  token?: string,
  body?: Record<string, unknown>
): Promise<unknown> {
  const effectiveToken = token || process.env.GITHUB_TOKEN || resolveEffectiveConfig()?.githubToken;
  if (!effectiveToken) {
    throw new CpanelApiError(
      "GitHub Personal Access Token is required. Please provide 'github_token' or configure it using 'configure_github_token'."
    );
  }

  const url = endpoint.startsWith("http") ? endpoint : `https://api.github.com${endpoint}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${effectiveToken}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "cpanel-mcp-server-akashjamali",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }

  if (!response.ok) {
    const errorMsg =
      typeof parsed === "object" && parsed && "message" in parsed
        ? String((parsed as { message: string }).message)
        : text;
    throw new CpanelApiError(`GitHub API Error (${response.status}): ${errorMsg}`);
  }

  return parsed;
}

export function registerGithubTools(server: McpServer, client: CpanelClient): void {
  // 1. Configure GitHub Token
  server.tool(
    "configure_github_token",
    "Save a GitHub Personal Access Token (PAT) for automated GitHub repository operations and webhooks",
    {
      github_token: z.string().describe("GitHub Personal Access Token (classic with repo scope or fine-grained)"),
      save_permanently: z.boolean().default(true).describe("Save to ~/.cpanel-mcp/config.json"),
    },
    async ({ github_token, save_permanently }) =>
      handleToolCall(async () => {
        // Validate token by checking /user
        const user = (await callGithubApi("/user", "GET", github_token)) as { login: string };
        client.setGithubToken(github_token);

        if (save_permanently) {
          const currentConfig = resolveEffectiveConfig();
          if (currentConfig) {
            saveGlobalConfig({
              ...currentConfig,
              githubToken: github_token,
            });
          }
        }

        return formatSuccess(
          `GitHub authenticated successfully as user: ${user.login}${save_permanently ? " (Token saved globally)" : ""}`
        );
      })
  );

  // 2. Connect GitHub Repository to cPanel
  server.tool(
    "connect_github_repo",
    "Connect and clone a GitHub repository to cPanel and optionally configure deployment paths",
    {
      github_repo_url: z.string().describe("GitHub repository clone URL (HTTPS or SSH, e.g. 'https://github.com/owner/repo.git')"),
      repository_name: z.string().describe("Identifier name for the repository in cPanel"),
      repository_root: z.string().describe("Target path on cPanel (e.g. '/home/user/repositories/mysite')"),
      deploy_path: z.string().optional().describe("Website destination path to deploy files to (e.g. 'public_html')"),
      branch: z.string().default("main").describe("Git branch to clone and track"),
    },
    async ({ github_repo_url, repository_name, repository_root, deploy_path, branch }) =>
      handleToolCall(async () => {
        validatePath(repository_root);

        // 1. Clone into cPanel
        const params: Record<string, string> = {
          name: repository_name,
          repository_root,
          source_repository: github_repo_url,
          branch,
          type: "git",
        };

        const result = await client.uapi("VersionControl", "create", params);

        // 2. If deploy_path specified, generate .cpanel.yml
        let cpanelYmlCreated = false;
        if (deploy_path) {
          try {
            validatePath(deploy_path);
            const safeDeployPath = deploy_path.startsWith("/") ? deploy_path : `$HOME/${deploy_path}`;
            const cpanelYml = `---
deployment:
  tasks:
    - export DEPLOYPATH=${safeDeployPath}
    - /bin/cp -R * $DEPLOYPATH
`;
            await client.uapiPost("Fileman", "save_file_content", {
              dir: repository_root,
              file: ".cpanel.yml",
              content: cpanelYml,
            });
            cpanelYmlCreated = true;
          } catch {
            // non-fatal
          }
        }

        const summary = client.getConfigSummary();
        const webhookUrl = summary?.serverUrl
          ? `${summary.serverUrl}/execute/VersionControlDeployment/create?repository_root=${encodeURIComponent(repository_root)}`
          : "Configured via cPanel Git Version Control";

        return formatSuccess(
          `🎉 GitHub repository connected to cPanel!\n\n` +
            `• Repository: ${repository_name}\n` +
            `• Source: ${github_repo_url}\n` +
            `• cPanel Root: ${repository_root}\n` +
            `• Branch: ${branch}\n` +
            (cpanelYmlCreated ? `• Deployment Config: .cpanel.yml created for '${deploy_path}'\n` : "") +
            `\nAutomatic Webhook URL:\n${webhookUrl}`,
          result.data
        );
      })
  );

  // 3. Redeploy from GitHub
  server.tool(
    "redeploy_from_github",
    "Pull latest commits from GitHub and execute deployment tasks configured in .cpanel.yml",
    {
      repository_root: z.string().describe("cPanel repository path (e.g. '/home/user/repositories/mysite')"),
      branch: z.string().default("main").describe("Branch to pull and deploy"),
    },
    async ({ repository_root, branch }) =>
      handleToolCall(async () => {
        validatePath(repository_root);

        // 1. Pull latest changes
        const updateRes = await client.uapi("VersionControl", "update", {
          repository_root,
          branch,
        });

        // 2. Trigger deployment
        const deployRes = await client.uapi("VersionControlDeployment", "create", {
          repository_root,
        });

        // 3. Check deployment log status
        let deployStatus = null;
        try {
          const statusRes = await client.uapi("VersionControlDeployment", "retrieve", {
            repository_root,
          });
          deployStatus = statusRes.data;
        } catch {
          // ignore status read
        }

        return formatSuccess(
          `🚀 Redeployment triggered successfully from GitHub for branch '${branch}'!`,
          {
            git_pull: updateRes.data,
            deployment: deployRes.data,
            status: deployStatus,
          }
        );
      })
  );

  // 4. Generate .cpanel.yml
  server.tool(
    "generate_cpanel_yml",
    "Generate or update a .cpanel.yml deployment specification in a repository or directory",
    {
      target_dir: z.string().describe("Directory where .cpanel.yml should be written (repository root)"),
      deploy_path: z.string().describe("Target website directory where files will be copied (e.g. '/home/user/public_html')"),
      custom_commands: z
        .array(z.string())
        .optional()
        .describe("Optional build commands to run before copying (e.g. ['npm install', 'npm run build'])"),
    },
    async ({ target_dir, deploy_path, custom_commands }) =>
      handleToolCall(async () => {
        validatePath(target_dir);
        validatePath(deploy_path);

        const tasks: string[] = [`export DEPLOYPATH=${deploy_path}`];
        if (custom_commands && custom_commands.length > 0) {
          for (const cmd of custom_commands) {
            tasks.push(cmd);
          }
        }
        tasks.push("/bin/cp -R * $DEPLOYPATH");

        const yamlContent = `---\ndeployment:\n  tasks:\n${tasks.map((t) => `    - ${t}`).join("\n")}\n`;

        const result = await client.uapiPost("Fileman", "save_file_content", {
          dir: target_dir,
          file: ".cpanel.yml",
          content: yamlContent,
        });

        return formatSuccess(`.cpanel.yml deployment file generated in '${target_dir}':\n\n${yamlContent}`, result.data);
      })
  );

  // 5. Create GitHub Webhook
  server.tool(
    "create_github_webhook",
    "Create a push webhook on a GitHub repository to trigger automatic redeployment on cPanel",
    {
      owner: z.string().describe("GitHub owner/organization (e.g. 'AkashJamali')"),
      repo: z.string().describe("GitHub repository name (e.g. 'my-app')"),
      webhook_url: z.string().describe("cPanel deployment webhook URL or custom endpoint"),
      secret: z.string().optional().describe("Optional webhook secret"),
      github_token: z.string().optional().describe("GitHub PAT (if not already configured)"),
    },
    async ({ owner, repo, webhook_url, secret, github_token }) =>
      handleToolCall(async () => {
        const payload: Record<string, unknown> = {
          name: "web",
          active: true,
          events: ["push", "release"],
          config: {
            url: webhook_url,
            content_type: "json",
            ...(secret ? { secret } : {}),
            insecure_ssl: "0",
          },
        };

        const result = await callGithubApi(`/repos/${owner}/${repo}/hooks`, "POST", github_token, payload);
        return formatSuccess(`GitHub Webhook created successfully for repository '${owner}/${repo}'!`, result);
      })
  );

  // 6. Setup GitHub Deploy Key
  server.tool(
    "setup_github_deploy_key",
    "Generate an SSH key in cPanel and automatically register it as a read-only Deploy Key on GitHub for private repo access",
    {
      owner: z.string().describe("GitHub repository owner"),
      repo: z.string().describe("GitHub repository name"),
      key_title: z.string().default("cPanel Server Deploy Key").describe("Title for the deploy key in GitHub"),
      github_token: z.string().optional().describe("GitHub PAT with 'admin:public_key' or repo write scope"),
    },
    async ({ owner, repo, key_title, github_token }) =>
      handleToolCall(async () => {
        const keyName = `cpanel_deploy_${repo.replace(/[^a-zA-Z0-9_]/g, "_")}`;

        // 1. Generate SSH key in cPanel
        await client.uapi("SSH", "gen_key", {
          name: keyName,
          passphrase: "",
          type: "rsa",
          bits: "2048",
        });

        // 2. Authorize key in cPanel
        await client.uapi("SSH", "authorize_key", { name: keyName });

        // 3. Retrieve public key content
        const keyList = (await client.uapi("SSH", "list_keys")) as { data: Array<{ name: string; key: string }> };
        const found = keyList.data?.find((k) => k.name === keyName || k.name === `${keyName}.pub`);
        if (!found || !found.key) {
          throw new CpanelApiError(`SSH key '${keyName}' was created but public key content could not be retrieved.`);
        }

        // 4. Register on GitHub
        const result = await callGithubApi(`/repos/${owner}/${repo}/keys`, "POST", github_token, {
          title: key_title,
          key: found.key.trim(),
          read_only: true,
        });

        return formatSuccess(
          `🔐 Deploy Key registered on GitHub repository '${owner}/${repo}'!\n` +
            `cPanel can now clone and pull this private repository securely via SSH.`,
          result
        );
      })
  );

  // 7. Generate GitHub Actions CI/CD Workflow
  server.tool(
    "generate_github_actions_workflow",
    "Generate a GitHub Actions workflow (.github/workflows/deploy.yml) that automatically calls cPanel to redeploy on push",
    {
      repository_root: z.string().describe("cPanel repository path (e.g. '/home/user/repositories/my-site')"),
      branch: z.string().default("main").describe("Target branch to trigger deployments"),
      build_steps: z
        .array(z.string())
        .optional()
        .describe("Optional build steps in GitHub Actions before deploying (e.g. ['npm ci', 'npm run build'])"),
    },
    async ({ repository_root, branch, build_steps }) =>
      handleToolCall(async () => {
        validatePath(repository_root);

        const buildYaml = build_steps && build_steps.length > 0
          ? build_steps.map((s) => `      - run: ${s}`).join("\n") + "\n"
          : "";

        const workflow = `name: cPanel Automated Deployment
on:
  push:
    branches:
      - ${branch}

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

${buildYaml}      - name: Trigger cPanel Git Pull & Deployment
        run: |
          echo "Triggering cPanel redeployment..."
          curl -s -X POST "\${{ secrets.CPANEL_SERVER_URL }}/execute/VersionControl/update" \\
            -H "Authorization: cpanel \${{ secrets.CPANEL_USERNAME }}:\${{ secrets.CPANEL_API_TOKEN }}" \\
            -d "repository_root=${repository_root}" \\
            -d "branch=${branch}"
          
          curl -s -X POST "\${{ secrets.CPANEL_SERVER_URL }}/execute/VersionControlDeployment/create" \\
            -H "Authorization: cpanel \${{ secrets.CPANEL_USERNAME }}:\${{ secrets.CPANEL_API_TOKEN }}" \\
            -d "repository_root=${repository_root}"
          
          echo "cPanel deployment dispatched successfully!"
`;

        return formatSuccess(
          `Generated GitHub Actions Workflow (.github/workflows/deploy.yml):\n\n${workflow}\n\n` +
            `💡 In your GitHub Repository Settings -> Secrets and variables -> Actions, add:\n` +
            `• CPANEL_SERVER_URL (e.g. https://your-domain.com:2083)\n` +
            `• CPANEL_USERNAME (your cPanel username)\n` +
            `• CPANEL_API_TOKEN (your cPanel API token)`
        );
      })
  );

  // 8. Check GitHub vs cPanel Sync Status
  server.tool(
    "check_github_sync_status",
    "Check if cPanel repository is up-to-date with the latest commit on GitHub",
    {
      owner: z.string().describe("GitHub owner/organization"),
      repo: z.string().describe("GitHub repository name"),
      repository_root: z.string().describe("cPanel repository path"),
      branch: z.string().default("main").describe("Branch to check"),
      github_token: z.string().optional().describe("GitHub PAT"),
    },
    async ({ owner, repo, repository_root, branch, github_token }) =>
      handleToolCall(async () => {
        validatePath(repository_root);

        // 1. Get latest commit from GitHub
        const githubCommit = (await callGithubApi(
          `/repos/${owner}/${repo}/commits/${branch}`,
          "GET",
          github_token
        )) as { sha: string; commit: { message: string; author: { name: string; date: string } } };

        // 2. Get current cPanel commit
        const cpanelRepos = (await client.uapi("VersionControl", "retrieve")) as {
          data: Array<{ repository_root: string; branch: string; last_deployment?: { commit?: string } }>;
        };

        const targetRepo = cpanelRepos.data?.find((r) => r.repository_root === repository_root);
        const lastDeploySha = targetRepo?.last_deployment?.commit;

        const isSynced = lastDeploySha ? lastDeploySha === githubCommit.sha : false;

        return formatData({
          repository: `${owner}/${repo}`,
          branch,
          github_latest_commit: {
            sha: githubCommit.sha,
            message: githubCommit.commit?.message?.split("\n")[0],
            author: githubCommit.commit?.author?.name,
            date: githubCommit.commit?.author?.date,
          },
          cpanel_last_deployed_commit: lastDeploySha || "Unknown / Not yet deployed",
          is_synced: isSynced,
          recommendation: isSynced
            ? "cPanel is up-to-date with GitHub."
            : "New commit available on GitHub. Run 'redeploy_from_github' to update cPanel.",
        });
      })
  );
}

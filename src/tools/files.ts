/**
 * cPanel MCP Server - Advanced File Management
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
import { splitPath, validatePath } from "../validation.js";

export function registerFileTools(server: McpServer, client: CpanelClient) {
  server.tool(
    "list_files",
    "List files and directories in a specified path",
    { path: z.string().default("/").describe("Directory path to list") },
    async ({ path }) =>
      handleToolCall(async () => {
        validatePath(path);
        const result = await client.uapi("Fileman", "list_files", {
          dir: path,
          include_mime: "1",
          include_permissions: "1",
        });
        return formatData(result.data);
      })
  );

  server.tool(
    "create_file",
    "Create a new file with specified text content",
    {
      path: z.string().describe("Full file path including filename"),
      content: z.string().describe("File content"),
    },
    async ({ path, content }) =>
      handleToolCall(async () => {
        const { dir, file } = splitPath(path);
        const result = await client.uapiPost("Fileman", "save_file_content", {
          dir,
          file,
          content,
        });
        return formatSuccess(`File created: ${path}`, result.data);
      })
  );

  server.tool(
    "read_file",
    "Read the contents of a text file",
    { path: z.string().describe("Full file path to read") },
    async ({ path }) =>
      handleToolCall(async () => {
        const { dir, file } = splitPath(path);
        const result = await client.uapi("Fileman", "get_file_content", {
          dir,
          file,
        });
        return formatData(result.data);
      })
  );

  server.tool(
    "edit_file",
    "Update the contents of an existing file",
    {
      path: z.string().describe("Full file path to edit"),
      content: z.string().describe("New file content"),
    },
    async ({ path, content }) =>
      handleToolCall(async () => {
        const { dir, file } = splitPath(path);
        const result = await client.uapiPost("Fileman", "save_file_content", {
          dir,
          file,
          content,
        });
        return formatSuccess(`File updated: ${path}`, result.data);
      })
  );

  server.tool(
    "delete_file",
    "Delete a file or directory (move to trash)",
    { path: z.string().describe("Full path to delete") },
    async ({ path }) =>
      handleToolCall(async () => {
        const { dir, file } = splitPath(path);
        const result = await client.uapi("Fileman", "trash", {
          dir,
          file,
        });
        return formatSuccess(`Deleted: ${path}`, result.data);
      })
  );

  server.tool(
    "extract_archive",
    "Extract a compressed archive (.zip, .tar, .tar.gz, .bz2) into a destination directory",
    {
      archive_path: z.string().describe("Path to the archive file (e.g. public_html/app.zip)"),
      destination_dir: z.string().describe("Destination directory to extract into (e.g. public_html/app)"),
    },
    async ({ archive_path, destination_dir }) =>
      handleToolCall(async () => {
        validatePath(archive_path);
        validatePath(destination_dir);
        const { dir, file } = splitPath(archive_path);
        const result = await client.uapi("Fileman", "extract_files", {
          dir,
          files: file,
          dest: destination_dir,
        });
        return formatSuccess(`Extracted '${file}' to '${destination_dir}'`, result.data);
      })
  );

  server.tool(
    "compress_files",
    "Compress files or a directory into a .zip, .tar, or .tar.gz archive",
    {
      source_path: z.string().describe("Directory or file to compress"),
      archive_name: z.string().describe("Name of the output archive (e.g. backup.zip)"),
      archive_type: z.enum(["zip", "tar", "gzip", "bzip2"]).default("zip").describe("Compression format"),
    },
    async ({ source_path, archive_name, archive_type }) =>
      handleToolCall(async () => {
        validatePath(source_path);
        const { dir, file } = splitPath(source_path);
        const result = await client.uapi("Fileman", "compress_files", {
          dir,
          files: file,
          archive_name,
          archive_type,
        });
        return formatSuccess(`Compressed '${source_path}' into '${archive_name}'`, result.data);
      })
  );

  server.tool(
    "copy_files",
    "Copy a file or directory to a new location on the server",
    {
      source_path: z.string().describe("Source file or folder path"),
      destination_dir: z.string().describe("Destination directory path"),
    },
    async ({ source_path, destination_dir }) =>
      handleToolCall(async () => {
        validatePath(source_path);
        validatePath(destination_dir);
        const { dir, file } = splitPath(source_path);
        const result = await client.uapi("Fileman", "copy_files", {
          dir,
          files: file,
          dest: destination_dir,
        });
        return formatSuccess(`Copied '${source_path}' to '${destination_dir}'`, result.data);
      })
  );

  server.tool(
    "move_files",
    "Move or rename a file or directory on the server",
    {
      source_path: z.string().describe("Source file or folder path to move"),
      destination_dir: z.string().describe("Destination directory path"),
    },
    async ({ source_path, destination_dir }) =>
      handleToolCall(async () => {
        validatePath(source_path);
        validatePath(destination_dir);
        const { dir, file } = splitPath(source_path);
        const result = await client.uapi("Fileman", "move_files", {
          dir,
          files: file,
          dest: destination_dir,
        });
        return formatSuccess(`Moved '${source_path}' to '${destination_dir}'`, result.data);
      })
  );

  server.tool(
    "change_permissions",
    "Change file or directory permissions (chmod)",
    {
      path: z.string().describe("File or directory path"),
      permissions: z.string().describe("Octal permission mode (e.g. '0755' for directories, '0644' for files)"),
    },
    async ({ path, permissions }) =>
      handleToolCall(async () => {
        validatePath(path);
        const { dir, file } = splitPath(path);
        const result = await client.uapi("Fileman", "chmod", {
          dir,
          file,
          permissions,
        });
        return formatSuccess(`Permissions for '${path}' updated to ${permissions}`, result.data);
      })
  );

  server.tool(
    "upload_file_base64",
    "Upload a binary or text file using Base64 encoding (ideal for images, archives, PDFs)",
    {
      path: z.string().describe("Destination file path including filename"),
      base64_content: z.string().describe("File data encoded in Base64"),
    },
    async ({ path, base64_content }) =>
      handleToolCall(async () => {
        const { dir, file } = splitPath(path);
        const buffer = Buffer.from(base64_content, "base64");
        const content = buffer.toString("binary");
        const result = await client.uapiPost("Fileman", "save_file_content", {
          dir,
          file,
          content,
          encoding: "binary",
        });
        return formatSuccess(`Binary file uploaded: ${path} (${buffer.length} bytes)`, result.data);
      })
  );
}

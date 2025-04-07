# ClickHouse Cloud MCP Server

This MCP server provides tools to interact with the ClickHouse Cloud API (v1). It allows managing organizations, services, API keys, and more directly through MCP clients like Claude Desktop.

## Features

- Exposes ClickHouse Cloud API endpoints as MCP tools.
- Authenticates using ClickHouse API Key ID and Secret provided via environment variables.
- Handles JSON request bodies and responses.

## Prerequisites

You need a ClickHouse Cloud API Key. You can generate one in your ClickHouse Cloud organization settings.

## Configuration

This server requires the following environment variables to be set:

- `CLICKHOUSE_API_KEY_ID`: Your ClickHouse Cloud API Key ID.
- `CLICKHOUSE_API_SECRET`: Your ClickHouse Cloud API Key Secret.

## Usage with Claude Desktop

Add the following configuration to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "clickhouse": {
      "command": "node", // Or npx if published
      "args": [
        "/path/to/your/mcp-server-clickhouse/dist/index.js" // Adjust path
        // Or if published:
        // "-y",
        // "@your-scope/mcp-server-clickhouse"
      ],
      "env": {
         // Option 1: Set env vars here (less secure for secrets)
         // "CLICKHOUSE_API_KEY_ID": "your_key_id",
         // "CLICKHOUSE_API_SECRET": "your_key_secret"
         // Option 2: Ensure the env vars are set in the shell launching Claude Desktop
      }
    }
  }
}
# ClickHouse Cloud MCP Server

This MCP server provides tools to interact with the ClickHouse Cloud API (v1). It allows managing organizations and services, the rest is TODO.

## Features

- Exposes ClickHouse Cloud API endpoint via MCP tools.
- Authenticates using ClickHouse OpenAPI Key ID and Secret provided via environment variables.
- Handles JSON request bodies and responses.

## Prerequisites

You need a ClickHouse Cloud API Key.

## Installation

Clone this repository and install the dependencies:

```bash
npm install
```
Build the TypeScript code:

```bash
npm run build
```
This will create a `dist` directory containing the compiled JavaScript file.

## Configuration

This server requires the following environment variables to be set:

- `CLICKHOUSE_API_KEY_ID`: Your ClickHouse Cloud API Key ID.
- `CLICKHOUSE_API_SECRET`: Your ClickHouse Cloud API Key Secret.
- `CLICKHOUSE_API_URL`: The base URL for the ClickHouse Cloud API (default is `https://api.clickhouse.cloud`).
  Use `http://localhost:2023` for local development.

## Usage with Claude Desktop

Add the following configuration to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "clickhouse": {
      "command": "node",
      "args": [
        "/full/path/to/dist/index.js"
      ],
      "env": {
        "CLICKHOUSE_API_KEY_ID": "key id",
        "CLICKHOUSE_API_SECRET": "key secret",
        "CLICKHOUSE_API_URL": "http://localhost:2023"
      }
    }
  }
}
```

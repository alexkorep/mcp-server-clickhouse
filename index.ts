#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./clickhouse.js"; // Ensure correct import name
import * as dotenv from 'dotenv'; // Import dotenv

dotenv.config(); // Load .env file if present

async function main() {
  // Check for required environment variables
  if (!process.env.CLICKHOUSE_API_KEY_ID || !process.env.CLICKHOUSE_API_SECRET) {
      console.error("ERROR: CLICKHOUSE_API_KEY_ID and CLICKHOUSE_API_SECRET environment variables must be set.");
      // Optionally load from a .env file for local dev, but warn about production use
      if (process.env.NODE_ENV !== 'production') {
          console.warn("Consider using a .env file for local development (ensure it's in .gitignore).");
      }
       // Don't exit immediately, let the tool call fail informatively
      // process.exit(1);
  } else {
      console.log("ClickHouse API credentials found in environment variables.");
  }


  const transport = new StdioServerTransport();
  const { server, cleanup } = createServer();

  await server.connect(transport);
  console.log("ClickHouse MCP Server connected via stdio");


  const shutdown = async () => {
     console.log("Shutting down ClickHouse MCP Server...");
     await cleanup();
     await server.close();
     process.exit(0);
  };

  // Cleanup on exit signals
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("ClickHouse MCP Server error:", error);
  process.exit(1);
});
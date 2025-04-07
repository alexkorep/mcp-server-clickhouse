import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { createServer } from "./clickhouse.js"; // Ensure correct import name
import * as dotenv from 'dotenv'; // Import dotenv

dotenv.config(); // Load .env file if present

// Check for required environment variables (similar to index.ts)
if (!process.env.CLICKHOUSE_API_KEY_ID || !process.env.CLICKHOUSE_API_SECRET) {
    console.error("ERROR: CLICKHOUSE_API_KEY_ID and CLICKHOUSE_API_SECRET environment variables must be set.");
    if (process.env.NODE_ENV !== 'production') {
       console.warn("Consider using a .env file for local development (ensure it's in .gitignore).");
    }
    // process.exit(1); // Or let connection fail
}

const app = express();
app.use(express.json()); // Middleware to parse JSON bodies for POST

const { server, cleanup } = createServer();

let transport: SSEServerTransport | null = null;

app.get("/sse", async (req, res) => {
  if (transport) {
     console.warn("SSE connection already established. Ignoring new request.");
     res.status(409).send("Connection already established.");
     return;
  }
  console.log("Received SSE connection request");
  transport = new SSEServerTransport("/message", res); // Pass response object

  try {
    await server.connect(transport);
    console.log("ClickHouse MCP Server connected via SSE");

    // Handle client disconnect
    req.on('close', async () => {
        console.log("SSE client disconnected");
        if (server.isConnected) {
             await cleanup();
             await server.close(); // Close MCP connection if client disconnects
        }
        transport = null; // Allow new connections
    });

  } catch (error) {
     console.error("Error connecting SSE transport:", error);
     res.status(500).send("Failed to establish SSE connection");
     transport = null;
  }
});

app.post("/message", async (req, res) => {
  if (!transport) {
    console.error("Received POST message but no active SSE transport.");
    return res.status(404).send("No active SSE connection");
  }
  // console.log("Received POST message for SSE transport"); // Debug log
  await transport.handlePostMessage(req, res);
});

const PORT = process.env.PORT || 3001;
const listener = app.listen(PORT, () => {
  console.log(`ClickHouse MCP SSE Server is running on port ${PORT}`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
  console.log(`Message endpoint: http://localhost:${PORT}/message`);
});


const shutdown = async () => {
   console.log("Shutting down ClickHouse MCP SSE Server...");
   listener.close(async () => {
       console.log("HTTP server closed.");
       await cleanup();
       if (server.isConnected) {
           await server.close();
       }
       process.exit(0);
   });
};

// Cleanup on exit signals
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
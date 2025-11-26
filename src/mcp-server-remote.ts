#!/usr/bin/env node

/**
 * OpenChem Remote MCP Server (Node.js/Bun)
 * Lightweight HTTP + SSE server for remote chemistry analysis
 * Runtime: Node.js, Bun
 */

import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

// Import tool definitions
import { registerTools } from "./mcp-tools.js";

// Version - hardcoded to maintain runtime-agnostic compatibility
// (Cloudflare Workers don't support node:fs)
// Update this when bumping package.json version
const VERSION = "0.2.9";

const PORT = Number.parseInt(process.env.PORT || "3000", 10);

// Create MCP server
const mcpServer = new McpServer({
  name: "openchem-remote",
  version: VERSION,
});

// Register all tools
registerTools(mcpServer);

// Create HTTP server
const httpServer = createServer(async (req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.url === "/health" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ status: "ok", service: "openchem-mcp", version: VERSION })
    );
    return;
  }

  // MCP endpoints - support both /mcp and /mcp/sse
  if (req.url === "/mcp" || req.url?.startsWith("/mcp?") || req.url === "/mcp/sse" || req.url?.startsWith("/mcp/sse?")) {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    await mcpServer.connect(transport);
    await transport.handleRequest(req, res);
    return;
  }

  // 404
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`✨ OpenChem MCP Server (Remote)`);
  console.log(`📍 Running on http://localhost:${PORT}`);
  console.log(`🏥 Health: http://localhost:${PORT}/health`);
  console.log(`🔌 MCP endpoints:`);
  console.log(`   • http://localhost:${PORT}/mcp`);
  console.log(`   • http://localhost:${PORT}/mcp/sse`);
  console.log(`\n🧪 Available tools:`);
  console.log(`   • analyze   - Complete molecular analysis`);
  console.log(`   • compare   - Similarity comparison`);
  console.log(`   • search    - Substructure matching`);
  console.log(`   • render    - 2D visualization`);
  console.log(`   • convert   - Format conversion`);
});

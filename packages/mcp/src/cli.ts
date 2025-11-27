#!/usr/bin/env node

/**
 * OpenChem MCP Server CLI
 * 
 * Usage:
 *   openchem-mcp               # Start server on default port (3000)
 *   openchem-mcp --port 8080   # Start server on custom port
 *   openchem-mcp --help        # Show help
 */

import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerTools } from "./mcp-tools.js";

// Parse command line arguments
const args = process.argv.slice(2);
const help = args.includes("--help") || args.includes("-h");
const portIndex = args.findIndex(arg => arg === "--port" || arg === "-p");
const customPort = portIndex >= 0 ? args[portIndex + 1] : undefined;

if (help) {
  console.log(`
OpenChem MCP Server - Chemistry analysis for AI assistants

USAGE:
  openchem-mcp [OPTIONS]

OPTIONS:
  --port, -p <PORT>    Server port (default: 4141)
  --help, -h           Show this help message

EXAMPLES:
  openchem-mcp                  # Start on port 4141
  openchem-mcp --port 8080      # Start on port 8080
  PORT=9000 openchem-mcp        # Start on port 9000 (via env var)

ENDPOINTS:
  GET  /health                  # Health check
  POST /mcp                     # MCP endpoint (HTTP + SSE)
  POST /mcp/sse                 # MCP endpoint (alias)

AVAILABLE TOOLS:
  • analyze    - Complete molecular analysis (40+ descriptors, drug-likeness, IUPAC)
  • compare    - Molecular similarity (Morgan fingerprints, Tanimoto)
  • search     - Substructure matching (SMARTS patterns)
  • render     - 2D structure visualization (SVG)
  • convert    - Format conversion (canonical SMILES, IUPAC, scaffold)

DOCUMENTATION:
  https://github.com/rajeshg/openchem
  npm home openchem

For detailed integration guides, see:
  https://github.com/rajeshg/openchem/blob/main/docs/mcp-integration-guide.md
`);
  process.exit(0);
}

// Read version from package.json at build time would require fs
// For now, hardcode and update on release
const VERSION = "0.1.0";

const PORT = customPort ? Number.parseInt(customPort, 10) : Number.parseInt(process.env.PORT || "4141", 10);

if (Number.isNaN(PORT) || PORT < 1 || PORT > 65535) {
  console.error(`Error: Invalid port number: ${customPort || process.env.PORT}`);
  process.exit(1);
}

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
    try {
      // Use stateless mode (sessionIdGenerator: undefined) to avoid session issues
      // This means we create a new transport for each request
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

      await mcpServer.connect(transport);

      // Parse request body for POST requests
      let body;
      if (req.method === "POST") {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        const rawBody = Buffer.concat(chunks).toString("utf-8");
        body = rawBody ? JSON.parse(rawBody) : undefined;
      }

      await transport.handleRequest(req, res, body);

      // Clean up when request closes
      res.on("close", () => {
        transport.close();
      });
    } catch (error) {
      console.error("Error handling MCP request:", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error",
          },
          id: null,
        })
      );
    }
    return;
  }

  // 404
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`✨ OpenChem MCP Server v${VERSION}`);
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
  console.log(`\n💡 To connect Claude Desktop, add to config:`);
  console.log(`   ~/Library/Application Support/Claude/claude_desktop_config.json`);
  console.log(`\n   {`);
  console.log(`     "mcpServers": {`);
  console.log(`       "openchem": {`);
  console.log(`         "url": "http://localhost:${PORT}/mcp"`);
  console.log(`       }`);
  console.log(`     }`);
  console.log(`   }`);
  console.log(`\n📚 Documentation: npm home openchem`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n\n👋 Shutting down OpenChem MCP server...");
  httpServer.close(() => {
    console.log("✅ Server stopped");
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  console.log("\n\n👋 Shutting down OpenChem MCP server...");
  httpServer.close(() => {
    console.log("✅ Server stopped");
    process.exit(0);
  });
});

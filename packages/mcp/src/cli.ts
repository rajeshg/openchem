#!/usr/bin/env node

/**
 * OpenChem MCP Server CLI
 * 
 * Usage:
 *   openchem-mcp                    # Start in stdio mode (for VS Code, IDEs)
 *   openchem-mcp --http             # Start HTTP server (for Claude Desktop)
 *   openchem-mcp --http --port 8080 # Start HTTP server on custom port
 *   openchem-mcp --help             # Show help
 */

import { createServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./mcp-tools.js";

// Parse command line arguments
const args = process.argv.slice(2);
const help = args.includes("--help") || args.includes("-h");
const useHttp = args.includes("--http");
const portIndex = args.findIndex(arg => arg === "--port" || arg === "-p");
const customPort = portIndex >= 0 ? args[portIndex + 1] : undefined;

if (help) {
  console.log(`
OpenChem MCP Server - Chemistry analysis for AI assistants

USAGE:
  openchem-mcp [OPTIONS]

OPTIONS:
  --http               Start HTTP server (default: stdio mode)
  --port, -p <PORT>    Server port (default: 4141, only with --http)
  --help, -h           Show this help message

MODES:
  stdio mode (default) - For VS Code, Cursor, and other IDE integrations
  HTTP mode (--http)   - For Claude Desktop and remote clients

EXAMPLES:
  # VS Code / IDE integration (stdio mode)
  openchem-mcp

  # Claude Desktop (HTTP mode)
  openchem-mcp --http
  openchem-mcp --http --port 8080

AVAILABLE TOOLS:
  • analyze      - Complete molecular analysis (40+ descriptors, drug-likeness, IUPAC)
  • compare      - Molecular similarity (Morgan fingerprints, Tanimoto)
  • search       - Substructure matching (SMARTS patterns)
  • render       - 2D structure visualization (SVG/PNG)
  • convert      - Format conversion (canonical SMILES, IUPAC, scaffold)
  • identifiers  - Generate InChI, InChIKey, canonical identifiers
  • tautomers    - Enumerate and score molecular tautomers
  • fileConvert  - MOL/SDF file format conversion

VS CODE INTEGRATION:
  Add to .vscode/mcp.json:
  {
    "servers": {
      "openchem": {
        "command": "npx",
        "args": ["@openchem/mcp"],
        "type": "stdio"
      }
    }
  }

CLAUDE DESKTOP INTEGRATION:
  Add to ~/Library/Application Support/Claude/claude_desktop_config.json:
  {
    "mcpServers": {
      "openchem": {
        "url": "http://localhost:4141/mcp"
      }
    }
  }

DOCUMENTATION:
  https://github.com/rajeshg/openchem
  npm home openchem

For detailed integration guides, see:
  https://github.com/rajeshg/openchem/blob/main/docs/mcp-integration-guide.md
`);
  process.exit(0);
}

const VERSION = "0.1.6";

// Create MCP server
const mcpServer = new McpServer({
  name: useHttp ? "openchem-remote" : "openchem",
  version: VERSION,
});

// Register all tools
registerTools(mcpServer);

// Start in appropriate mode
if (useHttp) {
  // HTTP mode - for Claude Desktop and remote clients
  startHttpServer();
} else {
  // stdio mode - for VS Code, Cursor, and other IDE integrations
  startStdioServer();
}

async function startStdioServer() {
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  
  // Log to stderr so it doesn't interfere with stdio communication
  console.error("✨ OpenChem MCP Server (stdio mode)");
  console.error("🔌 Connected via stdio transport");
  console.error("🧪 8 chemistry tools available");
}

function startHttpServer() {
  const PORT = customPort ? Number.parseInt(customPort, 10) : Number.parseInt(process.env.PORT || "4141", 10);

  if (Number.isNaN(PORT) || PORT < 1 || PORT > 65535) {
    console.error(`Error: Invalid port number: ${customPort || process.env.PORT}`);
    process.exit(1);
  }

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

  httpServer.listen(PORT, () => {
    console.log(`✨ OpenChem MCP Server v${VERSION} (HTTP mode)`);
    console.log(`📍 Running on http://localhost:${PORT}`);
    console.log(`🏥 Health: http://localhost:${PORT}/health`);
    console.log(`🔌 MCP endpoints:`);
    console.log(`   • http://localhost:${PORT}/mcp`);
    console.log(`   • http://localhost:${PORT}/mcp/sse`);
    console.log(`\n🧪 Available tools (8 total):`);
    console.log(`   • analyze      - Complete molecular analysis`);
    console.log(`   • compare      - Similarity comparison`);
    console.log(`   • search       - Substructure matching`);
    console.log(`   • render       - 2D visualization (SVG/PNG)`);
    console.log(`   • convert      - Format conversion`);
    console.log(`   • identifiers  - InChI/InChIKey generation`);
    console.log(`   • tautomers    - Tautomer enumeration`);
    console.log(`   • fileConvert  - MOL/SDF conversion`);
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
}

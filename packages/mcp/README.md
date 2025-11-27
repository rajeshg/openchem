# @openchem/mcp

Model Context Protocol (MCP) server for [OpenChem](https://npmjs.com/package/openchem) - AI assistant integration for chemistry analysis.

## Features

- 🚀 **Streamable HTTP + SSE transport** for remote AI assistant connections
- 🧪 **5 composite chemistry tools** for complete workflows
- 🔌 **Claude Desktop integration** out of the box
- 📦 **Zero-config CLI** - just run `openchem-mcp`
- 🏥 **Built-in health check** endpoint

## Installation

```bash
npm install -g @openchem/mcp
```

This will install both `@openchem/mcp` and its peer dependency `openchem`.

## Quick Start

```bash
# Start MCP server
openchem-mcp

# Start on custom port
openchem-mcp --port 8080

# Or via environment variable
PORT=9000 openchem-mcp
```

The server will start on `http://localhost:4141` by default.

## Available Tools

### 1. **analyze** - Complete Molecular Analysis

Comprehensive analysis including:
- SMILES parsing and canonicalization
- 40+ molecular descriptors
- Drug-likeness assessment (Lipinski, Veber rules)
- IUPAC name generation
- Optional 2D SVG rendering

**Example:**
```typescript
{
  "name": "analyze",
  "arguments": {
    "smiles": "CC(=O)Oc1ccccc1C(=O)O",
    "includeRendering": true
  }
}
```

### 2. **compare** - Molecular Similarity

Compare two molecules using:
- Morgan fingerprints (ECFP)
- Tanimoto similarity
- Property comparison

**Example:**
```typescript
{
  "name": "compare",
  "arguments": {
    "smiles1": "CC(=O)Oc1ccccc1C(=O)O",
    "smiles2": "CC(C)Cc1ccc(cc1)C(C)C(=O)O"
  }
}
```

### 3. **search** - Substructure Matching

Search for SMARTS patterns:
- Match count and indices
- Support for complex patterns
- Aromatic and aliphatic matching

**Example:**
```typescript
{
  "name": "search",
  "arguments": {
    "smiles": "c1ccccc1",
    "pattern": "[#6]"
  }
}
```

### 4. **render** - 2D Structure Visualization

Generate publication-quality SVG:
- Automatic layout
- Stereochemistry display
- Customizable size

**Example:**
```typescript
{
  "name": "render",
  "arguments": {
    "smiles": "c1ccccc1",
    "width": 400,
    "height": 400
  }
}
```

### 5. **convert** - Format Conversion

Convert between formats:
- Canonical SMILES
- IUPAC names
- Murcko scaffolds

**Example:**
```typescript
{
  "name": "convert",
  "arguments": {
    "smiles": "CC(=O)Oc1ccccc1C(=O)O",
    "outputFormat": "iupac"
  }
}
```

## Integration with Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "openchem": {
      "url": "http://localhost:4141/mcp"
    }
  }
}
```

Restart Claude Desktop and try:

> "Analyze aspirin using SMILES CC(=O)Oc1ccccc1C(=O)O"

## Programmatic Usage

You can also use the MCP server programmatically:

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const client = new Client(
  { name: "my-app", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

const transport = new StreamableHTTPClientTransport(
  new URL("http://localhost:4141/mcp")
);

await client.connect(transport);

const result = await client.callTool("analyze", {
  smiles: "CC(=O)Oc1ccccc1C(=O)O",
  includeRendering: false
});

console.log(result);
```

## Endpoints

- `GET /health` - Health check
- `POST /mcp` - Main MCP endpoint (HTTP + SSE)
- `POST /mcp/sse` - MCP endpoint (alias)

## Configuration

### Environment Variables

- `PORT` - Server port (default: 3000)
- `VERBOSE` - Enable debug logging (set to "1")

### CORS

CORS is enabled by default (`Access-Control-Allow-Origin: *`). For production, consider restricting origins.

## Requirements

- Node.js 18+
- `openchem` ^0.2.11 (installed automatically as peer dependency)

## Documentation

- **[Integration Guide](https://github.com/rajeshg/openchem/blob/main/docs/mcp-integration-guide.md)** - Complete integration guide
- **[API Reference](https://github.com/rajeshg/openchem/blob/main/docs/mcp-server-remote.md)** - Detailed API documentation
- **[OpenChem Docs](https://github.com/rajeshg/openchem)** - Core library documentation

## Deployment

### Docker

```dockerfile
FROM node:18-alpine
RUN npm install -g @openchem/mcp
EXPOSE 3000
CMD ["openchem-mcp"]
```

### Cloud Platforms

- **Fly.io**: `flyctl launch`
- **Railway**: Connect repo and deploy
- **Render**: Web service deployment
- **DigitalOcean**: App Platform deployment

See the [integration guide](https://github.com/rajeshg/openchem/blob/main/docs/mcp-integration-guide.md) for detailed deployment instructions.

## Troubleshooting

### Server won't start

```bash
# Check if port is in use
lsof -i :3000

# Use different port
openchem-mcp --port 8080
```

### Claude Desktop can't connect

1. Ensure server is running: `curl http://localhost:3000/health`
2. Check config file exists: `cat ~/Library/Application\ Support/Claude/claude_desktop_config.json`
3. Restart Claude Desktop

### Tools return errors

- Validate SMILES syntax
- Check server logs with `VERBOSE=1 openchem-mcp`

## Performance

Typical response times:
- **analyze** (no rendering): 50-200ms
- **analyze** (with rendering): 100-400ms
- **compare**: 100-300ms
- **search**: 20-100ms
- **render**: 50-200ms
- **convert**: 20-150ms

## License

MIT - Same as [OpenChem](https://github.com/rajeshg/openchem)

## Links

- **npm**: https://npmjs.com/package/@openchem/mcp
- **GitHub**: https://github.com/rajeshg/openchem
- **OpenChem Library**: https://npmjs.com/package/openchem
- **Issues**: https://github.com/rajeshg/openchem/issues

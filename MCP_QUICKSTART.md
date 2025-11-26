# OpenChem MCP Server - Quick Test

## Start the server

```bash
bun run mcp:remote
```

## Test with curl

### Health check
```bash
curl http://localhost:3000/health
```

### Initialize MCP session (requires proper headers)
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream, application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "test", "version": "1.0.0"}
    },
    "id": 1
  }'
```

### Call a tool (after initialization)
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "Mcp-Session-Id: <session-id-from-init>" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "analyze",
      "arguments": {
        "smiles": "CCO"
      }
    },
    "id": 2
  }'
```

## Using with MCP clients

The recommended way to use this server is with an MCP client library or tool:

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "openchem": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

### Other MCP Clients

Any MCP client supporting Streamable HTTP transport can connect to:
- **Endpoint**: `http://localhost:3000/mcp` or `http://localhost:3000/mcp/sse`
- **Transport**: Streamable HTTP (HTTP + SSE)
- **Protocol Version**: 2024-11-05

Both `/mcp` and `/mcp/sse` routes are supported for flexibility.

## Available Tools

1. **analyze** - Complete molecular analysis
2. **compare** - Similarity comparison
3. **search** - Substructure matching
4. **render** - 2D visualization
5. **convert** - Format conversion

See [full documentation](./docs/mcp-server-remote.md) for details.

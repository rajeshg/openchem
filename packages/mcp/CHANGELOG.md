# Changelog - @openchem/mcp

All notable changes to @openchem/mcp will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.2] - 2025-11-27

### Changed

- **Default port changed to 4141** - Avoid conflicts with other webapps (previously 3000)
- Updated all documentation to reflect port 4141

## [0.1.1] - 2025-11-27

### Fixed

- **Stateless transport mode** - Use `sessionIdGenerator: undefined` to avoid "Server not initialized" errors
- **Request body parsing** - Properly parse JSON body for POST requests before passing to `handleRequest`
- **Transport cleanup** - Close transport when request ends to prevent memory leaks
- **Error handling** - Add try/catch around MCP request handling with proper 500 error responses

### Changed

- `.vscode/mcp.json` - Updated default port from 8080 to 3000 to match server default

## [0.1.0] - 2025-11-27

### 🎉 Initial Release

OpenChem MCP server for AI assistant integration. Extracted from `openchem` core package for better separation of concerns.

### Added

- **Streamable HTTP + SSE transport** for remote AI assistant connections
- **5 composite chemistry tools**:
  - `analyze` - Complete molecular analysis (40+ descriptors, drug-likeness, IUPAC name, optional rendering)
  - `compare` - Molecular similarity (Morgan fingerprints, Tanimoto similarity, property comparison)
  - `search` - Substructure matching (SMARTS patterns with match counts and indices)
  - `render` - 2D structure visualization (publication-quality SVG)
  - `convert` - Format conversion (canonical SMILES, IUPAC names, Murcko scaffolds)
- **Zero-config CLI** - `openchem-mcp` command
- **Built-in health check** endpoint (`/health`)
- **CORS enabled** for remote access
- **Claude Desktop integration** out of the box
- **Comprehensive documentation**

### Installation

```bash
npm install -g @openchem/mcp
openchem-mcp
```

### Requirements

- Node.js 18+
- `openchem` >=0.2.10 (installed automatically as peer dependency)

### Links

- **npm**: https://npmjs.com/package/@openchem/mcp
- **GitHub**: https://github.com/rajeshg/openchem
- **Documentation**: https://github.com/rajeshg/openchem/blob/main/docs/mcp-integration-guide.md

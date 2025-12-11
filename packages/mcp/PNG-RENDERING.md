# PNG Rendering in OpenChem MCP

Display molecular structures as inline images in GitHub Copilot Chat and other MCP clients.

## Quick Start

### Display Image Inline (Recommended)

```json
{
  "tool": "render",
  "arguments": {
    "smiles": "c1ccccc1",
    "format": "png"
  }
}
```

**Result**: PNG image displays directly in chat window ✨

### Custom Size

```json
{
  "tool": "render",
  "arguments": {
    "smiles": "CC(=O)Oc1ccccc1C(=O)O",
    "format": "png",
    "width": 500,
    "height": 500
  }
}
```

### Save to File

```json
{
  "tool": "render",
  "arguments": {
    "smiles": "c1ccccc1",
    "format": "png",
    "outputPath": "/tmp/benzene.png"
  }
}
```

**Result**: File saved to disk, confirmation message returned

## Format Options

| Format          | Output                         | Best For                                 |
| --------------- | ------------------------------ | ---------------------------------------- |
| `png` (default) | Base64 PNG in MCP `image` type | **Inline display in chat** (recommended) |
| `svg`           | SVG XML string                 | Lightweight, editable vector graphics    |

## Examples for Copilot

### Simple Rendering

**User**: "Show me what benzene looks like"  
**Copilot calls**:

```json
{
  "tool": "render",
  "arguments": {
    "smiles": "c1ccccc1",
    "format": "png"
  }
}
```

### Side-by-Side Comparison

**User**: "Show me aspirin and ibuprofen side by side"  
**Copilot calls**:

```json
[
  {
    "tool": "render",
    "arguments": {
      "smiles": "CC(=O)Oc1ccccc1C(=O)O",
      "format": "png",
      "width": 400,
      "height": 400
    }
  },
  {
    "tool": "render",
    "arguments": {
      "smiles": "CC(C)Cc1ccc(cc1)C(C)C(=O)O",
      "format": "png",
      "width": 400,
      "height": 400
    }
  }
]
```

### Large Molecule

**User**: "Draw cholesterol in high resolution"  
**Copilot calls**:

```json
{
  "tool": "render",
  "arguments": {
    "smiles": "CC(C)CCCC(C)C1CCC2C1(CCC3C2CC=C4C3(CCC(C4)O)C)C",
    "format": "png",
    "width": 600,
    "height": 600
  }
}
```

## Technical Details

### MCP Response Format

When `format: "png"` is used without `outputPath`, the tool returns:

```json
{
  "content": [
    {
      "type": "image",
      "data": "iVBORw0KGgoAAAANSUhEUgAA...",
      "mimeType": "image/png"
    },
    {
      "type": "text",
      "text": "{\"smiles\":\"c1ccccc1\",\"format\":\"png\",\"width\":300,\"height\":300}"
    }
  ]
}
```

The `image` content type is automatically recognized by MCP clients (VS Code Copilot, Claude Desktop, etc.) and displayed inline.

### Image Generation

1. **SMILES → Molecule**: Parse SMILES string
2. **2D Layout**: Generate 2D coordinates using distance geometry
3. **SVG Rendering**: Create publication-quality SVG
4. **PNG Conversion**: Convert SVG to PNG using `@resvg/resvg-js` (Rust-based, high quality)
5. **Base64 Encoding**: Encode for MCP transport

### Performance

- **Simple molecules** (< 20 atoms): ~50-100ms
- **Drug-like molecules** (20-60 atoms): ~100-200ms
- **Complex molecules** (60+ atoms): ~200-400ms

### Image Quality

- **Resolution**: Configurable width/height (default: 300x300)
- **Anti-aliasing**: Enabled
- **Rendering engine**: Resvg (production-grade SVG renderer)
- **File size**: Typical 5-20 KB per image

## Troubleshooting

### Image Not Displaying

1. **Check format parameter**: Must be `"png"` (not `"PNG"`)
2. **Verify SMILES**: Invalid SMILES will throw error
3. **Update MCP package**: Ensure `@openchem/mcp` >= 0.1.5
4. **Restart VS Code**: May need to reload MCP server

### Image Too Small

Increase width/height:

```json
{
  "width": 600,
  "height": 600
}
```

Recommended sizes:

- **Simple molecules**: 300-400px
- **Drug-like molecules**: 400-500px
- **Complex natural products**: 600-800px

### Save to File Instead

Add `outputPath` parameter:

```json
{
  "format": "png",
  "outputPath": "/tmp/molecule.png"
}
```

**Note**: When `outputPath` is provided, the image is NOT displayed inline (only confirmation message returned).

## See Also

- [MCP Example Questions](./docs/mcp-example-questions.md)
- [MCP Integration Guide](../../docs/mcp-integration-guide.md)
- [OpenChem README](../../README.md)

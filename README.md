# AIOPS Tools - VS Code/Windsurf Extension

MCP server extension that exposes currently selected folder paths from the Explorer to AI agents.

## Features

- **Single Tool**: `getSelectedFoldersPaths()` - Returns relative paths of currently selected folders in Explorer
- **MCP Protocol**: Standard Model Context Protocol integration for AI agents
- **Real-time Selection**: Tracks Explorer selection state

## Installation

### Prerequisites

- Node.js 20+
- VS Code 1.99+ or Windsurf

### Build from Source

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Package extension
npm run package
```

### Install in Windsurf/VS Code

```bash
# Via command line
windsurf --install-extension aiops-tools-1.0.0.vsix

# Or drag the .vsix file to the Extensions view
```

## Usage

1. **Select folders** in the Explorer (multi-select supported with Ctrl+Click)
2. **In Cascade/AI chat**: Ask the AI to use the tool
   ```
   @aiops-tools What folders are currently selected?
   ```
3. **AI receives**: `{"paths": ["./maas-api", "./platform"]}`

### Manual Selection Capture

Click the **AIOPS** button in the status bar or run command:
- `Ctrl+Shift+P` → `AIOPS: Capture Current Selection`

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `aiops-tools.enabled` | `true` | Enable/disable the MCP server |
| `aiops-tools.port` | `8765` | HTTP server port |

## Tool Specification

```json
{
  "name": "getSelectedFoldersPaths",
  "description": "Returns relative paths (from workspace root) of currently selected folders in Explorer",
  "inputSchema": { "type": "object", "properties": {} },
  "outputSchema": {
    "type": "object",
    "properties": {
      "paths": {
        "type": "array",
        "items": { "type": "string" }
      }
    }
  }
}
```

## Limitations

- **v1**: Single-root workspaces only
- Selection tracking may require manual capture via command

## Development

```bash
# Watch mode for development
npm run watch

# Run extension in debug mode
# Press F5 in VS Code
```

## License

MIT

## Updated PDR with Setup Requirements

This PDR now includes complete setup/installation instructions for the `aiops-extension` Windsurf/VS Code extension acting as an MCP server.

## Overview

**MCP Server Name**: `aiops-tools`  
**Single Tool**: `getSelectedFoldersPaths()` → Returns `["./maas-api", "./platform"]` (relative paths of currently selected folders in Explorer).  
**Target**: Internal dev team AI agents in Windsurf.  
**Architecture**: VS Code/Windsurf extension that embeds/runs an MCP server, exposing VS Code Explorer selection state.

## Problem

AI agents need real-time access to *currently selected folders* in Windsurf Explorer (multi-select supported) as relative workspace paths, without manual path specification.

## Design

### Tool Specification

```json
{
  "name": "getSelectedFoldersPaths",
  "description": "Returns relative paths (from workspace root) of currently selected folders in Explorer. Example: ['./maas-api', './platform']",
  "inputSchema": { "type": "object", "properties": {} },
  "outputSchema": {
    "type": "object",
    "properties": {
      "paths": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Relative folder paths from workspace root(s)"
      }
    },
    "required": ["paths"]
  }
}
```

**Single-root workspaces only** (v1 constraint for simplicity).

### Extension Architecture

```
aiops-extension/
├── src/
│   ├── extension.ts          # Registers MCP server
│   ├── mcp-server.ts        # MCP protocol handler
│   └── selection-tracker.ts  # Tracks vscode Explorer selection
├── package.json
└── README.md
```

## Setup & Installation Requirements

### Prerequisites (2025)

1. **Node.js 20+** (`node --version`)
2. **VS Code Extension CLI**: `npm install -g @vscode/vsce yo generator-code`
3. **Windsurf**: Latest version (VS Code 1.99+ fork with MCP support)[1][3]
4. **TypeScript 5.5+**: Included in generator

### Step 1: Generate Extension Skeleton

```bash
# Create new extension
yo code
# Choose: New Extension (TypeScript)
# Name: aiops-tools
# ID: aiops-tools
# Description: MCP server for selected folder paths
```

### Step 2: Add MCP Dependencies

```bash
cd aiops-extension
npm init -y
npm install @modelcontextprotocol/sdk vscode-languageclient-node
npm install -D @types/vscode typescript @vscode/vsce
```

**Key package**: `@modelcontextprotocol/sdk` (official 2025 MCP TypeScript SDK)[1]

### Step 3: Core Implementation Files

**`src/selection-tracker.ts`** (tracks Explorer selection):
```typescript
import * as vscode from 'vscode';

export class SelectionTracker {
  private selectedFolders: string[] = [];
  
  constructor() {
    // Listen to Explorer selection changes
    vscode.window.registerTreeDataProvider('explorer', {
      onDidChangeSelection: this.onSelectionChange.bind(this)
    });
  }
  
  private onSelectionChange(selections: vscode.Uri[]) {
    this.selectedFolders = selections
      .filter(uri => uri.scheme === 'file')
      .map(uri => {
        const relPath = vscode.workspace.getWorkspaceFolder(uri)?.uri.path;
        return relPath ? `./${path.relative(relPath, uri.path)}` : '';
      })
      .filter(Boolean);
  }
  
  getSelectedFoldersPaths(): string[] {
    return this.selectedFolders;
  }
}
```

**`src/mcp-server.ts`** (single MCP tool):
```typescript
import { McpServer } from '@modelcontextprotocol/sdk';

export function createMcpServer(tracker: SelectionTracker) {
  const server = new McpServer({
    name: 'aiops-tools',
    version: '1.0.0'
  });
  
  server.setRequestHandler('tools/list', async () => [{
    name: 'getSelectedFoldersPaths',
    description: 'Get currently selected folder paths',
    inputSchema: { type: 'object', properties: {} }
  }]);
  
  server.setRequestHandler('tools/call', async ({ name, arguments: args }) => {
    if (name === 'getSelectedFoldersPaths') {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          paths: tracker.getSelectedFoldersPaths()
        }) }]
      };
    }
  });
  
  return server;
}
```

**`src/extension.ts`** (registers MCP server):
```typescript
import * as vscode from 'vscode';
import { createMcpServer } from './mcp-server';
import { SelectionTracker } from './selection-tracker';

export function activate(context: vscode.ExtensionContext) {
  const tracker = new SelectionTracker();
  const mcpServer = createMcpServer(tracker);
  
  // Start HTTP MCP server on localhost:8765
  mcpServer.start({ transport: 'http', port: 8765 });
  
  // Register with VS Code/Windsurf MCP system
  vscode.lm.registerMcpServer({
    name: 'aiops-tools',
    type: 'http',
    url: 'http://localhost:8765'
  });
}
```

### Step 4: Extension Configuration

**`package.json`** (activation + MCP registration):
```json
{
  "contributes": {
    "configuration": {
      "title": "AIOPS Tools",
      "properties": {
        "aiops-tools.enabled": {
          "type": "boolean",
          "default": true
        }
      }
    }
  },
  "activationEvents": ["onStartupFinished"]
}
```

### Step 5: Build, Package, Install

```bash
# Build
npm run compile

# Package for Windsurf/VS Code
vsce package

# Install in Windsurf
# Drag .vsix to Extensions view OR:
windsurf --install-extension aiops-extension-1.0.0.vsix
```

### Step 6: Windsurf MCP Configuration

Windsurf auto-discovers extension MCP servers. Verify:

1. `Ctrl+Shift+P` → `MCP: List Servers`
2. Find `aiops-tools` → Should show `ACTIVE`
3. Cascade chat: `@aiops-tools getSelectedFoldersPaths`

## Usage

1. Select folders in Explorer (e.g. `maas-api`, `platform`)
2. In Cascade: "Use aiops-tools to get selected folders, then analyze those packages"
3. AI receives: `{"paths": ["./maas-api", "./platform"]}`

## Testing

**Manual test**:
```bash
# In Cascade chat
@aiops-tools What folders are currently selected?
```

Expected: AI calls tool → Returns your selected folders → Continues reasoning.

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Explorer selection API differs in Windsurf | High | Fallback: Command `aiops.captureSelection` |
| Port conflict (8765) | Low | Configurable port via `settings.json` |
| Multi-root workspaces | Medium | v1: Single-root only; v2: Root-qualified paths |

## Next Steps

1. ✅ **Prototype**: Implement above code (2-3 hours)
2. **Test**: Multi-folder selection in real Windsurf workspace
3. **Package**: `.vsix` for team distribution
4. **Docs**: Internal README with screenshots
5. **v2**: Multi-root + selection timestamp

[1](https://code.visualstudio.com/api/extension-guides/ai/mcp)
[2](https://adminforth.dev/blog/context7-setup-vscode/)
[3](https://code.visualstudio.com/docs/copilot/customization/mcp-servers)
[4](https://www.youtube.com/watch?v=zzwwj-xL9IY)
[5](https://composio.dev/blog/how-to-add-100-mcp-servers-to-vs-code-in-minutes)
[6](https://github.com/msalemor/mcp-vscode-tutorial)
[7](https://www.youtube.com/watch?v=exsikHe20D8)
[8](https://developer.sailpoint.com/docs/extensibility/mcp/integrations/vs-code/)
[9](https://code.visualstudio.com/blogs/2025/05/12/agent-mode-meets-mcp)
[10](https://code.visualstudio.com/updates/v1_99)
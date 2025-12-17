import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as vscode from "vscode";
import { createMcpServer, McpHttpServer, startMcpServer } from "./mcp-server";
import { SelectionTracker } from "./selection-tracker";

let tracker: SelectionTracker | undefined;
let mcpServer: McpServer | undefined;
let httpServer: McpHttpServer | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const config = vscode.workspace.getConfiguration("aiops-tools");
  const enabled = config.get<boolean>("enabled", true);

  if (!enabled) {
    console.log("AIOPS Tools is disabled");
    return;
  }

  console.log("AIOPS Tools extension is activating...");

  // Initialize selection tracker
  tracker = new SelectionTracker();
  context.subscriptions.push({ dispose: () => tracker?.dispose() });

  // Create and start MCP server
  mcpServer = createMcpServer(tracker);
  const port = config.get<number>("port", 8765);

  try {
    httpServer = await startMcpServer(mcpServer, port);
    console.log(`AIOPS Tools MCP server started on port ${port}`);

    vscode.window.showInformationMessage(
      `AIOPS Tools MCP server active on http://127.0.0.1:${port}/mcp`
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to start MCP server:", errorMessage);
    vscode.window.showErrorMessage(`AIOPS Tools: Failed to start MCP server - ${errorMessage}`);
  }

  // Register status bar item
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = "$(folder) AIOPS";
  statusBarItem.tooltip = "AIOPS Tools MCP Server Active";
  statusBarItem.command = "aiops.captureSelection";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  console.log("AIOPS Tools extension activated successfully");
}

export function deactivate(): void {
  console.log("AIOPS Tools extension is deactivating...");

  if (tracker) {
    tracker.dispose();
    tracker = undefined;
  }

  if (httpServer) {
    httpServer.close().catch(console.error);
    httpServer = undefined;
  }

  if (mcpServer) {
    mcpServer.close().catch(console.error);
    mcpServer = undefined;
  }

  console.log("AIOPS Tools extension deactivated");
}

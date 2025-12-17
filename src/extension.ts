import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import * as vscode from "vscode";
import { createMcpServer, startMcpServer } from "./mcp-server";
import { SelectionTracker } from "./selection-tracker";

let tracker: SelectionTracker | undefined;
let mcpServer: Server | undefined;

export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
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

  try {
    await startMcpServer(mcpServer);
    console.log("AIOPS Tools MCP server started");

    vscode.window.showInformationMessage("AIOPS Tools MCP server is active");
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to start MCP server:", errorMessage);
    vscode.window.showErrorMessage(
      `AIOPS Tools: Failed to start MCP server - ${errorMessage}`
    );
  }

  // Register status bar item
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
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

  if (mcpServer) {
    mcpServer.close().catch(console.error);
    mcpServer = undefined;
  }

  console.log("AIOPS Tools extension deactivated");
}

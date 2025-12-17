import * as path from "path";
import * as vscode from "vscode";

export class SelectionTracker {
  private selectedFolders: string[] = [];
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.setupSelectionTracking();
  }

  private setupSelectionTracking(): void {
    // Track selection changes in the Explorer
    // VS Code doesn't have a direct API for Explorer selection,
    // so we use a command-based approach as fallback

    // Register command to manually capture selection
    const captureCommand = vscode.commands.registerCommand(
      "aiops.captureSelection",
      async () => {
        await this.captureCurrentSelection();
      }
    );
    this.disposables.push(captureCommand);

    // Listen to active editor changes as a proxy for selection activity
    const editorChange = vscode.window.onDidChangeActiveTextEditor(() => {
      // Could trigger selection update here if needed
    });
    this.disposables.push(editorChange);
  }

  async captureCurrentSelection(): Promise<void> {
    // Get the currently selected resources in Explorer via command
    try {
      const selectedUris = await vscode.commands.executeCommand<vscode.Uri[]>(
        "explorer.getSelection"
      );

      if (selectedUris && Array.isArray(selectedUris)) {
        this.updateSelectionFromUris(selectedUris);
      }
    } catch {
      // Command may not be available, selection remains unchanged
    }
  }

  private updateSelectionFromUris(uris: vscode.Uri[]): void {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      this.selectedFolders = [];
      return;
    }

    const workspaceRoot = workspaceFolder.uri.fsPath;

    this.selectedFolders = uris
      .filter((uri) => uri.scheme === "file")
      .map((uri) => {
        const relativePath = path.relative(workspaceRoot, uri.fsPath);
        // Normalize to forward slashes and prefix with ./
        const normalized = relativePath.replace(/\\/g, "/");
        return normalized ? `./${normalized}` : ".";
      })
      .filter((p) => p !== ".");
  }

  async getSelectedFoldersPaths(): Promise<string[]> {
    // Always try to get fresh selection
    await this.captureCurrentSelection();
    return this.selectedFolders;
  }

  getSelectedFoldersPathsSync(): string[] {
    return this.selectedFolders;
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}

import * as vscode from "vscode";

export function workspaceFileUri(root: string, relativePath: string): vscode.Uri {
  return vscode.Uri.joinPath(
    vscode.Uri.file(root.replace(/[\\/]+$/u, "")),
    ...relativePath.split("/").filter((part) => part !== ""),
  );
}

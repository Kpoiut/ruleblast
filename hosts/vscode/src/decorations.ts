import * as vscode from "vscode";
import {
  toRepositoryRelativePath,
  type PresentationSnapshot,
  type ResourceDecoration,
} from "../engine/application/authority.js";

const DECORATION_COLOR: Readonly<Partial<Record<ResourceDecoration["badge"], string>>> = {
  "≠": "list.warningForeground",
  "?": "list.warningForeground",
};

export class RuleBlastDecorationProvider implements vscode.FileDecorationProvider {
  private readonly emitter = new vscode.EventEmitter<vscode.Uri | undefined>();
  private snapshot: PresentationSnapshot | null = null;
  private root: string | null = null;

  readonly onDidChangeFileDecorations = this.emitter.event;

  public refresh(snapshot: PresentationSnapshot, root?: string): void {
    this.snapshot = snapshot;
    if (root !== undefined) {
      this.root = root;
    }
    this.emitter.fire(undefined);
  }

  public provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    if (
      this.snapshot === null ||
      this.snapshot.workspaceTruth.phase !== "current" ||
      this.root === null
    ) {
      return undefined;
    }

    const relPath = toRepositoryRelativePath(this.root, uri.fsPath);
    if (relPath === null) {
      return undefined;
    }

    // O(1) Map lookup (GATE 13)
    const resource = this.snapshot.resourceIndex.get(relPath);
    if (resource === undefined || resource.decoration === null) {
      return undefined;
    }

    const dec = resource.decoration;
    const colorId = DECORATION_COLOR[dec.badge];
    const color = colorId !== undefined ? new vscode.ThemeColor(colorId) : undefined;

    const fileDec = new vscode.FileDecoration(dec.badge, dec.tooltip, color);
    fileDec.propagate = false; // GATE 14: no noise on parent folders
    return fileDec;
  }

  public dispose(): void {
    this.emitter.dispose();
  }
}

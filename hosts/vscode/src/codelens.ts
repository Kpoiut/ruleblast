import * as vscode from "vscode";
import {
  toRepositoryRelativePath,
  type PresentationSnapshot,
} from "../engine/application/authority.js";

export class InstructionLensProvider implements vscode.CodeLensProvider {
  private readonly emitter = new vscode.EventEmitter<void>();
  private snapshot: PresentationSnapshot | null = null;
  private root: string | null = null;

  readonly onDidChangeCodeLenses = this.emitter.event;

  public refresh(snapshot: PresentationSnapshot, root?: string): void {
    this.snapshot = snapshot;
    if (root !== undefined) {
      this.root = root;
    }
    this.emitter.fire();
  }

  public provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    if (this.snapshot === null || this.root === null) {
      return [];
    }

    const relPath = toRepositoryRelativePath(this.root, document.uri.fsPath);
    if (relPath === null) {
      return [];
    }

    // O(1) Map lookup (GATE 13)
    const resource = this.snapshot.resourceIndex.get(relPath);
    if (resource === undefined) return [];
    const range = new vscode.Range(0, 0, 0, 0);
    const source = resource.lens?.isInstructionSource === true ? resource.lens : null;

    if (source !== null && document.isDirty) {
      return [new vscode.CodeLens(range, { title: source.dirtyTitle, command: "" })];
    }
    if (this.snapshot.workspaceTruth.phase === "stale" && source !== null) {
      return [new vscode.CodeLens(range, {
        title: source.staleTitle,
        command: "ruleblast.diffFrom",
      })];
    }
    if (this.snapshot.workspaceTruth.phase !== "current") return [];

    const lenses: vscode.CodeLens[] = [];
    if (source !== null) {
      lenses.push(new vscode.CodeLens(range, {
        title: source.liveTitle,
        command: "ruleblast._openInstructionSource",
        arguments: [relPath],
      }));
    }
    if (resource.canCompare) {
      lenses.push(new vscode.CodeLens(range, {
        title: "RuleBlast · compare selected realities",
        command: "ruleblast._compareRealities",
        arguments: [relPath],
      }));
    }
    return lenses;
  }

  public dispose(): void {
    this.emitter.dispose();
  }
}

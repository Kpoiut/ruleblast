import * as vscode from "vscode";
import type {
  CompanionState,
  ScoreboardIntent,
  ScoreboardKind,
  ScoreboardNode,
} from "../engine/application/host-session.js";
import { companionTree } from "../engine/application/host-session.js";
import { CONTROL_BINDINGS } from "../engine/application/authority.js";

export type { ScoreboardNode };

const KIND_ICON: Readonly<Record<ScoreboardKind, string>> = {
  status: "pulse",
  control: "play",
  reality: "globe",
  error: "error",
  counts: "list-tree",
  profile: "person",
  uncertainty: "question",
  "instruction-source": "book",
  "affected-path": "file-code",
  explain: "info",
  observation: "eye",
  group: "folder",
};

const INTENT_COMMAND: Readonly<Record<ScoreboardIntent, string>> = {
  EXPLAIN_PATH: "ruleblast.explainScoreboardPath",
  OPEN_PATH: "vscode.open",
  RUN_SCAN: "ruleblast.scanWorkspace",
  RUN_DIFF: "ruleblast.diffFrom",
  RUN_EXPLAIN: "ruleblast.explainActiveFile",
  RUN_CASE: "ruleblast.openVerifiedCase",
  SELECT_REALITY: "ruleblast.selectReality",
};

export function scoreboardNodes(state: CompanionState): ScoreboardNode[] {
  return companionTree(state);
}

export class RuleBlastTreeProvider implements vscode.TreeDataProvider<ScoreboardNode> {
  private readonly emitter = new vscode.EventEmitter<ScoreboardNode | undefined>();
  private nodes: readonly ScoreboardNode[] = [];
  private root: string | null = null;
  readonly onDidChangeTreeData = this.emitter.event;

  public refresh(state: CompanionState, root?: string): void {
    this.nodes = scoreboardNodes(state);
    if (root !== undefined) this.root = root;
    this.emitter.fire(undefined);
  }

  public getTreeItem(element: ScoreboardNode): vscode.TreeItem {
    const collapsible = element.children && element.children.length > 0
      ? vscode.TreeItemCollapsibleState.Expanded
      : vscode.TreeItemCollapsibleState.None;
    const item = new vscode.TreeItem(element.label, collapsible);
    item.description = element.description;
    item.tooltip = tooltipFor(element);
    item.contextValue = element.kind;
    item.iconPath = new vscode.ThemeIcon(KIND_ICON[element.kind]);
    if (element.path !== undefined && this.root !== null) {
      item.resourceUri = vscode.Uri.file(
        `${this.root.replace(/[\\/]+$/u, "")}/${element.path}`,
      );
    }
    if (element.intent !== undefined) {
      item.command = commandFor(element, item.resourceUri);
    }
    return item;
  }

  public getChildren(element?: ScoreboardNode): ScoreboardNode[] {
    if (element === undefined) return [...this.nodes];
    return [...(element.children ?? [])];
  }
}

function tooltipFor(element: ScoreboardNode): string {
  const chord = CONTROL_BINDINGS.find((row) => row.intent === element.intent);
  const parts = [element.label];
  if (element.description !== undefined) parts.push(element.description);
  if (element.mark !== undefined) parts.push(element.mark);
  if (chord !== undefined) parts.push(`Ctrl+Alt+R ${chord.token}`);
  return parts.join(" · ");
}

function commandFor(
  element: ScoreboardNode,
  resourceUri: vscode.Uri | undefined,
): { command: string; title: string; arguments?: unknown[] } {
  const command = INTENT_COMMAND[element.intent!];
  if (element.intent === "OPEN_PATH" && resourceUri !== undefined) {
    return { command, title: "Open path", arguments: [resourceUri] };
  }
  if (element.path !== undefined &&
      (element.intent === "EXPLAIN_PATH" || element.intent === "OPEN_PATH")) {
    return { command, title: "Explain path", arguments: [element.path] };
  }
  return { command, title: element.label };
}

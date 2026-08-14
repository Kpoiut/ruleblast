import * as vscode from "vscode";
import type { CompanionState, ScoreboardNode } from "../../../dist/application/host-session.js";
import { companionTree } from "../../../dist/application/host-session.js";

export type { ScoreboardNode };

export function scoreboardNodes(state: CompanionState): ScoreboardNode[] {
  return companionTree(state);
}

export class RuleBlastTreeProvider implements vscode.TreeDataProvider<ScoreboardNode> {
  private readonly emitter = new vscode.EventEmitter<ScoreboardNode | undefined>();
  private nodes: readonly ScoreboardNode[] = [];
  readonly onDidChangeTreeData = this.emitter.event;

  public refresh(state: CompanionState): void {
    this.nodes = scoreboardNodes(state);
    this.emitter.fire(undefined);
  }

  public getTreeItem(element: ScoreboardNode): vscode.TreeItem {
    const collapsible = element.children && element.children.length > 0
      ? vscode.TreeItemCollapsibleState.Expanded
      : vscode.TreeItemCollapsibleState.None;
    const item = new vscode.TreeItem(element.label, collapsible);
    item.description = element.description;
    item.tooltip = element.description ?? element.label;
    return item;
  }

  public getChildren(element?: ScoreboardNode): ScoreboardNode[] {
    if (element === undefined) return [...this.nodes];
    return [...(element.children ?? [])];
  }
}

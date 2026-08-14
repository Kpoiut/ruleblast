import * as vscode from "vscode";
import type { CompanionState } from "../../../dist/application/host-session.js";
import { companionScoreboard, companionStatusLine } from "../../../dist/application/host-session.js";

export interface ScoreboardNode {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly children?: readonly ScoreboardNode[];
}

export function scoreboardNodes(state: CompanionState): ScoreboardNode[] {
  const board = companionScoreboard(state);
  const nodes: ScoreboardNode[] = [{
    id: "status",
    label: companionStatusLine(state),
  }];
  if (state.error !== null) {
    nodes.push({ id: "error", label: state.error.code, description: state.error.message });
  }
  if (board === null) {
    nodes.push({ id: "empty", label: "Run Scan Workspace, Diff From…, or Open Verified Case" });
    return nodes;
  }
  nodes.push({
    id: "counts",
    label: `${board.candidatePathCount} tracked paths`,
    description: board.changedStackPathCount === null
      ? `${board.currentSplitPathCount} split`
      : `${board.changedStackPathCount} changed`,
  });
  nodes.push({
    id: "profiles",
    label: "Profiles",
    children: board.profiles.map((profile) => ({
      id: `profile:${profile.profile}`,
      label: `${profile.badge} ${profile.shortLabel}`,
      description: profile.changedStackPathCount === null
        ? `${profile.completePathCount} complete`
        : `${profile.changedStackPathCount} changed`,
    })),
  });
  nodes.push({
    id: "uncertainty",
    label: "Uncertainty",
    description: `${board.partialPathCount} partial · ${board.unknownPathCount} unknown · ${board.findingCount} findings`,
  });
  return nodes;
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

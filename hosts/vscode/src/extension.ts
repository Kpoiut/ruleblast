import * as vscode from "vscode";
import {
  companionBegin,
  companionExplain,
  companionFail,
  companionMarkStale,
  companionNoteDirty,
  companionSucceed,
  diffRepository,
  explainRepository,
  findRepositoryRoot,
  gateWorkspace,
  initialCompanionState,
  openGitSnapshot,
  openPackagedCase,
  openTrackedWorktree,
  presentExplain,
  scanRepository,
  toRepositoryRelativePath,
  type CompanionState,
  type HostWorkspace,
} from "../../../dist/application/authority.js";
import { RuleBlastTreeProvider } from "./tree.js";

let state = initialCompanionState();

function workspaceGate(): HostWorkspace {
  const folders = (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath);
  const active = vscode.window.activeTextEditor?.document.uri;
  const selected = active === undefined
    ? undefined
    : vscode.workspace.getWorkspaceFolder(active)?.uri.fsPath;
  return {
    trusted: vscode.workspace.isTrusted,
    folders,
    selectedFolder: selected,
  };
}

function reveal(next: CompanionState, tree: RuleBlastTreeProvider, status: vscode.StatusBarItem): void {
  state = next;
  tree.refresh(state);
  status.text = `RB ${state.lifecycle}`;
  status.tooltip = state.error?.message ?? state.lifecycle;
  status.show();
}

async function withRoot(
  tree: RuleBlastTreeProvider,
  status: vscode.StatusBarItem,
  action: "scan" | "diff" | "explain" | "case",
  run: (root: string) => Promise<CompanionState>,
): Promise<void> {
  const gate = gateWorkspace(workspaceGate());
  if (!gate.ok) {
    reveal(companionFail(state, gate.code, gate.message), tree, status);
    vscode.window.showErrorMessage(gate.message);
    return;
  }
  reveal(companionBegin(state, action), tree, status);
  try {
    reveal(await run(gate.root), tree, status);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown host failure";
    reveal(companionFail(state, "ERROR", message), tree, status);
    vscode.window.showErrorMessage(message);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const tree = new RuleBlastTreeProvider();
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 80);
  reveal(state, tree, status);

  const watcher = vscode.workspace.createFileSystemWatcher("**/*");
  const stale = () => reveal(companionMarkStale(state), tree, status);
  watcher.onDidChange(stale);
  watcher.onDidCreate(stale);
  watcher.onDidDelete(stale);

  context.subscriptions.push(
    status,
    watcher,
    vscode.window.createTreeView("ruleblast.scoreboard", { treeDataProvider: tree }),
    vscode.commands.registerCommand("ruleblast.scanWorkspace", async () => {
      await withRoot(tree, status, "scan", async (folder) => {
        const root = await findRepositoryRoot(folder);
        const snapshot = await openTrackedWorktree(root);
        return companionSucceed(state, await scanRepository({ snapshot, reality: null }));
      });
    }),
    vscode.commands.registerCommand("ruleblast.diffFrom", async () => {
      const base = await vscode.window.showInputBox({
        prompt: "Diff base ref",
        value: "HEAD",
      });
      if (base === undefined || base.trim() === "") return;
      await withRoot(tree, status, "diff", async (folder) => {
        const root = await findRepositoryRoot(folder);
        const before = await openGitSnapshot(root, base.trim());
        const after = await openTrackedWorktree(root);
        return companionSucceed(state, await diffRepository({
          before,
          after,
          reality: null,
        }));
      });
    }),
    vscode.commands.registerCommand("ruleblast.explainActiveFile", async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor === undefined) {
        vscode.window.showErrorMessage("Open a file to explain.");
        return;
      }
      await withRoot(tree, status, "explain", async (folder) => {
        const root = await findRepositoryRoot(folder);
        const relative = toRepositoryRelativePath(root, editor.document.uri.fsPath);
        if (relative === null) {
          return companionFail(state, "INVALID_PATH", "Active file is outside the selected repository.");
        }
        const dirty = companionNoteDirty(state, editor.document.isDirty);
        const snapshot = await openTrackedWorktree(root);
        const explained = await explainRepository({
          snapshot,
          path: relative,
          reality: null,
        });
        const text = presentExplain(explained.explain);
        await vscode.window.showTextDocument(
          await vscode.workspace.openTextDocument({ content: text, language: "markdown" }),
        );
        return companionExplain(dirty, explained.view, text);
      });
    }),
    vscode.commands.registerCommand("ruleblast.openVerifiedCase", async () => {
      await withRoot(tree, status, "case", async () =>
        companionSucceed(state, await openPackagedCase()),
      );
    }),
  );
}

export function deactivate(): void {}

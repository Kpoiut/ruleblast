import * as vscode from "vscode";
import {
  companionBegin,
  companionExplain,
  companionExplainFromResult,
  companionFail,
  companionMarkStale,
  companionNoteDirty,
  companionSetReality,
  companionStatusLine,
  companionSucceed,
  diffRepository,
  explainRepository,
  findRepositoryRoot,
  gateWorkspace,
  initialCompanionState,
  optInRealityIds,
  openGitSnapshot,
  openPackagedCase,
  openTrackedWorktree,
  presentExplain,
  presentationLabel,
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
  status.tooltip = state.error?.message ?? companionStatusLine(state);
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
        return companionSucceed(state, await scanRepository({
          snapshot,
          reality: state.reality,
        }));
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
          reality: state.reality,
        }));
      });
    }),
    vscode.commands.registerCommand("ruleblast.explainActiveFile", async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor === undefined) {
        vscode.window.showErrorMessage("Open a file to explain.");
        return;
      }
      const gate = gateWorkspace(workspaceGate());
      if (!gate.ok) {
        reveal(companionFail(state, gate.code, gate.message), tree, status);
        vscode.window.showErrorMessage(gate.message);
        return;
      }
      const root = await findRepositoryRoot(gate.root);
      const relative = toRepositoryRelativePath(root, editor.document.uri.fsPath);
      if (relative === null) {
        reveal(companionFail(state, "INVALID_PATH", "Active file is outside the selected repository."), tree, status);
        return;
      }
      const dirty = companionNoteDirty(state, editor.document.isDirty);
      if (dirty.result !== null) {
        const next = companionExplainFromResult(dirty, relative, presentExplain);
        if (next.explainText !== null) {
          await vscode.window.showTextDocument(
            await vscode.workspace.openTextDocument({ content: next.explainText, language: "markdown" }),
          );
        } else {
          vscode.window.showErrorMessage(next.error?.message ?? "Last result has no path.");
        }
        reveal(next, tree, status);
        return;
      }
      await withRoot(tree, status, "explain", async () => {
        const snapshot = await openTrackedWorktree(root);
        const explained = await explainRepository({
          snapshot,
          path: relative,
          reality: dirty.reality,
        });
        const text = presentExplain(explained.explain);
        await vscode.window.showTextDocument(
          await vscode.workspace.openTextDocument({ content: text, language: "markdown" }),
        );
        return companionExplain(dirty, explained.view, text);
      });
    }),
    vscode.commands.registerCommand("ruleblast.selectReality", async () => {
      const picked = await vscode.window.showQuickPick(
        [
          { label: "Default (Codex + Claude Code)", reality: null },
          ...optInRealityIds().map((reality) => ({
            label: presentationLabel(reality),
            description: reality,
            reality,
          })),
        ],
        { title: "RuleBlast opt-in reality", placeHolder: "Adds one documented surface to the next scan or diff" },
      );
      if (picked === undefined) return;
      reveal(companionSetReality(state, picked.reality), tree, status);
    }),
    vscode.commands.registerCommand("ruleblast.openVerifiedCase", async () => {
      await withRoot(tree, status, "case", async () =>
        companionSucceed(state, await openPackagedCase()),
      );
    }),
  );
}

export function deactivate(): void {}

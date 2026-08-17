import * as vscode from "vscode";
import {
  companionBegin,
  companionExplain,
  companionExplainFromResult,
  companionFail,
  companionMarkStale,
  companionNoteDirty,
  companionSetRealities,
  companionStatusLine,
  companionSucceed,
  diffRepositoryWithAdjunct,
  explainRepository,
  findRepositoryRoot,
  gateWorkspace,
  initialCompanionState,
  optInRealityIds,
  openGitSnapshot,
  openPackagedCase,
  openTrackedWorktree,
  probeGitStorageFormat,
  presentExplain,
  presentationLabel,
  scanRepository,
  toRepositoryRelativePath,
  type CompanionState,
  type HostWorkspace,
} from "../engine/application/authority.js";
import { RuleBlastTreeProvider } from "./tree.js";

let state = initialCompanionState();

function fsPathOf(resource: unknown): string | undefined {
  if (typeof resource !== "object" || resource === null) return undefined;
  if (!("fsPath" in resource) || typeof resource.fsPath !== "string") return undefined;
  return resource.fsPath;
}

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

function currentRoot(): string | undefined {
  const gate = gateWorkspace(workspaceGate());
  return gate.ok ? gate.root : undefined;
}

function reveal(next: CompanionState, tree: RuleBlastTreeProvider, status: vscode.StatusBarItem): void {
  state = next;
  tree.refresh(state, currentRoot());
  status.text = `RB ${state.lifecycle}`;
  status.tooltip = state.error?.message ?? companionStatusLine(state);
  status.command = "ruleblast.scoreboard.focus";
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
          realities: state.realities,
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
        const pair = await diffRepositoryWithAdjunct({
          before,
          after,
          realities: state.realities,
          format: await probeGitStorageFormat(root),
        });
        return companionSucceed(state, pair.result, {
          overlay: pair.overlay,
          overlayUnavailable: pair.unavailable,
        });
      });
    }),
    vscode.commands.registerCommand("ruleblast.explainScoreboardPath", async (path: unknown) => {
      if (typeof path !== "string" || path === "") return;
      const next = companionExplainFromResult(state, path, presentExplain);
      if (next.explainText !== null) {
        await vscode.window.showTextDocument(
          await vscode.workspace.openTextDocument({ content: next.explainText, language: "markdown" }),
        );
      } else {
        vscode.window.showErrorMessage(next.error?.message ?? "Last result has no path.");
      }
      reveal(next, tree, status);
    }),
    vscode.commands.registerCommand("ruleblast.explainActiveFile", async (resource?: unknown) => {
      const fsPath = fsPathOf(resource) ?? vscode.window.activeTextEditor?.document.uri.fsPath;
      if (fsPath === undefined) {
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
      const relative = toRepositoryRelativePath(root, fsPath);
      if (relative === null) {
        reveal(companionFail(state, "INVALID_PATH", "Active file is outside the selected repository."), tree, status);
        return;
      }
      const dirty = companionNoteDirty(
        state,
        vscode.window.activeTextEditor?.document.isDirty === true,
      );
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
          realities: dirty.realities,
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
          { label: "Default only (Codex + Claude Code)", id: "" },
          ...optInRealityIds().map((reality) => ({
            label: presentationLabel(reality),
            description: reality,
            id: reality,
          })),
        ],
        {
          title: "RuleBlast opt-in realities",
          placeHolder: "Empty default, or add Copilot CLI and/or Gemini CLI",
          canPickMany: true,
        },
      );
      if (picked === undefined) return;
      const selected = Array.isArray(picked) ? picked : [picked];
      const realities = selected.some((item) => item.id === "")
        ? []
        : selected.map((item) => item.id).filter((id) => id !== "");
      reveal(companionSetRealities(state, realities), tree, status);
    }),
    vscode.commands.registerCommand("ruleblast.openVerifiedCase", async () => {
      await withRoot(tree, status, "case", async () =>
        companionSucceed(state, await openPackagedCase()),
      );
    }),
  );
}

export function deactivate(): void {}

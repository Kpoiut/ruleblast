import * as vscode from "vscode";
import {
  PresentationSession,
  comparePathStacks,
  companionBegin,
  companionExplain,
  companionExplainFromResult,
  companionFail,
  companionMarkStale,
  companionNoteDirty,
  companionSetRealities,
  companionSucceed,
  diffRepositoryWithAdjunct,
  explainRepository,
  findRepositoryRoot,
  gateWorkspace,
  initialCompanionState,
  openGitSnapshot,
  openPackagedCase,
  openTrackedWorktree,
  optInRealityIds,
  presentExplain,
  presentationLabel,
  probeGitStorageFormat,
  scanRepository,
  toRepositoryRelativePath,
  type CompanionState,
  type HostWorkspace,
  type PresentationSnapshot,
  type ScoreboardNode,
} from "../engine/application/authority.js";
import { RuleBlastTreeProvider } from "./tree.js";
import { RuleBlastDecorationProvider } from "./decorations.js";
import {
  ExplainDocumentProvider,
  EXPLAIN_URI,
  REALITY_LEFT_URI,
  REALITY_RIGHT_URI,
  compareUri,
} from "./explain-provider.js";
import { InstructionLensProvider } from "./codelens.js";

let state = initialCompanionState();
const session = new PresentationSession();
let treeView: vscode.TreeView<ScoreboardNode> | undefined;

const tree = new RuleBlastTreeProvider();
const decorations = new RuleBlastDecorationProvider();
const documents = new ExplainDocumentProvider();
const lensProvider = new InstructionLensProvider();

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

function editorContext(): { relativePath: string | null; dirty: boolean } {
  const root = currentRoot();
  const active = vscode.window.activeTextEditor;
  const relativePath = root && active
    ? toRepositoryRelativePath(root, active.document.uri.fsPath)
    : null;
  return { relativePath, dirty: active?.document.isDirty === true };
}

function paint(snapshot: PresentationSnapshot, status: vscode.StatusBarItem): void {
  const root = currentRoot();
  tree.refresh(state, root);
  decorations.refresh(snapshot, root);
  lensProvider.refresh(snapshot, root);
  const glance = snapshot.workspaceTruth.glance;
  status.text = glance.statusLineText;
  status.tooltip = new vscode.MarkdownString(glance.tooltipMarkdown);
  status.accessibilityInformation = { label: glance.accessibleStatusText };
  status.command = "ruleblast.scoreboard.focus";
  status.show();
  if (treeView) {
    treeView.badge = glance.treeViewBadge === undefined
      ? undefined
      : { value: glance.treeViewBadge, tooltip: "changed stacks" };
    treeView.description = glance.treeViewDescription;
  }
  if (state.explainText !== null) {
    documents.update(state.explainText, snapshot.explainPolicy.freshness === "stale");
  }
}

function commitPresentation(
  next: CompanionState,
  status: vscode.StatusBarItem,
  generation?: number,
): boolean {
  const ctx = editorContext();
  const snapshot = generation === undefined
    ? session.replace(next, ctx.relativePath, ctx.dirty)
    : session.commit(next, generation, ctx.relativePath, ctx.dirty);
  if (snapshot === null) return false;
  state = next;
  paint(snapshot, status);
  return true;
}

async function showExplainDocument(text: string, isStale = false): Promise<void> {
  documents.update(text, isStale);
  let doc = await vscode.workspace.openTextDocument(EXPLAIN_URI);
  if (doc.languageId !== "markdown") {
    doc = await vscode.languages.setTextDocumentLanguage(doc, "markdown");
  }
  await vscode.window.showTextDocument(doc, { preview: false, preserveFocus: false });
}

async function loadCompareText(root: string, ref: string, path: string): Promise<string> {
  const snapshot = await openGitSnapshot(root, ref);
  const bytes = await snapshot.read(path);
  return bytes === null ? "" : new TextDecoder().decode(bytes);
}

async function openInstructionSource(path: string): Promise<void> {
  const root = currentRoot();
  const snapshot = session.snapshot;
  if (root === undefined || snapshot === null) return;
  const fileUri = vscode.Uri.file(`${root.replace(/[\\/]+$/u, "")}/${path}`);
  const compare = snapshot.compare;
  const staleWorktree = snapshot.workspaceTruth.phase === "stale" &&
    compare?.afterKind === "worktree";
  if (compare === null || compare.beforeRef === null || staleWorktree) {
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(fileUri));
    return;
  }
  try {
    const left = compareUri("before", path);
    documents.setCompare(`before:${path}`, await loadCompareText(root, compare.beforeRef, path));
    if (compare.afterKind === "worktree") {
      await vscode.commands.executeCommand("vscode.diff", left, fileUri, `${path} · before ↔ worktree`);
      return;
    }
    if (compare.afterRef !== null) {
      const right = compareUri("after", path);
      documents.setCompare(`after:${path}`, await loadCompareText(root, compare.afterRef, path));
      await vscode.commands.executeCommand("vscode.diff", left, right, `${path} · before ↔ after`);
      return;
    }
  } catch {
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(fileUri));
  }
}

async function withRoot(
  status: vscode.StatusBarItem,
  action: "scan" | "diff" | "explain" | "case",
  run: (root: string) => Promise<CompanionState>,
): Promise<void> {
  const gate = gateWorkspace(workspaceGate());
  if (!gate.ok) {
    commitPresentation(companionFail(state, gate.code, gate.message), status);
    vscode.window.showErrorMessage(gate.message);
    return;
  }
  const generation = session.begin();
  commitPresentation(companionBegin(state, action), status);
  try {
    const next = await vscode.window.withProgress(
      { location: { viewId: "ruleblast.scoreboard" } },
      async () => run(gate.root),
    );
    if (!commitPresentation(next, status, generation)) return;
  } catch (error: unknown) {
    if (generation !== session.generation) return;
    const message = error instanceof Error ? error.message : "Unknown host failure";
    commitPresentation(companionFail(state, "ERROR", message), status, generation);
    if (message.includes("does not resolve to a commit") || message.includes("REF_NOT_FOUND")) {
      try {
        const root = await findRepositoryRoot(gate.root);
        await openGitSnapshot(root, "HEAD");
      } catch {
        vscode.window.showErrorMessage(message);
        return;
      }
      const picked = await vscode.window.showErrorMessage(message, "Retry with HEAD");
      if (picked === "Retry with HEAD") await runDiffWithRef("HEAD", status);
      return;
    }
    vscode.window.showErrorMessage(message);
  }
}

async function runDiffWithRef(baseRef: string, status: vscode.StatusBarItem): Promise<void> {
  await withRoot(status, "diff", async (folder) => {
    const root = await findRepositoryRoot(folder);
    const before = await openGitSnapshot(root, baseRef.trim());
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
}

export function activate(context: vscode.ExtensionContext): void {
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 80);
  treeView = vscode.window.createTreeView("ruleblast.scoreboard", {
    treeDataProvider: tree,
    showCollapseAll: true,
  });
  commitPresentation(state, status);

  const watcher = vscode.workspace.createFileSystemWatcher("**/*");
  const stale = () => {
    commitPresentation(companionMarkStale(state), status);
  };
  watcher.onDidChange(stale);
  watcher.onDidCreate(stale);
  watcher.onDidDelete(stale);

  context.subscriptions.push(
    status,
    watcher,
    treeView,
    decorations,
    documents,
    lensProvider,
    vscode.window.registerFileDecorationProvider(decorations),
    vscode.workspace.registerTextDocumentContentProvider("ruleblast", documents),
    vscode.languages.registerCodeLensProvider({ scheme: "file" }, lensProvider),
    vscode.window.onDidChangeActiveTextEditor(() => {
      commitPresentation(state, status);
    }),
    vscode.commands.registerCommand("ruleblast._openInstructionSource", async (path: unknown) => {
      if (typeof path === "string" && path !== "") await openInstructionSource(path);
    }),
    vscode.commands.registerCommand("ruleblast._compareRealities", async (path: unknown) => {
      if (typeof path !== "string" || path === "" || state.result === null) return;
      const row = state.result.paths.find((item) => item.path === path);
      if (row === undefined) return;
      const compare = comparePathStacks(row);
      documents.setCompare("reality:left", `${compare.left.label}\n${compare.left.lines.join("\n")}\n`);
      documents.setCompare("reality:right", `${compare.right.label}\n${compare.right.lines.join("\n")}\n`);
      await vscode.commands.executeCommand(
        "vscode.diff",
        REALITY_LEFT_URI,
        REALITY_RIGHT_URI,
        `${path} · ${compare.left.label} ↔ ${compare.right.label}`,
      );
    }),
    vscode.commands.registerCommand("ruleblast.scanWorkspace", async () => {
      await withRoot(status, "scan", async (folder) => {
        const root = await findRepositoryRoot(folder);
        return companionSucceed(state, await scanRepository({
          snapshot: await openTrackedWorktree(root),
          realities: state.realities,
        }));
      });
    }),
    vscode.commands.registerCommand("ruleblast.diffFrom", async () => {
      const picked = await vscode.window.showQuickPick(
        [
          { label: "HEAD", description: "Last commit → worktree" },
          { label: "HEAD~1", description: "Parent of HEAD → worktree" },
          { label: "$(pencil) Custom ref…", description: "Enter any Git ref", id: "custom" },
        ],
        { title: "RuleBlast: Diff From", placeHolder: "Select a base ref to compare with worktree" },
      );
      if (picked === undefined || Array.isArray(picked)) return;
      let baseRef: string | undefined = picked.label;
      if (picked.id === "custom") {
        baseRef = await vscode.window.showInputBox({
          title: "RuleBlast Diff From",
          prompt: "Git ref to compare with the tracked worktree",
          placeHolder: "HEAD",
          value: "HEAD",
        });
      }
      if (baseRef === undefined || baseRef.trim() === "") return;
      await runDiffWithRef(baseRef, status);
    }),
    vscode.commands.registerCommand("ruleblast.explainScoreboardPath", async (path: unknown) => {
      if (typeof path !== "string" || path === "") return;
      const next = companionExplainFromResult(state, path, presentExplain);
      if (next.explainText !== null) {
        await showExplainDocument(next.explainText, next.lifecycle === "STALE");
      } else {
        vscode.window.showErrorMessage(next.error?.message ?? "Last result has no path.");
      }
      commitPresentation(next, status);
    }),
    vscode.commands.registerCommand("ruleblast.explainActiveFile", async (resource?: unknown) => {
      const fsPath = fsPathOf(resource) ?? vscode.window.activeTextEditor?.document.uri.fsPath;
      if (fsPath === undefined) {
        vscode.window.showErrorMessage("Open a file to explain.");
        return;
      }
      const gate = gateWorkspace(workspaceGate());
      if (!gate.ok) {
        commitPresentation(companionFail(state, gate.code, gate.message), status);
        vscode.window.showErrorMessage(gate.message);
        return;
      }
      const root = await findRepositoryRoot(gate.root);
      const relative = toRepositoryRelativePath(root, fsPath);
      if (relative === null) {
        commitPresentation(
          companionFail(state, "INVALID_PATH", "Active file is outside the selected repository."),
          status,
        );
        return;
      }
      const dirty = companionNoteDirty(
        state,
        vscode.window.activeTextEditor?.document.isDirty === true,
      );
      if (dirty.result !== null) {
        const next = companionExplainFromResult(dirty, relative, presentExplain);
        if (next.explainText !== null) {
          await showExplainDocument(next.explainText, next.lifecycle === "STALE");
        } else {
          vscode.window.showErrorMessage(next.error?.message ?? "Last result has no path.");
        }
        commitPresentation(next, status);
        return;
      }
      await withRoot(status, "explain", async () => {
        const explained = await explainRepository({
          snapshot: await openTrackedWorktree(root),
          path: relative,
          realities: dirty.realities,
        });
        const text = presentExplain(explained.explain);
        await showExplainDocument(text, dirty.lifecycle === "STALE");
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
      commitPresentation(companionSetRealities(state, realities), status);
    }),
    vscode.commands.registerCommand("ruleblast.openVerifiedCase", async () => {
      await withRoot(status, "case", async () =>
        companionSucceed(state, await openPackagedCase()),
      );
    }),
  );
}

export function deactivate(): void {}

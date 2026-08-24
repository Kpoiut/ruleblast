import * as vscode from "vscode";
import {
  staleBannerFor,
  type StaleCause,
} from "../engine/application/authority.js";

export const EXPLAIN_URI = vscode.Uri.parse("ruleblast:/explain.md");
export const REALITY_LEFT_URI = vscode.Uri.parse("ruleblast:/reality/left");
export const REALITY_RIGHT_URI = vscode.Uri.parse("ruleblast:/reality/right");

export function compareUri(side: "before" | "after", file: string): vscode.Uri {
  return vscode.Uri.parse(
    `ruleblast:/compare/${side}/${file.split("/").map(encodeURIComponent).join("/")}`,
  );
}

export function comparePath(uri: vscode.Uri): { side: "before" | "after"; file: string } | null {
  const match = /^\/compare\/(before|after)\/(.+)$/u.exec(uri.path);
  if (match === null || match[1] === undefined || match[2] === undefined) return null;
  return {
    side: match[1] as "before" | "after",
    file: match[2].split("/").map(decodeURIComponent).join("/"),
  };
}

export class ExplainDocumentProvider implements vscode.TextDocumentContentProvider {
  private readonly emitter = new vscode.EventEmitter<vscode.Uri>();
  private content = "";
  private readonly compare = new Map<string, string>();

  readonly onDidChange = this.emitter.event;

  public update(text: string, isStale = false, cause: StaleCause | null = null): void {
    this.content = isStale ? `${staleBannerFor(cause)}\n${text}` : text;
    this.emitter.fire(EXPLAIN_URI);
  }

  public setCompare(key: string, text: string): void {
    this.compare.set(key, text);
  }

  public provideTextDocumentContent(uri: vscode.Uri): string {
    if (uri.path === "/explain.md" || uri.path === "explain.md") return this.content;
    if (uri.path === "/reality/left" || uri.path === "reality/left") {
      return this.compare.get("reality:left") ?? "";
    }
    if (uri.path === "/reality/right" || uri.path === "reality/right") {
      return this.compare.get("reality:right") ?? "";
    }
    const parsed = comparePath(uri);
    if (parsed === null) return "";
    return this.compare.get(`${parsed.side}:${parsed.file}`) ?? "";
  }

  public dispose(): void {
    this.emitter.dispose();
  }
}

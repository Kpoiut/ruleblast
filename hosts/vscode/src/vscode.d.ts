declare module "vscode" {
  export interface Disposable { dispose(): void; }
  export interface Uri { readonly fsPath: string; }
  export interface TextDocument {
    readonly uri: Uri;
    readonly isDirty: boolean;
    readonly languageId: string;
  }
  export interface TextEditor { readonly document: TextDocument; }
  export interface WorkspaceFolder { readonly uri: Uri; readonly name: string; }
  export interface OutputChannel {
    appendLine(value: string): void;
    show(preserveFocus?: boolean): void;
  }
  export class MarkdownString {
    constructor(value?: string);
    readonly value: string;
  }
  export interface AccessibilityInformation {
    label: string;
    role?: string;
  }
  export interface StatusBarItem extends Disposable {
    text: string;
    tooltip?: string | MarkdownString;
    command?: string;
    accessibilityInformation?: AccessibilityInformation;
    show(): void;
  }
  export interface Event<T> { (listener: (e: T) => void): Disposable; }
  export interface FileSystemWatcher extends Disposable {
    onDidCreate: Event<Uri>;
    onDidChange: Event<Uri>;
    onDidDelete: Event<Uri>;
  }
  export interface TreeItem {
    id?: string;
    label?: string;
    description?: string;
    tooltip?: string;
    collapsibleState?: number;
    command?: { command: string; title: string; arguments?: unknown[] };
    contextValue?: string;
    resourceUri?: Uri;
    iconPath?: ThemeIcon;
    accessibilityInformation?: AccessibilityInformation;
  }
  export class TreeItem {
    constructor(label: string, collapsibleState?: number);
    id?: string;
    label?: string;
    description?: string;
    tooltip?: string;
    collapsibleState?: number;
    command?: { command: string; title: string; arguments?: unknown[] };
    contextValue?: string;
    resourceUri?: Uri;
    iconPath?: ThemeIcon;
    accessibilityInformation?: AccessibilityInformation;
  }
  export interface TreeView<T> extends Disposable {
    badge?: { value: number; tooltip?: string };
    description?: string;
    message?: string;
  }
  export class ThemeColor {
    constructor(id: string);
    readonly id: string;
  }
  export class ThemeIcon {
    constructor(id: string, color?: ThemeColor);
    readonly id: string;
  }
  export class Uri {
    readonly fsPath: string;
    readonly path: string;
    readonly query: string;
    static file(path: string): Uri;
    static parse(value: string): Uri;
    static joinPath(base: Uri, ...pathSegments: string[]): Uri;
  }
  export enum TreeItemCollapsibleState { None = 0, Collapsed = 1, Expanded = 2 }
  export enum StatusBarAlignment { Left = 1, Right = 2 }
  export interface TreeDataProvider<T> {
    readonly onDidChangeTreeData?: Event<T | undefined>;
    getTreeItem(element: T): TreeItem;
    getChildren(element?: T): T[] | Promise<T[]>;
  }
  export interface TextDocumentContentProvider {
    readonly onDidChange?: Event<Uri>;
    provideTextDocumentContent(uri: Uri): string | Promise<string>;
  }
  export interface FileDecoration {
    badge?: string;
    tooltip?: string;
    color?: ThemeColor;
    propagate?: boolean;
  }
  export class FileDecoration {
    constructor(badge?: string, tooltip?: string, color?: ThemeColor);
    badge?: string;
    tooltip?: string;
    color?: ThemeColor;
    propagate?: boolean;
  }
  export interface FileDecorationProvider extends Disposable {
    readonly onDidChangeFileDecorations?: Event<Uri | Uri[] | undefined>;
    provideFileDecoration(uri: Uri): FileDecoration | undefined | Promise<FileDecoration | undefined>;
  }
  export interface Range {
    readonly start: { readonly line: number; readonly character: number };
    readonly end: { readonly line: number; readonly character: number };
  }
  export class Range {
    constructor(startLine: number, startCharacter: number, endLine: number, endCharacter: number);
  }
  export interface Command {
    title: string;
    command: string;
    tooltip?: string;
    arguments?: unknown[];
  }
  export class CodeLens {
    constructor(range: Range, command?: Command);
    range: Range;
    command?: Command;
  }
  export interface CodeLensProvider extends Disposable {
    readonly onDidChangeCodeLenses?: Event<void>;
    provideCodeLenses(document: TextDocument): CodeLens[] | Promise<CodeLens[]>;
  }
  export interface EventEmitter<T> {
    event: Event<T>;
    fire(data: T): void;
    dispose(): void;
  }
  export class EventEmitter<T> {
    event: Event<T>;
    fire(data: T): void;
    dispose(): void;
  }
  export interface Memento {
    get<T>(key: string): T | undefined;
    update(key: string, value: unknown): Promise<void>;
  }
  export interface ExtensionContext {
    subscriptions: Disposable[];
    workspaceState: Memento;
  }
  export const workspace: {
    readonly workspaceFolders: readonly WorkspaceFolder[] | undefined;
    readonly isTrusted: boolean;
    getWorkspaceFolder(uri: Uri): WorkspaceFolder | undefined;
    createFileSystemWatcher(glob: string): FileSystemWatcher;
    openTextDocument(options: { content: string; language?: string } | Uri): Promise<TextDocument>;
    registerTextDocumentContentProvider(scheme: string, provider: TextDocumentContentProvider): Disposable;
  };
  export const languages: {
    setTextDocumentLanguage(document: TextDocument, languageId: string): Promise<TextDocument>;
    registerCodeLensProvider(selector: { pattern?: string; scheme?: string } | string, provider: CodeLensProvider): Disposable;
  };
  export const window: {
    activeTextEditor: TextEditor | undefined;
    onDidChangeActiveTextEditor(listener: (editor: TextEditor | undefined) => void): Disposable;
    showErrorMessage(message: string, ...items: string[]): Promise<string | undefined>;
    showInformationMessage(message: string, ...items: string[]): Promise<string | undefined>;
    showInputBox(options: {
      title?: string;
      prompt: string;
      value?: string;
      placeHolder?: string;
    }): Promise<string | undefined>;
    showQuickPick<T extends { label: string }>(
      items: readonly T[],
      options?: { title?: string; placeHolder?: string; canPickMany?: boolean },
    ): Promise<T | T[] | undefined>;
    showTextDocument(document: TextDocument, options?: { preview?: boolean; preserveFocus?: boolean }): Promise<unknown>;
    createOutputChannel(name: string): OutputChannel;
    createStatusBarItem(alignment?: StatusBarAlignment, priority?: number): StatusBarItem;
    createTreeView<T>(viewId: string, options: {
      treeDataProvider: TreeDataProvider<T>;
      showCollapseAll?: boolean;
    }): TreeView<T>;
    registerFileDecorationProvider(provider: FileDecorationProvider): Disposable;
    withProgress<R>(
      options: { location: { viewId: string } | number; title?: string },
      task: () => Promise<R>,
    ): Promise<R>;
  };
  export const commands: {
    registerCommand(command: string, callback: (...args: unknown[]) => unknown): Disposable;
    executeCommand<T = unknown>(command: string, ...rest: unknown[]): Promise<T>;
  };
}

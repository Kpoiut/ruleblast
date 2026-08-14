declare module "vscode" {
  export interface Disposable { dispose(): void; }
  export interface Uri { readonly fsPath: string; }
  export interface TextDocument { readonly uri: Uri; readonly isDirty: boolean; }
  export interface TextEditor { readonly document: TextDocument; }
  export interface WorkspaceFolder { readonly uri: Uri; readonly name: string; }
  export interface OutputChannel {
    appendLine(value: string): void;
    show(preserveFocus?: boolean): void;
  }
  export interface StatusBarItem extends Disposable {
    text: string;
    tooltip?: string;
    show(): void;
  }
  export interface Event<T> { (listener: (e: T) => void): Disposable; }
  export interface FileSystemWatcher extends Disposable {
    onDidCreate: Event<Uri>;
    onDidChange: Event<Uri>;
    onDidDelete: Event<Uri>;
  }
  export interface TreeItem {
    label?: string;
    description?: string;
    tooltip?: string;
    collapsibleState?: number;
  }
  export class TreeItem {
    constructor(label: string, collapsibleState?: number);
    label?: string;
    description?: string;
    tooltip?: string;
    collapsibleState?: number;
  }
  export enum TreeItemCollapsibleState { None = 0, Collapsed = 1, Expanded = 2 }
  export enum StatusBarAlignment { Left = 1, Right = 2 }
  export interface TreeDataProvider<T> {
    readonly onDidChangeTreeData?: Event<T | undefined>;
    getTreeItem(element: T): TreeItem;
    getChildren(element?: T): T[] | Promise<T[]>;
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
  export interface ExtensionContext { subscriptions: Disposable[]; }
  export const workspace: {
    readonly workspaceFolders: readonly WorkspaceFolder[] | undefined;
    readonly isTrusted: boolean;
    getWorkspaceFolder(uri: Uri): WorkspaceFolder | undefined;
    createFileSystemWatcher(glob: string): FileSystemWatcher;
    openTextDocument(options: { content: string; language?: string }): Promise<TextDocument>;
  };
  export const window: {
    activeTextEditor: TextEditor | undefined;
    showErrorMessage(message: string): void;
    showInformationMessage(message: string): void;
    showInputBox(options: { prompt: string; value?: string }): Promise<string | undefined>;
    showQuickPick<T extends { label: string }>(
      items: readonly T[],
      options?: { title?: string; placeHolder?: string },
    ): Promise<T | undefined>;
    showTextDocument(document: TextDocument): Promise<unknown>;
    createOutputChannel(name: string): OutputChannel;
    createStatusBarItem(alignment?: StatusBarAlignment, priority?: number): StatusBarItem;
    createTreeView(viewId: string, options: { treeDataProvider: TreeDataProvider<unknown> }): Disposable;
  };
  export const commands: {
    registerCommand(command: string, callback: (...args: unknown[]) => unknown): Disposable;
  };
}

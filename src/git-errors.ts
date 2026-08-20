export type GitSnapshotErrorCode =
  | "NOT_REPOSITORY"
  | "REF_NOT_FOUND"
  | "UNMERGED_INDEX"
  | "UNSUPPORTED_WORKTREE_NODE"
  | "WORKTREE_CHANGED_DURING_SNAPSHOT";

export class GitSnapshotError extends Error {
  public constructor(public readonly code: GitSnapshotErrorCode) {
    super(code);
    this.name = "GitSnapshotError";
  }
}

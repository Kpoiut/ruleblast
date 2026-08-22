export interface GitLogCommit {
  readonly ref: string;
  readonly subject: string;
}

export interface DiffFromPick {
  readonly label: string;
  readonly description: string;
  readonly ref: string | null;
}

const PINNED = Object.freeze(["HEAD", "HEAD~1"] as const);
const RECENT_CAP = 8;

function sameRef(left: string, right: string): boolean {
  return left.trim() === right.trim();
}

export function rememberDiffBases(
  recent: readonly string[],
  ref: string,
  limit = RECENT_CAP,
): readonly string[] {
  const token = ref.trim();
  if (token === "" || PINNED.some((pinned) => sameRef(pinned, token))) {
    return Object.freeze([...recent]);
  }
  return Object.freeze([
    token,
    ...recent.filter((item) => !sameRef(item, token)),
  ].slice(0, limit));
}

export function diffFromPicks(input: {
  readonly recent: readonly string[];
  readonly commits: readonly GitLogCommit[];
}): readonly DiffFromPick[] {
  const picks: DiffFromPick[] = [
    {
      label: "HEAD",
      description: "Last commit → worktree",
      ref: "HEAD",
    },
    {
      label: "HEAD~1",
      description: "Parent of HEAD → worktree",
      ref: "HEAD~1",
    },
  ];
  const seen = new Set<string>(PINNED);
  const push = (ref: string, label: string, description: string): void => {
    if (seen.has(ref)) return;
    seen.add(ref);
    picks.push({ label, description, ref });
  };
  for (const ref of input.recent) {
    const token = ref.trim();
    if (token === "") continue;
    push(token, token, "Recent RuleBlast diff base");
  }
  for (const commit of input.commits) {
    const token = commit.ref.trim();
    if (token === "") continue;
    push(token, token, commit.subject);
  }
  picks.push({
    label: "$(pencil) Custom ref…",
    description: "Enter any Git ref",
    ref: null,
  });
  return Object.freeze(picks);
}

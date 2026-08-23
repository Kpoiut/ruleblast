import type { GitLogCommit } from "./diff-from-picks.js";
import { runGit } from "../git-exec.js";

const LOG_LIMIT = 12;

export async function listRecentCommits(root: string): Promise<readonly GitLogCommit[]> {
  try {
    const stdout = (await runGit(
      root,
      ["log", "-n", String(LOG_LIMIT), "--format=%h%x09%s"],
      { timeout: 8_000 },
    )).toString("utf8");
    return Object.freeze(
      stdout.split("\n").flatMap((line) => {
        const tab = line.indexOf("\t");
        if (tab <= 0) return [];
        const ref = line.slice(0, tab).trim();
        const subject = line.slice(tab + 1).trim();
        if (ref === "") return [];
        return [{ ref, subject }];
      }),
    );
  } catch {
    return Object.freeze([]);
  }
}

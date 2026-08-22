import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GitLogCommit } from "./diff-from-picks.js";

const execFileAsync = promisify(execFile);
const LOG_LIMIT = 12;

export async function listRecentCommits(root: string): Promise<readonly GitLogCommit[]> {
  try {
    const result = await execFileAsync(
      "git",
      [
        "--no-optional-locks",
        "--no-replace-objects",
        "-c",
        "core.fsmonitor=false",
        "-C",
        root,
        "log",
        "-n",
        String(LOG_LIMIT),
        "--format=%h%x09%s",
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          GIT_NO_LAZY_FETCH: "1",
          GIT_OPTIONAL_LOCKS: "0",
        },
        timeout: 8_000,
      },
    );
    return Object.freeze(
      result.stdout.split("\n").flatMap((line) => {
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

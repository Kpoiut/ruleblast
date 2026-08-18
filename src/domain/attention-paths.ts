import { compareCodePoints } from "./repository-path.js";
import type { RuleBlastResult } from "../model.js";

/** Paths that deserve the next keystroke. Diff: stack changed. Scan: currently split. */
export function attentionPaths(result: RuleBlastResult): readonly string[] {
  const paths = result.mode === "diff"
    ? result.paths.filter((path) => path.changedProfiles.length > 0).map((path) => path.path)
    : result.paths.filter((path) => path.isSplit === true).map((path) => path.path);
  return [...paths].sort(compareCodePoints);
}

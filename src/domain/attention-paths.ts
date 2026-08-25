/**
 * @fileoverview Next-keystroke path list. Presentation only; not a fifth action.
 */
import { compareCodePoints } from "./repository-path.js";
import type { RuleBlastResult } from "../model.js";

/**
 * Paths that deserve the next keystroke, code-point sorted.
 * Diff: stack changed. Scan: currently split (`isSplit === true`).
 * INDETERMINATE split is not attention.
 */
export function attentionPaths(result: RuleBlastResult): readonly string[] {
  const paths = result.mode === "diff"
    ? result.paths.filter((path) => path.changedProfiles.length > 0).map((path) => path.path)
    : result.paths.filter((path) => path.isSplit === true).map((path) => path.path);
  return [...paths].sort(compareCodePoints);
}

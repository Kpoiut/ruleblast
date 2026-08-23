import { isCandidateIdShape } from "../domain/runtime-id.js";
import { readCandidateInventory } from "../packs/candidate.js";
import { candidatePacksRoot } from "../packs/load.js";
import {
  MODELED_REALITY_IDS,
  OPT_IN_REALITY_IDS,
} from "./opt-in-realities.js";

export type RuntimeSurfaceKind = "modeled" | "candidate" | "unknown";

let cachedCandidateIds: ReadonlySet<string> | undefined;

export function candidateRuntimeIds(): ReadonlySet<string> {
  cachedCandidateIds ??= new Set(
    readCandidateInventory(candidatePacksRoot()).map((item) => item.id),
  );
  return cachedCandidateIds;
}

export function classifyRuntimeSurfaceId(value: string): RuntimeSurfaceKind {
  if ((MODELED_REALITY_IDS as readonly string[]).includes(value)) return "modeled";
  if (candidateRuntimeIds().has(value)) return "candidate";
  return "unknown";
}

export function publicRealityRefusal(value: string): string {
  if (classifyRuntimeSurfaceId(value) === "candidate") {
    return `${value} is a not-admitted candidate runtime, not a public --reality. Catalog IDs name runtimes, not models.`;
  }
  const allowed = [...OPT_IN_REALITY_IDS].join(" | ");
  const hint = isCandidateIdShape(value)
    ? `${value} is not in the runtime catalog.`
    : `${JSON.stringify(value)} is not a known runtime surface id.`;
  return `--reality must be one of ${allowed}; editor and hosted surfaces are distinct and unsupported. Catalog IDs name runtimes, not models. ${hint}`;
}

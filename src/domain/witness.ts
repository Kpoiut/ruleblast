/**
 * @fileoverview Why-edges for `--witness`. Provenance, not actor telemetry.
 *
 * Edges restatement of modeled discovery/selection. No inferred winner on
 * PARTIAL/UNKNOWN. Pack hints may name a rule; missing hint stays generic.
 */
import type { Projection, ResolvedSource, SourceDisposition } from "../model.js";

/** Pack-supplied rule name and human detail for one disposition. */
export interface WitnessHint {
  readonly rule: string;
  readonly inputs: readonly string[];
  readonly detail: string;
}

export type WitnessHintLookup = (
  profile: string,
  disposition: SourceDisposition,
  sourcePath: string,
) => WitnessHint | null;

/** Causal decision on one edge. UNCERTAIN is completeness, not a guessed winner. */
export type WitnessDecision =
  | "DISCOVERED"
  | "SELECTED"
  | "SELECTED_EMPTY"
  | "SHADOWED"
  | "IMPORTED"
  | "APPLIED_RULE"
  | "EXCLUDED"
  | "BUDGET_TRUNCATED"
  | "UNRESOLVED"
  | "UNCERTAIN";

/** One modeled why-edge. `uncertainty` is NONE/PARTIAL/UNKNOWN, never inferred. */
export interface WitnessEdge {
  readonly rule: string;
  readonly evidenceRevision: string;
  readonly inputs: readonly string[];
  readonly decision: WitnessDecision;
  readonly uncertainty: "NONE" | "PARTIAL" | "UNKNOWN";
  readonly detail: string;
}

/** Versioned witness for one profile at one target path. */
export interface WitnessGraph {
  readonly version: "RBWIT1";
  readonly profile: string;
  readonly targetPath: string;
  readonly edges: readonly WitnessEdge[];
}

/**
 * Build RBWIT1 edges: one per source, plus budget-truncation and completeness.
 * Hint lookup is optional; SHADOWED/EXCLUDED still use those decisions.
 */
export function witnessForProjection(
  projection: Projection,
  hint: WitnessHintLookup | null = null,
): WitnessGraph {
  const edges: WitnessEdge[] = [];
  for (const source of projection.sources) {
    edges.push(edgeForSource(projection, source, hint));
    if (source.truncated) {
      edges.push({
        rule: "repository-instruction-budget",
        evidenceRevision: projection.profile,
        inputs: [source.path, String(source.bytesUsed)],
        decision: "BUDGET_TRUNCATED",
        uncertainty: "NONE",
        detail: "Documented budget consumed; remaining bytes were not projected.",
      });
    }
  }
  if (projection.status !== "COMPLETE") {
    edges.push({
      rule: "completeness",
      evidenceRevision: projection.profile,
      inputs: [projection.status],
      decision: "UNCERTAIN",
      uncertainty: projection.status === "PARTIAL" ? "PARTIAL" : "UNKNOWN",
      detail: "Projection is not complete; no inferred winner.",
    });
  }
  return {
    version: "RBWIT1",
    profile: projection.profile,
    targetPath: projection.context.targetPath,
    edges,
  };
}

function edgeForSource(
  projection: Projection,
  source: ResolvedSource,
  hint: WitnessHintLookup | null,
): WitnessEdge {
  const profile = projection.profile;
  const named = hint?.(profile, source.disposition, source.path);
  if (named !== null && named !== undefined) {
    return {
      rule: named.rule,
      evidenceRevision: profile,
      inputs: named.inputs,
      decision: source.disposition === "SHADOWED" || source.disposition === "EXCLUDED"
        ? source.disposition
        : "DISCOVERED",
      uncertainty: "NONE",
      detail: named.detail,
    };
  }
  if (source.disposition === "IMPORTED") {
    return {
      rule: "bounded-import",
      evidenceRevision: profile,
      inputs: [source.path],
      decision: "IMPORTED",
      uncertainty: "NONE",
      detail: "A selected document imported this source at a modeled insertion point.",
    };
  }
  if (source.disposition === "APPLIED_RULE") {
    return {
      rule: "path-applicability",
      evidenceRevision: profile,
      inputs: [source.path, projection.context.targetPath],
      decision: "APPLIED_RULE",
      uncertainty: "NONE",
      detail: "Conditional rule proven applicable to this target path.",
    };
  }
  if (source.disposition === "UNRESOLVED_IMPORT") {
    return {
      rule: "import-resolution",
      evidenceRevision: profile,
      inputs: [source.path],
      decision: "UNRESOLVED",
      uncertainty: "UNKNOWN",
      detail: "Import was visible but could not be resolved inside the repository boundary.",
    };
  }
  if (source.disposition === "SELECTED_EMPTY") {
    return {
      rule: "empty-selection-still-wins",
      evidenceRevision: profile,
      inputs: [source.path],
      decision: "SELECTED_EMPTY",
      uncertainty: "NONE",
      detail: "Source won selection and contributed no non-empty content.",
    };
  }
  if (source.disposition === "SELECTED") {
    return {
      rule: "documented-selection",
      evidenceRevision: profile,
      inputs: [source.path, projection.context.cwd, projection.context.trigger],
      decision: "SELECTED",
      uncertainty: "NONE",
      detail: "Source won documented discovery and can contribute content.",
    };
  }
  return {
    rule: "visible-candidate",
    evidenceRevision: profile,
    inputs: [source.path, source.disposition],
    decision: "DISCOVERED",
    uncertainty: "PARTIAL",
    detail: "Candidate was visible; no stronger causal rule is modeled.",
  };
}

/** Human WHY block. Empty graphs print `(no modeled edges)`. */
export function renderWitness(graphs: readonly WitnessGraph[]): string {
  const lines = ["WHY this resolution", ""];
  for (const graph of graphs) {
    lines.push(`${graph.profile} · ${graph.targetPath}`);
    if (graph.edges.length === 0) {
      lines.push("  (no modeled edges)");
      continue;
    }
    for (const edge of graph.edges) {
      lines.push(`  ${edge.decision} ← ${edge.rule}`);
      lines.push(`    ${edge.detail}`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

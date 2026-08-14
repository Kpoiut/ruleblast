import {
  ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
  OPENAI_CODEX_CLI_PROFILE_ID,
  type Projection,
  type ResolvedSource,
} from "../model.js";

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

export interface WitnessEdge {
  readonly rule: string;
  readonly evidenceRevision: string;
  readonly inputs: readonly string[];
  readonly decision: WitnessDecision;
  readonly uncertainty: "NONE" | "PARTIAL" | "UNKNOWN";
  readonly detail: string;
}

export interface WitnessGraph {
  readonly version: "RBWIT1";
  readonly profile: string;
  readonly targetPath: string;
  readonly edges: readonly WitnessEdge[];
}

export function witnessForProjection(projection: Projection): WitnessGraph {
  const edges: WitnessEdge[] = [];
  for (const source of projection.sources) {
    edges.push(edgeForSource(projection, source));
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

function edgeForSource(projection: Projection, source: ResolvedSource): WitnessEdge {
  const profile = projection.profile;
  if (source.disposition === "SHADOWED" && profile === OPENAI_CODEX_CLI_PROFILE_ID) {
    return {
      rule: "same-directory-override-precedence",
      evidenceRevision: profile,
      inputs: [source.path, "AGENTS.override.md"],
      decision: "SHADOWED",
      uncertainty: "NONE",
      detail: "AGENTS.override.md wins the same directory; AGENTS.md is explanatory only.",
    };
  }
  if (source.disposition === "EXCLUDED" && profile === ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID) {
    return {
      rule: "documented-exclusion",
      evidenceRevision: profile,
      inputs: [source.path],
      decision: "EXCLUDED",
      uncertainty: "NONE",
      detail: "Claude Code documented exclusion removed this source from contribution.",
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

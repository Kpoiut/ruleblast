export type ProfileId = string;
export type Completeness = "COMPLETE" | "PARTIAL" | "UNKNOWN";
export type Trigger = "STARTUP" | "READ_TARGET";
export type CompositionState =
  | "ORDERED"
  | "UNORDERED"
  | "UNSPECIFIED"
  | "RUNTIME_DECIDED";
export type PayloadRelation = "SAME" | "DIFFERENT" | "INDETERMINATE";
export type SourceDisposition =
  | "SELECTED"
  | "SELECTED_EMPTY"
  | "IMPORTED"
  | "APPLIED_RULE"
  | "SHADOWED"
  | "EXCLUDED"
  | "UNRESOLVED_IMPORT";

export interface SnapshotRef {
  kind: "git" | "worktree" | "fixture";
  label: string;
  oid: string | null;
}

export interface ProjectionContext {
  cwd: string;
  trigger: Trigger;
  targetPath: string;
  repositoryOnly: true;
}

export interface ResolvedSource {
  path: string;
  disposition: SourceDisposition;
  digest: string;
  bytesUsed: number;
  truncated: boolean;
}

export interface Projection {
  profile: ProfileId;
  context: ProjectionContext;
  status: Completeness;
  composition: CompositionState;
  sources: ResolvedSource[];
  normalizedPayloadUnits: string[][];
  projectionDigest: string | null;
  normalizedPayloadDigest: string | null;
  evidence: string[];
}

export interface PathTransition {
  path: string;
  before: Projection[];
  after: Projection[];
  changedProfiles: ProfileId[];
  beforePayloadRelation: PayloadRelation;
  afterPayloadRelation: PayloadRelation;
  wasSplit: boolean | null;
  isSplit: boolean | null;
  causes: string[];
}

export interface InstructionDiffStats {
  addedLineCount: number;
  deletedLineCount: number;
  editedLineCount: number;
  binaryChangedSourceCount: number;
}

export interface InstructionSourceChange {
  kind: "ADD" | "DELETE" | "MODIFY";
  beforePath: string | null;
  afterPath: string | null;
  beforeDigest: string | null;
  afterDigest: string | null;
  stats: InstructionDiffStats;
}

export interface CurrentPathProjection {
  path: string;
  projections: Projection[];
  payloadRelation: PayloadRelation;
  isSplit: boolean | null;
}

export interface BaseImpactCounts {
  candidatePathCount: number;
  currentSplitPathCount: number;
  partialPathCount: number;
  unknownPathCount: number;
  indeterminatePathCount: number;
}

export interface CurrentProfileCounts {
  profile: ProfileId;
  completePathCount: number;
  partialPathCount: number;
  unknownPathCount: number;
}

export interface DiffProfileCounts extends CurrentProfileCounts {
  changedStackPathCount: number;
}

export interface CurrentImpactCounts extends BaseImpactCounts {
  byProfile: CurrentProfileCounts[];
}

export interface DiffImpactCounts extends BaseImpactCounts {
  changedStackPathCount: number;
  newlySplitPathCount: number;
  convergedPathCount: number;
  byProfile: DiffProfileCounts[];
}

export interface ImpactGroup {
  root: string;
  changedStackPathCount: number;
  newlySplitPathCount: number;
  samplePaths: string[];
}

export type FindingCode =
  | "PARTIAL_PROJECTION"
  | "UNKNOWN_PROJECTION"
  | "BINARY_SOURCE"
  | "UNSPECIFIED_COMPOSITION"
  | "UNSUPPORTED_GLOB_SEMANTIC"
  | "UNSUPPORTED_BOUNDARY";

export interface Finding {
  code: FindingCode;
  profile: ProfileId | null;
  path: string;
  detail: string;
}

export interface CurrentRuleBlastResult {
  mode: "current";
  schemaVersion: 1;
  resolverRevision: 1;
  snapshot: SnapshotRef;
  counts: CurrentImpactCounts;
  paths: CurrentPathProjection[];
  findings: Finding[];
}

export interface DiffRuleBlastResult {
  mode: "diff";
  schemaVersion: 1;
  resolverRevision: 1;
  before: SnapshotRef;
  after: SnapshotRef;
  diffStats: InstructionDiffStats;
  changedInstructionSources: InstructionSourceChange[];
  counts: DiffImpactCounts;
  groups: ImpactGroup[];
  paths: PathTransition[];
  findings: Finding[];
}

export type RuleBlastResult = CurrentRuleBlastResult | DiffRuleBlastResult;

const PROFILE_ID_PATTERN =
  /^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*@[1-9][0-9]*$/;

export function parseProfileId(value: string): ProfileId {
  const match = PROFILE_ID_PATTERN.exec(value);
  if (match?.[0] !== value) {
    throw new TypeError(`Invalid profile id: ${JSON.stringify(value)}`);
  }

  return value;
}

export const OPENAI_CODEX_CLI_PROFILE_ID = parseProfileId(
  "openai/codex-cli@1",
);
export const ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID = parseProfileId(
  "anthropic/claude-code-cli@1",
);

export const GOOGLE_GEMINI_CLI_PROFILE_ID = parseProfileId(
  "google/gemini-cli@1",
);

export const GITHUB_COPILOT_CLI_PROFILE_ID = parseProfileId(
  "github/copilot-cli@1",
);

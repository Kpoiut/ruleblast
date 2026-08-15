export const PACK_SCHEMA_ID = "ruleblast.pack.v1";

export const FINGERPRINT_BUILTINS = Object.freeze([
  "codex-v1",
  "claude-v1",
  "gemini-v1",
  "copilot-v1",
] as const);

export type FingerprintBuiltin = (typeof FINGERPRINT_BUILTINS)[number];

export const SOURCE_TYPES = Object.freeze([
  "vendor-doc",
  "vendor-implementation",
  "ruleblast-compatibility",
] as const);

export type PackSourceType = (typeof SOURCE_TYPES)[number];

export interface PackManifest {
  readonly schema: typeof PACK_SCHEMA_ID;
  readonly id: string;
  readonly label: string;
  readonly shortLabel: string;
  readonly badge: string;
}

export interface PackClaim {
  readonly claimId: string;
  readonly sourceType: PackSourceType;
  readonly sourceUrl: string;
  readonly retrievedAt: string;
  readonly sourceRevision: string;
  readonly claim: string;
}

export interface AncestorOrigin {
  readonly kind: "ancestors";
  readonly from: "repositoryRoot";
  readonly to: "cwd" | "dirname-target";
  readonly inclusive: true;
  readonly names: readonly string[];
}

export interface FixedOrigin {
  readonly kind: "fixed";
  readonly paths: readonly string[];
}

export interface GlobOrigin {
  readonly kind: "glob";
  readonly pattern: string;
}

export type DiscoverOrigin = AncestorOrigin | FixedOrigin | GlobOrigin;

export interface DiscoverSpec {
  readonly origins: readonly DiscoverOrigin[];
  readonly claimIds: readonly string[];
}

export interface SelectSpec {
  readonly mode: "all" | "first-per-directory";
  readonly names: readonly string[];
  readonly shadows: Readonly<Record<string, readonly string[]>>;
  readonly claimIds: readonly string[];
}

export interface ApplySpec {
  readonly kind: "path-glob" | "settings-exclude" | "none";
  readonly claimIds: readonly string[];
}

export interface TransformSpec {
  readonly kind: "byte-budget" | "at-path-import" | "strip-html-comments";
  readonly bytes?: number;
  readonly maxDepth?: number;
  readonly lexer?: "claude-markdown-v1" | "gemini-markdown-v1";
  readonly claimIds: readonly string[];
}

export interface AssembleSpec {
  readonly mode: "ordered" | "unspecified";
  readonly claimIds: readonly string[];
}

export interface ResolverSpec {
  readonly context: {
    readonly cwd: "dirname-target" | "repository-root";
    readonly trigger: "STARTUP" | "READ_TARGET";
    readonly repositoryOnly: true;
  };
  readonly discover: DiscoverSpec;
  readonly select: SelectSpec;
  readonly apply?: ApplySpec;
  readonly transform: readonly TransformSpec[];
  readonly assemble: AssembleSpec;
  readonly fingerprint: FingerprintBuiltin;
  readonly onSymlink: "unknown-unfollowed" | "partial-unfollowed";
}

export interface PackBundle {
  readonly pack: PackManifest;
  readonly evidence: readonly PackClaim[];
  readonly resolver: ResolverSpec;
}

export interface CompiledPack {
  readonly pack: PackManifest;
  readonly evidence: readonly PackClaim[];
  readonly resolver: ResolverSpec;
  readonly claims: ReadonlySet<string>;
}

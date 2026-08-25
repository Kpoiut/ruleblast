import { sha256 } from "../canonical.js";
import { digestProjectionIdentity } from "../domain/projection-seal.js";
import { compareCodePoints, pathBasename, pathDirname } from "../domain/repository-path.js";
import { parseFrontmatterGlobs } from "../packs/ops-frontmatter.js";
import { matchGlob } from "../packs/ops-match.js";
import {
  GITHUB_COPILOT_CLI_PROFILE_ID,
  type Projection,
  type ResolvedSource,
} from "../model.js";
import type { RepositorySnapshot } from "../snapshot.js";
import {
  defineEvidenceRef,
  digestNormalizedPayload,
  unitizePayloadContributions,
  type EvidenceRef,
  type PreparedProfile,
  type ProfileDefinition,
} from "./profile.js";

export { GITHUB_COPILOT_CLI_PROFILE_ID } from "../model.js";
export const COPILOT_REALITY = GITHUB_COPILOT_CLI_PROFILE_ID;

const FILE_REFERENCE = /(?:^|\s)@([A-Za-z0-9_./-]+)/u;

const SYMLINK_EVIDENCE =
  "UNSUPPORTED_BOUNDARY: named Copilot instruction symlink was not followed";

interface CopilotDocument {
  readonly path: string;
  readonly kind: "repository-wide" | "modular" | "agent";
  readonly nodeKind: "file" | "symlink";
  readonly text: string;
  readonly applyTo: readonly string[] | null;
  readonly scope: string;
}

const COPILOT_EVIDENCE = Object.freeze([
  defineEvidenceRef({
    url: "https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-custom-instructions",
    retrievedAt: "2026-08-14",
    revision: "docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-custom-instructions@2026-08-14",
    claim: "Copilot CLI loads repository-wide .github/copilot-instructions.md from standard locations.",
  }),
  defineEvidenceRef({
    url: "https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-custom-instructions",
    retrievedAt: "2026-08-25",
    revision: "docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-custom-instructions@2026-08-25",
    claim: "Copilot CLI discovers .github/copilot-instructions.md, .claude/CLAUDE.md, and .github/instructions/**/*.instructions.md in standard locations: repository root, cwd, intermediate directories, and nested directories on the path of a file it is working on. Modular *.instructions.md files are not discovered in intermediate directories.",
  }),
  defineEvidenceRef({
    url: "https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-custom-instructions",
    retrievedAt: "2026-08-14",
    revision: "docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-custom-instructions@2026-08-14",
    claim: "Path-specific .github/instructions/**/*.instructions.md files apply only when applyTo matches a file Copilot CLI is working with.",
  }),
  defineEvidenceRef({
    url: "https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-custom-instructions",
    retrievedAt: "2026-08-24",
    revision: "docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-custom-instructions@2026-08-24",
    claim: "Copilot CLI also discovers AGENTS.md, CLAUDE.md, .claude/CLAUDE.md, and GEMINI.md in standard locations and does not define a general precedence order.",
  }),
  defineEvidenceRef({
    url: "https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-custom-instructions",
    retrievedAt: "2026-08-14",
    revision: "docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-custom-instructions@2026-08-14",
    claim: "User-level $HOME/.copilot files and COPILOT_CUSTOM_INSTRUCTIONS_DIRS are outside repository-only analysis.",
  }),
]);

function decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function isAncestor(scope: string, targetPath: string): boolean {
  return scope === "." || targetPath === scope || targetPath.startsWith(`${scope}/`);
}

function classify(path: string): CopilotDocument["kind"] | null {
  if (path === ".github/copilot-instructions.md" ||
      path.endsWith("/.github/copilot-instructions.md")) {
    return "repository-wide";
  }
  if (path.endsWith(".instructions.md") &&
      (path.startsWith(".github/instructions/") || path.includes("/.github/instructions/"))) {
    return "modular";
  }
  const base = pathBasename(path);
  if (base === "AGENTS.md" || base === "CLAUDE.md" || base === "GEMINI.md") return "agent";
  if (path === ".claude/CLAUDE.md" || path.endsWith("/.claude/CLAUDE.md")) return "agent";
  return null;
}

function scopeOf(path: string, kind: CopilotDocument["kind"]): string {
  if (kind === "repository-wide") {
    return path === ".github/copilot-instructions.md"
      ? "."
      : path.slice(0, -"/.github/copilot-instructions.md".length);
  }
  if (kind === "modular") {
    const marker = ".github/instructions/";
    const index = path.indexOf(marker);
    return index <= 0 ? "." : path.slice(0, index - 1);
  }
  if (path === ".claude/CLAUDE.md" || path.endsWith("/.claude/CLAUDE.md")) {
    return path === ".claude/CLAUDE.md" ? "." : path.slice(0, -"/.claude/CLAUDE.md".length);
  }
  return pathDirname(path);
}

function parseApplyTo(text: string): readonly string[] | null {
  const parsed = parseFrontmatterGlobs(text, "applyTo", false);
  if (parsed.kind !== "ok") return null;
  return parsed.patterns;
}

function matchesApplyTo(patterns: readonly string[], targetPath: string): boolean {
  return patterns.some((pattern) =>
    matchGlob(pattern, targetPath, { dot: true, nobrace: false })
  );
}

function isCopilotInstructionPath(path: string): boolean {
  return classify(path) !== null;
}

export function createCopilotProfile(config: {
  readonly id: string;
  readonly evidence: readonly EvidenceRef[];
}): ProfileDefinition {
  return {
  id: config.id,
  evidence: config.evidence,
  isInstructionPath: isCopilotInstructionPath,
  async prepare(snapshot: RepositorySnapshot): Promise<PreparedProfile> {
    const documents: CopilotDocument[] = [];
    for (const path of await snapshot.listPaths()) {
      const kind = classify(path);
      if (kind === null) continue;
      const node = await snapshot.entry(path);
      if (node === null) continue;
      const bytes = await snapshot.read(path);
      if (bytes === null) continue;
      const text = decode(bytes);
      documents.push({
        path,
        kind,
        nodeKind: node.kind,
        text,
        applyTo: kind === "modular" ? parseApplyTo(text) : null,
        scope: scopeOf(path, kind),
      });
    }
    return {
      id: config.id,
      sourceDependencyPaths: Object.freeze(
        documents.map((document) => document.path).sort(compareCodePoints),
      ),
      project(targetPath: string): Projection {
        const sources: ResolvedSource[] = [];
        const contributions: string[] = [];
        let partial = false;
        let unknown = false;
        for (const document of documents) {
          if (!isAncestor(document.scope, targetPath)) continue;
          if (document.nodeKind === "symlink") {
            unknown = true;
            sources.push({
              path: document.path,
              disposition: "SELECTED",
              digest: sha256(document.text),
              bytesUsed: 0,
              truncated: false,
            });
            continue;
          }
          if (document.kind === "modular" && document.applyTo === null) {
            sources.push({
              path: document.path,
              disposition: "EXCLUDED",
              digest: sha256(document.text),
              bytesUsed: 0,
              truncated: false,
            });
            continue;
          }
          if (document.kind === "modular" && !matchesApplyTo(document.applyTo ?? [], targetPath)) {
            sources.push({
              path: document.path,
              disposition: "EXCLUDED",
              digest: sha256(document.text),
              bytesUsed: 0,
              truncated: false,
            });
            continue;
          }
          const empty = document.text.trim() === "";
          sources.push({
            path: document.path,
            disposition: empty ? "SELECTED_EMPTY" : "SELECTED",
            digest: sha256(document.text),
            bytesUsed: empty ? 0 : Buffer.byteLength(document.text),
            truncated: false,
          });
          if (!empty) contributions.push(document.text);
          if ((document.kind === "repository-wide" || document.kind === "agent") &&
              FILE_REFERENCE.test(document.text)) {
            partial = true;
          }
        }
        const units = unitizePayloadContributions(contributions);
        const context = {
          cwd: ".",
          trigger: "READ_TARGET" as const,
          targetPath,
          repositoryOnly: true as const,
        };
        const evidence = [...config.evidence.map((item) => item.claim)];
        if (unknown) evidence.push(SYMLINK_EVIDENCE);
        if (partial) {
          evidence.push(
            "Documented @ file references are visible but not expanded in this revision.",
          );
        }
        const status = unknown ? "UNKNOWN" : partial ? "PARTIAL" : "COMPLETE";
        return {
          profile: config.id,
          context,
          status,
          composition: "UNSPECIFIED",
          sources,
          normalizedPayloadUnits: units,
          projectionDigest: digestProjectionIdentity({
            profile: config.id,
            context,
            status,
            composition: "UNSPECIFIED",
            sources,
            normalizedPayloadUnits: units,
            evidence,
            projectionDigest: null,
            normalizedPayloadDigest: null,
          }),
          normalizedPayloadDigest: digestNormalizedPayload(units, "UNSPECIFIED"),
          evidence,
        };
      },
    };
  },
};
}

export const copilotProfile: ProfileDefinition = createCopilotProfile({
  id: GITHUB_COPILOT_CLI_PROFILE_ID,
  evidence: COPILOT_EVIDENCE,
});

import { canonicalJson, sha256 } from "../canonical.js";
import { ancestorDirectories, joinRepositoryPath, pathDirname } from "../domain/repository-path.js";
import type { Projection, ResolvedSource } from "../model.js";
import { digestNormalizedPayload, unitizePayloadContributions } from "../profiles/profile.js";
import type { ClaudeDocumentExpansion } from "./ops-markdown.js";
import type { CompiledPack } from "./schema.js";

export function projectOrderedMarkdown(
  pack: CompiledPack,
  resolver: CompiledPack["resolver"],
  revisions: readonly string[],
  claims: readonly string[],
  fileNames: readonly string[],
  expansions: ReadonlyMap<string, ClaudeDocumentExpansion>,
  emptyPaths: ReadonlySet<string>,
  settingsPath: string | undefined,
  unionStatus: Projection["status"],
  unionEvidence: readonly string[],
  chainCache: Map<string, {
    status: Projection["status"];
    sources: readonly ResolvedSource[];
    contributions: readonly string[];
    evidence: readonly string[];
  }>,
  targetPath: string,
): Projection {
  const empty = {
    status: unionStatus,
    sources: [] as ResolvedSource[],
    contributions: [] as string[],
    evidence: [] as string[],
  };
  const materialFor = (directory: string): typeof empty => {
    const hit = chainCache.get(directory);
    if (hit !== undefined) return hit as typeof empty;
    const parent = directory === "." ? empty : materialFor(pathDirname(directory));
    const sources = [...parent.sources];
    const contributions = [...parent.contributions];
    const evidence = [...parent.evidence];
    let status = parent.status;
    for (const fileName of fileNames) {
      const path = joinRepositoryPath(directory, fileName);
      if (path === settingsPath) continue;
      const expansion = expansions.get(path);
      if (expansion === undefined) continue;
      if (expansion.status === "UNKNOWN") status = "UNKNOWN";
      else if (expansion.status === "PARTIAL" && status === "COMPLETE") status = "PARTIAL";
      const [head, ...imported] = expansion.sources;
      if (head !== undefined) {
        const emptyFile = emptyPaths.has(path);
        sources.push({
          ...head,
          disposition: emptyFile ? "SELECTED_EMPTY" : "SELECTED",
          bytesUsed: emptyFile ? 0 : head.bytesUsed,
        });
      }
      sources.push(...imported);
      contributions.push(...expansion.contributions);
      evidence.push(...expansion.evidence);
    }
    const material = { status, sources, contributions, evidence };
    chainCache.set(directory, material);
    return material;
  };
  const directory = ancestorDirectories(targetPath).at(-1) ?? ".";
  const material = materialFor(directory);
  const units = unitizePayloadContributions(material.contributions);
  const context = {
    cwd: ".",
    trigger: resolver.context.trigger,
    targetPath,
    repositoryOnly: true as const,
  };
  const evidence = [...claims, ...unionEvidence, ...material.evidence];
  return {
    profile: pack.pack.id,
    context,
    status: material.status,
    composition: "ORDERED",
    sources: material.sources,
    normalizedPayloadUnits: units,
    projectionDigest: sha256(canonicalJson({
      profile: pack.pack.id,
      context,
      status: material.status,
      composition: "ORDERED",
      sources: material.sources.map((item) => ({
        path: item.path,
        disposition: item.disposition,
        digest: item.digest,
        bytesUsed: item.bytesUsed,
        truncated: item.truncated,
      })),
      evidenceRevision: revisions,
    })),
    normalizedPayloadDigest: digestNormalizedPayload(units, "ORDERED"),
    evidence,
  };
}

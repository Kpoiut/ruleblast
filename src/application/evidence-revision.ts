import { createHash } from "node:crypto";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { compareCodePoints } from "../domain/repository-path.js";
import { readCandidateSurface, type CandidateSurface } from "../packs/candidate.js";
import {
  bundledDirectoryForPackId,
  bundledPacksRoot,
  candidatePacksRoot,
  loadBundledPack,
} from "../packs/load.js";
import type { PackClaim } from "../packs/schema.js";
import { presentationFor } from "./profile-catalog.js";

export type EvidenceStatus = "SEALED" | "NO_KNOWN_DRIFT" | "POSSIBLY_STALE";

export interface BundledEvidenceRow {
  readonly id: string;
  readonly evidenceDigest: string;
  readonly status: EvidenceStatus;
  readonly candidateDigest: string | null;
}

export interface CandidateSurfaceRow {
  readonly id: string;
  readonly label: string;
  readonly admission: "not-admitted";
  readonly stability: string;
  readonly evidenceDigest: string;
}

export interface EvidenceReveal {
  readonly bundled: readonly BundledEvidenceRow[];
  readonly candidates: readonly CandidateSurfaceRow[];
}

export interface EvidenceRevealRoots {
  readonly bundledRoot?: string;
  readonly candidateRoot?: string;
}

export function evidenceDigest(claims: readonly PackClaim[]): string {
  const canonical = claims.map((item) => ({
    claimId: item.claimId,
    sourceType: item.sourceType,
    sourceUrl: item.sourceUrl,
    retrievedAt: item.retrievedAt,
    sourceRevision: item.sourceRevision,
    claim: item.claim,
  }));
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function listDirectories(root: string): readonly string[] {
  try {
    return readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort(compareCodePoints);
  } catch {
    return Object.freeze([]);
  }
}

function loadCandidates(root: string): readonly CandidateSurface[] {
  const loaded: CandidateSurface[] = [];
  for (const name of listDirectories(root)) {
    const surface = readCandidateSurface(join(root, name));
    if (bundledDirectoryForPackId(surface.id) !== name) {
      throw new TypeError(
        `candidate directory ${JSON.stringify(name)} does not match id ${JSON.stringify(surface.id)}`,
      );
    }
    loaded.push(surface);
  }
  return Object.freeze(loaded);
}

export function revealEvidenceRevisions(
  roots: EvidenceRevealRoots = {},
): EvidenceReveal {
  const bundledRoot = roots.bundledRoot ?? bundledPacksRoot();
  const candidateRoot = roots.candidateRoot ?? candidatePacksRoot();
  const candidates = loadCandidates(candidateRoot);
  const byId = new Map(candidates.map((item) => [item.id, item]));
  const bundled = listDirectories(bundledRoot).map((name) => {
    const pack = loadBundledPack(name);
    const digest = evidenceDigest(pack.evidence);
    const candidate = byId.get(pack.pack.id);
    const candidateDigest = candidate === undefined ? null : evidenceDigest(candidate.evidence);
    const status: EvidenceStatus = candidateDigest === null
      ? "SEALED"
      : candidateDigest !== digest
        ? "POSSIBLY_STALE"
        : "NO_KNOWN_DRIFT";
    return Object.freeze({
      id: pack.pack.id,
      evidenceDigest: digest,
      status,
      candidateDigest,
    });
  }).sort((left, right) => compareCodePoints(left.id, right.id));
  const modeled = new Set(bundled.map((row) => row.id));
  const extra = candidates
    .filter((item) => !modeled.has(item.id))
    .map((item) => Object.freeze({
      id: item.id,
      label: item.label,
      admission: "not-admitted" as const,
      stability: item.stability,
      evidenceDigest: evidenceDigest(item.evidence),
    }))
    .sort((left, right) => compareCodePoints(left.id, right.id));
  return Object.freeze({
    bundled: Object.freeze(bundled),
    candidates: Object.freeze(extra),
  });
}

export function renderEvidenceReveal(reveal: EvidenceReveal = revealEvidenceRevisions()): string {
  const lines = ["EVIDENCE"];
  for (const row of reveal.bundled) {
    const label = presentationFor(row.id);
    lines.push(`  ${label.badge} ${label.shortLabel}  ${row.status}`);
  }
  if (reveal.candidates.length > 0) {
    lines.push("CANDIDATE");
    for (const row of reveal.candidates) {
      lines.push(`  ${row.id}  NOT_ADMITTED  ${row.stability}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

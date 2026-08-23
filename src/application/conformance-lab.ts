import { basename, join } from "node:path";
import { compareCodePoints } from "../domain/repository-path.js";
import {
  FIXTURE_AXES,
  listCandidateFixtures,
  readCandidateInventory,
  type CandidateFixture,
  type FixtureAxis,
} from "../packs/candidate.js";
import {
  bundledDirectoryForPackId,
  bundledPacksRoot,
  candidatePacksRoot,
  listContainedDirectories,
  readPackDirectory,
} from "../packs/load.js";
import { verifyBundledPack, type OracleProof } from "../packs/verify.js";
import { presentationFor } from "./profile-catalog.js";

export type LabEngine = "INTERPRET" | "FINGERPRINT";
export type AxisPresence = "RECORDED" | "ABSENT";

export interface LabRoots {
  readonly bundledRoot?: string;
  readonly candidateRoot?: string;
}

export interface BundledLabRow {
  readonly id: string;
  readonly engine: LabEngine;
  readonly proof: OracleProof;
  readonly missingOperations: readonly string[];
  readonly probeCount: number;
}

export interface AxisCoverage {
  readonly axis: FixtureAxis;
  readonly status: AxisPresence;
  readonly fixtures: readonly string[];
}

export interface CandidateLabRow {
  readonly id: string;
  readonly label: string;
  readonly admission: "not-admitted";
  readonly stability: string;
  readonly evidenceClaims: number;
  readonly axes: readonly AxisCoverage[];
  readonly load: "LOADED" | "ABSENT";
  readonly interpreter: "NONE";
  readonly proof: "UNEXECUTED";
  readonly blocked: readonly string[];
}

export interface ConformanceLab {
  readonly bundled: readonly BundledLabRow[];
  readonly candidates: readonly CandidateLabRow[];
}

function axisCoverage(fixtures: readonly CandidateFixture[]): readonly AxisCoverage[] {
  return Object.freeze(FIXTURE_AXES.map((axis) => {
    const ids = fixtures.filter((item) => item.axis === axis).map((item) => item.id);
    return Object.freeze({
      axis,
      status: ids.length > 0 ? "RECORDED" : "ABSENT",
      fixtures: Object.freeze(ids),
    });
  }));
}

function blockedReasons(axes: readonly AxisCoverage[]): readonly string[] {
  const missing = axes.filter((item) => item.status === "ABSENT").map((item) => item.axis);
  const reasons: string[] = [];
  if (missing.length > 0) {
    reasons.push(`missing axes: ${missing.join(", ")}`);
  }
  reasons.push("no interpreter-admissible resolver");
  return Object.freeze(reasons);
}

async function bundledRow(directory: string): Promise<BundledLabRow> {
  const pack = readPackDirectory(directory);
  const name = basename(directory);
  if (bundledDirectoryForPackId(pack.pack.id) !== name) {
    throw new TypeError(
      `bundled directory ${JSON.stringify(name)} does not match id ${JSON.stringify(pack.pack.id)}`,
    );
  }
  const verified = await verifyBundledPack(directory, pack);
  return Object.freeze({
    id: pack.pack.id,
    engine: verified.engine,
    proof: verified.proof,
    missingOperations: verified.missingOperations,
    probeCount: verified.probeCount,
  });
}

function candidateRow(
  root: string,
  surface: ReturnType<typeof readCandidateInventory>[number],
): CandidateLabRow {
  const claimIds = new Set(surface.evidence.map((item) => item.claimId));
  const fixtures = listCandidateFixtures(
    join(root, bundledDirectoryForPackId(surface.id)),
    claimIds,
  );
  const axes = axisCoverage(fixtures);
  return Object.freeze({
    id: surface.id,
    label: surface.label,
    admission: "not-admitted",
    stability: surface.stability,
    evidenceClaims: surface.evidence.length,
    axes,
    load: fixtures.length > 0 ? "LOADED" : "ABSENT",
    interpreter: "NONE",
    proof: "UNEXECUTED",
    blocked: blockedReasons(axes),
  });
}

async function buildLab(roots: LabRoots): Promise<ConformanceLab> {
  const bundledRoot = roots.bundledRoot ?? bundledPacksRoot();
  const candidateRoot = roots.candidateRoot ?? candidatePacksRoot();
  const bundled = (await Promise.all(
    listContainedDirectories(bundledRoot).map((name) => bundledRow(join(bundledRoot, name))),
  )).sort((left, right) => compareCodePoints(left.id, right.id));
  const modeled = new Set(bundled.map((row) => row.id));
  const candidates = readCandidateInventory(candidateRoot)
    .filter((item) => !modeled.has(item.id))
    .map((item) => candidateRow(candidateRoot, item))
    .sort((left, right) => compareCodePoints(left.id, right.id));
  return Object.freeze({
    bundled: Object.freeze(bundled),
    candidates: Object.freeze(candidates),
  });
}

let defaultLab: ConformanceLab | undefined;

export async function inventoryConformanceLab(roots: LabRoots = {}): Promise<ConformanceLab> {
  const usingDefault = roots.bundledRoot === undefined && roots.candidateRoot === undefined;
  if (usingDefault && defaultLab !== undefined) return defaultLab;
  const lab = await buildLab(roots);
  if (usingDefault) defaultLab = lab;
  return lab;
}

export function ensureConformanceLab(): Promise<ConformanceLab> {
  return inventoryConformanceLab();
}

function formatOps(missing: readonly string[]): string {
  if (missing.length === 0) return "0 ops";
  return `${missing.length} ops  ${missing.join(" · ")}`;
}

function formatAxes(axes: readonly AxisCoverage[]): string {
  return axes.map((item) => `${item.axis} ${item.status}`).join("  ");
}

export type LabRenderMode = "compact" | "identity";

export async function renderConformanceLab(
  lab?: ConformanceLab,
  mode: LabRenderMode = "compact",
): Promise<string> {
  const view = lab ?? await inventoryConformanceLab();
  const lines = ["LAB"];
  for (const row of view.bundled) {
    const label = presentationFor(row.id);
    const identity = mode === "identity" ? `  ${row.id}` : "";
    lines.push(
      `  ${label.badge} ${label.shortLabel}${identity}  ${row.engine}  ${row.proof}  ${formatOps(row.missingOperations)}  ${row.probeCount} probes`,
    );
  }
  for (const row of view.candidates) {
    lines.push(`  ${row.id}  NOT_ADMITTED  ${row.stability}`);
    lines.push(`    evidence ${row.evidenceClaims}  ${formatAxes(row.axes)}`);
    lines.push(`    load ${row.load}`);
    lines.push(`    interpreter ${row.interpreter}`);
    lines.push(`    proof ${row.proof}`);
    lines.push(`    blocked ${row.blocked.join("; ")}`);
  }
  lines.push("Not model quality.");
  lines.push("IDs name runtimes, not models.");
  lines.push("RECORDED is not a passing oracle.");
  return `${lines.join("\n")}\n`;
}

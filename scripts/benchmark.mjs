#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from "node:fs";
import { cpus, platform, release } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inventoryConformanceLab } from "../dist/application/conformance-lab.js";
import {
  PROFILE_CATALOG,
  defaultProfileDefinitions,
} from "../dist/application/profile-catalog.js";
import { diffExplain } from "../dist/cli-output.js";
import { analyzeCurrent, analyzeDiff } from "../dist/impact.js";
import { explainPresentationContext, renderExplain } from "../dist/render-explain.js";
import { ManifestSnapshot } from "../dist/snapshot.js";

const PATH_COUNT = 10_000;
const WARMUP_COUNT = 5;
const SAMPLE_COUNT = 20;
const EFFICIENCY_P95_MS = 1_000;
const CEILING_P95_MS = 2_000;
const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GIF_PAIR_ROOT = join(REPOSITORY_ROOT, "test/fixtures/overlay-206");
const GIF_EXPLAIN_PATH = "codex-rs/tui/src/bottom_pane/chat_composer.rs";
const DEFAULT_PROFILES = defaultProfileDefinitions();
const ALL_PROFILES = Object.freeze(PROFILE_CATALOG.map((entry) => entry.definition));
const HOT_TARGET = "packages/deep/src/file-00010.ts";

function entry(path, text = "") {
  return {
    path,
    kind: "file",
    executable: false,
    base64: Buffer.from(text, "utf8").toString("base64"),
  };
}

export function createBenchmarkSnapshot() {
  const entries = [
    entry("AGENTS.md", "Root benchmark instruction.\n"),
    entry("packages/deep/AGENTS.md", "Nested benchmark instruction.\n"),
    entry("packages/deep/CLAUDE.md", "Nested benchmark instruction.\n"),
    entry("GEMINI.md", "Root Gemini benchmark instruction.\n"),
    entry(".github/copilot-instructions.md", "Root Copilot benchmark instruction.\n"),
  ];
  for (let index = entries.length; index < PATH_COUNT; index += 1) {
    entries.push(entry(`packages/deep/src/file-${String(index).padStart(5, "0")}.ts`));
  }
  return new ManifestSnapshot({
    schemaVersion: 1,
    label: "ruleblast-benchmark",
    entries,
  });
}

function snapshotFromTree(root, label) {
  const entries = [];
  const walk = (directory) => {
    for (const name of readdirSync(directory)) {
      const full = join(directory, name);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
        continue;
      }
      if (!stat.isFile()) continue;
      const path = relative(root, full).split("\\").join("/");
      entries.push({
        path,
        kind: "file",
        executable: false,
        base64: readFileSync(full).toString("base64"),
      });
    }
  };
  walk(root);
  return new ManifestSnapshot({ schemaVersion: 1, label, entries });
}

function percentile95(sorted) {
  return sorted[Math.ceil(0.95 * sorted.length) - 1];
}

function median(sorted) {
  const midpoint = sorted.length / 2;
  return sorted.length % 2 === 0
    ? (sorted[midpoint - 1] + sorted[midpoint]) / 2
    : sorted[Math.floor(midpoint)];
}

function sampleStats(samplesMs) {
  const sorted = [...samplesMs].sort((left, right) => left - right);
  return {
    medianMs: median(sorted),
    p95Ms: percentile95(sorted),
    samplesMs,
  };
}

async function timed(run) {
  const started = performance.now();
  const value = await run();
  return { value, elapsedMs: performance.now() - started };
}

async function measuredCurrent(snapshot) {
  const { value, elapsedMs } = await timed(() => analyzeCurrent({
    snapshot,
    profiles: DEFAULT_PROFILES,
  }));
  if (value.counts.candidatePathCount !== PATH_COUNT || value.paths.length !== PATH_COUNT) {
    throw new Error(
      `Benchmark analyzed ${value.paths.length}/${value.counts.candidatePathCount} paths, expected ${PATH_COUNT}`,
    );
  }
  return elapsedMs;
}

async function sample(run) {
  for (let index = 0; index < WARMUP_COUNT; index += 1) await run();
  const samplesMs = [];
  for (let index = 0; index < SAMPLE_COUNT; index += 1) {
    samplesMs.push(await run());
  }
  return sampleStats(samplesMs);
}

async function measureGifPair() {
  const before = snapshotFromTree(join(GIF_PAIR_ROOT, "before"), "gif-before");
  const after = snapshotFromTree(join(GIF_PAIR_ROOT, "after"), "gif-after");
  const run = async () => {
    const { value, elapsedMs } = await timed(() => analyzeDiff({
      before,
      after,
      profiles: DEFAULT_PROFILES,
    }));
    return { elapsedMs, result: value };
  };
  const first = await run();
  const stats = await sample(async () => (await run()).elapsedMs);
  const explained = diffExplain(first.result, GIF_EXPLAIN_PATH);
  const explainMs = [];
  for (let index = 0; index < SAMPLE_COUNT; index += 1) {
    const started = performance.now();
    const text = renderExplain(explained, explainPresentationContext(explained), false);
    explainMs.push(performance.now() - started);
    if (!text.includes("KEEP") || !text.includes("WHY THIS PATH")) {
      throw new Error("GIF explain text lost KEEP or WHY THIS PATH");
    }
  }
  return {
    candidatePathCount: first.result.counts.candidatePathCount,
    changedStackPathCount: first.result.counts.changedStackPathCount,
    editedLineCount: first.result.diffStats.editedLineCount,
    explainPath: GIF_EXPLAIN_PATH,
    diff: stats,
    explain: sampleStats(explainMs),
  };
}

async function measureLab() {
  const first = await timed(() => inventoryConformanceLab());
  const cached = await timed(() => inventoryConformanceLab());
  const lab = first.value;
  const byId = Object.fromEntries(lab.bundled.map((row) => [row.id, row]));
  const codex = byId["openai/codex-cli@1"];
  const copilot = byId["github/copilot-cli@1"];
  const claude = byId["anthropic/claude-code-cli@1"];
  const gemini = byId["google/gemini-cli@1"];
  if (
    codex?.proof !== "ORACLE" || copilot?.proof !== "ORACLE" ||
    claude?.proof !== "ORACLE" || gemini?.proof !== "ORACLE"
  ) {
    throw new Error("Lab lost interpreter ORACLE proof on a bundled reality");
  }
  if (gemini.missingOperations.length !== 0) {
    throw new Error("Lab lost Gemini interpreter coverage");
  }
  const interpretOracleCount = lab.bundled.filter((row) => row.proof === "ORACLE").length;
  const fingerprintAdapterCount = lab.bundled.filter((row) => row.proof === "ADAPTER").length;
  if (interpretOracleCount !== 4 || fingerprintAdapterCount !== 0) {
    throw new Error("Lab lost 4/4 interpreter ORACLE coverage");
  }
  const rows = lab.bundled.map((row) => ({
    id: row.id,
    engine: row.engine,
    proof: row.proof,
    missingOperations: row.missingOperations,
    probeCount: row.probeCount,
  }));
  if (rows.some((row) => row.probeCount < 1)) {
    throw new Error("Lab lost sealed oracle probe counts");
  }
  return {
    firstMs: first.elapsedMs,
    cachedMs: cached.elapsedMs,
    bundled: lab.bundled.length,
    candidates: lab.candidates.length,
    interpretOracleCount,
    fingerprintAdapterCount,
    sealedProbeCount: rows.reduce((sum, row) => sum + row.probeCount, 0),
    rows,
  };
}

async function measureInterpreterChain(snapshot) {
  const engines = [];
  for (const profile of ALL_PROFILES) {
    const preparedAt = performance.now();
    const prepared = await profile.prepare(snapshot);
    const prepareMs = performance.now() - preparedAt;
    const projectedAt = performance.now();
    const projection = prepared.project(HOT_TARGET);
    const projectMs = performance.now() - projectedAt;
    if (prepared.sourceDependencyPaths.length < 1) {
      throw new Error(`Benchmark interpreter ${profile.id} found no instruction sources`);
    }
    if (projection.profile !== profile.id) {
      throw new Error(`Benchmark interpreter ${profile.id} lost its pack id`);
    }
    engines.push({
      id: profile.id,
      sourceDependencyPaths: prepared.sourceDependencyPaths.length,
      status: projection.status,
      prepareMs,
      projectMs,
    });
  }
  const { value, elapsedMs } = await timed(() => analyzeCurrent({
    snapshot,
    profiles: ALL_PROFILES,
  }));
  if (value.counts.candidatePathCount !== PATH_COUNT || value.counts.byProfile.length !== 4) {
    throw new Error("Benchmark lost four-reality catalog analysis");
  }
  return {
    allCurrentMs: elapsedMs,
    splitPathCount: value.counts.currentSplitPathCount,
    engines,
  };
}

export async function runBenchmark() {
  const snapshot = createBenchmarkSnapshot();
  if ((await snapshot.listPaths()).length !== PATH_COUNT) {
    throw new Error("Benchmark manifest is not exactly 10,000 paths");
  }
  const current10k = await sample(() => measuredCurrent(snapshot));
  const gif = await measureGifPair();
  const lab = await measureLab();
  const chain = await measureInterpreterChain(snapshot);
  const report = {
    benchmark: {
      candidatePathCount: PATH_COUNT,
      instructionFileCount: 5,
      nestedInstructionCount: 2,
      warmupCount: WARMUP_COUNT,
      sampleCount: SAMPLE_COUNT,
      medianMs: current10k.medianMs,
      p95Ms: current10k.p95Ms,
      efficiencyTargetP95Ms: EFFICIENCY_P95_MS,
      ceilingTargetP95Ms: CEILING_P95_MS,
      samplesMs: current10k.samplesMs,
    },
    surfaces: {
      gifDiff: gif.diff,
      gifExplain: gif.explain,
      gifPair: {
        candidatePathCount: gif.candidatePathCount,
        changedStackPathCount: gif.changedStackPathCount,
        editedLineCount: gif.editedLineCount,
        explainPath: gif.explainPath,
      },
      lab,
      interpreters: chain,
    },
    environment: {
      node: process.version,
      os: `${platform()} ${release()}`,
      arch: process.arch,
      cpu: cpus()[0]?.model ?? "unknown",
    },
  };
  if (report.benchmark.p95Ms >= CEILING_P95_MS) {
    throw Object.assign(
      new Error(
        `Benchmark p95 ${report.benchmark.p95Ms.toFixed(2)}ms is not under the ${CEILING_P95_MS}ms ceiling`,
      ),
      { report },
    );
  }
  if (report.benchmark.p95Ms >= EFFICIENCY_P95_MS) {
    throw Object.assign(
      new Error(
        `Benchmark p95 ${report.benchmark.p95Ms.toFixed(2)}ms is not under the ${EFFICIENCY_P95_MS}ms efficiency gate (ceiling remains ${CEILING_P95_MS}ms)`,
      ),
      { report },
    );
  }
  return report;
}

const directEntry = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (directEntry) {
  try {
    const report = await runBenchmark();
    if (process.argv.includes("--json")) {
      process.stdout.write(`${JSON.stringify(report)}\n`);
    } else {
      const { benchmark, surfaces, environment } = report;
      process.stdout.write(
        `current 10k: ${benchmark.candidatePathCount} paths, ` +
        `${benchmark.warmupCount} warmups + ${benchmark.sampleCount} samples, ` +
        `median ${benchmark.medianMs.toFixed(2)}ms, p95 ${benchmark.p95Ms.toFixed(2)}ms ` +
        `(efficiency <${benchmark.efficiencyTargetP95Ms}ms, ceiling <${benchmark.ceilingTargetP95Ms}ms)\n` +
        `gif pair: ${surfaces.gifPair.candidatePathCount} paths, ` +
        `${surfaces.gifPair.changedStackPathCount} changed stacks, ` +
        `diff p95 ${surfaces.gifDiff.p95Ms.toFixed(2)}ms, ` +
        `explain p95 ${surfaces.gifExplain.p95Ms.toFixed(2)}ms\n` +
        `lab: first ${surfaces.lab.firstMs.toFixed(2)}ms, cached ${surfaces.lab.cachedMs.toFixed(2)}ms, ` +
        `${surfaces.lab.interpretOracleCount} ORACLE\n` +
        `interpreters: 4-reality current ${surfaces.interpreters.allCurrentMs.toFixed(2)}ms, ` +
        `${surfaces.interpreters.engines.map((row) => `${row.id} ${row.sourceDependencyPaths} src`).join("; ")}\n` +
        `baseline: Node ${environment.node}, ${environment.os}, ${environment.arch}, ${environment.cpu}\n`,
      );
    }
  } catch (error) {
    if (error?.report) process.stderr.write(`${JSON.stringify(error.report)}\n`);
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

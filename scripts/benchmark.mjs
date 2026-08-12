#!/usr/bin/env node

import { cpus, platform, release } from "node:os";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import { analyzeCurrent } from "../dist/impact.js";
import { claudeProfile } from "../dist/profiles/claude.js";
import { codexProfile } from "../dist/profiles/codex.js";
import { ManifestSnapshot } from "../dist/snapshot.js";

const PATH_COUNT = 10_000;
const WARMUP_COUNT = 5;
const SAMPLE_COUNT = 20;
const P95_TARGET_MS = 2_000;

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

function percentile95(sorted) {
  return sorted[Math.ceil(0.95 * sorted.length) - 1];
}

function median(sorted) {
  const midpoint = sorted.length / 2;
  return sorted.length % 2 === 0
    ? (sorted[midpoint - 1] + sorted[midpoint]) / 2
    : sorted[Math.floor(midpoint)];
}

async function measuredAnalysis(snapshot) {
  const started = performance.now();
  const result = await analyzeCurrent({
    snapshot,
    profiles: [claudeProfile, codexProfile],
  });
  const elapsedMs = performance.now() - started;
  if (result.counts.candidatePathCount !== PATH_COUNT || result.paths.length !== PATH_COUNT) {
    throw new Error(
      `Benchmark analyzed ${result.paths.length}/${result.counts.candidatePathCount} paths, expected ${PATH_COUNT}`,
    );
  }
  return elapsedMs;
}

export async function runBenchmark() {
  const snapshot = createBenchmarkSnapshot();
  if ((await snapshot.listPaths()).length !== PATH_COUNT) {
    throw new Error("Benchmark manifest is not exactly 10,000 paths");
  }
  for (let index = 0; index < WARMUP_COUNT; index += 1) {
    await measuredAnalysis(snapshot);
  }
  const samplesMs = [];
  for (let index = 0; index < SAMPLE_COUNT; index += 1) {
    samplesMs.push(await measuredAnalysis(snapshot));
  }
  const sorted = [...samplesMs].sort((left, right) => left - right);
  const report = {
    benchmark: {
      candidatePathCount: PATH_COUNT,
      instructionFileCount: 3,
      nestedInstructionCount: 2,
      warmupCount: WARMUP_COUNT,
      sampleCount: SAMPLE_COUNT,
      medianMs: median(sorted),
      p95Ms: percentile95(sorted),
      targetP95Ms: P95_TARGET_MS,
      samplesMs,
    },
    environment: {
      node: process.version,
      os: `${platform()} ${release()}`,
      arch: process.arch,
      cpu: cpus()[0]?.model ?? "unknown",
    },
  };
  if (report.benchmark.p95Ms >= P95_TARGET_MS) {
    throw Object.assign(
      new Error(`Benchmark p95 ${report.benchmark.p95Ms.toFixed(2)}ms is not under ${P95_TARGET_MS}ms`),
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
      const { benchmark, environment } = report;
      process.stdout.write(
        `benchmark: ${benchmark.candidatePathCount} paths, ` +
        `${benchmark.warmupCount} warmups + ${benchmark.sampleCount} samples, ` +
        `median ${benchmark.medianMs.toFixed(2)}ms, p95 ${benchmark.p95Ms.toFixed(2)}ms ` +
        `(target <${benchmark.targetP95Ms}ms)\n` +
        `baseline: Node ${environment.node}, ${environment.os}, ${environment.arch}, ${environment.cpu}\n`,
      );
    }
  } catch (error) {
    if (error?.report) process.stderr.write(`${JSON.stringify(error.report)}\n`);
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

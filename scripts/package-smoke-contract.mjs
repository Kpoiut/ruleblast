import { writeFileSync } from "node:fs";

function fail(message) {
  throw new Error(message);
}

export function assertInstalledPackage(source, installed, packedEntry) {
  if (installed.name !== packedEntry.name || installed.version !== packedEntry.version ||
      installed.bin?.ruleblast !== "dist/cli.js") {
    fail("Installed package identity or bin target changed");
  }
  for (const field of ["description", "keywords", "repository", "homepage", "bugs"]) {
    if (JSON.stringify(installed[field]) !== JSON.stringify(source[field])) {
      fail(`Installed package metadata changed: ${field}`);
    }
  }
}

export function assertJsonContract(label, bytes, mode, analysisMode) {
  let value;
  try {
    value = JSON.parse(bytes.toString("utf8"));
  } catch {
    fail(`${label} did not emit JSON`);
  }
  if (value === null || typeof value !== "object" || value.mode !== mode ||
      value.schemaVersion !== 1 || value.resolverRevision !== 1) {
    fail(`${label} emitted the wrong schema`);
  }
  if (analysisMode !== undefined && value.analysisMode !== analysisMode) {
    fail(`${label} emitted the wrong analysis mode`);
  }
  if (mode === "current") {
    const selected = value.paths?.find((path) => path?.path === "src/index.ts");
    if (value.snapshot?.kind !== "worktree" || !Array.isArray(selected?.projections) ||
        selected.projections.length !== 2) {
      fail(`${label} omitted the fixture worktree projection`);
    }
  }
  if (mode === "diff") {
    const selected = value.paths?.find((path) => path?.path === "src/index.ts");
    const packagedCase = label === "case JSON";
    const valid = packagedCase
      ? value.before?.kind === "git" && value.after?.kind === "git" &&
        value.before?.oid === "27d52e2cd6eeb25d9b395351fc2212e2d48cb7c8" &&
        value.after?.oid === "e420008a1c10c5c328e506247560117f4d40b855" &&
        value.diffStats?.editedLineCount === 33 &&
        value.counts?.candidatePathCount === 106 &&
        value.counts?.changedStackPathCount === 106 &&
        value.counts?.newlySplitPathCount === 0 &&
        value.counts?.currentSplitPathCount === 0 &&
        value.counts?.partialPathCount === 0 &&
        value.counts?.unknownPathCount === 0 &&
        value.counts?.indeterminatePathCount === 0 &&
        Array.isArray(value.findings) && value.findings.length === 0
      : value.before?.kind === "git" && value.after?.kind === "worktree" &&
        Array.isArray(selected?.changedProfiles) && selected.changedProfiles.length > 0 &&
        value.counts?.changedStackPathCount > 0 &&
        value.counts?.newlySplitPathCount > 0;
    if (!valid || !Array.isArray(value.groups)) {
      fail(`${label} omitted its verified diff`);
    }
  }
  if (mode === "explain") {
    const projections = value.path?.projections;
    if (value.path?.path !== "src/index.ts" || !Array.isArray(projections) ||
        projections.length !== 2 || projections.some((projection) =>
          !Array.isArray(projection?.sources) || projection.sources.length === 0)) {
      fail(`${label} omitted the selected profile source chains`);
    }
  }
  return value;
}

export function assertTextContracts(outputs) {
  const expected = new Map([
    ["current-text", ["RULEBLAST · WORKTREE", "tracked paths", "Scope: 3 tracked paths"]],
    ["diff-text", ["RULEBLAST · HEAD → WORKTREE", "instruction-line edit", "tracked paths changed stack"]],
    ["explain-text", ["RULEBLAST EXPLAIN · WORKTREE", "src/index.ts", "Sources:"]],
  ]);
  for (const [label, fragments] of expected) {
    const text = outputs.get(label)?.toString("utf8") ?? "";
    for (const fragment of fragments) {
      if (!text.includes(fragment)) fail(`${label} omitted ${JSON.stringify(fragment)}`);
    }
  }
}

export function assertNoPathLeak(outputs, paths) {
  const candidates = [...new Set(paths.flatMap((path) => [
    path,
    path.replaceAll("\\", "/"),
  ]).filter((path) => path !== ""))];
  const comparable = (text) => process.platform === "win32"
    ? text.toLowerCase()
    : text;
  const comparableCandidates = candidates.map(comparable);
  const containsPath = (text) => {
    const value = comparable(text);
    return comparableCandidates.some((candidate) => value.includes(candidate));
  };

  for (const [label, bytes] of outputs) {
    const raw = bytes.toString("utf8");
    let value;
    try {
      value = JSON.parse(raw);
    } catch {
      if (containsPath(raw)) fail(`${label} leaked an absolute path`);
      continue;
    }
    const pending = [value];
    while (pending.length > 0) {
      const item = pending.pop();
      if (typeof item === "string") {
        if (containsPath(item)) fail(`${label} leaked an absolute path`);
      } else if (Array.isArray(item)) {
        pending.push(...item);
      } else if (typeof item === "object" && item !== null) {
        for (const [key, child] of Object.entries(item)) pending.push(key, child);
      }
    }
  }
}

export function writeNetworkDenyPreload(path) {
  writeFileSync(path, [
    "const moduleBuiltin = require('node:module');",
    "const net = require('node:net');",
    "const tls = require('node:tls');",
    "const dgram = require('node:dgram');",
    "const http = require('node:http');",
    "const https = require('node:https');",
    "const http2 = require('node:http2');",
    "const dns = require('node:dns');",
    "const deny = () => { throw new Error('RuleBlast package smoke denied network access'); };",
    "net.connect = net.createConnection = net.Socket.prototype.connect = deny;",
    "tls.connect = tls.TLSSocket.prototype.connect = deny;",
    "dgram.createSocket = dgram.Socket.prototype.connect = dgram.Socket.prototype.send = deny;",
    "http.request = http.get = https.request = https.get = http2.connect = deny;",
    "for (const key of ['lookup','resolve','resolve4','resolve6','resolveAny','resolveCaa','resolveCname','resolveMx','resolveNaptr','resolveNs','resolvePtr','resolveSoa','resolveSrv','resolveTxt','reverse']) dns[key] = deny;",
    "for (const key of Object.keys(dns.promises)) if (typeof dns.promises[key] === 'function') dns.promises[key] = deny;",
    "globalThis.fetch = deny;",
    "moduleBuiltin.syncBuiltinESMExports();",
    "",
  ].join("\n"));
}

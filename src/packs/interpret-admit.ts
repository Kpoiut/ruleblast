import type { DiscoverOrigin, ResolverSpec, TransformSpec } from "./schema.js";

function originExecutable(origin: DiscoverOrigin, reasons: string[]): void {
  if (origin.kind === "ancestors") {
    if (origin.from !== "repositoryRoot" || origin.inclusive !== true) {
      reasons.push("discover.range");
    }
    if (origin.to !== "cwd" && origin.to !== "dirname-target") reasons.push("discover.range");
    if (origin.names.length === 0) reasons.push("discover.names");
    return;
  }
  if (origin.kind === "fixed" || origin.kind === "glob") return;
  reasons.push("discover.origin");
}

function orderedBudgetPath(resolver: ResolverSpec): boolean {
  return resolver.select.mode === "first-per-directory" &&
    resolver.assemble.mode === "ordered" &&
    resolver.transform[0]?.kind === "byte-budget";
}

function selectAllPath(resolver: ResolverSpec): boolean {
  return resolver.select.mode === "all" &&
    (resolver.assemble.mode === "ordered" || resolver.assemble.mode === "unspecified");
}

function uniqueTransformKinds(transform: readonly TransformSpec[]): boolean {
  const kinds = transform.map((item) => item.kind);
  return new Set(kinds).size === kinds.length;
}

export function uninterpretableReasons(resolver: ResolverSpec): readonly string[] {
  const reasons: string[] = [];
  if (resolver.onSymlink !== "unknown-unfollowed" && resolver.onSymlink !== "partial-unfollowed") {
    reasons.push("onSymlink");
  } else if (orderedBudgetPath(resolver) && resolver.onSymlink !== "unknown-unfollowed") {
    reasons.push("onSymlink");
  }
  if (resolver.discover.origins.length === 0) reasons.push("discover.origins");
  for (const origin of resolver.discover.origins) originExecutable(origin, reasons);
  if (!uniqueTransformKinds(resolver.transform)) reasons.push("transform");
  if (orderedBudgetPath(resolver) && resolver.transform.length !== 1) {
    reasons.push("transform");
  }
  if (selectAllPath(resolver) &&
      resolver.transform.some((item) => item.kind === "byte-budget")) {
    reasons.push("transform");
  }
  for (const transform of resolver.transform) {
    if (transform.kind === "byte-budget" && typeof transform.bytes === "number" && transform.bytes > 0) {
      continue;
    }
    if (transform.kind === "strip-html-comments") continue;
    if (
      transform.kind === "at-path-import" &&
      typeof transform.maxDepth === "number" &&
      transform.maxDepth > 0 &&
      (transform.lexer === undefined || transform.lexer === "markdown-v1")
    ) {
      continue;
    }
    if (
      transform.kind === "json-exclude-globs" &&
      typeof transform.path === "string" &&
      typeof transform.field === "string"
    ) {
      continue;
    }
    if (
      transform.kind === "json-union-names" &&
      typeof transform.path === "string" &&
      typeof transform.field === "string" &&
      Array.isArray(transform.union) &&
      transform.union.length > 0
    ) {
      continue;
    }
    reasons.push("transform");
    break;
  }
  if (
    resolver.onAtReference !== undefined &&
    resolver.onAtReference !== "ignore" &&
    resolver.onAtReference !== "partial-unexpanded"
  ) {
    reasons.push("onAtReference");
  }
  if (!orderedBudgetPath(resolver) && !selectAllPath(resolver)) {
    reasons.push(resolver.select.mode === "all" ? "assemble" : "select");
  }
  return Object.freeze([...new Set(reasons)]);
}

export function canInterpretResolver(resolver: ResolverSpec): boolean {
  return uninterpretableReasons(resolver).length === 0;
}

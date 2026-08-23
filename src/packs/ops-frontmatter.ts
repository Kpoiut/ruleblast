import { isAlias, isMap, isPair, isScalar, isSeq, parseDocument, visit } from "yaml";

export type FrontmatterGlobs =
  | { readonly kind: "absent"; readonly body: string }
  | { readonly kind: "malformed" }
  | { readonly kind: "ok"; readonly patterns: readonly string[]; readonly body: string };

function scalarPatterns(value: string): readonly string[] {
  const trimmed = value.trim().replace(/^["']|["']$/gu, "");
  if (trimmed === "") return [];
  return Object.freeze(trimmed.split(",").map((part) => part.trim()).filter(Boolean));
}

function forbiddenYaml(document: ReturnType<typeof parseDocument>): boolean {
  if (document.errors.length > 0 || document.warnings.length > 0) return true;
  let forbidden = false;
  visit(document, (_key, node) => {
    if (isAlias(node) ||
        (typeof node === "object" && node !== null && "anchor" in node &&
          typeof node.anchor === "string") ||
        (isPair(node) && isScalar(node.key) && node.key.value === "<<")) {
      forbidden = true;
      return visit.BREAK;
    }
    return undefined;
  });
  return forbidden;
}

/** Narrow YAML: one mapping field to a string scalar (comma-split) or a string sequence. */
export function parseFrontmatterGlobs(
  text: string,
  field: string,
  sequenceOnly: boolean,
): FrontmatterGlobs {
  const normalized = text.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---")) return { kind: "absent", body: text };
  if (!normalized.startsWith("---\n")) return { kind: "malformed" };
  const close = normalized.indexOf("\n---", 4);
  const after = close + 4;
  if (close === -1 || (after < normalized.length && normalized[after] !== "\n")) {
    return { kind: "malformed" };
  }
  const body = normalized.slice(after + (normalized[after] === "\n" ? 1 : 0));
  const document = parseDocument(normalized.slice(4, close), {
    schema: "core",
    strict: true,
    uniqueKeys: true,
  });
  if (forbiddenYaml(document)) return { kind: "malformed" };
  const root = document.contents;
  if (root === null || (isMap(root) && root.items.length === 0)) {
    return { kind: "absent", body };
  }
  if (!isMap(root)) return { kind: "malformed" };
  if (sequenceOnly &&
      root.items.some((item) => !isScalar(item.key) || item.key.value !== field)) {
    return { kind: "malformed" };
  }
  const pair = root.items.find((item) => isScalar(item.key) && item.key.value === field);
  if (pair === undefined) return { kind: "absent", body };
  const node = pair.value;
  if (node === null || node === undefined) {
    if (sequenceOnly) return { kind: "malformed" };
    return { kind: "ok", patterns: [], body };
  }
  if (isScalar(node) && typeof node.value === "string") {
    if (sequenceOnly) return { kind: "malformed" };
    return { kind: "ok", patterns: scalarPatterns(node.value), body };
  }
  if (!isSeq(node) ||
      node.items.some((item) => !isScalar(item) || typeof item.value !== "string")) {
    return { kind: "malformed" };
  }
  const patterns: string[] = [];
  for (const item of node.items) {
    if (!isScalar(item) || typeof item.value !== "string") return { kind: "malformed" };
    patterns.push(item.value);
  }
  return { kind: "ok", patterns: Object.freeze(patterns), body };
}

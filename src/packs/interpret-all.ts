import { Minimatch } from "minimatch";
import { sha256 } from "../canonical.js";
import { compareCodePoints, pathBasename } from "../domain/repository-path.js";
import type { Projection } from "../model.js";
import type { RepositorySnapshot } from "../snapshot.js";
import {
  defineEvidenceRef,
  type PreparedProfile,
  type ProfileDefinition,
} from "../profiles/profile.js";
import { InvalidPackError } from "./compile.js";
import { projectCopilot, projectMarkdown, type Captured } from "./interpret-all-project.js";
import { parseFrontmatterGlobs } from "./ops-frontmatter.js";
import {
  parseClaudeProjectSettings,
  parseClaudeRule,
  type ParsedClaudeRule,
} from "./ops-glob.js";
import {
  listClaudeImportReferences,
  prepareClaudeDocument,
  resolveClaudeImportPath,
  type CapturedClaudeFile,
} from "./ops-markdown.js";
import type { CompiledPack, DiscoverOrigin, FrontmatterApply, TransformSpec } from "./schema.js";

const ENTRY_FIELDS = ["path", "kind", "executable"] as const;

function applyOf(origin: DiscoverOrigin): FrontmatterApply | undefined {
  return origin.kind === "glob" ? origin.apply : undefined;
}

function globMatch(pattern: string, path: string): boolean {
  return new Minimatch(pattern, { dot: true }).match(path);
}

function originHits(origin: DiscoverOrigin, path: string): boolean {
  if (origin.kind === "fixed") return origin.paths.includes(path);
  if (origin.kind === "glob") return globMatch(origin.pattern, path);
  return origin.names.includes(pathBasename(path));
}

function jsonExclude(transform: readonly TransformSpec[]): TransformSpec | undefined {
  return transform.find((item) => item.kind === "json-exclude-globs");
}

function importTransform(transform: readonly TransformSpec[]): TransformSpec | undefined {
  return transform.find((item) => item.kind === "at-path-import");
}

function usesMarkdownOps(transform: readonly TransformSpec[]): boolean {
  return transform.some(
    (item) => item.kind === "strip-html-comments" || item.kind === "at-path-import",
  );
}

function applyPatternsOf(
  text: string,
  origin: DiscoverOrigin | undefined,
): { readonly patterns: readonly string[] | null; readonly content: string } {
  const apply = origin === undefined ? undefined : applyOf(origin);
  if (apply === undefined) return { patterns: null, content: text };
  const parsed = parseFrontmatterGlobs(text, apply.field, apply.matcher === "brace-budget");
  if (parsed.kind === "malformed") {
    return { patterns: apply.matcher === "brace-budget" ? [] : null, content: text };
  }
  if (parsed.kind !== "ok") return { patterns: null, content: text };
  return { patterns: parsed.patterns, content: parsed.body };
}

export function interpretSelectAllPack(pack: CompiledPack): ProfileDefinition {
  const resolver = pack.resolver;
  if (resolver.assemble.mode !== "unspecified" || resolver.select.mode !== "all") {
    throw new InvalidPackError(`select-all interpreter rejected ${pack.pack.id}`);
  }
  const origins = resolver.discover.origins;
  const claims = Object.freeze(pack.evidence.map((item) => item.claim));
  const revisions = Object.freeze(pack.evidence.map((item) => item.sourceRevision));
  const atPartial = resolver.onAtReference === "partial-unexpanded";
  const markdown = usesMarkdownOps(resolver.transform);
  const stripComments = resolver.transform.some((item) => item.kind === "strip-html-comments");
  const excludes = jsonExclude(resolver.transform);
  const imported = importTransform(resolver.transform);
  const maxDepth = imported?.maxDepth ?? 4;
  return Object.freeze({
    id: pack.pack.id,
    evidence: Object.freeze(pack.evidence.map((item) => defineEvidenceRef({
      url: item.sourceUrl,
      retrievedAt: item.retrievedAt,
      revision: item.sourceRevision,
      claim: item.claim,
    }))),
    isInstructionPath(path: string): boolean {
      return origins.some((origin) => originHits(origin, path));
    },
    async prepare(snapshot: RepositorySnapshot): Promise<PreparedProfile> {
      const paths = await snapshot.listPaths();
      const captured: Captured[] = [];
      const seen = new Map<string, number>();
      const queue: { path: string; depth: number }[] = [];
      for (const path of paths) {
        const origin = origins.find((item) => originHits(item, path));
        if (origin === undefined) continue;
        queue.push({ path, depth: 0 });
        seen.set(path, 0);
      }
      for (let index = 0; index < queue.length; index += 1) {
        const { path, depth } = queue[index]!;
        const origin = origins.find((item) => originHits(item, path));
        const entry = await snapshot.entry(path);
        if (entry === null) continue;
        const descriptors = Object.getOwnPropertyDescriptors(entry);
        if (
          Reflect.ownKeys(entry).length !== ENTRY_FIELDS.length ||
          ENTRY_FIELDS.some((field) => {
            const descriptor = descriptors[field];
            return descriptor === undefined || !("value" in descriptor);
          })
        ) {
          throw new TypeError(`Pack candidate entry must contain only own data fields: ${path}`);
        }
        const kind = descriptors.kind?.value;
        const executable = descriptors.executable?.value;
        if (
          descriptors.path?.value !== path ||
          (kind !== "file" && kind !== "symlink") ||
          typeof executable !== "boolean"
        ) {
          throw new TypeError(`Invalid pack candidate entry: ${path}`);
        }
        const bytes = await snapshot.read(path);
        if (bytes === null) continue;
        const text = new TextDecoder().decode(bytes);
        const frontmatter = applyPatternsOf(text, origin);
        captured.push(Object.freeze({
          path,
          kind,
          text,
          bytes: new Uint8Array(bytes),
          digest: sha256(text),
          origin: origin ?? origins[0]!,
          discovered: origin !== undefined,
          applyPatterns: frontmatter.patterns,
          content: frontmatter.content,
        }));
        if (
          !markdown ||
          kind === "symlink" ||
          depth >= maxDepth ||
          (excludes !== undefined && path === excludes.path)
        ) {
          continue;
        }
        const content = frontmatter.content;
        for (const reference of listClaudeImportReferences(content, stripComments)) {
          const dependency = resolveClaudeImportPath(path, reference);
          if (dependency === null || !paths.includes(dependency)) continue;
          const nextDepth = depth + 1;
          const prior = seen.get(dependency);
          if (prior !== undefined && prior <= nextDepth) continue;
          seen.set(dependency, nextDepth);
          queue.push({ path: dependency, depth: nextDepth });
        }
      }
      const ordered = [...captured].sort((left, right) => compareCodePoints(left.path, right.path));
      const files = new Map<string, CapturedClaudeFile>();
      for (const row of ordered) {
        files.set(row.path, Object.freeze({
          path: row.path,
          kind: row.kind,
          bytes: row.bytes,
        }));
      }
      const settings = excludes?.path === undefined
        ? parseClaudeProjectSettings(undefined)
        : parseClaudeProjectSettings(files.get(excludes.path));
      const documents = new Map(
        ordered
          .filter((row) => excludes === undefined || row.path !== excludes.path)
          .map((row) => {
            const file = files.get(row.path)!;
            return [row.path, prepareClaudeDocument(file, row.content, stripComments)] as const;
          }),
      );
      const rules = new Map<string, ParsedClaudeRule>();
      if (markdown) {
        for (const row of ordered) {
          if (!row.discovered || row.origin.kind !== "glob") continue;
          const file = files.get(row.path);
          if (file !== undefined) rules.set(row.path, parseClaudeRule(file));
        }
      }
      const cached = new Map<string, Projection>();
      return Object.freeze({
        id: pack.pack.id,
        sourceDependencyPaths: Object.freeze(ordered.map((item) => item.path)),
        project(targetPath: string): Projection {
          const hit = cached.get(targetPath);
          if (hit !== undefined) return hit;
          const projection = !markdown
            ? projectCopilot(
              pack, resolver, claims, atPartial, ordered, targetPath,
            )
            : projectMarkdown(
              pack, resolver, revisions, ordered, files, documents, settings,
              rules, excludes?.path, maxDepth, targetPath,
            );
          cached.set(targetPath, projection);
          return projection;
        },
      });
    },
  });
}

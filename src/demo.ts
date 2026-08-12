import { readFile } from "node:fs/promises";
import { ManifestSnapshot, type RepositorySnapshot } from "./snapshot.js";

export interface DemoSnapshots {
  readonly before: RepositorySnapshot;
  readonly after: RepositorySnapshot;
}

interface DemoLabels {
  readonly before: string;
  readonly after: string;
}

interface DemoPathGroup {
  readonly directory: string;
  readonly prefix: string;
  readonly count: number;
}

interface DemoFile {
  readonly path: string;
  readonly before: string;
  readonly after: string;
}

interface DemoRecipe {
  readonly schemaVersion: 1;
  readonly labels: DemoLabels;
  readonly pathGroups: readonly DemoPathGroup[];
  readonly files: readonly DemoFile[];
}

interface ManifestEntry {
  readonly path: string;
  readonly kind: "file";
  readonly executable: false;
  readonly base64: string;
}

const RECIPE_KEYS = ["schemaVersion", "labels", "pathGroups", "files"] as const;
const LABEL_KEYS = ["before", "after"] as const;
const GROUP_KEYS = ["directory", "prefix", "count"] as const;
const FILE_KEYS = ["path", "before", "after"] as const;

function fail(message: string): never {
  throw new TypeError(message);
}

function captureRecord(
  value: unknown,
  fields: readonly string[],
  description: string,
): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(`${description} must be a plain object`);
  }
  const prototype = Object.getPrototypeOf(value);
  const keys = Reflect.ownKeys(value);
  if ((prototype !== Object.prototype && prototype !== null) ||
      keys.length !== fields.length || keys.some(
        (key) => typeof key !== "string" || !fields.includes(key),
      )) {
    fail(`${description} has missing or unknown fields`);
  }
  const captured = Object.create(null) as Record<string, unknown>;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const field of fields) {
    const descriptor = descriptors[field];
    if (descriptor === undefined || !("value" in descriptor)) {
      fail(`${description}.${field} must be an own data property`);
    }
    captured[field] = descriptor.value;
  }
  return Object.freeze(captured);
}

function captureArray(value: unknown, description: string): readonly unknown[] {
  if (!Array.isArray(value) || Reflect.ownKeys(value).length !== value.length + 1) {
    fail(`${description} must be a dense array`);
  }
  const result: unknown[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined || !("value" in descriptor)) {
      fail(`${description} must contain only data elements`);
    }
    result.push(descriptor.value);
  }
  return Object.freeze(result);
}

function requiredString(value: unknown, description: string): string {
  if (typeof value !== "string" || value === "" || value.includes("\0")) {
    fail(`${description} must be a non-empty string without NUL`);
  }
  return value;
}

function textString(value: unknown, description: string): string {
  if (typeof value !== "string" || value.includes("\0")) {
    fail(`${description} must be a string without NUL`);
  }
  return value;
}

function captureRecipe(value: unknown): DemoRecipe {
  const recipe = captureRecord(value, RECIPE_KEYS, "Demo recipe");
  if (recipe.schemaVersion !== 1) fail("Demo recipe schemaVersion must be 1");

  const labelInput = captureRecord(recipe.labels, LABEL_KEYS, "Demo labels");
  const labels = Object.freeze({
    before: requiredString(labelInput.before, "Demo labels.before"),
    after: requiredString(labelInput.after, "Demo labels.after"),
  });
  if (labels.before === labels.after) fail("Demo endpoint labels must differ");

  const pathGroups = captureArray(recipe.pathGroups, "Demo pathGroups").map(
    (item, index): DemoPathGroup => {
      const group = captureRecord(item, GROUP_KEYS, `Demo pathGroups[${index}]`);
      if (typeof group.count !== "number" || !Number.isSafeInteger(group.count) ||
          group.count < 0 || group.count > 10_000) {
        fail(`Demo pathGroups[${index}].count must be an integer from 0 to 10000`);
      }
      return Object.freeze({
        directory: requiredString(
          group.directory,
          `Demo pathGroups[${index}].directory`,
        ),
        prefix: requiredString(group.prefix, `Demo pathGroups[${index}].prefix`),
        count: group.count,
      });
    },
  );
  const files = captureArray(recipe.files, "Demo files").map(
    (item, index): DemoFile => {
      const file = captureRecord(item, FILE_KEYS, `Demo files[${index}]`);
      return Object.freeze({
        path: requiredString(file.path, `Demo files[${index}].path`),
        before: textString(file.before, `Demo files[${index}].before`),
        after: textString(file.after, `Demo files[${index}].after`),
      });
    },
  );
  return Object.freeze({
    schemaVersion: 1,
    labels,
    pathGroups: Object.freeze(pathGroups),
    files: Object.freeze(files),
  });
}

function manifestEntry(path: string, text: string): ManifestEntry {
  return Object.freeze({
    path,
    kind: "file",
    executable: false,
    base64: Buffer.from(text, "utf8").toString("base64"),
  });
}

function generatedPath(group: DemoPathGroup, index: number): string {
  const serial = String(index + 1).padStart(4, "0");
  return `${group.directory}/${group.prefix}${serial}.ts`;
}

function expandEntries(
  recipe: DemoRecipe,
  endpoint: "before" | "after",
): readonly ManifestEntry[] {
  const entries: ManifestEntry[] = [];
  for (const group of recipe.pathGroups) {
    for (let index = 0; index < group.count; index += 1) {
      entries.push(manifestEntry(generatedPath(group, index), ""));
    }
  }
  for (const file of recipe.files) {
    entries.push(manifestEntry(file.path, file[endpoint]));
  }
  return Object.freeze(entries);
}

export function createDemoSnapshots(value: unknown): DemoSnapshots {
  const recipe = captureRecipe(value);
  const before = new ManifestSnapshot({
    schemaVersion: 1,
    label: recipe.labels.before,
    entries: expandEntries(recipe, "before"),
  });
  const after = new ManifestSnapshot({
    schemaVersion: 1,
    label: recipe.labels.after,
    entries: expandEntries(recipe, "after"),
  });
  return Object.freeze({ before, after });
}

export async function openDemo(): Promise<DemoSnapshots> {
  const bytes = await readFile(
    new URL("../fixtures/demo/case.json", import.meta.url),
    "utf8",
  );
  return createDemoSnapshots(JSON.parse(bytes) as unknown);
}

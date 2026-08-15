#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const schema = JSON.parse(
  readFileSync(join(root, "schemas/reality-pack-v1.schema.json"), "utf8"),
);

function Ajv2020() {
  const moduleName = "ajv/dist/2020.js";
  const loaded = require(moduleName);
  return loaded.default ?? loaded;
}

function collectBundles(directory) {
  if (!existsSync(directory) || !statSync(directory).isDirectory()) return [];
  const bundles = [];
  for (const name of readdirSync(directory)) {
    const packDir = join(directory, name);
    if (!statSync(packDir).isDirectory()) continue;
    const packPath = join(packDir, "pack.json");
    if (!existsSync(packPath) || !statSync(packPath).isFile()) continue;
    bundles.push({
      label: name,
      bundle: {
        pack: JSON.parse(readFileSync(packPath, "utf8")),
        evidence: JSON.parse(readFileSync(join(packDir, "evidence.json"), "utf8")),
        resolver: JSON.parse(readFileSync(join(packDir, "resolver.json"), "utf8")),
      },
    });
  }
  return bundles;
}

const Ajv = Ajv2020();
const ajv = new Ajv({ allErrors: true, strict: true });
const validate = ajv.compile(schema);
const bundled = collectBundles(join(root, "packs/bundled"));
const failures = [];
for (const item of bundled) {
  if (!validate(item.bundle)) {
    failures.push(`${item.label}: ${ajv.errorsText(validate.errors)}`);
  }
}

const compileUrl = pathToFileURL(join(root, "dist/packs/compile.js")).href;
const { compilePack, decodePackBundle, InvalidPackError } = await import(compileUrl);
for (const item of bundled) {
  try {
    compilePack(decodePackBundle(item.bundle));
  } catch (error) {
    failures.push(`${item.label} decoder: ${error instanceof Error ? error.message : String(error)}`);
    if (!(error instanceof InvalidPackError) && error?.name !== "InvalidPackError") {
      failures.push(`${item.label}: unexpected decoder error type`);
    }
  }
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write(
  `pack-schema: ${bundled.length} bundled pack(s) accepted by JSON Schema and TS decoder\n`,
);

import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const host = resolve(root, "hosts/vscode");
const outDir = resolve(root, "artifacts");
mkdirSync(outDir, { recursive: true });
cpSync(resolve(root, "LICENSE"), resolve(host, "LICENSE"));
const result = spawnSync(
  "npx",
  ["--yes", "@vscode/vsce@3.6.0", "package", "-o", resolve(outDir, "ruleblast-companion-2.2.0.vsix")],
  { cwd: host, stdio: "inherit", shell: true },
);
process.exit(result.status ?? 1);

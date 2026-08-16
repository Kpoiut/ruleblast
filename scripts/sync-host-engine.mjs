import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "dist");
const target = resolve(root, "hosts/vscode/engine");
if (!existsSync(source)) {
  throw new Error("npm run build first; dist/ is missing");
}
rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });

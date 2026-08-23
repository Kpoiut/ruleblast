import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const MAX_GIT_OUTPUT_BYTES = 256 * 1024 * 1024;

export async function runGit(
  directory: string,
  args: readonly string[],
  options: { readonly timeout?: number; readonly maxBuffer?: number } = {},
): Promise<Buffer> {
  const result = await execFileAsync(
    "git",
    [
      "--no-optional-locks",
      "--no-replace-objects",
      "-c",
      "core.fsmonitor=false",
      "-C",
      directory,
      ...args,
    ],
    {
      encoding: "buffer",
      env: {
        ...process.env,
        GIT_NO_LAZY_FETCH: "1",
        GIT_OPTIONAL_LOCKS: "0",
      },
      maxBuffer: options.maxBuffer ?? MAX_GIT_OUTPUT_BYTES,
      timeout: options.timeout,
      windowsHide: true,
    },
  );
  return Buffer.from(result.stdout);
}

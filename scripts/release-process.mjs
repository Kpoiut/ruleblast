import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

function fail(message) {
  throw new Error(message);
}

export function npmInvocation(args, environment = process.env) {
  const configured = environment.npm_execpath;
  if (configured && existsSync(configured)) {
    return { command: process.execPath, args: [configured, ...args] };
  }
  if (process.platform === "win32") {
    const bundled = resolve(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
    if (!existsSync(bundled)) fail("Unable to locate npm-cli.js");
    return { command: process.execPath, args: [bundled, ...args] };
  }
  return { command: "npm", args };
}

export function runProcess(command, args, options = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      shell: false,
      windowsHide: true,
      windowsVerbatimArguments: options.windowsVerbatimArguments === true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    let outputBytes = 0;
    const capture = (target) => (chunk) => {
      outputBytes += chunk.length;
      if (outputBytes > MAX_OUTPUT_BYTES) {
        child.kill();
        reject(new Error(`Output limit exceeded: ${command}`));
        return;
      }
      target.push(Buffer.from(chunk));
    };
    child.stdout.on("data", capture(stdout));
    child.stderr.on("data", capture(stderr));
    child.once("error", reject);
    child.once("close", (code, signal) => resolveRun({
      code,
      signal,
      stdout: Buffer.concat(stdout),
      stderr: Buffer.concat(stderr),
    }));
  });
}

export async function runStrict(command, args, options = {}) {
  const result = await runProcess(command, args, options);
  if (result.code !== 0 || result.signal !== null) {
    fail([
      `Command failed: ${command} ${args.join(" ")}`,
      `exit=${String(result.code)} signal=${String(result.signal)}`,
      result.stdout.toString("utf8"),
      result.stderr.toString("utf8"),
    ].join("\n"));
  }
  return result;
}

export async function runNpm(args, cwd, options = {}) {
  const invocation = npmInvocation(args, options.env);
  return runStrict(invocation.command, invocation.args, { cwd, env: options.env });
}

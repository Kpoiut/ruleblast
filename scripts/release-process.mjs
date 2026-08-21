import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

function fail(message) {
  throw new Error(message);
}

function waitForClose(child, timeoutMs = 5_000) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolveClose, rejectClose) => {
    const timer = setTimeout(
      () => rejectClose(new Error("Timed-out process did not close after termination")),
      timeoutMs,
    );
    child.once("close", () => {
      clearTimeout(timer);
      resolveClose();
    });
  });
}

function runTreeKiller(pid) {
  return new Promise((resolveKill) => {
    const killer = spawn(
      "taskkill",
      ["/pid", String(pid), "/t", "/f"],
      { windowsHide: true, stdio: "ignore" },
    );
    const timer = setTimeout(() => {
      killer.kill("SIGKILL");
      resolveKill(false);
    }, 5_000);
    killer.once("error", () => {
      clearTimeout(timer);
      resolveKill(false);
    });
    killer.once("close", (code) => {
      clearTimeout(timer);
      resolveKill(code === 0);
    });
  });
}

async function terminateProcessTree(child) {
  if (child.pid === undefined) return;
  if (process.platform === "win32") {
    const killedTree = await runTreeKiller(child.pid);
    if (!killedTree) child.kill("SIGKILL");
  } else {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      child.kill("SIGKILL");
    }
  }
  await waitForClose(child);
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
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    let outputBytes = 0;
    let settled = false;
    const timer = options.timeoutMs === undefined
      ? null
      : setTimeout(() => {
          if (settled) return;
          settled = true;
          void terminateProcessTree(child).then(
            () => reject(new Error(
              `Command timed out after ${options.timeoutMs}ms: ${command} ${args.join(" ")}`,
            )),
            reject,
          );
        }, options.timeoutMs);
    const clearTimer = () => {
      if (timer !== null) clearTimeout(timer);
    };
    const capture = (target) => (chunk) => {
      if (settled) return;
      outputBytes += chunk.length;
      if (outputBytes > MAX_OUTPUT_BYTES) {
        settled = true;
        clearTimer();
        void terminateProcessTree(child).then(
          () => reject(new Error(`Output limit exceeded: ${command}`)),
          reject,
        );
        return;
      }
      target.push(Buffer.from(chunk));
    };
    child.stdout.on("data", capture(stdout));
    child.stderr.on("data", capture(stderr));
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimer();
      reject(error);
    });
    child.once("close", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimer();
      resolveRun({
        code,
        signal,
        stdout: Buffer.concat(stdout),
        stderr: Buffer.concat(stderr),
      });
    });
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
  return runStrict(invocation.command, invocation.args, {
    cwd,
    env: options.env,
    timeoutMs: options.timeoutMs,
  });
}

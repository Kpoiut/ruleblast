import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveAgentAllow } from "../src/domain/agent-allow.js";

describe("user-owned agent-allow gate", () => {
  it("defaults to ask when the user has not allowed agents", () => {
    expect(resolveAgentAllow({ env: {}, cwd: tmpdir() })).toBe("ask");
  });

  it("turns on from RULEBLAST_AGENT_ALLOW without writing a file", () => {
    expect(resolveAgentAllow({
      env: { RULEBLAST_AGENT_ALLOW: "yes" },
      cwd: tmpdir(),
    })).toBe("yes");
    expect(resolveAgentAllow({
      env: { RULEBLAST_AGENT_ALLOW: "0" },
      cwd: tmpdir(),
    })).toBe("ask");
  });

  it("turns on from a user-created .ruleblast-allow and never invents that file", () => {
    const cwd = mkdtempSync(join(tmpdir(), "ruleblast-allow-"));
    writeFileSync(join(cwd, ".ruleblast-allow"), "yes\n");
    expect(resolveAgentAllow({ env: {}, cwd })).toBe("yes");
    writeFileSync(join(cwd, ".ruleblast-allow"), "off\n");
    expect(resolveAgentAllow({ env: {}, cwd })).toBe("ask");
    expect(resolveAgentAllow({
      env: { RULEBLAST_AGENT_ALLOW: "yes" },
      cwd,
    })).toBe("yes");
  });

  it("fails closed when .ruleblast-allow is empty, garbage, or unreadable", () => {
    const cwd = mkdtempSync(join(tmpdir(), "ruleblast-allow-closed-"));
    writeFileSync(join(cwd, ".ruleblast-allow"), "");
    expect(resolveAgentAllow({ env: {}, cwd })).toBe("ask");
    writeFileSync(join(cwd, ".ruleblast-allow"), "   \n");
    expect(resolveAgentAllow({ env: {}, cwd })).toBe("ask");
    writeFileSync(join(cwd, ".ruleblast-allow"), "maybe\n");
    expect(resolveAgentAllow({ env: {}, cwd })).toBe("ask");
    mkdirSync(join(cwd, "blocked"));
    writeFileSync(join(cwd, "blocked", ".ruleblast-allow"), "yes\n");
    rmSync(join(cwd, "blocked", ".ruleblast-allow"));
    mkdirSync(join(cwd, "blocked", ".ruleblast-allow"));
    expect(resolveAgentAllow({ env: {}, cwd: join(cwd, "blocked") })).toBe("ask");
  });
});

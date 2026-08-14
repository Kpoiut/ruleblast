import { mkdtempSync, writeFileSync } from "node:fs";
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
});

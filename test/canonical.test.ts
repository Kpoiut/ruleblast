import { describe, expect, it } from "vitest";
import { canonicalJson, sha256, sha256MovingTarget } from "../src/canonical.js";
import {
  ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID,
  OPENAI_CODEX_CLI_PROFILE_ID,
  parseProfileId,
} from "../src/model.js";

describe("canonicalJson", () => {
  it("recursively sorts object keys without reordering arrays", () => {
    expect(
      canonicalJson({ z: 1, nested: { z: 2, a: 3 }, a: ["b", "a"] }),
    ).toBe('{"a":["b","a"],"nested":{"a":3,"z":2},"z":1}');
  });

  it("is byte-equivalent across insertion orders", () => {
    const left = { counts: { changed: 2, total: 5 }, revision: 1 };
    const right = { revision: 1, counts: { total: 5, changed: 2 } };

    expect(canonicalJson(left)).toBe(canonicalJson(right));
  });

  it("accepts JSON primitives", () => {
    expect(canonicalJson(null)).toBe("null");
    expect(canonicalJson(true)).toBe("true");
    expect(canonicalJson(false)).toBe("false");
    expect(canonicalJson(0)).toBe("0");
    expect(canonicalJson("ruleblast")).toBe('"ruleblast"');
  });

  it("accepts null-prototype plain records", () => {
    const record = Object.create(null) as Record<string, unknown>;
    record.z = 1;
    record.a = { d: 4, c: 3 };

    expect(canonicalJson(record)).toBe('{"a":{"c":3,"d":4},"z":1}');
  });

  it.each([
    ["at the root", undefined],
    ["in an object", { missing: undefined }],
    ["in an array", [undefined]],
  ])("rejects undefined %s", (_location, value) => {
    expect(() => canonicalJson(value)).toThrow(TypeError);
  });

  it("rejects functions", () => {
    expect(() => canonicalJson(() => "not JSON")).toThrow(TypeError);
  });

  it("rejects symbol values", () => {
    expect(() => canonicalJson(Symbol("not JSON"))).toThrow(TypeError);
  });

  it("rejects bigint values", () => {
    expect(() => canonicalJson(1n)).toThrow(TypeError);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects the non-finite number %s",
    (value) => {
      expect(() => canonicalJson(value)).toThrow(TypeError);
    },
  );

  it("rejects cycles", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    expect(() => canonicalJson(cyclic)).toThrow(TypeError);
  });

  it.each([new Date(0), new Map(), new (class Box {})()])(
    "rejects non-plain objects",
    (value) => {
      expect(() => canonicalJson(value)).toThrow(TypeError);
    },
  );

  it("rejects symbol-keyed properties", () => {
    const value: Record<PropertyKey, unknown> = { visible: true };
    value[Symbol("hidden")] = false;

    expect(() => canonicalJson(value)).toThrow(TypeError);
  });

  it("rejects enumerable object getters without invoking them", () => {
    let getterCallCount = 0;
    const value = Object.defineProperty({}, "unstable", {
      enumerable: true,
      get() {
        getterCallCount += 1;
        return getterCallCount;
      },
    });
    let failure: unknown;

    try {
      canonicalJson(value);
    } catch (error) {
      failure = error;
    }

    expect.soft(failure).toBeInstanceOf(TypeError);
    expect(getterCallCount).toBe(0);
  });

  it("rejects indexed array getters without invoking them", () => {
    let getterCallCount = 0;
    const value = [0];
    Object.defineProperty(value, 0, {
      enumerable: true,
      get() {
        getterCallCount += 1;
        return getterCallCount;
      },
    });
    let failure: unknown;

    try {
      canonicalJson(value);
    } catch (error) {
      failure = error;
    }

    expect.soft(failure).toBeInstanceOf(TypeError);
    expect(getterCallCount).toBe(0);
  });

  it("rejects sparse arrays", () => {
    const sparse: unknown[] = [];
    sparse.length = 1;

    expect(() => canonicalJson(sparse)).toThrow(TypeError);
  });

  it("does not append a trailing newline", () => {
    expect(canonicalJson({ value: 1 }).endsWith("\n")).toBe(false);
  });
});

describe("sha256", () => {
  it("returns a lowercase 64-character digest", () => {
    expect(sha256("ruleblast")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("accepts equivalent strings and UTF-8 bytes", () => {
    expect(sha256(new TextEncoder().encode("ruleblast"))).toBe(
      sha256("ruleblast"),
    );
  });
});

describe("sha256MovingTarget", () => {
  it("matches a full canonicalize for each target path", () => {
    const digest = sha256MovingTarget((targetPath) => ({
      assembledPayload: "Root benchmark instruction.\n",
      composition: "ORDERED",
      context: {
        cwd: "packages/deep/src",
        repositoryOnly: true,
        targetPath,
        trigger: "STARTUP",
      },
      profile: "openai/codex-cli@1",
      status: "COMPLETE",
    }));
    for (const targetPath of [
      "packages/deep/src/file-00003.ts",
      "packages/deep/src/file-09999.ts",
      "AGENTS.md",
    ]) {
      expect(digest(targetPath)).toBe(sha256(canonicalJson({
        assembledPayload: "Root benchmark instruction.\n",
        composition: "ORDERED",
        context: {
          cwd: "packages/deep/src",
          repositoryOnly: true,
          targetPath,
          trigger: "STARTUP",
        },
        profile: "openai/codex-cli@1",
        status: "COMPLETE",
      })));
    }
  });
});

describe("parseProfileId", () => {
  it.each([
    "a/b@1",
    "a-/b-@10",
    "openai/codex-cli@1",
    "anthropic/claude-code-cli@1",
  ])("accepts valid profile id %s", (value) => {
    expect(parseProfileId(value)).toBe(value);
  });

  it("exports the two bundled v1 profile ids", () => {
    expect(OPENAI_CODEX_CLI_PROFILE_ID).toBe("openai/codex-cli@1");
    expect(ANTHROPIC_CLAUDE_CODE_CLI_PROFILE_ID).toBe(
      "anthropic/claude-code-cli@1",
    );
  });

  it.each([
    "",
    "a/b@0",
    "a/b@01",
    "a/b@",
    "a/b@1.0",
    "a/@1",
    "/b@1",
    "-a/b@1",
    "a/-b@1",
    "A/b@1",
    "a/B@1",
    "a_b/c@1",
    "a/b_c@1",
    "a//b@1",
    "a/b@1/extra",
    " a/b@1",
    "a/b@1 ",
    "a/b@1\n",
  ])("rejects invalid profile id %j", (value) => {
    expect(() => parseProfileId(value)).toThrow(TypeError);
  });
});

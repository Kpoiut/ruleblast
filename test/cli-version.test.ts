import { describe, expect, it } from "vitest";
import { getVersionLine } from "../src/cli.js";
describe("version output", () => { it("uses the package version without extra copy", () => { expect(getVersionLine("1.0.0")).toBe("ruleblast 1.0.0"); }); });

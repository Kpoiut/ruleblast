import { describe, expect, it } from "vitest";
import { diffFromPicks, rememberDiffBases } from "../src/application/diff-from-picks.js";

describe("rememberDiffBases", () => {
  it("keeps the newest ref first, unique, and capped", () => {
    expect(rememberDiffBases([], "abc")).toEqual(["abc"]);
    expect(rememberDiffBases(["abc"], "def")).toEqual(["def", "abc"]);
    expect(rememberDiffBases(["def", "abc"], "abc")).toEqual(["abc", "def"]);
    const many = rememberDiffBases(
      ["a", "b", "c", "d", "e", "f", "g", "h"],
      "i",
    );
    expect(many).toEqual(["i", "a", "b", "c", "d", "e", "f", "g"]);
    expect(many).toHaveLength(8);
  });

  it("does not store the pinned HEAD aliases or blank refs", () => {
    expect(rememberDiffBases(["abc"], "HEAD")).toEqual(["abc"]);
    expect(rememberDiffBases(["abc"], "HEAD~1")).toEqual(["abc"]);
    expect(rememberDiffBases(["abc"], "  ")).toEqual(["abc"]);
  });
});

describe("diffFromPicks", () => {
  it("pins HEAD and HEAD~1, then recent bases, then git log, then custom", () => {
    const picks = diffFromPicks({
      recent: ["feature", "HEAD~1", "abc1234"],
      commits: [
        { ref: "aaaaaaa", subject: "tip" },
        { ref: "abc1234", subject: "already recent" },
        { ref: "bbbbbbb", subject: "older" },
      ],
    });
    expect(picks.map((row) => row.ref)).toEqual([
      "HEAD",
      "HEAD~1",
      "feature",
      "abc1234",
      "aaaaaaa",
      "bbbbbbb",
      null,
    ]);
    expect(picks[0]).toMatchObject({
      label: "HEAD",
      description: "Last commit → worktree",
    });
    expect(picks[1]).toMatchObject({
      label: "HEAD~1",
      description: "Parent of HEAD → worktree",
    });
    expect(picks.at(-1)).toMatchObject({
      label: "$(pencil) Custom ref…",
      ref: null,
    });
    expect(picks.find((row) => row.ref === "aaaaaaa")?.description).toBe("tip");
  });

  it("does not add a fifth action; every pick is a diff base", () => {
    const picks = diffFromPicks({ recent: [], commits: [] });
    expect(picks.every((row) => row.label.length > 0)).toBe(true);
    expect(picks.some((row) => row.ref === "HEAD")).toBe(true);
    expect(picks.some((row) => row.ref === null)).toBe(true);
  });
});

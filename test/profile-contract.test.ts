import { describe, expect, it, vi } from "vitest";
import { sha256 } from "../src/canonical.js";
import { parseProfileId, type Projection } from "../src/model.js";
import {
  defineEvidenceRef,
  type EvidenceRef,
  type PreparedProfile,
  type ProfileDefinition,
} from "../src/profiles/profile.js";
import type { RepositorySnapshot, SnapshotEntry } from "../src/snapshot.js";

const profileId = parseProfileId("example/fake@1");

function createSnapshot(
  overrides: Readonly<Record<string, string>> = {},
): RepositorySnapshot {
  const entries = new Map<string, string>([
    ["instructions/root.md", "direct instructions"],
    ["README.md", "imported instructions"],
    ["config/settings.json", "applicable settings"],
    ["rules/frontend.md", "applicable rule"],
    ["src/app.ts", "ordinary trigger target"],
  ]);
  for (const [path, content] of Object.entries(overrides)) {
    entries.set(path, content);
  }

  return {
    ref: { kind: "fixture", label: "profile-contract", oid: null },
    async listPaths() { return [...entries.keys()]; },
    async entry(path: string): Promise<SnapshotEntry | null> {
      return entries.has(path)
        ? { path, kind: "file", executable: false }
        : null;
    },
    async read(path: string) {
      const value = entries.get(path);
      return value === undefined ? null : new TextEncoder().encode(value);
    },
  };
}

function createProjection(
  targetPath: string,
  dependencyContents: Readonly<Record<string, string>>,
): Projection {
  const sources = Object.entries(dependencyContents).map(([path, content]) => ({
    path,
    disposition: "SELECTED" as const,
    digest: sha256(content),
    bytesUsed: Buffer.byteLength(content),
    truncated: false,
  }));
  const payload = Object.values(dependencyContents);
  return {
    profile: profileId,
    context: {
      cwd: ".",
      trigger: "READ_TARGET",
      targetPath,
      repositoryOnly: true,
    },
    status: "COMPLETE",
    composition: "ORDERED",
    sources,
    normalizedPayloadUnits: [payload],
    projectionDigest: sha256(JSON.stringify({ targetPath, dependencyContents })),
    normalizedPayloadDigest: sha256(JSON.stringify(payload)),
    evidence: ["fake evidence"],
  };
}

function createFakeProfile(): ProfileDefinition {
  const evidence = defineEvidenceRef({
    url: "https://example.test/profile-contract",
    retrievedAt: "2024-02-29",
    revision: "example/fake@1",
    claim: "The fake profile reads its dependencies during preparation.",
  });

  return {
    id: profileId,
    evidence: Object.freeze([evidence]),
    isInstructionPath(path) {
      return [
        "README.md",
        "config/settings.json",
        "instructions/root.md",
        "rules/frontend.md",
      ].includes(path);
    },
    async prepare(snapshot) {
      const sourceDependencyPaths = Object.freeze([
        "README.md",
        "config/settings.json",
        "instructions/root.md",
        "rules/frontend.md",
      ]);
      const dependencyContents: Record<string, string> = {};
      for (const path of sourceDependencyPaths) {
        const bytes = await snapshot.read(path);
        if (bytes === null) {
          throw new Error(`Missing fake dependency: ${path}`);
        }
        dependencyContents[path] = new TextDecoder().decode(bytes);
      }
      return Object.freeze({
        id: profileId,
        sourceDependencyPaths,
        project(targetPath: string) {
          return createProjection(targetPath, dependencyContents);
        },
      });
    },
  };
}

async function consumeForImpact(
  profile: ProfileDefinition,
  snapshot: RepositorySnapshot,
  targetPath: string,
): Promise<Projection> {
  const prepared = await profile.prepare(snapshot);
  return prepared.project(targetPath);
}

describe("profile contract", () => {
  it("lets the impact layer consume a prepared fake profile deterministically without branching on its id", async () => {
    const snapshot = createSnapshot();
    const profile = createFakeProfile();
    const baseline = await consumeForImpact(profile, createSnapshot(), "src/app.ts");
    const prepared: PreparedProfile = await profile.prepare(snapshot);

    expect(prepared.sourceDependencyPaths).toEqual([
      "README.md",
      "config/settings.json",
      "instructions/root.md",
      "rules/frontend.md",
    ]);
    expect(prepared.sourceDependencyPaths).toEqual([...prepared.sourceDependencyPaths].sort());
    expect(prepared.sourceDependencyPaths).not.toContain("src/app.ts");

    snapshot.listPaths = vi.fn(async () => {
      throw new Error("projection must not list snapshot paths");
    });
    snapshot.entry = vi.fn(async () => {
      throw new Error("projection must not inspect snapshot entries");
    });
    snapshot.read = vi.fn(async () => {
      throw new Error("projection must not read snapshot bytes");
    });

    const cwd = vi.spyOn(process, "cwd");
    cwd.mockImplementation(() => {
      throw new Error("projection must not read process cwd");
    });
    const now = vi.spyOn(Date, "now");
    now.mockImplementation(() => {
      throw new Error("projection must not read the wall clock");
    });
    vi.stubGlobal("fetch", () => {
      throw new Error("projection must not use the network");
    });
    const originalEnvironment = process.env.RULEBLAST_PROFILE_CONTRACT;
    try {
      process.env.RULEBLAST_PROFILE_CONTRACT = "first";
      const first = prepared.project("src/app.ts");
      process.env.RULEBLAST_PROFILE_CONTRACT = "second";
      const second = prepared.project("src/app.ts");

      expect(first).toEqual(baseline);
      expect(second).toEqual(first);
      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    } finally {
      if (originalEnvironment === undefined) {
        delete process.env.RULEBLAST_PROFILE_CONTRACT;
      } else {
        process.env.RULEBLAST_PROFILE_CONTRACT = originalEnvironment;
      }
      cwd.mockRestore();
      now.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("validates and freezes copied evidence references with real Gregorian dates", () => {
    const input = {
      url: "https://example.test/evidence",
      retrievedAt: "2024-02-29",
      revision: "revision-1",
      claim: "A leap-day claim.",
    };
    const evidence = defineEvidenceRef(input);

    input.claim = "mutated input";
    expect(evidence).toEqual({
      url: "https://example.test/evidence",
      retrievedAt: "2024-02-29",
      revision: "revision-1",
      claim: "A leap-day claim.",
    });
    expect(Object.isFrozen(evidence)).toBe(true);

    for (const field of ["url", "retrievedAt", "revision", "claim"] as const) {
      const getter = vi.fn(() => "2024-02-29");
      const accessor = {
        url: "https://example.test/evidence",
        retrievedAt: "2024-02-29",
        revision: "revision-1",
        claim: "A claim.",
      };
      Object.defineProperty(accessor, field, { get: getter, enumerable: true });

      expect(() => defineEvidenceRef(accessor as unknown as EvidenceRef)).toThrow(TypeError);
      expect(getter).not.toHaveBeenCalled();
    }

    for (const invalid of [
      null,
      1,
      new Date("2024-02-29"),
      { url: "https://example.test" },
    ]) {
      expect(() => defineEvidenceRef(invalid as unknown as EvidenceRef)).toThrow(TypeError);
    }

    for (const field of ["url", "retrievedAt", "revision", "claim"] as const) {
      for (const value of [null, 1, {}, new Date("2024-02-29")]) {
        expect(() => {
          defineEvidenceRef({ ...evidence, [field]: value } as unknown as EvidenceRef);
        }).toThrow(TypeError);
      }
    }

    for (const retrievedAt of [
      "0000-02-29",
      "1900-02-29",
      "2023-02-29",
      "2024-2-29",
      "2024-02-30",
      "2024-00-01",
      "2024-13-01",
      "2024-01-00",
      "2024-01-32",
      "2024-02-29T00:00:00Z",
    ]) {
      expect(() => defineEvidenceRef({ ...evidence, retrievedAt })).toThrow(TypeError);
    }
  });

  it.each([
    "README.md",
    "config/settings.json",
    "instructions/root.md",
    "rules/frontend.md",
  ])("captures %s during preparation because changing it changes the projection", async (path) => {
    const profile = createFakeProfile();
    const baseline = await consumeForImpact(profile, createSnapshot(), "src/app.ts");
    const changed = await consumeForImpact(
      profile,
      createSnapshot({ [path]: "changed dependency" }),
      "src/app.ts",
    );

    expect(changed.projectionDigest).not.toBe(baseline.projectionDigest);
  });

  it("does not treat an ordinary target as a source dependency", async () => {
    const profile = createFakeProfile();
    const baseline = await consumeForImpact(profile, createSnapshot(), "src/app.ts");
    const changed = await consumeForImpact(
      profile,
      createSnapshot({ "src/app.ts": "changed ordinary target" }),
      "src/app.ts",
    );

    expect(changed.projectionDigest).toBe(baseline.projectionDigest);
  });
});

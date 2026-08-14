import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type AgentAllow = "yes" | "ask";

const ALLOW_FILE = ".ruleblast-allow";

function parseToken(value: string | undefined): AgentAllow | null {
  if (value === undefined) return null;
  const token = value.trim().toLowerCase();
  if (token === "yes" || token === "on" || token === "1" || token === "allow") {
    return "yes";
  }
  if (token === "no" || token === "off" || token === "0" || token === "ask") {
    return "ask";
  }
  return null;
}

export function resolveAgentAllow(input: {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly cwd: string;
}): AgentAllow {
  const fromEnv = parseToken(input.env.RULEBLAST_AGENT_ALLOW);
  if (fromEnv !== null) return fromEnv;
  if (input.cwd === "") return "ask";
  const path = join(input.cwd, ALLOW_FILE);
  if (!existsSync(path)) return "ask";
  try {
    return parseToken(readFileSync(path, "utf8")) ?? "yes";
  } catch {
    return "ask";
  }
}

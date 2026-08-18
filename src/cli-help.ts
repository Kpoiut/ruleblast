import { CONTROL_BINDINGS, CONTROL_CHORD } from "./application/control-keys.js";
import { parseArgs } from "./args.js";
import { IDENTITY_BLAST, IDENTITY_TITLE } from "./package-identity.js";

export interface RouteCard {
  readonly id: "scan" | "diff" | "explain" | "case";
  readonly action: "scan" | "diff" | "explain" | "case";
  readonly useWhen: string;
  readonly precondition: "repository" | "repository-or-refs" | "tracked-path" | "none";
  readonly exampleArgv: readonly string[];
  readonly interpretation: string;
  readonly nonClaim: string;
}

const ROUTES: readonly RouteCard[] = Object.freeze([
  Object.freeze({
    id: "scan",
    action: "scan",
    useWhen: "See what each pinned CLI projects right now.",
    precondition: "repository",
    exampleArgv: Object.freeze([".", "--color=never"]),
    interpretation: "Current scan. The optional path only starts Git discovery.",
    nonClaim: "Not a path filter and not a fifth action named scan.",
  }),
  Object.freeze({
    id: "diff",
    action: "diff",
    useWhen: "See which tracked instruction stacks moved.",
    precondition: "repository-or-refs",
    exampleArgv: Object.freeze(["diff", "HEAD~1", "--to", "HEAD", "--color=never"]),
    interpretation: "Last-commit blast. Base is the positional ref, never --from.",
    nonClaim: "Not a claim that models changed their answers.",
  }),
  Object.freeze({
    id: "explain",
    action: "explain",
    useWhen: "Ask why one path inherited this stack.",
    precondition: "tracked-path",
    exampleArgv: Object.freeze(["explain", "src/args.ts", "--json"]),
    interpretation: "Current WORKTREE explanation for one path.",
    nonClaim: "Not a model chain-of-thought.",
  }),
  Object.freeze({
    id: "case",
    action: "case",
    useWhen: "Inspect the packaged teaching receipt. No Git repo required.",
    precondition: "none",
    exampleArgv: Object.freeze(["case", "--color=never"]),
    interpretation: "33→106 kpoiut/ruleblast teaching receipt, not the 206 Codex proof.",
    nonClaim: "Does not reproduce the openai/codex 2→206 comparison.",
  }),
]);

function assertExampleGrammar(): void {
  for (const route of ROUTES) {
    const parsed = parseArgs([...route.exampleArgv]);
    if (!("action" in parsed) || parsed.action !== route.action) {
      throw new Error(`Help example drifted from parseArgs: ${route.id}`);
    }
  }
  const scanToken = parseArgs(["scan"]);
  if (scanToken.action !== "scan" || !("startPath" in scanToken) ||
      scanToken.startPath !== "scan") {
    throw new Error("scan token must remain a start path, not a subcommand");
  }
}

assertExampleGrammar();

export function routeCatalog(): readonly RouteCard[] {
  return ROUTES;
}

export function renderCliHelp(): string {
  return `RuleBlast — ${IDENTITY_TITLE}.

${IDENTITY_BLAST}.
One Git tree. Two default realities. Two opt-in CLI surfaces.

CORE
  [path]     ${ROUTES[0]!.useWhen}
             ruleblast . --color=never

  diff       ${ROUTES[1]!.useWhen}
             ruleblast diff HEAD~1 --to HEAD --color=never
             Human Git-pair and Git→WORKTREE text may append OTHER TRACKED CHANGES,
             WORK MAP, and CHANGE ALIGNMENT. --json stays canonical.

  explain    ${ROUTES[2]!.useWhen}
             ruleblast explain src/args.ts --json
             ruleblast explain src/args.ts --from HEAD~1 --to HEAD --json

  case       ${ROUTES[3]!.useWhen}
             ruleblast case --color=never
             Teaching receipt 33→106, not the 206 Codex proof.

COMMON
  --json        Canonical JSON output.
  --paths-only  One attention path per line. Diff: changed stacks. Scan: current splits. Pipeable. Not --json.
  --compare     Explain only. Two selected-reality source stacks. Not --json.
  --reality     github/copilot-cli@1 and/or google/gemini-cli@1. Repeat to add both. Default JSON stays two-profile.
  --color       auto | always | never

EVIDENCE
  --witness  Why-edges for the selected resolution. Opt-in envelope only.
  --receipt  Opt-in scoreboard box plus RBCTX1. Off unless passed.
             User toggle: RULEBLAST_AGENT_ALLOW or .ruleblast-allow.

TRANSPORT
  --mcp      Stdio transport of the same four actions. Not a fifth action.

SKILLS
  Skills     Codex .agents/skills · Claude Code .claude/skills
             Cursor .cursor/skills · Windsurf .windsurf/skills · Kiro .kiro/skills
             Not node_modules. Agents default to ask.

CONTROL
  Control    ${CONTROL_CHORD} then ${CONTROL_BINDINGS.map((row) => `${row.token} ${row.id}`).join(" · ")}
             Companion keybindings. CLI uses the same four tokens: ${CONTROL_BINDINGS.map((row) => row.cli).join("  ")}

EXITS
  0  defensible result or no candidates — not "every path COMPLETE"
  1  recoverable input / repository / ref / path
  2  candidates exist but no complete projection (or complete pair)
  70 internal failure

Usage:
  ruleblast [path] [--json] [--paths-only] [--witness] [--receipt] [--reality <id>]... [--color=auto|always|never]
  ruleblast diff [base] [--to <ref|WORKTREE>] [--json] [--paths-only] [--witness] [--receipt] [--reality <id>]... [--color=auto|always|never]
  ruleblast explain <path> [--from <ref>] [--to <ref|WORKTREE>] [--json] [--compare] [--witness] [--receipt] [--reality <id>]... [--color=auto|always|never]
  ruleblast case [--explain <path>] [--json] [--paths-only] [--witness] [--receipt] [--color=auto|always|never]
  ruleblast --mcp
  ruleblast --help
  ruleblast --version
`;
}

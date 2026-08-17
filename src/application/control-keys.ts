export const CONTROL_CHORD = "Ctrl+Alt+R";

export type ControlIntent = "RUN_SCAN" | "RUN_DIFF" | "RUN_EXPLAIN" | "RUN_CASE";

export interface ControlBinding {
  readonly id: "scan" | "diff" | "explain" | "case";
  readonly token: "S" | "D" | "E" | "C";
  readonly command:
    | "ruleblast.scanWorkspace"
    | "ruleblast.diffFrom"
    | "ruleblast.explainActiveFile"
    | "ruleblast.openVerifiedCase";
  readonly cli: "." | "diff" | "explain" | "case";
  readonly label: string;
  readonly intent: ControlIntent;
}

export const CONTROL_BINDINGS: readonly ControlBinding[] = Object.freeze([
  Object.freeze({
    id: "scan",
    token: "S",
    command: "ruleblast.scanWorkspace",
    cli: ".",
    label: "Scan now",
    intent: "RUN_SCAN",
  }),
  Object.freeze({
    id: "diff",
    token: "D",
    command: "ruleblast.diffFrom",
    cli: "diff",
    label: "Diff from HEAD",
    intent: "RUN_DIFF",
  }),
  Object.freeze({
    id: "explain",
    token: "E",
    command: "ruleblast.explainActiveFile",
    cli: "explain",
    label: "Explain active file",
    intent: "RUN_EXPLAIN",
  }),
  Object.freeze({
    id: "case",
    token: "C",
    command: "ruleblast.openVerifiedCase",
    cli: "case",
    label: "Open verified case",
    intent: "RUN_CASE",
  }),
]);

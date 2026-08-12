import { diffLines } from "diff";
import type { InstructionDiffStats } from "./model.js";

const decoder = new TextDecoder("utf-8", { fatal: false });

function hasNul(bytes: Uint8Array | null): boolean {
  return bytes?.includes(0) ?? false;
}

function equalBytes(left: Uint8Array | null, right: Uint8Array | null): boolean {
  if (left === right) return true;
  if (left === null || right === null || left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function normalizeText(bytes: Uint8Array | null): string {
  if (bytes === null) return "";
  return decoder.decode(bytes).replace(/\r\n/g, "\n");
}

export function diffInstructionBytes(
  before: Uint8Array | null,
  after: Uint8Array | null,
): InstructionDiffStats {
  if (equalBytes(before, after)) {
    return { addedLineCount: 0, deletedLineCount: 0, editedLineCount: 0, binaryChangedSourceCount: 0 };
  }
  if (hasNul(before) || hasNul(after)) {
    return { addedLineCount: 0, deletedLineCount: 0, editedLineCount: 0, binaryChangedSourceCount: 1 };
  }

  let addedLineCount = 0;
  let deletedLineCount = 0;
  for (const change of diffLines(normalizeText(before), normalizeText(after), {
    ignoreNewlineAtEof: true,
  })) {
    if (change.added) addedLineCount += change.count;
    if (change.removed) deletedLineCount += change.count;
  }
  return {
    addedLineCount,
    deletedLineCount,
    editedLineCount: addedLineCount + deletedLineCount,
    binaryChangedSourceCount: 0,
  };
}

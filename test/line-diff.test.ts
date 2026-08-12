import { describe, expect, it } from "vitest";
import { diffInstructionBytes } from "../src/line-diff.js";

const bytes = (value: string): Uint8Array => new TextEncoder().encode(value);

describe("diffInstructionBytes", () => {
  it("counts added, deleted, replacement, identical, and empty file changes", () => {
    expect(diffInstructionBytes(null, bytes("one\ntwo\n"))).toEqual({ addedLineCount: 2, deletedLineCount: 0, editedLineCount: 2, binaryChangedSourceCount: 0 });
    expect(diffInstructionBytes(bytes("one\ntwo\n"), null)).toEqual({ addedLineCount: 0, deletedLineCount: 2, editedLineCount: 2, binaryChangedSourceCount: 0 });
    expect(diffInstructionBytes(bytes("old\n"), bytes("new\n"))).toEqual({ addedLineCount: 1, deletedLineCount: 1, editedLineCount: 2, binaryChangedSourceCount: 0 });
    expect(diffInstructionBytes(bytes("same\n"), bytes("same\n"))).toEqual({ addedLineCount: 0, deletedLineCount: 0, editedLineCount: 0, binaryChangedSourceCount: 0 });
    expect(diffInstructionBytes(null, null)).toEqual({ addedLineCount: 0, deletedLineCount: 0, editedLineCount: 0, binaryChangedSourceCount: 0 });
  });

  it("normalizes CRLF only, ignores final-newline-only changes, and decodes malformed UTF-8", () => {
    expect(diffInstructionBytes(bytes("one\r\ntwo\r\n"), bytes("one\ntwo\n"))).toMatchObject({ editedLineCount: 0 });
    expect(diffInstructionBytes(bytes("one\rtwo\n"), bytes("one\ntwo\n"))).toMatchObject({ editedLineCount: 3 });
    expect(diffInstructionBytes(bytes("one"), bytes("one\n"))).toMatchObject({ editedLineCount: 0 });
    expect(diffInstructionBytes(bytes("one\n"), bytes("one\n\n"))).toMatchObject({ addedLineCount: 1, deletedLineCount: 0 });
    expect(diffInstructionBytes(new Uint8Array([0xc3]), new Uint8Array([0xef, 0xbf, 0xbd]))).toMatchObject({ editedLineCount: 0 });
  });

  it("reports a binary source only when NUL-containing bytes changed", () => {
    expect(diffInstructionBytes(new Uint8Array([0, 1]), new Uint8Array([0, 1]))).toEqual({ addedLineCount: 0, deletedLineCount: 0, editedLineCount: 0, binaryChangedSourceCount: 0 });
    expect(diffInstructionBytes(new Uint8Array([0, 1]), new Uint8Array([0, 2]))).toEqual({ addedLineCount: 0, deletedLineCount: 0, editedLineCount: 0, binaryChangedSourceCount: 1 });
  });
});

import {
  expandImportedMarkdown,
  listClaudeImportReferences,
  resolveClaudeImportPath,
  type ImportedMarkdownFile,
} from "../packs/ops-markdown.js";

export const GEMINI_IMPORT_DEPTH = 5;

export type GeminiFile = ImportedMarkdownFile;
export type GeminiExpansion = ReturnType<typeof expandImportedMarkdown>;

export function listGeminiImportReferences(value: string): readonly string[] {
  return listClaudeImportReferences(value, false);
}

export const resolveGeminiImportPath = resolveClaudeImportPath;

export function expandGeminiDocument(
  file: GeminiFile,
  documents: ReadonlyMap<string, GeminiFile>,
): GeminiExpansion {
  return expandImportedMarkdown(file, documents, GEMINI_IMPORT_DEPTH);
}

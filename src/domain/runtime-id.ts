const RUNTIME_CLASS_PATTERN =
  /^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*-(?:cli|code|harness|agent)(?:@[1-9][0-9]*)?$/u;
const MODEL_NAME_PATTERN =
  /^(?:grok|gpt|glm|llama|claude|gemini|qwen|kimi|deepseek|composer)(?:[-.][0-9].*)?$/iu;

export function unversionedRuntimeId(value: string): string {
  return value.replace(/@[1-9][0-9]*$/u, "");
}

export function isRuntimeClassId(value: string): boolean {
  return RUNTIME_CLASS_PATTERN.exec(value)?.[0] === value;
}

export function isModelNameSurfaceId(value: string): boolean {
  if (isRuntimeClassId(value)) return false;
  const last = (value.split("/")[1] ?? value).split("@")[0] ?? value;
  return MODEL_NAME_PATTERN.exec(last)?.[0] === last;
}

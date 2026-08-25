import { Minimatch } from "minimatch";

const matchers = new Map<string, Minimatch>();

/** Compile each glob pattern once. 10k prepare walks must not reconstruct Minimatch. */
export function matchGlob(
  pattern: string,
  path: string,
  options: { readonly dot?: boolean; readonly nobrace?: boolean },
): boolean {
  const key = `${options.dot ? "d" : ""}${options.nobrace ? "n" : ""}\0${pattern}`;
  let matcher = matchers.get(key);
  if (matcher === undefined) {
    matcher = new Minimatch(pattern, options);
    matchers.set(key, matcher);
  }
  return matcher.match(path);
}

/** Intern producer arrays by identity only when live fields still match. */

export function internProducer<T>(
  map: WeakMap<object, T>,
  value: unknown,
  matches: (interned: T, raw: object) => boolean,
  capture: () => T,
): T {
  if (typeof value === "object" && value !== null) {
    const hit = map.get(value);
    if (hit !== undefined && matches(hit, value)) return hit;
  }
  const captured = capture();
  if (typeof value === "object" && value !== null) map.set(value, captured);
  return captured;
}

export function internedObjectArrayMatch<T extends object>(
  interned: readonly T[],
  raw: object,
  fields: readonly string[],
): boolean {
  if (!Array.isArray(raw) || raw.length !== interned.length ||
      Reflect.ownKeys(raw).length !== interned.length + 1) {
    return false;
  }
  return interned.every((copy, index) => {
    const item = raw[index];
    if (typeof item !== "object" || item === null) return false;
    const proto = Object.getPrototypeOf(item);
    if (proto !== Object.prototype && proto !== null) return false;
    if (Reflect.ownKeys(item).length !== fields.length) return false;
    const record = copy as Record<string, unknown>;
    const source = item as Record<string, unknown>;
    return fields.every((field) => record[field] === source[field]);
  });
}

export function internedStringGridMatch(
  interned: readonly (readonly string[])[],
  raw: object,
): boolean {
  if (!Array.isArray(raw) || raw.length !== interned.length ||
      Reflect.ownKeys(raw).length !== interned.length + 1) {
    return false;
  }
  return interned.every((copy, index) => {
    const unit = raw[index];
    return Array.isArray(unit) && unit.length === copy.length &&
      Reflect.ownKeys(unit).length === copy.length + 1 &&
      copy.every((digest, line) => unit[line] === digest);
  });
}

export function internedStringArrayMatch(
  interned: readonly string[],
  raw: object,
): boolean {
  return Array.isArray(raw) && raw.length === interned.length &&
    Reflect.ownKeys(raw).length === interned.length + 1 &&
    interned.every((item, index) => raw[index] === item);
}

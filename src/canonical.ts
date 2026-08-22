import { createHash } from "node:crypto";

type JsonPrimitive = boolean | null | number | string;

function serializePrimitive(value: JsonPrimitive): string {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new TypeError("Value is not a JSON primitive");
  }

  return serialized;
}

function assertNoSymbolKeys(value: object): void {
  if (Object.getOwnPropertySymbols(value).length > 0) {
    throw new TypeError("Symbol-keyed properties are not canonical JSON");
  }
}

function getOwnDataPropertyDescriptors(
  value: object,
): Readonly<Record<string, PropertyDescriptor>> {
  const descriptors = Object.getOwnPropertyDescriptors(value);

  for (const descriptor of Object.values(descriptors)) {
    if (!Object.prototype.hasOwnProperty.call(descriptor, "value")) {
      throw new TypeError("Accessor properties are not canonical JSON");
    }
  }

  return descriptors;
}

function getDataPropertyValue(
  descriptors: Readonly<Record<string, PropertyDescriptor>>,
  key: string,
): unknown {
  const descriptor = descriptors[key];
  if (descriptor === undefined) {
    throw new TypeError(`Missing data property: ${JSON.stringify(key)}`);
  }

  return descriptor.value as unknown;
}

function serializeArray(
  value: readonly unknown[],
  descriptors: Readonly<Record<string, PropertyDescriptor>>,
  ancestors: WeakSet<object>,
): string {
  const serializedItems: string[] = [];
  const length = getDataPropertyValue(descriptors, "length");
  if (typeof length !== "number") {
    throw new TypeError("Array length is not a number");
  }

  for (let index = 0; index < length; index += 1) {
    const key = String(index);
    if (!Object.prototype.hasOwnProperty.call(descriptors, key)) {
      throw new TypeError("Sparse arrays are not canonical JSON");
    }
    serializedItems.push(
      serialize(getDataPropertyValue(descriptors, key), ancestors),
    );
  }

  if (Object.getOwnPropertyNames(value).length !== length + 1) {
    throw new TypeError("Array properties outside its indexes are not canonical JSON");
  }

  return `[${serializedItems.join(",")}]`;
}

function serializeRecord(
  value: Record<string, unknown>,
  descriptors: Readonly<Record<string, PropertyDescriptor>>,
  ancestors: WeakSet<object>,
): string {
  const serializedEntries = Object.keys(value)
    .sort()
    .map(
      (key) =>
        `${serializePrimitive(key)}:${serialize(
          getDataPropertyValue(descriptors, key),
          ancestors,
        )}`,
    );

  return `{${serializedEntries.join(",")}}`;
}

function serialize(value: unknown, ancestors: WeakSet<object>): string {
  if (value === null) {
    return "null";
  }

  switch (typeof value) {
    case "boolean":
    case "string":
      return serializePrimitive(value);
    case "number":
      if (!Number.isFinite(value)) {
        throw new TypeError("Non-finite numbers are not canonical JSON");
      }
      return serializePrimitive(value);
    case "object": {
      if (ancestors.has(value)) {
        throw new TypeError("Cycles are not canonical JSON");
      }

      const isArray = Array.isArray(value);
      const prototype = Object.getPrototypeOf(value);
      if (!isArray && prototype !== Object.prototype && prototype !== null) {
        throw new TypeError("Only plain objects are canonical JSON objects");
      }

      assertNoSymbolKeys(value);
      const descriptors = getOwnDataPropertyDescriptors(value);
      ancestors.add(value);
      try {
        if (isArray) {
          return serializeArray(value as unknown[], descriptors, ancestors);
        }
        return serializeRecord(
          value as Record<string, unknown>,
          descriptors,
          ancestors,
        );
      } finally {
        ancestors.delete(value);
      }
    }
    default:
      throw new TypeError(`${typeof value} values are not canonical JSON`);
  }
}

/** Null-prototype records are treated as plain JSON objects. */
export function canonicalJson(value: unknown): string {
  return serialize(value, new WeakSet<object>());
}

export function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

const MOVING_TARGET_PLACEHOLDER = "\u0000";

/**
 * Same digest as `sha256(canonicalJson(build(targetPath)))` when `targetPath`
 * is the only moving string. Used so 10k same-directory projections do not
 * reserialize a stable payload. Falls back to a full canonicalize when the
 * placeholder is not unique in the template.
 */
export function sha256MovingTarget(
  build: (targetPath: string) => unknown,
): (targetPath: string) => string {
  const template = canonicalJson(build(MOVING_TARGET_PLACEHOLDER));
  const token = JSON.stringify(MOVING_TARGET_PLACEHOLDER);
  const first = template.indexOf(token);
  const again = first === -1 ? -1 : template.indexOf(token, first + token.length);
  if (first === -1 || again !== -1) {
    return (targetPath) => sha256(canonicalJson(build(targetPath)));
  }
  const head = template.slice(0, first);
  const tail = template.slice(first + token.length);
  return (targetPath) => sha256(`${head}${JSON.stringify(targetPath)}${tail}`);
}

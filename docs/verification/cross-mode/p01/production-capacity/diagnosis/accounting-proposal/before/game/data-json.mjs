/** Shared boundary for user-owned files. Does not invoke getters or toJSON. */
export const plainObject = (value) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
export const stableId = (value) =>
  typeof value === 'string' &&
  /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(value) &&
  !['constructor', 'prototype', '__proto__'].includes(value);
export function boundedJSON(
  source,
  {
    maxBytes = 4 * 1024 * 1024,
    maxNodes = 100000,
    maxDepth = 16,
    maxArray = 4096,
    maxString = 4096,
  } = {},
) {
  const encoder = new TextEncoder();
  if (typeof source === 'string') {
    if (source.length > maxBytes || encoder.encode(source).byteLength > maxBytes)
      throw new TypeError('JSON file exceeds its byte budget.');
    try {
      source = JSON.parse(source);
    } catch {
      throw new TypeError('The file must contain valid JSON.');
    }
  }
  let nodes = 0,
    size = 0;
  const ancestors = new Set();
  const add = (n) => {
    size += n;
    if (size > maxBytes) throw new TypeError('JSON exceeds its byte budget.');
  };
  function copy(value, depth) {
    if (++nodes > maxNodes || depth > maxDepth)
      throw new TypeError('JSON exceeds its structural budget.');
    if (value === null || typeof value === 'boolean') {
      add(5);
      return value;
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new TypeError('JSON numbers must be finite.');
      add(24);
      return value;
    }
    if (typeof value === 'string') {
      if (value.length > maxString) throw new TypeError('JSON string exceeds its budget.');
      add(encoder.encode(value).byteLength + 2);
      return value;
    }
    const array = Array.isArray(value);
    if (
      !value ||
      typeof value !== 'object' ||
      (array ? Object.getPrototypeOf(value) !== Array.prototype : !plainObject(value))
    )
      throw new TypeError('Only plain JSON data is supported.');
    if (ancestors.has(value)) throw new TypeError('JSON cycles are not supported.');
    if (array && value.length > maxArray)
      throw new TypeError('JSON array exceeds its item budget.');
    ancestors.add(value);
    const out = array ? [] : {},
      descriptors = Object.getOwnPropertyDescriptors(value);
    let count = 0;
    for (const key of Reflect.ownKeys(descriptors)) {
      if (typeof key !== 'string') throw new TypeError('JSON symbol keys are not supported.');
      if (array && key === 'length') continue;
      if (['__proto__', 'constructor', 'prototype'].includes(key))
        throw new TypeError(`Forbidden JSON key: ${key}.`);
      const descriptor = descriptors[key];
      if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value'))
        throw new TypeError('JSON accessors and hidden fields are not supported.');
      if (key.length > 512) throw new TypeError('JSON field name exceeds its budget.');
      if (array && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length))
        throw new TypeError('JSON arrays cannot have custom properties.');
      add(encoder.encode(key).byteLength + 4);
      out[key] = copy(descriptor.value, depth + 1);
      count++;
    }
    if (array && count !== value.length)
      throw new TypeError('Sparse JSON arrays are not supported.');
    ancestors.delete(value);
    return out;
  }
  const copied = copy(source, 0);
  if (encoder.encode(JSON.stringify(copied)).byteLength > maxBytes)
    throw new TypeError('Encoded JSON exceeds its byte budget.');
  return copied;
}
export function exactKeys(value, allowed, label) {
  if (!plainObject(value)) throw new TypeError(`${label} must be an object.`);
  for (const key of Object.keys(value))
    if (!allowed.includes(key)) throw new TypeError(`${label}.${key} is not supported.`);
}
export function required(condition, message) {
  if (!condition) throw new TypeError(message);
}
export function canonicalJSON(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`;
  if (plainObject(value))
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJSON(value[key])}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
/** Stable local partition identity, not a signature or an anti-cheat service. */
export function dataIdentity(value) {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(canonicalJSON(value)))
    hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 0x100000001b3n);
  return hash.toString(16).padStart(16, '0');
}

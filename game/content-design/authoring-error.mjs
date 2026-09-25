/** Preserve canonical English diagnostics for authoring APIs and CLI callers.
 * UI consumers may resolve the explicit message descriptor in their locale.
 * Nothing from this error becomes part of a content record or its identity. */
export function authoringError(message, key, values = {}) {
  const error = new TypeError(message);
  Object.defineProperty(error, 'localization', {
    value: Object.freeze({ key, values: Object.freeze({ ...values }) }),
  });
  return error;
}
export function requireAuthoring(condition, message, key, values) {
  if (!condition) throw authoringError(message, key, values);
}

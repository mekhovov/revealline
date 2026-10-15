// Standalone core/Worker validation must not load the UI translation engine.
// These English defaults mirror locales/en/errors.json (checked by the tests).
// A booted UI uses its live translator, including subsequent locale changes.
export const DATA_JSON_DEFAULT_MESSAGES = Object.freeze({
  fileByteBudget: 'JSON file exceeds its byte budget.',
  invalid: 'The file must contain valid JSON.',
  byteBudget: 'JSON exceeds its byte budget.',
  structuralBudget: 'JSON exceeds its structural budget.',
  finiteNumbers: 'JSON numbers must be finite.',
  stringBudget: 'JSON string exceeds its budget.',
  plainData: 'Only plain JSON data is supported.',
  cyclesUnsupported: 'JSON cycles are not supported.',
  arrayItemBudget: 'JSON array exceeds its item budget.',
  symbolKeys: 'JSON symbol keys are not supported.',
  forbiddenKey: 'Forbidden JSON key: {{key}}.',
  ordinaryFields: 'JSON accessors and hidden fields are not supported.',
  fieldNameBudget: 'JSON field name exceeds its budget.',
  arrayCustomProperties: 'JSON arrays cannot have custom properties.',
  sparseArrays: 'Sparse JSON arrays are not supported.',
  encodedByteBudget: 'Encoded JSON exceeds its byte budget.',
  objectRequired: '{{label}} must be an object.',
  unsupportedField: '{{path}} is not supported.',
});

export function dataJSONMessage(key, values = {}) {
  const translated = globalThis.RevealLineI18n?.t;
  if (translated) return translated(key, values);
  const template = DATA_JSON_DEFAULT_MESSAGES[key.slice('errors:dataJson.'.length)];
  return template.replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? ''));
}

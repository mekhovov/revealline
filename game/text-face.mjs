export const TEXT_FACES = Object.freeze(['pixel', 'plain']);
export const DEFAULT_TEXT_FACE = 'pixel';

export function resolveTextFace(value) {
  if (!TEXT_FACES.includes(value)) throw new TypeError('Unsupported text style.');
  return value;
}

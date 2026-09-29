import { boundedJSON, canonicalJSON, exactKeys, required } from './data-json.mjs';
import { PUBLIC_SOUNDTRACK_STYLE_IDS } from './soundtrack-style-taxonomy.mjs';

export const SOUNDTRACK_STYLE_SELECTION_KEY = 'public-styles.v1';
export const SOUNDTRACK_STYLE_SELECTION_FORMAT = 'revealline-public-soundtrack-styles.v1';

/** Optional preferences live outside the historical exact-key library record. */
export function validateSoundtrackStyleSelection(source) {
  if (source === undefined || source === null) return null;
  const value = boundedJSON(source, {
    maxBytes: 1024,
    maxNodes: 20,
    maxArray: 10,
    maxDepth: 2,
    maxString: 64,
  });
  exactKeys(value, ['format', 'generation', 'styles'], 'Public soundtrack styles');
  required(
    value.format === SOUNDTRACK_STYLE_SELECTION_FORMAT &&
      Number.isSafeInteger(value.generation) &&
      value.generation >= 0 &&
      Array.isArray(value.styles) &&
      value.styles.length > 0 &&
      new Set(value.styles).size === value.styles.length &&
      value.styles.every((style) => PUBLIC_SOUNDTRACK_STYLE_IDS.includes(style)),
    'Invalid public soundtrack style selection.',
  );
  value.styles = PUBLIC_SOUNDTRACK_STYLE_IDS.filter((style) => value.styles.includes(style));
  return value;
}

export function soundtrackStyleSelection(styles, generation) {
  return validateSoundtrackStyleSelection({
    format: SOUNDTRACK_STYLE_SELECTION_FORMAT,
    generation,
    styles,
  });
}

export function sameSoundtrackListening(left, right) {
  return (
    canonicalJSON([left.listening ?? null, left.selection]) ===
    canonicalJSON([right.listening ?? null, right.selection])
  );
}

export function selectedPublicSoundtrackStyles(selection, current) {
  return selection?.generation === current.generation
    ? Object.freeze([...selection.styles])
    : undefined;
}

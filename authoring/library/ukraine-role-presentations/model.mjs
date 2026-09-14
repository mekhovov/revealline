import { validateAnimationRecipes } from '../../motion-lab/animation.mjs';

export const ROLE_IDS = Object.freeze([
  'scout',
  'bomber',
  'carrier',
  'interceptor',
  'fiber',
  'impact',
  'trapper',
]);
export const BODY_IDS = Object.freeze([
  'atlas-swallow-v1',
  'atlas-pottery-courier-v1',
  'atlas-carved-chest-v1',
  'atlas-falcon-crest-v1',
  'atlas-weaver-shuttle-v1',
  'atlas-bell-warden-v1',
  'atlas-woven-basket-v1',
]);
export const BASE_COMMIT = '63713050d49f0a1d5055d9c627f4f95889ba6dc9';
const requireValue = (value, message) => {
  if (!value) throw new Error(message);
};
const keys = (object, expected) =>
  requireValue(
    object &&
      Object.getPrototypeOf(object) === Object.prototype &&
      JSON.stringify(Object.keys(object).sort()) === JSON.stringify(expected.split(' ').sort()),
    `Exact object fields: ${expected}`,
  );
const finite = (value, low, high) => Number.isFinite(value) && value >= low && value <= high;

/** Conservative circle around each wing pivot contains every supported flap,
 * including all polygon corners before any fold reduction. Coordinates refer
 * to the complete contained original, never a cropped silhouette.
 */
export function wingEnvelopes(component) {
  const radius = Math.hypot(component.span, component.chord * 0.5);
  return component.anchors.map(([x, y]) => ({
    left: x - radius,
    top: y - radius,
    right: x + radius,
    bottom: y + radius,
  }));
}

/** Strict source-candidate JSON admission before the compatibility validator.
 * The returned data is detached; this is not a runtime pack/library schema.
 */
export function validatePresentations(input) {
  requireValue(
    typeof input === 'string' &&
      input.length <= 64 * 1024 &&
      new TextEncoder().encode(input).byteLength <= 64 * 1024,
    'Bounded JSON text required.',
  );
  const data = JSON.parse(input);
  keys(data, 'format baseCommit stage runtimeBinding roles');
  requireValue(
    data.format === 'ukraine-role-presentations.v1' &&
      data.stage === 'source-candidate' &&
      data.runtimeBinding === null,
    'Source-candidate format.',
  );
  requireValue(
    typeof data.baseCommit === 'string' && data.baseCommit === BASE_COMMIT,
    'Exact base commit.',
  );
  requireValue(Array.isArray(data.roles) && data.roles.length === 7, 'Exactly seven source roles.');
  const characters = {},
    animationRecipes = {};
  for (const [i, role] of data.roles.entries()) {
    keys(role, 'classId title provenance sha256 width height body recipe');
    requireValue(role.classId === ROLE_IDS[i], 'Exact independent role order.');
    requireValue(
      typeof role.title === 'string' && role.title.length > 0 && role.title.length <= 80,
      'Bounded title.',
    );
    requireValue(
      role.provenance === `provenance/${role.classId}.json` &&
        typeof role.sha256 === 'string' &&
        /^[0-9a-f]{64}$/.test(role.sha256),
      'Exact original metadata path/hash.',
    );
    requireValue(
      Number.isInteger(role.width) &&
        Number.isInteger(role.height) &&
        finite(role.width, 1, 2048) &&
        finite(role.height, 1, 2048) &&
        role.width === role.height,
      'Bounded square natural dimensions.',
    );
    const body = role.body;
    keys(
      body,
      'src widthCells heightCells sampling headingOffsetDegrees animationRecipe rotors compactMinimumCSSPixels',
    );
    requireValue(
      body.src === `originals/${role.classId}.png`,
      'Independent relative original path.',
    );
    requireValue(
      body.sampling === 'nearest' &&
        body.headingOffsetDegrees === 0 &&
        body.widthCells === 1.25 &&
        body.heightCells === 1.25 &&
        body.compactMinimumCSSPixels === 20,
      'North-oriented contained body contract.',
    );
    requireValue(body.animationRecipe === `${BODY_IDS[i]}-wings`, 'Independent recipe ID.');
    requireValue(
      Array.isArray(body.rotors) && body.rotors.length === 0,
      'No rotor anchors on wing bodies.',
    );
    keys(role.recipe, 'components');
    requireValue(
      Array.isArray(role.recipe.components) && role.recipe.components.length === 1,
      'One supported wing component only.',
    );
    const component = role.recipe.components[0];
    keys(
      component,
      'id type anchors span chord frequencyHz speedFrequencyGain amplitudeDegrees foldFraction color tipColor',
    );
    requireValue(component.id === 'wings' && component.type === 'wings', 'Cosmetic wing rig.');
    requireValue(
      Array.isArray(component.anchors) && component.anchors.length === 2,
      'Exactly two independent wing attachments.',
    );
    for (const [n, anchor] of component.anchors.entries()) {
      requireValue(
        Array.isArray(anchor) &&
          anchor.length === 3 &&
          finite(anchor[0], -0.4, 0.4) &&
          finite(anchor[1], -0.4, 0.4) &&
          anchor[2] === (n === 0 ? -1 : 1) &&
          (n === 0 ? anchor[0] < 0 : anchor[0] > 0),
        'Finite ordered left/right original-coordinate attachments.',
      );
    }
    characters[BODY_IDS[i]] = body;
    animationRecipes[body.animationRecipe] = role.recipe;
  }
  validateAnimationRecipes({ characters, animationRecipes });
  for (const { recipe } of data.roles)
    for (const envelope of wingEnvelopes(recipe.components[0]))
      requireValue(
        envelope.left >= -0.5 &&
          envelope.top >= -0.5 &&
          envelope.right <= 0.5 &&
          envelope.bottom <= 0.5,
        'Whole moving wing envelope fits original rectangle.',
      );
  return data;
}

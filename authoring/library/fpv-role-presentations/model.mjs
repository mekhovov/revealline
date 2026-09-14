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
  'fpv-scout-v1',
  'fpv-light-carrier-v1',
  'fpv-heavy-carrier-v1',
  'fpv-interceptor-v1',
  'fpv-fiber-relay-v1',
  'fpv-impact-v1',
  'fpv-trapper-v1',
]);
const requireValue = (condition, message) => {
  if (!condition) throw new Error(message);
};
const keys = (object, expected) =>
  requireValue(
    object &&
      Object.getPrototypeOf(object) === Object.prototype &&
      JSON.stringify(Object.keys(object).sort()) === JSON.stringify(expected.split(' ').sort()),
    `Exact object fields: ${expected}`,
  );
const finite = (value, low, high) => Number.isFinite(value) && value >= low && value <= high;

/** Finite authoring schema, stricter than the shared compatibility validator.
 * Returns detached JSON data; the preview never changes the caller's candidate.
 */
export function validatePresentations(input) {
  requireValue(
    typeof input === 'string' && input.length <= 64 * 1024,
    'Bounded JSON text required.',
  );
  const data = JSON.parse(input);
  keys(data, 'format baseCommit stage runtimeBinding roles');
  requireValue(
    data.format === 'fpv-role-presentations.v1' &&
      data.stage === 'source-candidate' &&
      data.runtimeBinding === null,
    'Source-candidate format.',
  );
  requireValue(
    typeof data.baseCommit === 'string' && /^[0-9a-f]{40}$/.test(data.baseCommit),
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
        finite(role.height, 1, 2048),
      'Bounded natural dimensions.',
    );
    const body = role.body;
    keys(body, 'src widthCells heightCells sampling headingOffsetDegrees animationRecipe rotors');
    requireValue(
      body.src === `originals/${role.classId}.png`,
      'Independent relative original path.',
    );
    requireValue(
      body.sampling === 'nearest' &&
        body.headingOffsetDegrees === 0 &&
        body.widthCells === 1.25 &&
        body.heightCells === 1.25,
      'North-oriented contained body contract.',
    );
    requireValue(body.animationRecipe === `${BODY_IDS[i]}-rotors`, 'Independent recipe ID.');
    requireValue(
      Array.isArray(body.rotors) && body.rotors.length === (role.classId === 'carrier' ? 6 : 4),
      'Exact observed motor count.',
    );
    keys(role.recipe, 'components');
    requireValue(
      Array.isArray(role.recipe.components) && role.recipe.components.length === 1,
      'One supported rotor component only.',
    );
    const component = role.recipe.components[0];
    keys(
      component,
      'id type bladeCount bladeShape radius bladeWidth idleRps travelRps maxVisualRps blurOpacity phaseDegrees direction fillColor tipColor hubColor',
    );
    requireValue(
      component.id === 'main-rotors' && component.type === 'rotors' && component.bladeCount === 3,
      'Three-blade cosmetic rig.',
    );
    const seen = new Set();
    for (const anchor of body.rotors) {
      keys(anchor, 'x y radiusScale direction phaseDegrees');
      requireValue(
        finite(anchor.x, -0.45, 0.45) &&
          finite(anchor.y, -0.45, 0.45) &&
          finite(anchor.radiusScale, 0.5, 1.5),
        'Finite original-coordinate hub.',
      );
      const radius = component.radius * anchor.radiusScale;
      requireValue(
        Math.abs(anchor.x) + radius <= 0.5 && Math.abs(anchor.y) + radius <= 0.5,
        'Whole rotating envelope fits original rectangle.',
      );
      const point = `${anchor.x},${anchor.y}`;
      requireValue(!seen.has(point), 'Distinct hubs.');
      seen.add(point);
    }
    characters[BODY_IDS[i]] = body;
    animationRecipes[body.animationRecipe] = role.recipe;
  }
  validateAnimationRecipes({ characters, animationRecipes });
  return data;
}

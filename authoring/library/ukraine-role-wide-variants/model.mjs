import { validateAnimationRecipes } from '../../motion-lab/animation.mjs';
import { wingEnvelopes } from '../ukraine-role-presentations/model.mjs';
export { wingEnvelopes } from '../ukraine-role-presentations/model.mjs';

export const PARENT_COMMIT = '7611ea334ef0d60ca9abb791299b4edf74e6ce08';
export const ROLE_IDS = Object.freeze(['scout', 'interceptor', 'fiber']);
export const BODY_IDS = Object.freeze([
  'atlas-swallow-v3',
  'atlas-falcon-crest-v3',
  'atlas-weaver-shuttle-v3',
]);
const requireValue = (value, message) => {
  if (!value) throw new Error(message);
};
const keys = (value, expected) =>
  requireValue(
    value &&
      Object.getPrototypeOf(value) === Object.prototype &&
      JSON.stringify(Object.keys(value).sort()) === JSON.stringify(expected.split(' ').sort()),
    `Exact fields: ${expected}`,
  );

/** Source-only three-role contract. No registered/runtime body is replaced. */
export function validateVariants(input) {
  requireValue(
    typeof input === 'string' &&
      input.length <= 65536 &&
      new TextEncoder().encode(input).byteLength <= 65536,
    'Bounded JSON text required.',
  );
  const value = JSON.parse(input);
  keys(value, 'format parentCommit stage runtimeBinding roles');
  requireValue(
    value.format === 'ukraine-role-wide-variants.v1' &&
      value.parentCommit === PARENT_COMMIT &&
      value.stage === 'source-candidate' &&
      value.runtimeBinding === null,
    'Exact source-only parent.',
  );
  requireValue(Array.isArray(value.roles) && value.roles.length === 3, 'Exactly three roles.');
  const characters = {},
    animationRecipes = {};
  for (const [i, role] of value.roles.entries()) {
    keys(role, 'classId title provenance sha256 width height body recipe');
    requireValue(
      role.classId === ROLE_IDS[i] && role.provenance === `provenance/${ROLE_IDS[i]}.json`,
      'Exact role and provenance.',
    );
    requireValue(
      typeof role.title === 'string' &&
        role.title.length > 0 &&
        role.title.length <= 80 &&
        typeof role.sha256 === 'string' &&
        /^[0-9a-f]{64}$/.test(role.sha256),
      'Bounded title and exact hash type.',
    );
    requireValue(
      Number.isInteger(role.width) &&
        role.width > 0 &&
        role.width <= 2048 &&
        role.width === role.height,
      'Bounded square natural dimensions.',
    );
    const body = role.body;
    keys(
      body,
      'src widthCells heightCells sampling headingOffsetDegrees animationRecipe rotors compactMinimumCSSPixels',
    );
    requireValue(
      body.src === `originals/${role.classId}-v3.png` &&
        body.animationRecipe === `${BODY_IDS[i]}-wings`,
      'Exact fresh original path and recipe.',
    );
    requireValue(
      body.widthCells === 1.25 &&
        body.heightCells === 1.25 &&
        body.sampling === 'nearest' &&
        body.headingOffsetDegrees === 0 &&
        body.compactMinimumCSSPixels === 20 &&
        Array.isArray(body.rotors) &&
        body.rotors.length === 0,
      'Unchanged north/contained/compact body contract.',
    );
    keys(role.recipe, 'components');
    requireValue(
      Array.isArray(role.recipe.components) && role.recipe.components.length === 1,
      'One wing component.',
    );
    const component = role.recipe.components[0];
    keys(
      component,
      'id type anchors span chord frequencyHz speedFrequencyGain amplitudeDegrees foldFraction color tipColor',
    );
    requireValue(
      component.id === 'wings' &&
        component.type === 'wings' &&
        Array.isArray(component.anchors) &&
        component.anchors.length === 2,
      'Two wing anchors only.',
    );
    for (const [n, anchor] of component.anchors.entries())
      requireValue(
        Array.isArray(anchor) &&
          anchor.length === 3 &&
          anchor.slice(0, 2).every((x) => Number.isFinite(x) && Math.abs(x) <= 0.4) &&
          anchor[2] === (n ? 1 : -1) &&
          (n ? anchor[0] > 0 : anchor[0] < 0),
        'Finite ordered source anchors.',
      );
    characters[BODY_IDS[i]] = body;
    animationRecipes[body.animationRecipe] = role.recipe;
  }
  validateAnimationRecipes({ characters, animationRecipes });
  for (const role of value.roles)
    for (const e of wingEnvelopes(role.recipe.components[0]))
      requireValue(
        e.left >= -0.5 && e.top >= -0.5 && e.right <= 0.5 && e.bottom <= 0.5,
        'Whole moving envelope fits original rectangle.',
      );
  return value;
}

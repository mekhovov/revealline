import { boundedJSON, exactKeys, plainObject, required, stableId } from './data-json.mjs';
import { recommendedBody as authoredRecommendedBody } from './content.mjs';
import { validateAnimationRecipes } from '../authoring/motion-lab/animation.mjs';

const fields = (value, names, label) => {
  exactKeys(value, names, label);
  required(
    names.every((name) => Object.hasOwn(value, name)),
    `${label} fields are required.`,
  );
};
const sameMapping = (a, b) =>
  plainObject(a) &&
  Object.keys(a).length === Object.keys(b).length &&
  Object.entries(b).every(([key, value]) => Object.hasOwn(a, key) && a[key] === value);

/** Current presentation data only. No theme, reward, preference or session mutation.
 * A missing catalog preserves the original recommendation and availability behavior.
 */
export function createCharacterPresentations(presets) {
  const owned = boundedJSON(presets, {
    maxBytes: 128 * 1024,
    maxNodes: 16000,
    maxDepth: 16,
    maxArray: 128,
    maxString: 2048,
  });
  required(
    plainObject(owned) && plainObject(owned.characters),
    'Registered character presets required.',
  );
  const catalog = Object.hasOwn(owned, 'characterPresentations')
    ? boundedJSON(owned.characterPresentations, {
        maxBytes: 16 * 1024,
        maxNodes: 2048,
        maxDepth: 8,
        maxArray: 12,
        maxString: 160,
      })
    : { format: 'revealline-character-presentations.v1', sets: [] };
  fields(catalog, ['format', 'sets'], 'Character presentation catalog');
  required(
    catalog.format === 'revealline-character-presentations.v1',
    'Unknown character presentation format.',
  );
  required(
    Array.isArray(catalog.sets) && catalog.sets.length <= 8,
    'At most eight presentation sets.',
  );
  const ids = new Set(),
    starters = new Set(),
    guards = new Set();
  for (const set of catalog.sets) {
    fields(
      set,
      [
        'id',
        'themeId',
        'themeFamily',
        'legacyPlayer',
        'matchClassBodies',
        'classBodies',
        'starterBodies',
      ],
      'Presentation set',
    );
    required(
      [set.id, set.themeId, set.themeFamily, set.legacyPlayer].every(stableId),
      'Stable presentation IDs required.',
    );
    required(!ids.has(set.id), 'Duplicate presentation set.');
    ids.add(set.id);
    required(
      plainObject(set.matchClassBodies) && plainObject(set.classBodies),
      'Class body maps required.',
    );
    const classes = Object.keys(set.matchClassBodies);
    required(
      classes.length > 0 && classes.length <= 12 && classes.every(stableId),
      'One to twelve stable class keys.',
    );
    required(
      sameMapping(
        Object.fromEntries(classes.map((id) => [id, true])),
        Object.fromEntries(Object.keys(set.classBodies).map((id) => [id, true])),
      ),
      'Exact matching class key set required.',
    );
    required(
      Object.values(set.matchClassBodies).every(
        (id) => stableId(id) && Object.hasOwn(owned.characters, id),
      ),
      'Original recommendations must be registered.',
    );
    required(
      Object.hasOwn(owned.characters, set.legacyPlayer),
      'Original default body must be registered.',
    );
    const guard = JSON.stringify([
      set.themeId,
      set.themeFamily,
      set.legacyPlayer,
      classes.sort().map((id) => [id, set.matchClassBodies[id]]),
    ]);
    required(!guards.has(guard), 'Ambiguous presentation match.');
    guards.add(guard);
    const bodies = Object.values(set.classBodies);
    required(
      bodies.every(stableId) && new Set(bodies).size === bodies.length,
      'Independent stable body IDs required.',
    );
    required(
      Array.isArray(set.starterBodies) &&
        set.starterBodies.length === bodies.length &&
        new Set(set.starterBodies).size === bodies.length &&
        bodies.every((id) => set.starterBodies.includes(id)),
      'Starter availability must match this set exactly.',
    );
    const characters = {},
      recipes = {};
    for (const id of bodies) {
      required(
        !starters.has(id) && Object.hasOwn(owned.characters, id),
        'Unique registered presentation body required.',
      );
      const body = owned.characters[id];
      fields(
        body,
        [
          'label',
          'sourceStatus',
          'src',
          'widthCells',
          'heightCells',
          'sampling',
          'headingOffsetDegrees',
          'animationRecipe',
          'rotors',
          'presentationSetId',
          'availability',
          'compactMinimumCSSPixels',
          'originalSha256',
        ],
        'Current presentation body',
      );
      required(
        body.presentationSetId === set.id && body.availability === 'starter',
        'Body must declare this starter set.',
      );
      required(
        typeof body.label === 'string' &&
          body.label.length > 0 &&
          body.label.length <= 80 &&
          typeof body.sourceStatus === 'string' &&
          body.sourceStatus.length <= 512,
        'Bounded character copy required.',
      );
      required(
        typeof body.src === 'string' &&
          /^(?:assets\/[a-zA-Z0-9._-]+|\.\.\/library\/[a-z0-9-]+\/originals\/[a-z0-9-]+)\.png$/.test(
            body.src,
          ),
        'Portable original PNG path required.',
      );
      required(
        typeof body.originalSha256 === 'string' && /^[0-9a-f]{64}$/.test(body.originalSha256),
        'Original hash required.',
      );
      required(
        body.widthCells === 1.25 &&
          body.heightCells === 1.25 &&
          body.sampling === 'nearest' &&
          body.headingOffsetDegrees === 0 &&
          body.compactMinimumCSSPixels === 20,
        'Registered compact body contract required.',
      );
      required(
        stableId(body.animationRecipe) &&
          plainObject(owned.animationRecipes) &&
          Object.hasOwn(owned.animationRecipes, body.animationRecipe),
        'Registered animation required.',
      );
      required(Array.isArray(body.rotors) && body.rotors.length > 0, 'Rotor hubs required.');
      for (const anchor of body.rotors)
        fields(anchor, ['x', 'y', 'radiusScale', 'direction', 'phaseDegrees'], 'Rotor hub');
      const recipe = owned.animationRecipes[body.animationRecipe];
      fields(recipe, ['components'], 'Rotor recipe');
      required(
        Array.isArray(recipe.components) && recipe.components.length === 1,
        'One supported rotor component required.',
      );
      const component = recipe.components[0];
      fields(
        component,
        [
          'id',
          'type',
          'bladeCount',
          'bladeShape',
          'radius',
          'bladeWidth',
          'idleRps',
          'travelRps',
          'maxVisualRps',
          'blurOpacity',
          'phaseDegrees',
          'direction',
          'fillColor',
          'tipColor',
          'hubColor',
        ],
        'Rotor component',
      );
      required(
        component.type === 'rotors' && component.bladeCount === 3,
        'Current presentation uses three-blade rotors.',
      );
      characters[id] = body;
      recipes[body.animationRecipe] = recipe;
      starters.add(id);
    }
    validateAnimationRecipes({ characters, animationRecipes: recipes });
  }
  return Object.freeze({
    recommendedBody(theme, classId, fallback) {
      const current = boundedJSON(theme ?? {}, {
        maxBytes: 64 * 1024,
        maxNodes: 4096,
        maxDepth: 12,
      });
      const original = authoredRecommendedBody(
        current,
        classId,
        fallback ?? current.player ?? 'neutral-marker',
      );
      if (!stableId(classId)) return original;
      const match = catalog.sets.find(
        (set) =>
          current.id === set.themeId &&
          current.family === set.themeFamily &&
          current.player === set.legacyPlayer &&
          sameMapping(current.classBodies, set.matchClassBodies),
      );
      return match && Object.hasOwn(match.classBodies, classId)
        ? match.classBodies[classId]
        : original;
    },
    availableBodies(earned) {
      required(
        earned instanceof Set && Object.getPrototypeOf(earned) === Set.prototype,
        'Existing body availability Set required.',
      );
      const result = new Set(Set.prototype.values.call(earned));
      for (const id of starters) result.add(id);
      return result;
    },
  });
}

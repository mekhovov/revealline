import { boundedJSON, exactKeys, required, stableId } from '../data-json.mjs';
import { bodyMotionPose } from '../ui/body-motion.mjs';
import { validateTheme } from '../content.mjs';
import { validateAnimationRecipes } from '../../authoring/motion-lab/animation.mjs';
import { freezeEdition, resolveEditionAssets, resolveEditionSelection } from './model.mjs';

/** Validate cosmetic motion before a theme becomes active. The same bounded
 * rigid transform is shared with rendering; it never supplies simulation rules. */
export function validateEditionPresetMotion(source) {
  const value = boundedJSON(source);
  for (const body of Object.values(value.characters ?? {})) {
    required(body && typeof body === 'object' && !Array.isArray(body), 'Invalid character preset.');
    if (body.bodyMotion === undefined) continue;
    exactKeys(body.bodyMotion, ['kind', 'radiansPerSecond', 'travelGain'], 'Cosmetic body motion');
    bodyMotionPose(body, { reduced: true });
  }
  return freezeEdition(value);
}

/** Resolve the renderer's legacy body path convention against a fixed virtual
 * root, then require that exact raster file in this edition's approved closure.
 * A company theme cannot opt into the old FPV catalogue's implicit downloads. */
export function validateEditionPresentation({ catalog, editionId, themes, presets }) {
  const selection = resolveEditionSelection(catalog, { editionId });
  const container = boundedJSON(themes),
    bodies = validateEditionPresetMotion(presets);
  required(
    Array.isArray(container.themes) && container.themes.length === 1,
    'An edition needs exactly one selected company theme.',
  );
  const theme = container.themes[0],
    checked = validateTheme(theme);
  required(checked.valid, `Invalid edition theme: ${checked.errors.join(' ')}`);
  required(
    theme.id === selection.brand.themeId && theme.id !== 'fpv' && theme.family === 'company',
    'The edition theme must belong to its selected brand.',
  );
  required(
    bodies.characters &&
      typeof bodies.characters === 'object' &&
      !Array.isArray(bodies.characters) &&
      Object.keys(bodies.characters).length > 0 &&
      Object.keys(bodies.characters).length <= 32,
    'An edition needs bounded character presets.',
  );
  required(
    bodies.animationRecipes &&
      typeof bodies.animationRecipes === 'object' &&
      !Array.isArray(bodies.animationRecipes) &&
      Object.keys(bodies.animationRecipes).length <= 32,
    'An edition needs bounded animation recipes.',
  );
  validateAnimationRecipes(bodies);
  for (const id of [theme.player, ...Object.values(theme.classBodies ?? {})])
    required(
      Object.hasOwn(bodies.characters, id),
      'Theme bodies must belong to the selected presets.',
    );
  const assets = resolveEditionAssets(catalog, { editionId });
  for (const [id, body] of Object.entries(bodies.characters)) {
    required(stableId(id), 'Invalid edition body identity.');
    required(
      ['widthCells', 'heightCells'].every(
        (key) => Number.isFinite(body[key]) && body[key] >= 0.1 && body[key] <= 16,
      ) &&
        Number.isFinite(body.headingOffsetDegrees) &&
        Math.abs(body.headingOffsetDegrees) <= 360 &&
        ['linear', 'nearest'].includes(body.sampling),
      'Invalid bounded edition body dimensions or sampling.',
    );
    if (body.src === null) continue;
    required(
      typeof body.src === 'string' &&
        body.src.length <= 512 &&
        !/[:\\?#%]/.test(body.src) &&
        !body.src.startsWith('/') &&
        body.src
          .split('/')
          .every(
            (part) => ['.', '..'].includes(part) || /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(part),
          ),
      'Edition body artwork must use a local relative path.',
    );
    const url = new URL(body.src, 'https://edition.invalid/authoring/motion-lab/');
    required(
      /\.(?:png|jpe?g|webp)$/i.test(url.pathname) &&
        assets.some(
          (asset) =>
            `/${asset.path}` === url.pathname && asset.publication === 'public' && asset.approved,
        ),
      'Edition body artwork is outside its selected approved asset closure.',
    );
  }
  return freezeEdition({ theme, presets: bodies });
}

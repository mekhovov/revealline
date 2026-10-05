import { FIELD_KIT_COLORS, FIELD_KIT_SPRITE_IDS } from './pixel-art.mjs';
import { TEAM_RUNTIME_IMAGE_SLOTS } from './team-runtime-slots.mjs';
import {
  getThemeFamily,
  getInterfaceTheme,
  BUILTIN_THEME_FAMILIES,
  resolveThemeFamilySelection,
} from './theme-system.mjs';
import { INDUSTRIAL_BUILTIN_SPRITES } from './industrial-arcade-builtins.mjs';

/** An appearance layer only. The original release remains the authority for
 * pictures, audio, provenance, geometry, and all saved presentation identities. */
export const INDUSTRIAL_ARCADE_COLLECTION = Object.freeze({
  format: 'ArcadeAssetCollection.v1',
  id: 'industrial-workshop',
  revision: 'r1',
  roles: Object.freeze([...FIELD_KIT_SPRITE_IDS, ...TEAM_RUNTIME_IMAGE_SLOTS]),
  provenance: Object.freeze({
    author: 'RevealLine',
    license: 'project-original',
    source: 'industrial-arcade.mjs: bolted enamel, brushed steel and oxidized seams',
  }),
});
const collections = BUILTIN_THEME_FAMILIES.filter((family) => family.arcade).map((family) =>
  family.id === 'industrial-workshop'
    ? Object.freeze({ ...INDUSTRIAL_ARCADE_COLLECTION, revision: 'r2' })
    : Object.freeze({
        ...INDUSTRIAL_ARCADE_COLLECTION,
        id: family.id,
        provenance: Object.freeze({
          author: 'RevealLine',
          license: 'project-original',
          source: `${family.id}: semantic pixel material masks`,
        }),
      }),
);
collections.push(INDUSTRIAL_ARCADE_COLLECTION);
export function getArcadeCollection(id, revision) {
  return (
    collections.find((entry) => entry.id === id && (!revision || entry.revision === revision)) ??
    null
  );
}

export function selectedArcadeCollection(preferences) {
  if (preferences?.arcadeArt !== 'follow-game') return null;
  const ref =
    preferences.arcadeCollection ??
    (preferences.familyId === 'follow-game'
      ? resolveThemeFamilySelection(preferences).family
      : getThemeFamily(preferences.familyId, preferences.familyRevision)
    )?.arcade;
  return (
    collections.find((entry) => entry.id === ref?.id && entry.revision === ref.revision) ?? null
  );
}

const materialColors = {
  ink: '#101411',
  shadow: '#242921',
  plate: '#3c4435',
  frame: '#717861',
  metal: '#979b82',
  light: '#c5c8ae',
  white: '#f0e9d7',
  cyan: '#93d2c7',
  amber: '#eac06b',
  danger: '#ff9987',
  green: '#bed7a4',
  earth: '#777348',
};
function colorsFor(collection) {
  if (collection.id === 'industrial-workshop' && collection.revision === 'r1')
    return materialColors;
  const t = getInterfaceTheme(collection.id).tokens;
  const light = ['dnipro-porcelain', 'windows-classic', 'orchard-workshop'].includes(collection.id);
  return {
    ...materialColors,
    ink: light ? t.text : t.ink,
    shadow: light ? t.muted : t.panel,
    plate: light ? t.panel : t.panelRaised,
    frame: t.controlLine,
    metal: light ? t.line : t.muted,
    light: light ? t.panelRaised : t.text,
    white: t.text,
    amber: t.accent,
    earth: light ? t.line : t.panelRaised,
  };
}
function paletteFor(collection) {
  if (collection.id === 'industrial-workshop' && collection.revision === 'r1')
    return INDUSTRIAL_ARCADE_PALETTE;
  const t = getInterfaceTheme(collection.id).tokens;
  return Object.freeze({
    ink: t.text,
    paper: t.ink,
    muted: t.muted,
    accent: t.accent,
    safe: '#79bfb1',
    danger: '#ef917e',
    field: t.panel,
    grid: t.line,
    sky: t.panelRaised,
    land: t.controlLine,
  });
}
const rgb = (hex) => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
const sourceMasks = new Map(
  Object.entries(FIELD_KIT_COLORS).map(([name, hex]) => [rgb(hex).join(','), name]),
);
const structural = new Set(['shadow', 'plate', 'frame', 'metal', 'earth']);
export const INDUSTRIAL_ARCADE_PALETTE = Object.freeze({
  ink: '#f0e9d7',
  paper: '#171b19',
  muted: '#bdc3b2',
  accent: '#ebc879',
  safe: '#93d2c7',
  danger: '#ff9987',
  field: '#292e29',
  grid: '#454d3d',
  sky: '#343f36',
  land: '#686d49',
});

/** Native pixels only: no sampling, new occupied pixels, rotor marks, or baked
 * cues. Sparse seams/rivets are confined to solid same-material interiors. */
export function industrialTexturePixels(
  { width, height, rgba },
  slot,
  collection = INDUSTRIAL_ARCADE_COLLECTION,
) {
  const colors = colorsFor(collection),
    recipe = collection.id;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 128 ||
    height > 128 ||
    rgba.length !== width * height * 4
  )
    throw new TypeError('Industrial sprites require a bounded native RGBA frame.');
  const result = new Uint8ClampedArray(rgba),
    tile = slot.startsWith('terrain.');
  const same = (offset, at) =>
    rgba[offset + 3] === 255 &&
    rgba[offset] === rgba[at] &&
    rgba[offset + 1] === rgba[at + 1] &&
    rgba[offset + 2] === rgba[at + 2];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4;
      if (!rgba[at + 3]) continue;
      const role = sourceMasks.get(`${rgba[at]},${rgba[at + 1]},${rgba[at + 2]}`);
      if (!role) continue;
      const color = { name: role, rgb: rgb(colors[role]) };
      let delta = 0;
      if (
        structural.has(color.name) &&
        x > 0 &&
        y > 0 &&
        x < width - 1 &&
        y < height - 1 &&
        [at - 4, at + 4, at - width * 4, at + width * 4].every((offset) => same(offset, at))
      ) {
        if (recipe === 'windows-classic' || recipe === 'dos') delta = 0;
        else if (recipe === 'vyshyvanka')
          delta = (x + y) % 6 === 0 || (x - y + 128) % 6 === 0 ? 12 : -2;
        else if (recipe === 'dnipro-porcelain')
          delta = (y + Math.floor(Math.sin(x / 3) * 2)) % 9 === 0 ? -12 : 3;
        else if (recipe === 'orchard-workshop')
          delta = (y + Math.floor(Math.sin(x / 5))) % 6 === 0 ? -11 : 3;
        else if (recipe === 'neon-ruins')
          delta = x % 12 === 2 && y % 12 < 4 ? 23 : (x + y) % 9 === 0 ? -6 : 0;
        else if (tile && y % 8 === 6) delta = -13;
        else if (x % 8 === 2 && y % 8 === 2) delta = 19;
        else if ((x + 2 * y) % 11 === 0) delta = -7;
      }
      for (let c = 0; c < 3; c++) result[at + c] = Math.min(255, Math.max(0, color.rgb[c] + delta));
    }
  return { width, height, rgba: result };
}

const defaultCanvas = () => globalThis.document?.createElement('canvas');
/** Each adapter owns a bounded cache, retired with its painter. Original shared
 * ImageBitmaps are neither changed nor disposed. Failure preserves authored art. */
export function createArcadeAdapter({ canvasFactory = defaultCanvas } = {}) {
  let snapshots = new WeakMap();
  const canvases = new Set();
  return {
    resolve(base, collection) {
      if (!base || !collections.includes(collection)) return base;
      const variants = snapshots.get(base) ?? new Map();
      const key = `${collection.id}@${collection.revision}`;
      if (variants.has(key)) return variants.get(key);
      const frames = new Map();
      const adapted = Object.freeze({
        ...base,
        appearance: collection,
        fonts: Object.freeze({
          ui: '"Exo 2", "Field Kit UI", system-ui, sans-serif',
          numeric: '"IBM Plex Mono", "Field Kit Mono", ui-monospace, monospace',
        }),
        canvas: Object.freeze({ ...base.canvas, palette: paletteFor(collection) }),
        image(slot) {
          if (frames.has(slot)) return frames.get(slot);
          const original = base.image?.(slot) ?? null,
            asset = original?.asset ?? base.resolved?.assets?.[slot];
          if (
            !original ||
            asset?.id !== `${slot}.field-kit` ||
            !INDUSTRIAL_BUILTIN_SPRITES[slot]?.includes(asset?.file?.sha256)
          )
            return original;
          let derived = original;
          try {
            const width = original.image.naturalWidth ?? original.image.width,
              height = original.image.naturalHeight ?? original.image.height;
            if (
              width !== asset.file.width ||
              height !== asset.file.height ||
              width > 128 ||
              height > 128
            )
              return original;
            const canvas = canvasFactory();
            if (!canvas) return original;
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) return original;
            ctx.drawImage(original.image, 0, 0);
            const data = ctx.getImageData(0, 0, width, height);
            data.data.set(
              industrialTexturePixels({ width, height, rgba: data.data }, slot, collection).rgba,
            );
            ctx.putImageData(data, 0, 0);
            canvases.add(canvas);
            derived = Object.freeze({ ...original, image: canvas });
          } catch {
            /* A failed/tainted decode must never hide a functional sprite. */
          }
          frames.set(slot, derived);
          return derived;
        },
      });
      variants.set(key, adapted);
      snapshots.set(base, variants);
      return adapted;
    },
    clear() {
      for (const canvas of canvases) {
        canvas.width = 0;
        canvas.height = 0;
      }
      canvases.clear();
      snapshots = new WeakMap();
    },
  };
}

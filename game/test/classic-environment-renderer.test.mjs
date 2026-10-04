import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { parse } from 'acorn';
import { CLASSIC_SNAKE_LEVELS } from '../snake/classic-catalogue.mjs';
import { prepareClassicEnvironments } from '../snake/classic-environment.mjs';
import {
  acceptAttemptAppearance,
  requireAcceptedAttemptAppearance,
} from '../presentation/attempt-appearance.mjs';
import { resolveIndustrialEnvironment } from '../presentation/industrial-environments.mjs';
import { INDUSTRIAL_BUILTIN_SPRITES } from '../presentation/industrial-arcade-builtins.mjs';
import {
  selectedArcadeCollection,
  getArcadeCollection,
  getArcadePalette,
  industrialTexturePixels,
} from '../presentation/industrial-arcade.mjs';
import { industrialMaterialPixels } from '../presentation/industrial-materials.mjs';
import { TOKEN_DEFAULTS } from '../presentation/model.mjs';

const lookup = await prepareClassicEnvironments(CLASSIC_SNAKE_LEVELS, { official: true });
const entries = CLASSIC_SNAKE_LEVELS.filter((entry) => lookup(entry, 'solo'));
const military = {
  artRevision: 'industrial-roster-v3',
  collection: { id: 'military-field', revision: 'r1' },
};
async function harness() {
  const source = await readFile(
    new URL('../snake/classic-presentation.mjs', import.meta.url),
    'utf8',
  );
  const fn = parse(source, { ecmaVersion: 'latest', sourceType: 'module' }).body.find(
    (node) => node.declaration?.id?.name === 'createClassicPresentation',
  ).declaration;
  const created = [],
    original = { width: 16, height: 16 };
  const frame = {
    image: original,
    asset: {
      id: 'terrain.wall.field-kit',
      file: { sha256: INDUSTRIAL_BUILTIN_SPRITES['terrain.wall'][0] },
    },
  };
  const board = { image: () => frame };
  let subscriber,
    closed = 0;
  const theme = {
    effectivePreferences: () => ({ arcadeArt: 'authored' }),
    subscribe(callback) {
      subscriber = callback;
      callback({ tokens: TOKEN_DEFAULTS });
      return () => {};
    },
    refresh() {},
    dispose() {},
  };
  const factory = runInNewContext(`(${source.slice(fn.start, fn.end)})`, {
    AbortController,
    Map,
    Object,
    queueMicrotask,
    CLASSIC_PRESENTATION: { id: 'classic-fpv', revision: 1 },
    actorArtReviewRevision: () => null,
    classicAppearanceContext: () => ({}),
    createPresentationHost: () => ({
      current: () => board,
      load: async () => board,
      close: () => closed++,
    }),
    installThemeHost: () => theme,
    TOKEN_DEFAULTS,
    INDUSTRIAL_BUILTIN_SPRITES,
    selectedArcadeCollection,
    getArcadeCollection,
    getArcadePalette,
    industrialTexturePixels,
    requireAcceptedAttemptAppearance,
  });
  const document = {
    createElement() {
      const canvas = { width: 0, height: 0, pixels: null };
      canvas.getContext = () => ({
        drawImage() {},
        getImageData: () => ({ data: new Uint8ClampedArray(16 * 16 * 4) }),
        putImageData: (image) => {
          canvas.pixels = image.data;
        },
      });
      created.push(canvas);
      return canvas;
    },
  };
  const presentation = factory({
    window: { document, addEventListener() {}, removeEventListener() {} },
    document,
  });
  await presentation.ready;
  return {
    presentation,
    frame,
    original,
    created,
    closed: () => closed,
    changeTheme: () =>
      subscriber({
        tokens: { ...TOKEN_DEFAULTS, ink: '#ff0000', panel: '#0000ff', line: '#ffffff' },
      }),
  };
}

test('Classic draws the accepted chapter pixels once for both boards and retires derived textures on replacement', async () => {
  const h = await harness(),
    first = acceptAttemptAppearance(lookup(entries[0], 'solo'), military);
  h.presentation.setAttemptAppearance(first);
  const palette = h.presentation.snapshot().palette;
  h.changeTheme();
  assert.deepEqual(
    h.presentation.snapshot().palette,
    palette,
    'Chapter board palette is independent of live interface chrome',
  );
  const image = h.presentation.snapshot().image('terrain.wall');
  assert.notEqual(image, h.original);
  const definition = resolveIndustrialEnvironment(first.environmentPin),
    binding = definition.arcade['terrain.wall'];
  assert.deepEqual(
    image.pixels,
    industrialMaterialPixels({ width: 16, height: 16 }, binding.material, {
      revision: definition.materialRevision,
      variant: binding.variant,
    }).rgba,
  );
  assert.equal(
    h.presentation.snapshot().image('terrain.wall'),
    image,
    'Both boards share a derived surface',
  );
  assert.equal(h.created.length, 1);
  const second = acceptAttemptAppearance(lookup(entries.at(-1), 'solo'), military);
  h.presentation.setAttemptAppearance(second);
  assert.equal(image.width, 0);
  assert.equal(image.height, 0);
  const next = h.presentation.snapshot().image('terrain.wall');
  assert.notDeepEqual(next.pixels, image.pixels);
  h.presentation.dispose();
  assert.equal(next.width, 0);
  assert.equal(h.closed(), 1);
  assert.equal(h.presentation.snapshot().image('terrain.wall'), null);
});

test('Classic cannot replace creator-owned images, acquire a copied pin or resample historical appearance', async () => {
  const h = await harness(),
    accepted = acceptAttemptAppearance(lookup(entries[0], 'solo'), military);
  h.presentation.setAttemptAppearance(accepted);
  h.frame.asset = {
    id: 'creator-wall',
    file: { sha256: INDUSTRIAL_BUILTIN_SPRITES['terrain.wall'][0] },
  };
  assert.equal(h.presentation.snapshot().image('terrain.wall'), h.original);
  h.frame.asset = { id: 'terrain.wall.field-kit', file: { sha256: '0'.repeat(64) } };
  assert.equal(h.presentation.snapshot().image('terrain.wall'), h.original);
  assert.throws(() => h.presentation.setAttemptAppearance(structuredClone(accepted)), /./);
  assert.throws(() => h.presentation.setArtRevision(null), /./);
  h.presentation.setAttemptAppearance(null);
  h.frame.asset = {
    id: 'terrain.wall.field-kit',
    file: { sha256: INDUSTRIAL_BUILTIN_SPRITES['terrain.wall'][0] },
  };
  h.changeTheme();
  assert.equal(h.presentation.snapshot().image('terrain.wall'), h.original);
  assert.equal(h.created.length, 0);
  h.presentation.dispose();
});

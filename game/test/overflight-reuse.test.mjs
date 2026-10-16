import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateThemeBundle } from '../presentation/model.mjs';
import { createPresentationHost } from '../presentation/host.mjs';
import { createOverflightReuseFixture as reuseFixture } from '../../scripts/overflight-reuse-fixture.mjs';
import { createStudioContextPresentation } from '../../authoring/asset-studio/scene-preview.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { createRun } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { mediaFixture } from './helpers/media-fixtures.mjs';

const readJSON = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const OVERFLIGHT_SLOT = 'pickup.supply-case-closed';
const SOLO_SLOT = 'pickup.supply';

function surface() {
  const calls = [],
    state = { globalAlpha: 1 },
    stack = [];
  const ctx = new Proxy(
    { canvas: { width: 1152, height: 576, clientWidth: 1152 } },
    {
      get(target, key) {
        if (key in target) return target[key];
        if (key in state) return state[key];
        return (...args) => {
          calls.push({ method: key, args });
          if (key === 'save') stack.push({ ...state });
          if (key === 'restore') Object.assign(state, stack.pop());
          if (key === 'measureText') return { width: String(args[0]).length * 8 };
        };
      },
      set(_target, key, value) {
        state[key] = value;
        return true;
      },
    },
  );
  return { ctx, calls };
}

test('one generated Overflight PNG is hash-pinned once and drawn through Solo runtime and Studio context', async () => {
  const { asset, bytes, compiled } = await reuseFixture();
  const assetPath = `assets/${asset.file.sha256}.png`;
  assert.deepEqual(compiled.files.get(assetPath), bytes);
  assert.deepEqual(
    [...compiled.files.keys()].filter((path) => path.startsWith('assets/')),
    [assetPath],
    'Compatible bindings share one compiled file; no second artwork copy or source painter is needed.',
  );
  const baseURL = 'https://game.test/releases/reuse-proof/game/presentation/compiled/';
  const requests = [],
    bitmaps = [];
  const host = createPresentationHost({
    profile: 'board',
    baseURL,
    document: {},
    fetch: async (url) => {
      requests.push(url);
      const file = compiled.files.get(url.slice(baseURL.length));
      return file ? new Response(file) : new Response(null, { status: 404 });
    },
    decodeImage: async (blob) => {
      assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), bytes);
      const image = {
        width: 16,
        height: 16,
        closes: 0,
        close() {
          this.closes++;
        },
      };
      bitmaps.push(image);
      return image;
    },
    createObjectURL: () => 'blob:overflight-reuse-proof',
    revokeObjectURL() {},
  });
  const painters = [];
  try {
    const runtime = await host.load();
    assert.equal(bitmaps.length, 1);
    assert.equal(requests.filter((url) => url.endsWith(assetPath)).length, 1);
    assert.equal(runtime.image(SOLO_SLOT).image, runtime.image(OVERFLIGHT_SLOT).image);
    assert.equal(runtime.image(SOLO_SLOT).asset.id, asset.id);
    const decoded = new Map(
      [SOLO_SLOT, OVERFLIGHT_SLOT].map((slot) => [
        slot,
        { asset, image: runtime.image(slot).image },
      ]),
    );
    const preview = createStudioContextPresentation(runtime.resolved, decoded);
    const presets = await readJSON('../../authoring/motion-lab/presets.json');
    const theme = { id: 'fpv', family: 'fpv', palette: runtime.canvas.palette };
    const level = mediaFixture(true).campaign.levels[0];
    level.supplies = [{ id: 'reuse-supply', x: 15.5, y: 8.5, radius: 1 }];
    const run = createRun(level),
      before = authoritativeCheckpoint(run),
      placements = [];
    for (const snapshot of [runtime, preview]) {
      const painter = new BoardPainter(presets);
      painters.push(painter);
      painter.theme = theme;
      painter.bodyId = 'fpv-scout-v1';
      painter.body = presets.characters[painter.bodyId];
      painter.recipe = presets.animationRecipes[painter.body.animationRecipe];
      painter.background = { width: 1152, height: 576 };
      painter.setPresentation(snapshot);
      const { ctx, calls } = surface();
      painter.draw(ctx, run, 0, { paused: true, reduced: true });
      const supplyDraws = calls.filter(
        (call) => call.method === 'drawImage' && call.args[0] === bitmaps[0],
      );
      assert.equal(
        supplyDraws.length,
        1,
        'The real Solo board painter consumes the selected supply image.',
      );
      placements.push(supplyDraws[0].args.slice(1));
      assert.deepEqual(authoritativeCheckpoint(run), before);
    }
    assert.deepEqual(placements, [
      [240, 128, 16, 16],
      [240, 128, 16, 16],
    ]);
  } finally {
    for (const painter of painters) painter.dispose();
    host.close();
  }
  assert.equal(bitmaps[0].closes, 1, 'Shared bitmap is released once after the host closes.');
});

test('cross-mode reuse still rejects a 16-pixel asset bound to an incompatible 24-pixel slot', async () => {
  const { asset, document, themeId } = await reuseFixture();
  document.themes.find((theme) => theme.id === themeId).bindings['pickup.life'] = {
    id: asset.id,
    revision: asset.revision,
  };
  assert.throws(() => validateThemeBundle(document));
});

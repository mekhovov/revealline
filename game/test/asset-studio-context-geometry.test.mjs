import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createStudioContextPresentation } from '../../authoring/asset-studio/scene-preview.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { FORMATS, resolvePresentation } from '../presentation/model.mjs';
import { imagePresentation } from '../presentation/runtime.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { createRun } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { mediaFixture } from './helpers/media-fixtures.mjs';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const presets = read('../../authoring/motion-lab/presets.json');
const theme = read('../content/themes.json').themes.find((entry) => entry.id === 'fpv');
const document = createDefaultThemeBundle();
const resolved = resolvePresentation(document);
function raster(id) {
  const slot = document.slots.find((entry) => entry.id === id);
  return {
    format: FORMATS.asset,
    id: `${id}.context-test`,
    revision: 1,
    kind: 'image',
    description: 'Asymmetric context geometry fixture, not production artwork.',
    file: {
      sha256: 'a'.repeat(64),
      bytes: 1,
      mime: 'image/png',
      width: slot.dimensions.width,
      height: slot.dimensions.height,
    },
    geometry: {
      ...structuredClone(slot.geometry),
      pivot: { x: 0.25, y: 0.75 },
      rotorAnchors: [
        { x: 0.6, y: 0.4, radius: 0.06, blades: 4 },
        { x: 0.35, y: 0.65, radius: 0.07, blades: 2 },
      ],
    },
    recipe: null,
    provenance: { creator: 'Test', source: 'Test', license: 'Test', prompt: '', parent: null },
    quality: { stage: 'produced', evidence: [] },
  };
}
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
          calls.push({ operation: key, args });
          if (key === 'save') stack.push({ ...state });
          if (key === 'restore') Object.assign(state, stack.pop());
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

test('Context paints asymmetric player/enemy pivots and nondefault rotor anchors through the release adapter', () => {
  const player = raster('player.scout.detailed'),
    enemy = raster('enemy.bouncer'),
    playerImage = { id: 'selected-player', width: 64, height: 64 },
    enemyImage = { id: 'selected-enemy', width: 32, height: 32 },
    decoded = new Map([
      ['player.scout.detailed', { asset: player, image: playerImage }],
      ['enemy.bouncer', { asset: enemy, image: enemyImage }],
    ]),
    before = structuredClone({ player, enemy, resolved }),
    snapshot = createStudioContextPresentation(resolved, decoded, 'player.scout.detailed');
  assert.deepEqual(snapshot.image('enemy.bouncer').geometry, imagePresentation(enemy));
  assert.deepEqual(snapshot.image('player.scout.detailed').geometry, imagePresentation(player));
  assert.deepEqual(
    snapshot.image('enemy.bouncer').geometry.rotors.map((anchor) => anchor.bladeCount),
    [4, 2],
  );
  const painter = new BoardPainter(presets),
    run = createRun(mediaFixture(true).campaign.levels[0]);
  painter.theme = theme;
  painter.bodyId = 'fpv-scout-v1';
  painter.body = presets.characters[painter.bodyId];
  painter.recipe = presets.animationRecipes[painter.body.animationRecipe];
  painter.background = { id: 'legacy fallback', width: 768, height: 576 };
  painter.setPresentation(snapshot);
  run.enemies = [{ id: 'guard', type: 'bouncer', x: 10, y: 10, vx: 1, vy: 1, radius: 0.2 }];
  const runBefore = authoritativeCheckpoint(run),
    sourcePicture = { id: 'exact owner image', width: 384, height: 288 };
  for (const displayCSSWidth of [1152, 320]) {
    const { ctx, calls } = surface();
    painter.draw(ctx, run, 0, {
      paused: true,
      reduced: true,
      displayCSSWidth,
      backdrop: { image: sourcePicture, fit: 'contain' },
    });
    assert.equal(calls.find((call) => call.operation === 'drawImage').args[0], sourcePicture);
    for (const image of [playerImage, enemyImage]) {
      const call = calls.find(
        (entry) => entry.operation === 'drawImage' && entry.args[0] === image,
      );
      assert.ok(call, image.id);
      assert.equal(call.args[1], -call.args[3] * 0.25, `${image.id} horizontal pivot`);
      assert.equal(call.args[2], -call.args[4] * 0.75, `${image.id} vertical pivot`);
    }
    const enemyCall = calls.find(
        (entry) => entry.operation === 'drawImage' && entry.args[0] === enemyImage,
      ),
      rotor = snapshot.image('enemy.bouncer').geometry.rotors[0];
    assert.ok(
      calls.some(
        (entry) =>
          entry.operation === 'translate' &&
          entry.args[0] === rotor.x * enemyCall.args[3] &&
          entry.args[1] === rotor.y * enemyCall.args[4],
      ),
      'Enemy motor anchor uses the same pivot-relative position as runtime',
    );
    assert.deepEqual(authoritativeCheckpoint(run), runBefore);
  }
  assert.deepEqual({ player, enemy, resolved }, before);
});

test('Context retains distinct boss slots and scopes selected player treatment to its own class', () => {
  const ids = ['enemy.lane-boss', 'enemy.relay-sentinel', 'player.scout.detailed'];
  const decoded = new Map(ids.map((id) => [id, { asset: raster(id), image: { id } }]));
  const snapshot = createStudioContextPresentation(resolved, decoded, 'player.scout.detailed');
  for (const id of ids) assert.equal(snapshot.image(id).image.id, id);
  assert.equal(snapshot.image('player.scout.compact').image.id, 'player.scout.detailed');
  assert.equal(snapshot.image('player.carrier.compact'), null);
  assert.equal(snapshot.image('picture.unregistered'), null);
  assert.equal(
    createStudioContextPresentation(resolved, decoded).image('player.scout.compact'),
    null,
  );
});

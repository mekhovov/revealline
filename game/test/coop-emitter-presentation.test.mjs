import test from 'node:test';
import assert from 'node:assert/strict';
import { TEAM_EMITTER_SLOTS, prepareTeamEmitter } from '../couch/coop-emitter-presentation.mjs';
import { createCoopPainter } from '../couch/coop-view.mjs';
import { createStudioTeamFixture } from '../../authoring/asset-studio/team-preview-fixture.mjs';
import { teamEmitterPreviewNote } from '../../authoring/asset-studio/cross-mode-preview.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import {
  addTeamPresentationSlots,
  needsTeamPresentationSlots,
} from '../presentation/team-anchor-upgrade.mjs';
import { resolvePresentation, validateThemeBundle } from '../presentation/model.mjs';
import { reviseStudioTheme, generateAssetPrompt } from '../presentation/studio-session.mjs';
import {
  exportThemeBundle,
  importThemeBundle,
  hashPresentationBytes,
} from '../presentation/bundle.mjs';
import { encodeSpritePNG } from '../../scripts/produce-field-kit-sprites.mjs';
const palette = {
  ink: '#f3f0db',
  paper: '#070b12',
  muted: '#a5b2bb',
  accent: '#f4bf62',
  safe: '#78dce8',
  danger: '#f07879',
  field: '#070b12',
  grid: '#182631',
  sky: '#dfb781',
  land: '#687c55',
};

function snapshot() {
  const images = Object.fromEntries(
    TEAM_EMITTER_SLOTS.map((id) => {
      const size = id.endsWith('warning') ? 24 : 16;
      return [
        id,
        { image: { id, width: size, height: size }, geometry: { pivot: { x: 0.5, y: 0.5 } } },
      ];
    }),
  );
  const assets = Object.fromEntries(TEAM_EMITTER_SLOTS.map((id) => [id, { kind: 'image' }]));
  return {
    images,
    resolved: { assets },
    canvas: { assets, palette, motionScale: 1 },
    fonts: { ui: 'Exo 2', numeric: 'IBM Plex Mono' },
    image: (id) => images[id] ?? null,
  };
}
function surface() {
  const calls = [],
    stack = [],
    state = { globalAlpha: 1 };
  const ctx = new Proxy(
    {},
    {
      get(_, key) {
        if (key in state) return state[key];
        return (...args) => {
          calls.push({ method: key, args, alpha: state.globalAlpha });
          if (key === 'save') stack.push({ ...state });
          if (key === 'restore') {
            const prior = stack.pop();
            for (const k of Object.keys(state)) delete state[k];
            Object.assign(state, prior);
          }
          if (key === 'measureText') return { width: String(args[0]).length * 0.5 };
        };
      },
      set(_, key, value) {
        state[key] = value;
        return true;
      },
    },
  );
  return { calls, canvas: { width: 1152, height: 576, clientWidth: 1152, getContext: () => ctx } };
}

for (const [scenario, slot] of [
  ['emitter-warning', 'team.emitter.warning'],
  ['emitter-spark', 'team.emitter.spark'],
])
  test(`actual ${scenario} draws only its registered decoration and leaves the run unchanged`, () => {
    const fixture = createStudioTeamFixture({ arena: 'relay-yard', scenario }),
      before = structuredClone(fixture.run),
      s = snapshot(),
      { canvas, calls } = surface(),
      painter = createCoopPainter(canvas);
    painter.setPresentation(s);
    painter.paint(fixture.run, { reduced: true });
    const images = calls.filter((c) => c.method === 'drawImage');
    assert.equal(images.length, 1);
    assert.equal(images[0].args[0], s.images[slot].image);
    if (slot.endsWith('warning')) {
      assert.equal(images[0].alpha, 0.65);
      const e = fixture.run.strongholds[0].emitter,
        x = (e.cellIndex % fixture.run.width) + 0.5,
        y = Math.floor(e.cellIndex / fixture.run.width) + 0.5;
      assert(
        calls.some(
          (c) => c.method === 'strokeRect' && c.args[0] === x - 0.7 && c.args[1] === y - 0.7,
        ),
      );
      assert.match(
        teamEmitterPreviewNote(fixture.run),
        /^1 active emitter warning · 0 travelling sparks/,
      );
    } else {
      const point = fixture.run.impacts[0];
      assert.deepEqual(images[0].args.slice(1), [point.x - 0.7, point.y - 0.7, 1.4, 1.4]);
      assert(
        calls.some(
          (c) =>
            c.method === 'arc' &&
            c.args[0] === point.x &&
            c.args[1] === point.y &&
            c.args[2] === 0.35,
        ),
      );
      assert.match(
        teamEmitterPreviewNote(fixture.run),
        /^0 active emitter warnings · 1 travelling spark/,
      );
    }
    assert.deepEqual(fixture.run, before);
    const bad = snapshot();
    bad.images['team.emitter.spark'].image.width = 17;
    assert.throws(() => painter.setPresentation(bad), /16×16 centered/);
    assert.equal(painter.presentation, s);
    calls.length = 0;
    painter.paint(fixture.run, { reduced: true });
    assert.equal(calls.find((c) => c.method === 'drawImage').args[0], s.images[slot].image);
  });
test('historical emitter remains procedural; malformed advertised frames fail; completed previews report hidden effects', () => {
  assert.deepEqual(prepareTeamEmitter(null), {});
  const s = snapshot();
  s.resolved.assets = {};
  s.canvas.assets = {};
  const { canvas, calls } = surface(),
    painter = createCoopPainter(canvas),
    run = createStudioTeamFixture({ arena: 'relay-yard', scenario: 'emitter-spark' }).run;
  painter.setPresentation(s);
  painter.paint(run);
  assert(!calls.some((c) => c.method === 'drawImage'));
  assert(calls.some((c) => c.method === 'arc' && c.args[2] === 0.35));
  for (const mutate of [
    (s) => delete s.images['team.emitter.warning'],
    (s) => (s.images['team.emitter.spark'].geometry.pivot.x = 0),
    (s) =>
      (s.resolved.assets['team.emitter.warning'] = {
        kind: 'recipe',
        recipe: { id: 'team.core.v1' },
      }),
    (s) => (s.resolved.assets['team.emitter.spark'] = { kind: 'font' }),
  ]) {
    const s = snapshot();
    mutate(s);
    assert.throws(() => prepareTeamEmitter(s), /Team emitter/);
  }
  assert.match(
    teamEmitterPreviewNote(
      createStudioTeamFixture({ arena: 'relay-yard', scenario: 'victory' }).run,
    ),
    /hides emitter effects/,
  );
});
test('full Team upgrade adds emitter slots atomically without replacing existing roles or exact historical revisions', () => {
  const old = structuredClone(createDefaultThemeBundle());
  old.slots = old.slots.filter((s) => !TEAM_EMITTER_SLOTS.includes(s.id));
  old.assets = old.assets.filter((a) => !TEAM_EMITTER_SLOTS.some((id) => a.id === `${id}.default`));
  for (const t of old.themes) for (const id of TEAM_EMITTER_SLOTS) delete t.bindings[id];
  validateThemeBundle(old);
  const before = structuredClone(old),
    prior = resolvePresentation(old),
    next = addTeamPresentationSlots(old),
    resolved = resolvePresentation(next);
  assert(needsTeamPresentationSlots(old));
  assert(!needsTeamPresentationSlots(next));
  assert.equal(next.revision, old.revision + 1);
  for (const [id, asset] of Object.entries(prior.assets))
    assert.deepEqual(resolved.assets[id], asset);
  for (const key of ['slots', 'assets', 'themes', 'collections'])
    for (const item of old[key])
      assert.deepEqual(
        next[key].find((x) => x.id === item.id && x.revision === item.revision),
        item,
      );
  assert.deepEqual(old, before);
  assert.throws(() => addTeamPresentationSlots(next), /already available/);
});
for (const [id, size] of [
  ['team.emitter.warning', 24],
  ['team.emitter.spark', 16],
])
  test(`Emitter ${id} preserves uploaded original bytes and history in bundle round trips`, async () => {
    const original = createDefaultThemeBundle(),
      slot = original.slots.find((s) => s.id === id),
      prior = resolvePresentation(original).assets[id];
    const rgba = new Uint8Array(size * size * 4);
    for (let x = 5; x < size - 5; x++) rgba.set([120, 220, 232, 255], (5 * size + x) * 4);
    const bytes = encodeSpritePNG({ width: size, height: size, rgba }),
      blob = new Blob([bytes], { type: 'image/png' }),
      hash = await hashPresentationBytes(bytes);
    const asset = {
      ...structuredClone(prior),
      id: 'emitter-upload',
      revision: 1,
      kind: 'image',
      recipe: null,
      file: { sha256: hash, bytes: bytes.length, mime: 'image/png', width: size, height: size },
      geometry: structuredClone(slot.geometry),
      provenance: {
        ...structuredClone(prior.provenance),
        parent: { id: prior.id, revision: prior.revision },
      },
    };
    const next = reviseStudioTheme(original, {
      assets: [asset],
      bindings: { [id]: { id: asset.id, revision: 1 } },
    });
    const packed = await exportThemeBundle(next, new Map([[hash, blob]]));
    const restored = await importThemeBundle(packed, {
      decodeImage: async () => ({ naturalWidth: size, naturalHeight: size }),
    });
    assert.deepEqual(
      new Uint8Array(await restored.assets.get(hash).arrayBuffer()),
      new Uint8Array(bytes),
    );
    assert.deepEqual(resolvePresentation(restored.document).assets[id], asset);
    assert(
      restored.document.assets.some((a) => a.id === prior.id && a.revision === prior.revision),
    );
    assert.match(generateAssetPrompt(slot, resolvePresentation(next)), /collision/);
  });

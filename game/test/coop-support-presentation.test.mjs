import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TEAM_SUPPORT_SLOTS,
  prepareTeamSupport,
  drawTeamSupportPulse,
} from '../couch/coop-support-presentation.mjs';
import { createCoopPainter } from '../couch/coop-view.mjs';
import { createStudioTeamFixture } from '../../authoring/asset-studio/team-preview-fixture.mjs';
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
    TEAM_SUPPORT_SLOTS.map((id) => {
      const size = id.endsWith('pulse') ? 64 : 24;
      return [
        id,
        { image: { id, width: size, height: size }, geometry: { pivot: { x: 0.5, y: 0.5 } } },
      ];
    }),
  );
  const assets = Object.fromEntries(TEAM_SUPPORT_SLOTS.map((id) => [id, { kind: 'image' }]));
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

test('specialist pulses retain distinct non-colour role glyphs with reduced effects', () => {
  const { canvas, calls } = surface(),
    ctx = canvas.getContext('2d');
  drawTeamSupportPulse(ctx, {}, { player: 0, role: 'interceptor', x: 4, y: 5 }, ['#fff'], true);
  drawTeamSupportPulse(ctx, {}, { player: 0, role: 'disruptor', x: 8, y: 9 }, ['#fff'], true);
  assert.deepEqual(
    calls.filter(({ method }) => method === 'fillText').map(({ args }) => args[0]),
    ['I', 'D'],
  );
  assert(
    calls.some(
      ({ method, args }) => method === 'setLineDash' && args[0][0] === 0.25 && args[0][1] === 0.12,
    ),
  );
  assert(
    calls.some(
      ({ method, args }) => method === 'setLineDash' && args[0][0] === 0.08 && args[0][1] === 0.13,
    ),
  );
});

for (const arena of ['first-connection', 'relay-yard']) {
  test(`Team Support ${arena} draws two registered pulses and slowed decorations without mutating simulation`, () => {
    const fixture = createStudioTeamFixture({ arena, scenario: 'support' }),
      before = structuredClone(fixture.run),
      s = snapshot(),
      { canvas, calls } = surface(),
      painter = createCoopPainter(canvas);
    painter.setPresentation(s);
    painter.paint(fixture.run, { reduced: true });
    const draw = (id) =>
      calls.filter((c) => c.method === 'drawImage' && c.args[0] === s.images[id].image);
    assert.equal(draw(TEAM_SUPPORT_SLOTS[0]).length, 2);
    assert.equal(draw(TEAM_SUPPORT_SLOTS[1]).length, 2);
    assert(draw(TEAM_SUPPORT_SLOTS[0]).every((c) => c.alpha <= 0.18));
    assert(draw(TEAM_SUPPORT_SLOTS[1]).every((c) => c.alpha <= 0.5));
    assert.equal(calls.filter((c) => c.method === 'fillText' && c.args[0] === 'SLOWED').length, 2);
    assert.deepEqual(fixture.run, before);
    const bad = snapshot();
    bad.images['team.enemy.slowed'].geometry.pivot.x = 0;
    assert.throws(() => painter.setPresentation(bad), /24×24 centered/);
    assert.equal(painter.presentation, s);
    calls.length = 0;
    for (let tick = 0; tick < 40; tick++) fixture.advance(1 / 120);
    painter.paint(fixture.run, { reduced: true });
    assert.equal(draw(TEAM_SUPPORT_SLOTS[0]).length, 0);
    assert.equal(draw(TEAM_SUPPORT_SLOTS[1]).length, 2);
  });
}
test('historical Support needs no images; unavailable advertised frames fail instead of substituting', () => {
  assert.deepEqual(prepareTeamSupport(null), {});
  const s = snapshot();
  s.resolved.assets = {};
  s.canvas.assets = {};
  const { canvas, calls } = surface(),
    painter = createCoopPainter(canvas);
  painter.setPresentation(s);
  const run = createStudioTeamFixture({ scenario: 'support' }).run,
    before = structuredClone(run);
  painter.paint(run);
  assert(!calls.some((c) => c.method === 'drawImage'));
  assert.equal(calls.filter((c) => c.method === 'fillText' && c.args[0] === 'SLOWED').length, 2);
  assert.equal(calls.filter((c) => c.method === 'arc' && c.args[2] === 6).length, 4);
  assert.deepEqual(run, before);
  for (const mutate of [
    (s) => delete s.images['team.support.pulse'],
    (s) => (s.images['team.enemy.slowed'].image.width = 32),
    (s) =>
      (s.resolved.assets['team.support.pulse'] = {
        kind: 'recipe',
        recipe: { id: 'team.core.v1' },
      }),
    (s) => (s.resolved.assets['team.support.pulse'] = { kind: 'audio' }),
  ]) {
    const s = snapshot();
    mutate(s);
    assert.throws(() => prepareTeamSupport(s), /Team Support/);
  }
});
test('explicit presentation upgrade preserves old objective bindings and revisions', () => {
  const old = structuredClone(createDefaultThemeBundle());
  old.slots = old.slots.filter((s) => !TEAM_SUPPORT_SLOTS.includes(s.id));
  old.assets = old.assets.filter((a) => !TEAM_SUPPORT_SLOTS.some((id) => a.id === `${id}.default`));
  for (const theme of old.themes) for (const id of TEAM_SUPPORT_SLOTS) delete theme.bindings[id];
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
  for (const id of TEAM_SUPPORT_SLOTS)
    assert.equal(resolved.assets[id].recipe.id, 'team.support.v1');
});

for (const [id, size] of [
  ['team.support.pulse', 64],
  ['team.enemy.slowed', 24],
])
  test(`Support ${id} preserves uploaded original bytes and history in bundle round trips`, async () => {
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
      id: 'support-upload',
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
    assert.match(generateAssetPrompt(slot, resolvePresentation(next)), /radius/);
  });

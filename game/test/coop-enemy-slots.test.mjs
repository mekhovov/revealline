import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoopPainter } from '../couch/coop-view.mjs';
import {
  TEAM_ENEMY_SLOTS,
  prepareTeamEnemies,
  teamEnemySlot,
  teamEnemyInheritance,
} from '../couch/coop-enemy-slots.mjs';
import { createStudioTeamFixture } from '../../authoring/asset-studio/team-preview-fixture.mjs';
import { teamEnemyPreviewNote } from '../../authoring/asset-studio/cross-mode-preview.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { resolvePresentation } from '../presentation/model.mjs';
import { imagePresentation } from '../presentation/runtime.mjs';
import {
  addTeamPresentationSlots,
  needsTeamPresentationSlots,
} from '../presentation/team-anchor-upgrade.mjs';
import { reviseStudioTheme, generateAssetPrompt } from '../presentation/studio-session.mjs';
import {
  hashPresentationBytes,
  exportThemeBundle,
  importThemeBundle,
} from '../presentation/bundle.mjs';
import { encodeSpritePNG } from '../../scripts/produce-field-kit-sprites.mjs';
import { createCoop, startCoop, stepCoop, FIXED_DT } from '../coop/core.mjs';
import { FIRST_CONNECTION } from '../coop/first-connection.mjs';
import { RELAY_YARD } from '../coop/relay-yard.mjs';
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

const defaults = createDefaultThemeBundle();
function snapshot() {
  const assets = {},
    images = {};
  for (const id of TEAM_ENEMY_SLOTS) {
    const slot = defaults.slots.find((s) => s.id === id);
    assets[id] = { kind: 'image' };
    images[id] = {
      image: { id, width: 32, height: 32 },
      geometry: {
        frame: slot.geometry.frame,
        pivot: { x: 0.5, y: 0.5 },
        occupiedBounds: slot.geometry.occupiedBounds,
        rotors: [],
        nineSlice: null,
      },
    };
  }
  return {
    images,
    resolved: { assets },
    canvas: { assets, palette, motionScale: 1 },
    fonts: { ui: 'Exo 2', numeric: 'IBM Plex Mono' },
    image: (id) => images[id] ?? null,
  };
}
const cases = [
  ['initial', 'team.enemy.drifter'],
  ['initial', 'team.enemy.hunter.patrol'],
  ['warning', 'team.enemy.hunter.warning'],
  ['charge', 'team.enemy.hunter.charge'],
  ['hunter-recovery', 'team.enemy.hunter.recovery'],
];
for (const arena of ['first-connection', 'relay-yard'])
  for (const [scenario, id] of cases)
    test(`${arena} ${id} uses the real phase body without changing simulation`, () => {
      const f = createStudioTeamFixture({ arena, scenario }),
        s = snapshot(),
        { canvas, calls } = surface(),
        p = createCoopPainter(canvas),
        before = structuredClone(f.run);
      p.setPresentation(s);
      p.paint(f.run, { reduced: true });
      const expected = f.run.enemies.filter((e) => teamEnemySlot(e) === id);
      assert(expected.length > 0);
      for (const e of expected) {
        assert.equal(p.actorFrame('enemy', e.id).stateSlot, id);
        assert.equal(p.actorFrame('enemy', e.id).sourceSlot, id);
      }
      assert.equal(
        calls.filter((c) => c.method === 'drawImage' && c.args[0] === s.images[id].image).length,
        expected.length,
      );
      assert.match(teamEnemyPreviewNote(id, p, f.run), /Showing .* active/);
      assert.deepEqual(f.run, before);
      if (id.endsWith('.charge'))
        assert(calls.some((c) => c.method === 'fillText' && c.args[0] === 'CHARGE'));
      if (id.endsWith('.recovery'))
        assert(calls.some((c) => c.method === 'fillText' && c.args[0] === 'RECOVER'));
    });
for (const [arena, level, inward, continued, target] of [
  ['first-connection', FIRST_CONNECTION, 150, 23, 432],
  ['relay-yard', RELAY_YARD, 230, 33, 502],
])
  test(`${arena} recovery specimen is earned by independent public command sequence`, () => {
    const c = (direction = null, boost = true, support = false) => ({ direction, boost, support }),
      run = startCoop(createCoop(level, { difficulty: 'standard', seed: 17 }));
    for (const [ticks, a, b] of [
      [60, c('up'), c('up')],
      [inward, c('right'), c('left')],
      [1, c('right', true, true), c('left', true, true)],
      [continued, c('right'), c('left')],
      [target - 61 - inward - continued, c(null, false), c(null, false)],
    ])
      for (let i = 0; i < ticks; i++) stepCoop(run, [a, b], FIXED_DT);
    const f = createStudioTeamFixture({ arena, scenario: 'hunter-recovery' });
    assert.deepEqual(f.run, run);
    assert.equal(run.tick, target);
    assert(run.enemies.some((e) => e.active && e.phase === 'recovery'));
    const selected = structuredClone(f.run);
    for (let i = 0; i < 20; i++) f.advance(FIXED_DT);
    f.reset();
    assert.deepEqual(f.run, selected);
  });
test('inactive and completed enemy previews report the actual state rather than the selected slot', () => {
  const f = createStudioTeamFixture({ arena: 'relay-yard', scenario: 'initial' }),
    { canvas } = surface(),
    p = createCoopPainter(canvas);
  p.setPresentation(snapshot());
  p.paint(f.run);
  assert.match(teamEnemyPreviewNote('team.enemy.hunter.charge', p, f.run), /inactive.*patrol/);
  assert.match(
    teamEnemyPreviewNote(
      'team.enemy.drifter',
      p,
      createStudioTeamFixture({ arena: 'relay-yard', scenario: 'victory' }).run,
    ),
    /hides enemy bodies/,
  );
  assert.equal(teamEnemyPreviewNote('team.enemy.slowed', p, f.run), null);
  assert.equal(teamEnemySlot({ type: 'hunter', phase: 'invented' }), null);
  assert.equal(teamEnemySlot({ type: 'hunter', phase: 'warning', active: false }), null);
  assert.equal(teamEnemyInheritance('team.enemy.slowed'), null);
});
test('malformed prepared enemy geometry is rejected before replacing the accepted painter', () => {
  const s = snapshot(),
    { canvas } = surface(),
    p = createCoopPainter(canvas);
  p.setPresentation(s);
  const id = 'team.enemy.hunter.warning';
  for (const alter of [
    (x) => delete x.images[id],
    (x) => (x.images[id].image.width = 31),
    (x) => (x.images[id].geometry.pivot.y = NaN),
    (x) => (x.images[id].geometry.rotors = [{ x: 4, y: 4 }]),
    (x) => (x.resolved.assets[id] = { kind: 'recipe', recipe: { id: 'team.pilot.v1' } }),
  ]) {
    const bad = snapshot();
    alter(bad);
    assert.throws(() => p.setPresentation(bad), /Team enemy/);
    assert.equal(p.presentation, s);
  }
  assert.equal(prepareTeamEnemies(null).size, 0);
});
test('explicit inheritance and historical absence use the documented shared body', () => {
  for (const declared of [false, true]) {
    const s = snapshot();
    s.resolved.assets = {};
    s.canvas.assets = {};
    for (const id of TEAM_ENEMY_SLOTS) {
      const shared = teamEnemyInheritance(id);
      s.images[shared] = s.images[id];
      delete s.images[id];
      if (declared) s.resolved.assets[id] = { kind: 'recipe', recipe: { id: 'team.enemy.v1' } };
    }
    const f = createStudioTeamFixture({ arena: 'first-connection', scenario: 'initial' }),
      { canvas } = surface(),
      p = createCoopPainter(canvas);
    p.setPresentation(s);
    p.paint(f.run);
    for (const e of f.run.enemies)
      assert.equal(p.actorFrame('enemy', e.id).sourceSlot, teamEnemyInheritance(teamEnemySlot(e)));
    assert.match(
      teamEnemyPreviewNote('team.enemy.drifter', p, f.run),
      /uses shared body enemy.bouncer/,
    );
  }
});
test('enemy registry upgrade retains immutable history and exact prompts for every role', () => {
  const old = structuredClone(defaults);
  old.slots = old.slots.filter((s) => !TEAM_ENEMY_SLOTS.includes(s.id));
  old.assets = old.assets.filter((a) => !TEAM_ENEMY_SLOTS.some((id) => a.id === `${id}.default`));
  for (const t of old.themes) for (const id of TEAM_ENEMY_SLOTS) delete t.bindings[id];
  const before = structuredClone(old),
    next = addTeamPresentationSlots(old);
  assert(needsTeamPresentationSlots(old));
  assert(!needsTeamPresentationSlots(next));
  assert.deepEqual(old, before);
  assert.equal(next.revision, old.revision + 1);
  for (const key of ['slots', 'assets', 'themes', 'collections'])
    for (const row of old[key])
      assert.deepEqual(
        next[key].find((x) => x.id === row.id && x.revision === row.revision),
        row,
      );
  for (const id of TEAM_ENEMY_SLOTS) {
    const slot = next.slots.find((s) => s.id === id);
    assert.equal(slot.dimensions.width, 32);
    assert.match(generateAssetPrompt(slot, resolvePresentation(next)), /Real hunter phases/);
  }
});
test('all five enemy bodies retain exact source bytes, pivot and optional rotor metadata through bundle export/import', async () => {
  const assets = [],
    bindings = {},
    blobs = new Map(),
    prior = resolvePresentation(defaults);
  for (const [index, id] of TEAM_ENEMY_SLOTS.entries()) {
    const slot = defaults.slots.find((s) => s.id === id),
      rgba = new Uint8Array(32 * 32 * 4);
    rgba.set([90 + index, 170, 220, 255], 132);
    const bytes = encodeSpritePNG({ width: 32, height: 32, rgba }),
      hash = await hashPresentationBytes(bytes);
    blobs.set(hash, new Blob([bytes], { type: 'image/png' }));
    const asset = {
      ...structuredClone(prior.assets[id]),
      id: `enemy-qa.${index}`,
      revision: 1,
      kind: 'image',
      recipe: null,
      geometry: {
        ...structuredClone(slot.geometry),
        pivot: { x: 0.45, y: 0.5 },
        rotorAnchors: [{ x: 0.25, y: 0.25, radius: 0.12, blades: 3 }],
      },
      file: { sha256: hash, bytes: bytes.length, mime: 'image/png', width: 32, height: 32 },
    };
    assets.push(asset);
    bindings[id] = { id: asset.id, revision: 1 };
  }
  const next = reviseStudioTheme(defaults, { assets, bindings }),
    restored = await importThemeBundle(await exportThemeBundle(next, blobs), { decodeImage: null }),
    resolved = resolvePresentation(restored.document);
  for (const [i, id] of TEAM_ENEMY_SLOTS.entries()) {
    assert.deepEqual(resolved.assets[id], assets[i]);
    const hash = assets[i].file.sha256;
    assert.deepEqual(
      new Uint8Array(await restored.assets.get(hash).arrayBuffer()),
      new Uint8Array(await blobs.get(hash).arrayBuffer()),
    );
    const geometry = imagePresentation(resolved.assets[id]);
    assert.equal(geometry.pivot.x, 0.45);
    assert.equal(geometry.rotors.length, 1);
  }
});

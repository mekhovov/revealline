import { createCoop, startCoop, stepCoop, FIXED_DT } from '../coop/core.mjs';
import { RELAY_YARD } from '../coop/relay-yard.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoopPainter } from '../couch/coop-view.mjs';
import {
  TEAM_PILOT_SLOTS,
  TEAM_PILOT_STATES,
  prepareTeamPilots,
  teamPilotSlot,
} from '../couch/coop-pilot-slots.mjs';
import { createStudioTeamFixture } from '../../authoring/asset-studio/team-preview-fixture.mjs';
import { teamPilotPreviewNote } from '../../authoring/asset-studio/cross-mode-preview.mjs';
import { imagePresentation } from '../presentation/runtime.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { resolvePresentation } from '../presentation/model.mjs';
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
  const images = {},
    assets = {};
  for (const id of TEAM_PILOT_SLOTS) {
    const slot = defaults.slots.find((s) => s.id === id),
      size = slot.dimensions.width;
    const rotors = slot.geometry.rotorAnchors.map((r, i) => ({
      x: r.x - 0.5,
      y: r.y - 0.5,
      radiusScale: r.radius / 0.16,
      direction: i % 2 ? -1 : 1,
      phaseDegrees: i * 23,
      bladeCount: r.blades,
    }));
    images[id] = {
      image: { id, width: size, height: size },
      geometry: {
        frame: { ...slot.geometry.frame },
        pivot: { x: 0.5, y: 0.5 },
        occupiedBounds: slot.geometry.occupiedBounds,
        rotors,
        nineSlice: null,
      },
    };
    assets[id] = { kind: 'image' };
  }
  return {
    images,
    resolved: { assets },
    canvas: { assets, palette, motionScale: 1 },
    fonts: { ui: 'Exo 2', numeric: 'IBM Plex Mono' },
    image: (id) => images[id] ?? null,
  };
}
function sceneFor(seat, state) {
  return {
    normal: 'initial',
    cutting: 'cutting',
    downed: `downed-p${seat}`,
    crawling: `crawling-p${seat}`,
    rescuing: `rescue-p${seat === 1 ? 2 : 1}`,
    recovery: `recovered-p${seat}`,
  }[state];
}
for (const seat of [1, 2])
  for (const state of TEAM_PILOT_STATES)
    for (const [treatment, width] of [
      ['compact', 390],
      ['detailed', 1152],
    ])
      test(`P${seat} ${state} ${treatment} selects its actual body without simulation writes`, () => {
        const f = createStudioTeamFixture({ arena: 'relay-yard', scenario: sceneFor(seat, state) }),
          s = snapshot(),
          { canvas, calls } = surface();
        canvas.clientWidth = width;
        const p = createCoopPainter(canvas),
          before = structuredClone(f.run),
          prior = f.previousRun;
        p.setPresentation(s);
        p.paint(f.run, { previousRun: prior, reduced: true });
        const id = teamPilotSlot(seat - 1, state, treatment),
          frame = p.actorFrame('pilot', seat - 1);
        assert.equal(frame.pilotState, state);
        assert.equal(frame.sourceSlot, id);
        assert.equal(frame.stateSlot, id);
        assert(calls.some((c) => c.method === 'drawImage' && c.args[0] === s.images[id].image));
        assert.match(teamPilotPreviewNote(id, p, f.run), /Showing the selected/);
        assert.deepEqual(f.run, before);
        assert(calls.some((c) => c.method === 'fillText' && c.args[0] === String(seat)));
        if (['downed', 'crawling'].includes(state)) {
          assert(frame.locked);
          assert(frame.stunned);
        }
        if (state === 'rescuing') assert.equal(frame.rescueTarget, seat === 1 ? 1 : 0);
      });
test('wrong-width/state/seat previews report inactive rather than claiming the selected image was drawn', () => {
  const f = createStudioTeamFixture({ arena: 'relay-yard', scenario: 'cutting' }),
    s = snapshot(),
    { canvas } = surface(),
    p = createCoopPainter(canvas);
  p.setPresentation(s);
  p.paint(f.run);
  assert.match(
    teamPilotPreviewNote('team.pilot.p1.downed.detailed', p, f.run),
    /inactive.*cutting/,
  );
  assert.match(teamPilotPreviewNote('team.pilot.p1.cutting.compact', p, f.run), /inactive/);
  p.paint(f.run, { actorStyle: 'microtile' });
  assert.equal(p.actorFrame('pilot', 0).sourceSlot, 'team.pilot.p1.cutting.compact');
  assert.match(
    teamPilotPreviewNote(
      'team.pilot.p1.normal.compact',
      p,
      createStudioTeamFixture({ arena: 'relay-yard', scenario: 'victory' }).run,
    ),
    /hides player bodies/,
  );
});
test('malformed custom pilot frames fail before replacing the accepted painter snapshot', () => {
  const s = snapshot(),
    { canvas } = surface(),
    p = createCoopPainter(canvas);
  p.setPresentation(s);
  const id = 'team.pilot.p2.crawling.detailed';
  for (const alter of [
    (x) => delete x.images[id],
    (x) => (x.images[id].image.width = 63),
    (x) => (x.images[id].geometry.pivot.x = 2),
    (x) => x.images[id].geometry.rotors.pop(),
    (x) => (x.images[id].geometry.rotors[0].radiusScale = 20),
    (x) => (x.images[id].geometry.rotors[0].x = NaN),
    (x) => (x.resolved.assets[id] = { kind: 'recipe', recipe: { id: 'team.rescue.v1' } }),
  ]) {
    const bad = snapshot();
    alter(bad);
    assert.throws(() => p.setPresentation(bad), /Team pilot/);
    assert.equal(p.presentation, s);
  }
});
test('explicit recipes inherit shared Scout images; historical absent state slots do the same', () => {
  for (const declared of [true, false]) {
    const s = snapshot();
    s.resolved.assets = {};
    s.canvas.assets = {};
    for (const id of TEAM_PILOT_SLOTS) {
      delete s.images[id];
      if (declared) s.resolved.assets[id] = { kind: 'recipe', recipe: { id: 'team.pilot.v1' } };
    }
    const source = snapshot().images['team.pilot.p1.normal.detailed'];
    s.images['player.scout.detailed'] = source;
    const f = createStudioTeamFixture({ arena: 'relay-yard', scenario: 'initial' }),
      { canvas } = surface(),
      p = createCoopPainter(canvas);
    p.setPresentation(s);
    p.paint(f.run);
    assert.equal(p.actorFrame('pilot', 0).sourceSlot, 'player.scout.detailed');
    assert.match(
      teamPilotPreviewNote('team.pilot.p1.normal.detailed', p, f.run),
      /uses shared body/,
    );
  }
  assert.equal(prepareTeamPilots(null).size, 0);
  assert.equal(teamPilotSlot(2, 'normal', 'compact'), null);
});
test('Team pilot upgrade preserves prior records and all24 body contracts have exact motors, dimensions and generation prompts', () => {
  const old = structuredClone(defaults);
  old.slots = old.slots.filter((s) => !TEAM_PILOT_SLOTS.includes(s.id));
  old.assets = old.assets.filter((a) => !TEAM_PILOT_SLOTS.some((id) => a.id === `${id}.default`));
  for (const t of old.themes) for (const id of TEAM_PILOT_SLOTS) delete t.bindings[id];
  const before = structuredClone(old),
    next = addTeamPresentationSlots(old);
  assert(needsTeamPresentationSlots(old));
  assert(!needsTeamPresentationSlots(next));
  assert.equal(next.revision, old.revision + 1);
  assert.deepEqual(old, before);
  for (const key of ['slots', 'assets', 'themes', 'collections'])
    for (const row of old[key])
      assert.deepEqual(
        next[key].find((x) => x.id === row.id && x.revision === row.revision),
        row,
      );
  for (const id of TEAM_PILOT_SLOTS) {
    const slot = next.slots.find((s) => s.id === id);
    assert.equal(slot.geometry.rotorAnchors.length, 4);
    assert.equal(slot.dimensions.width, id.endsWith('.compact') ? 32 : 64);
    assert.match(generateAssetPrompt(slot, resolvePresentation(next)), /four bounded motor hubs/);
  }
});
test('all24 bodies survive exact-byte bundle roundtrip with editable pivots and bounded rotors', async () => {
  const assets = [],
    bindings = {},
    blobs = new Map(),
    prior = resolvePresentation(defaults);
  for (const [index, id] of TEAM_PILOT_SLOTS.entries()) {
    const slot = defaults.slots.find((s) => s.id === id),
      size = slot.dimensions.width,
      rgba = new Uint8Array(size * size * 4);
    rgba.set([150, index + 50, 220, 255], (size + 1) * 4);
    const bytes = encodeSpritePNG({ width: size, height: size, rgba }),
      hash = await hashPresentationBytes(bytes);
    blobs.set(hash, new Blob([bytes], { type: 'image/png' }));
    const asset = {
      ...structuredClone(prior.assets[id]),
      id: `pilot-qa.${index}`,
      revision: 1,
      kind: 'image',
      recipe: null,
      geometry: { ...structuredClone(slot.geometry), pivot: { x: 0.45, y: 0.5 } },
      file: { sha256: hash, bytes: bytes.length, mime: 'image/png', width: size, height: size },
    };
    assets.push(asset);
    bindings[id] = { id: asset.id, revision: 1 };
  }
  const next = reviseStudioTheme(defaults, { assets, bindings }),
    bundle = await exportThemeBundle(next, blobs),
    restored = await importThemeBundle(bundle, { decodeImage: null }),
    resolved = resolvePresentation(restored.document);
  for (const [index, id] of TEAM_PILOT_SLOTS.entries()) {
    assert.deepEqual(resolved.assets[id], assets[index]);
    const hash = assets[index].file.sha256;
    assert.deepEqual(
      new Uint8Array(await restored.assets.get(hash).arrayBuffer()),
      new Uint8Array(await blobs.get(hash).arrayBuffer()),
    );
    const g = imagePresentation(resolved.assets[id]);
    assert.equal(g.rotors.length, 4);
    assert.equal(g.pivot.x, 0.45);
  }
});

for (const seat of [0, 1])
  test(`P${seat + 1} crawl and prior sample match independent public commands`, () => {
    const c = (direction = null, boost = true) => ({ direction, boost, support: false }),
      run = startCoop(createCoop(RELAY_YARD, { difficulty: 'standard', seed: 17 }));
    const moves = [
      [140, c('right'), c('left')],
      [70, c('up'), c('up')],
      [214, c('right'), c('left')],
      [24, seat === 0 ? c('left') : c(), seat === 1 ? c('right') : c()],
      [35, seat === 0 ? c('up') : c(), seat === 1 ? c('up') : c()],
      [12, seat === 0 ? c('left') : c(null, false), seat === 1 ? c('right') : c(null, false)],
    ];
    let prior;
    for (const [count, a, b] of moves)
      for (let i = 0; i < count; i++) {
        if (run.tick === 494) prior = structuredClone(run);
        stepCoop(run, [a, b], FIXED_DT);
      }
    const f = createStudioTeamFixture({ arena: 'relay-yard', scenario: `crawling-p${seat + 1}` });
    assert.deepEqual(f.run, run);
    assert.deepEqual(f.previousRun, { ...prior, level: f.run.level });
    assert.equal(f.run.players[seat].status, 'downed');
    assert.notEqual(f.run.players[seat].x, prior.players[seat].x);
    const damaged = f.previousRun;
    damaged.players[seat].x = -999;
    assert.deepEqual(f.previousRun, { ...prior, level: f.run.level });
    const s = snapshot(),
      { canvas } = surface(),
      p = createCoopPainter(canvas);
    p.setPresentation(s);
    p.paint(f.run, { previousRun: f.previousRun });
    assert.equal(p.actorFrame('pilot', seat).pilotState, 'crawling');
    for (let i = 0; i < 50; i++) f.advance(FIXED_DT);
    f.reset();
    p.paint(f.run, { previousRun: f.previousRun });
    assert.equal(p.actorFrame('pilot', seat).pilotState, 'crawling');
  });

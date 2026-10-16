import { pauseCoop } from '../coop/core.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TEAM_RESCUE_SLOTS,
  prepareTeamRescue,
  teamRescueProgress,
} from '../couch/coop-rescue-presentation.mjs';
import { createCoopPainter } from '../couch/coop-view.mjs';
import { createStudioTeamFixture } from '../../authoring/asset-studio/team-preview-fixture.mjs';
import { teamRescuePreviewNote } from '../../authoring/asset-studio/cross-mode-preview.mjs';
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
    TEAM_RESCUE_SLOTS.map((id) => {
      const size = 32;
      return [
        id,
        { image: { id, width: size, height: size }, geometry: { pivot: { x: 0.5, y: 0.5 } } },
      ];
    }),
  );
  const assets = Object.fromEntries(TEAM_RESCUE_SLOTS.map((id) => [id, { kind: 'image' }]));
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

for (const seat of [1, 2])
  for (const [phase, slot] of [
    ['rescue', 'team.rescue.progress'],
    ['recovered', 'team.player.recovery'],
  ])
    test(`player ${seat} ${phase} uses real state and preserves fixed identity cues`, () => {
      const fixture = createStudioTeamFixture({
          arena: 'relay-yard',
          scenario: `${phase}-p${seat}`,
        }),
        before = structuredClone(fixture.run),
        s = snapshot(),
        { canvas, calls } = surface(),
        painter = createCoopPainter(canvas);
      painter.setPresentation(s);
      painter.paint(fixture.run, { reduced: true });
      const images = calls.filter((c) => c.method === 'drawImage');
      assert.equal(images.length, 1);
      assert.equal(images[0].args[0], s.images[slot].image);
      assert.equal(images[0].alpha, 0.18);
      const player =
        phase === 'rescue'
          ? fixture.run.players.find((p) => p.rescue)
          : fixture.run.players[seat - 1];
      assert.deepEqual(images[0].args.slice(1), [player.x - 1, player.y - 1, 2, 2]);
      const labels = calls.filter((c) => c.method === 'fillText').map((c) => c.args[0]);
      assert(labels.includes('1'));
      assert(labels.includes('2'));
      if (phase === 'rescue') {
        const state = teamRescueProgress(fixture.run, player);
        assert.equal(state.target, seat - 1);
        assert(state.progress > 0 && state.progress < 1);
        assert.equal(state.progress, fixture.run.time - player.rescue.startedAt);
        const text = `RESCUE ${seat} · ${Math.floor(state.progress * 100)}%`;
        assert(labels.includes(text));
        assert.match(teamRescuePreviewNote(fixture.run), new RegExp(`rescuing player ${seat}:`));
        assert(
          calls.findIndex((c) => c.method === 'drawImage') <
            calls.findIndex((c) => c.method === 'fillText' && c.args[0] === text),
        );
      } else {
        assert(player.graceUntil > fixture.run.time);
        assert.match(
          teamRescuePreviewNote(fixture.run),
          new RegExp(`Recovery grace: player ${seat}`),
        );
        assert(calls.some((c) => c.method === 'arc' && c.args[2] === 0.95));
      }
      assert.deepEqual(fixture.run, before);
      const bad = snapshot();
      bad.images['team.player.recovery'].image.width = 31;
      assert.throws(() => painter.setPresentation(bad), /32×32 centered/);
      assert.equal(painter.presentation, s);
      calls.length = 0;
      painter.paint(fixture.run, { reduced: true });
      assert.equal(calls.find((c) => c.method === 'drawImage').args[0], s.images[slot].image);
    });
test('decoration is below shared actor artwork; normal and reduced modes use the same actual rescue percentage', () => {
  const s = snapshot(),
    image = { id: 'pilot', width: 64, height: 64 };
  s.images['player.scout.detailed'] = {
    image,
    geometry: {
      pivot: { x: 0.5, y: 0.5 },
      frame: { x: 0, y: 0, width: 64, height: 64 },
      occupied: { x: 0, y: 0, width: 64, height: 64 },
      rotors: [],
    },
  };
  const fixture = createStudioTeamFixture({ arena: 'relay-yard', scenario: 'rescue-p1' }),
    { canvas, calls } = surface(),
    painter = createCoopPainter(canvas);
  painter.setPresentation(s);
  painter.paint(fixture.run);
  const order = calls.filter((c) => c.method === 'drawImage').map((c) => c.args[0].id);
  assert.equal(order[0], 'team.rescue.progress');
  assert(order.includes('pilot'));
  const label = calls.find((c) => c.method === 'fillText' && String(c.args[0]).includes('RESCUE'))
    .args[0];
  calls.length = 0;
  painter.paint(fixture.run, { reduced: true });
  assert(calls.some((c) => c.method === 'fillText' && c.args[0] === label));
});
test('historical frames stay procedural; inactive and completed scenes show no custom rescue decoration', () => {
  assert.deepEqual(prepareTeamRescue(null), {});
  for (const scenario of ['initial', 'downed-p1', 'victory']) {
    const s = snapshot(),
      { canvas, calls } = surface(),
      painter = createCoopPainter(canvas),
      run = createStudioTeamFixture({ arena: 'relay-yard', scenario }).run;
    painter.setPresentation(s);
    painter.paint(run);
    assert(!calls.some((c) => c.method === 'drawImage'));
  }
  const s = snapshot();
  s.resolved.assets = {};
  s.canvas.assets = {};
  const { canvas, calls } = surface(),
    painter = createCoopPainter(canvas),
    run = createStudioTeamFixture({ arena: 'relay-yard', scenario: 'recovered-p1' }).run;
  painter.setPresentation(s);
  painter.paint(run);
  assert(!calls.some((c) => c.method === 'drawImage'));
  assert(calls.some((c) => c.method === 'arc' && c.args[2] === 0.95));
  for (const mutate of [
    (s) => delete s.images['team.rescue.progress'],
    (s) => (s.images['team.player.recovery'].geometry.pivot.x = 0),
    (s) =>
      (s.resolved.assets['team.rescue.progress'] = {
        kind: 'recipe',
        recipe: { id: 'team.core.v1' },
      }),
    (s) => (s.resolved.assets['team.player.recovery'] = { kind: 'font' }),
  ]) {
    const s = snapshot();
    mutate(s);
    assert.throws(() => prepareTeamRescue(s), /Team rescue/);
  }
  assert.match(
    teamRescuePreviewNote(
      createStudioTeamFixture({ arena: 'relay-yard', scenario: 'victory' }).run,
    ),
    /hides rescue/,
  );
});
test('released contact rescue state disappears on real pause and returns only through public commands', () => {
  const fixture = createStudioTeamFixture({ arena: 'relay-yard', scenario: 'rescue-p2' }),
    player = fixture.run.players.find((p) => p.rescue);
  assert(teamRescueProgress(fixture.run, player));
  pauseCoop(fixture.run);
  assert.equal(teamRescueProgress(fixture.run, player), null);
  fixture.reset();
  assert(fixture.run.players.some((p) => teamRescueProgress(fixture.run, p)));
});
test('full Team upgrade adds rescue slots atomically without replacing existing roles or exact historical revisions', () => {
  const old = structuredClone(createDefaultThemeBundle());
  old.slots = old.slots.filter((s) => !TEAM_RESCUE_SLOTS.includes(s.id));
  old.assets = old.assets.filter((a) => !TEAM_RESCUE_SLOTS.some((id) => a.id === `${id}.default`));
  for (const t of old.themes) for (const id of TEAM_RESCUE_SLOTS) delete t.bindings[id];
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
  ['team.rescue.progress', 32],
  ['team.player.recovery', 32],
])
  test(`Rescue ${id} preserves uploaded original bytes and history in bundle round trips`, async () => {
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
      id: 'rescue-upload',
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
    assert.match(generateAssetPrompt(slot, resolvePresentation(next)), /rescue/);
  });

for (const seat of [1, 2])
  test(`recovered player ${seat} advances through actual grace expiry before reset`, () => {
    const fixture = createStudioTeamFixture({
      arena: 'relay-yard',
      scenario: `recovered-p${seat}`,
    });
    const at = fixture.run.tick;
    assert(fixture.run.players[seat - 1].graceUntil > fixture.run.time);
    for (let i = 0; i < 350; i++) fixture.advance(1 / 120);
    assert.equal(fixture.run.tick, at + 350);
    assert(fixture.run.players[seat - 1].graceUntil <= fixture.run.time);
    assert.match(teamRescuePreviewNote(fixture.run), /No recovery grace/);
    const s = snapshot(),
      { canvas, calls } = surface(),
      painter = createCoopPainter(canvas);
    painter.setPresentation(s);
    painter.paint(fixture.run);
    assert(!calls.some((c) => c.method === 'drawImage'));
    fixture.reset();
    assert.equal(fixture.run.tick, at);
    assert(fixture.run.players[seat - 1].graceUntil > fixture.run.time);
  });

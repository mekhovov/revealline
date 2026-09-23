import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TEAM_CORE_SLOTS,
  prepareTeamCores,
  teamCoreState,
  drawTeamCoreCue,
} from '../couch/coop-core-presentation.mjs';
import { createCoopPainter } from '../couch/coop-view.mjs';
import { createStudioTeamFixture } from '../../authoring/asset-studio/team-preview-fixture.mjs';
import { teamObjectivePreviewNote } from '../../authoring/asset-studio/cross-mode-preview.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import {
  addTeamObjectiveSlots,
  addTeamAnchorSlots,
  needsTeamObjectiveSlots,
} from '../presentation/team-anchor-upgrade.mjs';
import { TEAM_ANCHOR_SLOTS } from '../couch/coop-anchor-presentation.mjs';
import { validateThemeBundle, resolvePresentation } from '../presentation/model.mjs';
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
    [...TEAM_CORE_SLOTS, 'enemy.relay-sentinel'].map((id) => [
      id,
      { image: { id, width: 64, height: 64 }, geometry: { pivot: { x: 0.5, y: 0.5 } } },
    ]),
  );
  const assets = Object.fromEntries(TEAM_CORE_SLOTS.map((id) => [id, { kind: 'image' }]));
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
test('ongoing two-relay specimen paints selected secured and shielded bodies with game-owned labels', () => {
  const { run } = createStudioTeamFixture({ arena: 'relay-yard', scenario: 'secured' });
  const before = structuredClone(run),
    s = snapshot(),
    { canvas, calls } = surface();
  for (const id of TEAM_ANCHOR_SLOTS) {
    s.images[id] = {
      image: { id, width: 24, height: 24 },
      geometry: { pivot: { x: 0.5, y: 0.5 } },
    };
    s.resolved.assets[id] = { kind: 'image' };
  }
  const painter = createCoopPainter(canvas);
  painter.setPresentation(s);
  painter.paint(run, { reduced: true, picture: null });
  const coreBodies = calls.filter(
    (c) => c.method === 'drawImage' && c.args[0].id?.startsWith('team.core.'),
  );
  assert.deepEqual(
    coreBodies.map((c) => c.args[0].id),
    ['team.core.secured', 'team.core.shielded'],
  );
  assert.ok(coreBodies.every((c) => c.alpha === 1));
  for (const label of ['1 SECURED', '2 SHIELD', '2A', '2B'])
    assert.ok(calls.some((c) => c.method === 'fillText' && c.args[0] === label));
  const anchors = calls.filter(
    (c) => c.method === 'drawImage' && c.args[0].id?.startsWith('team.anchor.'),
  );
  assert.deepEqual(
    anchors.map((c) => c.args[0].id),
    [
      'team.anchor.captured',
      'team.anchor.captured',
      'team.anchor.available',
      'team.anchor.available',
    ],
  );
  assert.match(teamObjectivePreviewNote('team.core.secured', run), /^Showing 1 secured core/);
  assert.match(teamObjectivePreviewNote('team.core.shielded', run), /^Showing 1 shielded core/);
  assert.match(teamObjectivePreviewNote('team.core.exposed', run), /inactive/);
  assert.deepEqual(run, before);
});
for (const [scenario, state] of [
  ['initial', 'shielded'],
  ['core', 'exposed'],
  ['victory', 'secured'],
])
  test(`real ${scenario} state selects the ${state} core without changing the run`, () => {
    const { run } = createStudioTeamFixture({ arena: 'relay-yard', scenario }),
      before = structuredClone(run),
      s = snapshot(),
      { canvas, calls } = surface(),
      painter = createCoopPainter(canvas);
    assert.equal(teamCoreState(run.strongholds[0]), state);
    painter.setPresentation(s);
    painter.paint(run, { reduced: true });
    const draw = calls.find(
      (c) => c.method === 'drawImage' && c.args[0].id?.startsWith('team.core.'),
    );
    assert.equal(draw?.args[0], s.images[`team.core.${state}`].image);
    assert.equal(draw.alpha, 1, 'An authored secured body retains its approved opacity.');
    const status = { shielded: 'SHIELD', exposed: 'CAPTURE', secured: 'SECURED' }[state];
    assert(calls.some((c) => c.method === 'fillText' && c.args[0] === status));
    assert.deepEqual(run, before);
    const bad = snapshot();
    bad.images['team.core.exposed'].image.width = 65;
    assert.throws(() => painter.setPresentation(bad), /64×64/);
    calls.length = 0;
    painter.paint(run, { reduced: true });
    assert.equal(
      calls.find((c) => c.method === 'drawImage' && c.args[0].id?.startsWith('team.core.'))
        ?.args[0],
      s.images[`team.core.${state}`].image,
    );
  });
test('completed picture replaces the core, and preview messages never claim hidden objectives are visible', () => {
  const { run } = createStudioTeamFixture({ arena: 'relay-yard', scenario: 'victory' }),
    s = snapshot(),
    { canvas, calls } = surface(),
    painter = createCoopPainter(canvas),
    picture = { width: 1152, height: 576, id: 'earned-picture' };
  painter.setPresentation(s);
  painter.paint(run, {
    picture: {
      snapshot: s,
      image: picture,
      fit: 'contain',
      sampling: 'nearest',
      choice: { kind: 'image', levelId: run.level.id, levelRevision: run.level.revision },
    },
  });
  assert.deepEqual(
    calls.filter((c) => c.method === 'drawImage').map((c) => c.args[0]),
    [picture],
  );
  for (const id of [...TEAM_ANCHOR_SLOTS, ...TEAM_CORE_SLOTS])
    assert.match(teamObjectivePreviewNote(id, run), /artwork is hidden/);
  assert.equal(teamObjectivePreviewNote('player.scout.compact', run), null);
  const initial = createStudioTeamFixture({ arena: 'relay-yard', scenario: 'initial' }).run;
  assert.match(teamObjectivePreviewNote('team.core.shielded', initial), /Showing 1 shielded core/);
  assert.match(teamObjectivePreviewNote('team.core.secured', initial), /inactive/);
});
test('old core snapshots preserve the shared body and secured opacity; malformed new bindings fail', () => {
  const s = snapshot();
  s.resolved.assets = {};
  s.canvas.assets = {};
  assert.deepEqual(prepareTeamCores(s), {});
  const { run } = createStudioTeamFixture({ arena: 'relay-yard', scenario: 'victory' }),
    { canvas, calls } = surface(),
    painter = createCoopPainter(canvas);
  painter.setPresentation(s);
  painter.paint(run, { reduced: true });
  const draw = calls.find((c) => c.method === 'drawImage');
  assert.equal(draw.args[0].id, 'enemy.relay-sentinel');
  assert.equal(draw.alpha, 0.45);
  for (const mutate of [
    (s) => delete s.images['team.core.exposed'],
    (s) => (s.images['team.core.exposed'].geometry.pivot.x = 0),
    (s) =>
      (s.resolved.assets['team.core.exposed'] = {
        kind: 'recipe',
        recipe: { id: 'team.anchor.v1' },
      }),
  ]) {
    const s = snapshot();
    mutate(s);
    assert.throws(() => prepareTeamCores(s), /Team core/);
  }
});
test('one objective upgrade appends only missing core states and preserves an anchor-only upgrade', () => {
  const old = structuredClone(createDefaultThemeBundle()),
    ids = [...TEAM_ANCHOR_SLOTS, ...TEAM_CORE_SLOTS];
  old.slots = old.slots.filter((s) => !ids.includes(s.id));
  old.assets = old.assets.filter((a) => !ids.some((id) => a.id === `${id}.default`));
  for (const t of old.themes) for (const id of ids) delete t.bindings[id];
  const historic = validateThemeBundle(old),
    anchors = addTeamAnchorSlots(historic),
    before = structuredClone(anchors),
    next = addTeamObjectiveSlots(anchors);
  assert(needsTeamObjectiveSlots(anchors));
  assert(!needsTeamObjectiveSlots(next));
  assert.equal(next.revision, anchors.revision + 1);
  for (const id of TEAM_ANCHOR_SLOTS)
    assert.deepEqual(resolvePresentation(next).assets[id], resolvePresentation(anchors).assets[id]);
  for (const id of TEAM_CORE_SLOTS) {
    const slot = next.slots.find((s) => s.id === id);
    assert.equal(slot.dimensions.width, 64);
    assert.equal(slot.required, false);
    assert.equal(resolvePresentation(next).assets[id].recipe.id, 'team.core.v1');
  }
  for (const kind of ['slots', 'assets', 'themes', 'collections'])
    for (const row of anchors[kind])
      assert.deepEqual(
        next[kind].find((r) => r.id === row.id && r.revision === row.revision),
        row,
      );
  assert.deepEqual(anchors, before);
  assert.throws(() => addTeamObjectiveSlots(next), /already available/);
});

test('core image keeps its center readable while recipe and historical status dots remain', () => {
  for (const state of ['shielded', 'exposed', 'secured']) {
    const stronghold = {
      core: { x: 12, y: 8 },
      shielded: state === 'shielded',
      defeated: state === 'secured',
    };
    for (const kind of ['image', 'recipe', 'historical']) {
      const { canvas, calls } = surface();
      const frames = kind === 'historical' ? {} : { [`team.core.${state}`]: { kind } };
      const before = structuredClone(stronghold);
      drawTeamCoreCue(canvas.getContext('2d'), frames, stronghold, palette);
      assert.equal(
        calls.filter((c) => c.method === 'stroke').length,
        kind === 'image' ? 2 : 1,
        'state boundary is retained',
      );
      assert.equal(
        calls.filter((c) => c.method === 'fill').length,
        kind === 'image' ? 0 : 1,
        `${state} ${kind}: solid dot must not hide authored image`,
      );
      assert.deepEqual(stronghold, before);
    }
  }
});

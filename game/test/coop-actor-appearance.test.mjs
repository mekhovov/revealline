import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCoop } from '../coop/core.mjs';
import { RELAY_YARD } from '../coop/relay-yard.mjs';
import { imagePresentation } from '../presentation/runtime.mjs';
import { createCoopPainter, TEAM_ACTOR_APPEARANCE_SLOTS } from '../couch/coop-view.mjs';

const compiled = JSON.parse(
  await readFile(new URL('../presentation/compiled/runtime.json', import.meta.url)),
);
const palette = Object.freeze({
  ink: '#f6f3e8',
  paper: '#071527',
  muted: '#a8b8cc',
  accent: '#ffd64a',
  safe: '#67aaff',
  danger: '#ff7169',
  field: '#10243e',
  grid: '#182b43',
  sky: '#233950',
  land: '#526e67',
});

// Prepared-object command tests, not PNG decode, visual review or source approval.
function prepared(label, { replacements = {}, omit = null, poisonWorld = false } = {}) {
  const assets = { ...compiled.resolved.assets },
    images = new Map();
  let closed = 0;
  for (const [slot, source] of Object.entries(replacements)) {
    assets[slot] = { ...assets[source], id: `${label}.${slot}` };
  }
  if (omit) delete assets[omit];
  for (const [slot, asset] of Object.entries(assets)) {
    if (asset.kind !== 'image') continue;
    images.set(slot, {
      asset,
      image: {
        label,
        slot,
        width: asset.file.width,
        height: asset.file.height,
        close: () => closed++,
      },
      geometry: imagePresentation(asset),
    });
  }
  const snapshot = {
    resolved: { ...compiled.resolved, assets },
    get canvas() {
      if (poisonWorld) throw new Error('Actor-only canvas must not be read.');
      return { palette, motionScale: 1 };
    },
    get fonts() {
      if (poisonWorld) throw new Error('Actor-only fonts must not be read.');
      return { ui: 'World UI', numeric: 'World Numbers' };
    },
    image: (slot) => images.get(slot) ?? null,
  };
  return { snapshot, images, closed: () => closed };
}

function surface() {
  const calls = [],
    stack = [];
  let values = { globalAlpha: 1, imageSmoothingEnabled: true };
  const ctx = new Proxy(
    {},
    {
      get(_, name) {
        if (name in values) return values[name];
        return (...args) => {
          calls.push({ name, args, state: { ...values } });
          if (name === 'save') stack.push({ ...values });
          if (name === 'restore') values = stack.pop();
        };
      },
      set(_, name, value) {
        values[name] = value;
        return true;
      },
    },
  );
  return {
    calls,
    stack,
    canvas: { width: 1152, height: 576, clientWidth: 1152, getContext: () => ctx },
  };
}

const drawImages = (view) => view.calls.filter(({ name }) => name === 'drawImage');
const labels = (view) =>
  view.calls.filter(({ name }) => name === 'fillText').map(({ args }) => args[0]);

test('Team FPV changes only actor image identities, not whole presentation commands or state', () => {
  const world = prepared('world'),
    fpv = prepared('fpv', { poisonWorld: true });
  const run = createCoop(RELAY_YARD),
    before = structuredClone(run);
  const historical = surface(),
    selected = surface();
  const oldPainter = createCoopPainter(historical.canvas),
    painter = createCoopPainter(selected.canvas);
  oldPainter.setPresentation(world.snapshot);
  painter.setPresentation(world.snapshot);
  oldPainter.paint(run, { reduced: true });
  painter.paint(run, { reduced: true, actorAppearance: { style: 'fpv', snapshot: fpv.snapshot } });
  assert(drawImages(selected).some(({ args }) => args[0].label === 'fpv'));
  assert(
    drawImages(selected).some(
      ({ args }) => args[0].slot.startsWith('team.anchor.') && args[0].label === 'world',
    ),
  );
  const normalized = selected.calls.map((call) =>
    call.name === 'drawImage' && call.args[0].label === 'fpv'
      ? { ...call, args: [world.images.get(call.args[0].slot).image, ...call.args.slice(1)] }
      : call,
  );
  assert.deepEqual(
    normalized,
    historical.calls,
    'Every non-actor command keeps exact world values.',
  );
  assert.equal(painter.presentation, world.snapshot);
  assert.deepEqual(run, before);
  assert.equal(selected.stack.length, 0);
  assert.equal(world.closed() + fpv.closed(), 0, 'The painter never disposes borrowed resources.');
});

for (const hasWorld of [false, true]) {
  test(`Team campaign option exactly preserves historical commands (world ${hasWorld})`, () => {
    const run = createCoop(RELAY_YARD),
      world = prepared('world');
    const old = surface(),
      selected = surface();
    const oldPainter = createCoopPainter(old.canvas),
      painter = createCoopPainter(selected.canvas);
    if (hasWorld) {
      oldPainter.setPresentation(world.snapshot);
      painter.setPresentation(world.snapshot);
    }
    oldPainter.paint(run, { reduced: true });
    painter.paint(run, {
      reduced: true,
      actorAppearance: {
        style: 'campaign',
        snapshot: {
          image() {
            throw new Error('Campaign must ignore a separate actor snapshot.');
          },
        },
      },
    });
    assert.deepEqual(selected.calls, old.calls);
    assert.deepEqual(painter.actorFrame('pilot', 0), oldPainter.actorFrame('pilot', 0));
  });
}

test('Team actor-only FPV also works without a world presentation and leaves its default field', () => {
  const view = surface(),
    painter = createCoopPainter(view.canvas),
    run = createCoop(RELAY_YARD);
  const before = structuredClone(run),
    fpv = prepared('fpv', { poisonWorld: true });
  painter.paint(run, { reduced: true, actorAppearance: { style: 'fpv', snapshot: fpv.snapshot } });
  assert.equal(painter.presentation, null);
  assert(drawImages(view).some(({ args }) => args[0].label === 'fpv'));
  assert(
    view.calls.some(
      ({ name, state, args }) =>
        name === 'fillRect' && state.fillStyle === '#0a202b' && args[2] === 72,
    ),
  );
  assert.deepEqual(run, before);
});

test('selected Team state artwork wins generic fallbacks and does not inherit campaign actor overrides', () => {
  const replacements = {
    'team.pilot.p1.downed.detailed': 'player.scout.detailed',
    'team.pilot.p2.rescuing.detailed': 'player.scout.detailed',
    'team.enemy.drifter': 'enemy.bouncer',
    'team.enemy.hunter.warning': 'enemy.border-patrol',
  };
  const world = prepared('campaign-custom', { replacements }),
    fpv = prepared('selected-custom', { replacements, poisonWorld: true });
  const run = createCoop(RELAY_YARD);
  run.status = 'running';
  run.players[0].status = 'downed';
  run.players[1].rescue = { target: 0, startedAt: 0, progress: 0.5 };
  const hunter = run.enemies.find((enemy) => enemy.type === 'hunter');
  Object.assign(hunter, { phase: 'warning', target: 1, targetPoint: { x: 40, y: 20 } });
  const before = structuredClone(run),
    view = surface(),
    painter = createCoopPainter(view.canvas);
  painter.setPresentation(world.snapshot);
  painter.paint(run, { reduced: true, actorAppearance: { style: 'fpv', snapshot: fpv.snapshot } });
  for (const slot of [...Object.keys(replacements), 'team.core.shielded']) {
    assert(
      drawImages(view).some(({ args }) => args[0] === fpv.images.get(slot).image),
      slot,
    );
    assert(
      !drawImages(view).some(({ args }) => args[0] === world.images.get(slot).image),
      `No campaign override for ${slot}.`,
    );
  }
  assert.equal(painter.actorFrame('pilot', 0).pilotState, 'downed');
  assert.equal(painter.actorFrame('pilot', 1).pilotState, 'rescuing');
  assert.equal(painter.actorFrame('pilot', 1).rescueTarget, 0);
  for (const label of ['1', '+', '2', 'SHIELD', 'LOCK 2'])
    assert(labels(view).includes(label), label);
  assert.deepEqual(run, before);
});

test('Team FPV failures occur before paint and preserve the previous actor/picture owner', () => {
  const world = prepared('world'),
    fpv = prepared('fpv');
  const run = createCoop(RELAY_YARD),
    before = structuredClone(run);
  const view = surface(),
    painter = createCoopPainter(view.canvas);
  painter.setPresentation(world.snapshot);
  painter.paint(run, { reduced: true });
  const previousFrame = painter.actorFrame('pilot', 0);
  for (const actorAppearance of [
    { style: 'unknown', snapshot: fpv.snapshot },
    { style: 'fpv', snapshot: null },
    { style: 'fpv', snapshot: {} },
    {
      style: 'fpv',
      snapshot: prepared('incomplete', { omit: 'team.pilot.p2.downed.compact' }).snapshot,
    },
    {
      style: 'fpv',
      snapshot: {
        ...fpv.snapshot,
        image: (slot) => (slot === 'enemy.claimed-rover' ? null : fpv.snapshot.image(slot)),
      },
    },
    {
      style: 'fpv',
      snapshot: {
        ...fpv.snapshot,
        image: (slot) =>
          slot === 'player.scout.detailed'
            ? { ...fpv.images.get(slot), geometry: {} }
            : fpv.snapshot.image(slot),
      },
    },
  ]) {
    const count = view.calls.length;
    assert.throws(() => painter.paint(run, { actorAppearance }), /actor appearance/i);
    assert.equal(view.calls.length, count);
    assert.equal(painter.actorFrame('pilot', 0), previousFrame);
    assert.equal(painter.presentation, world.snapshot);
  }
  assert.deepEqual(run, before);
});

test('FPV validation cannot be bypassed by reusing the whole presentation identity', () => {
  const incomplete = prepared('world', { omit: 'enemy.claimed-rover' });
  const run = createCoop(RELAY_YARD),
    view = surface(),
    painter = createCoopPainter(view.canvas);
  painter.setPresentation(incomplete.snapshot);
  assert.throws(
    () => painter.paint(run, { actorAppearance: { style: 'fpv', snapshot: incomplete.snapshot } }),
    /actor appearance/i,
  );
  assert.equal(view.calls.length, 0);
});

test('actor-only FPV cannot replace the whole picture validation owner', () => {
  const world = prepared('world'),
    fpv = prepared('fpv');
  const run = createCoop(RELAY_YARD),
    view = surface(),
    painter = createCoopPainter(view.canvas);
  painter.setPresentation(world.snapshot);
  const picture = {
    snapshot: fpv.snapshot,
    choice: { levelId: run.level.id, levelRevision: run.level.revision, kind: 'procedural' },
    image: null,
    fit: 'contain',
    sampling: 'nearest',
  };
  assert.throws(
    () =>
      painter.paint(run, { picture, actorAppearance: { style: 'fpv', snapshot: fpv.snapshot } }),
    /picture/i,
  );
  assert.equal(view.calls.length, 0);
  picture.snapshot = world.snapshot;
  painter.paint(run, { picture, actorAppearance: { style: 'fpv', snapshot: fpv.snapshot } });
  assert.equal(painter.presentation, world.snapshot);
});

test('Team actor appearance slot contract includes both pilot treatments and all state families', () => {
  assert.equal(new Set(TEAM_ACTOR_APPEARANCE_SLOTS).size, TEAM_ACTOR_APPEARANCE_SLOTS.length);
  for (const slot of [
    'player.scout.compact',
    'enemy.claimed-rover',
    'team.pilot.p2.rescuing.detailed',
    'team.pilot.p1.downed.compact',
    'team.enemy.hunter.recovery',
    'team.core.secured',
  ]) {
    assert(TEAM_ACTOR_APPEARANCE_SLOTS.includes(slot), slot);
  }
  assert(
    TEAM_ACTOR_APPEARANCE_SLOTS.every(
      (slot) => !slot.startsWith('terrain.') && !slot.startsWith('team.anchor.'),
    ),
  );
});

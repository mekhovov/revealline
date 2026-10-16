import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { importThemeBundle } from '../presentation/bundle.mjs';
import { resolvePresentation } from '../presentation/model.mjs';
import { imagePresentation } from '../presentation/runtime.mjs';
import { sampleActorAnimation } from '../presentation/actor-animation.mjs';
import {
  createActorDefeatPresentation,
  ACTOR_DEFEAT_LIMITS,
} from '../ui/actor-defeat-presentation.mjs';
import { createActorPresentation } from '../ui/actor-presentation.mjs';
import { createCoopActorPresentation } from '../couch/coop-actor-presentation.mjs';
import { createCoopPainter } from '../couch/coop-view.mjs';
import { createCoop, startCoop, stepCoop, FIXED_DT } from '../coop/core.mjs';
import { createRun, stepRun } from '../core/index.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { createHuntDestruction } from '../hunt/destruction.mjs';
import { createDestructionBudget, huntDestructionBudget } from '../hunt/destruction-budget.mjs';

const bundle = await importThemeBundle(
  new Blob([
    await readFile(
      new URL(
        '../../authoring/industrial-art-review/atlas-sample/industrial-bouncer.rltheme',
        import.meta.url,
      ),
    ),
  ]),
  { decodeImage: null },
);
const geometry = imagePresentation(resolvePresentation(bundle.document).assets['enemy.bouncer']);
const sprite = { image: { width: 128, height: 96 }, geometry };
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
const snapshot = {
  resolved: { assets: {} },
  canvas: { assets: {}, palette, motionScale: 1 },
  fonts: { ui: 'Exo 2', numeric: 'IBM Plex Mono' },
  image: (id) => (['enemy.relay-sentinel', 'enemy.border-patrol'].includes(id) ? sprite : null),
};
const caughtRegion = (timeMs = 0, reducedEffects = false) => {
  const { x, y, width, height } = sampleActorAnimation(geometry.animation, {
    clip: 'caught',
    timeMs,
    reducedEffects,
  }).region;
  return [x, y, width, height];
};
function surface() {
  const calls = [],
    state = { globalAlpha: 1 },
    stack = [];
  const canvas = { width: 1152, height: 576, clientWidth: 1152 };
  const ctx = new Proxy(
    { canvas },
    {
      get(target, key) {
        if (key in target) return target[key];
        if (key in state) return state[key];
        return (...args) => {
          calls.push({ key, args });
          if (key === 'save') stack.push({ ...state });
          if (key === 'restore') Object.assign(state, stack.pop());
          if (key === 'measureText') return { width: String(args[0]).length * 0.5 };
        };
      },
      set(_, key, value) {
        state[key] = value;
        return true;
      },
    },
  );
  canvas.getContext = () => ctx;
  return { ctx, canvas, calls };
}
const draws = (view) =>
  view.calls.filter(({ key, args }) => key === 'drawImage' && args[0] === sprite.image);
const command = (direction = null) => ({ direction, boost: false, support: false });
function teamRun() {
  return startCoop(
    createCoop({
      version: 'revealline-coop-level.v1',
      id: 'caught-atlas-team',
      revision: 1,
      name: 'Native enclosure fixture',
      width: 72,
      height: 36,
      spawns: [
        { x: 20.5, y: 0.5 },
        { x: 55.5, y: 35.5 },
      ],
      safeRects: [],
      walls: [],
      enemies: [
        { id: 'keeper', type: 'drifter', x: 60.5, y: 28.5, vx: 0, vy: 0, radius: 0.2 },
        { id: 'hunter', type: 'hunter', x: 20.5, y: 2.5, vx: 0, vy: 0, radius: 0.2 },
      ],
      goal: { coverage: 0.99 },
      rules: { moveSpeed: 10, boostMultiplier: 1.5 },
    }),
  );
}
function earnTeamCatch(run, observe) {
  for (let i = 0; i < 460; i++) {
    stepCoop(run, [command('down'), command()], FIXED_DT);
    observe(run);
    if (run.events.some((event) => event.type === 'enemy.defeated')) return;
  }
  assert.fail(
    JSON.stringify({
      status: run.status,
      tick: run.tick,
      coverage: run.coverage,
      players: run.players.map(({ x, y, status }) => ({ x, y, status })),
      enemies: run.enemies,
      events: run.events,
    }),
  );
}

test('Team native enclosure samples caught once; pause, Reduced, replacement and rewind stay cosmetic', async () => {
  let clock = 0;
  const run = teamRun(),
    helper = createActorDefeatPresentation({ kind: 'team', now: () => clock });
  const actor = run.enemies.find((entry) => entry.id === 'hunter');
  const frame = createActorPresentation().sample([actor]).get(actor.id);
  helper.bind(run);
  earnTeamCatch(run, (state) => helper.observe(state, state.events, () => ({ frame, sprite })));
  assert.equal(run.events.find((event) => event.type === 'enemy.defeated').tick, run.tick - 1);
  const before = structuredClone(run),
    view = surface();
  helper.observe(run, run.events, () => ({ frame, sprite }));
  assert.equal(helper.snapshot().length, 1);
  const frozen = helper.advance(run, { dt: 0, paused: true });
  helper.draw(view.ctx, frozen, (count) => count);
  assert.deepEqual(draws(view)[0].args.slice(1, 5), caughtRegion());
  clock += 100;
  helper.advance(run, { dt: 0.1, paused: true });
  assert.equal(helper.snapshot()[0].age, 0);
  for (let i = 0; i < 3; i++) helper.advance(run, { dt: 0.1 });
  const reduced = helper.advance(run, { dt: 0, reduced: true });
  view.calls.length = 0;
  helper.draw(view.ctx, reduced, (count) => count);
  assert.deepEqual(draws(view)[0].args.slice(1, 5), caughtRegion(300, true));
  assert.deepEqual(structuredClone(run), before);
  helper.advance(run, { dt: 0.1 });
  helper.advance(run, { dt: 0.1 });
  assert.deepEqual(helper.snapshot(), []);
  helper.observe(run, run.events, () => ({ frame, sprite }));
  assert.deepEqual(
    helper.snapshot(),
    [],
    'Repeated terminal events cannot restart a retired clip.',
  );
  const restored = structuredClone(run);
  helper.observe(restored, restored.events, () => ({ frame, sprite }));
  assert.deepEqual(helper.snapshot(), [], 'First observation of restore is silent.');
  restored.tick = 0;
  restored.time = 0;
  helper.advance(restored, { dt: 0 });
  assert.deepEqual(helper.snapshot(), [], 'Seeking backward clears retained visuals.');
});

test('actual Team painter consumes fixed-step defeat while no draw occurs, then drops the borrowed body on dispose', async () => {
  huntDestructionBudget.clear();
  const run = teamRun(),
    view = surface(),
    painter = createCoopPainter(view.canvas);
  painter.setPresentation(snapshot);
  painter.paint(run);
  earnTeamCatch(run, (state) => painter.observe(state));
  const checkpoint = structuredClone(run);
  view.calls.length = 0;
  painter.paint(run, { reduced: true });
  assert.equal(painter.actorFrame('enemy', 'hunter'), null, 'Retired body is not an active actor.');
  assert.equal(draws(view).length, 1);
  assert.deepEqual(draws(view)[0].args.slice(1, 5), caughtRegion(0, true));
  assert.deepEqual(run, checkpoint);
  painter.dispose();
  view.calls.length = 0;
  painter.paint(structuredClone(run), { reduced: true });
  assert.equal(draws(view).length, 0, 'Restored event-bearing snapshot cannot replay the effect.');
  painter.dispose();
  assert.equal(huntDestructionBudget.snapshot().owners, 0);
});

function relayLevel() {
  return {
    version: 'xonix-level.v2',
    id: 'caught-atlas-relay',
    revision: '1',
    name: 'Native relay clip fixture',
    width: 48,
    height: 36,
    spawn: { x: 0.5, y: 18.5 },
    goal: { coverage: 0.75 },
    enemies: [{ id: 'sentinel', type: 'relay-sentinel', x: 34.5, y: 18.5 }],
    objectives: [
      { id: 'relay', x: 8.5, y: 8.5, required: true, hidden: false },
      { id: 'core', x: 34.5, y: 18.5, required: true, hidden: false },
    ],
    supplies: [{ id: 'supply', x: 0.5, y: 18.5 }],
    rules: { moveSpeed: 8, lives: 3, timeMedals: [30, 60] },
    encounter: {
      version: 'xonix-encounter.v1',
      kind: 'relay-sentinel',
      enemyId: 'sentinel',
      shieldObjectiveId: 'relay',
      coreObjectiveId: 'core',
      minReleaseCutCells: 8,
      initialDelayTicks: 240,
      transitionTicks: 180,
      shielded: { warningTicks: 240, activeTicks: 84, restTicks: 396 },
      exposed: { warningTicks: 240, activeTicks: 84, openTicks: 480 },
      laneWidth: 1.2,
    },
  };
}
test('native relay clear paints caught on retained board; reward reveal and restore suppress old motion', async () => {
  huntDestructionBudget.clear();
  const presets = JSON.parse(
    await readFile(new URL('../../authoring/motion-lab/presets.json', import.meta.url)),
  );
  const pack = JSON.parse(
    await readFile(new URL('../content/packs/fpv-arcade-r4.json', import.meta.url)),
  );
  const run = createRun(relayLevel()),
    painter = new BoardPainter(presets),
    view = surface();
  painter.theme = pack.themes[0];
  painter.body = presets.characters['neutral-marker'];
  painter.recipe = presets.animationRecipes[painter.body.animationRecipe];
  painter.background = { width: 384, height: 288 };
  painter.setPresentation(snapshot);
  painter.draw(view.ctx, run, 0);
  const step = (direction) => {
    stepRun(run, { direction }, FIXED_DT);
    painter.effectsFor(run.events, run);
  };
  const move = (count, direction) => {
    for (let i = 0; i < count && run.status !== 'won'; i++) step(direction);
  };
  const wait = (condition) => {
    for (let i = 0; !condition(); i++) {
      assert.ok(i < 10000);
      step(null);
    }
  };
  move(270, 'up');
  move(180, 'right');
  wait(() => run.encounter.phase === 'rest');
  move(525, 'down');
  move(120, 'right');
  wait(() => run.encounter.phase === 'open');
  move(90, 'up');
  move(120, 'left');
  assert.equal(run.status, 'won');
  assert.equal(run.encounter.defeated, true);
  const before = structuredClone(run);
  view.calls.length = 0;
  painter.draw(view.ctx, run, 0, { fullReveal: false, paused: true, celebrationPaused: true });
  assert.equal(draws(view).length, 1);
  assert.deepEqual(draws(view)[0].args.slice(1, 5), caughtRegion());
  assert.equal(painter.actorDefeats.snapshot()[0].age, 0);
  view.calls.length = 0;
  painter.draw(view.ctx, run, 0.1, { fullReveal: true });
  assert.equal(draws(view).length, 0, 'Reward picture never claims a caught body.');
  assert.equal(painter.huntDestruction.snapshot().allocatedParticles, 0);
  assert.deepEqual(painter.actorDefeats.snapshot(), []);
  assert.deepEqual(structuredClone(run), before);
  view.calls.length = 0;
  painter.draw(view.ctx, structuredClone(run), 0.1, { fullReveal: true });
  assert.equal(draws(view).length, 0);
  painter.dispose();
  assert.equal(painter.actorFinishBodies.size, 0);
});

test('shared two-board destruction owners reserve caught bodies inside their existing particle quota', () => {
  const budget = createDestructionBudget({ now: () => 0 });
  const boards = [createHuntDestruction({ budget }), createHuntDestruction({ budget })];
  for (const board of boards) {
    assert.equal(board.reserveTransientPieces(4), 4);
    for (let i = 0; i < 30; i++) board.reserveTransientPieces(4);
  }
  const allocated = budget.snapshot(),
    drawn = boards.map((board) => board.snapshot());
  assert.equal(allocated.owners, 2);
  assert.equal(
    drawn.reduce((sum, row) => sum + row.particles, 0),
    allocated.particles,
  );
  assert.equal(allocated.particles, 128);
  assert.ok(drawn.every((row) => row.envelopes === 0));
  assert.equal(allocated.envelopes, 4);
  assert.equal(createHuntDestruction({ budget }).reserveTransientPieces(1), 0);
  for (const board of boards) board.reset();
  assert.equal(budget.snapshot().owners, 0);
});

test('static sprites, unsupported catches and duplicate events never create generic defeat motion', () => {
  const run = teamRun(),
    helper = createActorDefeatPresentation({ kind: 'team' });
  helper.bind(run);
  earnTeamCatch(run, (state) =>
    helper.observe(state, state.events, () => ({
      frame: {},
      sprite: { ...sprite, geometry: { ...geometry, animation: null } },
    })),
  );
  assert.deepEqual(helper.snapshot(), []);
  const adapter = createCoopActorPresentation({ loadEnemyCatalog: async () => null });
  adapter.update(run);
  adapter.observe(run);
  assert.deepEqual(adapter.defeatSnapshot(), []);
  adapter.reset();
  assert.equal(ACTOR_DEFEAT_LIMITS.count, 4);
});

test('active finishes clear on restore, backward/forward seek, hidden stale frame and presentation retirement', () => {
  for (const transition of ['restore', 'rewind', 'forward-seek', 'stale', 'retire']) {
    let clock = 0;
    const run = teamRun(),
      helper = createActorDefeatPresentation({ kind: 'team', now: () => clock });
    const actor = run.enemies.find((entry) => entry.id === 'hunter');
    const frame = { ...createActorPresentation().sample([actor]).get(actor.id), x: -200, y: -200 };
    helper.advance(run, { dt: 0 });
    earnTeamCatch(run, (state) => helper.observe(state, state.events, () => ({ frame, sprite })));
    const sampled = helper.advance(run, { dt: 0 });
    assert.equal(sampled.length, 1);
    assert.equal(
      sampled[0].frame.x,
      actor.x * 16,
      'Native defeat position replaces stale rendered position.',
    );
    assert.equal(sampled[0].frame.y, actor.y * 16);
    if (transition === 'restore') helper.advance(structuredClone(run), { dt: 0 });
    if (transition === 'rewind') {
      run.tick--;
      run.time -= FIXED_DT;
      helper.advance(run, { dt: 0 });
    }
    if (transition === 'forward-seek') {
      run.tick += 100;
      run.time += 100 * FIXED_DT;
      helper.observe(run, run.events, () => ({ frame, sprite }));
    }
    if (transition === 'stale') {
      clock = 251;
      helper.advance(run, { dt: 0 });
    }
    if (transition === 'retire') helper.reset();
    assert.deepEqual(helper.snapshot(), [], transition);
  }
});

test('caught bodies share remaining capacity with simultaneous material bursts across both boards', () => {
  const budget = createDestructionBudget({ now: () => 0 }),
    view = surface();
  const owners = [{}, {}],
    boards = owners.map(() => createHuntDestruction({ budget }));
  for (const [i, board] of boards.entries()) {
    board.advance({ valid: true, eliminations: [] }, 0, { key: owners[i], brutal: true });
    board.advance(
      {
        valid: true,
        eliminations: Array.from({ length: 24 }, (_, id) => ({
          id: String(id),
          tick: 1,
          cause: 'ram',
          family: 'runner',
          x: 4,
          y: 5,
        })),
      },
      0,
      { key: owners[i], brutal: true },
    );
    board.draw(view.ctx);
    const before = board.snapshot();
    assert.ok(before.particles > 0);
    const admitted = board.reserveTransientPieces(4);
    const after = board.snapshot();
    assert.equal(after.particles, before.particles + admitted);
    assert.ok(after.particles <= after.allocatedParticles);
  }
  assert.ok(boards.reduce((sum, board) => sum + board.snapshot().particles, 0) <= 128);
  assert.ok(boards.reduce((sum, board) => sum + board.snapshot().envelopes, 0) <= 4);
  for (const board of boards) board.reset();
});

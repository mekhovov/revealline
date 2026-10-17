import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createNextRouteReader,
  executeNextRoute,
  qualificationNextRouteOptions,
  NEXT_ROUTE_PROTOCOL,
  NEXT_ROUTE_SOURCE,
  NEXT_ROUTE_IDENTITIES,
} from './solo-qualification-next-route.mjs';
import { validateQualification } from './solo-qualification.mjs';
const recipeBytes = await readFile(
  new URL(
    '../docs/performance/fixtures/solo-remote-sustained/next-geometric.qualification.fixture',
    import.meta.url,
  ),
);
const recipe = JSON.parse(recipeBytes);
const definitions = JSON.parse(
  await readFile(
    new URL(
      '../docs/performance/fixtures/solo-remote-sustained/next-geometric-model.fixture',
      import.meta.url,
    ),
  ),
).rows;
const definition = definitions.find((row) => row.id === 'choose-your-share');
const flags = [
  '--authored-next-route=' + NEXT_ROUTE_PROTOCOL,
  '--source-revision=' + NEXT_ROUTE_SOURCE,
  '--work-probe',
  '--hitch-journal',
  '--cadence=settled120',
];
const action = {
  type: 'authored-next-route',
  protocol: NEXT_ROUTE_PROTOCOL,
  mission: definition.id,
  timeoutMs: 60000,
};
function snapshot() {
  return {
    phase: 'running',
    autoNext: false,
    mission: definition.id,
    status: 'running',
    tick: 0,
    lives: 3,
    claimedCount: 212,
    trail: { length: 0 },
    player: { x: 49.5, y: 0.5, speed: 0 },
    enemies: [{ id: 'keeper', x: 49.5, y: 12, vx: 8, vy: 8 }],
    level: definition.level,
    options: definition.options,
  };
}
function harness(overrides = {}) {
  let time = 0,
    reads = 0;
  const state = snapshot(),
    events = [],
    record = {};
  return {
    state,
    record,
    events,
    options: {
      action,
      now: () => time,
      deadline: 1200000,
      record,
      read: async () => {
        reads++;
        if (events.some((x) => x === 'down')) {
          state.status = 'won';
          state.phase = 'picture';
          state.tick = 10;
        }
        return structuredClone(state);
      },
      keyboard: {
        down: async () => {
          events.push('down');
        },
        up: async () => {
          events.push('up');
        },
      },
      wait: async (ms) => {
        time += ms;
      },
      ...overrides,
    },
    advance: (ms) => (time += ms),
    reads: () => reads,
  };
}
test('only exact source recipe and explicit lifecycle observation mode admits eleven ordered missions', () => {
  assert.equal(validateQualification(recipe), recipe);
  assert(qualificationNextRouteOptions(flags, recipe, recipeBytes));
  assert.equal(recipe.actions.filter((x) => x.type === 'authored-next-route').length, 11);
  assert.equal(recipe.actions.filter((x) => x.selector === '#next-button').length, 10);
  for (const bad of [
    flags.slice(1),
    [...flags, flags[0]],
    flags.map((x) => (x.startsWith('--source') ? x.replace(NEXT_ROUTE_SOURCE, 'a'.repeat(40)) : x)),
    [...flags, '--baseline-runtime'],
    [...flags, '--cpu-profile'],
  ])
    assert.throws(() => qualificationNextRouteOptions(bad, recipe, recipeBytes));
  assert.throws(() =>
    qualificationNextRouteOptions(flags, recipe, Buffer.concat([recipeBytes, Buffer.from(' ')])),
  );
  assert.equal(qualificationNextRouteOptions([], { actions: [] }, Buffer.alloc(0)), null);
  assert.throws(() => qualificationNextRouteOptions([], { actions: [action] }, Buffer.alloc(0)));
});
test('actual driver settles ordered input and releases only owned keys after a win', async () => {
  const h = harness();
  await executeNextRoute(h.options);
  assert.deepEqual(h.events, ['down', 'up']);
  assert.equal(h.record.status, 'passed-public-route');
  assert.equal(h.record.unsettled, 0);
  assert.deepEqual(h.record.heldKeys, []);
  assert.equal(h.record.stages[0].id, 'keeper-crossed-right-away');
});
test('wrong source definition, lives, Auto Next, phase and initial delay cannot become a route pass', async () => {
  for (const change of [
    (s) => (s.level = { ...s.level, goal: { coverage: 0.1 } }),
    (s) => (s.lives = 2),
    (s) => (s.autoNext = true),
    (s) => (s.phase = 'paused'),
    (s) => (s.tick = 13),
    (s) => (s.options = { ...s.options, seed: 2 }),
  ]) {
    const h = harness();
    change(h.state);
    await assert.rejects(executeNextRoute(h.options));
    assert.equal(h.record.status, 'failed');
    assert.deepEqual(h.events, []);
  }
});
test('slow command, rejected cleanup and native unsettled calls remain failed', async () => {
  const h = harness();
  h.options.keyboard.down = async () => {
    h.events.push('down');
    h.advance(101);
  };
  await assert.rejects(executeNextRoute(h.options), /after deadline/);
  assert.equal(h.record.status, 'failed');
  const c = harness();
  c.options.keyboard.up = async () => {
    throw Error('release failure');
  };
  await assert.rejects(executeNextRoute(c.options));
  assert.equal(c.record.status, 'failed');
  assert.deepEqual(c.record.heldKeys, ['down']);
  const n = harness();
  n.options.keyboard.down = () => new Promise(() => {});
  await assert.rejects(executeNextRoute(n.options), /deadline/);
  assert.equal(n.record.unsettled, 1);
  assert.deepEqual(n.record.heldKeys, ['down']);
});
test('a geometric predicate has one finite stage deadline and no retries', async () => {
  const h = harness();
  h.state.enemies[0].x = 2;
  await assert.rejects(executeNextRoute(h.options), /deadline/);
  assert(h.record.reads <= 303);
  assert.equal(h.record.stages.length, 1);
  assert.deepEqual(h.events, []);
});
test('actual serialized reader rejects missing/ambiguous/replaced owners permanently', () => {
  const factory = Function('return (' + createNextRouteReader.toString() + ')')();
  function setup() {
    const run = {
      ...snapshot(),
      level: definition.level,
      seed: 1,
      classId: 'scout',
      turnPolicy: 'immediate',
      trail: [],
    };
    const scene = { lastPaint: { run }, submittedRun: run };
    const game = { scene: { scenes: [scene] } };
    const reader = factory(() => game, {
      document: {
        body: { dataset: { flightState: 'running' } },
        querySelector: () => ({ checked: false }),
      },
    });
    return { run, scene, game, reader };
  }
  const h = setup();
  assert.equal(h.reader(definition.id, true).mission, definition.id);
  h.run.player.x = 20;
  assert.equal(h.reader(definition.id).player.x, 20);
  h.scene.submittedRun = {};
  assert.throws(() => h.reader(definition.id));
  h.scene.submittedRun = h.run;
  assert.throws(() => h.reader(definition.id));
  const a = setup();
  a.game.scene.scenes.push({ lastPaint: { run: a.run } });
  assert.throws(() => a.reader(definition.id, true));
  const b = setup();
  b.reader(definition.id, true);
  assert.throws(() => b.reader(definition.id, true));
  const replaced = setup();
  replaced.reader(definition.id, true);
  const next = { ...replaced.run };
  replaced.game.scene.scenes = [{ lastPaint: { run: next }, submittedRun: next }];
  assert.throws(() => replaced.reader(definition.id, true), /Scene owner replaced/);
  const c = setup();
  c.reader(definition.id, true);
  const replacement = { ...c.run };
  c.scene.lastPaint = { run: replacement };
  c.scene.submittedRun = replacement;
  assert.throws(() => c.reader(definition.id));
});
test('declared source contains six unchanged duration routes and five fixed geometry routes', () => {
  assert.equal(NEXT_ROUTE_IDENTITIES.filter((x) => x.timed).length, 6);
  assert.equal(NEXT_ROUTE_IDENTITIES.filter((x) => !x.timed).length, 5);
  for (const extra of [
    { predicate: 'return true' },
    { timeoutMs: 120000 },
    { mission: 'arbitrary' },
  ]) {
    const s = structuredClone(recipe);
    Object.assign(
      s.actions.find((x) => x.type === 'authored-next-route'),
      extra,
    );
    assert.throws(() => validateQualification(s));
  }
});

test('actual qualifier installs and calls only the opted-in route reader on its captured owner', async () => {
  const { runInNewContext } = await import('node:vm');
  const source = await readFile(new URL('./qualify-solo-runtime.mjs', import.meta.url), 'utf8');
  const marker = '  await addQualificationProbe(\n',
    first = source.indexOf(marker) + marker.length,
    end = source.indexOf('    {\n      bounds: FRAME_BOUNDS,', first);
  const factory = source.slice(first, end).trim().replace(/,$/, '');
  const readStart = source.indexOf('read: (mission, begin) =>'),
    readEnd = source.indexOf('keyboard: page.keyboard', readStart);
  const readFunction = source
    .slice(readStart + 6, readEnd)
    .trim()
    .replace(/,$/, '');
  for (const enabled of [false, true]) {
    const state = snapshot(),
      run = {
        ...state,
        level: definition.level,
        seed: 1,
        classId: 'scout',
        turnPolicy: 'immediate',
        trail: [],
      };
    const scene = { lastPaint: { run }, submittedRun: run };
    const env = {
      performance: { now: () => 0 },
      document: {
        body: { dataset: { flightState: 'running' } },
        addEventListener() {},
        querySelector: () => ({ checked: false }),
      },
      requestAnimationFrame() {},
      MutationObserver: class {
        observe() {}
      },
      HTMLMediaElement: class {
        play() {
          return Promise.resolve();
        }
      },
      soloQualificationReadiness: () => ({}),
      soloQualificationIntervalClock: () => ({ snapshot: () => ({}) }),
      soloQualificationFrozenCadence: () => ({ calibration: null, baselineMs: 16.7 }),
    };
    env.window = env;
    env.soloQualificationCreateNextRouteReader = createNextRouteReader;
    runInNewContext(
      '(' + factory + ')',
      env,
    )({ bounds: [33, 50, 100, 250, null], workProbe: false, nextRoute: enabled });
    env.Phaser = {
      Game: class {
        constructor() {
          this.scene = { scenes: [scene] };
        }
      },
      Core: { Events: {} },
    };
    new env.Phaser.Game();
    if (!enabled) {
      assert.equal(env.soloQualificationProbe.nextRouteRead, undefined);
      continue;
    }
    const read = runInNewContext('(' + readFunction + ')', {
      page: { evaluate: async (fn, args) => runInNewContext('(' + fn.toString() + ')', env)(args) },
    });
    assert.equal((await read(definition.id, true)).mission, definition.id);
  }
});

test('expired pre-invocation command never acquires or releases a key', async () => {
  const h = harness();
  let reads = 0;
  const original = h.options.read;
  h.options.read = async (...args) => {
    const value = await original(...args);
    if (++reads === 2) h.advance(100);
    return value;
  };
  await assert.rejects(executeNextRoute(h.options), /deadline elapsed/);
  assert.deepEqual(h.events, []);
  assert.deepEqual(h.record.heldKeys, []);
  assert.equal(h.record.status, 'failed');
});

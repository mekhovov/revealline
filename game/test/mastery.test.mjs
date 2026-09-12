import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createRun,
  stepRun,
  releaseInputs,
  FIXED_DT,
  getSummary,
  loadoutHash,
} from '../core/index.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  recordRelease,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';
import { campaignKey } from '../library.mjs';
import {
  STEADY_SIGNAL,
  MAX_MASTERY_TICKS,
  resolveMasteryDefinition,
  validateMasteryDefinition,
  masteryDefinitionIdentity,
  captureMasterySetup,
  captureMasteryFacts,
  createMasteryObserver,
} from '../mastery.mjs';

const pack = JSON.parse(
  await readFile(new URL('../content/packs/homeward-skies.json', import.meta.url), 'utf8'),
);
const proofs = JSON.parse(
  await readFile(new URL('../replays/homeward-routes.json', import.meta.url), 'utf8'),
);
const campaign = { ...pack.campaigns[0], classRecipes: pack.classRecipes };
const level = campaign.levels[0];
const context = {
  campaignId: campaign.id,
  campaignKey: campaignKey(campaign),
  runId: 'mastery-unit-run',
};
const copy = (value) => structuredClone(value);
const makeRun = (classId = 'fiber', turnPolicy = 'immediate') =>
  createRun(level, { seed: 1, classId, turnPolicy, classRecipes: pack.classRecipes });
const makeObserver = (state, binding = context) =>
  createMasteryObserver({
    definition: STEADY_SIGNAL,
    setup: captureMasterySetup(state, binding),
    initial: captureMasteryFacts(state, binding),
  });

// Small synthetic fact streams exercise observer boundaries; gameplay proofs below
// use only unchanged public-core inputs and archived summary/checkpoint expectations.
function stream({ classId = 'fiber', definition = STEADY_SIGNAL } = {}) {
  const state = makeRun(classId),
    setup = captureMasterySetup(state, context);
  let facts = captureMasteryFacts(state, context);
  const observer = createMasteryObserver({ definition, setup, initial: facts });
  function next(patch = {}, events = []) {
    const tick = facts.tick + 1;
    return {
      ...copy(facts),
      tick,
      time: tick * FIXED_DT,
      ...copy(patch),
      events: events.map((type) => ({ type, tick, time: tick * FIXED_DT })),
    };
  }
  function send(patch, events) {
    const candidate = next(patch, events);
    observer.observe(candidate);
    facts = candidate;
    return observer.snapshot();
  }
  function cut(count, { zone = true, x = 5, y = 10 } = {}) {
    const start = (facts.tick + 1) * FIXED_DT;
    for (let i = 0; i < count; i++)
      send(
        {
          status: 'running',
          player: { x: x + i, y, cutting: true, cutStartedAt: start },
          signalZoneIds: zone ? ['broad-band'] : [],
        },
        i === 0 ? ['cut.started'] : [],
      );
  }
  function close(status = 'running') {
    return send(
      { status, player: { x: 0.5, y: 10, cutting: false, cutStartedAt: null }, signalZoneIds: [] },
      ['cut.closed', ...(status === 'won' ? ['run.completed'] : [])],
    );
  }
  function abort(type) {
    return send(
      {
        status: 'respawning',
        lives: facts.lives - (type === 'player.failed' ? 1 : 0),
        player: { ...facts.player, cutting: false, cutStartedAt: null },
      },
      [type],
    );
  }
  return { observer, setup, next, send, cut, close, abort, facts: () => copy(facts) };
}

test('one strict canonical Steady Signal definition has owned returns and stable content identity', () => {
  assert.deepEqual(validateMasteryDefinition(STEADY_SIGNAL), { valid: true, errors: [] });
  assert.ok(Object.isFrozen(STEADY_SIGNAL.all[1]));
  const reversed = copy(STEADY_SIGNAL);
  reversed.all.reverse();
  assert.deepEqual(resolveMasteryDefinition(reversed), STEADY_SIGNAL);
  assert.equal(masteryDefinitionIdentity(reversed), masteryDefinitionIdentity(STEADY_SIGNAL));
  const edited = resolveMasteryDefinition(STEADY_SIGNAL);
  edited.all[1].minCells = 9;
  assert.equal(STEADY_SIGNAL.all[1].minCells, 8);
  assert.notEqual(masteryDefinitionIdentity(edited), masteryDefinitionIdentity(STEADY_SIGNAL));
  edited.all[1].minCells = 8;
  edited.description += ' Updated.';
  assert.notEqual(masteryDefinitionIdentity(edited), masteryDefinitionIdentity(STEADY_SIGNAL));
});

test('definitions reject unknown, incomplete, duplicate, unbounded or executable data', () => {
  const bad = [null, undefined, JSON.stringify(STEADY_SIGNAL), [], new Date()];
  for (const edit of [
    (v) => {
      v.version = 'xonix-mastery-definition.v2';
    },
    (v) => {
      v.id = 'constructor';
    },
    (v) => {
      v.campaignId = '';
    },
    (v) => {
      v.name = 'x'.repeat(81);
    },
    (v) => {
      v.description = 'x'.repeat(513);
    },
    (v) => {
      delete v.revision;
    },
    (v) => {
      v.reward = 'write-library';
    },
    (v) => {
      v.all = [{ type: 'clean-win' }, { type: 'clean-win' }];
    },
    (v) => {
      v.all[1].type = 'javascript';
    },
    (v) => {
      v.all[0].minimum = 1;
    },
    (v) => {
      v.all[1].minCells = Infinity;
    },
    (v) => {
      v.all[1].minCells = 0;
    },
    (v) => {
      v.all[1].minCells = 1565;
    },
    (v) => {
      v.all[1].minCells = 8.5;
    },
    (v) => {
      v.all[1].zoneId = '__proto__';
    },
    (v) => {
      v.all.push(v.all[0]);
    },
    (v) => {
      v.all[1].owner = v;
    },
    (v) => {
      Object.defineProperty(v, 'hidden', { value: true });
    },
    (v) => {
      v[Symbol('script')] = true;
    },
    (v) => {
      Object.setPrototypeOf(v.all[1], { inherited: true });
    },
  ]) {
    const value = copy(STEADY_SIGNAL);
    edit(value);
    bad.push(value);
  }
  for (const value of bad) {
    assert.equal(validateMasteryDefinition(value).valid, false);
    assert.throws(() => resolveMasteryDefinition(value), TypeError);
  }
});

test('validation never executes accessors and accepts ordinary null-prototype JSON objects', () => {
  let calls = 0;
  for (const target of ['root', 'predicate']) {
    const value = copy(STEADY_SIGNAL),
      object = target === 'root' ? value : value.all[1];
    Object.defineProperty(object, target === 'root' ? 'name' : 'minCells', {
      enumerable: true,
      get() {
        calls++;
        throw new Error('must not execute');
      },
    });
    assert.equal(validateMasteryDefinition(value).valid, false);
  }
  assert.equal(calls, 0);
  const nullObjects = (value) =>
    Array.isArray(value)
      ? value.map(nullObjects)
      : value && typeof value === 'object'
        ? Object.assign(
            Object.create(null),
            Object.fromEntries(
              Object.entries(value).map(([key, child]) => [key, nullObjects(child)]),
            ),
          )
        : value;
  assert.deepEqual(resolveMasteryDefinition(nullObjects(STEADY_SIGNAL)), STEADY_SIGNAL);
});

test('setup binds a new normalized map and known zone without changing the run', () => {
  const state = makeRun(),
    before = authoritativeCheckpoint(state);
  const setup = captureMasterySetup(state, context),
    initial = captureMasteryFacts(state, context);
  const observer = createMasteryObserver({ definition: STEADY_SIGNAL, setup, initial });
  assert.deepEqual(authoritativeCheckpoint(state), before);
  assert.match(setup.levelIdentity, /^level-v1-[0-9a-f]{16}$/);
  assert.equal(observer.snapshot().setup.campaignKey, context.campaignKey);
  for (const patch of [
    { campaignId: 'elsewhere' },
    { levelId: 'homeward-02' },
    { signalZoneIds: [] },
    { signalZoneIds: ['broad-band', 'broad-band'] },
    { ruleset: 'xonix-core.v3' },
  ])
    assert.throws(
      () =>
        createMasteryObserver({
          definition: STEADY_SIGNAL,
          setup: { ...setup, ...patch },
          initial,
        }),
      TypeError,
    );
  stepRun(state, { direction: 'down' }, FIXED_DT);
  assert.throws(() => captureMasterySetup(state, context), /fresh/);
  assert.throws(
    () =>
      createMasteryObserver({
        definition: STEADY_SIGNAL,
        setup,
        initial: captureMasteryFacts(state, context),
      }),
    /tick zero/,
  );
});

test('the complete existing campaign-key range survives setup capture and observation', () => {
  const longCampaign = { ...campaign, id: 'a'.repeat(80), revision: '/'.repeat(60) };
  const binding = {
    ...context,
    campaignId: longCampaign.id,
    campaignKey: campaignKey(longCampaign),
  };
  assert.equal(binding.campaignKey.length, 278);
  const state = makeRun();
  const observer = createMasteryObserver({
    definition: { ...copy(STEADY_SIGNAL), campaignId: longCampaign.id },
    setup: captureMasterySetup(state, binding),
    initial: captureMasteryFacts(state, binding),
  });
  assert.equal(observer.snapshot().setup.campaignKey, binding.campaignKey);
});

test('only a successful cut commits eight distinct endpoints; qualification waits for a won run', () => {
  const h = stream();
  h.cut(8);
  assert.equal(h.observer.snapshot().pendingCutCells, 8);
  assert.equal(h.observer.snapshot().bestClosedCutCells, 0);
  assert.equal(h.observer.snapshot().qualified, false);
  h.close();
  assert.equal(h.observer.snapshot().bestClosedCutCells, 8);
  assert.equal(h.observer.snapshot().qualified, false);
  h.cut(1);
  const final = h.close('won');
  assert.equal(final.qualified, true);
  assert.equal(final.authority, 'preview-only');
  assert.equal(final.pendingCutCells, 0);
  assert.deepEqual(
    final.predicates.map((item) => item.satisfied),
    [true, true],
  );
  assert.throws(() => h.observer.observe(h.next()), /terminal/);
});

test('stationary dwell and revisiting the same endpoint cannot farm distinct cells', () => {
  const h = stream();
  h.cut(1);
  for (let i = 0; i < 100; i++) h.send({ player: { ...h.facts().player, x: i % 2 ? 5.8 : 5.2 } });
  assert.equal(h.observer.snapshot().pendingCutCells, 1);
  assert.equal(h.close('won').qualified, false);
});

test('safe territory and inactive/suppressed zones do not count', () => {
  const h = stream();
  for (let i = 0; i < 9; i++)
    h.send({
      player: { x: 5 + i, y: 10, cutting: false, cutStartedAt: null },
      signalZoneIds: ['broad-band'],
    });
  assert.equal(h.observer.snapshot().pendingCutCells, 0);
  h.cut(9, { zone: false });
  assert.equal(h.close('won').bestClosedCutCells, 0);
});

test('two short successful cuts never combine into one eight-cell cut', () => {
  const h = stream();
  h.cut(4);
  h.close();
  h.cut(4, { x: 20 });
  const final = h.close('won');
  assert.equal(final.closedCuts, 2);
  assert.equal(final.bestClosedCutCells, 4);
  assert.equal(final.qualified, false);
});

for (const type of ['player.failed', 'shield.absorbed', 'craft.redeployed'])
  test(`${type} discards the entire pending cut before another attempt`, () => {
    const h = stream();
    h.cut(9);
    h.abort(type);
    assert.equal(h.observer.snapshot().pendingCutCells, 0);
    assert.equal(h.observer.snapshot().bestClosedCutCells, 0);
    h.cut(7);
    const final = h.close('won');
    assert.equal(final.bestClosedCutCells, 7);
    assert.equal(final.qualified, false);
    assert.equal(final.cleanSoFar, type !== 'player.failed');
  });

test('a later qualifying cut cannot erase a lost life; a timeout discards an open qualifying cut', () => {
  const failed = stream();
  failed.cut(1);
  failed.abort('player.failed');
  failed.cut(8);
  const win = failed.close('won');
  assert.equal(win.bestClosedCutCells, 8);
  assert.equal(win.qualified, false);
  assert.equal(win.cleanSoFar, false);
  const timedOut = stream();
  timedOut.cut(8);
  timedOut.send({ status: 'lost' }, ['run.completed']);
  assert.equal(timedOut.observer.snapshot().pendingCutCells, 0);
  assert.equal(timedOut.observer.snapshot().bestClosedCutCells, 0);
  assert.equal(timedOut.observer.snapshot().qualified, false);
});

test('a closure followed by recovery commits that finished cut in event order', () => {
  const h = stream();
  h.cut(8);
  const patch = {
    status: 'respawning',
    player: { x: 0.5, y: 10, cutting: false, cutStartedAt: null },
    signalZoneIds: [],
  };
  const before = h.observer.snapshot();
  assert.throws(
    () => h.observer.observe(h.next(patch, ['shield.absorbed', 'cut.closed'])),
    /live trail/,
  );
  assert.deepEqual(h.observer.snapshot(), before);
  h.send(patch, ['cut.closed', 'shield.absorbed']);
  assert.equal(h.observer.snapshot().bestClosedCutCells, 8);
  assert.equal(h.observer.snapshot().pendingCutCells, 0);
  assert.equal(h.observer.snapshot().cleanSoFar, true);
  h.cut(1);
  assert.equal(h.close('won').qualified, true);
});

test('the active recipe controls resistance and the original class/history remain bound', () => {
  const h = stream({ classId: 'interceptor' });
  const fiber = pack.classRecipes.find((recipe) => recipe.id === 'fiber');
  h.send({
    activeClass: {
      id: 'fiber',
      revision: fiber.revision,
      loadoutHash: loadoutHash(fiber),
      resistant: true,
    },
    classSequence: 1,
    classChangedAt: 1,
  });
  h.cut(8);
  const final = h.close('won');
  assert.equal(final.qualified, true);
  assert.equal(final.setup.classId, 'interceptor');
  assert.deepEqual(
    final.classHistory.map((entry) => [entry.classId, entry.tick]),
    [
      ['interceptor', 0],
      ['fiber', 1],
    ],
  );
  const ordinary = stream({ classId: 'interceptor' });
  ordinary.cut(9);
  assert.equal(ordinary.close('won').qualified, false);
});

test('bad tick/run/setup samples fail atomically, including duplicates and release-only samples', () => {
  const h = stream();
  h.cut(4);
  const before = h.observer.snapshot();
  const values = [h.facts()];
  for (const patch of [
    { tick: h.facts().tick + 2 },
    { tick: MAX_MASTERY_TICKS + 1 },
    { time: Infinity },
    { runId: 'another-attempt' },
    { classSequence: 2 },
    { signalZoneIds: ['unknown'] },
    { extra: true },
  ])
    values.push({ ...h.next(), ...patch });
  for (const key of [
    'ruleset',
    'levelId',
    'revision',
    'seed',
    'turnPolicy',
    'classId',
    'classRevision',
    'loadoutHash',
    'rosterHash',
  ]) {
    const facts = h.next();
    facts.identity[key] =
      key === 'seed' ? 2 : key === 'turnPolicy' ? 'grid-center' : `${facts.identity[key]}-changed`;
    values.push(facts);
  }
  const accessor = h.next();
  Object.defineProperty(accessor.player, 'x', {
    enumerable: true,
    get() {
      throw new Error('not invoked');
    },
  });
  values.push(accessor);
  for (const facts of values) {
    assert.throws(() => h.observer.observe(facts), TypeError);
    assert.deepEqual(h.observer.snapshot(), before);
  }
  h.send({ player: { ...h.facts().player, x: 10 } });
  assert.equal(h.observer.snapshot().pendingCutCells, 5);
});

test('missing cut/failure/completion events cannot silently preserve or commit progress', () => {
  const h = stream();
  h.cut(8);
  const before = h.observer.snapshot();
  for (const facts of [
    h.next({ player: { ...h.facts().player, cutting: false, cutStartedAt: null } }),
    h.next({ lives: 2 }),
    h.next({ status: 'won' }),
    h.next({}, ['run.completed']),
    h.next({}, ['cut.closed']),
    h.next({ player: { ...h.facts().player, cutStartedAt: 0 } }),
  ]) {
    assert.throws(() => h.observer.observe(facts), TypeError);
    assert.deepEqual(h.observer.snapshot(), before);
  }
  assert.equal(h.close('won').qualified, true);
});

test('caller mutation, partial restart and fragments from another run cannot alter this observer', () => {
  const state = makeRun(),
    setup = captureMasterySetup(state, context),
    initial = captureMasteryFacts(state, context),
    definition = copy(STEADY_SIGNAL);
  const observer = createMasteryObserver({ definition, setup, initial });
  setup.signalZoneIds.length = 0;
  initial.identity.seed = 7;
  definition.all[1].minCells = 1;
  const view = observer.snapshot();
  view.setup.seed = 8;
  view.classHistory[0].classId = 'impact';
  view.predicates[1].minCells = 1;
  assert.equal(observer.snapshot().setup.seed, 1);
  assert.equal(observer.snapshot().predicates[1].minCells, 8);
  const facts = captureMasteryFacts(state, context);
  releaseInputs(state);
  assert.deepEqual(
    captureMasteryFacts(state, context),
    facts,
    'Input release alone is not a mastery tick.',
  );
  assert.throws(() => observer.observe(facts), /consecutive/);
  const newRun = makeObserver(makeRun(), { ...context, runId: 'new-attempt' });
  assert.equal(newRun.snapshot().bestClosedCutCells, 0);
});

const routes = proofs.routes.filter(
  (route) =>
    route.levelId === level.id &&
    ((route.variant === 'specialty' && route.classId === 'fiber') ||
      (route.variant === 'fallback' && route.classId === 'interceptor')),
);
assert.equal(routes.length, 4);
for (const route of routes)
  test(`unchanged legal ${route.id} verifies and produces the intended optional result`, () => {
    const options = {
      seed: route.seed,
      classId: route.classId,
      turnPolicy: route.turnPolicy,
      classRecipes: pack.classRecipes,
    };
    const state = createRun(level, options),
      recorder = createRecorder(level, options, 'mastery-proof-test');
    const binding = { ...context, runId: route.id },
      observer = makeObserver(state, binding);
    const initialCheckpoint = authoritativeCheckpoint(state);
    assert.deepEqual(authoritativeCheckpoint(state), initialCheckpoint);
    let at180;
    for (const segment of route.segments) {
      if (segment.releaseBefore) {
        releaseInputs(state);
        recordRelease(recorder);
      }
      for (let tick = 0; tick < segment.ticks; tick++) {
        stepRun(state, segment.input, FIXED_DT);
        recordInput(recorder, segment.input);
        const facts = captureMasteryFacts(state, binding);
        const zone = level.signalZones[0];
        assert.equal(
          facts.signalZoneIds.includes(zone.id),
          state.player.x >= zone.x &&
            state.player.x < zone.x + zone.w &&
            state.player.y >= zone.y &&
            state.player.y < zone.y + zone.h,
          'Unsuppressed public-core signal uses half-open endpoint bounds.',
        );
        observer.observe(facts);
        if (state.tick === 180) at180 = observer.snapshot();
      }
    }
    assert.deepEqual(getSummary(state), route.expected);
    assert.deepEqual(
      authoritativeCheckpoint(state),
      route.checkpoint,
      'Observation leaves the archived state checkpoint exact.',
    );
    const replay = exportReplay(recorder, state),
      verified = verifyReplay(replay);
    assert.equal(verified.match, true);
    assert.deepEqual(verified.actual.checkpoint, route.checkpoint);
    const final = observer.snapshot();
    assert.equal(final.qualified, route.classId === 'fiber');
    assert.equal(final.bestClosedCutCells, route.classId === 'fiber' ? 22 : 0);
    assert.equal(final.closedCuts, 3);
    assert.equal(final.cleanSoFar, true);
    assert.deepEqual(final.classHistory, route.expected.classHistory);
    assert.equal(final.setup.turnPolicy, route.turnPolicy);
    assert.equal(final.setup.rosterHash, route.expected.rosterHash);
    assert.equal(
      final.authority,
      'preview-only',
      'Successful local verification does not add an award capability.',
    );
    if (route.classId === 'fiber')
      assert.ok(at180.pendingCutCells >= 8 && at180.bestClosedCutCells === 0);
  });

test('reconstruction from tick zero across an explicit live-cut release retains exact mastery and replay', () => {
  const route = routes.find(
    (entry) => entry.turnPolicy === 'grid-center' && entry.classId === 'fiber',
  );
  const state = makeRun('fiber', 'grid-center'),
    observer = makeObserver(state);
  const options = {
    seed: 1,
    classId: 'fiber',
    turnPolicy: 'grid-center',
    classRecipes: pack.classRecipes,
  };
  const recorder = createRecorder(level, options, 'mastery-release-proof');
  for (const segment of route.segments)
    for (let tick = 0; tick < segment.ticks; tick++) {
      if (state.tick === 180) {
        const before = observer.snapshot();
        releaseInputs(state);
        recordRelease(recorder);
        assert.deepEqual(observer.snapshot(), before);
      }
      stepRun(state, segment.input, FIXED_DT);
      recordInput(recorder, segment.input);
      observer.observe(captureMasteryFacts(state, context));
    }
  const replay = exportReplay(recorder, state);
  assert.equal(verifyReplay(replay).match, true);
  assert.deepEqual(authoritativeCheckpoint(state), route.checkpoint);
  const restored = makeRun('fiber', 'grid-center'),
    reconstructed = makeObserver(restored);
  for (const segment of replay.segments) {
    if (segment.releaseBefore) releaseInputs(restored);
    for (let tick = 0; tick < segment.ticks; tick++) {
      stepRun(restored, segment.input, FIXED_DT);
      reconstructed.observe(captureMasteryFacts(restored, context));
    }
  }
  assert.deepEqual(reconstructed.snapshot(), observer.snapshot());
  assert.equal(reconstructed.snapshot().qualified, true);
});

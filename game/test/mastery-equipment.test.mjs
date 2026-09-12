import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRun, stepRun, FIXED_DT, getSummary } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import {
  STEADY_SIGNAL,
  SUPPLY_LINE,
  SAFE_RETURN,
  EQUIPMENT_MASTERY_DEFINITION_VERSION,
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
const proof = JSON.parse(
  await readFile(new URL('../replays/homeward-routes.json', import.meta.url), 'utf8'),
);
const clone = (value) => structuredClone(value);
const bindingFor = (definition) => ({
  definition,
  campaignId: 'homeward-skies',
  campaignKey: 'homeward-skies/1/0d01f5687b3c38ff',
  runId: 'equipment-pure-test',
});
const runFor = (definition, options = {}, level) =>
  createRun(level ?? pack.campaigns[0].levels.find((item) => item.id === definition.levelId), {
    seed: 1,
    turnPolicy: 'immediate',
    classId: definition === SAFE_RETURN ? 'impact' : 'bomber',
    classRecipes: pack.classRecipes,
    ...options,
  });
function observeRun(definition, state) {
  const binding = bindingFor(definition);
  return createMasteryObserver({
    definition,
    setup: captureMasterySetup(state, binding),
    initial: captureMasteryFacts(state, binding),
  });
}
const predicate = (preview, type) => preview.predicates.find((item) => item.type === type);
const region = (preview, id = 'west-emitter') =>
  predicate(preview, 'suppressed-region-crossings').regions.find((item) => item.zoneId === id);

// These small, explicitly synthetic fact streams isolate observation boundaries.
// Public-core routes below separately prove actual gameplay and unchanged checkpoints.
function stream(definition = SUPPLY_LINE, options = {}) {
  const state = runFor(definition, options),
    binding = bindingFor(definition),
    setup = captureMasterySetup(state, binding);
  let facts = captureMasteryFacts(state, binding);
  const observer = createMasteryObserver({ definition, setup, initial: facts });
  function next(patch = {}, events = []) {
    const tick = facts.tick + 1;
    return {
      ...clone(facts),
      tick,
      time: tick * FIXED_DT,
      impactField: null,
      ...clone(patch),
      events: events.map((event) => ({
        type: typeof event === 'string' ? event : event.type,
        tick,
        time: tick * FIXED_DT,
        ...(typeof event === 'string' ? {} : event),
      })),
    };
  }
  function send(patch, events) {
    const value = next(patch, events);
    observer.observe(value);
    facts = value;
    return observer.snapshot();
  }
  function sample(x, y, { suppressedUntil = 20, start = !facts.player.cutting } = {}) {
    const cutStartedAt = start ? (facts.tick + 1) * FIXED_DT : facts.player.cutStartedAt;
    return send(
      {
        status: 'running',
        player: { x, y, cutting: true, cutStartedAt, trailCellCount: 3 },
        regions: facts.regions.map((item) => ({ ...item, suppressedUntil })),
      },
      start ? ['cut.started'] : [],
    );
  }
  function close(status = 'running') {
    return send(
      {
        status,
        player: { x: 0.5, y: 18.5, cutting: false, cutStartedAt: null, trailCellCount: 0 },
      },
      ['cut.closed', ...(status === 'won' ? ['run.completed'] : [])],
    );
  }
  function recover(type = 'player.failed') {
    return send(
      {
        status: 'respawning',
        lives: facts.lives - (type === 'player.failed' ? 1 : 0),
        player: { ...facts.player, cutting: false, cutStartedAt: null, trailCellCount: 0 },
      },
      [type],
    );
  }
  function returned() {
    return send(
      {
        status: 'running',
        player: { ...facts.player, x: state.level.spawn.x, y: state.level.spawn.y },
      },
      ['player.respawned'],
    );
  }
  function pulse({ hit = true, actorStunned = true, fieldId = `pulse-${facts.tick + 1}` } = {}) {
    const point = facts.player,
      actor = facts.actor;
    const field = {
      id: fieldId,
      kind: 'impact-pulse',
      x: point.x,
      y: point.y,
      radius: facts.activeClass.radius,
      until: facts.time + facts.activeClass.duration,
    };
    assert.equal(
      Math.hypot(actor?.x - point.x, actor?.y - point.y) <= field.radius + (actor?.radius ?? 0),
      hit,
    );
    return send(
      {
        status: 'respawning',
        player: { ...point, cutting: false, cutStartedAt: null, trailCellCount: 0 },
        actor: actor ? { ...actor, stunnedUntil: actorStunned ? field.until : 0 } : null,
        impactField: field,
      },
      [
        {
          type: 'craft.redeployed',
          time: facts.time,
          x: field.x,
          y: field.y,
          radius: field.radius,
        },
        { type: 'ability.used', time: facts.time, primitive: 'impact-pulse', ammo: 0 },
      ],
    );
  }
  function prepareImpact(count = 3, { hit = true } = {}) {
    const tick = facts.tick + 1;
    return send(
      {
        player: {
          x: 24.5,
          y: 6.5,
          cutting: true,
          cutStartedAt: tick * FIXED_DT,
          trailCellCount: count,
        },
        actor: { ...facts.actor, x: hit ? 26 : 40, y: 3.5 },
      },
      ['cut.started'],
    );
  }
  return {
    state,
    setup,
    observer,
    next,
    send,
    sample,
    close,
    recover,
    returned,
    pulse,
    prepareImpact,
    get facts() {
      return facts;
    },
  };
}

test('v2 uses two exact canonical compositions without changing Steady definition or capture defaults', () => {
  assert.equal(EQUIPMENT_MASTERY_DEFINITION_VERSION, 'xonix-mastery-definition.v2');
  assert.equal(masteryDefinitionIdentity(STEADY_SIGNAL), 'mastery-v1-2e6aae3f42f3d3c2');
  assert.equal(masteryDefinitionIdentity(SUPPLY_LINE), 'mastery-v1-a3ffbfe068645ff0');
  assert.equal(masteryDefinitionIdentity(SAFE_RETURN), 'mastery-v1-197b5a9a9370f0f2');
  const reversed = clone(SUPPLY_LINE);
  reversed.all.reverse();
  reversed.all[1].regions.reverse();
  reversed.all[2].padIds.reverse();
  assert.deepEqual(resolveMasteryDefinition(reversed), resolveMasteryDefinition(SUPPLY_LINE));
  assert.ok(Object.isFrozen(SUPPLY_LINE.all[1].regions[0]));
  const owned = resolveMasteryDefinition(SUPPLY_LINE);
  owned.all[0].padIds.pop();
  assert.equal(SUPPLY_LINE.all[0].padIds.length, 2);
  const state = createRun(pack.campaigns[0].levels[0], { classId: 'fiber' });
  const { definition: ignored, ...binding } = bindingFor(STEADY_SIGNAL);
  assert.deepEqual(
    captureMasterySetup(state, binding),
    captureMasterySetup(state, { ...binding, definition: STEADY_SIGNAL }),
  );
  assert.deepEqual(
    captureMasteryFacts(state, binding),
    captureMasteryFacts(state, { ...binding, definition: STEADY_SIGNAL }),
  );
  assert.equal(Object.hasOwn(captureMasteryFacts(state, binding), 'version'), false);
});

test('v2 rejects unknown versions, partial compositions, duplicate references and bounded-data violations', () => {
  const mutations = [
    (d) => {
      d.version = 'xonix-mastery-definition.v3';
    },
    (d) => {
      d.version = 'xonix-mastery-definition.v1';
    },
    (d) => {
      d.extra = true;
    },
    (d) => {
      delete d.revision;
    },
    (d) => {
      d.all.pop();
    },
    (d) => {
      d.all.push({ type: 'clean-win' });
    },
    (d) => {
      d.all[0].padIds.push(d.all[0].padIds[0]);
    },
    (d) => {
      d.all[0].padIds = [];
    },
    (d) => {
      d.all[0].padIds = ['a', 'b', 'c', 'd', 'e'];
    },
    (d) => {
      d.all[1].regions.push(clone(d.all[1].regions[0]));
    },
    (d) => {
      d.all[1].regions[0].minCells = 0;
    },
    (d) => {
      d.all[1].regions[0].minCells = Infinity;
    },
    (d) => {
      d.all[1].regions[0].minCells = 2.5;
    },
    (d) => {
      d.all[1].regions[0].zoneId = 'constructor';
    },
    (d) => {
      d.all[2].script = 'doSomething()';
    },
    (d) => {
      d.description = 'x'.repeat(513);
    },
    (d) => {
      delete d.all[1];
    },
  ];
  for (const mutate of mutations) {
    const value = clone(SUPPLY_LINE);
    mutate(value);
    assert.equal(validateMasteryDefinition(value).valid, false);
  }
  for (const value of [
    null,
    undefined,
    JSON.stringify(SUPPLY_LINE),
    { ...clone(SAFE_RETURN), all: [{ type: 'clean-win' }] },
  ])
    assert.equal(validateMasteryDefinition(value).valid, false);
});

test('definition version and nested throwing accessors never execute; null-prototype data remains supported', () => {
  let calls = 0;
  for (const [rootKey, childKey] of [['version'], ['all'], ['all', '0']]) {
    const value = clone(SUPPLY_LINE),
      target = childKey ? value[rootKey] : value;
    Object.defineProperty(target, childKey ?? rootKey, {
      enumerable: true,
      get() {
        calls++;
        throw Error('getter');
      },
    });
    assert.equal(validateMasteryDefinition(value).valid, false);
    assert.throws(() =>
      captureMasteryFacts(runFor(SUPPLY_LINE), { ...bindingFor(SUPPLY_LINE), definition: value }),
    );
  }
  assert.equal(calls, 0);
  const value = Object.assign(Object.create(null), clone(SUPPLY_LINE));
  assert.deepEqual(resolveMasteryDefinition(value), resolveMasteryDefinition(SUPPLY_LINE));
});

test('setup binds actual normalized references, all recipes and original run without touching state', () => {
  for (const definition of [SUPPLY_LINE, SAFE_RETURN]) {
    const state = runFor(definition),
      before = authoritativeCheckpoint(state),
      binding = bindingFor(definition);
    const setup = captureMasterySetup(state, binding);
    assert.deepEqual(authoritativeCheckpoint(state), before);
    assert.equal(setup.version, 'xonix-mastery-setup.v2');
    assert.equal(setup.definitionIdentity, masteryDefinitionIdentity(definition));
    assert.equal(setup.classId, state.classId);
    assert.equal(setup.references.classes.length, 7);
    const observer = createMasteryObserver({
      definition,
      setup,
      initial: captureMasteryFacts(state, binding),
    });
    setup.references.classes[0].id = 'changed';
    assert.notEqual(observer.snapshot().setup.references.classes[0].id, 'changed');
    stepRun(state, {}, FIXED_DT);
    assert.throws(() => captureMasterySetup(state, binding), /fresh/);
  }
});

test('unknown pad/region/hangar/class/actor and wrong campaign cannot start an observer', () => {
  for (const [definition, mutate] of [
    [
      SUPPLY_LINE,
      (d) => {
        d.all[0].padIds[0] = 'missing';
      },
    ],
    [
      SUPPLY_LINE,
      (d) => {
        d.all[1].regions[0].zoneId = 'missing';
      },
    ],
    [
      SUPPLY_LINE,
      (d) => {
        d.all[2].hangarId = 'missing';
      },
    ],
    [
      SUPPLY_LINE,
      (d) => {
        d.all[2].classId = 'missing';
      },
    ],
    [
      SAFE_RETURN,
      (d) => {
        d.all[1].actorId = 'missing';
      },
    ],
    [
      SAFE_RETURN,
      (d) => {
        d.campaignId = 'another';
      },
    ],
  ]) {
    const candidate = clone(definition);
    mutate(candidate);
    assert.throws(() =>
      captureMasterySetup(runFor(definition), { ...bindingFor(definition), definition: candidate }),
    );
  }
});

test('valid fractional signal rectangles and default enemy radius use core normalized values', () => {
  const supplyLevel = clone(pack.campaigns[0].levels[1]);
  supplyLevel.signalZones[0].x = 2.25;
  supplyLevel.signalZones[0].w = 3.5;
  const setup = captureMasterySetup(runFor(SUPPLY_LINE, {}, supplyLevel), bindingFor(SUPPLY_LINE));
  assert.equal(setup.references.regions.find((r) => r.id === 'west-emitter').x, 2.25);
  const impactLevel = clone(pack.campaigns[0].levels[2]);
  delete impactLevel.enemies[0].radius;
  const state = runFor(SAFE_RETURN, {}, impactLevel),
    observer = observeRun(SAFE_RETURN, state);
  assert.equal(observer.snapshot().setup.references.actor.radius, 0.25);
  const patrol = clone(impactLevel);
  patrol.enemies[0] = { id: 'cable-cutter', type: 'border-patrol', x: 0.5, y: 18.5, speed: 1 };
  assert.throws(() => observeRun(SAFE_RETURN, runFor(SAFE_RETURN, {}, patrol)), /actor/);
});

test('suppressed crossings require live-cut endpoints, half-open geometry and core expiry tolerance', () => {
  const s = stream();
  s.send({
    player: { ...s.facts.player, x: 2.5, y: 18.5 },
    regions: s.facts.regions.map((r) => ({ ...r, suppressedUntil: 20 })),
  });
  assert.equal(region(s.observer.snapshot()).pendingCells, 0, 'Safe ground contributes nothing.');
  s.sample(2.5, 18.5, { suppressedUntil: 0 });
  assert.equal(region(s.observer.snapshot()).pendingCells, 0);
  s.sample(2.5, 18.5, { suppressedUntil: (s.facts.tick + 1) * FIXED_DT + 1e-9 });
  assert.equal(region(s.observer.snapshot()).pendingCells, 0, 'Expiry tie is inactive.');
  s.sample(2.5, 18.5, { suppressedUntil: (s.facts.tick + 1) * FIXED_DT + 2e-9 });
  for (let i = 0; i < 20; i++) s.sample(2.5, 18.5);
  assert.equal(
    region(s.observer.snapshot()).pendingCells,
    1,
    'Repeated dwell adds one distinct cell.',
  );
  s.sample(6, 18.5);
  s.sample(3.5, 21);
  assert.equal(
    region(s.observer.snapshot()).pendingCells,
    1,
    'Right and bottom edges are outside.',
  );
  s.sample(3, 16);
  const preview = s.close();
  assert.equal(region(preview).bestClosedCells, 2);
  assert.equal(region(preview).pendingCells, 0);
  assert.equal(preview.qualified, false, 'Crossing does not replace the other goals or a win.');
});

test('short closed cuts never sum; failure and shield discard open crossings', () => {
  const s = stream();
  s.sample(2.5, 18.5);
  s.close();
  s.sample(3.5, 18.5);
  s.close();
  assert.equal(region(s.observer.snapshot()).bestClosedCells, 1);
  for (const type of ['player.failed', 'shield.absorbed']) {
    s.sample(2.5, 18.5);
    s.sample(3.5, 18.5);
    s.recover(type);
    assert.equal(region(s.observer.snapshot()).pendingCells, 0);
    s.returned();
    assert.equal(region(s.observer.snapshot()).bestClosedCells, 1);
  }
});

test('closure before recovery banks only the completed cut in original event order', () => {
  const s = stream();
  s.sample(2.5, 18.5);
  s.sample(3.5, 18.5);
  const preview = s.send(
    {
      status: 'respawning',
      lives: 2,
      player: { ...s.facts.player, cutting: false, cutStartedAt: null, trailCellCount: 0 },
    },
    ['cut.closed', 'player.failed'],
  );
  assert.equal(region(preview).bestClosedCells, 2);
  assert.equal(region(preview).pendingCells, 0);
  assert.equal(preview.cleanSoFar, false);
});

test('impact redeployment also discards a Supply cut while retaining an earlier closed crossing', () => {
  const s = stream(SUPPLY_LINE, { classId: 'impact' });
  s.sample(2.5, 18.5);
  s.sample(3.5, 18.5);
  s.close();
  s.sample(4.5, 18.5);
  s.sample(5.5, 18.5);
  s.pulse({ hit: false });
  assert.equal(region(s.observer.snapshot()).bestClosedCells, 2);
  assert.equal(region(s.observer.snapshot()).pendingCells, 0);
});

test('Supply stores distinct successful pads and one real switch; a later life loss is not a clean-win gate', () => {
  const s = stream();
  s.send({}, [{ type: 'pickup.collected', id: 'west-supply', ammo: 1 }]);
  s.send({}, [{ type: 'pickup.collected', id: 'west-supply', ammo: 1 }]);
  assert.deepEqual(predicate(s.observer.snapshot(), 'supply-pickups').collectedPadIds, [
    'west-supply',
  ]);
  for (const y of [18.5]) {
    s.sample(2.5, y);
    s.sample(3.5, y);
    s.close();
  }
  const recipe = s.setup.references.classes.find((c) => c.id === 'carrier');
  s.send({ activeClass: recipe, classSequence: 1, classChangedAt: s.facts.tick + 1 }, [
    { type: 'class.switched', classId: 'carrier', hangarId: 'south-hangar' },
  ]);
  s.send({}, [{ type: 'pickup.collected', id: 'south-supply', ammo: 2 }]);
  s.sample(30.5, 33.5);
  s.sample(30.5, 32.5);
  s.close();
  s.sample(12.5, 12.5);
  s.recover();
  s.returned();
  s.sample(12.5, 12.5);
  const preview = s.close('won');
  assert.equal(preview.cleanSoFar, false);
  assert.equal(preview.qualified, true);
  assert.equal(preview.setup.classId, 'bomber');
  assert.deepEqual(
    preview.classHistory.map((c) => c.classId),
    ['bomber', 'carrier'],
  );
});

test('actual full-pad and unsafe switch rejections produce no invented completion facts', () => {
  const state = runFor(SUPPLY_LINE),
    binding = bindingFor(SUPPLY_LINE),
    observer = observeRun(SUPPLY_LINE, state);
  for (const command of [
    { pickup: true },
    {},
    { pickup: true },
    { direction: 'right', boost: true },
    ...Array.from({ length: 10 }, () => ({ direction: 'right', boost: true })),
    { switchClass: 'carrier' },
  ]) {
    stepRun(state, command, FIXED_DT);
    observer.observe(captureMasteryFacts(state, binding));
  }
  assert.ok(state.events.some((e) => e.type === 'class.rejected' && e.reason === 'unsafe'));
  const view = observer.snapshot();
  assert.deepEqual(predicate(view, 'supply-pickups').collectedPadIds, ['west-supply']);
  assert.equal(predicate(view, 'hangar-switch').satisfied, false);
});

test('starting as the target equipment is not a successful hangar switch', () => {
  const s = stream(SUPPLY_LINE, { classId: 'carrier' });
  assert.equal(predicate(s.observer.snapshot(), 'hangar-switch').satisfied, false);
  const state = s.state,
    binding = bindingFor(SUPPLY_LINE);
  stepRun(state, { switchClass: 'carrier' }, FIXED_DT);
  s.observer.observe(captureMasteryFacts(state, binding));
  assert.equal(predicate(s.observer.snapshot(), 'hangar-switch').satisfied, false);
});

test('Safe Return requires the complete same-pulse return, followed by a clean winning closure', () => {
  const s = stream(SAFE_RETURN);
  s.prepareImpact(3);
  assert.equal(predicate(s.pulse(), 'live-cut-impact').phase, 'awaiting-return');
  assert.equal(s.observer.snapshot().qualified, false);
  s.send();
  assert.equal(predicate(s.observer.snapshot(), 'live-cut-impact').phase, 'awaiting-return');
  assert.equal(predicate(s.returned(), 'live-cut-impact').phase, 'returned');
  s.sample(12.5, 12.5);
  const preview = s.close('won');
  assert.equal(preview.qualified, true);
  assert.equal(preview.authority, 'preview-only');
});

for (const [name, count, hit, stunned] of [
  ['short cut', 2, true, true],
  ['wrong actor overlap despite another stun', 3, false, true],
  ['overlap without actual stun', 3, true, false],
])
  test(`Safe Return rejects ${name}`, () => {
    const s = stream(SAFE_RETURN);
    s.prepareImpact(count, { hit });
    s.pulse({ hit, actorStunned: stunned });
    s.returned();
    s.sample(12.5, 12.5);
    const preview = s.close('won');
    assert.equal(predicate(preview, 'live-cut-impact').phase, 'not-started');
    assert.equal(preview.qualified, false);
  });

test('pulse on safe ground cannot count; an unrelated old stun cannot replace the new pulse', () => {
  const s = stream(SAFE_RETURN);
  s.send({
    player: { ...s.facts.player, x: 24.5, y: 6.5 },
    actor: { ...s.facts.actor, x: 26, y: 3.5, stunnedUntil: 20 },
  });
  s.pulse();
  s.returned();
  assert.equal(predicate(s.observer.snapshot(), 'live-cut-impact').phase, 'not-started');
  const other = stream(SAFE_RETURN);
  other.prepareImpact();
  other.send({ actor: { ...other.facts.actor, stunnedUntil: 20 } });
  other.close('won');
  assert.equal(other.observer.snapshot().qualified, false);
});

test('a clean pulse and completed recovery never erase an earlier lost life', () => {
  const s = stream(SAFE_RETURN);
  s.sample(12.5, 12.5);
  s.recover();
  s.returned();
  s.prepareImpact();
  s.pulse();
  s.returned();
  s.sample(12.5, 12.5);
  const preview = s.close('won');
  assert.equal(predicate(preview, 'live-cut-impact').phase, 'returned');
  assert.equal(preview.cleanSoFar, false);
  assert.equal(preview.qualified, false);
});

test('timeout during impact recovery discards the pending candidate and cannot award', () => {
  const s = stream(SAFE_RETURN);
  s.prepareImpact();
  s.pulse();
  const preview = s.send({ status: 'lost' }, ['run.completed']);
  assert.equal(predicate(preview, 'live-cut-impact').phase, 'not-started');
  assert.equal(preview.qualified, false);
  assert.throws(() => s.send(), /nonterminal/);
});

test('an actual core timeout on the pulse tick remains an unqualified loss, without observer failure', () => {
  const level = clone(pack.campaigns[0].levels[2]);
  level.rules.timeLimitSeconds = 0.875;
  const state = runFor(SAFE_RETURN, {}, level),
    observer = observeRun(SAFE_RETURN, state),
    binding = bindingFor(SAFE_RETURN);
  for (let tick = 1; tick <= 105; tick++) {
    stepRun(state, tick === 105 ? { action: true } : { direction: 'down', boost: true }, FIXED_DT);
    observer.observe(captureMasteryFacts(state, binding));
  }
  assert.ok(state.events.some((event) => event.type === 'craft.redeployed'));
  assert.equal(state.status, 'lost');
  assert.equal(observer.snapshot().qualified, false);
});

test('an omitted recovery event or reused pulse identity cannot certify a return', () => {
  const s = stream(SAFE_RETURN);
  s.prepareImpact();
  s.pulse({ fieldId: 'known-pulse' });
  const missing = s.next({ status: 'running' });
  assert.throws(() => s.observer.observe(missing), /matching event/);
  assert.equal(predicate(s.observer.snapshot(), 'live-cut-impact').phase, 'awaiting-return');
  s.returned();
  s.prepareImpact();
  assert.throws(() => s.pulse({ fieldId: 'known-pulse' }), /new field/);
});

test('invalid fact/recovery/class samples reject atomically without poisoning the valid next tick', () => {
  const s = stream(),
    mutations = [
      (f) => {
        f.version = 'xonix-mastery-facts.v1';
      },
      (f) => {
        f.extra = 1;
      },
      (f) => {
        f.tick++;
      },
      (f) => {
        f.runId = 'different';
      },
      (f) => {
        f.identity.seed++;
      },
      (f) => {
        f.lives++;
      },
      (f) => {
        f.regions.pop();
      },
      (f) => {
        f.regions[0].id = 'missing';
      },
      (f) => {
        f.activeClass.radius++;
      },
      (f) => {
        f.classSequence++;
      },
      (f) => {
        f.player.trailCellCount = 3;
      },
      (f) => {
        f.time = NaN;
      },
      (f) => {
        f.events = [{ type: 'player.respawned', tick: f.tick, time: f.time }];
      },
      (f) => {
        f.status = 'respawning';
      },
      (f) => {
        f.events = [
          { type: 'pickup.collected', tick: f.tick, time: f.time, id: 'missing', ammo: 1 },
        ];
      },
    ];
  const before = s.observer.snapshot();
  for (const mutate of mutations) {
    const candidate = s.next();
    mutate(candidate);
    assert.throws(() => s.observer.observe(candidate));
    assert.deepEqual(s.observer.snapshot(), before);
  }
  s.send();
  assert.equal(s.observer.snapshot().tick, 1);
});

test('impact fields must belong to that successful use and events keep redeployment before ability', () => {
  const s = stream(SAFE_RETURN);
  s.prepareImpact();
  const t = stream(SAFE_RETURN);
  t.prepareImpact();
  t.pulse();
  const candidate = clone(t.facts),
    before = s.observer.snapshot();
  for (const mutate of [
    (f) => {
      f.events.reverse();
    },
    (f) => {
      f.impactField = null;
    },
    (f) => {
      f.impactField.x++;
    },
    (f) => {
      f.impactField.until++;
    },
    (f) => {
      f.events[1].primitive = 'stun-field';
    },
    (f) => {
      f.actor.id = 'wrong';
    },
  ]) {
    const value = clone(candidate);
    mutate(value);
    assert.throws(() => s.observer.observe(value));
    assert.deepEqual(s.observer.snapshot(), before);
  }
  s.observer.observe(candidate);
  assert.equal(predicate(s.observer.snapshot(), 'live-cut-impact').phase, 'awaiting-return');
});

test('setup and fact accessors never run; snapshots and captured facts remain independently owned', () => {
  let calls = 0;
  const state = runFor(SAFE_RETURN),
    binding = bindingFor(SAFE_RETURN),
    setup = captureMasterySetup(state, binding),
    initial = captureMasteryFacts(state, binding);
  const poisoned = clone(setup);
  Object.defineProperty(poisoned.references, 'actor', {
    enumerable: true,
    get() {
      calls++;
      throw Error('getter');
    },
  });
  assert.throws(() => createMasteryObserver({ definition: SAFE_RETURN, setup: poisoned, initial }));
  const s = stream(SAFE_RETURN),
    candidate = s.next();
  Object.defineProperty(candidate.player, 'x', {
    enumerable: true,
    get() {
      calls++;
      throw Error('getter');
    },
  });
  assert.throws(() => s.observer.observe(candidate));
  assert.equal(calls, 0);
  initial.actor.x = 1;
  assert.notEqual(state.enemies[0].x, 1);
  const view = s.observer.snapshot();
  view.setup.references.actor.id = 'changed';
  view.predicates[1].phase = 'returned';
  assert.equal(predicate(s.observer.snapshot(), 'live-cut-impact').phase, 'not-started');
  assert.equal(s.observer.snapshot().setup.references.actor.id, 'cable-cutter');
});

test('new-run fragments and changed definition/setup cannot reuse partial equipment progress', () => {
  const s = stream();
  s.sample(2.5, 18.5);
  s.sample(3.5, 18.5);
  s.close();
  const other = stream();
  assert.equal(region(other.observer.snapshot()).bestClosedCells, 0);
  const foreign = s.next();
  foreign.runId = 'another-run';
  assert.throws(() => s.observer.observe(foreign));
  const changed = clone(SUPPLY_LINE);
  changed.all[1].regions[0].minCells++;
  assert.throws(
    () =>
      createMasteryObserver({
        definition: changed,
        setup: s.setup,
        initial: captureMasteryFacts(s.state, bindingFor(SUPPLY_LINE)),
      }),
    /binding/,
  );
  assert.throws(
    () => createMasteryObserver({ definition: SUPPLY_LINE, setup: s.setup, initial: s.facts }),
    /fresh/,
  );
});

for (const definition of [SUPPLY_LINE, SAFE_RETURN])
  for (const policy of ['immediate', 'grid-center'])
    for (const variant of ['specialty', 'fallback']) {
      const route = proof.routes.find(
        (r) =>
          r.levelId === definition.levelId &&
          r.turnPolicy === policy &&
          r.variant === variant &&
          (variant === 'specialty' || r.classId === 'interceptor'),
      );
      test(`legal ${route.id} preserves its archived checkpoint and optional qualification`, () => {
        const state = runFor(definition, { classId: route.classId, turnPolicy: policy }),
          observer = observeRun(definition, state),
          binding = bindingFor(definition);
        const moments = new Map();
        for (const segment of route.segments)
          for (let i = 0; i < segment.ticks; i++) {
            stepRun(state, segment.input, FIXED_DT);
            observer.observe(captureMasteryFacts(state, binding));
            if ([104, 105, 181, 182, 467, 813, 814, 980].includes(state.tick))
              moments.set(state.tick, observer.snapshot());
          }
        assert.deepEqual(getSummary(state), route.expected);
        assert.deepEqual(authoritativeCheckpoint(state), route.checkpoint);
        const view = observer.snapshot();
        assert.equal(view.qualified, variant === 'specialty');
        assert.equal(view.status, 'won');
        assert.equal(view.setup.classId, route.classId);
        if (variant === 'specialty' && definition === SUPPLY_LINE) {
          assert.equal(region(moments.get(467)).bestClosedCells, 4);
          assert.equal(region(moments.get(980), 'south-emitter').bestClosedCells, 3);
          assert.equal(predicate(moments.get(813), 'hangar-switch').satisfied, true);
          assert.deepEqual(predicate(moments.get(814), 'supply-pickups').collectedPadIds, [
            'south-supply',
            'west-supply',
          ]);
        }
        if (variant === 'specialty' && definition === SAFE_RETURN) {
          assert.equal(predicate(moments.get(104), 'live-cut-impact').phase, 'not-started');
          for (const tick of [105, 181])
            assert.equal(predicate(moments.get(tick), 'live-cut-impact').phase, 'awaiting-return');
          assert.equal(predicate(moments.get(182), 'live-cut-impact').phase, 'returned');
        }
      });
    }

for (const comparison of proof.comparisons)
  test(`legal action omission ${comparison.levelId}/${comparison.turnPolicy} preserves the actual bounded outcome without a seal`, () => {
    const definition = comparison.levelId === SUPPLY_LINE.levelId ? SUPPLY_LINE : SAFE_RETURN,
      replay = comparison.replay;
    const state = createRun(replay.level, replay.options),
      observer = observeRun(definition, state),
      binding = bindingFor(definition);
    for (const segment of replay.segments)
      for (let i = 0; i < segment.ticks; i++) {
        stepRun(state, segment.input, FIXED_DT);
        observer.observe(captureMasteryFacts(state, binding));
      }
    assert.deepEqual(getSummary(state), replay.summary);
    assert.deepEqual(authoritativeCheckpoint(state), replay.checkpoint);
    assert.equal(observer.snapshot().qualified, false);
    if (definition === SUPPLY_LINE) {
      assert.equal(state.status, 'running');
      assert.equal(predicate(observer.snapshot(), 'hangar-switch').satisfied, false);
      assert.ok(
        predicate(observer.snapshot(), 'suppressed-region-crossings').regions.every(
          (r) => r.bestClosedCells === 0,
        ),
      );
    } else {
      assert.equal(state.status, 'won');
      assert.equal(state.lives, 2);
    }
  });

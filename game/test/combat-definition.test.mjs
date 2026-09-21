import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, validateLevel } from '../core/index.mjs';
import {
  validateCombatPatrols,
  COMBAT_RADIUS,
  COMBAT_SHOT_RADIUS,
} from '../core/combat-definition.mjs';

const scout = (overrides = {}) => ({
  id: 'scout',
  role: 'scout',
  x: 8.5,
  y: 18.5,
  headingX: 1,
  headingY: 0,
  speed: 1.8,
  turnTicks: 120,
  ...overrides,
});
const sentry = (overrides = {}) => ({
  ...scout(),
  id: 'sentry',
  role: 'sentry',
  senseRadius: 16,
  scanTicks: 30,
  openingTicks: 480,
  warningTicks: 180,
  recoveryTicks: 180,
  restTicks: 1200,
  shotSpeed: 8,
  shotLifeTicks: 360,
  ...overrides,
});
function level(version = 5) {
  return {
    version: `xonix-level.v${version}`,
    id: 'combat-descriptor-check',
    revision: '1',
    width: 72,
    height: 36,
    spawn: { x: 0.5, y: 18.5 },
    foundations: [],
    walls: [],
    encounter: null,
    goal: { coverage: 0.99 },
    enemies: [{ id: 'keeper', type: 'bouncer', x: 60.5, y: 8.5, vx: 0, vy: 0 }],
    objectives: [],
    supplies: [],
    classic: {
      version: 'classic.v1',
      terrain: [],
      powerups: [],
      combatPatrols: { version: 'combat-patrols.v1', enabled: true, actors: [scout()] },
    },
    ...(version >= 6 ? { relayGates: { version: 'relay-gates.v1', gates: [] } } : {}),
    ...(version >= 7 ? { directionalFields: { version: 'directional-fields.v1', zones: [] } } : {}),
  };
}
const definition = (source) => source.classic.combatPatrols;
const actor = (source) => definition(source).actors[0];
function rejects(source, message) {
  assert.equal(validateLevel(source).valid, false, message);
  assert.throws(() => createRun(source), undefined, message);
}
function accepts(source) {
  const result = validateLevel(source);
  assert.equal(result.valid, true, result.errors.join('; '));
  assert.doesNotThrow(() => createRun(source));
}

test('combat descriptors are optional and restricted to foundation-aware v5..v8', () => {
  assert.equal(COMBAT_RADIUS, 0.22);
  assert.equal(COMBAT_SHOT_RADIUS, 0.1);
  assert.doesNotThrow(() => validateCombatPatrols({ classic: {} }, {}));
  for (const version of [5, 6, 7, 8]) {
    const source = level(version);
    accepts(source);
    definition(source).enabled = false;
    accepts(source);
    definition(source).actors = [];
    accepts(source);
    delete source.classic.combatPatrols;
    accepts(source);
  }
  for (const version of [1, 2, 3, 4]) {
    const source = level();
    source.version = `xonix-level.v${version}`;
    delete source.foundations;
    if (version <= 2) source.width = 48;
    for (const enabled of [true, false]) {
      definition(source).enabled = enabled;
      rejects(source, `version ${version}, enabled ${enabled}`);
      assert.match(validateLevel(source).errors.join('; '), /combat patrols require foundation/);
    }
  }
});

test('strict descriptor and role-specific keys reject missing, unknown and malformed data even when disabled', () => {
  for (const change of [
    (s) => (s.classic.combatPatrols = null),
    (s) => (s.classic.combatPatrols = []),
    (s) => (definition(s).version = 'combat-patrols.v2'),
    (s) => delete definition(s).version,
    (s) => delete definition(s).enabled,
    (s) => (definition(s).enabled = 1),
    (s) => delete definition(s).actors,
    (s) => (definition(s).actors = {}),
    (s) => (definition(s).actors = [null]),
    (s) => (definition(s).decals = true),
    (s) => (actor(s).script = 'fire()'),
    (s) => (actor(s).role = 'trooper'),
    (s) => (actor(s).shotSpeed = 8),
    ...Object.keys(scout()).map((key) => (s) => delete actor(s)[key]),
    ...Object.keys(sentry())
      .filter((key) => !Object.hasOwn(scout(), key))
      .map((key) => (s) => {
        definition(s).actors = [sentry()];
        delete actor(s)[key];
      }),
  ])
    for (const enabled of [true, false]) {
      const source = level();
      definition(source).enabled = enabled;
      change(source);
      rejects(source, `${change}, enabled ${enabled}`);
    }
});

test('all numeric bounds are explicit, finite and inclusive; tick values must be integers', () => {
  for (const [key, low, high, ticks] of [
    ['speed', 0.25, 8, false],
    ['turnTicks', 30, 1200, true],
    ['senseRadius', 4, 24, false],
    ['scanTicks', 12, 120, true],
    ['openingTicks', 240, 2400, true],
    ['warningTicks', 120, 480, true],
    ['recoveryTicks', 120, 600, true],
    ['restTicks', 360, 3600, true],
    ['shotSpeed', 4, 12, false],
    ['shotLifeTicks', 120, 600, true],
  ]) {
    for (const value of [low, high]) {
      const source = level();
      definition(source).actors = [sentry({ [key]: value })];
      accepts(source);
    }
    for (const value of [
      low - 0.01,
      high + 0.01,
      Infinity,
      -Infinity,
      NaN,
      String(low),
      ...(ticks ? [low + 0.5] : []),
    ]) {
      const source = level();
      definition(source).enabled = false;
      definition(source).actors = [sentry({ [key]: value })];
      rejects(source, `${key}: ${value}`);
    }
  }
  for (const headingX of [-1, 0, 1])
    for (const headingY of [-1, 0, 1]) {
      const source = level();
      Object.assign(actor(source), { headingX, headingY });
      if (headingX || headingY) accepts(source);
      else rejects(source, 'zero heading');
    }
  for (const key of ['headingX', 'headingY'])
    for (const value of [-2, 2, 0.5, NaN, '1']) {
      const source = level();
      actor(source)[key] = value;
      rejects(source, `${key}: ${value}`);
    }
});

test('bounded populations allow 24 patrols with 8 sentries and reject either excess', () => {
  const source = level();
  definition(source).actors = Array.from({ length: 24 }, (_, i) =>
    (i < 8 ? sentry : scout)({ id: `actor-${i}`, x: 5.5 + i, y: 10.5 }),
  );
  accepts(source);
  definition(source).enabled = false;
  definition(source).actors.push(scout({ id: 'excess', x: 40.5, y: 10.5 }));
  rejects(source, '25 patrols');
  definition(source).actors.pop();
  definition(source).actors[8] = sentry({ id: 'ninth-sentry', x: 40.5, y: 10.5 });
  rejects(source, '9 sentries');
});

test('starts require legal unclaimed geometry, centered coordinates and two cells of spawn clearance', () => {
  for (const change of [
    (s) => (actor(s).x = 8),
    (s) => (actor(s).y = 18),
    (s) => (actor(s).x = 0.5),
    (s) => (actor(s).x = 71.5),
    (s) => (actor(s).y = 35.5),
    (s) => (actor(s).x = 1.5),
    (s) => (actor(s).x = Infinity),
    (s) => s.walls.push({ x: 8, y: 18, w: 1, h: 1 }),
    (s) => s.foundations.push({ x: 8, y: 18, w: 1, h: 1 }),
  ])
    for (const enabled of [true, false]) {
      const source = level();
      definition(source).enabled = enabled;
      change(source);
      rejects(source, `${change}, enabled ${enabled}`);
    }
  const exactClearance = level();
  actor(exactClearance).x = 2.5;
  accepts(exactClearance);
  const gate = level(6);
  gate.objectives.push({ id: 'switch', x: 20.5, y: 20.5 });
  gate.relayGates.gates.push({ id: 'connector', x: 8, y: 18, w: 1, h: 1, objectiveId: 'switch' });
  for (const enabled of [true, false]) {
    definition(gate).enabled = enabled;
    rejects(gate, 'closed relay connector');
  }
  for (const kind of ['slow', 'lethal']) {
    const source = level();
    source.classic.terrain.push({ id: 'terrain', kind, x: 8, y: 18, w: 1, h: 1 });
    accepts(source); // Terrain effects apply only to the craft.
  }
});

test('patrol starts cannot overlap patrols or field enemies, including continuous-radius overlap', () => {
  for (const enabled of [true, false]) {
    const duplicate = level();
    definition(duplicate).enabled = enabled;
    definition(duplicate).actors.push(sentry({ id: 'other' }));
    rejects(duplicate, 'overlapping patrols');
    for (const type of ['bouncer', 'eroder', 'lane-boss']) {
      const source = level();
      definition(source).enabled = enabled;
      source.enemies = [
        {
          id: 'field-enemy',
          type,
          x: 8.8,
          y: 18.5,
          radius: 0.25,
          ...(type === 'lane-boss' ? { axis: 'horizontal' } : { vx: 0, vy: 0 }),
        },
      ];
      rejects(source, `continuous overlap with ${type}`);
    }
  }
  const clear = level();
  clear.enemies[0].x = 9;
  clear.enemies[0].y = 18.5;
  accepts(clear);
  clear.enemies[0].x = 8.5 - (COMBAT_RADIUS + 0.25);
  accepts(clear); // Tangency is not initial overlap, including decimal rounding.
});

test('patrol IDs are globally unique across entities, terrain, bonuses, relays and directional zones', () => {
  for (const id of ['', 'bad id', '__proto__', 'constructor', 'a'.repeat(81), 'keeper']) {
    const source = level();
    actor(source).id = id;
    rejects(source, `invalid or duplicate ID: ${id}`);
  }
  for (const register of [
    (s) => definition(s).actors.push(scout({ x: 12.5 })),
    (s) => s.objectives.push({ id: 'scout', x: 30.5, y: 12.5 }),
    (s) => s.supplies.push({ id: 'scout', x: 30.5, y: 12.5 }),
    (s) => (s.hangars = [{ id: 'scout', x: 0.5, y: 2.5 }]),
    (s) => (s.signalZones = [{ id: 'scout', x: 30, y: 12, w: 1, h: 1, speedFactor: 1 }]),
    (s) => s.classic.terrain.push({ id: 'scout', kind: 'slow', x: 30, y: 12, w: 1, h: 1 }),
    (s) => s.classic.powerups.push({ id: 'scout', kind: 'enemy-freeze', x: 30.5, y: 12.5 }),
    (s) =>
      (s.classic.timedBonuses = {
        version: 'timed-bonuses.v1',
        schedules: [
          {
            id: 'scout',
            kind: 'extra-life',
            anchors: [
              { x: 30.5, y: 12.5 },
              { x: 31.5, y: 12.5 },
            ],
            initialDelayTicks: 0,
            announcementTicks: 120,
            availableTicks: 240,
            cooldownTicks: 240,
            maxAppearances: 1,
            maxCollections: 1,
          },
        ],
      }),
    (s) => {
      s.objectives.push({ id: 'switch', x: 20.5, y: 20.5 });
      s.relayGates.gates.push({ id: 'scout', x: 30, y: 12, w: 1, h: 1, objectiveId: 'switch' });
    },
    (s) =>
      s.directionalFields.zones.push({ id: 'scout', x: 30, y: 12, w: 1, h: 1, direction: 'right' }),
  ]) {
    const source = level(7);
    definition(source).enabled = false;
    register(source);
    rejects(source, register.toString());
  }
});

test('the public JSON boundary rejects executable values and sparse arrays without invoking accessors', () => {
  let invoked = 0;
  const accessor = level();
  Object.defineProperty(actor(accessor), 'speed', {
    enumerable: true,
    get() {
      invoked++;
      return 1;
    },
  });
  rejects(accessor, 'getter');
  assert.equal(invoked, 0);
  const executable = level();
  actor(executable).speed = () => 1;
  rejects(executable, 'executable speed');
  const sparse = level();
  definition(sparse).actors.length = 2;
  rejects(sparse, 'sparse actors');
});

test('synthesized home IDs respect authored combat IDs even in disabled descriptors', () => {
  for (const enabled of [true, false]) {
    const source = level();
    definition(source).enabled = enabled;
    actor(source).id = 'home-hangar';
    const run = createRun(source);
    assert.equal(run.level.hangars[0].id, 'home-hangar-1');
    assert.equal(source.hangars, undefined);
    assert.equal(actor(source).id, 'home-hangar');
  }
});

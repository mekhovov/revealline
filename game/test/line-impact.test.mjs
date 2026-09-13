import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRun, stepRun, validateLevel, FIXED_DT } from '../core/index.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';
import { suspendSession, restoreSession } from '../sessions.mjs';
import { campaignKey } from '../library.mjs';
import {
  preparePack,
  resolvePackCampaign,
  scenarioFromPack,
  emptyPackLibrary,
  installPack,
  exportPackLibrary,
  importPackLibrary,
} from '../packs.mjs';
import { validateScenario } from '../content.mjs';

const near = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);
function source(speed = 24, changes = {}) {
  return {
    version: 'xonix-level.v4',
    id: 'line-impact-test',
    revision: '1',
    name: 'Race the impact',
    width: 72,
    height: 36,
    encounter: null,
    classic: {
      version: 'classic.v1',
      terrain: [],
      powerups: [],
      lineImpact: { version: 'line-impact.v1', speed },
    },
    spawn: { x: 36.5, y: 0.5 },
    goal: { coverage: 0.99 },
    enemies: [{ id: 'seed', type: 'bouncer', x: 40.5, y: 5.5, vx: -2, vy: 0 }],
    rules: { moveSpeed: 10, lives: 3, graceSeconds: 0, respawnSeconds: 0.1, stopOnCapture: true },
    ...changes,
  };
}
function attempt(level = source(), turnPolicy = 'immediate', options = {}) {
  const setup = { turnPolicy, ...options };
  return { run: createRun(level, setup), recorder: createRecorder(level, setup), events: [] };
}
function advance(a, direction, ticks, extra = {}) {
  for (let i = 0; i < ticks; i++) {
    const input = { direction, ...extra };
    recordInput(a.recorder, input);
    stepRun(a.run, input, FIXED_DT);
    a.events.push(...structuredClone(a.run.events));
  }
}
const events = (a, type) => a.events.filter((e) => e.type === type);
const forward = (a) => a.run.classic.lineImpact.fronts.find((front) => front.direction === 1);
const replay = (a) => {
  const exported = exportReplay(a.recorder, a.run),
    checked = verifyReplay(exported);
  assert.equal(checked.match, true);
  assert.deepEqual(authoritativeCheckpoint(checked.state), authoritativeCheckpoint(a.run));
  return exported;
};

test('line-impact.v1 is bounded owned opt-in data; omitted descriptor/state remain absent', () => {
  for (const speed of [4, 24, 60]) assert.equal(validateLevel(source(speed)).valid, true);
  for (const lineImpact of [
    null,
    {},
    { version: 'line-impact.v2', speed: 24 },
    { version: 'line-impact.v1', speed: 3.99 },
    { version: 'line-impact.v1', speed: 60.01 },
    { version: 'line-impact.v1', speed: NaN },
    { version: 'line-impact.v1', speed: 24, repeat: true },
  ]) {
    const level = source();
    level.classic.lineImpact = lineImpact;
    assert.equal(validateLevel(level).valid, false);
  }
  let reads = 0;
  const hostile = source();
  Object.defineProperty(hostile.classic.lineImpact, 'speed', {
    enumerable: true,
    get() {
      reads++;
      return 24;
    },
  });
  assert.equal(validateLevel(hostile).valid, false);
  assert.equal(reads, 0);
  const absent = source();
  delete absent.classic.lineImpact;
  const old = createRun(absent);
  assert.equal(Object.hasOwn(old.level.classic, 'lineImpact'), false);
  assert.equal(Object.hasOwn(old.classic, 'lineImpact'), false);
  const owned = source(),
    run = createRun(owned);
  owned.classic.lineImpact.speed = 60;
  assert.equal(run.level.classic.lineImpact.speed, 24);
  for (const version of ['xonix-level.v1', 'xonix-level.v2', 'xonix-level.v3']) {
    const wrong = source();
    wrong.version = version;
    assert.equal(validateLevel(wrong).valid, false);
  }
});

for (const policy of ['immediate', 'grid-center']) {
  test(`${policy}: a real strike starts both fronts, repeated overlap seeds once, and the growing endpoint delays failure`, () => {
    const a = attempt(source(), policy);
    advance(a, 'down', 195);
    assert.equal(a.run.lives, 3);
    assert.equal(a.run.status, 'running');
    assert.equal(a.run.classic.lineImpact.fronts.length, 2);
    const seeded = events(a, 'lineImpact.seeded')[0];
    near(seeded.time, 1.625);
    near(seeded.distance, 4.5);
    assert.deepEqual(
      seeded.fronts.map((f) => f.direction),
      [-1, 1],
    );
    advance(a, 'down', 12);
    near(a.run.classic.lineImpact.fronts.find((f) => f.direction === -1).distance, 2.1);
    near(forward(a).distance, 6.9);
    assert.equal(events(a, 'lineImpact.seeded').length, 1);
    advance(a, 'down', 85);
    const arrival = events(a, 'lineImpact.arrived')[0];
    near(arrival.time, 17 / 7);
    near(arrival.y, 0.5 + (10 * 17) / 7);
    near(events(a, 'lineImpact.ended')[0].time, 1.8125);
    assert.equal(events(a, 'player.failed').length, 1);
    assert.equal(a.run.lives, 2);
    assert.equal(a.run.failureCause, 'enemy-trail');
    assert.deepEqual(a.run.classic.lineImpact.fronts, []);
    assert.deepEqual(a.run.classic.lineImpact.seededActorIds, []);
    replay(a);
  });
  test(`${policy}: a front follows a newly drawn right-angle extension rather than cutting across the field`, () => {
    const a = attempt(source(), policy);
    advance(a, 'down', 204);
    advance(a, 'right', 60);
    assert.equal(a.run.lives, 3);
    near(a.run.player.y, 17.5);
    near(a.run.player.x, 41.5);
    near(forward(a).x, 38.3);
    near(forward(a).y, 17.5);
    near(forward(a).distance, 18.3);
    assert.equal(events(a, 'lineImpact.seeded').length, 1);
    replay(a);
  });
  test(`${policy}: independent actors seed bounded fronts and the earliest arrival causes only one recovery`, () => {
    const level = source();
    level.enemies.push({ id: 'second', type: 'bouncer', x: 41.5, y: 8.5, vx: -2, vy: 0 });
    const a = attempt(level, policy);
    advance(a, 'down', 258);
    assert.deepEqual(
      events(a, 'lineImpact.seeded').map((e) => e.actorId),
      ['seed', 'second'],
    );
    assert.equal(a.run.classic.lineImpact.fronts.length, 3);
    assert.equal(new Set(a.run.classic.lineImpact.fronts.map((f) => f.id)).size, 3);
    advance(a, 'down', 34);
    assert.equal(events(a, 'player.failed').length, 1);
    assert.equal(events(a, 'lineImpact.arrived')[0].actorId, 'seed');
    assert.equal(a.run.classic.lineImpact.fronts.length, 0);
    replay(a);
  });
  test(`${policy}: capture before or exactly with arrival cancels the strike, but an earlier arrival still loses a life`, () => {
    const tie = 29.5 / 1.825;
    for (const [speed, success] of [
      [tie - 0.01, true],
      [tie, true],
      [tie + 0.01, false],
    ]) {
      const a = attempt(source(speed, { goal: { coverage: 0.45 } }), policy);
      advance(a, 'down', 414);
      assert.equal(a.run.status, success ? 'won' : 'respawning');
      assert.equal(a.run.lives, success ? 3 : 2);
      assert.equal(events(a, 'cut.closed').length, success ? 1 : 0);
      assert.equal(events(a, 'lineImpact.arrived').length, success ? 0 : 1);
      assert.equal(a.run.classic.lineImpact.fronts.length, 0);
      if (success) {
        near(events(a, 'cut.closed')[0].time, 3.45);
        assert.equal(events(a, 'lineImpact.cleared')[0].reason, 'capture');
      }
      replay(a);
    }
  });
  test(`${policy}: a timer at closure still outranks capture and clears pending impacts`, () => {
    const level = source(29.5 / 1.825, { goal: { coverage: 0.45 } });
    level.rules.timeLimitSeconds = 3.45;
    const a = attempt(level, policy);
    advance(a, 'down', 414);
    assert.equal(a.run.status, 'lost');
    assert.equal(a.run.failureCause, 'mission-timeout');
    assert.equal(events(a, 'cut.closed').length, 0);
    assert.equal(a.run.classic.lineImpact.fronts.length, 0);
    assert.equal(events(a, 'lineImpact.cleared')[0].reason, 'completed');
    replay(a);
  });
  test(`${policy}: enemy freeze after seeding stops actor clocks but not already travelling impacts`, () => {
    const level = source();
    level.classic.powerups = [{ id: 'freeze', kind: 'enemy-freeze', x: 36.5, y: 18.5 }];
    const a = attempt(level, policy);
    advance(a, 'down', 220);
    assert.ok(events(a, 'powerup.collected').length);
    const actorTime = a.run.classic.actorTime,
      distance = forward(a).distance;
    advance(a, 'down', 20);
    assert.equal(a.run.classic.actorTime, actorTime);
    near(forward(a).distance - distance, 4);
    advance(a, 'down', 52);
    assert.equal(events(a, 'lineImpact.arrived').length, 1);
    near(events(a, 'lineImpact.arrived')[0].time, 17 / 7);
    replay(a);
  });
  test(`${policy}: public session/replay restore preserves active fronts and resumed outcome without advancing paused state`, async () => {
    const level = source(),
      a = attempt(level, policy);
    advance(a, 'down', 210);
    const campaign = {
        version: 'xonix-campaign.v1',
        id: 'impact-session',
        revision: '1',
        levels: [level],
      },
      key = campaignKey(campaign);
    const before = authoritativeCheckpoint(a.run);
    const saved = suspendSession({
      run: a.run,
      recorder: a.recorder,
      campaignKey: key,
      themeId: 'fpv',
      bodyId: 'drone',
      runId: 'impact-session',
      savedAt: '2026-09-13T00:00:00.000Z',
      continuation: { direction: 'down' },
    });
    const restored = await restoreSession(saved, { campaign, campaignKey: key });
    assert.deepEqual(authoritativeCheckpoint(a.run), before);
    assert.deepEqual(authoritativeCheckpoint(restored.run), before);
    assert.deepEqual(restored.run.classic.lineImpact, a.run.classic.lineImpact);
    const b = { run: restored.run, recorder: restored.recorder, events: [] };
    advance(a, 'down', 82);
    advance(b, 'down', 82);
    assert.deepEqual(authoritativeCheckpoint(b.run), authoritativeCheckpoint(a.run));
    assert.deepEqual(events(b, 'lineImpact.arrived'), events(a, 'lineImpact.arrived'));
    replay(a);
    replay(b);
  });
}

test('direct safe-ground body collision and old immediate trail failure remain unchanged', () => {
  const level = source();
  level.enemies = [
    { id: 'rail', type: 'border-patrol', x: 40.5, y: 0.5, speed: 0, clockwise: true },
  ];
  const old = structuredClone(level);
  delete old.classic.lineImpact;
  const a = attempt(level),
    b = attempt(old);
  advance(a, 'right', 60);
  advance(b, 'right', 60);
  assert.deepEqual(events(a, 'player.failed'), events(b, 'player.failed'));
  assert.equal(events(a, 'player.failed')[0].cause, 'enemy-player');
  assert.equal(events(a, 'lineImpact.seeded').length, 0);
  const legacy = source();
  delete legacy.classic.lineImpact;
  const c = attempt(legacy);
  advance(c, 'down', 195);
  near(events(c, 'player.failed')[0].time, 1.625);
  assert.equal(events(c, 'lineImpact.seeded').length, 0);
});

test('shield absorption clears every pending front without consuming a life', () => {
  const a = attempt(source(), 'immediate', { classId: 'interceptor' });
  advance(a, 'down', 200);
  advance(a, 'down', 1, { action: true });
  advance(a, 'down', 91);
  assert.equal(events(a, 'lineImpact.arrived').length, 1);
  assert.equal(events(a, 'shield.absorbed').length, 1);
  assert.equal(a.run.lives, 3);
  assert.equal(a.run.classic.livesLost, 0);
  assert.deepEqual(a.run.classic.lineImpact.fronts, []);
  replay(a);
});

test('all conditional state participates in the existing classic checkpoint and changed descriptor cannot verify', () => {
  const a = attempt();
  advance(a, 'down', 210);
  const original = authoritativeCheckpoint(a.run);
  for (const mutate of [
    (s) => s.classic.lineImpact.nextId++,
    (s) => (s.classic.lineImpact.version = 'future'),
    (s) => s.classic.lineImpact.seededActorIds.push('foreign'),
    ...Object.keys(a.run.classic.lineImpact.fronts[0]).map((key) => (s) => {
      const f = s.classic.lineImpact.fronts[0];
      f[key] = typeof f[key] === 'number' ? f[key] + 1 : `${f[key]}-changed`;
    }),
  ]) {
    const changed = structuredClone(a.run);
    mutate(changed);
    assert.notEqual(authoritativeCheckpoint(changed).sections.classic, original.sections.classic);
  }
  const exported = replay(a);
  exported.level.classic.lineImpact.speed = 25;
  assert.equal(verifyReplay(exported).match, false);
});

test('existing v5 pack/scenario transports own the versioned descriptor and preserve the absent variant separately', async () => {
  const raw = JSON.parse(
    readFileSync(new URL('../content/packs/night-shift.json', import.meta.url), 'utf8'),
  );
  raw.id = 'line-impact-pack';
  raw.format = 'xonix-pack.v5';
  raw.engine = 'xonix-core.v5';
  raw.masteries = [];
  raw.levelVisuals = [];
  raw.campaigns = [{ ...raw.campaigns[0], id: 'line-impact-campaign', levels: [source()] }];
  const before = structuredClone(raw),
    prepared = (await preparePack(raw)).pack;
  assert.deepEqual(raw, before);
  const selected = scenarioFromPack(prepared, raw.campaigns[0].id, source().id);
  assert.equal(validateScenario(selected).valid, true);
  assert.deepEqual(selected.level.classic.lineImpact, { version: 'line-impact.v1', speed: 24 });
  assert.ok(Object.isFrozen(prepared.campaigns[0].levels[0].classic.lineImpact));
  const campaign = resolvePackCampaign(prepared, raw.campaigns[0].id).campaign;
  const absent = structuredClone(campaign);
  delete absent.levels[0].classic.lineImpact;
  assert.notEqual(campaignKey(campaign), campaignKey(absent));
  const installed = installPack(emptyPackLibrary(), prepared);
  assert.deepEqual(await importPackLibrary(exportPackLibrary(installed)), installed);
  selected.level.classic.lineImpact.speed = 30;
  assert.equal(prepared.campaigns[0].levels[0].classic.lineImpact.speed, 24);
});

test('simultaneous contacts at the enemy limit seed all pairs at one horizon in stable actor order', () => {
  const level = source();
  level.enemies = Array.from({ length: 24 }, (_, i) => ({
    ...level.enemies[0],
    id: `enemy-${String(23 - i).padStart(2, '0')}`,
  }));
  const a = attempt(level);
  advance(a, 'down', 195);
  const seeded = events(a, 'lineImpact.seeded');
  assert.equal(seeded.length, 24);
  assert.equal(a.run.classic.lineImpact.fronts.length, 48);
  assert.deepEqual(
    seeded.map((event) => event.actorId),
    [...seeded.map((event) => event.actorId)].sort(),
  );
  assert.equal(new Set(seeded.map((event) => event.tick)).size, 1);
  for (const event of seeded) near(event.time, 1.625);
  advance(a, 'down', 10);
  assert.equal(events(a, 'lineImpact.seeded').length, 24);
  replay(a);
});

test('an active lane striking an older trail seeds travelling damage while direct lane contact remains immediate', () => {
  const level = source();
  level.enemies = [
    {
      id: 'lane',
      type: 'lane-boss',
      x: 60.5,
      y: 15.5,
      axis: 'horizontal',
      warningSeconds: 0.25,
      activeSeconds: 0.7,
      period: 4,
      laneWidth: 1.2,
    },
  ];
  const a = attempt(level);
  advance(a, 'down', 274);
  assert.equal(a.run.lives, 3);
  assert.equal(events(a, 'lineImpact.seeded').length, 1);
  assert.equal(events(a, 'lineImpact.seeded')[0].actorId, 'lane');
  assert.equal(events(a, 'player.failed').length, 0);
  advance(a, 'down', 30);
  assert.equal(events(a, 'lineImpact.arrived').length, 1);
  assert.equal(a.run.lives, 2);
  replay(a);
  const b = attempt(level);
  advance(b, 'down', 240);
  advance(b, null, 32);
  assert.equal(events(b, 'player.failed')[0].cause, 'boss-lane');
  assert.equal(events(b, 'lineImpact.arrived').length, 0);
  replay(b);
});

test('a zero-length departure contact is resolved once without an event-loop stall', () => {
  const level = source();
  level.enemies = [{ id: 'near-start', type: 'bouncer', x: 37.24, y: 1.74, vx: 0, vy: 0 }];
  const a = attempt(level);
  advance(a, 'down', 8);
  assert.equal(a.run.lives, 2);
  assert.equal(events(a, 'lineImpact.seeded').length, 1);
  assert.equal(events(a, 'lineImpact.arrived').length, 1);
  near(events(a, 'lineImpact.seeded')[0].time, 0.05);
  replay(a);
});

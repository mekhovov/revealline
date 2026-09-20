import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, stepRun, validateLevel, FIXED_DT } from '../core/index.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../replay.mjs';
import { suspendSession, restoreSession } from '../sessions.mjs';
import { campaignKey } from '../library.mjs';

function source(actorIds = ['seed']) {
  return {
    version: 'xonix-level.v5',
    id: 'selective-impact',
    revision: '1',
    name: 'Selective impact',
    width: 72,
    height: 36,
    encounter: null,
    foundations: [],
    classic: {
      version: 'classic.v1',
      terrain: [],
      powerups: [],
      lineImpact: { version: 'line-impact.v2', speed: 24, actorIds },
    },
    spawn: { x: 36.5, y: 0.5 },
    goal: { coverage: 0.99 },
    enemies: [
      { id: 'seed', type: 'bouncer', x: 40.5, y: 5.5, vx: -2, vy: 0 },
      { id: 'other', type: 'bouncer', x: 65.5, y: 28.5, vx: -1, vy: 0 },
    ],
    rules: { moveSpeed: 10, lives: 3, graceSeconds: 0, respawnSeconds: 0.1, stopOnCapture: true },
  };
}
function attempt(level, turnPolicy = 'immediate') {
  const options = { seed: 1, classId: 'scout', turnPolicy };
  return { run: createRun(level, options), recorder: createRecorder(level, options), events: [] };
}
function advance(a, direction, ticks) {
  for (let tick = 0; tick < ticks; tick++) {
    recordInput(a.recorder, { direction });
    stepRun(a.run, { direction }, FIXED_DT);
    a.events.push(...structuredClone(a.run.events));
  }
}
function verify(a) {
  const replay = exportReplay(a.recorder, a.run);
  assert.equal(verifyReplay(replay).match, true);
  return replay;
}

test('selective impacts require bounded owned exact field-actor references without changing v1', () => {
  assert.equal(validateLevel(source()).valid, true);
  for (const actorIds of [
    [],
    ['missing'],
    ['seed', 'seed'],
    ['__proto__'],
    [1],
    Array(65).fill('seed'),
  ])
    assert.equal(validateLevel(source(actorIds)).valid, false);
  for (const type of ['eroder', 'claimed-rover', 'border-patrol']) {
    const invalid = source();
    invalid.enemies[0].type = type;
    assert.equal(validateLevel(invalid).valid, false);
  }
  const absent = source();
  delete absent.classic.lineImpact.actorIds;
  assert.equal(validateLevel(absent).valid, false);
  const old = source();
  old.classic.lineImpact = { version: 'line-impact.v1', speed: 24 };
  assert.equal(validateLevel(old).valid, true);
  old.classic.lineImpact.actorIds = ['seed'];
  assert.equal(validateLevel(old).valid, false, 'historical version must reject new fields');
  const owned = source(),
    run = createRun(owned);
  owned.classic.lineImpact.actorIds[0] = 'other';
  assert.deepEqual(run.level.classic.lineImpact.actorIds, ['seed']);
  let reads = 0;
  const hostile = source();
  Object.defineProperty(hostile.classic.lineImpact, 'actorIds', {
    enumerable: true,
    get() {
      reads++;
      return ['seed'];
    },
  });
  assert.equal(validateLevel(hostile).valid, false);
  assert.equal(reads, 0);
});

for (const turnPolicy of ['immediate', 'grid-center']) {
  test(`${turnPolicy}: a public suspension preserves selected actors and active fronts exactly`, async () => {
    const level = source(),
      a = attempt(level, turnPolicy);
    advance(a, 'down', 210);
    const campaign = {
      version: 'xonix-campaign.v1',
      id: 'selective-session',
      revision: '1',
      levels: [level],
    };
    const key = campaignKey(campaign),
      before = authoritativeCheckpoint(a.run);
    const saved = suspendSession({
      run: a.run,
      recorder: a.recorder,
      campaignKey: key,
      themeId: 'fpv',
      bodyId: 'drone',
      runId: 'selective-session',
      savedAt: '2026-09-20T00:00:00.000Z',
      continuation: { direction: 'down' },
    });
    const restored = await restoreSession(saved, { campaign, campaignKey: key });
    assert.deepEqual(authoritativeCheckpoint(a.run), before);
    assert.deepEqual(authoritativeCheckpoint(restored.run), before);
    assert.deepEqual(restored.run.level.classic.lineImpact.actorIds, ['seed']);
    const b = { run: restored.run, recorder: restored.recorder, events: [] };
    advance(a, 'down', 82);
    advance(b, 'down', 82);
    assert.deepEqual(authoritativeCheckpoint(a.run), authoritativeCheckpoint(b.run));
    verify(a);
    verify(b);
  });
  test(`${turnPolicy}: only the selected actor creates impact fronts; an ordinary keeper still hits immediately`, () => {
    const carrier = attempt(source(), turnPolicy);
    advance(carrier, 'down', 195);
    assert.equal(carrier.run.lives, 3);
    assert.equal(carrier.run.classic.lineImpact.fronts.length, 2);
    assert.deepEqual(
      carrier.events.filter((e) => e.type === 'lineImpact.seeded').map((e) => e.actorId),
      ['seed'],
    );
    verify(carrier);
    const keeper = attempt(source(['other']), turnPolicy);
    advance(keeper, 'down', 195);
    assert.equal(keeper.run.lives, 2);
    assert.equal(keeper.run.failureCause, 'enemy-trail');
    assert.equal(keeper.events.filter((e) => e.type === 'lineImpact.seeded').length, 0);
    verify(keeper);
    const historical = source();
    historical.classic.lineImpact = { version: 'line-impact.v1', speed: 24 };
    const legacy = attempt(historical, turnPolicy);
    advance(legacy, 'down', 195);
    assert.equal(legacy.run.lives, 3);
    assert.equal(legacy.run.classic.lineImpact.fronts.length, 2);
    assert.deepEqual(legacy.run.classic.lineImpact, carrier.run.classic.lineImpact);
    verify(legacy);
  });

  test(`${turnPolicy}: a selected actor striking the live endpoint grants no escape grace`, () => {
    const level = source();
    Object.assign(level.enemies[0], { x: 36.5, y: 5.5, vx: 0, vy: 1 });
    const a = attempt(level, turnPolicy);
    advance(a, 'down', 70);
    assert.equal(a.run.classic.livesLost, 1);
    const seeded = a.events.find((e) => e.type === 'lineImpact.seeded');
    const failed = a.events.find((e) => e.type === 'player.failed');
    assert(seeded && failed);
    assert.equal(failed.actorId, 'seed');
    assert.equal(failed.cause, 'enemy-trail');
    assert(Math.abs(failed.time - seeded.time) < 1e-7);
    verify(a);
  });

  test(`${turnPolicy}: a legal foundation closure clears the travelling fronts without changing capture`, () => {
    const level = source();
    level.foundations = [{ x: 30, y: 18, w: 13, h: 3 }];
    const a = attempt(level, turnPolicy);
    const denominator = a.run.totalClaimable;
    for (let tick = 0; tick < 220 && !a.events.some((event) => event.type === 'cut.closed'); tick++)
      advance(a, 'down', 1);
    assert(a.events.some((e) => e.type === 'lineImpact.seeded'));
    assert(a.events.some((e) => e.type === 'lineImpact.cleared' && e.reason === 'capture'));
    assert(a.events.some((e) => e.type === 'cut.closed'));
    assert.equal(a.run.lives, 3);
    assert.equal(a.run.totalClaimable, denominator);
    assert.equal(a.run.player.cutting, false);
    assert.equal(a.run.player.speed, 0);
    assert.deepEqual(a.run.classic.lineImpact.fronts, []);
    verify(a);
  });
}

test('the selective descriptor is replay authority, not editable presentation metadata', () => {
  const a = attempt(source());
  advance(a, 'down', 210);
  const replay = verify(a);
  replay.level.classic.lineImpact.actorIds = ['other'];
  assert.equal(verifyReplay(replay).match, false);
});

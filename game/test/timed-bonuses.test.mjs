import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, stepRun, FIXED_DT, CELL, CLASSES, validateLevel } from '../core/index.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../replay.mjs';
import { suspendSession, restoreSession } from '../sessions.mjs';
import { campaignKey } from '../library.mjs';
import { CLASSIC_EFFECTS, classicEffectActive } from '../core/classic-state.mjs';

export function timedBonusLevel() {
  return {
    version: 'xonix-level.v5',
    id: 'timed-bonus-check',
    revision: '1',
    name: 'Optional window',
    width: 72,
    height: 36,
    foundations: [],
    walls: [],
    spawn: { x: 0.5, y: 18.5 },
    encounter: null,
    goal: { coverage: 0.99 },
    objectives: [],
    supplies: [],
    enemies: [{ id: 'keeper', type: 'bouncer', x: 60.5, y: 8.5, vx: 0.1, vy: 0.1 }],
    rules: { moveSpeed: 10, lives: 3, stopOnCapture: true },
    classic: {
      version: 'classic.v1',
      terrain: [],
      powerups: [],
      timedBonuses: {
        version: 'timed-bonuses.v1',
        schedules: [
          {
            id: 'window',
            kind: 'extra-life',
            anchors: [
              { x: 8.5, y: 18.5 },
              { x: 9.5, y: 18.5 },
            ],
            initialDelayTicks: 0,
            announcementTicks: 120,
            availableTicks: 240,
            cooldownTicks: 240,
            maxAppearances: 2,
            maxCollections: 1,
          },
        ],
      },
    },
  };
}
const def = (level) => level.classic.timedBonuses.schedules[0];
const timing = (run) => run.classic.timedBonuses;
const schedule = (run) => timing(run).schedules[0];
function ticks(run, n, direction = null, recorder = null) {
  const events = [];
  for (let i = 0; i < n; i++) {
    const input = { direction };
    if (recorder) recordInput(recorder, input);
    stepRun(run, input, FIXED_DT);
    events.push(...run.events);
  }
  return events;
}

test('strict bounded descriptor rejects invalid schedules, anchors and field identities', () => {
  assert.equal(validateLevel(timedBonusLevel()).valid, true);
  for (const change of [
    (l) => (l.classic.timedBonuses = null),
    (l) => (l.classic.timedBonuses.version = 'later'),
    (l) => (l.classic.timedBonuses.schedules = []),
    (l) => (def(l).maxCollections = 2),
    (l) => (def(l).maxAppearances = 0),
    (l) => (def(l).announcementTicks = 1),
    (l) => (def(l).availableTicks = Infinity),
    (l) => (def(l).cooldownTicks = 1),
    (l) => (def(l).initialDelayTicks = -1),
    (l) => delete def(l).anchors,
    (l) => (def(l).script = 'run()'),
    (l) =>
      (def(l).anchors = [
        { x: 8, y: 18.5 },
        { x: 9.5, y: 18.5 },
      ]),
    (l) => (def(l).anchors[1] = { ...def(l).anchors[0] }),
    (l) => (def(l).anchors[0].x = 0.5),
    (l) => l.walls.push({ x: 8, y: 18, w: 1, h: 1 }),
    (l) => l.foundations.push({ x: 8, y: 18, w: 1, h: 1 }),
    (l) => l.classic.terrain.push({ id: 'lava', kind: 'lethal', x: 8, y: 18, w: 1, h: 1 }),
    (l) => l.classic.powerups.push({ id: 'fixed', kind: 'enemy-freeze', x: 8.5, y: 18.5 }),
    (l) => (def(l).id = 'keeper'),
    (l) => l.classic.timedBonuses.schedules.push(structuredClone(def(l))),
  ]) {
    const level = timedBonusLevel();
    change(level);
    assert.equal(validateLevel(level).valid, false, change.toString());
    assert.throws(() => createRun(level), undefined, change.toString());
  }
});

test('absent schedules do not add state, events or alter historical pickup semantics', () => {
  const level = timedBonusLevel();
  delete level.classic.timedBonuses;
  level.classic.powerups.push({ id: 'fixed', kind: 'extra-life', x: 0.5, y: 18.5 });
  const run = createRun(level);
  assert.equal(Object.hasOwn(run.classic, 'timedBonuses'), false);
  const events = ticks(run, 1);
  assert.equal(run.lives, 4);
  assert(events.some((e) => e.type === 'powerup.collected'));
  assert(!events.some((e) => e.type.startsWith('bonus.')));
});

test('announcement is not collectible; missed pickup expires and reappears elsewhere with a finite cap', () => {
  const run = createRun(timedBonusLevel(), { seed: 7 });
  ticks(run, 120);
  assert.equal(schedule(run).phase, 'announce');
  assert.equal(run.classic.powerups.length, 0);
  ticks(run, 1);
  const first = schedule(run).currentAnchor;
  assert.equal(schedule(run).phase, 'available');
  assert.equal(run.classic.powerups.length, 1);
  ticks(run, 239);
  assert.equal(schedule(run).phase, 'available');
  const expiry = ticks(run, 1);
  assert(expiry.some((e) => e.type === 'bonus.expired'));
  assert.equal(run.classic.powerups.length, 0);
  ticks(run, 360);
  assert.equal(schedule(run).phase, 'available');
  assert.notEqual(schedule(run).currentAnchor, first);
  assert.equal(schedule(run).appearances, 2);
  ticks(run, 240);
  assert.equal(schedule(run).phase, 'exhausted');
  ticks(run, 1200);
  assert.equal(run.classic.powerups.length, 0);
  assert.equal(schedule(run).collections, 0);
});

test('real swept contact collects once, preserves effect policy and exhausts a life schedule', () => {
  const run = createRun(timedBonusLevel());
  ticks(run, 121);
  const item = { ...run.classic.powerups[0] };
  const events = ticks(run, Math.ceil((item.x - run.player.x) / 10 / FIXED_DT), 'right');
  assert.equal(run.lives, 4);
  assert.equal(schedule(run).collections, 1);
  assert.equal(schedule(run).phase, 'exhausted');
  const collected = events.find((e) => e.type === 'powerup.collected');
  assert.equal(collected.x, item.x);
  assert.equal(collected.y, item.y);
  assert.equal(run.classic.powerups.length, 0);
});

test('all timed effect kinds use the fixed-pickup activation and expiry contract, with no extra life above nine', () => {
  for (const kind of ['extra-life', ...Object.keys(CLASSIC_EFFECTS)]) {
    const level = timedBonusLevel();
    def(level).kind = kind;
    const run = createRun(level);
    if (kind === 'extra-life') run.lives = 9; // Arrange the existing cap boundary.
    ticks(run, 121);
    const item = { ...run.classic.powerups[0] };
    const events = ticks(run, Math.ceil((item.x - run.player.x) / 10 / FIXED_DT), 'right');
    const collected = events.find((e) => e.type === 'powerup.collected');
    assert(collected, kind);
    assert.equal(schedule(run).collections, 1, kind);
    assert.equal(schedule(run).phase, 'exhausted', kind);
    if (kind === 'extra-life') {
      assert.equal(run.lives, 9);
      assert.equal(collected.gain, 0);
    } else {
      assert.equal(collected.activationTick, collected.tick + 1, kind);
      assert.equal(collected.untilTick - collected.activationTick, CLASSIC_EFFECTS[kind], kind);
      // Probe the shared predicate boundaries without simulating an unrelated
      // unfinished cut; swept collection above uses the real engine.
      run.tick = collected.activationTick;
      assert.equal(classicEffectActive(run, kind), true, kind);
      run.tick = collected.untilTick;
      assert.equal(classicEffectActive(run, kind), false, kind);
    }
  }
});

test('expiry wins exact tick; capture alone does not collect an already available pickup', () => {
  // Boundary unit test deliberately arranges contact at the expiry instant.
  const run = createRun(timedBonusLevel());
  ticks(run, 360);
  const item = run.classic.powerups[0];
  Object.assign(run.player, { x: item.x, y: item.y, speed: 0 });
  const events = ticks(run, 1);
  assert.equal(run.lives, 3);
  assert(!events.some((e) => e.type === 'powerup.collected'));
  const other = createRun(timedBonusLevel());
  ticks(other, 121);
  const at = other.classic.powerups[0];
  other.cells[Math.floor(at.y) * other.width + Math.floor(at.x)] = CELL.SAFE;
  ticks(other, 10);
  assert.equal(other.classic.powerups.length, 1);
  assert.equal(other.lives, 3);
});

test('occupied, reclaimed, live-trail and unreachable anchors never materialize', () => {
  for (const arrangement of ['occupied', 'claimed', 'trail', 'sealed']) {
    const level = timedBonusLevel(),
      run = createRun(level);
    for (const anchor of def(level).anchors) {
      const cell = Math.floor(anchor.y) * 72 + Math.floor(anchor.x);
      if (arrangement === 'claimed') run.cells[cell] = CELL.SAFE;
      if (arrangement === 'trail') run.trail.push(cell);
      if (arrangement === 'occupied')
        run.enemies.push({ ...run.enemies[0], id: String(cell), ...anchor, vx: 0, vy: 0 });
      if (arrangement === 'sealed')
        for (const delta of [-1, 1, -72, 72]) run.cells[cell + delta] = CELL.WALL;
    }
    ticks(run, 121);
    assert.equal(run.classic.powerups.length, 0, arrangement);
    assert.equal(schedule(run).appearances, 0, arrangement);
  }
});

test('announcement rechecks eligibility without consuming appearances; previous anchor is never reused', () => {
  const run = createRun(timedBonusLevel());
  ticks(run, 1);
  const anchor = def(run.level).anchors[schedule(run).currentAnchor];
  run.cells[Math.floor(anchor.y) * 72 + Math.floor(anchor.x)] = CELL.SAFE;
  ticks(run, 120);
  assert.equal(schedule(run).phase, 'cooldown');
  assert.equal(schedule(run).appearances, 0);
  ticks(run, 360);
  assert.equal(schedule(run).phase, 'available');
  ticks(run, 240 + 240);
  assert.equal(schedule(run).phase, 'cooldown');
  assert.equal(schedule(run).appearances, 1);
});

test('recovery freezes schedule time and does not refund appearances; enemy freeze does not stop it', () => {
  const run = createRun(timedBonusLevel());
  ticks(run, 121);
  const snapshot = structuredClone(timing(run));
  run.status = 'respawning';
  run.respawnAt = run.time + 0.65;
  ticks(run, 60);
  assert.deepEqual(timing(run), snapshot);
  ticks(run, 20);
  assert.equal(schedule(run).appearances, 1);
  const before = timing(run).clock;
  run.classic.effects['enemy-freeze'] = { from: 0, until: run.tick + 240 };
  ticks(run, 10);
  assert.equal(timing(run).clock, before + 10);
  run.status = 'won';
  const frozen = structuredClone(timing(run));
  ticks(run, 10);
  assert.deepEqual(timing(run), frozen);
});

test('independent equal boards preserve seeded schedules, and save/replay restores the next appearance', async () => {
  const level = timedBonusLevel(),
    options = { seed: 8, classId: 'scout', turnPolicy: 'immediate' };
  const run = createRun(level, options),
    recorder = createRecorder(level, options);
  const peer = createRun(level, options);
  ticks(run, 200, null, recorder);
  ticks(peer, 200);
  assert.deepEqual(authoritativeCheckpoint(run), authoritativeCheckpoint(peer));
  const campaign = {
    version: 'xonix-campaign.v1',
    id: 'timed-bonus-campaign',
    revision: '1',
    levels: [level],
    classRecipes: CLASSES,
  };
  const key = campaignKey(campaign);
  const saved = suspendSession({
    run,
    recorder,
    campaignKey: key,
    themeId: 'fpv',
    bodyId: 'quad',
    runId: 'timed-bonus-save',
    continuation: { direction: null },
  });
  const restored = await restoreSession(saved, { campaign, campaignKey: key });
  ticks(run, 600, null, recorder);
  ticks(restored.run, 600, null, restored.recorder);
  assert.deepEqual(authoritativeCheckpoint(restored.run), authoritativeCheckpoint(run));
  assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
  const changed = structuredClone(campaign);
  def(changed.levels[0]).availableTicks++;
  await assert.rejects(restoreSession(saved, { campaign: changed, campaignKey: key }));
});

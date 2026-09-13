import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRun, stepRun, validateLevel, FIXED_DT, CELL } from '../core/index.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../replay.mjs';

function source(changes = {}) {
  return {
    version: 'xonix-level.v4',
    id: 'capture-stop-test',
    revision: '1',
    name: 'Return to safe ground',
    width: 72,
    height: 36,
    encounter: null,
    classic: { version: 'classic.v1', terrain: [], powerups: [] },
    spawn: { x: 36.5, y: 0.5 },
    goal: { coverage: 0.99 },
    enemies: [{ id: 'seed', type: 'bouncer', x: 60.5, y: 18.5, vx: 1, vy: 0 }],
    rules: { moveSpeed: 13, lives: 3, graceSeconds: 0, respawnSeconds: 0.1, stopOnCapture: true },
    ...changes,
  };
}
function advance(run, direction, ticks, recorder) {
  const events = [];
  for (let i = 0; i < ticks; i++) {
    const input = { direction };
    if (recorder) recordInput(recorder, input);
    stepRun(run, input, FIXED_DT);
    events.push(...structuredClone(run.events));
  }
  return events;
}

test('capture-stop is an optional own boolean only in the classic level family', () => {
  for (const stopOnCapture of [true, false])
    assert.equal(validateLevel(source({ rules: { stopOnCapture } })).valid, true);
  for (const stopOnCapture of [null, 1, 'true', {}]) {
    const level = source({ rules: { stopOnCapture } });
    assert.equal(validateLevel(level).valid, false);
    assert.throws(() => createRun(level));
  }
  const wide = source();
  delete wide.classic;
  wide.version = 'xonix-level.v3';
  const ordinary = JSON.parse(
    readFileSync(new URL('../content/campaign.json', import.meta.url), 'utf8'),
  ).levels[0];
  const staged = JSON.parse(
    readFileSync(new URL('../content/packs/sentinel-relay.json', import.meta.url), 'utf8'),
  ).campaigns[0].levels[0];
  for (const level of [ordinary, staged, wide])
    for (const stopOnCapture of [true, false])
      assert.equal(
        validateLevel({ ...level, rules: { ...level.rules, stopOnCapture } }).valid,
        false,
      );
  const absent = source();
  delete absent.rules.stopOnCapture;
  assert.equal(Object.hasOwn(createRun(absent).rules, 'stopOnCapture'), false);
});

for (const turnPolicy of ['immediate', 'grid-center']) {
  test(`${turnPolicy}: closure stops at the swept boundary, preserves world time and resumes only with a command`, () => {
    const level = source(),
      options = { turnPolicy },
      run = createRun(level, options),
      recorder = createRecorder(level, options);
    const events = advance(run, 'down', 319, recorder);
    const closed = events.find((event) => event.type === 'cut.closed'),
      stopped = events.find((event) => event.type === 'capture.stopped');
    assert.ok(closed && stopped);
    assert.equal(stopped.time, closed.time);
    assert.equal(events.filter((event) => event.type === 'capture.stopped').length, 1);
    assert.ok(Math.abs(stopped.time - 34.5 / 13) < 1e-8);
    assert.ok(Math.abs(run.time - 319 * FIXED_DT) < 1e-8);
    assert.ok(run.time > stopped.time, 'The remainder of the tick still advances the world.');
    assert.ok(Math.abs(run.enemies[0].x - 60.5 - run.time) < 1e-8);
    assert.equal(run.player.y, 35);
    assert.equal(run.player.speed, 0);
    assert.equal(run.player.queuedDirection, null);
    assert.equal(run.player.cutting, false);
    assert.ok(run.claimedCount > 0);
    const at = { x: run.player.x, y: run.player.y };
    assert.equal(
      advance(run, null, 20, recorder).some((event) => event.type === 'capture.stopped'),
      false,
    );
    assert.deepEqual({ x: run.player.x, y: run.player.y }, at);
    advance(run, 'left', 12, recorder);
    assert.ok(run.player.x < at.x);
    assert.equal(run.status, 'running');
    const replay = exportReplay(recorder, run),
      checked = verifyReplay(replay);
    assert.equal(checked.match, true);
    assert.deepEqual(authoritativeCheckpoint(checked.state), authoritativeCheckpoint(run));
    const tampered = structuredClone(replay);
    tampered.level.rules.stopOnCapture = false;
    assert.equal(verifyReplay(tampered).match, false);
  });

  test(`${turnPolicy}: absent and false retain continued travel past closure and unchanged event behavior`, () => {
    const absent = source();
    delete absent.rules.stopOnCapture;
    const disabled = source({ rules: { ...absent.rules, stopOnCapture: false } });
    const first = createRun(absent, { turnPolicy }),
      second = createRun(disabled, { turnPolicy });
    const events = advance(first, 'down', 319);
    assert.deepEqual(advance(second, 'down', 319), events);
    assert.equal(
      events.some((event) => event.type === 'capture.stopped'),
      false,
    );
    assert.ok(first.player.y > 35);
    assert.deepEqual(second.player, first.player);
    assert.deepEqual(second.cells, first.cells);
    assert.equal(Object.hasOwn(first.rules, 'stopOnCapture'), false);
  });

  test(`${turnPolicy}: a wall halts an unfinished line without fabricating capture or a capture-stop event`, () => {
    const run = createRun(source({ walls: [{ x: 36, y: 8, w: 1, h: 2 }] }), { turnPolicy });
    const events = advance(run, 'down', 120);
    assert.equal(run.status, 'running');
    assert.ok(run.player.y < 8);
    assert.equal(run.player.cutting, true);
    assert.equal(run.claimedCount, 0);
    assert.equal(run.cells[8 * 72 + 36], CELL.WALL);
    assert.equal(
      events.some((event) => ['cut.closed', 'capture.stopped'].includes(event.type)),
      false,
    );
  });

  test(`${turnPolicy}: failure before or exactly at closure cannot become a capture-stop`, () => {
    const timed = createRun(
      source({ rules: { moveSpeed: 10, lives: 3, timeLimitSeconds: 3.45, stopOnCapture: true } }),
      { turnPolicy },
    );
    const timedEvents = advance(timed, 'down', 414);
    assert.equal(timed.status, 'lost');
    assert.equal(timed.failureCause, 'mission-timeout');
    assert.equal(timed.claimedCount, 0);
    assert.equal(
      timedEvents.some((event) => event.type === 'capture.stopped'),
      false,
    );
    const contact = createRun(
      source({
        rules: { moveSpeed: 13, lives: 1, stopOnCapture: true },
        enemies: [{ id: 'guard', type: 'bouncer', x: 36.5, y: 34.5, vx: 0, vy: 0 }],
      }),
      { turnPolicy },
    );
    const contactEvents = advance(contact, 'down', 319);
    assert.equal(contact.status, 'lost');
    assert.ok(['enemy-trail', 'enemy-player'].includes(contact.failureCause));
    assert.equal(contact.claimedCount, 0);
    assert.equal(
      contactEvents.some((event) => event.type === 'capture.stopped'),
      false,
    );
  });

  test(`${turnPolicy}: a winning closure emits stop before the one terminal event without overshooting`, () => {
    const run = createRun(source({ goal: { coverage: 0.4 } }), { turnPolicy });
    const events = advance(run, 'down', 319),
      types = events.map((event) => event.type);
    assert.equal(run.status, 'won');
    assert.equal(run.player.y, 35);
    assert.equal(run.player.speed, 0);
    assert.equal(run.player.queuedDirection, null);
    assert.ok(Math.abs(run.time - 34.5 / 13) < 1e-8);
    assert.ok(types.indexOf('cut.closed') < types.indexOf('capture.stopped'));
    assert.ok(types.indexOf('capture.stopped') < types.indexOf('run.completed'));
    assert.equal(types.filter((type) => type === 'run.completed').length, 1);
  });
}

test('Grid closure discards an earlier queued turn before a later deliberate same-heading command', () => {
  const run = createRun(source(), { turnPolicy: 'grid-center' });
  advance(run, 'down', 318);
  assert.ok(run.player.y < 35);
  const events = advance(run, 'right', 1);
  assert.ok(events.some((event) => event.type === 'capture.stopped'));
  assert.equal(run.player.y, 35);
  assert.equal(run.player.queuedDirection, null);
  const x = run.player.x;
  advance(run, null, 1);
  advance(run, 'down', 12);
  assert.equal(run.player.x, x);
  assert.equal(run.player.y, 35.5);
});

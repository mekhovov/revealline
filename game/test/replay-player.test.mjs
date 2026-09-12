import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRun, stepRun, releaseInputs, FIXED_DT } from '../core/index.mjs';
import {
  createRecorder,
  recordInput,
  recordRelease,
  exportReplay,
  authoritativeCheckpoint,
} from '../replay.mjs';
import { prepareReplayPlayer, PLAYBACK_RATES } from '../replay-player.mjs';
import { loadSpecialtyPack, replaySpecialtyRoute } from '../../scripts/verify-specialty.mjs';

function fixture(turnPolicy = 'immediate', { win = false } = {}) {
  const level = {
    version: 'xonix-level.v1',
    id: 'theater-test',
    revision: '1',
    width: 48,
    height: 36,
    spawn: { x: 24.5, y: 0.5 },
    goal: { coverage: win ? 0.4 : 0.9 },
    enemies: [{ id: 'anchor', type: 'bouncer', x: 39.5, y: 25.5, vx: 0, vy: 0 }],
  };
  const options = { classId: 'scout', turnPolicy };
  const state = createRun(level, options),
    recorder = createRecorder(level, options, 'theater-test');
  const input = (command, count) => {
    for (let i = 0; i < count && state.status === 'running'; i++) {
      stepRun(state, command);
      recordInput(recorder, command);
    }
  };
  if (win) input({ direction: 'down', boost: true }, 400);
  else {
    input({ direction: 'right', action: true }, 3);
    input({ direction: 'down' }, 3);
    releaseInputs(state);
    recordRelease(recorder);
    input({ action: true }, 1);
    input({ direction: 'right', boost: true }, 17);
  }
  releaseInputs(state);
  recordRelease(recorder);
  return exportReplay(recorder, state);
}

for (const turnPolicy of ['immediate', 'grid-center']) {
  test(`${turnPolicy}: RLE, release markers, pause and restart preserve the verified final checkpoint`, async () => {
    const source = fixture(turnPolicy),
      before = structuredClone(source);
    const player = await prepareReplayPlayer(source);
    assert.equal(player.phase, 'paused');
    assert.equal(player.state.tick, 0);
    player.step(4);
    const paused = authoritativeCheckpoint(player.state);
    player.pause();
    player.advance(2);
    assert.deepEqual(authoritativeCheckpoint(player.state), paused);
    player.play();
    while (player.phase === 'playing') player.advance(FIXED_DT);
    assert.equal(player.phase, 'complete');
    assert.equal(player.finalCheckpoint.hash, source.checkpoint.hash);
    assert.equal(player.state.tick, source.ticks);
    player.reset();
    assert.equal(player.state.tick, 0);
    player.step(240);
    assert.equal(player.finalCheckpoint.hash, source.checkpoint.hash);
    assert.deepEqual(source, before);
  });
  test(`${turnPolicy}: every playback speed changes pacing, not terminal state or events`, async () => {
    const source = fixture(turnPolicy, { win: true }),
      frameCounts = [];
    for (const rate of PLAYBACK_RATES) {
      const player = await prepareReplayPlayer(JSON.stringify(source));
      player.setRate(rate);
      player.play();
      let frames = 0,
        completed = 0;
      while (player.phase === 'playing' && frames++ < 2000)
        completed += player
          .advance(1 / 60)
          .events.filter((event) => event.type === 'run.completed').length;
      assert.equal(player.finalCheckpoint.hash, source.checkpoint.hash);
      assert.equal(completed, 1);
      frameCounts.push(frames);
    }
    assert.ok(frameCounts[0] > frameCounts[1] && frameCounts[1] > frameCounts[2]);
  });
}

test('verification rejects tampering and cancellation before exposing a player', async () => {
  const changed = fixture();
  changed.segments[0].input.direction = 'left';
  await assert.rejects(prepareReplayPlayer(changed), /verification failed/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(prepareReplayPlayer(fixture(), { signal: controller.signal }), {
    name: 'AbortError',
  });
  const running = new AbortController();
  await assert.rejects(
    prepareReplayPlayer(fixture(), {
      chunkTicks: 1,
      signal: running.signal,
      onProgress: ({ ticks }) => {
        if (ticks) running.abort();
      },
    }),
    { name: 'AbortError' },
  );
});

test('caller edits during asynchronous verification never replace the adopted command stream', async () => {
  const source = fixture(),
    expected = source.checkpoint.hash;
  const preparing = prepareReplayPlayer(source, { chunkTicks: 1 });
  source.segments[0].input.direction = 'left';
  source.options.classId = 'impact';
  const player = await preparing;
  player.step(240);
  assert.equal(player.finalCheckpoint.hash, expected);
  assert.equal(player.info.classId, 'scout');
});

test('a long frame gap pauses without chasing backlog or releasing the recorded queued turn', async () => {
  const player = await prepareReplayPlayer(fixture('grid-center'));
  player.step(4);
  player.play();
  const before = authoritativeCheckpoint(player.state);
  const result = player.advance(2);
  assert.equal(result.reason, 'frame-gap');
  assert.equal(result.ticks, 0);
  assert.equal(player.phase, 'paused');
  assert.deepEqual(authoritativeCheckpoint(player.state), before);
  assert.throws(() => player.setRate(8), /rate/);
  assert.throws(() => player.step(1000), /Step/);
  assert.throws(() => player.advance(NaN), /finite/);
});

test('zero-tick recordings complete correctly and accidental read-model mutation fails closed', async () => {
  const source = fixture();
  const initial = createRun(source.level, source.options);
  const recorder = createRecorder(source.level, source.options, 'empty');
  releaseInputs(initial);
  recordRelease(recorder);
  const empty = await prepareReplayPlayer(exportReplay(recorder, initial));
  assert.equal(empty.phase, 'complete');
  assert.equal(empty.state.tick, 0);
  const player = await prepareReplayPlayer(source);
  player.state.score = 999;
  assert.throws(() => player.step(240), /final state/);
  assert.equal(player.phase, 'error');
  assert.equal(player.finalCheckpoint, null);
  player.reset();
  player.step(240);
  assert.equal(player.phase, 'complete');
});

test('accessors and oversize source text are refused without reading user properties', async () => {
  let reads = 0;
  const source = fixture();
  Object.defineProperty(source, 'level', {
    enumerable: true,
    get() {
      reads++;
      throw new Error('should not execute');
    },
  });
  await assert.rejects(prepareReplayPlayer(source), /accessors/);
  assert.equal(reads, 0);
  await assert.rejects(prepareReplayPlayer(' '.repeat(32 * 1024 * 1024 + 1)), /budget/);
});

for (let index = 1; index <= 4; index++) {
  test(`bundled Fieldcraft example ${index} is the genuine proof route and reproduces its role interaction`, async () => {
    const source = JSON.parse(
      await readFile(
        new URL(`../replay-theater/data/fieldcraft-0${index}.replay.json`, import.meta.url),
        'utf8',
      ),
    );
    const proof = JSON.parse(
      await readFile(new URL('../replays/fieldcraft-routes.json', import.meta.url), 'utf8'),
    );
    const pack = await loadSpecialtyPack();
    const route = proof.routes.find(
      (route) =>
        route.levelId === source.level.id &&
        route.turnPolicy === source.options.turnPolicy &&
        route.variant === 'specialty',
    );
    assert.ok(route);
    assert.deepEqual(source, replaySpecialtyRoute(pack, route).replay);
    const player = await prepareReplayPlayer(source),
      events = [];
    player.setRate(2);
    player.play();
    while (player.phase === 'playing') events.push(...player.advance(1 / 60).events);
    assert.equal(player.phase, 'complete');
    assert.equal(player.state.status, 'won');
    assert.equal(player.state.lives, 3);
    assert.equal(player.finalCheckpoint.hash, source.checkpoint.hash);
    assert.equal(events.filter((event) => event.type === 'run.completed').length, 1);
    if (index === 1)
      assert.ok(
        events.some(
          (event) =>
            event.type === 'signal.changed' &&
            event.zoneIds.length &&
            event.resistant &&
            event.speedFactor === 1,
        ),
      );
    if (index === 2) {
      assert.equal(events.filter((event) => event.type === 'pickup.collected').length, 2);
      assert.equal(
        events.filter((event) => event.type === 'ability.used' && event.primitive === 'stun-field')
          .length,
        2,
      );
      assert.equal(events.filter((event) => event.type === 'class.switched').length, 1);
      assert.equal(player.state.activeClassId, 'carrier');
    }
    if (index === 3) {
      assert.equal(events.filter((event) => event.type === 'craft.redeployed').length, 1);
      assert.ok(
        events.some((event) => event.type === 'ability.used' && event.primitive === 'impact-pulse'),
      );
    }
    if (index === 4)
      assert.ok(
        events.some((event) => event.type === 'ability.used' && event.primitive === 'slow-field'),
      );
  });
}

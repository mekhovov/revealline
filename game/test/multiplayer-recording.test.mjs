import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDuel, resumeDuel, pauseDuel, stepDuel, DUEL_PROTOCOL } from '../multiplayer.mjs';
import { releaseInputs } from '../core/index.mjs';
import {
  createCoop,
  startCoop,
  pauseCoop,
  resumeCoop,
  releaseCoopInputs,
  stepCoop,
} from '../coop/core.mjs';
import {
  createLocalMatchRecorder,
  snapshotLocalMatchRecording,
  verifyLocalMatchRecordingAsync,
  LOCAL_MATCH_MAX_TICKS,
} from '../multiplayer-recording.mjs';

const level = JSON.parse(readFileSync(new URL('../content/campaign.json', import.meta.url)))
  .levels[0];
const commands = (direction = null) => [
  { direction, boost: false, action: false, pickup: false },
  { direction: null, boost: false, action: false, pickup: false },
];
function versus() {
  const duel = { protocol: DUEL_PROTOCOL, seconds: 10 };
  const match = createDuel(level, { seed: 17 }, duel);
  const recorder = createLocalMatchRecorder({ mode: 'versus', level, options: { seed: 17 }, duel });
  resumeDuel(match, { preserveContinuation: true });
  return {
    match,
    recorder,
    tick(input = commands()) {
      recorder.append(input);
      stepDuel(match, input);
    },
  };
}
function teamLevel() {
  return {
    version: 'revealline-coop-level.v1',
    id: 'portable-team',
    revision: 1,
    name: 'Portable Team',
    width: 72,
    height: 36,
    spawns: [
      { x: 20.5, y: 0.5 },
      { x: 50.5, y: 35.5 },
    ],
    safeRects: [],
    walls: [],
    enemies: [{ id: 'keeper', type: 'drifter', x: 60.5, y: 28.5, vx: 0, vy: 0, radius: 0.2 }],
    goal: { coverage: 0.1 },
    rules: { moveSpeed: 10, boostMultiplier: 1.5 },
  };
}
const teamCommands = (direction = null) => [
  { direction, boost: false, support: false, steer: false },
  { direction: null, boost: false, support: false },
];

test('terminal-only native timed duel export verifies its real result and per-seat pause releases', async () => {
  const { match, recorder, tick } = versus();
  await assert.rejects(recorder.snapshot(match), /Finish this/);
  for (let i = 0; i < 50; i++) tick(commands('right'));
  pauseDuel(match, { preserveContinuation: true });
  recorder.release([0]);
  releaseInputs(match.runs[0]);
  recorder.release([1]);
  releaseInputs(match.runs[1]);
  resumeDuel(match, { preserveContinuation: true });
  while (match.status === 'running') tick();
  const recording = await recorder.snapshot(match);
  const verified = await verifyLocalMatchRecordingAsync(recording);
  assert.equal(verified.match, true);
  assert.equal(verified.state.status, 'finished');
  assert.equal(verified.state.winner, match.winner);
  assert.equal(verified.state.reason, 'Time — coverage, then lives, then score');
  assert.deepEqual(verified.state, match);
  assert.equal(verified.authority, 'local-replay-integrity-only');
  assert.equal(recording.recipe.duel.seconds, 10);
  const changed = structuredClone(recording);
  changed.segments[0].commands[0].direction = 'left';
  assert.equal((await verifyLocalMatchRecordingAsync(changed)).match, false);
  const relabelled = structuredClone(recording);
  relabelled.recipe.provenance.sourceRevision = 'different';
  await assert.rejects(verifyLocalMatchRecordingAsync(relabelled), /recipe hash differs/);
});

test('one native clear ends a paired race and retains the other board in the full checkpoint', async () => {
  const { match, recorder, tick } = versus();
  while (match.status === 'running') tick(commands('down'));
  assert.equal(match.runs[0].status, 'won');
  assert.equal(match.winner, 0);
  const recording = await recorder.snapshot(match);
  assert.equal((await verifyLocalMatchRecordingAsync(recording)).match, true);
  match.runs[1].score++;
  assert.equal((await verifyLocalMatchRecordingAsync(await recorder.snapshot(match))).match, false);
});

test('Team continuation includes old journal and every new release, support/steer and terminal cleanup', async () => {
  const level = teamLevel(),
    options = {
      seed: 17,
      difficulty: 'standard',
      jointCuts: true,
      assistCaptures: false,
      advancedCooperation: true,
    };
  const run = startCoop(createCoop(level, options));
  const oldJournal = [];
  for (let i = 0; i < 30; i++) {
    const input = teamCommands('down');
    oldJournal.push({ ticks: 1, commands: input });
    stepCoop(run, input);
  }
  oldJournal.push({ release: true });
  pauseCoop(run);
  // The host supplies this journal only after its saved native attempt verified.
  const recorder = createLocalMatchRecorder({ mode: 'team', level, options, segments: oldJournal });
  recorder.bindSource({ editionId: 'immutable-local-edition', packageIdentity: '1'.repeat(64) });
  recorder.release();
  resumeCoop(run);
  const tick = (input) => {
    recorder.append(input);
    stepCoop(run, input);
  };
  tick(teamCommands());
  for (let i = 0; i < 1000 && run.status === 'running'; i++) tick(teamCommands('down'));
  assert.equal(run.status, 'won');
  recorder.release();
  releaseCoopInputs(run);
  const recording = await recorder.snapshot(run);
  assert.equal(recording.recipe.options.assistCaptures, false);
  assert.equal(recording.recipe.provenance.editionId, 'immutable-local-edition');
  const verified = await verifyLocalMatchRecordingAsync(recording);
  assert.equal(verified.match, true);
  assert.deepEqual(verified.state, run);
  const missing = structuredClone(recording);
  missing.segments.pop();
  assert.equal((await verifyLocalMatchRecordingAsync(missing)).match, false);
});

test('verification owns the complete input before yielding and responds to cancellation', async () => {
  const { match, recorder, tick } = versus();
  while (match.status === 'running') tick();
  const recording = await recorder.snapshot(match);
  const controller = new AbortController();
  await assert.rejects(verifyLocalMatchRecordingAsync(recording, { signal: AbortSignal.abort() }), {
    name: 'AbortError',
  });
  await assert.rejects(
    verifyLocalMatchRecordingAsync(recording, {
      signal: controller.signal,
      chunkTicks: 10,
      onProgress: () => controller.abort(),
    }),
    { name: 'AbortError' },
  );
  const pending = verifyLocalMatchRecordingAsync(recording, { chunkTicks: 1 });
  recording.recipe.options.seed = 18;
  recording.segments[0].commands[0].direction = 'down';
  assert.equal((await pending).match, true);
});

test('import rejects injected state, excessive timelines and getter execution; live budget exhaustion only disables export', async () => {
  const { match, recorder, tick } = versus();
  while (match.status === 'running') tick();
  const recording = await recorder.snapshot(match);
  assert.throws(
    () => snapshotLocalMatchRecording({ ...recording, state: match }),
    /unsupported field/i,
  );
  const excessive = structuredClone(recording);
  excessive.segments[0].ticks = LOCAL_MATCH_MAX_TICKS + 1;
  assert.throws(() => snapshotLocalMatchRecording(excessive), /simulation budget/);
  let read = false;
  assert.throws(() =>
    snapshotLocalMatchRecording({
      ...recording,
      get state() {
        read = true;
        return match;
      },
    }),
  );
  assert.equal(read, false);
  const capped = createLocalMatchRecorder({
    mode: 'versus',
    level,
    options: { seed: 17 },
    duel: { protocol: DUEL_PROTOCOL, seconds: 10 },
    segments: [{ ticks: LOCAL_MATCH_MAX_TICKS, commands: commands() }],
  });
  assert.doesNotThrow(() => capped.append(commands()));
  assert.match(capped.error, /simulation budget/);
  await assert.rejects(capped.snapshot(match), /simulation budget/);
});

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
  LOCAL_MATCH_RECORDING,
  LOCAL_MATCH_RECORDING_V2,
} from '../multiplayer-recording.mjs';
import {
  LOCAL_TERMINAL_OBSERVATIONS,
  localTerminalObservations,
} from '../multiplayer-terminal-observation.mjs';

const level = JSON.parse(readFileSync(new URL('../content/campaign.json', import.meta.url)))
  .levels[0];
const commands = (direction = null) => [
  { direction, boost: false, action: false, pickup: false },
  { direction: null, boost: false, action: false, pickup: false },
];
function versus(format = LOCAL_MATCH_RECORDING) {
  const duel = { protocol: DUEL_PROTOCOL, seconds: 10 };
  const match = createDuel(level, { seed: 17 }, duel);
  const recorder = createLocalMatchRecorder({
    mode: 'versus',
    level,
    options: { seed: 17 },
    duel,
    format,
  });
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

test('the observation contract pins native generations and refuses successor or mixed-board states', () => {
  const { match } = versus();
  assert.doesNotThrow(() => localTerminalObservations('versus', match));
  const future = structuredClone(match);
  future.ruleset = 'xonix-core.v17';
  future.runs.forEach((run) => {
    run.ruleset = future.ruleset;
  });
  assert.throws(() => localTerminalObservations('versus', future), /not supported/);
  const mixed = structuredClone(match);
  mixed.runs[1].ruleset = 'xonix-core.v16';
  assert.throws(() => localTerminalObservations('versus', mixed), /Both recorded boards/);
  const team = createCoop(teamLevel());
  assert.doesNotThrow(() => localTerminalObservations('team', team));
  team.ruleset = 'revealline-coop.v17';
  assert.throws(() => localTerminalObservations('team', team), /not supported/);
  assert.throws(() => localTerminalObservations('constructor', match), /not supported/);
});

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
  const recorder = createLocalMatchRecorder({
    mode: 'team',
    level,
    options,
    segments: oldJournal,
    format: LOCAL_MATCH_RECORDING,
  });
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

test('v2 observes exact terminal outcomes separately from continuous native-state bits; v1 never falls back', async () => {
  const { match, recorder, tick } = versus(LOCAL_MATCH_RECORDING_V2);
  while (match.status === 'running') tick();
  const original = await recorder.snapshot(match);
  assert.equal(original.format, LOCAL_MATCH_RECORDING_V2);
  assert.equal(original.final.observationContract, LOCAL_TERMINAL_OBSERVATIONS);
  const exact = await verifyLocalMatchRecordingAsync(original);
  assert.equal(exact.match, true);
  assert.equal(exact.exactStateMatch, true);
  assert.equal(exact.terminalObservationMatch, true);
  assert.equal(exact.verificationScope, LOCAL_TERMINAL_OBSERVATIONS);
  assert.equal(exact.authority, 'local-terminal-observations-only');

  // The contract deliberately excludes continuous coordinates, not merely tiny
  // errors. It must never claim exact state or restart determinism for this file.
  match.runs[0].enemies[0].x += 0.25;
  const moved = await recorder.snapshot(match);
  assert.equal(moved.final.observationSha256, original.final.observationSha256);
  assert.notEqual(moved.final.stateSha256, original.final.stateSha256);
  const portable = await verifyLocalMatchRecordingAsync(moved);
  assert.equal(portable.match, true);
  assert.equal(portable.exactStateMatch, false);
  assert.match(portable.diagnostics[0], /Only declared terminal observations/);

  const historical = structuredClone(moved);
  historical.format = LOCAL_MATCH_RECORDING;
  delete historical.inputSha256;
  delete historical.final.observationContract;
  delete historical.final.observationSha256;
  const strict = await verifyLocalMatchRecordingAsync(historical);
  assert.equal(strict.match, false);
  assert.equal(strict.exactStateMatch, false);
  assert.equal(strict.terminalObservationMatch, null);
  assert.equal(strict.verificationScope, 'exact-native-state.v1');
});

test('v2 rejects changed topology, objectives, target identity, counters and native random state', async () => {
  const source = JSON.parse(
    readFileSync(
      new URL(
        '../../docs/qualification/industrial-art/native-play-2026-10-04/versus-crossing-post.json',
        import.meta.url,
      ),
    ),
  );
  const duel = { protocol: DUEL_PROTOCOL, seconds: 10 };
  const match = createDuel(source.recipe.level, source.recipe.options, duel);
  const recorder = createLocalMatchRecorder({ ...source.recipe, duel });
  resumeDuel(match, { preserveContinuation: true });
  while (match.status === 'running') {
    const input = commands();
    recorder.append(input);
    stepDuel(match, input);
  }
  const original = await recorder.snapshot(match);
  assert.equal((await verifyLocalMatchRecordingAsync(original)).match, true);
  const mutations = [
    (run) => {
      run.cells[run.width + 1] ^= 1;
    },
    (run) => {
      run.score++;
    },
    (run) => {
      run.objectives.push({
        id: 'forged-objective',
        required: true,
        captured: true,
        revealed: true,
      });
    },
    (run) => {
      run.classic.combatPatrols.actors[0].alive = false;
    },
    (run) => {
      run.classic.combatPatrols.actors[0].id = 'substituted-target';
    },
    (run) => {
      run.classic.combatPatrols.actors[0].random ^= 1;
    },
    (run) => {
      run.classic.combatPatrols.eliminations.push({
        id: 'post-patrol',
        cause: 'ram',
        tick: run.tick,
      });
    },
  ];
  for (const change of mutations) {
    const changed = structuredClone(match);
    change(changed.runs[0]);
    const result = await verifyLocalMatchRecordingAsync(await recorder.snapshot(changed));
    assert.equal(result.match, false);
    assert.equal(result.terminalObservationMatch, false);
  }
});

test('v2 binds the complete consumed input/release journal and refuses missing or unknown contracts', async () => {
  const { match, recorder, tick } = versus(LOCAL_MATCH_RECORDING_V2);
  while (match.status === 'running') tick();
  const recording = await recorder.snapshot(match);
  const changed = structuredClone(recording);
  changed.segments[0].commands[0].direction = 'right';
  await assert.rejects(verifyLocalMatchRecordingAsync(changed), /input hash differs/);
  const released = structuredClone(recording);
  released.segments.push({ release: [0] });
  await assert.rejects(verifyLocalMatchRecordingAsync(released), /input hash differs/);
  for (const key of ['observationContract', 'observationSha256']) {
    const missing = structuredClone(recording);
    delete missing.final[key];
    assert.throws(() => snapshotLocalMatchRecording(missing), /observation contract/);
  }
  const future = structuredClone(recording);
  future.final.observationContract = 'revealline-capture-terminal-observations.v999';
  assert.throws(() => snapshotLocalMatchRecording(future), /observation contract/);
  const corrupt = structuredClone(recording);
  corrupt.final.observationSha256 = '0'.repeat(64);
  assert.equal((await verifyLocalMatchRecordingAsync(corrupt)).match, false);
  const legacy = structuredClone(recording);
  legacy.format = LOCAL_MATCH_RECORDING;
  assert.throws(() => snapshotLocalMatchRecording(legacy), /unsupported field/i);
});

test('v2 Team checks both seats, rescue/support counters and terminal release state', async () => {
  const level = teamLevel(),
    options = { seed: 17 };
  const state = startCoop(createCoop(level, options));
  const recorder = createLocalMatchRecorder({ mode: 'team', level, options });
  for (let i = 0; i < 1000 && state.status === 'running'; i++) {
    const input = teamCommands('down');
    recorder.append(input);
    stepCoop(state, input);
  }
  assert.equal(state.status, 'won');
  const recording = await recorder.snapshot(state);
  const result = await verifyLocalMatchRecordingAsync(recording);
  assert.equal(result.match, true);
  assert.equal(result.exactStateMatch, true);
  for (const change of [
    (run) => {
      run.players[1].status = 'downed';
    },
    (run) => {
      run.players[1].support.uses++;
    },
    (run) => {
      run.team.rescues++;
    },
    (run) => {
      run.needsNeutral[1] = !run.needsNeutral[1];
    },
  ]) {
    const changed = structuredClone(state);
    change(changed);
    assert.equal(
      (await verifyLocalMatchRecordingAsync(await recorder.snapshot(changed))).match,
      false,
    );
  }
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

test('v1 import requires complete source pins while preserving optional community ownership', async () => {
  const { match, recorder } = versus();
  // A fabricated terminal flag supplies a structural fixture, never completion
  // evidence. This case exercises the import boundary without replay stepping.
  match.status = 'finished';
  const recording = await recorder.snapshot(match);
  assert.deepEqual(snapshotLocalMatchRecording(recording), recording);
  assert.equal(Object.hasOwn(recording.recipe.provenance, 'editionId'), false);
  assert.equal(Object.hasOwn(recording.recipe.provenance, 'packageIdentity'), false);
  for (const key of ['sourceLevelId', 'sourceRevision', 'sourceIdentity']) {
    const missing = structuredClone(recording);
    delete missing.recipe.provenance[key];
    assert.throws(() => snapshotLocalMatchRecording(missing), /source pins/i, key);
  }
  const imported = structuredClone(recording);
  imported.recipe.provenance.editionId = 'community-owned-pilot-copy';
  imported.recipe.provenance.packageIdentity = '1'.repeat(64);
  assert.deepEqual(snapshotLocalMatchRecording(imported), imported);
  assert.deepEqual(
    recording.recipe.provenance,
    snapshotLocalMatchRecording(recording).recipe.provenance,
  );
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

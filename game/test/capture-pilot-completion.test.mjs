import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoop, startCoop, stepCoop } from '../coop/core.mjs';
import { createRun, stepRun } from '../core/index.mjs';
import { createRecorder, recordInput, exportReplay, verifyReplay } from '../replay.mjs';
import { createDuel, resumeDuel, stepDuel } from '../multiplayer.mjs';
import {
  createLocalMatchRecorder,
  LOCAL_MATCH_RECORDING_V2,
  verifyLocalMatchRecordingAsync,
} from '../multiplayer-recording.mjs';
import {
  pursuitPilotCases,
  verifyPursuitPilotRecording,
} from '../../scripts/qualify-pursuit-pilots.mjs';

// Real directional inputs, including neutral commands after native closures.
// Both seats first connect their nearby islands. Seat 2 waits on the bottom
// edge for the keeper to pass. Each seat then encloses one anchor; seat 1
// returns around the exposed core. No simulation state is assigned by the route.
// This fixed seed demonstrates legal completion, not human coordination quality.
const SEGMENTS = [
  [67, 'left', 'right'],
  [14, 'left', null],
  [1, null, null],
  [102, 'down', null],
  [1, null, null],
  [6, 'down', null],
  [1, null, null],
  [8, 'left', null],
  [87, 'left', 'up'],
  [1, null, 'up'],
  [14, 'up', 'up'],
  [1, 'up', null],
  [6, 'up', 'up'],
  [1, 'up', null],
  [80, 'up', 'right'],
  [1, null, 'right'],
  [6, 'up', 'right'],
  [1, null, 'right'],
  [7, 'right', 'right'],
  [1, 'right', null],
  [86, 'right', 'down'],
  [1, null, 'down'],
  [15, 'down', 'down'],
  [1, 'down', null],
  [6, 'down', 'down'],
  [140, 'down', null],
  [1, null, null],
  [95, 'right', null],
  [1, null, null],
  [67, 'down', null],
  [1, null, null],
  [67, 'left', null],
  [1, null, null],
  [61, 'up', null],
];
const REVISIONS = {
  gentle: 'gp4g-3ff00000000000003ff00000000000003ff0000000000000-836b3e2cbd1d8e1d',
  standard: 'gp4s-3ff00000000000003ff00000000000003ff0000000000000-46504be925e268b3',
  expert: 'gp4e-3ff00000000000003ff00000000000003ff0000000000000-56b560733d892998',
};
const cases = pursuitPilotCases().filter((entry) => entry.family === 'capture');

for (const [pace, revision] of Object.entries(REVISIONS))
  test(`Relay Rendezvous Team/${pace}/seed17 completes both anchors and core with legal controls`, async () => {
    const entry = cases.find(
      (row) => row.pilot === 'relay-rendezvous' && row.mode === 'team' && row.pace === pace,
    );
    assert.ok(entry);
    assert.equal(entry.seed, 17);
    assert.equal(entry.level.version, 'revealline-coop-level.v11');
    assert.equal(entry.level.revision, revision);
    assert.deepEqual(entry.level.goal, { cores: ['workshop-core'] });
    const source = structuredClone(entry.level);
    const run = createCoop(entry.level, entry.options);
    const reserves = run.team.reserves;
    const recorder = createLocalMatchRecorder({
      mode: 'team',
      level: entry.level,
      options: entry.options,
      provenance: entry.recordingProvenance,
      format: LOCAL_MATCH_RECORDING_V2,
    });
    const objectiveOrder = [];
    const anchorContributors = [];
    const closureContributors = new Set();
    const damage = [];
    startCoop(run);
    for (const [ticks, first, second] of SEGMENTS) {
      const commands = [first, second].map((direction) => ({
        direction,
        boost: false,
        support: false,
      }));
      for (let i = 0; i < ticks; i++) {
        assert.equal(run.status, 'running', 'The route cannot continue after a terminal result.');
        recorder.append(commands);
        stepCoop(run, commands);
        for (const event of run.events) {
          if (event.type === 'player.downed') damage.push(event);
          if (event.type === 'cut.closed') closureContributors.add(event.player);
          if (event.type === 'objective.captured') {
            objectiveOrder.push(event.kind === 'anchor' ? `anchor-${event.anchor}` : 'core');
            if (event.kind === 'anchor') {
              const closer = run.events.find((row) => row.type === 'cut.closed');
              assert.ok(closer);
              anchorContributors.push([event.anchor, closer.player]);
            }
          }
          if (event.type === 'shield.disabled') {
            objectiveOrder.push('shield-disabled');
            assert.equal(run.status, 'running');
            assert.ok(run.strongholds[0].anchors.every((anchor) => anchor.captured));
            assert.equal(run.strongholds[0].defeated, false);
          }
          if (event.type === 'core.defeated') objectiveOrder.push('core-defeated');
          if (event.type === 'run.completed') objectiveOrder.push(event.status);
        }
      }
    }
    assert.equal(run.status, 'won');
    assert.equal(run.tick, 949);
    assert.equal(run.team.reserves, reserves);
    assert.deepEqual(damage, []);
    assert.ok(run.players.every((player) => player.status === 'active' && !player.cutting));
    assert.deepEqual([...closureContributors].sort(), [0, 1]);
    assert.deepEqual(anchorContributors, [
      [0, 0],
      [1, 1],
    ]);
    assert.deepEqual(objectiveOrder, [
      'anchor-0',
      'anchor-1',
      'shield-disabled',
      'core',
      'core-defeated',
      'won',
    ]);
    assert.equal(run.strongholds[0].shielded, false);
    assert.equal(run.strongholds[0].defeated, true);
    assert.ok(
      run.coverage < 0.1,
      'The authored core objective, not a substituted coverage goal, wins.',
    );
    assert.deepEqual(entry.level, source);
    const recording = await recorder.snapshot(run);
    assert.equal(recording.segments.length, SEGMENTS.length);
    const verified = await verifyLocalMatchRecordingAsync(recording);
    assert.equal(verified.match, true);
    assert.equal(verified.exactStateMatch, true);
    assert.equal(verified.terminalObservationMatch, true);
    assert.deepEqual(verified.state, run);
    const receipt = await verifyPursuitPilotRecording({
      pilot: entry.pilot,
      mode: 'team',
      pace,
      recording,
    });
    assert.deepEqual(receipt.outcome.completedBoards, [1]);
    assert.equal(receipt.outcome.exactStateMatch, true);
    assert.equal(receipt.outcome.terminalObservationMatch, true);
    assert.deepEqual(receipt.outcome.provenance, entry.recordingProvenance);
    assert.equal(receipt.humanPlay, 'pending');
    assert.equal(receipt.deviceAndAccessibility, 'pending');
    assert.equal(receipt.publicRelease, 'not-qualified');
  });

// Fixed consumed controls from two-seat island approaches and complementary
// vertical cuts. Gentle/Expert include native recovery; these are completion
// routes, not claims of damage-free mastery or ideal human routing.
const PINCER = {
  gentle: {
    revision: 'gp4g-3ff00000000000003ff00000000000003ff0000000000000-131756db90314bfc',
    ticks: 2076,
    segments: [
      [211, 'right', 'left'],
      [1, null, 'left'],
      [12, 'right', 'left'],
      [1, 'right', null],
      [20, 'right', 'left'],
      [1, null, 'left'],
      [12, 'down', 'left'],
      [1, 'down', null],
      [224, 'down', 'up'],
      [1, 'down', null],
      [1, null, 'up'],
      [5, 'down', 'up'],
      [1, 'down', null],
      [1, null, 'left'],
      [461, 'right', 'left'],
      [1, 'right', null],
      [1, null, 'down'],
      [196, 'up', 'down'],
      [1, 'up', null],
      [13, 'up', 'down'],
      [1, null, 'down'],
      [264, 'up', 'down'],
      [1, null, null],
      [175, 'left', 'right'],
      [1, 'left', null],
      [13, 'left', 'up'],
      [1, null, 'up'],
      [413, 'down', 'up'],
      [1, null, 'up'],
      [41, 'down', 'up'],
    ],
  },
  standard: {
    revision: 'gp4s-3ff00000000000003ff00000000000003ff0000000000000-b609455dc00eb3fa',
    ticks: 1151,
    segments: [
      [211, 'right', 'left'],
      [1, null, 'left'],
      [12, 'right', 'left'],
      [1, 'right', null],
      [20, 'right', 'left'],
      [1, null, 'left'],
      [12, 'down', 'left'],
      [1, 'down', null],
      [224, 'down', 'up'],
      [1, 'down', null],
      [1, null, 'up'],
      [5, 'down', 'up'],
      [1, 'down', null],
      [1, null, 'left'],
      [461, 'right', 'left'],
      [1, 'right', null],
      [1, null, 'down'],
      [196, 'up', 'down'],
    ],
  },
  expert: {
    revision: 'gp4e-3ff00000000000003ff00000000000003ff0000000000000-dd627e293ce214de',
    ticks: 1518,
    segments: [
      [211, 'right', 'left'],
      [1, null, 'left'],
      [12, 'right', 'left'],
      [1, 'right', null],
      [20, 'right', 'left'],
      [1, null, 'left'],
      [12, 'down', 'left'],
      [1, 'down', null],
      [189, 'down', 'up'],
      [1, 'down', null],
      [35, 'down', 'up'],
      [1, null, null],
      [6, 'down', 'up'],
      [1, null, 'up'],
      [184, 'right', 'up'],
      [1, 'right', null],
      [6, 'right', 'up'],
      [1, 'right', null],
      [270, 'right', 'left'],
      [1, null, 'left'],
      [190, 'up', 'left'],
      [1, 'up', null],
      [19, 'up', 'down'],
      [1, null, 'down'],
      [82, 'up', 'down'],
      [1, 'up', null],
      [77, 'up', 'down'],
      [1, 'up', null],
      [103, 'up', 'down'],
      [88, null, 'down'],
    ],
  },
};
const CROSSING = {
  gentle: {
    revision: 'gp4g-3ff00000000000003ff00000000000003ff0000000000000-129e64b66a9bddb0',
    ticks: 4965,
    segments: [
      [257, 'down'],
      [1, null],
      [218, 'down'],
      [1, null],
      [529, 'right'],
      [1, null],
      [243, 'up'],
      [1, null],
      [231, 'up'],
      [1, null],
      [528, 'left'],
      [1, null],
      [229, 'down'],
      [1, null],
      [827, 'right'],
      [230, 'down'],
      [1, null],
      [518, 'left'],
      [230, 'down'],
      [1, null],
      [229, 'up'],
      [1, null],
      [217, 'right'],
      [1, null],
      [468, 'down'],
    ],
  },
  standard: {
    revision: 'gp4s-3ff00000000000003ff00000000000003ff0000000000000-9c05667e7a9aa05b',
    ticks: 2737,
    segments: [
      [257, 'down'],
      [1, null],
      [218, 'down'],
      [1, null],
      [529, 'right'],
      [1, null],
      [243, 'up'],
      [1, null],
      [231, 'up'],
      [1, null],
      [528, 'left'],
      [1, null],
      [229, 'down'],
      [1, null],
      [495, 'right'],
    ],
  },
  expert: {
    revision: 'gp4e-3ff00000000000003ff00000000000003ff0000000000000-b003908dc019c145',
    ticks: 5012,
    segments: [
      [180, null],
      [257, 'down'],
      [1, null],
      [218, 'down'],
      [1, null],
      [529, 'right'],
      [1, null],
      [243, 'up'],
      [1, null],
      [231, 'up'],
      [1, null],
      [528, 'left'],
      [1, null],
      [229, 'down'],
      [1, null],
      [914, 'right'],
      [230, 'down'],
      [1, null],
      [529, 'left'],
      [1, null],
      [229, 'up'],
      [1, null],
      [216, 'right'],
      [1, null],
      [468, 'down'],
    ],
  },
};

async function verifyRecordedPilot(entry, recording, expectedState) {
  const result = await verifyLocalMatchRecordingAsync(recording);
  assert.equal(result.match, true);
  assert.equal(result.exactStateMatch, true);
  assert.equal(result.terminalObservationMatch, true);
  assert.deepEqual(result.state, expectedState);
  return verifyPursuitPilotRecording({
    pilot: entry.pilot,
    mode: entry.mode,
    pace: entry.pace,
    recording,
  });
}
function reviewBoundary(receipt, completedBoards) {
  assert.deepEqual(receipt.outcome.completedBoards, completedBoards);
  assert.equal(receipt.humanPlay, 'pending');
  assert.equal(receipt.deviceAndAccessibility, 'pending');
  assert.equal(receipt.publicRelease, 'not-qualified');
}
for (const [pace, fixture] of Object.entries(PINCER))
  test(`Pincer Yard Team/${pace}/seed17 completes through both players' legal closures`, async () => {
    const entry = cases.find(
      (row) => row.pilot === 'pincer-yard' && row.mode === 'team' && row.pace === pace,
    );
    assert.ok(entry);
    assert.equal(entry.seed, 17);
    assert.equal(entry.level.revision, fixture.revision);
    const source = structuredClone(entry.level);
    const run = createCoop(entry.level, entry.options);
    const recorder = createLocalMatchRecorder({
      mode: 'team',
      level: entry.level,
      options: entry.options,
      provenance: entry.recordingProvenance,
      format: LOCAL_MATCH_RECORDING_V2,
    });
    const contributors = new Set();
    startCoop(run);
    for (const [ticks, a, b] of fixture.segments) {
      const commands = [a, b].map((direction) => ({ direction, boost: false, support: false }));
      for (let i = 0; i < ticks; i++) {
        assert.equal(run.status, 'running');
        recorder.append(commands);
        stepCoop(run, commands);
        for (const event of run.events)
          if (event.type === 'cut.closed') contributors.add(event.player);
      }
    }
    assert.equal(run.status, 'won');
    assert.equal(run.tick, fixture.ticks);
    assert.ok(run.coverage >= source.goal.coverage);
    assert.deepEqual([...contributors].sort(), [0, 1]);
    assert.deepEqual(entry.level, source);
    const recording = await recorder.snapshot(run);
    assert.deepEqual(recording.recipe.level, source);
    assert.deepEqual(recording.recipe.options, entry.options);
    assert.deepEqual(recording.recipe.provenance, entry.recordingProvenance);
    const receipt = await verifyRecordedPilot(entry, recording, run);
    reviewBoundary(receipt, [1]);
  });

for (const [pace, fixture] of Object.entries(CROSSING))
  for (const mode of ['solo', 'versus'])
    test(`Crossing Post ${mode}/${pace}/seed1 completes its native capture objective`, async () => {
      const entry = cases.find(
        (row) => row.pilot === 'crossing-post' && row.mode === mode && row.pace === pace,
      );
      assert.ok(entry);
      assert.equal(entry.seed, 1);
      assert.equal(entry.level.revision, fixture.revision);
      assert.equal(entry.options.classId, 'scout');
      assert.equal(entry.options.turnPolicy, 'immediate');
      const source = structuredClone(entry.level);
      const run =
        mode === 'solo'
          ? createRun(entry.level, entry.options)
          : createDuel(entry.level, entry.options, entry.duel);
      const recorder =
        mode === 'solo'
          ? createRecorder(entry.level, entry.options)
          : createLocalMatchRecorder({
              mode,
              level: entry.level,
              options: entry.options,
              duel: entry.duel,
              provenance: entry.recordingProvenance,
              format: LOCAL_MATCH_RECORDING_V2,
            });
      if (mode === 'versus') resumeDuel(run, { preserveContinuation: true });
      for (const [ticks, direction] of fixture.segments) {
        const command = { direction, boost: false, action: false, pickup: false };
        for (let i = 0; i < ticks; i++) {
          if (mode === 'solo') {
            assert.ok(['running', 'respawning'].includes(run.status));
            recordInput(recorder, command);
            stepRun(run, command);
          } else {
            assert.equal(run.status, 'running');
            const commands = [command, command];
            recorder.append(commands);
            stepDuel(run, commands);
          }
        }
      }
      const boards = mode === 'solo' ? [run] : run.runs;
      assert.equal(run.tick, fixture.ticks);
      for (const board of boards) {
        assert.equal(board.status, 'won');
        assert.ok(board.coverage >= source.goal.coverage);
        assert.equal(board.seed, entry.seed);
      }
      assert.deepEqual(entry.level, source);
      let receipt;
      if (mode === 'solo') {
        const recording = exportReplay(recorder, run);
        const verified = verifyReplay(recording);
        assert.equal(verified.match, true);
        assert.deepEqual(verified.state, run);
        receipt = await verifyPursuitPilotRecording({ pilot: entry.pilot, mode, pace, recording });
        assert.equal(receipt.outcome.summary.status, 'won');
        assert.equal(receipt.humanPlay, 'pending');
        assert.equal(receipt.deviceAndAccessibility, 'pending');
        assert.equal(receipt.publicRelease, 'not-qualified');
      } else {
        assert.equal(run.status, 'finished');
        assert.equal(run.winner, null);
        assert.equal(run.reason, 'First clear');
        assert.deepEqual(run.runs[0], run.runs[1]);
        const recording = await recorder.snapshot(run);
        assert.deepEqual(recording.recipe.duel, entry.duel);
        assert.deepEqual(recording.recipe.provenance, entry.recordingProvenance);
        receipt = await verifyRecordedPilot(entry, recording, run);
        reviewBoundary(receipt, [1, 2]);
      }
    });

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { canonicalJSON } from '../data-json.mjs';
import { createRun, stepRun } from '../core/index.mjs';
import { createCoop, startCoop, stepCoop } from '../coop/core.mjs';
import { createDuel, resumeDuel, stepDuel } from '../multiplayer.mjs';
import { createRecorder, recordInput, exportReplay, verifyReplay } from '../replay.mjs';
import {
  createLocalMatchRecorder,
  LOCAL_MATCH_RECORDING_V2,
  verifyLocalMatchRecordingAsync,
} from '../multiplayer-recording.mjs';
import {
  pursuitPilotCases,
  verifyPursuitPilotRecording,
} from '../../scripts/qualify-pursuit-pilots.mjs';

// Generated software witnesses for the unchanged accepted pilot recipes.
// Only these consumed controls advance a run: no actor, geometry, protection,
// objective or player state is assigned. These supplement the coverage routes
// with real interceptions; they do not establish human enjoyment or art approval.
const CROSSING = [
  [82, 'right'],
  [326, 'down'],
  [110, 'right'],
  [82, 'down'],
  [214, 'right'],
  [90, 'up'],
  [105, 'right'],
  [75, 'up'],
  [1, null],
  [237, 'up'],
];
// Each seat intercepts a different family. The second seat subsequently takes
// one native keeper/trail hit and is rescued by its partner's capture. This is
// a contact/contribution/completion witness, not damage-free Team mastery.
const PINCER = [
  [122, 'right', 'up'],
  [89, 'right', 'left'],
  [1, null, 'left'],
  [102, 'right', 'left'],
  [228, 'down', 'left'],
  [22, 'down', null],
  [1, null, null],
  [122, 'up', 'down'],
  [225, 'up', 'left'],
  [1, 'up', null],
  [117, 'up', 'left'],
  [1, null, 'up'],
  [230, null, 'up'],
  [1, null, null],
  [95, null, 'down'],
  [304, null, 'left'],
];
const cases = pursuitPilotCases();
const hash = (value) => createHash('sha256').update(canonicalJSON(value)).digest('hex');
const crossings = [
  [498, 'post-patrol', 'ram'],
  [865, 'yard-courier', 'ram'],
];
function reviewBoundary(receipt) {
  assert.equal(receipt.humanPlay, 'pending');
  assert.equal(receipt.deviceAndAccessibility, 'pending');
  assert.equal(receipt.publicRelease, 'not-qualified');
}
async function verifyLocal(entry, recording, state, completedBoards) {
  assert.deepEqual(recording.recipe.level, entry.level);
  assert.deepEqual(recording.recipe.options, entry.options);
  assert.deepEqual(recording.recipe.provenance, entry.recordingProvenance);
  const verified = await verifyLocalMatchRecordingAsync(recording);
  assert.equal(verified.match, true);
  assert.equal(verified.exactStateMatch, true);
  assert.equal(verified.terminalObservationMatch, true);
  assert.deepEqual(verified.state, state);
  const receipt = await verifyPursuitPilotRecording({
    pilot: entry.pilot,
    mode: entry.mode,
    pace: entry.pace,
    recording,
  });
  assert.deepEqual(receipt.outcome.completedBoards, completedBoards);
  assert.deepEqual(receipt.outcome.provenance, entry.recordingProvenance);
  reviewBoundary(receipt);
}

for (const mode of ['solo', 'versus'])
  test(`Crossing Post ${mode}/standard/seed1 intercepts Patroller and Courier before a native capture win`, async () => {
    const entry = cases.find(
      (row) => row.pilot === 'crossing-post' && row.mode === mode && row.pace === 'standard',
    );
    assert.ok(entry);
    assert.equal(entry.seed, 1);
    assert.equal(
      hash(entry.level),
      'e67cd16f122c18df337bbeeaec45c8d00e61d31400e44f12cf22b455fed06bc6',
    );
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
    const boards = mode === 'solo' ? [run] : run.runs;
    const contacts = boards.map(() => []);
    for (const [ticks, direction] of CROSSING) {
      const command = { direction, boost: false, action: false, pickup: false };
      for (let i = 0; i < ticks; i++) {
        assert.equal(run.status, 'running');
        if (mode === 'solo') {
          recordInput(recorder, command);
          stepRun(run, command);
        } else {
          recorder.append([command, command]);
          stepDuel(run, [command, command]);
        }
        boards.forEach((board, index) => {
          for (const event of board.events)
            if (event.type === 'combat.eliminated') {
              contacts[index].push([board.tick, event.id, event.cause]);
              assert.equal(board.status, 'running');
              assert.ok(board.coverage < source.goal.coverage);
            }
        });
      }
    }
    assert.equal(run.tick, 1322);
    for (const [index, board] of boards.entries()) {
      assert.deepEqual(contacts[index], crossings);
      assert.equal(board.status, 'won');
      assert.equal(board.lives, 3);
      assert.equal(board.result.livesLost, 0);
      assert.ok(board.coverage >= source.goal.coverage);
      assert.equal(board.classic.hunt.touchKills, 2);
      assert.equal(board.classic.hunt.captureKills, 0);
      assert.equal(board.classic.hunt.score, 200);
      assert.ok(board.classic.combatPatrols.actors.every((actor) => !actor.alive));
    }
    assert.deepEqual(entry.level, source);
    if (mode === 'solo') {
      const recording = exportReplay(recorder, run);
      const verified = verifyReplay(recording);
      assert.equal(verified.match, true);
      assert.deepEqual(verified.state, run);
      const receipt = await verifyPursuitPilotRecording({
        pilot: entry.pilot,
        mode,
        pace: entry.pace,
        recording,
      });
      assert.equal(receipt.outcome.summary.status, 'won');
      reviewBoundary(receipt);
    } else {
      assert.equal(run.status, 'finished');
      assert.equal(run.winner, null);
      assert.equal(run.reason, 'First clear');
      assert.deepEqual(boards[0], boards[1]);
      const recording = await recorder.snapshot(run);
      assert.deepEqual(recording.recipe.duel, entry.duel);
      await verifyLocal(entry, recording, run, [1, 2]);
    }
  });

test('Pincer Yard Team/standard/seed17 credits one contact to each seat, rescues and clears its native capture goal', async () => {
  const entry = cases.find(
    (row) => row.pilot === 'pincer-yard' && row.mode === 'team' && row.pace === 'standard',
  );
  assert.ok(entry);
  assert.equal(entry.seed, 17);
  assert.equal(
    hash(entry.level),
    'eec09ec1411948825897dec39ca8e988a4d7f2c59ff73c2c24cff76ce26c8859',
  );
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
  const contacts = [],
    damage = [],
    closureContributors = new Set();
  startCoop(run);
  for (const [ticks, a, b] of PINCER) {
    const commands = [a, b].map((direction) => ({ direction, boost: false, support: false }));
    for (let i = 0; i < ticks; i++) {
      assert.equal(run.status, 'running');
      recorder.append(commands);
      stepCoop(run, commands);
      for (const event of run.events) {
        if (event.type === 'combat.eliminated') {
          contacts.push([event.id, event.cause, event.players]);
          assert.equal(run.status, 'running');
          assert.ok(run.coverage < source.goal.coverage);
        }
        if (event.type === 'player.downed') damage.push([event.player, event.cause]);
        if (event.type === 'cut.closed') closureContributors.add(event.player);
      }
    }
  }
  assert.equal(run.tick, 1661);
  assert.equal(run.status, 'won');
  assert.deepEqual(contacts, [
    ['west-refuge', 'ram', [0]],
    ['east-switchback', 'ram', [1]],
  ]);
  assert.deepEqual(damage, [[1, 'enemy-trail']]);
  assert.equal(run.team.rescues, 1);
  assert.equal(run.team.reserves, reserves);
  assert.ok(run.players.every((player) => player.status === 'active' && !player.cutting));
  assert.deepEqual([...closureContributors].sort(), [0, 1]);
  assert.ok(run.coverage >= source.goal.coverage);
  assert.equal(run.hunt.touchKills, 2);
  assert.equal(run.hunt.captureKills, 0);
  assert.equal(run.hunt.score, 200);
  assert.ok(run.combatPatrols.actors.every((actor) => !actor.alive));
  assert.deepEqual(entry.level, source);
  const recording = await recorder.snapshot(run);
  await verifyLocal(entry, recording, run, [1]);
});

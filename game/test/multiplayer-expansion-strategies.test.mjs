import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createMultiplayerExpansionCandidates } from '../content-design/multiplayer-expansion.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { createCoop, startCoop, stepCoop } from '../coop/core.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';
import {
  createLocalMatchRecorder,
  verifyLocalMatchRecordingAsync,
  LOCAL_MATCH_RECORDING_V2,
} from '../multiplayer-recording.mjs';
const fixture = JSON.parse(
  await readFile(
    new URL('./fixtures/multiplayer-expansion/alternative-strategies.json', import.meta.url),
  ),
);
const projects = Object.fromEntries(
  ['team', 'versus'].map((mode) => [
    mode,
    compileContentProject(createMultiplayerExpansionCandidates({ mode })),
  ]),
);
const expand = (segments) => segments.flatMap((s) => Array.from({ length: s.ticks }, () => s));
const command = (direction) => ({ direction, boost: false, action: false, pickup: false });
const teamCommand = (direction) => ({ direction, boost: false, support: false });

for (const row of fixture.rows) {
  const level = applyGameplayTuning(
    resolveMission(projects[row.mode], row.missionId, { mode: row.mode }).level,
    resolveGameplayTuning('standard'),
  );
  test(`${row.missionId}: two different legal strategies reach the same Standard goal`, async () => {
    assert.notDeepEqual(row.primary, row.alternative);
    const captures = [];
    for (const segments of [row.primary, row.alternative]) {
      const run =
        row.mode === 'team'
          ? startCoop(createCoop(level, row.options))
          : createDuel(level, row.options, { protocol: UNTIMED_DUEL_PROTOCOL, seconds: 0 });
      if (row.mode === 'versus') resumeDuel(run);
      const recorder =
        row.mode === 'team'
          ? createLocalMatchRecorder({
              mode: 'team',
              level,
              options: row.options,
              format: LOCAL_MATCH_RECORDING_V2,
            })
          : null;
      const events = [];
      for (const segment of expand(segments)) {
        if (run.status !== 'running') break;
        const input =
          row.mode === 'team'
            ? [segment.a, segment.b].map(teamCommand)
            : [command(segment.direction), command(segment.direction)];
        recorder?.append(input);
        (row.mode === 'team' ? stepCoop : stepDuel)(run, input);
        for (const event of (row.mode === 'team' ? run : run.runs[0]).events)
          if (event.type === 'cut.closed') events.push({ ...event, tick: run.tick });
      }
      if (row.mode === 'team') {
        assert.equal(run.status, 'won');
        assert(
          [0, 1].every((seat) => events.some((e) => e.player === seat)),
          'Both pilots contribute a banked capture',
        );
        const replay = await verifyLocalMatchRecordingAsync(await recorder.snapshot(run), {
          chunkTicks: 12000,
        });
        assert.equal(replay.exactStateMatch, true);
      } else {
        assert.equal(run.status, 'finished');
        assert(run.runs.every((r) => r.status === 'won'));
        assert.equal(run.winner, null);
      }
      captures.push(events);
    }
    assert.notDeepEqual(
      captures[0],
      captures[1],
      'Alternative commands produce distinct capture sequences',
    );
  });
  if (row.mode === 'versus')
    for (const primarySeat of [0, 1])
      test(`${row.missionId}: different routes compete fairly with primary in seat ${primarySeat + 1}`, () => {
        const traces = [expand(row.primary), expand(row.alternative)];
        const run = createDuel(level, row.options, { protocol: UNTIMED_DUEL_PROTOCOL, seconds: 0 });
        resumeDuel(run);
        for (
          let n = 0;
          n < Math.max(...traces.map((t) => t.length)) && run.status === 'running';
          n++
        )
          stepDuel(
            run,
            [0, 1].map((seat) =>
              command(traces[seat === primarySeat ? 0 : 1][n]?.direction ?? null),
            ),
          );
        assert.equal(run.status, 'finished');
        assert.equal(run.reason, 'First clear');
        const faster = row.missionId === 'versus-harbor-gambit' ? 1 - primarySeat : primarySeat;
        assert.equal(run.winner, faster);
        assert(run.runs.every((r) => r.coverage > 0));
      });
}

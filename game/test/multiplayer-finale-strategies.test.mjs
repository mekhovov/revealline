import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pauseCoop } from '../coop/core.mjs';
import { pauseDuel } from '../multiplayer.mjs';
import {
  createLocalMatchRecorder,
  verifyLocalMatchRecordingAsync,
  LOCAL_MATCH_RECORDING_V2,
} from '../multiplayer-recording.mjs';
import {
  finaleCases,
  finaleStart,
  finaleStep,
  finaleCommand,
  finaleProtocol,
  playFinale,
  routeDifference,
} from './helpers/multiplayer-finale-qualification.mjs';

const fixture = JSON.parse(
  await readFile(
    new URL('./fixtures/multiplayer-expansion/finale-strategies.json', import.meta.url),
  ),
);
const cases = [...(await finaleCases('team')), ...(await finaleCases('versus'))];
const expand = (segments) => segments.flatMap((s) => Array.from({ length: s.ticks }, () => s));

test('the strategy evidence covers exactly the final authored mission of all 24 chapter packs', () => {
  assert.equal(fixture.rows.length, 24);
  assert.equal(new Set(fixture.rows.map((row) => row.missionId)).size, 24);
  assert.deepEqual(
    fixture.rows.map((row) => row.missionId).sort(),
    cases.map((row) => row.missionId).sort(),
  );
});

test('a change in timestamps alone cannot satisfy the capture or trail geometry requirements', () => {
  const capture = { gained: [9, 10], cutPaths: [[9, 10]], tick: 10 };
  assert.deepEqual(
    routeDifference({ captures: [capture] }, { captures: [{ ...capture, tick: 600 }] }),
    {
      differentCaptures: 0,
      maxChangedCells: 0,
      maxChangedTrailCells: 0,
    },
  );
});

for (const row of cases) {
  const proof = fixture.rows.find((r) => r.missionId === row.missionId);
  test(`${row.missionId}: two spatial strategies clear, survive paused ticks and replay exactly`, async () => {
    assert.equal(proof.authoredIdentity, row.authoredIdentity);
    assert.equal(proof.tunedIdentity, row.tunedIdentity);
    assert.deepEqual(proof.options, row.options);
    assert.deepEqual(proof.primary, row.primary, 'The historical primary commands stay unchanged');
    // Keep the untouched owned run: structuredClone drops the null prototype of
    // the internal loadout lookup and is not an exact fresh-state comparator.
    const beforeAttempts = finaleStart(row.mode, row.level, row.options);
    const observed = [];
    for (const segments of [proof.primary, proof.alternative]) {
      const recorder = createLocalMatchRecorder({
        mode: row.mode,
        level: row.level,
        options: row.options,
        duel: row.mode === 'versus' ? finaleProtocol : null,
        format: LOCAL_MATCH_RECORDING_V2,
      });
      let pausedOpenCut = false;
      const result = playFinale(row, segments, {
        onTick(run, inputs) {
          recorder.append(inputs);
          const open =
            row.mode === 'team'
              ? run.players.some((p) => p.trail.length)
              : run.runs.some((r) => r.trail.length);
          if (!pausedOpenCut && open && run.status === 'running') {
            const paused = structuredClone(run);
            if (row.mode === 'team') pauseCoop(paused);
            else pauseDuel(paused, { preserveContinuation: true });
            const frozen = structuredClone(paused);
            for (let tick = 0; tick < 120; tick++) finaleStep(row.mode, paused, inputs);
            assert.deepEqual(
              paused,
              frozen,
              'Pause must freeze a real unfinished cut despite held input',
            );
            pausedOpenCut = true;
          }
        },
      });
      assert(result.won, 'A route must complete the actual Standard goal');
      assert(pausedOpenCut, 'Pause observation must occur during an actual unfinished cut');
      assert(
        !result.hazards.some((e) => e.type === 'player.downed'),
        'Retained Team routes avoid knockdowns',
      );
      if (row.mode === 'team')
        assert(
          result.closed.every((count) => count > 0),
          'Both pilots bank a capture',
        );
      else assert.equal(result.run.reason, 'First clear');
      const verified = await verifyLocalMatchRecordingAsync(await recorder.snapshot(result.run), {
        chunkTicks: 12000,
      });
      assert.equal(verified.match, true);
      assert.equal(
        verified.exactStateMatch,
        true,
        'Public replay must reproduce the full state on this runtime',
      );
      observed.push(result);
    }
    const difference = routeDifference(...observed);
    assert(difference.maxChangedCells >= 24, 'At least one banked capture changes by 24 cells');
    assert(
      difference.maxChangedTrailCells >= 2,
      'The drawn trail geometry must also differ; delayed enemy positions are insufficient',
    );
    assert.deepEqual(
      finaleStart(row.mode, row.level, row.options),
      beforeAttempts,
      'A fresh attempt contains no progress or input from either completed route',
    );
  });

  if (row.mode === 'versus')
    test(`${row.missionId}: both routes race and the result follows the strategy when seats reverse`, async () => {
      const traces = [expand(proof.primary), expand(proof.alternative)];
      const durations = [
        playFinale(row, proof.primary).run.tick,
        playFinale(row, proof.alternative).run.tick,
      ];
      for (const primarySeat of [0, 1]) {
        const run = finaleStart('versus', row.level, row.options);
        const recorder = createLocalMatchRecorder({
          mode: 'versus',
          level: row.level,
          options: row.options,
          duel: finaleProtocol,
        });
        const captures = [0, 0];
        for (
          let tick = 0;
          tick < Math.max(...traces.map((trace) => trace.length)) && run.status === 'running';
          tick++
        ) {
          const input = [0, 1].map((seat) =>
            finaleCommand(traces[seat === primarySeat ? 0 : 1][tick]?.direction ?? null),
          );
          recorder.append(input);
          finaleStep('versus', run, input);
          for (const seat of [0, 1])
            captures[seat] += run.runs[seat].events.filter((e) => e.type === 'cut.closed').length;
        }
        assert.equal(run.status, 'finished');
        assert.equal(run.reason, 'First clear');
        assert.equal(
          run.winner,
          durations[0] === durations[1]
            ? null
            : durations[0] < durations[1]
              ? primarySeat
              : 1 - primarySeat,
        );
        assert(
          captures.every((count) => count > 0),
          'Both competitors actually bank territory',
        );
        const verified = await verifyLocalMatchRecordingAsync(await recorder.snapshot(run), {
          chunkTicks: 12000,
        });
        assert.equal(verified.exactStateMatch, true);
      }
    });
}

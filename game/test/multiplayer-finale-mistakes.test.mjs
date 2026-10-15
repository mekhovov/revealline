import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pauseCoop } from '../coop/core.mjs';
import { pauseDuel } from '../multiplayer.mjs';
import { createLocalMatchRecorder } from '../multiplayer-recording.mjs';
import {
  finaleCases,
  finaleProtocol,
  finaleStart,
  finaleStep,
  playFinale,
} from './helpers/multiplayer-finale-qualification.mjs';

const fixture = JSON.parse(
  await readFile(new URL('./fixtures/multiplayer-expansion/finale-mistakes.json', import.meta.url)),
);
const cases = [...(await finaleCases('team')), ...(await finaleCases('versus'))];
for (const proof of fixture.rows)
  test(`${proof.missionId}: an input omission exposes the cut, then legal commands bank further progress`, async () => {
    const row = cases.find((r) => r.missionId === proof.missionId);
    assert.equal(row.authoredIdentity, proof.authoredIdentity);
    assert.equal(row.tunedIdentity, proof.tunedIdentity);
    const untouched = finaleStart(row.mode, row.level, row.options);
    const recorder = createLocalMatchRecorder({
      mode: row.mode,
      level: row.level,
      options: row.options,
      duel: row.mode === 'versus' ? finaleProtocol : null,
    });
    let pausedFailure = false;
    const result = playFinale(row, proof.segments, {
      onTick(run, inputs) {
        recorder.append(inputs);
        const events = row.mode === 'team' ? run.events : run.runs[0].events;
        if (
          !pausedFailure &&
          events.some((e) => ['player.downed', 'player.failed'].includes(e.type))
        ) {
          const paused = structuredClone(run);
          if (row.mode === 'team') pauseCoop(paused);
          else pauseDuel(paused, { preserveContinuation: true });
          const frozen = structuredClone(paused);
          for (let tick = 0; tick < 120; tick++) finaleStep(row.mode, paused, inputs);
          assert.deepEqual(
            paused,
            frozen,
            'The real failure state must remain frozen while paused',
          );
          pausedFailure = true;
        }
      },
    });
    const firstFailure = result.hazards.find((e) =>
      ['player.downed', 'player.failed'].includes(e.type),
    );
    assert(firstFailure);
    assert.equal(firstFailure.cause, proof.firstFailureCause);
    assert(pausedFailure);
    assert(
      result.captures.some((capture) => capture.tick > firstFailure.tick),
      'Later legal commands must actually bank territory after the failure',
    );
    assert.equal(
      result.run.status,
      proof.expectedStatus,
      'This bounded continuation is still unfinished; it is not a recovery-win certificate',
    );
    assert.equal(result.won, false);
    if (row.mode === 'team') {
      assert(result.hazards.some((e) => e.type === 'player.revived' && e.reason === 'reserve'));
      if (row.missionId === 'team-expedition-homecoming')
        assert(result.hazards.some((e) => e.type === 'player.revived' && e.reason === 'capture'));
    } else {
      assert(result.run.runs.every((run) => run.lives > 0 && run.lives < row.level.rules.lives));
    }
    // Public match exports deliberately require a finished round. Preserve that
    // boundary rather than assigning a fake terminal state for a partial probe.
    await assert.rejects(() => recorder.snapshot(result.run), /before exporting/);
    assert.deepEqual(
      playFinale(row, proof.segments).run,
      result.run,
      'The complete partial core state must replay exactly from ordinary commands',
    );
    assert.deepEqual(
      finaleStart(row.mode, row.level, row.options),
      untouched,
      'A new attempt must discard failure and input state',
    );
  });

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertExpansionCheckpoint } from './helpers/multiplayer-expansion-checkpoint.mjs';
import { createTeamExpansionCandidates } from '../content-design/multiplayer-expansion.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { createCoop, startCoop, stepCoop } from '../coop/core.mjs';
import { dataIdentity } from '../data-json.mjs';
import {
  createLocalMatchRecorder,
  verifyLocalMatchRecordingAsync,
  LOCAL_MATCH_RECORDING_V2,
} from '../multiplayer-recording.mjs';
import {
  EXPEDITION_TERMINAL_OBSERVATIONS,
  localTerminalObservations,
} from '../multiplayer-terminal-observation.mjs';
const project = compileContentProject(createTeamExpansionCandidates());
const commands = (segment) =>
  [segment.a, segment.b].map((direction) => ({ direction, boost: false, support: false }));
for (const difficulty of ['gentle', 'standard', 'expert'])
  test(`all 96 Team ${difficulty} routes replay with both role assignments`, async () => {
    const proof = JSON.parse(
      await readFile(
        new URL(`./fixtures/multiplayer-expansion/${difficulty}.json`, import.meta.url),
      ),
    );
    assert.equal(proof.rows.length, 96);
    assert.equal(new Set(proof.rows.map((r) => r.missionId)).size, 96);
    for (const row of proof.rows) {
      const authored = resolveMission(project, row.missionId, { mode: 'team', difficulty }).level;
      const level = applyGameplayTuning(authored, resolveGameplayTuning(difficulty));
      assert.equal(dataIdentity(authored), row.authoredIdentity);
      assert.equal(dataIdentity(level), row.tunedIdentity);
      for (const reversedRoles of [false, true]) {
        const recipe = structuredClone(level);
        if (reversedRoles) recipe.supportRoles.reverse();
        const run = startCoop(createCoop(recipe, { seed: 17 }));
        const closed = [0, 0];
        for (const segment of row.segments)
          for (let i = 0; i < segment.ticks; i++) {
            stepCoop(run, commands(segment));
            assert(!run.events.some((e) => e.type === 'player.downed'), row.missionId);
            for (const e of run.events) if (e.type === 'cut.closed') closed[e.player]++;
          }
        assert.equal(run.status, 'won', row.missionId);
        assert(
          closed.every((n) => n > 0),
          row.missionId,
        );
        assert.equal(run.tick, row.tick);
        assert.equal(run.coverage, row.coverage);
        if (!reversedRoles) assertExpansionCheckpoint('team', run, row, difficulty);
      }
    }
  });

test('environment clears export and verify through the actual match recorder with a successor observation contract', async () => {
  const proof = JSON.parse(
    await readFile(new URL('./fixtures/multiplayer-expansion/standard.json', import.meta.url)),
  );
  const row = proof.rows.find((r) => r.missionId === 'team-expedition-homecoming');
  assert(row);
  const level = applyGameplayTuning(
    resolveMission(project, row.missionId, { mode: 'team' }).level,
    resolveGameplayTuning('standard'),
  );
  const options = { seed: 17 };
  const run = startCoop(createCoop(level, options));
  const recorder = createLocalMatchRecorder({
    mode: 'team',
    level,
    options,
    format: LOCAL_MATCH_RECORDING_V2,
  });
  for (const segment of row.segments)
    for (let i = 0; i < segment.ticks; i++) {
      const input = commands(segment);
      recorder.append(input);
      stepCoop(run, input);
    }
  const observation = localTerminalObservations('team', run);
  assert.equal(observation.contract, EXPEDITION_TERMINAL_OBSERVATIONS);
  assert.equal(observation.board.environment.stage, 3);
  assert(observation.board.environment.relays.every((r) => r.open));
  const recording = await recorder.snapshot(run);
  assert.equal(recording.final.observationContract, EXPEDITION_TERMINAL_OBSERVATIONS);
  const result = await verifyLocalMatchRecordingAsync(recording, { chunkTicks: 12000 });
  assert.equal(result.match, true);
  assert.equal(result.exactStateMatch, true);
  const forged = structuredClone(recording);
  forged.final.observationContract = 'revealline-capture-terminal-observations.v1';
  await assert.rejects(() => verifyLocalMatchRecordingAsync(forged), /observation contract/);
});

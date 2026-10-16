import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createTeamExpansionCandidates,
  createDuelExpansionCandidates,
} from '../content-design/multiplayer-expansion.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { createCoop, startCoop, stepCoop, pauseCoop } from '../coop/core.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';
import {
  createLocalMatchRecorder,
  verifyLocalMatchRecordingAsync,
  LOCAL_MATCH_RECORDING_V2,
} from '../multiplayer-recording.mjs';
const team = compileContentProject(createTeamExpansionCandidates());
const duel = compileContentProject(createDuelExpansionCandidates());
const proof = JSON.parse(
  await readFile(new URL('./fixtures/multiplayer-expansion/standard.json', import.meta.url)),
);
const duelProof = JSON.parse(
  await readFile(
    new URL('./fixtures/multiplayer-expansion/duel-standard-immediate.json', import.meta.url),
  ),
);
const effective = (project, id, mode) =>
  applyGameplayTuning(
    resolveMission(project, id, { mode }).level,
    resolveGameplayTuning('standard'),
  );

for (const missionId of [
  'team-harbor-handoff',
  'team-hidden-court-delivery',
  'team-citadel-shared-crown',
  'team-fault-relay-service',
  'team-cargo-islands',
]) {
  test(`${missionId}: active support and recovery retain exact local replay and pause safety`, async () => {
    const level = effective(team, missionId, 'team');
    const run = startCoop(createCoop(level, { seed: 17 }));
    const recorder = createLocalMatchRecorder({
      mode: 'team',
      level,
      options: { seed: 17 },
      format: LOCAL_MATCH_RECORDING_V2,
    });
    const events = [];
    let froze = 0;
    for (const segment of proof.rows.find((r) => r.missionId === missionId).segments)
      for (let i = 0; i < segment.ticks && run.status === 'running'; i++) {
        const input = [segment.a, segment.b].map((direction, seat) => {
          const p = run.players[seat];
          const threats =
            p.supportRole === 'interceptor'
              ? run.impacts
              : run.enemies.filter((e) => e.active !== false && e.slowUntil <= run.time);
          return {
            direction,
            boost: false,
            support:
              !p.support.held &&
              p.support.readyAt <= run.time &&
              threats.some((e) => Math.hypot(e.x - p.x, e.y - p.y) < 5.8),
          };
        });
        recorder.append(input);
        stepCoop(run, input);
        events.push(...run.events.map((e) => ({ ...e, tick: run.tick })));
        if (
          run.status === 'running' &&
          run.events.some((e) =>
            [
              'impact.intercepted',
              'player.downed',
              'objective.captured',
              'environment.eroded',
            ].includes(e.type),
          )
        ) {
          // A separate continuation exercises the public pause command at the actual
          // event state. No injected enemies, rewards, deaths or progress are used.
          const paused = structuredClone(run);
          pauseCoop(paused);
          const frozen = JSON.stringify(paused);
          for (let n = 0; n < 120; n++) stepCoop(paused, input);
          assert.equal(JSON.stringify(paused), frozen);
          froze++;
        }
      }
    assert.equal(run.status, 'won');
    if (missionId === 'team-harbor-handoff') assert(run.players.some((p) => p.support.slows > 0));
    else assert(froze > 0);
    if (missionId === 'team-hidden-court-delivery') {
      assert(events.some((e) => e.type === 'impact.intercepted' && e.protectedPlayer !== e.player));
      assert(events.filter((e) => e.type === 'objective.captured').length >= 2);
    }
    if (missionId === 'team-citadel-shared-crown') {
      assert.equal(run.environment.stage, 3);
      assert(events.some((e) => e.type === 'impact.intercepted'));
    }
    if (['team-fault-relay-service', 'team-cargo-islands'].includes(missionId)) {
      assert(events.some((e) => e.type === 'player.downed'));
      assert(events.some((e) => e.type === 'player.revived' && e.reason === 'reserve'));
    }
    if (missionId === 'team-fault-relay-service')
      assert(events.some((e) => e.type === 'environment.eroded'));
    const recording = await recorder.snapshot(run);
    const replay = await verifyLocalMatchRecordingAsync(recording, { chunkTicks: 12000 });
    assert.equal(replay.match, true);
    assert.equal(replay.exactStateMatch, true);
  });
}

for (const missionId of [
  'versus-harbor-gambit',
  'versus-horizon-photo-finish',
  'versus-expedition-decider',
])
  for (const delay of [1, 12])
    for (const laterSeat of [0, 1])
      test(`${missionId}: both seats race with seat ${laterSeat + 1} ${delay} ticks later`, () => {
        const row = duelProof.rows.find((r) => r.missionId === missionId);
        const inputs = row.segments.flatMap((s) =>
          Array.from({ length: s.ticks }, () => ({
            direction: s.direction,
            boost: false,
            action: false,
            pickup: false,
          })),
        );
        const match = createDuel(effective(duel, missionId, 'versus'), row.options, {
          protocol: UNTIMED_DUEL_PROTOCOL,
          seconds: 0,
        });
        resumeDuel(match);
        for (let i = 0; i < inputs.length + delay && match.status === 'running'; i++)
          stepDuel(
            match,
            [0, 1].map((seat) => inputs[i - (seat === laterSeat ? delay : 0)] ?? {}),
          );
        assert.equal(match.status, 'finished');
        assert.equal(match.reason, 'First clear');
        assert.equal(match.winner, 1 - laterSeat);
        assert(match.runs.every((r) => r.coverage > 0));
        assert.equal(match.tick, row.tick);
      });

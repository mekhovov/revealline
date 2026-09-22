import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSentinelCandidates } from '../content-design/sentinel-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createContentAttemptPreparer } from '../content-design/attempt.mjs';
import { createCandidateSequence } from '../content-design/route.mjs';
import { createRun, stepRun, FIXED_DT, CELL } from '../core/index.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';
import { authoritativeCheckpoint, recordInput, exportReplay, verifyReplay } from '../replay.mjs';

const project = compileContentProject(createSentinelCandidates());
const { themes } = JSON.parse(
  await readFile(new URL('../content-design/themes.json', import.meta.url)),
);
const fixture = JSON.parse(
  await readFile(new URL('./fixtures/sentinel-clear-routes.json', import.meta.url)),
);

test('Sentinel feasibility fixtures cover every candidate, preset and steering pair', () => {
  assert.equal(fixture.format, 'SentinelFeasibilityRoutesV1');
  assert.deepEqual(
    fixture.sets.map((s) => `${s.difficulty}/${s.turnPolicy}`).sort(),
    ['gentle', 'standard', 'expert']
      .flatMap((d) => ['immediate', 'grid-center'].map((p) => `${d}/${p}`))
      .sort(),
  );
  for (const set of fixture.sets)
    assert.deepEqual(
      set.rows.map((row) => row[0]),
      project.missions.map((m) => m.id),
    );
});

for (const { difficulty, turnPolicy, rows } of fixture.sets) {
  test(`Sentinel prepared no-loss Solo clears, explicit stage release and public replay: ${difficulty}/${turnPolicy}`, async (t) => {
    const preparer = createContentAttemptPreparer(createSentinelCandidates(), { themes });
    t.after(() => preparer.dispose());
    const journey = preparer.catalog.journey(),
      sequence = createCandidateSequence(journey, ['journey-sentinel']);
    assert.equal(
      sequence.next(journey.missions.find((m) => m.levelId === 'crown-audience').id),
      null,
    );
    assert.equal(
      sequence.isCore(journey.missions.find((m) => m.levelId === 'sentinel-remix').id),
      false,
    );
    for (const [id, identity, checkpoint, segments] of rows) {
      const manifest = resolveMission(project, id, { difficulty });
      assert.equal(manifest.simulationIdentity, identity, `${id}: stale identity`);
      const options = { seed: 1, classId: 'scout', turnPolicy };
      const prepared = await preparer.prepare({
        missionId: journey.missions.find((m) => m.levelId === id).id,
        difficulty,
        seed: 1,
        turnPolicy,
      });
      assert.deepEqual(prepared.manifest, manifest);
      assert.equal(prepared.officialProgressEligible, false);
      assert.equal(prepared.run.ruleset, 'xonix-core.v9');
      assert.deepEqual(
        authoritativeCheckpoint(prepared.run),
        authoritativeCheckpoint(createRun(manifest.level, options)),
      );
      const { run, recorder } = preparer.take(prepared),
        denominator = run.totalClaimable;
      const shields = new Map(),
        transitions = [],
        defeats = [],
        opened = [];
      let closures = 0;
      for (const [direction, ticks] of segments) {
        assert([null, 'up', 'down', 'left', 'right'].includes(direction));
        assert(Number.isSafeInteger(ticks) && ticks > 0 && ticks <= 1000);
        for (let tick = 0; tick < ticks; tick++) {
          assert.equal(run.status, 'running', `${id}: input after completion`);
          recordInput(recorder, { direction });
          stepRun(run, { direction }, FIXED_DT);
          assert.equal(run.classic.livesLost, 0, `${id}: life loss`);
          assert.equal(run.totalClaimable, denominator, `${id}: changed denominator`);
          for (const event of run.events) {
            if (event.type === 'cut.closed') closures++;
            if (event.type === 'relay.opened') opened.push(run.tick);
            if (
              event.type === 'objective.captured' &&
              manifest.level.encounter.shieldObjectiveIds.includes(event.id)
            ) {
              assert(!shields.has(event.id), `${id}: duplicate shield award`);
              shields.set(event.id, run.tick);
            }
            if (event.type === 'encounter.stageChanged') transitions.push([run.tick, event.stage]);
            if (event.type === 'encounter.defeated') defeats.push(event);
          }
          // A boss deliberately remains a capture seed until its explicit release.
          // Meeting the numeric quota alone must not bypass that required objective.
          if (!run.encounter.defeated) {
            assert.notEqual(run.status, 'won', `${id}: premature victory`);
            assert(
              !run.objectives.find((o) => o.id === 'core').captured,
              `${id}: premature core capture`,
            );
          }
        }
      }
      assert.equal(run.status, 'won', id);
      assert.equal(run.lives, manifest.level.rules.lives, id);
      assert(closures >= 2, `${id}: trivial first-cut clear`);
      assert.deepEqual(
        [...shields.keys()].sort(),
        [...manifest.level.encounter.shieldObjectiveIds].sort(),
      );
      assert.deepEqual(
        transitions.map((row) => row[1]),
        ['transition', 'exposed'],
      );
      assert.equal(transitions[0][0], Math.max(...shields.values()), id);
      assert.equal(
        transitions[1][0] - transitions[0][0],
        manifest.level.encounter.transitionTicks + 1,
        id,
      );
      assert.equal(defeats.length, 1, id);
      assert(['cut-release', 'isolated'].includes(defeats[0].cause));
      assert(
        run.objectives.every((o) => o.captured),
        id,
      );
      assert.equal(run.coverage, 1, id);
      assert.equal(opened.length, run.relay.gates.length);
      assert(
        opened.every((tick) => tick < run.tick),
        `${id}: relay opened only at victory`,
      );
      for (const gate of run.relay.gates)
        for (const index of gate.cells) {
          assert.equal(run.cells[index], CELL.SAFE);
          assert.equal(run.foundation.permanent[index], 1);
          assert.equal(run.classic.everClaimed[index], 0);
        }
      assert.equal(authoritativeCheckpoint(run).hash, checkpoint, id);
      const replay = verifyReplay(exportReplay(recorder, run));
      assert.equal(replay.match, true, id);
      assert.equal(replay.state.status, 'won', id);
    }
  });
  test(`Sentinel independent equal paired-board clears: ${difficulty}/${turnPolicy}`, () => {
    for (const [id, identity, , segments] of rows) {
      const manifest = resolveMission(project, id, { difficulty, mode: 'versus' });
      assert.equal(manifest.simulationIdentity, identity, id);
      const match = createDuel(
        manifest.level,
        { seed: 1, classId: 'scout', turnPolicy },
        { protocol: UNTIMED_DUEL_PROTOCOL, seconds: 0 },
      );
      assert.notEqual(match.runs[0].cells, match.runs[1].cells);
      assert.notEqual(match.runs[0].encounter, match.runs[1].encounter);
      assert.notEqual(match.runs[0].relay, match.runs[1].relay);
      resumeDuel(match);
      for (const [direction, ticks] of segments)
        for (let tick = 0; tick < ticks; tick++) {
          assert.equal(match.status, 'running', id);
          stepDuel(match, [{ direction }, { direction }]);
        }
      assert.equal(match.status, 'finished', id);
      assert.equal(match.reason, 'First clear', id);
      assert.equal(match.winner, null, id);
      for (const run of match.runs) {
        assert.equal(run.status, 'won', id);
        assert.equal(run.classic.livesLost, 0, id);
        assert.equal(run.encounter.defeated, true);
      }
      assert.deepEqual(
        authoritativeCheckpoint(match.runs[0]),
        authoritativeCheckpoint(match.runs[1]),
        id,
      );
    }
  });
}

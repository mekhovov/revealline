import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createApexCandidates } from '../content-design/apex-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createContentAttemptPreparer } from '../content-design/attempt.mjs';
import { createCandidateSequence } from '../content-design/route.mjs';
import { createRun, stepRun, FIXED_DT, CELL } from '../core/index.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';
import { authoritativeCheckpoint, recordInput, exportReplay, verifyReplay } from '../replay.mjs';

const project = compileContentProject(createApexCandidates());
const { themes } = JSON.parse(
  await readFile(new URL('../content-design/themes.json', import.meta.url)),
);
const fixture = JSON.parse(
  await readFile(new URL('./fixtures/apex-clear-routes.json', import.meta.url)),
);

test('Apex fixtures cover all candidates, presets and steering pairs', () => {
  assert.equal(fixture.format, 'ApexFeasibilityRoutesV1');
  assert.deepEqual(
    fixture.sets.map((s) => `${s.difficulty}/${s.turnPolicy}`).sort(),
    ['gentle', 'standard', 'expert']
      .flatMap((d) => ['immediate', 'grid-center'].map((p) => `${d}/${p}`))
      .sort(),
  );
  for (const set of fixture.sets)
    assert.deepEqual(
      set.rows.map((r) => r[0]),
      project.missions.map((m) => m.id),
    );
});

for (const { difficulty, turnPolicy, rows } of fixture.sets) {
  test(`Apex prepared bonus-independent Solo clears and public replay: ${difficulty}/${turnPolicy}`, async (t) => {
    const preparer = createContentAttemptPreparer(createApexCandidates(), { themes });
    t.after(() => preparer.dispose());
    const journey = preparer.catalog.journey();
    const sequence = createCandidateSequence(journey, ['journey-apex']);
    assert.equal(sequence.next(journey.missions.find((m) => m.levelId === 'home-signal').id), null);
    assert.equal(
      sequence.isCore(journey.missions.find((m) => m.levelId === 'apex-remix').id),
      false,
    );
    for (const [id, identity, checkpoint, segments] of rows) {
      const manifest = resolveMission(project, id, { difficulty });
      assert.equal(manifest.simulationIdentity, identity, `${id}: stale identity`);
      const prepared = await preparer.prepare({
        missionId: journey.missions.find((m) => m.levelId === id).id,
        difficulty,
        seed: 1,
        turnPolicy,
      });
      assert.deepEqual(prepared.manifest, manifest);
      assert.equal(prepared.officialProgressEligible, false);
      assert.deepEqual(
        authoritativeCheckpoint(prepared.run),
        authoritativeCheckpoint(
          createRun(manifest.level, { seed: 1, classId: 'scout', turnPolicy }),
        ),
      );
      const { run, recorder } = preparer.take(prepared);
      const denominator = run.totalClaimable,
        opened = [],
        used = new Map(),
        transitions = [],
        defeats = [];
      let closures = 0;
      for (const [direction, ticks] of segments) {
        assert([null, 'up', 'down', 'left', 'right'].includes(direction));
        assert(Number.isSafeInteger(ticks) && ticks > 0 && ticks <= 1000);
        for (let tick = 0; tick < ticks; tick++) {
          assert.equal(run.status, 'running', `${id}: input after completion`);
          recordInput(recorder, { direction });
          stepRun(run, { direction }, FIXED_DT);
          assert.equal(run.classic.livesLost, 0, `${id}: life loss`);
          assert.equal(run.totalClaimable, denominator, `${id}: denominator changed`);
          assert(
            run.classic.powerups.every((p) => p.collectedTick === null),
            `${id}: pickup dependence`,
          );
          for (const event of run.events) {
            if (event.type === 'cut.closed') closures++;
            if (event.type === 'relay.opened') opened.push(run.tick);
            if (event.type === 'encounter.stageChanged') transitions.push(event.stage);
            if (event.type === 'encounter.defeated') defeats.push(event);
          }
          const cell = Math.floor(run.player.y) * run.width + Math.floor(run.player.x);
          for (const gate of run.relay.gates)
            if (
              gate.openedTick !== null &&
              !run.player.cutting &&
              run.cells[cell] === CELL.SAFE &&
              gate.cells.includes(cell) &&
              !used.has(gate.id)
            )
              used.set(gate.id, run.tick);
          if (!run.encounter && run.coverage >= manifest.level.goal.coverage)
            assert(
              run.objectives.every((o) => !o.required || o.captured),
              `${id}: quota cleanup before required objectives`,
            );
          if (run.encounter && !run.encounter.defeated) {
            assert.notEqual(run.status, 'won');
            assert.equal(run.objectives.find((o) => o.id === 'core').captured, false);
          }
        }
      }
      assert.equal(run.status, 'won', id);
      assert.equal(run.lives, manifest.level.rules.lives, id);
      assert(closures >= 2, `${id}: trivial first-cut clear`);
      assert(
        run.objectives.every((o) => !o.required || o.captured),
        id,
      );
      assert.equal(opened.length, run.relay.gates.length);
      assert(
        opened.every((tick) => tick < run.tick),
        `${id}: gate opened only at victory`,
      );
      if (opened.length)
        assert(
          [...used.values()].some((tick) => tick < run.tick),
          `${id}: no useful connector visit`,
        );
      for (const gate of run.relay.gates)
        for (const index of gate.cells) {
          assert.equal(run.cells[index], CELL.SAFE);
          assert.equal(run.foundation.permanent[index], 1);
          assert.equal(run.classic.everClaimed[index], 0);
        }
      if (run.encounter) {
        assert.deepEqual(transitions, ['transition', 'exposed']);
        assert.equal(defeats.length, 1);
        assert(['cut-release', 'isolated'].includes(defeats[0].cause));
      }
      assert.equal(authoritativeCheckpoint(run).hash, checkpoint, id);
      const replay = verifyReplay(exportReplay(recorder, run));
      assert.equal(replay.match, true, id);
      assert.equal(replay.state.status, 'won', id);
    }
  });
  test(`Apex independent equal paired boards: ${difficulty}/${turnPolicy}`, () => {
    for (const [id, identity, , segments] of rows) {
      const manifest = resolveMission(project, id, { difficulty, mode: 'versus' });
      assert.equal(manifest.simulationIdentity, identity, id);
      const match = createDuel(
        manifest.level,
        { seed: 1, classId: 'scout', turnPolicy },
        { protocol: UNTIMED_DUEL_PROTOCOL, seconds: 0 },
      );
      assert.notEqual(match.runs[0].cells, match.runs[1].cells);
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
        assert(
          run.classic.powerups.every((p) => p.collectedTick === null),
          id,
        );
      }
      assert.deepEqual(
        authoritativeCheckpoint(match.runs[0]),
        authoritativeCheckpoint(match.runs[1]),
        id,
      );
    }
  });
}

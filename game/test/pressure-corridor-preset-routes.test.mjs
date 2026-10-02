import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCoolingLoopErosionCandidates } from '../content-design/cooling-loop-erosion-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { createRun, stepRun, FIXED_DT, CELL } from '../core/index.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  exportReplay,
  recordInput,
  verifyReplay,
} from '../replay.mjs';
import { roverLinks } from './helpers/rover-goal.mjs';

const evidence = JSON.parse(
  readFileSync(new URL('./fixtures/pressure-corridor-preset-routes.json', import.meta.url)),
);
const project = compileContentProject(createCoolingLoopErosionCandidates({ artwork: true }));

// Authored under the temporary suite waiver. The accompanying receipt records
// bounded Solo authoring observations, NOT execution of this suite, replay or
// paired-board qualification. Historical Standard fixtures remain unchanged.
assert.equal(evidence.format, 'PressureCorridorPresetRouteEvidenceV1');
assert.equal(evidence.edition, 'whole-spatial-v38');
assert.equal(project.source.revision, 'cooling-loop-erosion-1');
assert.deepEqual(
  evidence.cases.map(({ missionId, difficulty, turnPolicy, seed }) => [
    missionId,
    difficulty,
    turnPolicy,
    seed,
  ]),
  [
    ['cooling-loop', 'gentle', 'immediate', 1],
    ['pressure-ladder', 'gentle', 'grid-center', 1],
    ['pressure-ladder', 'expert', 'grid-center', 1],
    ['relay-remix', 'gentle', 'immediate', 1],
  ],
);

for (const row of evidence.cases)
  test(`${row.key}: complete preset route, replay and equal Versus`, () => {
    const prepare = (mode) => {
      const manifest = resolveMission(project, row.missionId, {
        difficulty: row.difficulty,
        mode,
      });
      assert.equal(manifest.simulationIdentity, row.initial.simulationIdentity);
      return applyGameplayTuning(manifest.level, resolveGameplayTuning(row.difficulty));
    };
    const level = prepare('solo');
    const versusLevel = prepare('versus');
    assert.deepEqual(versusLevel, level);
    assert.equal(level.revision, row.initial.revision);
    const options = { seed: row.seed, turnPolicy: row.turnPolicy, classId: 'scout' };
    const run = createRun(level, options);
    const recorder = createRecorder(level, options);
    const duel = createDuel(versusLevel, options, { protocol: UNTIMED_DUEL_PROTOCOL, seconds: 0 });
    resumeDuel(duel);
    assert.notEqual(duel.runs[0].cells, duel.runs[1].cells);
    assert.deepEqual(
      run.enemies.map(({ id, type }) => [id, type]),
      row.initial.roster,
      'Check actual spawned actors, including the safely placed Expert keeper.',
    );
    assert.equal(run.lives, row.initial.lives);
    const permanent = [...run.foundation.permanent.keys()].filter(
      (index) => run.foundation.permanent[index],
    );
    assert.equal(permanent.length, row.initial.permanent);
    const denominator = run.totalClaimable;
    const events = [];
    const closures = [];
    const erosion = [];
    const warnings = new Map();
    const gateEpisodes = [];
    let occupied = null;
    let spent = 0;
    assert(row.segments.reduce((sum, [, ticks]) => sum + ticks, 0) <= 12000);

    play: for (const [direction, ticks] of row.segments) {
      assert([null, 'up', 'down', 'left', 'right'].includes(direction));
      assert(Number.isInteger(ticks) && ticks > 0);
      for (let i = 0; i < ticks; i++) {
        if (run.status !== 'running') break play;
        recordInput(recorder, { direction });
        stepRun(run, { direction }, FIXED_DT);
        stepDuel(duel, [{ direction }, { direction }]);
        spent++;
        events.push(...structuredClone(run.events));
        for (const event of run.events) {
          if (event.type === 'cut.closed') {
            closures.push([run.tick, event.cells, run.claimedCount]);
            assert.equal(run.player.cutting, false);
            assert.equal(run.player.speed, 0);
          }
          if (event.type === 'erosion.warning') {
            assert.equal(run.cells[event.index], CELL.SAFE);
            assert.equal(run.foundation.permanent[event.index], 0);
            warnings.set(event.index, { tick: run.tick, due: event.erosionAt });
          }
          if (event.type === 'cells.eroded')
            for (const index of event.indices) {
              const warning = warnings.get(index);
              assert(warning, 'Earned territory must warn before erosion.');
              assert.equal(run.tick - warning.tick, 60);
              assert.equal(run.classic.actorTick, warning.due);
              assert.equal(run.cells[index], CELL.FIELD);
              assert.equal(run.foundation.permanent[index], 0);
              erosion.push([warning.tick, run.tick, index]);
            }
        }
        for (const board of [run, ...duel.runs]) {
          assert.equal(board.classic.livesLost, 0);
          assert.equal(board.totalClaimable, denominator);
          assert(
            permanent.every(
              (index) =>
                board.cells[index] === CELL.SAFE && board.foundation.permanent[index] === 1,
            ),
          );
          for (const gate of board.relay?.gates ?? [])
            if (gate.openedTick !== null)
              assert(
                gate.cells.every(
                  (index) =>
                    board.cells[index] === CELL.SAFE && board.foundation.permanent[index] === 1,
                ),
              );
        }
        const cell = Math.floor(run.player.y) * run.width + Math.floor(run.player.x);
        const gate = run.relay?.gates.find(
          (item) => item.openedTick !== null && item.cells.includes(cell),
        );
        if (occupied && occupied[0] !== gate?.id) {
          gateEpisodes.push(occupied);
          occupied = null;
        }
        if (gate) {
          assert.equal(run.player.cutting, false);
          occupied ??= [gate.id, run.tick, run.tick];
          occupied[2] = run.tick;
        }
      }
    }
    if (occupied) gateEpisodes.push(occupied);
    assert.equal(run.status, 'won', 'An unfinished route is not a complete clear.');
    assert.equal(run.tick, row.expected.tick);
    assert.equal(spent, run.tick);
    assert.equal(run.claimedCount, row.expected.claimed);
    assert.equal(denominator, row.expected.totalClaimable);
    assert.equal(run.coverage, row.expected.claimed / denominator);
    assert(run.coverage >= level.goal.coverage);
    assert.equal(run.lives, row.initial.lives);
    assert.deepEqual(closures, row.expected.closures);
    assert.deepEqual(erosion, row.expected.erosion);
    assert.deepEqual(
      run.classic.powerups.filter((item) => item.collectedTick !== null),
      [],
    );
    const impacts = events.filter((event) => event.type === 'lineImpact.seeded');
    const cleared = events.filter(
      (event) => event.type === 'lineImpact.cleared' && event.reason === 'capture',
    );
    assert.deepEqual(
      impacts.map(({ tick, actorId }) => [tick, actorId]),
      row.expected.impacts,
    );
    assert.deepEqual(
      cleared.map(({ tick }) => tick),
      row.expected.impactCaptureTicks,
    );
    for (const impact of impacts) {
      const head = impact.fronts.find((front) => front.direction === 1);
      assert(head);
      assert(cleared.some((event) => event.tick >= impact.tick && event.ids.includes(head.id)));
    }

    if (row.missionId === 'cooling-loop') {
      assert.equal(roverLinks(run, level.foundations), true);
      assert.equal(
        run.classic.terrain.filter((kind, i) => kind === 2 && run.cells[i] === CELL.FIELD).length,
        row.expected.remainingLethal,
      );
    } else if (row.missionId === 'pressure-ladder') {
      assert.equal(roverLinks(run, level.foundations), true);
      // These clears do NOT neutralize every slow cell or establish mastery.
      assert.equal(
        run.classic.terrain.filter((kind, i) => kind === 1 && run.cells[i] === CELL.FIELD).length,
        row.expected.remainingSlow,
      );
      const commits = events.filter((event) => event.type === 'pressure.committed');
      assert.deepEqual(
        commits.map(({ tick }) => tick),
        row.expected.pressureCommitTicks,
      );
      for (const commit of commits) {
        const warning = events.find(
          (event) =>
            event.type === 'pressure.warning' &&
            event.id === commit.id &&
            event.warningUntil === commit.actorTick,
        );
        assert(warning);
        assert.equal(warning.mode, 'head-intercept');
        assert.equal(warning.warningUntil - warning.actorTick, 90);
        assert.equal(commit.commitUntil - commit.actorTick, 144);
        assert.deepEqual(commit.target, warning.target);
      }
    } else {
      assert.deepEqual(
        events
          .filter((event) => event.type === 'relay.opened')
          .map(({ tick, objectiveId, id }) => [tick, objectiveId, id]),
        [
          [143, 'upper-relay', 'west-link'],
          [266, 'east-relay', 'east-link'],
        ],
      );
      assert(run.objectives.filter((item) => item.required).every((item) => item.captured));
      assert.equal(events.filter((event) => event.type === 'boss.warning').length, 12);
      assert(events.some((event) => event.type === 'rover.activated' && event.tick === 2372));
      for (const episode of row.expected.gateEpisodes)
        assert(gateEpisodes.some((actual) => actual.every((value, i) => value === episode[i])));
      // These episodes establish useful gate return/launch ground, not traversal
      // across its entire width. The Standard seed917 fixture proves that instead.
    }

    assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
    const checkpoint = authoritativeCheckpoint(run);
    assert.equal(checkpoint.hash, row.expected.checkpoint);
    assert.equal(duel.status, 'finished');
    assert.equal(duel.winner, null);
    for (const board of duel.runs) {
      assert.equal(board.status, 'won');
      assert.deepEqual(authoritativeCheckpoint(board), checkpoint);
    }
  });

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
  readFileSync(new URL('./fixtures/pressure-corridor-expanded-routes.json', import.meta.url)),
);
const project = compileContentProject(createCoolingLoopErosionCandidates({ artwork: true }));

// These are additional complete legal input recipes, not portable autopilots.
// Keep historical seed1/immediate fixtures and their exact goldens unchanged.
assert.equal(evidence.format, 'PressureCorridorFullRouteEvidenceV1');
assert.equal(evidence.edition, 'whole-spatial-v38');
assert.equal(project.source.revision, 'cooling-loop-erosion-1');
assert.equal(evidence.cases.length, 3);
assert.deepEqual(
  evidence.cases.map(({ missionId, difficulty, turnPolicy, seed }) => [
    missionId,
    difficulty,
    turnPolicy,
    seed,
  ]),
  [
    ['cooling-loop', 'standard', 'immediate', 917],
    ['pressure-ladder', 'standard', 'grid-center', 1],
    ['relay-remix', 'standard', 'immediate', 917],
  ],
);

for (const row of evidence.cases)
  test(`${row.key}: complete current-rules route, replay and equal Versus`, () => {
    const prepare = (mode) =>
      applyGameplayTuning(
        resolveMission(project, row.missionId, { difficulty: row.difficulty, mode }).level,
        resolveGameplayTuning(row.difficulty),
      );
    const level = prepare('solo');
    assert.deepEqual(prepare('versus'), level);
    const options = { seed: row.seed, turnPolicy: row.turnPolicy, classId: 'scout' };
    const run = createRun(level, options);
    const recorder = createRecorder(level, options);
    const duel = createDuel(level, options, { protocol: UNTIMED_DUEL_PROTOCOL, seconds: 0 });
    resumeDuel(duel);
    assert.notEqual(duel.runs[0].cells, duel.runs[1].cells);
    const permanent = [...run.foundation.permanent.keys()].filter(
      (i) => run.foundation.permanent[i],
    );
    const denominator = run.totalClaimable;
    const events = [];
    const closures = [];
    const warnings = new Map();
    const episodes = [];
    let occupied = null;
    let erosionCount = 0;
    let activeFrontClosures = 0;
    let spent = 0;
    assert(row.segments.reduce((sum, [, ticks]) => sum + ticks, 0) <= 12000);

    play: for (const [direction, ticks] of row.segments) {
      assert([null, 'up', 'down', 'left', 'right'].includes(direction));
      assert(Number.isInteger(ticks) && ticks > 0);
      for (let i = 0; i < ticks; i++) {
        if (run.status !== 'running') break play;
        const before = { x: run.player.x, y: run.player.y, tick: run.tick };
        const activeFronts = new Set(
          run.classic.lineImpact.fronts
            .filter((front) => front.direction === 1)
            .map((front) => front.id),
        );
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
          if (event.type === 'lineImpact.cleared' && event.reason === 'capture')
            activeFrontClosures += event.ids.filter((id) => activeFronts.has(id)).length;
          if (event.type === 'erosion.warning') {
            assert.equal(run.cells[event.index], CELL.SAFE);
            assert.equal(run.foundation.permanent[event.index], 0);
            warnings.set(event.index, { tick: run.tick, due: event.erosionAt });
          }
          if (event.type === 'cells.eroded')
            for (const index of event.indices) {
              const warning = warnings.get(index);
              assert(warning, 'Every eroded cell needs its existing visible warning.');
              assert.equal(run.tick - warning.tick, 60);
              assert.equal(run.classic.actorTick, warning.due);
              assert.equal(run.cells[index], CELL.FIELD);
              assert.equal(run.foundation.permanent[index], 0);
              erosionCount++;
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
        const point = { x: run.player.x, y: run.player.y, tick: run.tick };
        const cell = Math.floor(point.y) * run.width + Math.floor(point.x);
        const gate = run.relay?.gates.find(
          (item) => item.openedTick !== null && item.cells.includes(cell),
        );
        if (occupied && occupied.id !== gate?.id) {
          episodes.push({ ...occupied, after: point });
          occupied = null;
        }
        if (gate) {
          assert.equal(run.player.cutting, false);
          occupied ??= { id: gate.id, before, points: [] };
          occupied.points.push(point);
        }
      }
    }
    assert.equal(run.status, 'won', 'A first return or safe unfinished route is not a full clear.');
    assert.equal(run.tick, row.expected.tick);
    assert.equal(spent, run.tick);
    assert.equal(run.claimedCount, row.expected.claimed);
    assert.equal(denominator, row.expected.totalClaimable);
    assert.equal(run.coverage, row.expected.claimed / denominator);
    assert(run.coverage >= level.goal.coverage);
    assert.equal(run.lives, 3);
    assert.deepEqual(
      run.classic.powerups.filter((item) => item.collectedTick !== null),
      [],
    );
    assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
    const checkpoint = authoritativeCheckpoint(run);
    assert.equal(duel.status, 'finished');
    assert.equal(duel.winner, null);
    for (const board of duel.runs) {
      assert.equal(board.status, 'won');
      assert.deepEqual(authoritativeCheckpoint(board), checkpoint);
    }

    if (row.missionId === 'cooling-loop') {
      assert(erosionCount > 0, 'The altered eroder must really contest earned territory.');
      assert.equal(roverLinks(run, level.foundations), true);
      assert(run.classic.terrain.every((kind, i) => kind !== 2 || run.cells[i] !== CELL.FIELD));
    } else if (row.missionId === 'pressure-ladder') {
      assert.equal(erosionCount, 0);
      assert.equal(roverLinks(run, level.foundations), true);
      assert(run.classic.terrain.every((kind, i) => kind !== 1 || run.cells[i] !== CELL.FIELD));
      const pressure = events.filter((event) => event.type === 'pressure.committed');
      assert.equal(pressure.length, 3);
      for (const commit of pressure) {
        const warning = events.find(
          (event) =>
            event.type === 'pressure.warning' &&
            event.id === commit.id &&
            event.warningUntil === commit.tick,
        );
        assert(warning);
        assert.equal(warning.mode, 'head-intercept');
        assert.equal(warning.warningUntil - warning.actorTick, 90);
        assert.equal(commit.commitUntil - commit.actorTick, 144);
        assert.deepEqual(commit.target, warning.target);
      }
      assert.equal(activeFrontClosures, 2);
      assert.deepEqual(closures, [
        [660, 20, 20],
        [986, 120, 140],
        [1557, 132, 272],
        [2196, 24, 296],
        [2667, 15, 311],
        [3542, 23, 334],
        [4232, 1387, 1721],
        [5019, 76, 1797],
      ]);
    } else {
      assert.deepEqual(
        run.objectives
          .filter((item) => item.required && item.captured)
          .map((item) => item.id)
          .sort(),
        ['east-relay', 'upper-relay'],
      );
      assert.equal(events.filter((event) => event.type === 'relay.opened').length, 2);
      assert.equal(events.filter((event) => event.type === 'boss.warning').length, 12);
      assert(events.some((event) => event.type === 'rover.activated'));
      const east = run.relay.gates.find((gate) => gate.id === 'east-link');
      const columns = east.cells.map((index) => index % run.width);
      assert(
        episodes.some((episode) => {
          const points = [episode.before, ...episode.points, episode.after];
          return (
            episode.id === east.id &&
            episode.points[0].tick === 5628 &&
            episode.points.at(-1).tick === 5817 &&
            episode.before.x < Math.min(...columns) &&
            episode.after.x >= Math.max(...columns) + 1 &&
            points.every((point, i) => i === 0 || point.x > points[i - 1].x)
          );
        }),
        'The new tail must use the full opened east connector, not merely touch it.',
      );
    }
  });

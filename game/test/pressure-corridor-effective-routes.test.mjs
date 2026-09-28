import test from 'node:test';
import assert from 'node:assert/strict';
import { createPressureCorridorTriptychCandidates } from '../content-design/pressure-corridor-triptych-candidates.mjs';
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

const project = compileContentProject(createPressureCorridorTriptychCandidates({ artwork: true }));
const PRESETS = ['gentle', 'standard', 'expert'];
const MAX_FIRST_RETURN_TICKS = 1200;
// These are bounded first returns, not full clears or evidence that the authored
// erosion, warning-window and alternate-court strategies have been exercised.
const routes = [
  {
    id: 'pressure-ladder',
    name: 'upper landing with preset departure timing',
    direction: 'up',
    foundationIndex: 0,
    waitTicks: { gentle: 0, standard: 120, expert: 120 },
    position: { direction: 'left', reached: (state) => state.player.x <= 23.6 },
  },
  {
    id: 'pressure-ladder',
    name: 'lower landing through slow field with preset departure timing',
    direction: 'right',
    foundationIndex: 2,
    waitTicks: { gentle: 0, standard: 300, expert: 240 },
    position: { direction: 'down', reached: (state) => state.player.y >= 24.4 },
    capturesSlowField: true,
  },
  {
    id: 'cooling-loop',
    name: 'northern landing',
    direction: 'up',
    foundationIndex: 1,
  },
  {
    id: 'cooling-loop',
    name: 'western landing',
    direction: 'left',
    foundationIndex: 2,
  },
  {
    id: 'relay-remix',
    name: 'upper relay',
    direction: 'up',
    foundationIndex: 1,
    objectiveId: 'upper-relay',
    gateId: 'west-link',
  },
  {
    id: 'relay-remix',
    name: 'east relay',
    direction: 'up',
    foundationIndex: 1,
    objectiveId: 'east-relay',
    gateId: 'east-link',
    position: { direction: 'right', reached: (state) => state.player.x >= 38.4 },
  },
];

function effectiveLevel(id, difficulty, mode) {
  const manifest = resolveMission(project, id, { difficulty, mode });
  return applyGameplayTuning(manifest.level, resolveGameplayTuning(difficulty));
}

for (const route of routes)
  for (const difficulty of PRESETS)
    for (const turnPolicy of ['immediate', 'grid-center'])
      for (const seed of [1, 917])
        test(`${route.id}/${route.name}: effective ${difficulty}/${turnPolicy}/seed${seed} first return, replay and equal Versus boards`, () => {
          const level = effectiveLevel(route.id, difficulty, 'solo');
          const versusLevel = effectiveLevel(route.id, difficulty, 'versus');
          assert.deepEqual(versusLevel, level);
          const options = { seed, classId: 'scout', turnPolicy };
          const run = createRun(level, options);
          const recorder = createRecorder(level, options);
          const duel = createDuel(versusLevel, options, {
            protocol: UNTIMED_DUEL_PROTOCOL,
            seconds: 0,
          });
          assert.notEqual(duel.runs[0].cells, duel.runs[1].cells);
          resumeDuel(duel);
          const denominator = run.totalClaimable;
          const initialSlowCells = [...run.classic.terrain.keys()].filter(
            (cell) => run.classic.terrain[cell] === 1 && run.cells[cell] === CELL.FIELD,
          );
          const capturedObjectives = [];
          const openedGates = [];
          let closures = 0;

          function advanceUntil(direction, predicate) {
            while (run.tick < MAX_FIRST_RETURN_TICKS) {
              recordInput(recorder, { direction });
              stepRun(run, { direction }, FIXED_DT);
              stepDuel(duel, [{ direction }, { direction }]);
              assert.equal(run.status, 'running');
              assert.equal(run.classic.livesLost, 0);
              assert.equal(run.totalClaimable, denominator);
              assert.equal(duel.status, 'running');
              for (const board of duel.runs) {
                assert.equal(board.classic.livesLost, 0);
                assert.equal(board.totalClaimable, denominator);
              }
              for (const event of run.events) {
                if (event.type === 'cut.closed') closures++;
                if (event.type === 'objective.captured') capturedObjectives.push(event.id);
                if (event.type === 'relay.opened') openedGates.push(event.id);
              }
              if (predicate(run)) return;
            }
            assert.fail(`First return exceeded ${MAX_FIRST_RETURN_TICKS} fixed ticks`);
          }

          const waitTicks = route.waitTicks?.[difficulty] ?? 0;
          if (waitTicks) {
            advanceUntil(null, (state) => state.tick === waitTicks);
            assert.equal(closures, 0);
            assert.equal(run.player.cutting, false);
          }
          if (route.position) {
            // Coordinate thresholds request turns before passing the intended
            // cell centre, including the east relay's grid-steering column.
            advanceUntil(route.position.direction, route.position.reached);
            assert.equal(closures, 0);
          }
          advanceUntil(route.direction, (state) =>
            state.events.some((event) => event.type === 'cut.closed'),
          );

          assert.equal(closures, 1);
          assert(run.claimedCount > 0);
          assert.equal(run.player.cutting, false);
          assert.equal(run.player.speed, 0);
          assert.deepEqual(
            run.classic.powerups.filter((powerup) => powerup.collectedTick !== null),
            [],
          );
          const landing = level.foundations[route.foundationIndex];
          // A closure stops at the permanent landing's edge before entering it.
          assert(run.player.x >= landing.x - 1e-8 && run.player.x <= landing.x + landing.w + 1e-8);
          assert(run.player.y >= landing.y - 1e-8 && run.player.y <= landing.y + landing.h + 1e-8);
          if (route.capturesSlowField)
            assert(initialSlowCells.some((cell) => run.cells[cell] === CELL.SAFE));

          if (route.objectiveId) {
            assert.deepEqual(capturedObjectives, [route.objectiveId]);
            assert.deepEqual(openedGates, [route.gateId]);
            assert.deepEqual(
              run.objectives
                .filter((objective) => objective.required && objective.captured)
                .map((objective) => objective.id),
              [route.objectiveId],
            );
            for (const gate of run.relay.gates) {
              if (gate.id !== route.gateId) assert.equal(gate.openedTick, null);
              else {
                assert.equal(gate.openedTick, run.tick);
                assert(gate.cells.every((cell) => run.cells[cell] === CELL.SAFE));
                assert(gate.cells.every((cell) => run.foundation.permanent[cell] === 1));
              }
            }
          }

          assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
          const checkpoint = authoritativeCheckpoint(run);
          assert.deepEqual(authoritativeCheckpoint(duel.runs[0]), checkpoint);
          assert.deepEqual(authoritativeCheckpoint(duel.runs[1]), checkpoint);
        });

import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoolingLoopErosionCandidates } from '../content-design/cooling-loop-erosion-candidates.mjs';
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
import { roverLinks } from './helpers/rover-goal.mjs';

const current = compileContentProject(createCoolingLoopErosionCandidates({ artwork: true }));
const historical = compileContentProject(
  createPressureCorridorTriptychCandidates({ artwork: true }),
);

function effectiveLevel(project, difficulty, mode = 'solo') {
  const manifest = resolveMission(project, 'cooling-loop', { difficulty, mode });
  return applyGameplayTuning(manifest.level, resolveGameplayTuning(difficulty));
}

function permanentCells(run) {
  return [...run.foundation.permanent.keys()].filter((index) => run.foundation.permanent[index]);
}

function assertProtected(run, permanent) {
  assert(permanent.every((index) => run.foundation.permanent[index] === 1));
  assert(permanent.every((index) => run.cells[index] === CELL.SAFE));
  assert.equal(run.totalClaimable, 2098);
}

for (const difficulty of ['gentle', 'standard', 'expert'])
  for (const turnPolicy of ['immediate', 'grid-center'])
    for (const seed of [1, 917])
      for (const [direction, foundationIndex] of [
        ['up', 1],
        ['left', 2],
      ])
        test(`Cooling loop safe ${direction} first return: ${difficulty}/${turnPolicy}/seed${seed}`, () => {
          const level = effectiveLevel(current, difficulty);
          const run = createRun(level, { seed, classId: 'scout', turnPolicy });
          const permanent = permanentCells(run);
          let closed = false;
          while (run.tick < 1200) {
            stepRun(run, { direction }, FIXED_DT);
            assert.equal(run.status, 'running');
            assert.equal(run.classic.livesLost, 0);
            assertProtected(run, permanent);
            if (run.events.some((event) => event.type === 'cut.closed')) {
              closed = true;
              break;
            }
          }
          assert.equal(
            closed,
            true,
            'A usable initial return must close within the bounded route.',
          );
          assert(run.claimedCount > 0);
          assert.equal(run.player.cutting, false);
          assert.equal(run.player.speed, 0);
          const landing = level.foundations[foundationIndex];
          assert(run.player.x >= landing.x - 1e-8 && run.player.x <= landing.x + landing.w + 1e-8);
          assert(run.player.y >= landing.y - 1e-8 && run.player.y <= landing.y + landing.h + 1e-8);
        });

// Legal 120 Hz input recipes, including neutral releases between gestures.
// These are bounded partial routes plus 20 seconds of safe observation, never
// full-clear, whole-preset balance, public-host or human enjoyment evidence.
const routes = [
  {
    name: 'northern landings then both banks',
    routeTicks: 1650,
    cuts: 5,
    connected: true,
    fieldBankCells: [0, 0],
    historicalClaimed: 331,
    erosionDuringRoute: true,
    segments: [
      [null, 61],
      ['up', 129],
      [null, 1],
      ['up', 34],
      [null, 1],
      ['right', 258],
      [null, 1],
      ['down', 130],
      [null, 1],
      ['left', 170],
      [null, 1],
      ['left', 143],
      [null, 1],
      ['down', 211],
      [null, 1],
      ['left', 190],
      [null, 1],
      ['up', 144],
      [null, 1],
      ['right', 171],
    ],
  },
  {
    name: 'western bank first',
    routeTicks: 1462,
    cuts: 2,
    connected: false,
    fieldBankCells: [0, 40],
    historicalClaimed: 131,
    erosionDuringRoute: false,
    segments: [
      [null, 721],
      ['left', 55],
      [null, 1],
      ['down', 177],
      [null, 1],
      ['left', 190],
      [null, 1],
      ['up', 144],
      [null, 1],
      ['right', 171],
    ],
  },
];

function fieldBankCells(run) {
  return run.level.classic.terrain.map((bank) => {
    let count = 0;
    for (let y = bank.y; y < bank.y + bank.h; y++)
      for (let x = bank.x; x < bank.x + bank.w; x++)
        if (run.cells[y * run.width + x] === CELL.FIELD) count++;
    return count;
  });
}

for (const route of routes)
  test(`Cooling loop ${route.name}: warned earned-return erosion, replay and equal Versus`, () => {
    const level = effectiveLevel(current, 'standard');
    const versus = effectiveLevel(current, 'standard', 'versus');
    assert.deepEqual(versus, level);
    const options = { seed: 1, classId: 'scout', turnPolicy: 'immediate' };
    const run = createRun(level, options);
    const previous = createRun(effectiveLevel(historical, 'standard'), options);
    const recorder = createRecorder(level, options);
    const duel = createDuel(versus, options, {
      protocol: UNTIMED_DUEL_PROTOCOL,
      seconds: 0,
    });
    resumeDuel(duel);
    assert.notEqual(duel.runs[0].cells, duel.runs[1].cells);
    const permanent = permanentCells(run);
    const initialCells = [...run.cells];
    const warnings = [];
    const erosion = [];
    let cuts = 0;

    for (const [direction, ticks] of [...route.segments, [null, 2400]])
      for (let tick = 0; tick < ticks; tick++) {
        recordInput(recorder, { direction });
        stepRun(run, { direction }, FIXED_DT);
        stepRun(previous, { direction }, FIXED_DT);
        stepDuel(duel, [{ direction }, { direction }]);
        assert.equal(duel.status, 'running');
        for (const board of [run, previous, ...duel.runs]) {
          assert.equal(board.status, 'running');
          assert.equal(board.classic.livesLost, 0);
          assertProtected(board, permanent);
        }
        assert(
          !previous.events.some((event) =>
            ['erosion.warning', 'cells.eroded'].includes(event.type),
          ),
          'The preserved v37 route does not exercise erosion with these same commands.',
        );
        for (const event of run.events) {
          if (event.type === 'cut.closed') cuts++;
          if (event.type === 'erosion.warning') {
            assert.equal(event.id, 'eroder');
            assert.equal(event.erosionAt - run.classic.actorTick, 60);
            assert.equal(
              initialCells[event.index],
              CELL.FIELD,
              'The target must be earned ground.',
            );
            assert.equal(run.cells[event.index], CELL.SAFE);
            assert.equal(run.foundation.permanent[event.index], 0);
            assert.equal(
              run.classic.terrain[event.index],
              0,
              'This is a return, not a lethal bank.',
            );
            warnings.push({ tick: run.tick, index: event.index, due: event.erosionAt });
          }
          if (event.type === 'cells.eroded')
            for (const index of event.indices) {
              const warning = warnings.findLast((item) => item.index === index);
              assert(warning, 'Every removed cell must have a prior warning.');
              assert.equal(run.tick - warning.tick, 60);
              assert.equal(run.classic.actorTick, warning.due);
              assert.equal(run.cells[index], CELL.FIELD);
              assert.equal(run.foundation.permanent[index], 0);
              assert.equal(run.classic.terrain[index], 0);
              erosion.push({
                tick: run.tick,
                x: index % run.width,
                y: Math.floor(index / run.width),
              });
            }
        }
        if (run.tick === route.routeTicks) {
          assert.equal(cuts, route.cuts);
          assert.equal(roverLinks(run, level.foundations), route.connected);
          assert.deepEqual(fieldBankCells(run), route.fieldBankCells);
          assert.equal(erosion.length > 0, route.erosionDuringRoute);
        }
      }

    assert.equal(run.tick, route.routeTicks + 2400);
    assert.equal(cuts, route.cuts);
    assert.deepEqual(erosion, [
      { tick: 1615, x: 17, y: 26 },
      { tick: 2653, x: 17, y: 27 },
      { tick: 3723, x: 18, y: 27 },
    ]);
    assert.equal(warnings.length, 3);
    assert.equal(previous.claimedCount, route.historicalClaimed);
    assert.equal(run.claimedCount, route.historicalClaimed - 3);
    assert.equal(run.coverage, run.claimedCount / run.totalClaimable);
    assert(
      run.coverage < level.goal.coverage,
      'These observations must not be reported as clears.',
    );
    assert.deepEqual(fieldBankCells(run), route.fieldBankCells);
    assert.equal(roverLinks(run, level.foundations), route.connected);
    assert.deepEqual(
      run.classic.powerups.filter((powerup) => powerup.collectedTick !== null),
      [],
    );
    assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
    const checkpoint = authoritativeCheckpoint(run);
    for (const board of duel.runs) assert.deepEqual(authoritativeCheckpoint(board), checkpoint);
  });

test('Cooling loop Standard immediate seed1 completes the northern route after real erosion, with replay and tied Versus', () => {
  const level = effectiveLevel(current, 'standard');
  const versus = effectiveLevel(current, 'standard', 'versus');
  assert.deepEqual(versus, level);
  const options = { seed: 1, classId: 'scout', turnPolicy: 'immediate' };
  const run = createRun(level, options);
  const recorder = createRecorder(level, options);
  const duel = createDuel(versus, options, {
    protocol: UNTIMED_DUEL_PROTOCOL,
    seconds: 0,
  });
  resumeDuel(duel);
  assert.notEqual(duel.runs[0].cells, duel.runs[1].cells);
  const permanent = permanentCells(run);
  const warnings = [];
  let closures = 0;
  let erosions = 0;
  // A separate complete continuation: unlike the bounded observation tests
  // above, this route keeps playing instead of waiting on the fifth landing.
  const segments = [
    ...routes[0].segments,
    ['up', 270],
    ['right', 565],
    ['down', 258],
    [null, 1],
    ['left', 1000],
    ['down', 230],
    ['right', 432],
    [null, 1],
    ['up', 230],
    ['right', 360],
    [null, 1],
    ['down', 230],
    ['up', 108],
    [null, 1],
    ['right', 166],
  ];
  play: for (const [direction, ticks] of segments)
    for (let tick = 0; tick < ticks; tick++) {
      if (run.status !== 'running') break play;
      recordInput(recorder, { direction });
      stepRun(run, { direction }, FIXED_DT);
      stepDuel(duel, [{ direction }, { direction }]);
      for (const board of [run, ...duel.runs]) {
        assert.equal(board.classic.livesLost, 0);
        assertProtected(board, permanent);
      }
      for (const event of run.events) {
        if (event.type === 'cut.closed') closures++;
        if (event.type === 'erosion.warning')
          warnings.push({ tick: run.tick, index: event.index, due: event.erosionAt });
        if (event.type === 'cells.eroded') {
          erosions++;
          for (const index of event.indices) {
            const warning = warnings.findLast((item) => item.index === index);
            assert(warning);
            assert.equal(run.tick - warning.tick, 60);
            assert.equal(run.classic.actorTick, warning.due);
            assert.equal(run.foundation.permanent[index], 0);
          }
        }
      }
    }

  assert.equal(run.status, 'won');
  assert.equal(run.tick, 5503);
  assert.equal(run.claimedCount, 1708);
  assert.equal(run.coverage, 1708 / 2098);
  assert.equal(closures, 13);
  assert.equal(warnings.length, 6);
  assert.equal(erosions, 6);
  assert.deepEqual(fieldBankCells(run), [0, 0]);
  assert.equal(roverLinks(run, level.foundations), true);
  assert.deepEqual(
    run.classic.powerups.filter((powerup) => powerup.collectedTick !== null),
    [],
  );
  assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
  const checkpoint = authoritativeCheckpoint(run);
  assert.equal(checkpoint.hash, '21a461387f53c722');
  assert.equal(duel.status, 'finished');
  assert.equal(duel.winner, null);
  for (const board of duel.runs) {
    assert.equal(board.status, 'won');
    assert.deepEqual(authoritativeCheckpoint(board), checkpoint);
  }
});

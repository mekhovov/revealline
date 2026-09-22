import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRoverTeachingCandidates } from '../content-design/rover-teaching-candidates.mjs';
import { createRoverSpatialCandidates } from '../content-design/rover-spatial-candidates.mjs';
import { withPressureDifficulty } from '../content-design/pressure-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { inspectCaptureSnapshot } from '../core/capture-regions.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';
import {
  createSortingEvidence,
  sortingBeforeStep,
  observeSortingStep,
  inspectSortingEvidence,
} from './helpers/sorting-goal.mjs';

const historical = withPressureDifficulty(createRoverTeachingCandidates());
const previous = compileContentProject(historical);
const source = createRoverSpatialCandidates();
const project = compileContentProject(source);
const presets = ['gentle', 'standard', 'expert'];
const controls = ['immediate', 'grid-center'];
const fixture = JSON.parse(
  await readFile(new URL('./fixtures/rover-sorting-spatial-routes.json', import.meta.url)),
);
const masteryFixture = JSON.parse(
  await readFile(new URL('./fixtures/rover-sorting-mastery-routes.json', import.meta.url)),
);

test('ordinary and mastery fixtures each pin the exact six public-input cases', () => {
  for (const [data, format] of [
    [fixture, 'RoverSortingSpatialRoutesV1'],
    [masteryFixture, 'RoverSortingMasteryRoutesV1'],
  ]) {
    assert.equal(data.format, format);
    assert.equal(data.rows.length, 6);
    assert.deepEqual(
      data.rows.map((r) => `${r.difficulty}/${r.turnPolicy}`).sort(),
      presets.flatMap((d) => controls.map((c) => `${d}/${c}`)).sort(),
    );
    for (const row of data.rows) {
      assert.equal(row.id, 'sorting-yard');
      assert.equal(row.seed, 1);
      assert.equal(row.delaySeconds, 0);
      assert.equal(row.status, 'won');
      assert.deepEqual(row.searchWaitTicks, [0]);
    }
  }
});

test('one explicit Sorting successor preserves historical sources, six other missions, foundations and shared physics', () => {
  assert.deepEqual(withPressureDifficulty(createRoverTeachingCandidates()), historical);
  assert.equal(source.difficultyCatalogId, 'journey-difficulty-v2');
  assert.equal(source.missions.length, 7);
  for (const difficulty of presets)
    for (const mission of project.missions) {
      const old = resolveMission(previous, mission.id, { difficulty });
      const next = resolveMission(project, mission.id, { difficulty });
      assert.deepEqual(
        next.level,
        resolveMission(project, mission.id, { difficulty, mode: 'versus' }).level,
      );
      if (mission.id !== 'sorting-yard') {
        assert.deepEqual(next, old);
        continue;
      }
      assert.notEqual(next.simulationIdentity, old.simulationIdentity);
      assert.deepEqual(next.level.rules, old.level.rules);
      assert.deepEqual(next.level.goal, old.level.goal);
      assert.deepEqual(next.level.foundations, old.level.foundations);
      assert.equal(mission.coverage, 0.76);
      assert.deepEqual(mission.bonuses, []);
      assert.deepEqual(mission.objectives, []);
      assert.deepEqual([...new Set(mission.actors.map((a) => a.role))].sort(), [
        'field-keeper',
        'reclaimed-roamer',
      ]);
      assert(mission.actors.every((a) => a.tier === 'measured'));
      for (const actor of old.level.enemies) {
        const successor = next.level.enemies.find((a) => a.id === actor.id);
        assert.equal(Math.hypot(successor.vx, successor.vy), Math.hypot(actor.vx, actor.vy));
      }
    }
});

test('two open occupied chambers retain independently, with no remote empty auto-fill', () => {
  const run = createRun(resolveMission(project, 'sorting-yard').level, { seed: 1 });
  const snapshot = inspectCaptureSnapshot(run);
  assert.equal(run.totalClaimable, 1850);
  assert.equal(snapshot.filledCells.length, 0);
  assert.deepEqual(
    snapshot.components.map((c) => c.enemyIds),
    [
      ['north', 'north-pocket'],
      ['south', 'south-pocket'],
    ],
  );
  const map = project.maps.find((m) => m.source.id === 'sorting-yard-map');
  assert.equal(map.geometry.fieldComponents.length, 2);
  assert.equal(map.geometry.safeComponents.length, 1);
  assert.deepEqual(map.geometry.diagnostics, []);
});

for (const difficulty of presets)
  for (const turnPolicy of controls)
    test(`both warns are readable, spawn has decision time and either field departure is viable: ${difficulty}/${turnPolicy}`, () => {
      const level = resolveMission(project, 'sorting-yard', { difficulty }).level;
      for (const seed of [1, 7, 19])
        for (const delay of [0, 60, 240]) {
          const idle = createRun(level, { seed, turnPolicy });
          const evidence = createSortingEvidence(idle);
          for (let t = 0; t < 1200; t++) {
            const before = sortingBeforeStep(idle);
            stepRun(idle, { direction: null }, FIXED_DT);
            observeSortingStep(idle, evidence, before);
          }
          assert.equal(idle.classic.livesLost, 0);
          assert.deepEqual(evidence.warnings, [
            [1, 'north-sleeper'],
            [1, 'south-sleeper'],
          ]);
          assert.deepEqual(evidence.activations, [
            [121, 'north-sleeper'],
            [121, 'south-sleeper'],
          ]);
          for (const direction of ['up', 'down']) {
            const run = createRun(level, { seed, turnPolicy });
            for (let t = 0; t < delay; t++) stepRun(run, { direction: null }, FIXED_DT);
            let closed = false;
            for (let t = 0; t < 300 && !closed && !run.classic.livesLost; t++) {
              stepRun(run, { direction }, FIXED_DT);
              closed = run.events.some((e) => e.type === 'cut.closed');
            }
            assert(closed, `${seed}/${delay}/${direction}`);
            assert.equal(run.classic.livesLost, 0);
            assert.equal(run.status, 'running');
          }
        }
    });

test('head-on stub approaches are genuine avoidable roamer contacts, not harmless decorations', () => {
  for (const difficulty of presets)
    for (const turnPolicy of controls)
      for (const [approach, ticks, entry] of [
        ['left', 156, 'up'],
        ['right', 180, 'down'],
      ]) {
        const run = createRun(resolveMission(project, 'sorting-yard', { difficulty }).level, {
          seed: 1,
          turnPolicy,
        });
        for (let i = 0; i < ticks; i++) stepRun(run, { direction: approach }, FIXED_DT);
        assert.equal(run.classic.livesLost, 0);
        for (let i = 0; i < 150 && !run.classic.livesLost; i++)
          stepRun(run, { direction: entry }, FIXED_DT);
        assert.equal(run.classic.livesLost, 1);
        const failure = run.events.find((e) => e.type === 'player.failed');
        assert.equal(failure?.cause, 'enemy-player');
        assert.equal(failure.actorId, entry === 'up' ? 'north-sleeper' : 'south-sleeper');
      }
});

test('short side approaches close on both stubs without contact in every preset/control', () => {
  for (const difficulty of presets)
    for (const turnPolicy of controls)
      for (const [departure, approach, foundation] of [
        ['up', 'left', 1],
        ['down', 'right', 2],
      ]) {
        const run = createRun(resolveMission(project, 'sorting-yard', { difficulty }).level, {
          seed: 1,
          turnPolicy,
        });
        const evidence = createSortingEvidence(run);
        for (const [direction, count] of [
          [departure, 42],
          [approach, 240],
        ])
          for (let i = 0; i < count; i++) {
            const before = sortingBeforeStep(run);
            stepRun(run, { direction }, FIXED_DT);
            observeSortingStep(run, evidence, before);
            assert.equal(run.classic.livesLost, 0);
            if (run.events.some((e) => e.type === 'cut.closed')) break;
          }
        assert.equal(evidence.boundary.closures.length, 1);
        assert(evidence.activeReturns.has(foundation));
      }
});

test('added retainers, not roamer speed, reduce the initial broad-slice windfall', () => {
  const counterfactual = structuredClone(source);
  counterfactual.missions.find((m) => m.id === 'sorting-yard').actors = counterfactual.missions
    .find((m) => m.id === 'sorting-yard')
    .actors.filter((a) => !a.id.endsWith('-pocket'));
  const reduced = compileContentProject(counterfactual);
  for (const [direction, fullCells, reducedCells] of [
    ['up', 14, 400],
    ['down', 15, 450],
  ]) {
    const captures = [];
    for (const candidate of [project, reduced]) {
      const run = createRun(resolveMission(candidate, 'sorting-yard').level, { seed: 1 });
      for (let i = 0; i < 300; i++) {
        stepRun(run, { direction }, FIXED_DT);
        if (run.events.some((e) => e.type === 'cut.closed')) break;
      }
      assert.equal(run.classic.livesLost, 0);
      assert.equal(run.totalClaimable, 1850);
      captures.push(Math.round(run.coverage * run.totalClaimable));
    }
    assert.deepEqual(captures, [fullCells, reducedCells]);
  }
});

for (const [kind, rows] of [
  ['ordinary', fixture.rows],
  ['mastery', masteryFixture.rows],
])
  for (const row of rows)
    test(`${kind} no-added-wait clear replays and races equally: ${row.difficulty}/${row.turnPolicy}`, () => {
      const manifest = resolveMission(project, row.id, { difficulty: row.difficulty });
      assert.equal(manifest.simulationIdentity, row.simulationIdentity);
      const options = { seed: row.seed, classId: 'scout', turnPolicy: row.turnPolicy };
      const run = createRun(manifest.level, options),
        recorder = createRecorder(manifest.level, options);
      const duel = createDuel(manifest.level, options, {
        protocol: UNTIMED_DUEL_PROTOCOL,
        seconds: 0,
      });
      resumeDuel(duel);
      const evidence = createSortingEvidence(run),
        denominator = run.totalClaimable;
      const observedClosures = [];
      for (const { direction, ticks } of row.segments) {
        assert.notEqual(direction, null);
        for (let i = 0; i < ticks; i++) {
          assert.equal(run.status, 'running');
          const before = sortingBeforeStep(run);
          recordInput(recorder, { direction });
          stepRun(run, { direction }, FIXED_DT);
          stepDuel(duel, [{ direction }, { direction }]);
          observeSortingStep(run, evidence, before);
          if (run.events.some((e) => e.type === 'cut.closed'))
            observedClosures.push([run.tick, run.coverage]);
          assert.equal(run.classic.livesLost, 0);
          assert.equal(run.totalClaimable, denominator);
        }
      }
      assert.equal(run.status, 'won');
      assert.equal(run.tick, row.ticks);
      assert.equal(run.lives, row.lives);
      assert.equal(run.coverage, row.coverage);
      assert.equal(evidence.boundary.closures.length, row.cuts);
      assert.deepEqual(observedClosures, row.closures);
      assert.equal(authoritativeCheckpoint(run).hash, row.checkpoint);
      assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
      assert.equal(duel.status, 'finished');
      assert.equal(duel.winner, null);
      for (const board of duel.runs)
        assert.equal(authoritativeCheckpoint(board).hash, row.checkpoint);
      const facts = inspectSortingEvidence(run, evidence);
      assert.equal(facts.chambersEarned, 2);
      assert.equal(facts.activations.length, 2);
      assert(facts.closures.every((c) => c.tick > 121));
      if (kind === 'mastery') {
        assert.equal(facts.mastered, true);
        assert.deepEqual(facts.activeReturns, [1, 2]);
        assert.equal(facts.closureAfterBothReturns, true);
        const saved = new Set(evidence.activeReturns);
        evidence.activeReturns.delete(1);
        assert.equal(
          inspectSortingEvidence(run, evidence).mastered,
          false,
          'both awake + both chambers is not mastery',
        );
        evidence.activeReturns = saved;
        assert.equal(
          inspectSortingEvidence({ ...run, status: 'running' }, evidence).mastered,
          false,
        );
        assert.equal(
          inspectSortingEvidence({ ...run, classic: { ...run.classic, livesLost: 1 } }, evidence)
            .mastered,
          false,
        );
      }
    });

test('pictured study reuses exact original pins; Studio edition selection still requires Inspect then Apply', async () => {
  const pictured = createRoverSpatialCandidates({ artwork: true });
  assert.deepEqual(pictured.assets, createRoverTeachingCandidates({ artwork: true }).assets);
  const picturedProject = compileContentProject(pictured);
  for (const difficulty of presets)
    assert.equal(
      resolveMission(picturedProject, 'sorting-yard', { difficulty }).simulationIdentity,
      resolveMission(project, 'sorting-yard', { difficulty }).simulationIdentity,
    );
  const html = await readFile(new URL('../studio/index.html', import.meta.url), 'utf8');
  const host = await readFile(new URL('../studio/studio.mjs', import.meta.url), 'utf8');
  assert.match(html, /id="rover-edition"/);
  assert.match(html, /value="sorting-spatial-1"/);
  const action = host.slice(
    host.indexOf("$('rover').onclick"),
    host.indexOf("$('fracture').onclick"),
  );
  assert.match(action, /discardSource\(\)/);
  assert.match(action, /createRoverSpatialCandidates/);
  assert.match(action, /createRoverTeachingCandidates/);
  assert.match(action, /inspectSource\(\)/);
  assert.doesNotMatch(action, /session.replace|queueSave|launchPreview/);
});

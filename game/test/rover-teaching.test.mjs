import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRoverCandidates } from '../content-design/rover-candidates.mjs';
import { createRoverTeachingCandidates } from '../content-design/rover-teaching-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { inspectContentPacing } from '../content-design/pacing.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { inspectCaptureSnapshot } from '../core/capture-regions.mjs';
import { inspectRoverGoal, roverLinks } from './helpers/rover-goal.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';

const source = createRoverTeachingCandidates({ artwork: true });
const project = compileContentProject(source);
const fixture = JSON.parse(
  await readFile(new URL('./fixtures/rover-teaching-routes.json', import.meta.url)),
);
const ids = ['wake-the-yard', 'split-berths'];

test('teaching successors revise two encounters without altering historical maps, art or later missions', async () => {
  const historical = createRoverCandidates({ artwork: true });
  assert.deepEqual(source.maps, historical.maps);
  assert.deepEqual(source.assets, historical.assets);
  assert.deepEqual(source.missions.slice(2), historical.missions.slice(2));
  assert.deepEqual(createRoverCandidates({ artwork: true }), historical);
  assert.equal(source.campaigns[0].revision, 'teaching-1');
  assert.equal(source.packs[0].revision, 'teaching-1');
  for (const id of ids) {
    const old = historical.missions.find((m) => m.id === id),
      current = source.missions.find((m) => m.id === id);
    assert.equal(current.revision, 'teaching-1');
    assert.equal(current.coverage, old.coverage);
    assert.deepEqual(current.design.introduces, old.design.introduces);
    assert.deepEqual(current.design.practices, old.design.practices);
    assert.equal(current.design.difficulty.band, old.design.difficulty.band);
    assert(!current.design.combines.includes('reclaimed-roamer'));
  }
  assert(!source.missions[0].actors.some((a) => a.role === 'perimeter-patrol'));
  assert.equal(source.missions[1].actors.filter((a) => a.role === 'reclaimed-roamer').length, 2);
  const report = inspectContentPacing(source, { packIds: ['journey-rover'] });
  assert.deepEqual(report.diagnostics, []);
  const bytes = await readFile(new URL('./fixtures/rover-clear-routes.json', import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), fixture.input.sha256);
});

test('first closure teaches warning and activation with two seconds to choose either escape in sampled starts', () => {
  let checked = 0;
  for (const id of ids)
    for (const difficulty of ['gentle', 'standard', 'expert'])
      for (const turnPolicy of ['immediate', 'grid-center'])
        for (const seed of [1, 7, 19, 37, 101])
          for (const delay of [0, 60, 240]) {
            const manifest = resolveMission(project, id, { difficulty });
            const run = createRun(manifest.level, { seed, classId: 'scout', turnPolicy });
            for (let i = 0; i < delay; i++) stepRun(run, { direction: null }, FIXED_DT);
            let warning = null;
            for (let i = 0; i < 300 && !warning; i++) {
              stepRun(run, { direction: 'down' }, FIXED_DT);
              warning = run.events.find((e) => e.type === 'rover.warning');
            }
            assert(warning, `${id}/${difficulty}/${turnPolicy}/${seed}/${delay}`);
            assert(run.events.some((e) => e.type === 'capture.stopped'));
            assert(run.coverage > 0 && run.coverage < 0.01);
            assert.equal(run.classic.livesLost, 0);
            assert.equal(run.player.speed, 0);
            const actor = run.enemies.find((e) => e.id === warning.id);
            assert.equal(actor.classic.mode, 'warning');
            for (let i = 0; i < 119; i++) stepRun(run, { direction: null }, FIXED_DT);
            assert.equal(actor.classic.mode, 'warning');
            stepRun(run, { direction: null }, FIXED_DT);
            assert.equal(actor.classic.mode, 'active');
            for (let i = 0; i < 120; i++) stepRun(run, { direction: null }, FIXED_DT);
            assert.equal(run.classic.livesLost, 0, 'Two-second observation is not forced damage');
            for (const direction of ['left', 'right']) {
              const escape = structuredClone(run);
              for (let i = 0; i < 72; i++) stepRun(escape, { direction }, FIXED_DT);
              assert.equal(escape.classic.livesLost, 0, `${id}: ${direction} escape`);
              assert(Math.abs(escape.player.x - run.player.x) > 3);
            }
            checked++;
          }
  assert.equal(checked, 180);
});

test('twelve revised clear routes earn no-loss Solo replays and equal untimed races', () => {
  assert.equal(fixture.rows.length, 12);
  assert.equal(
    new Set(fixture.rows.map((r) => `${r.missionId}/${r.difficulty}/${r.turnPolicy}`)).size,
    12,
  );
  for (const row of fixture.rows) {
    const manifest = resolveMission(project, row.missionId, { difficulty: row.difficulty });
    assert.equal(manifest.simulationIdentity, row.simulationIdentity);
    const options = { seed: 1, classId: 'scout', turnPolicy: row.turnPolicy };
    const run = createRun(manifest.level, options),
      recorder = createRecorder(manifest.level, options);
    const race = createDuel(manifest.level, options, {
      protocol: UNTIMED_DUEL_PROTOCOL,
      seconds: 0,
    });
    resumeDuel(race);
    let activeClosure = false;
    for (const [direction, ticks] of row.segments)
      for (let i = 0; i < ticks; i++) {
        assert.equal(run.status, 'running');
        const active = run.enemies.some(
          (e) => e.type === 'claimed-rover' && e.classic.mode === 'active',
        );
        recordInput(recorder, { direction });
        stepRun(run, { direction }, FIXED_DT);
        stepDuel(race, [{ direction }, { direction }]);
        assert.equal(run.classic.livesLost, 0);
        activeClosure ||= active && run.events.some((e) => e.type === 'capture.stopped');
      }
    assert.equal(run.status, 'won');
    assert(activeClosure, 'A clear practices a further closure after activation');
    assert.equal(authoritativeCheckpoint(run).hash, row.checkpoint);
    assert(verifyReplay(exportReplay(recorder, run)).match);
    for (const board of race.runs)
      assert.equal(authoritativeCheckpoint(board).hash, row.checkpoint);
    assert.equal(race.status, 'finished');
  }
});

test('the former Gentle grid route is retained as negative evidence, not silently blessed after retuning', async () => {
  const prior = JSON.parse(
    await readFile(new URL('./fixtures/rover-clear-routes.json', import.meta.url)),
  );
  const row = prior.sets
    .find((s) => s.difficulty === 'gentle' && s.turnPolicy === 'grid-center')
    .rows.find((r) => r[0] === 'split-berths');
  const run = createRun(resolveMission(project, 'split-berths', { difficulty: 'gentle' }).level, {
    seed: 1,
    classId: 'scout',
    turnPolicy: 'grid-center',
  });
  for (const [direction, ticks] of row[3])
    for (let i = 0; i < ticks && run.status === 'running'; i++)
      stepRun(run, { direction }, FIXED_DT);
  assert.equal(run.classic.livesLost, 1);
  assert.notEqual(run.status, 'won');
});

test('both unchanged optional goals have pinned no-loss routes in all six settings', async () => {
  const mastery = JSON.parse(
    await readFile(new URL('./fixtures/rover-teaching-mastery.json', import.meta.url)),
  );
  const old = await readFile(new URL('./fixtures/rover-mastery-routes.json', import.meta.url));
  assert.equal(createHash('sha256').update(old).digest('hex'), mastery.input.sha256);
  assert.equal(mastery.format, 'RoverTeachingMasteryV1');
  assert.equal(mastery.rows.length, 12);
  assert.deepEqual(
    mastery.rows.map((r) => `${r.missionId}/${r.difficulty}/${r.turnPolicy}`).sort(),
    fixture.rows.map((r) => `${r.missionId}/${r.difficulty}/${r.turnPolicy}`).sort(),
  );
  for (const row of mastery.rows) {
    const manifest = resolveMission(project, row.missionId, { difficulty: row.difficulty });
    assert.equal(manifest.simulationIdentity, row.simulationIdentity);
    const options = { seed: 1, classId: 'scout', turnPolicy: row.turnPolicy };
    const run = createRun(manifest.level, options),
      recorder = createRecorder(manifest.level, options);
    const foundations = source.maps.find(
      (map) => map.id === project.missions.find((m) => m.id === row.missionId).map.id,
    ).foundations;
    const initialComponents = inspectCaptureSnapshot(run).components,
      closures = [];
    for (const [direction, ticks] of row.segments) {
      assert(direction === null || ['up', 'down', 'left', 'right'].includes(direction));
      assert(Number.isSafeInteger(ticks) && ticks > 0 && ticks <= 1000);
      for (let i = 0; i < ticks; i++) {
        assert.equal(run.status, 'running');
        const before = run.claimedCount,
          trail = run.trail.map((cell) => cell.index),
          activeIds = run.enemies
            .filter((e) => e.type === 'claimed-rover' && e.classic.mode === 'active')
            .map((e) => e.id);
        recordInput(recorder, { direction });
        stepRun(run, { direction }, FIXED_DT);
        assert.equal(run.classic.livesLost, 0);
        if (run.claimedCount > before)
          closures.push({ trail, activeIds, allLinked: roverLinks(run, foundations) });
      }
    }
    assert(
      inspectRoverGoal({ missionId: row.missionId, run, foundations, initialComponents, closures })
        .achieved,
    );
    assert.equal(authoritativeCheckpoint(run).hash, row.checkpoint);
    assert(verifyReplay(exportReplay(recorder, run)).match);
  }
});

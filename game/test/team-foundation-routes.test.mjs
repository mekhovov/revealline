import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createTeamFoundationPracticeCandidates,
  TEAM_FOUNDATION_FIRST_RETURNS,
} from '../content-design/team-journey-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createCoop, startCoop, stepCoop, SAFE } from '../coop/core.mjs';
import { playTeamFoundationRoute } from './helpers/team-foundation-route.mjs';
import {
  createTeamFoundationEvidence,
  observeTeamFoundationGoal,
  inspectTeamFoundationGoal,
  perimeterConnectedFoundations,
} from './helpers/team-foundation-goal.mjs';

const source = createTeamFoundationPracticeCandidates(),
  before = structuredClone(source);
const project = compileContentProject(source);
const fixtures = JSON.parse(
  await readFile(new URL('./fixtures/team-foundation-routes.json', import.meta.url)),
);

test('route evidence rejects an artificial neutral brake while a craft is still moving', () => {
  const level = resolveMission(project, 'switchback-partners', { mode: 'team' }).level;
  assert.throws(
    () =>
      playTeamFoundationRoute(level, [
        { a: 'up', b: null, ticks: 3 },
        { a: null, b: null, ticks: 1 },
      ]),
    /cannot brake continuous steering/,
  );
});

for (const kind of ['clear', 'mastery'])
  for (const row of fixtures[kind])
    test(`${row.missionId}/${row.difficulty}: pinned two-seat ${kind}, independent cuts and swapped seats`, () => {
      const manifest = resolveMission(project, row.missionId, {
        mode: 'team',
        difficulty: row.difficulty,
      });
      assert.equal(manifest.simulationIdentity, row.simulationIdentity);
      for (const expected of row.results) {
        const options = { jointCuts: expected.jointCuts };
        const played = playTeamFoundationRoute(manifest.level, row.log, options);
        assert.equal(played.checkpoint, expected.checkpoint);
        assert.equal(played.run.status, 'won');
        assert.equal(played.evidence.downs, 0);
        assert.deepEqual([...played.evidence.closed].sort(), [0, 1]);
        assert.equal(played.run.tick, expected.tick);
        assert.equal(played.run.coverage, expected.coverage);
        assert.equal(played.run.rules.moveSpeed, 10);
        assert.equal(
          played.run.team.reserves,
          { gentle: 4, standard: 2, expert: 1 }[row.difficulty],
        );
        assert.equal(
          played.run.players.every((p) => p.support.uses === 0),
          true,
        );
        if (kind === 'mastery') {
          assert.equal(played.mastery.achieved, true);
          assert(played.simultaneousTicks > 0, 'two exposed craft actually move at the same time');
        }
        const repeated = playTeamFoundationRoute(manifest.level, row.log, options);
        assert.deepEqual(repeated, played);
        const swapped = playTeamFoundationRoute(manifest.level, row.log, {
          ...options,
          swapped: true,
        });
        assert.equal(swapped.checkpoint, expected.swappedCheckpoint);
        assert.equal(swapped.run.status, 'won');
        assert.equal(swapped.evidence.downs, 0);
        assert.deepEqual([...swapped.evidence.closed].sort(), [0, 1]);
        if (kind === 'mastery') assert.equal(swapped.mastery.achieved, true);
        for (const r of manifest.level.safeRects)
          for (let y = r.y; y < r.y + r.h; y++)
            for (let x = r.x; x < r.x + r.w; x++) assert.equal(played.run.cells[y * 72 + x], SAFE);
      }
      assert.deepEqual(source, before);
    });

test('all eighteen first-return combinations close both cuts without loss or an automatic empty-board clear', () => {
  for (const mission of project.missions)
    for (const difficulty of ['gentle', 'standard', 'expert'])
      for (const jointCuts of [true, false]) {
        const level = resolveMission(project, mission.id, { mode: 'team', difficulty }).level;
        const run = startCoop(createCoop(level, { jointCuts })),
          closed = new Set();
        for (let tick = 0; tick < 650 && closed.size < 2 && run.status === 'running'; tick++) {
          stepCoop(
            run,
            TEAM_FOUNDATION_FIRST_RETURNS[mission.id].map((direction, seat) => ({
              direction: closed.has(seat) ? null : direction,
              boost: false,
              support: false,
            })),
          );
          assert(!run.events.some((e) => e.type === 'player.downed'));
          for (const e of run.events) if (e.type === 'cut.closed') closed.add(e.player);
        }
        assert.deepEqual([...closed].sort(), [0, 1]);
        assert.equal(run.status, 'running');
        assert(run.coverage > 0 && run.coverage < level.goal.coverage);
        assert(run.players.every((p) => !p.cutting && run.cells[p.cellIndex] === SAFE));
      }
});

test('mastery observer requires genuine connected visits, both contributors and no knockdown', () => {
  const row = fixtures.mastery.find(
    (r) => r.missionId === 'switchback-partners' && r.difficulty === 'standard',
  );
  const level = resolveMission(project, row.missionId, { mode: 'team' }).level;
  const initial = startCoop(createCoop(level));
  const evidence = createTeamFoundationEvidence();
  observeTeamFoundationGoal(initial, evidence);
  assert.deepEqual([...perimeterConnectedFoundations(initial)], []);
  assert.equal(inspectTeamFoundationGoal(initial, evidence).achieved, false);
  const played = playTeamFoundationRoute(level, row.log);
  assert(played.mastery.achieved);
  const snapshot = structuredClone(played.run),
    observed = structuredClone(played.evidence);
  observeTeamFoundationGoal(played.run, played.evidence);
  assert.deepEqual(played.evidence, observed, 'observing one tick twice cannot duplicate credit');
  assert.deepEqual(played.run, snapshot, 'observer cannot change gameplay');
  for (const alter of [(e) => e.visits[1].clear(), (e) => e.closed.delete(1), (e) => e.downs++]) {
    const incomplete = structuredClone(observed);
    alter(incomplete);
    assert.equal(inspectTeamFoundationGoal(played.run, incomplete).achieved, false);
  }
  const ordinary = fixtures.clear.find(
    (r) => r.missionId === row.missionId && r.difficulty === 'standard',
  );
  assert.equal(
    playTeamFoundationRoute(level, ordinary.log).mastery.achieved,
    false,
    'an ordinary shared clear must not imply the optional connected-platform visit',
  );
});

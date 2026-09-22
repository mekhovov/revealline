import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTeamRoamerSpatialCandidates } from '../content-design/team-roamer-spatial-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createCoop, SAFE } from '../coop/core.mjs';
import { playTeamFoundationRoute } from './helpers/team-foundation-route.mjs';
import { inspectTeamRoamerGoal } from './helpers/team-roamer-goal.mjs';
import { assessTeamPressureRoute } from '../../scripts/lib/team-pressure-assessment.mjs';

const read = async (name) =>
  JSON.parse(await readFile(new URL(`./fixtures/${name}.json`, import.meta.url)));
const fixture = await read('team-roamer-spatial-openings');
const old = await read('team-roamer-routes'),
  pressure = await read('team-pressure-roamer-routes');
const audit = await read('team-pressure-assessment');
const project = compileContentProject(createTeamRoamerSpatialCandidates());
const pairs = ['false/false', 'false/true', 'true/false', 'true/true'];

function connected(run, spawn, target) {
  const from = Math.floor(spawn.y) * run.width + Math.floor(spawn.x);
  const to = target.y * run.width + target.x;
  const seen = new Set([from]),
    queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const cell = queue[i],
      x = cell % run.width,
      y = Math.floor(cell / run.width);
    for (const [nx, ny] of [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= run.width || ny >= run.height) continue;
      const next = ny * run.width + nx;
      if (!seen.has(next) && run.cells[next] === SAFE) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen.has(to);
}

function throughTick(log, tick) {
  const result = [];
  for (const segment of log) {
    const ticks = Math.min(segment.ticks, tick);
    if (ticks === 0) break;
    result.push({ ...segment, ticks });
    tick -= ticks;
  }
  return result;
}

test('opening alternatives and unchanged historical comparisons cover every authored preset', () => {
  assert.equal(fixture.format, 'TeamRoamerSpatialSupplementV1');
  assert.equal(fixture.projectRevision, project.source.revision);
  assert.equal(fixture.difficultyCatalogue, project.difficulty.id);
  assert(fixture.elapsedMilliseconds < fixture.budgetMilliseconds);
  assert.deepEqual(fixture.failed, []);
  for (const rows of [fixture.history, fixture.inner]) {
    assert.equal(rows.length, 6);
    assert.equal(new Set(rows.map((r) => `${r.missionId}/${r.difficulty}`)).size, 6);
    for (const mission of project.missions)
      for (const difficulty of ['gentle', 'standard', 'expert'])
        assert(rows.some((r) => r.missionId === mission.id && r.difficulty === difficulty));
    for (const row of rows)
      assert.deepEqual(row.outcomes.map((o) => `${o.jointCuts}/${o.swapped}`).sort(), pairs);
  }
});

for (const kind of ['history', 'inner'])
  for (const row of fixture[kind]) {
    const { level, simulationIdentity } = resolveMission(project, row.missionId, {
      mode: 'team',
      difficulty: row.difficulty,
    });
    for (const {
      jointCuts,
      swapped,
      roamerEvents,
      returnEvents,
      roamerModes,
      endpoints,
      ...expected
    } of row.outcomes)
      test(`${kind}/${row.missionId}/${row.difficulty}/joint${jointCuts}/swap${swapped}: exact fresh outcome`, () => {
        assert.equal(simulationIdentity, row.simulationIdentity);
        const delayTicks = kind === 'history' ? (row.source.delayTicks ?? 0) : 0;
        const options = { jointCuts, swapped, delayTicks };
        const actual = assessTeamPressureRoute(level, row.log, options);
        assert.deepEqual(actual, expected);
        const commands = throughTick(
          [...(delayTicks ? [{ a: null, b: null, ticks: delayTicks }] : []), ...row.log],
          actual.tick,
        );
        const played = playTeamFoundationRoute(level, commands, {
          jointCuts,
          swapped,
          inspectGoal: inspectTeamRoamerGoal,
        });
        assert.equal(played.checkpoint, actual.checkpoint);
        assert.deepEqual(
          played.events.filter((e) => e.type.startsWith('rover.')),
          roamerEvents,
        );
        assert.deepEqual(
          played.events.filter((e) => e.type === 'cut.closed'),
          returnEvents,
        );
        assert.deepEqual(
          played.run.enemies
            .filter((e) => e.type === 'claimed-rover')
            .map((e) => ({ id: e.id, mode: e.rover.mode })),
          roamerModes,
        );
        assert.deepEqual(
          played.run.players.map((p) => ({ x: p.x, y: p.y })),
          endpoints,
        );
        if (kind === 'inner') {
          const target = level.safeRects[row.targetFoundationIndex];
          assert.deepEqual(target, row.targetFoundation);
          assert.equal(row.landingInitiallyConnected, false);
          assert.equal(row.landingConnected, true);
          const spawn = level.spawns[row.connectedFromSpawnIndex];
          assert.equal(connected(createCoop(level), spawn, target), false);
          assert.equal(connected(played.run, spawn, target), true);
          assert.equal(connected(played.run, spawn, { x: 0, y: 0 }), false);
          assert.equal(actual.firstDown, null);
          assert.equal(actual.status, 'route-exhausted');
          assert.equal(actual.mastery.achieved, false);
          assert(roamerModes.every((e) => e.mode === 'dormant'));
          assert.equal(roamerEvents.length, 0);
          assert.equal(returnEvents.length, 1);
          assert.equal(returnEvents[0].reason, 'return');
          const endpoint = played.run.players[returnEvents[0].player];
          assert(endpoint.x >= target.x - 1e-9 && endpoint.x <= target.x + target.w + 1e-9);
          assert(endpoint.y >= target.y - 1e-9 && endpoint.y <= target.y + target.h + 1e-9);
          assert.equal(
            returnEvents[0].player,
            swapped ? 1 - row.connectedFromSpawnIndex : row.connectedFromSpawnIndex,
          );
        } else {
          const selected = audit.rows.find(
            (r) => r.missionId === row.missionId && r.difficulty === row.difficulty,
          ).selected;
          const original =
            row.difficulty === 'gentle'
              ? old.routes.find(
                  (r) =>
                    r.missionId === row.missionId &&
                    r.difficulty === selected.templateId.split('/').at(-1),
                )
              : pressure.rows.find(
                  (r) => r.missionId === row.missionId && r.difficulty === row.difficulty,
                );
          assert.deepEqual(row.log, original.log);
          if (row.difficulty === 'gentle') assert.equal(delayTicks, selected.delayTicks);
          assert(roamerModes.every((e) => e.mode === 'active'));
          if (row.missionId === 'shared-lookout' && row.difficulty === 'gentle')
            assert.equal(actual.status, 'route-exhausted');
          else {
            assert.equal(actual.status, 'first-knockdown');
            assert.equal(actual.firstDown.cause, 'enemy-player');
            assert(actual.firstDown.enemy.startsWith('roamer-'));
          }
        }
      });
    if (kind === 'inner')
      for (const [index, rejected] of row.rejectedAttempts.entries())
        test(`rejected inner ${row.missionId}/${row.difficulty}/${index}: preserve first down rather than hide it`, () => {
          const actual = assessTeamPressureRoute(level, rejected.log);
          assert.equal(actual.tick, rejected.tick);
          assert.deepEqual(actual.firstDown, rejected.firstDown);
          assert.equal(actual.status, 'first-knockdown');
        });
  }

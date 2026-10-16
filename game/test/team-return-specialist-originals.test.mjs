import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createTeamReturnSpecialistOriginalCandidates,
  TEAM_RETURN_PARTNER_MISSIONS,
  TEAM_STEPPING_SPECIALIST_CAMPAIGN_ID,
  TEAM_SWITCHBACK_SPECIALIST_CAMPAIGN_ID,
} from '../content-design/team-return-specialist-originals.mjs';
import { createTeamMaterialSpecialistOriginalCandidates } from '../content-design/team-material-specialist-originals.mjs';
import { TEAM_FOUNDATION_FIRST_RETURNS } from '../content-design/team-journey-candidates.mjs';
import { createCandidateTeamHost } from '../content-design/team-host.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';
import { createCoop, FIXED_DT, SAFE, startCoop, stepCoop } from '../coop/core.mjs';
import { playTeamFoundationRoute } from './helpers/team-foundation-route.mjs';

const source = createTeamReturnSpecialistOriginalCandidates();
const previous = createTeamMaterialSpecialistOriginalCandidates();
const project = compileContentProject(source);
const changed = new Set(TEAM_RETURN_PARTNER_MISSIONS);
const pressureRoutes = JSON.parse(
  await readFile(new URL('./fixtures/team-pressure-foundation-routes.json', import.meta.url)),
);
const command = (direction) => ({ direction, boost: false, support: false });

test('the return specialist pair preserves maps, pictures and every earlier edition', () => {
  assert.deepEqual(source.maps, previous.maps);
  assert.deepEqual(source.assets, previous.assets);
  assert.deepEqual(
    source.missions.map(({ id }) => id),
    previous.missions.map(({ id }) => id),
  );
  for (const mission of source.missions) {
    const old = previous.missions.find(({ id }) => id === mission.id);
    assert.deepEqual(mission.presentation, old.presentation);
    if (changed.has(mission.id)) {
      assert.equal(mission.revision, source.revision);
      assert.equal(mission.team.format, 'TeamMissionV6');
      assert.deepEqual(mission.team.supportRoles, ['interceptor', 'disruptor']);
      assert(mission.design.practices.includes('complementary-support-roles'));
    } else assert.deepEqual(mission, old);
  }
  assert.deepEqual(createTeamMaterialSpecialistOriginalCandidates(), previous);
});

test('three homogeneous shared-return campaigns retain exact Journey order and direct Next', () => {
  assert.deepEqual(
    source.campaigns.flatMap(({ missionIds }) => missionIds),
    previous.campaigns.flatMap(({ missionIds }) => missionIds),
  );
  assert.deepEqual(
    source.campaigns.find(({ id }) => id === TEAM_STEPPING_SPECIALIST_CAMPAIGN_ID).missionIds,
    ['stepping-exchange'],
  );
  assert.deepEqual(source.campaigns.find(({ id }) => id === 'shared-returns').missionIds, [
    'divided-workshop',
  ]);
  assert.deepEqual(
    source.campaigns.find(({ id }) => id === TEAM_SWITCHBACK_SPECIALIST_CAMPAIGN_ID).missionIds,
    ['switchback-partners'],
  );

  const host = createCandidateTeamHost(source, {
    corePackIds: source.packs.map(({ id }) => id),
  });
  for (const [from, to] of [
    ['twin-landings', 'stepping-exchange'],
    ['stepping-exchange', 'divided-workshop'],
    ['divided-workshop', 'switchback-partners'],
    ['switchback-partners', 'shared-detour'],
  ]) {
    const mission = host.catalog.missions.find(({ levelId }) => levelId === from);
    const destination = host.destination(host.row(mission));
    assert.equal(destination.next.mission.levelId, to);
    assert.equal(destination.crossesCampaign, true);
  }
});

test('only the selected return missions receive v9 specialist simulations', () => {
  const prior = compileContentProject(previous);
  for (const mission of source.missions)
    for (const difficulty of ['gentle', 'standard', 'expert']) {
      const actual = resolveMission(project, mission.id, { mode: 'team', difficulty });
      const old = resolveMission(prior, mission.id, { mode: 'team', difficulty });
      if (changed.has(mission.id)) {
        assert.equal(actual.level.version, 'revealline-coop-level.v7');
        assert.deepEqual(actual.level.supportRoles, ['interceptor', 'disruptor']);
        assert.equal(
          createTeamTestPack(source, mission.id, difficulty).ruleset,
          'revealline-coop.v9',
        );
        assert.notEqual(actual.simulationIdentity, old.simulationIdentity);
      } else {
        assert.deepEqual(actual.level, old.level);
        assert.equal(actual.simulationIdentity, old.simulationIdentity);
      }
    }
});

test('recorded shared-return routes remain deterministic two-pilot clears', () => {
  const rows = pressureRoutes.rows.filter(({ missionId }) => changed.has(missionId));
  assert.deepEqual(
    rows.map(({ missionId, difficulty }) => `${missionId}/${difficulty}`),
    ['stepping-exchange/standard', 'stepping-exchange/expert', 'switchback-partners/standard'],
  );
  for (const row of rows) {
    const level = resolveMission(project, row.missionId, {
      mode: 'team',
      difficulty: row.difficulty,
    }).level;
    for (const { jointCuts, swapped } of row.outcomes.slice(0, 4)) {
      const options = { jointCuts, swapped };
      const first = playTeamFoundationRoute(level, row.log, options);
      const repeat = playTeamFoundationRoute(level, row.log, options);
      assert.equal(first.checkpoint, repeat.checkpoint);
      assert.equal(first.run.status, 'won');
      assert.equal(first.evidence.downs, 0);
      assert.deepEqual([...first.evidence.closed].sort(), [0, 1]);
      assert(first.run.coverage >= level.goal.coverage);
    }
  }
});

test('all presets, spawn orders, seeds and joint-cut settings preserve a safe simultaneous first return', () => {
  for (const missionId of TEAM_RETURN_PARTNER_MISSIONS)
    for (const difficulty of ['gentle', 'standard', 'expert'])
      for (const swapped of [false, true])
        for (const jointCuts of [false, true])
          for (const seed of [1, 7, 19]) {
            const resolved = resolveMission(project, missionId, { mode: 'team', difficulty }).level;
            const level = structuredClone(resolved);
            const directions = [...TEAM_FOUNDATION_FIRST_RETURNS[missionId]];
            if (swapped) {
              level.spawns.reverse();
              directions.reverse();
            }

            const idle = startCoop(createCoop(level, { seed, jointCuts }));
            const positions = idle.players.map(({ x, y }) => [x, y]);
            for (let tick = 0; tick < 5 / FIXED_DT; tick++) {
              stepCoop(idle, [command(null), command(null)]);
              assert(!idle.events.some(({ type }) => type === 'player.downed'));
            }
            assert.equal(idle.coverage, 0);
            assert.deepEqual(
              idle.players.map(({ x, y }) => [x, y]),
              positions,
            );

            const run = startCoop(createCoop(level, { seed, jointCuts }));
            const closed = new Set();
            let simultaneousTicks = 0;
            for (let tick = 0; tick < 800 && closed.size < 2 && run.status === 'running'; tick++) {
              stepCoop(
                run,
                directions.map((direction, seat) => command(closed.has(seat) ? null : direction)),
              );
              if (run.players.every(({ cutting }) => cutting)) simultaneousTicks++;
              assert(!run.events.some(({ type }) => type === 'player.downed'));
              for (const event of run.events)
                if (event.type === 'cut.closed') closed.add(event.player);
            }
            assert.deepEqual([...closed].sort(), [0, 1]);
            assert(simultaneousTicks > 0);
            assert(run.coverage > 0 && run.coverage < level.goal.coverage);
            assert(
              run.players.every(
                (player) => !player.cutting && run.cells[player.cellIndex] === SAFE,
              ),
            );
          }
});

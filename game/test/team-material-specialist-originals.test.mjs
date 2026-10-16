import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createTeamMaterialSpecialistOriginalCandidates,
  TEAM_MATERIAL_PARTNER_MISSIONS,
} from '../content-design/team-material-specialist-originals.mjs';
import { createTeamPartnerSpecialistOriginalCandidates } from '../content-design/team-partner-specialist-originals.mjs';
import { createCandidateTeamHost } from '../content-design/team-host.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';
import { createCoop, FIXED_DT, startCoop, stepCoop } from '../coop/core.mjs';
import { useSupport } from '../coop/threats.mjs';
import { playTeamFoundationRoute } from './helpers/team-foundation-route.mjs';
import { inspectTeamMaterialGoal } from './helpers/team-material-goal.mjs';

const source = createTeamMaterialSpecialistOriginalCandidates();
const previous = createTeamPartnerSpecialistOriginalCandidates();
const project = compileContentProject(source);
const changed = new Set(TEAM_MATERIAL_PARTNER_MISSIONS);
const materialRoutes = JSON.parse(
  await readFile(new URL('./fixtures/team-material-routes.json', import.meta.url)),
);
const neutral = { direction: null, boost: false, support: false };

test('the second specialist pair preserves every accepted map, picture and historical edition', () => {
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
      assert(mission.design.combines.includes('complementary-support-roles'));
    } else assert.deepEqual(mission, old);
  }
  assert.deepEqual(createTeamPartnerSpecialistOriginalCandidates(), previous);
});

test('the material pair occupies one homogeneous V6 campaign without changing Journey order', () => {
  assert.deepEqual(
    source.campaigns.flatMap(({ missionIds }) => missionIds),
    previous.campaigns.flatMap(({ missionIds }) => missionIds),
  );
  const owner = source.campaigns.find(({ id }) => id === 'shared-material-routes');
  assert.deepEqual(owner.missionIds, TEAM_MATERIAL_PARTNER_MISSIONS);
  assert.equal(owner.revision, source.revision);

  const host = createCandidateTeamHost(source, {
    corePackIds: source.packs.map(({ id }) => id),
  });
  for (const [from, to, crossesCampaign] of [
    ['crossed-gardens', 'split-orchards', true],
    ['split-orchards', 'weaver-crossing', false],
    ['weaver-crossing', 'shared-lookout', true],
  ]) {
    const mission = host.catalog.missions.find(({ levelId }) => levelId === from);
    const destination = host.destination(host.row(mission));
    assert.equal(destination.next.mission.levelId, to);
    assert.equal(destination.crossesCampaign, crossesCampaign);
  }
});

test('only the selected pair receives new simulation identities and v9 packs', () => {
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

test('Split orchards keeps a deterministic two-contributor material route after specialization', () => {
  const row = materialRoutes.routes.find(
    ({ missionId, difficulty }) => missionId === 'split-orchards' && difficulty === 'gentle',
  );
  const level = resolveMission(project, row.missionId, {
    mode: 'team',
    difficulty: row.difficulty,
  }).level;
  for (const jointCuts of [false, true])
    for (const swapped of [false, true]) {
      const options = { jointCuts, swapped, inspectGoal: inspectTeamMaterialGoal };
      const first = playTeamFoundationRoute(level, row.log, options);
      const repeat = playTeamFoundationRoute(level, row.log, options);
      assert.equal(first.checkpoint, repeat.checkpoint);
      assert.equal(first.run.status, 'running', 'the route is an opening, not a forced clear');
      assert.equal(first.evidence.downs, 0);
      assert.deepEqual([...first.evidence.closed].sort(), [0, 1]);
      assert.deepEqual(first.mastery.neutralized.sort(), ['east-orchard', 'west-orchard']);
      assert(first.run.coverage > 0.7);
    }
});

for (const missionId of TEAM_MATERIAL_PARTNER_MISSIONS)
  test(`${missionId}: the two specialist actions remain complementary`, () => {
    const level = resolveMission(project, missionId, {
      mode: 'team',
      difficulty: 'standard',
    }).level;
    const run = createCoop(level);
    const [interceptor, disruptor] = run.players;
    const enemy = run.enemies[0];
    const events = [];
    const emit = (_run, type, detail) => events.push({ type, ...detail });

    Object.assign(enemy, { x: interceptor.x + 1, y: interceptor.y, slowUntil: 0, speedScale: 1 });
    run.impacts = [{ id: 51, player: 0, owner: enemy.id, x: interceptor.x + 1, y: interceptor.y }];
    useSupport(run, interceptor, emit);
    assert.equal(run.impacts.length, 0);
    assert.equal(enemy.speedScale, 1);

    Object.assign(enemy, { x: disruptor.x + 1, y: disruptor.y, slowUntil: 0, speedScale: 1 });
    run.impacts = [{ id: 52, player: 1, owner: enemy.id, x: disruptor.x + 1, y: disruptor.y }];
    useSupport(run, disruptor, emit);
    assert.deepEqual(
      run.impacts.map(({ id }) => id),
      [52],
    );
    assert.equal(enemy.speedScale, 0.5);
    assert.deepEqual(
      events
        .filter(({ type }) => type === 'support.pulse')
        .map(({ role, slowedEnemies, interceptedImpacts }) => ({
          role,
          slowedEnemies,
          interceptedImpacts,
        })),
      [
        { role: 'interceptor', slowedEnemies: [], interceptedImpacts: [51] },
        { role: 'disruptor', slowedEnemies: [enemy.id], interceptedImpacts: [] },
      ],
    );
  });

test('all presets, spawn swaps and deterministic seeds keep both openings pressure-free', () => {
  for (const missionId of TEAM_MATERIAL_PARTNER_MISSIONS)
    for (const difficulty of ['gentle', 'standard', 'expert'])
      for (const swapped of [false, true])
        for (const seed of [1, 7, 19]) {
          const resolved = resolveMission(project, missionId, { mode: 'team', difficulty }).level;
          const level = structuredClone(resolved);
          if (swapped) level.spawns.reverse();
          const run = startCoop(createCoop(level, { seed }));
          const positions = run.players.map(({ x, y }) => [x, y]);
          for (let tick = 0; tick < 5 / FIXED_DT; tick++) {
            stepCoop(run, [neutral, neutral]);
            assert(
              !run.events.some(({ type }) => type === 'player.downed' || type === 'rover.warning'),
            );
          }
          assert.equal(run.status, 'running');
          assert.equal(run.coverage, 0);
          assert.deepEqual(
            run.players.map(({ x, y }) => [x, y]),
            positions,
          );
        }
});

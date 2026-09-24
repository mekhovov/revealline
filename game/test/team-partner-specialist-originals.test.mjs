import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createTeamPartnerSpecialistOriginalCandidates,
  TEAM_MATERIAL_SPECIALIST_CAMPAIGN_ID,
  TEAM_PARTNER_SPECIALIST_MISSIONS,
} from '../content-design/team-partner-specialist-originals.mjs';
import { createTeamSpecialistOriginalCandidates } from '../content-design/team-specialist-originals.mjs';
import { createCandidateTeamHost } from '../content-design/team-host.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';
import { createCoop, FIXED_DT, startCoop, stepCoop } from '../coop/core.mjs';
import { useSupport } from '../coop/threats.mjs';
import { measureTeamPartnerReturns } from './helpers/team-partner-return.mjs';

const source = createTeamPartnerSpecialistOriginalCandidates();
const previous = createTeamSpecialistOriginalCandidates();
const project = compileContentProject(source);
const changed = new Set(TEAM_PARTNER_SPECIALIST_MISSIONS);
const partnerReturns = JSON.parse(
  await readFile(new URL('./fixtures/team-partner-return-routes.json', import.meta.url)),
);
const neutral = { direction: null, boost: false, support: false };

test('two partner-action successors preserve maps, pictures and every historical project', () => {
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
      assert(mission.design.combines.includes('complementary-support-roles'));
    } else if (mission.id === 'twin-depots') {
      assert.deepEqual(
        { ...mission, design: old.design },
        old,
        'only the learning annotation advances after the earlier introduction',
      );
      assert(!mission.design.introduces.includes('complementary-support-roles'));
      assert(mission.design.practices.includes('complementary-support-roles'));
    } else assert.deepEqual(mission, old);
  }
  assert.deepEqual(createTeamSpecialistOriginalCandidates(), previous);
});

test('homogeneous campaign boundaries retain journey order and cross them directly with Next', () => {
  assert.deepEqual(
    source.campaigns.flatMap(({ missionIds }) => missionIds),
    previous.campaigns.flatMap(({ missionIds }) => missionIds),
  );
  const material = source.campaigns.find(({ id }) => id === TEAM_MATERIAL_SPECIALIST_CAMPAIGN_ID);
  assert.deepEqual(material.missionIds, ['crossed-gardens']);
  assert.deepEqual(source.campaigns.find(({ id }) => id === 'shared-material-routes').missionIds, [
    'split-orchards',
    'weaver-crossing',
  ]);
  assert.deepEqual(source.campaigns.find(({ id }) => id === 'changing-common-ground').missionIds, [
    'shared-lookout',
  ]);

  const host = createCandidateTeamHost(source, {
    corePackIds: source.packs.map(({ id }) => id),
  });
  for (const [from, to] of [
    ['shared-detour', 'crossed-gardens'],
    ['crossed-gardens', 'split-orchards'],
    ['shared-lookout', 'twin-depots'],
  ]) {
    const mission = host.catalog.missions.find(({ levelId }) => levelId === from);
    const destination = host.destination(host.row(mission));
    assert.equal(destination.next.mission.levelId, to);
    assert.equal(destination.crossesCampaign, true);
  }
});

test('only the two selected simulations adopt the v9 complementary-role runtime', () => {
  for (const mission of source.missions) {
    for (const difficulty of ['gentle', 'standard', 'expert']) {
      const actual = resolveMission(project, mission.id, { mode: 'team', difficulty });
      const old = resolveMission(compileContentProject(previous), mission.id, {
        mode: 'team',
        difficulty,
      });
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
  }
});

test('Shared lookout deterministically lets both pilots bank on ground earned by the partner', () => {
  for (const row of partnerReturns.rows) {
    const level = resolveMission(project, 'shared-lookout', {
      mode: 'team',
      difficulty: row.difficulty,
    }).level;
    for (const { options } of row.outcomes) {
      const first = measureTeamPartnerReturns(level, row.log, options);
      const repeat = measureTeamPartnerReturns(level, row.log, options);
      assert.equal(first.firstDown, null);
      assert.equal(first.status, 'running');
      assert.equal(first.checkpoint, repeat.checkpoint);
      assert.deepEqual(
        first.returns
          .filter(({ partnerReturn }) => partnerReturn)
          .map(({ player }) => player)
          .sort(),
        [0, 1],
      );
      for (const event of first.returns.filter(({ partnerReturn }) => partnerReturn)) {
        assert.equal(event.previousOwner, 1 - event.player);
        assert(event.acquiredTick < event.tick);
      }
    }
  }
});

test('Crossed gardens gives pressure protection and enemy control to different seats', () => {
  const level = resolveMission(project, 'crossed-gardens', {
    mode: 'team',
    difficulty: 'standard',
  }).level;
  const run = createCoop(level);
  const [interceptor, disruptor] = run.players;
  const enemy = run.enemies[0];
  const events = [];
  const emit = (_run, type, detail) => events.push({ type, ...detail });

  Object.assign(enemy, { x: interceptor.x + 1, y: interceptor.y, slowUntil: 0, speedScale: 1 });
  run.impacts = [{ id: 41, player: 0, owner: enemy.id, x: interceptor.x + 1, y: interceptor.y }];
  useSupport(run, interceptor, emit);
  assert.equal(run.impacts.length, 0);
  assert.equal(enemy.speedScale, 1);

  Object.assign(enemy, { x: disruptor.x + 1, y: disruptor.y, slowUntil: 0, speedScale: 1 });
  run.impacts = [{ id: 42, player: 1, owner: enemy.id, x: disruptor.x + 1, y: disruptor.y }];
  useSupport(run, disruptor, emit);
  assert.deepEqual(
    run.impacts.map(({ id }) => id),
    [42],
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
      { role: 'interceptor', slowedEnemies: [], interceptedImpacts: [41] },
      { role: 'disruptor', slowedEnemies: [enemy.id], interceptedImpacts: [] },
    ],
  );
});

test('both successor openings remain free of unavoidable pressure at every preset and seed', () => {
  for (const missionId of TEAM_PARTNER_SPECIALIST_MISSIONS)
    for (const difficulty of ['gentle', 'standard', 'expert'])
      for (const seed of [1, 7, 19]) {
        const level = resolveMission(project, missionId, { mode: 'team', difficulty }).level;
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

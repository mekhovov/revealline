import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTeamSpecialistOriginalCandidates,
  TEAM_SPECIALIST_CAMPAIGN_ID,
  TEAM_SPECIALIST_MISSIONS,
} from '../content-design/team-specialist-originals.mjs';
import { createTeamImpactOriginalCandidates } from '../content-design/team-impact-originals.mjs';
import { createCandidateTeamHost } from '../content-design/team-host.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';
import { createCoop, getCoopSummary } from '../coop/core.mjs';
import { useSupport } from '../coop/threats.mjs';
import { coopArenaGuidance } from '../couch/coop-briefing.mjs';

const source = createTeamSpecialistOriginalCandidates();
const previous = createTeamImpactOriginalCandidates();
const project = compileContentProject(source);
const changed = new Set(TEAM_SPECIALIST_MISSIONS);

test('specialist successor keeps hybrid missions intact and authors a homogeneous final campaign', () => {
  assert.equal(source.missions.length, 12);
  assert.deepEqual(source.maps, previous.maps);
  assert.deepEqual(source.assets, previous.assets);
  for (const mission of source.missions) {
    const old = previous.missions.find((candidate) => candidate.id === mission.id);
    if (changed.has(mission.id)) {
      assert.equal(mission.team.format, 'TeamMissionV6');
      assert.deepEqual(mission.team.supportRoles, ['interceptor', 'disruptor']);
      assert(mission.design.combines.includes('complementary-support-roles'));
    } else assert.deepEqual(mission, old);
  }
  assert.equal(source.campaigns.length, previous.campaigns.length + 1);
  const priorOwner = previous.campaigns.find((row) => row.missionIds.includes('shared-lookout'));
  const hybridOwner = source.campaigns.find((row) => row.id === priorOwner.id);
  const specialistOwner = source.campaigns.find((row) => row.id === TEAM_SPECIALIST_CAMPAIGN_ID);
  assert.deepEqual(hybridOwner.missionIds, ['shared-lookout']);
  assert.deepEqual(specialistOwner.missionIds, TEAM_SPECIALIST_MISSIONS);
  assert.equal(hybridOwner.revision, source.revision);
  assert.equal(specialistOwner.revision, source.revision);
  assert.equal(
    source.packs.filter(
      (row) => row.revision !== previous.packs.find((old) => old.id === row.id).revision,
    ).length,
    1,
  );
  const pack = source.packs.find((row) => row.campaignIds.includes(TEAM_SPECIALIST_CAMPAIGN_ID));
  assert.deepEqual(pack.campaignIds.slice(-2), [hybridOwner.id, specialistOwner.id]);
  assert.deepEqual(createTeamImpactOriginalCandidates(), previous);
});

test('specialist manifests use a distinct v9 runtime without reinterpreting hybrid missions', () => {
  for (const mission of source.missions) {
    const manifest = resolveMission(project, mission.id, { mode: 'team', difficulty: 'standard' });
    assert.equal(
      manifest.level.version,
      changed.has(mission.id) ? 'revealline-coop-level.v7' : 'revealline-coop-level.v6',
    );
    assert.equal(
      manifest.level.supportRoles?.join('/') ?? 'hybrid',
      changed.has(mission.id) ? 'interceptor/disruptor' : 'hybrid',
    );
    assert.equal(
      createTeamTestPack(source, mission.id, 'standard').ruleset,
      changed.has(mission.id) ? 'revealline-coop.v9' : 'revealline-coop.v8',
    );
  }
});

test('the real candidate host starts and Next crosses into the homogeneous specialist campaign', () => {
  const host = createCandidateTeamHost(source, {
    corePackIds: source.packs.map((pack) => pack.id),
  });
  const lookout = host.catalog.missions.find((mission) => mission.levelId === 'shared-lookout');
  const specialist = host.catalog.missions.find((mission) => mission.levelId === 'twin-depots');
  assert(lookout);
  assert(specialist);
  const destination = host.destination(host.row(lookout));
  assert.equal(destination.next.mission, specialist);
  assert.equal(destination.crossesCampaign, true);
  assert.equal(destination.next.pack.version, 'revealline-coop-pack.v7');
  assert.equal(destination.next.level.version, 'revealline-coop-level.v7');
  assert.equal(host.row(lookout).pack.version, 'revealline-coop-pack.v6');
});

test('Interceptor removes impacts but cannot slow; Disruptor slows but cannot intercept', () => {
  const manifest = resolveMission(project, TEAM_SPECIALIST_MISSIONS[0], {
    mode: 'team',
    difficulty: 'standard',
  });
  const run = createCoop(manifest.level);
  const [interceptor, disruptor] = run.players;
  const enemy = run.enemies.find((candidate) => Math.hypot(candidate.vx, candidate.vy) > 0);
  Object.assign(enemy, { x: interceptor.x + 1, y: interceptor.y, slowUntil: 0, speedScale: 1 });
  const events = [];
  const emit = (_run, type, detail) => events.push({ type, ...detail });
  run.impacts = [{ id: 1, player: 0, owner: 'keeper', x: interceptor.x + 1, y: interceptor.y }];
  useSupport(run, interceptor, emit);
  assert.equal(run.impacts.length, 0);
  assert.equal(enemy.speedScale, 1);
  assert.deepEqual(events.at(-1), {
    type: 'support.pulse',
    player: 0,
    role: 'interceptor',
    slowedEnemies: [],
    interceptedImpacts: [1],
  });

  Object.assign(enemy, { x: disruptor.x + 1, y: disruptor.y, slowUntil: 0, speedScale: 1 });
  run.impacts = [{ id: 2, player: 1, owner: 'keeper', x: disruptor.x + 1, y: disruptor.y }];
  useSupport(run, disruptor, emit);
  assert.equal(run.impacts.length, 1);
  assert.equal(enemy.speedScale, 0.5);
  assert.deepEqual(events.at(-1), {
    type: 'support.pulse',
    player: 1,
    role: 'disruptor',
    slowedEnemies: [enemy.id],
    interceptedImpacts: [],
  });
  assert.deepEqual(
    getCoopSummary(run).players.map(({ supportRole }) => supportRole),
    ['interceptor', 'disruptor'],
  );
  assert.deepEqual(
    run.supportEffects.map(({ role }) => role),
    ['interceptor', 'disruptor'],
  );
});

test('specialist authoring fails closed and briefing names both complementary jobs', () => {
  for (const roles of [undefined, ['interceptor', 'interceptor'], ['hybrid', 'disruptor']]) {
    const invalid = createTeamSpecialistOriginalCandidates();
    const mission = invalid.missions.find(({ id }) => id === TEAM_SPECIALIST_MISSIONS[0]);
    if (roles === undefined) delete mission.team.supportRoles;
    else mission.team.supportRoles = roles;
    assert.throws(() => compileContentProject(invalid), /Interceptor and one Disruptor/);
  }
  const level = resolveMission(project, TEAM_SPECIALIST_MISSIONS[0], {
    mode: 'team',
    difficulty: 'standard',
  }).level;
  const guidance = coopArenaGuidance(level);
  assert.match(guidance.supportText, /Interceptor Support removes/);
  assert.match(guidance.supportText, /Disruptor Support slows/);
  assert.deepEqual(guidance.supportBySeat, [
    'Interceptor · removes nearby travelling impacts',
    'Disruptor · slows nearby enemies',
  ]);
});

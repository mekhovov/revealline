import test from 'node:test';
import assert from 'node:assert/strict';
import { createPursuitCampaignCandidates } from '../content-design/pursuit-campaign-candidates.mjs';
import { createContentExecutionCatalog } from '../content-design/execution.mjs';
import { compileContentProject } from '../content-design/project.mjs';
import { loadAuthoredJourneyRoute } from '../content-design/route-loader.mjs';
import { prepareRunningEnemyLevel, runningEnemyBaseLevel } from '../hunt/running-enemies.mjs';
import {
  prepareTeamRunningEnemies,
  teamRunningEnemyBaseLevel,
} from '../hunt/team-running-enemies.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { dataIdentity } from '../data-json.mjs';

test('sixty explicitly authored drafts keep unique geometry and goal circuits across all native modes', async () => {
  const geometries = new Set();
  for (const team of [false, true]) {
    const source = createPursuitCampaignCandidates({ team });
    assert.equal(source.missions.length, team ? 36 : 24);
    assert.ok(source.campaigns.every(({ missionIds }) => missionIds.length === 6));
    assert.deepEqual(compileContentProject(structuredClone(source)).source, source);
    for (const map of source.maps) {
      const key = dataIdentity({ walls: map.walls, foundations: map.foundations });
      assert.equal(geometries.has(key), false, map.id);
      geometries.add(key);
    }
    for (const mode of team ? ['team'] : ['solo', 'versus']) {
      const catalog = createContentExecutionCatalog(source, { mode });
      for (const entry of catalog.entries)
        for (const level of entry.campaign.levels) {
          const tuned = applyGameplayTuning(level, resolveGameplayTuning(entry.difficulty));
          assert.equal(tuned.pursuit.version, 'pursuit-goals.v1');
          const prepare = team ? prepareTeamRunningEnemies : prepareRunningEnemyLevel;
          assert.deepEqual(
            prepare(tuned, { style: 'original' }),
            tuned,
            'An authored pursuit mission retains its accepted policies.',
          );
        }
    }
  }
  assert.equal(geometries.size, 60);
  assert.equal((await loadAuthoredJourneyRoute('pursuit-campaigns-v1')).source.missions.length, 24);
});

test('specialist chapter is explicit and workshop challenges use required native anchors and core', () => {
  const solo = createPursuitCampaignCandidates(),
    team = createPursuitCampaignCandidates({ team: true });
  const special = solo.campaigns.find(({ id }) => id === 'pursuit-specialist-circuit');
  assert.equal(special.missionIds.length, 6);
  for (const id of special.missionIds)
    assert.ok(
      solo.missions
        .find((m) => m.id === id)
        .pursuit.actors.some((a) => ['shield', 'brace'].includes(a.behavior)),
    );
  const catalog = createContentExecutionCatalog(team, { mode: 'team' });
  const workshop = catalog.entries.find(
    (entry) =>
      entry.campaignId === 'pursuit-team-return-workshop' && entry.difficulty === 'standard',
  );
  assert.equal(workshop.campaign.levels.length, 6);
  for (const level of workshop.campaign.levels) {
    assert.deepEqual(level.goal.cores, ['workshop-core']);
    assert.equal(level.strongholds[0].anchors.length, 2);
    assert.equal(teamRunningEnemyBaseLevel(level).version, 'revealline-coop-level.v2');
  }
});

test('varied authored guard recipes preserve all guards, targets and ordinary quota authority', () => {
  const source = createPursuitCampaignCandidates(),
    catalog = createContentExecutionCatalog(source, { mode: 'solo' });
  const guardLevel = catalog.entries.find(
    (entry) => entry.campaignId === 'pursuit-guarded-crossings' && entry.difficulty === 'standard',
  ).campaign.levels[0];
  const base = runningEnemyBaseLevel(guardLevel);
  assert.equal(guardLevel.runningEnemies.version, 'running-enemies.v2');
  assert.deepEqual(guardLevel.runningEnemies.hunt, base.classic.hunt);
  assert.deepEqual(guardLevel.runningEnemies.combatPatrols, base.classic.combatPatrols);
  assert.equal(base.classic.hunt.targets.filter(({ kind }) => kind === 'guard').length, 1);
});

test('three pilots teach optional courier interception and a real cooperative core objective', async () => {
  const { createPursuitPilotCandidates } = await import(
    '../content-design/pursuit-pilot-candidates.mjs'
  );
  const solo = createPursuitPilotCandidates(),
    team = createPursuitPilotCandidates({ team: true });
  const crossing = createContentExecutionCatalog(solo, { mode: 'solo' }).entries.find(
    (entry) => entry.difficulty === 'standard',
  ).campaign.levels[0];
  assert.ok(crossing.pursuit.actors.some(({ behavior }) => behavior === 'courier'));
  assert.equal(crossing.runningEnemies.hunt.mode, 'bonus');
  assert.equal(crossing.runningEnemies.hunt.quota, 0);
  const relay = createContentExecutionCatalog(team, { mode: 'team' })
    .entries.find((entry) => entry.difficulty === 'standard')
    .campaign.levels.find(({ id }) => id === 'relay-rendezvous');
  assert.deepEqual(relay.goal.cores, ['workshop-core']);
  assert.equal(relay.strongholds[0].anchors.length, 2);
  assert.ok(relay.pursuit.actors.every(({ behavior }) => behavior === 'pair'));
});

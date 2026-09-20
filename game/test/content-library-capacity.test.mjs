import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterProject } from '../content-design/starter.mjs';
import { createTeamOpeningCandidates } from '../content-design/team-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import {
  CONTENT_PROJECT_JSON_LIMITS,
  CONTENT_PROJECT_ITEM_LIMITS,
} from '../content-design/limits.mjs';
import {
  createDraftHistory,
  createContentDraftBackend,
  forkMissionMap,
} from '../content-design/drafts.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';

// Repeated fixtures exercise registry capacity only. They are never exported to
// the playable library or counted as original released missions.
function libraryFixture() {
  const source = createStarterProject('capacity-fixture'),
    team = createTeamOpeningCandidates();
  source.maps.push(...team.maps);
  const soloTemplate = source.missions[0],
    teamTemplate = team.missions[0];
  source.missions = [];
  source.campaigns = [];
  source.packs = [];
  for (const [kind, total, template] of [
    ['core', 242, soloTemplate],
    ['remix', 12, soloTemplate],
    ['team', 12, teamTemplate],
  ]) {
    for (let band = 1; band <= 12; band++) {
      const id = `${kind}-${band}`,
        count = Math.floor(total / 12) + (band <= total % 12 ? 1 : 0),
        missionIds = [];
      for (let n = 0; n < count; n++) {
        const mission = structuredClone(template);
        mission.id = `${id}-${n}`;
        mission.name = `Capacity fixture ${mission.id}`;
        mission.design.difficulty.band = band;
        source.missions.push(mission);
        missionIds.push(mission.id);
      }
      source.campaigns.push({
        format: 'CampaignDesignV1',
        id,
        revision: '1',
        name: id,
        band,
        missionIds,
      });
      source.packs.push({ format: 'PackDesignV1', id, revision: '1', name: id, campaignIds: [id] });
    }
  }
  return source;
}

test('planned mixed-mode candidate scale fits compiler, immutable draft recovery and shared-map editing', async () => {
  const source = libraryFixture(),
    before = structuredClone(source);
  assert.equal(source.missions.length, 266);
  assert.equal(source.campaigns.length, 36);
  assert.equal(source.packs.length, 36);
  assert(Buffer.byteLength(JSON.stringify(source)) < CONTENT_PROJECT_JSON_LIMITS.maxBytes);
  const project = compileContentProject(source);
  assert.equal(project.missions.filter((m) => m.modes.includes('solo')).length, 254);
  assert.equal(project.missions.filter((m) => m.modes.includes('team')).length, 12);
  for (const id of ['core-12-19', 'remix-12-0', 'team-12-0']) {
    const mission = project.missions.find((m) => m.id === id);
    for (const difficulty of ['gentle', 'standard', 'expert'])
      for (const mode of mission.modes)
        assert.equal(
          resolveMission(project, id, { difficulty, mode }).officialProgressEligible,
          false,
        );
  }
  const history = createDraftHistory(source, { limit: 2 });
  const changed = forkMissionMap(source, 'core-1-0', { name: 'Independent candidate map' });
  assert.equal(changed.maps.length, source.maps.length + 1);
  assert.deepEqual(
    changed.missions.find((m) => m.id === 'core-1-1'),
    source.missions.find((m) => m.id === 'core-1-1'),
  );
  history.replace(changed);
  assert.deepEqual(history.undo(), source);
  assert.deepEqual(history.redo(), changed);
  assert.deepEqual(JSON.parse(history.export()), changed);
  const backend = createContentDraftBackend(managedIndexedDB());
  await backend.save(source, null);
  await backend.save(changed, 1);
  assert.deepEqual((await backend.read(source.id, 1)).project, source);
  assert.deepEqual((await backend.read(source.id)).project, changed);
  assert.deepEqual(source, before);
});

test('larger item capacity retains finite structural budgets and refuses excess without mutating input', () => {
  assert.deepEqual(CONTENT_PROJECT_JSON_LIMITS, {
    maxBytes: 4194304,
    maxNodes: 100000,
    maxDepth: 20,
    maxArray: 512,
  });
  for (const kind of ['missions', 'campaigns', 'packs']) {
    const source = createStarterProject(),
      template = source[kind][0];
    source[kind] = Array.from({ length: CONTENT_PROJECT_ITEM_LIMITS[kind] + 1 }, (_, n) => ({
      ...structuredClone(template),
      id: `item-${n}`,
    }));
    const before = structuredClone(source);
    assert.throws(
      () => compileContentProject(source),
      new RegExp(`${kind} exceeds its item budget`),
    );
    assert.deepEqual(source, before);
  }
});

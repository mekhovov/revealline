import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterProject } from '../content-design/starter.mjs';
import { createTeamOpeningCandidates } from '../content-design/team-candidates.mjs';
import { HORIZON_ART_CANDIDATES } from '../content-design/horizon-art.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createDraftHistory } from '../content-design/drafts.mjs';
import { editContentActor } from '../content-design/actors.mjs';
import {
  prepareCombatAuthoring,
  setMissionCombatEnabled,
} from '../content-design/combat-authoring.mjs';

const missionId = 'nearby-shore';
function fixture() {
  const source = createStarterProject();
  source.assets = structuredClone(HORIZON_ART_CANDIDATES.slice(0, 1));
  source.missions.push({ ...structuredClone(source.missions[0]), id: 'unrelated-mission' });
  source.campaigns.push(
    { ...structuredClone(source.campaigns[0]), id: 'second-parent' },
    {
      ...structuredClone(source.campaigns[0]),
      id: 'unrelated-campaign',
      missionIds: ['unrelated-mission'],
    },
  );
  source.packs.push(
    {
      ...structuredClone(source.packs[0]),
      id: 'second-pack',
      campaignIds: ['second-parent', 'unrelated-campaign'],
    },
    {
      ...structuredClone(source.packs[0]),
      id: 'unrelated-pack',
      campaignIds: ['unrelated-campaign'],
    },
  );
  return source;
}
const mission = (source) => source.missions.find((entry) => entry.id === missionId);
const resolve = (source, id = missionId, options = {}) =>
  resolveMission(compileContentProject(source), id, options);
const optional = (role = 'optional-scout') => ({
  id: role,
  role,
  tier: 'measured',
  x: role === 'optional-sentry' ? 16.5 : 8.5,
  y: 8.5,
  heading: [1, 1],
});
function add(source, role) {
  const actor = optional(role);
  return editContentActor(source, missionId, { action: 'add', id: actor.id, actor });
}
function revisionScope(before, after) {
  assert.notEqual(after.revision, before.revision);
  assert.notEqual(mission(after).revision, mission(before).revision);
  for (const id of ['horizon-school', 'second-parent'])
    assert.notEqual(
      after.campaigns.find((entry) => entry.id === id).revision,
      before.campaigns.find((entry) => entry.id === id).revision,
    );
  for (const id of ['opening', 'second-pack'])
    assert.notEqual(
      after.packs.find((entry) => entry.id === id).revision,
      before.packs.find((entry) => entry.id === id).revision,
    );
  for (const [key, id] of [
    ['missions', 'unrelated-mission'],
    ['campaigns', 'unrelated-campaign'],
    ['packs', 'unrelated-pack'],
  ])
    assert.deepEqual(
      after[key].find((entry) => entry.id === id),
      before[key].find((entry) => entry.id === id),
    );
  assert.deepEqual(after.maps, before.maps);
  assert.deepEqual(after.assets, before.assets);
}
function withoutEdition(source) {
  const value = structuredClone(source);
  delete value.revision;
  delete value.combat;
  return value;
}

test('prepare is a deterministic private catalogue upgrade with one disabled mission and scoped revisions', () => {
  const source = fixture(),
    snapshot = structuredClone(source);
  const next = prepareCombatAuthoring(source, missionId);
  assert.deepEqual(source, snapshot);
  assert.deepEqual(prepareCombatAuthoring(source, missionId), next);
  assert.equal(source.actorCatalogId, 'journey-actors-v1');
  assert.equal(next.actorCatalogId, 'journey-actors-v8');
  assert.deepEqual(mission(next).combat, { version: 'mission-combat.v1', enabled: false });
  assert.deepEqual(withoutEdition(mission(next)), withoutEdition(mission(source)));
  assert.equal(next.missions[1].combat, undefined);
  revisionScope(source, next);
  assert.notEqual(next.maps, source.maps);
  assert.notEqual(next.missions[0].actors, source.missions[0].actors);
});

test('preparing a prepared mission and setting its current state are exact owned no-ops', () => {
  const prepared = prepareCombatAuthoring(fixture(), missionId);
  for (const source of [prepared, setMissionCombatEnabled(prepared, missionId, true)]) {
    const snapshot = structuredClone(source);
    const again = prepareCombatAuthoring(source, missionId);
    const unchanged = setMissionCombatEnabled(source, missionId, mission(source).combat.enabled);
    assert.deepEqual(again, source);
    assert.deepEqual(unchanged, source);
    assert.notEqual(again, source);
    assert.notEqual(unchanged, source);
    again.maps[0].name = 'private copy';
    assert.deepEqual(source, snapshot);
  }
});

test('on/off retains descriptors and unrelated content while reversal creates a new edition', () => {
  const prepared = add(
    add(prepareCombatAuthoring(fixture(), missionId), 'optional-scout'),
    'optional-sentry',
  );
  const before = structuredClone(prepared);
  const enabled = setMissionCombatEnabled(prepared, missionId, true);
  const disabled = setMissionCombatEnabled(enabled, missionId, false);
  assert.deepEqual(prepared, before);
  assert.deepEqual(setMissionCombatEnabled(prepared, missionId, true), enabled);
  for (const candidate of [enabled, disabled]) {
    assert.equal(candidate.actorCatalogId, 'journey-actors-v8');
    assert.deepEqual(withoutEdition(mission(candidate)), withoutEdition(mission(prepared)));
  }
  revisionScope(prepared, enabled);
  revisionScope(enabled, disabled);
  assert.notEqual(disabled.revision, prepared.revision);
  assert.notEqual(mission(disabled).revision, mission(prepared).revision);
  assert.deepEqual(mission(disabled).combat, mission(prepared).combat);
  assert.deepEqual(prepareCombatAuthoring(enabled, missionId), enabled);
});

test('every old catalogue upgrades without changing unrelated levels or resolved ordinary physics in any preset', () => {
  for (let version = 1; version <= 7; version++) {
    const source = fixture();
    source.actorCatalogId = `journey-actors-v${version}`;
    const prior = compileContentProject(source);
    const next = prepareCombatAuthoring(prior, missionId);
    const compiled = compileContentProject(next);
    for (const difficulty of Object.keys(prior.difficulty.presets))
      for (const mode of ['solo', 'versus']) {
        const oldMission = resolveMission(prior, missionId, { difficulty, mode });
        const newMission = resolveMission(compiled, missionId, { difficulty, mode });
        assert.deepEqual(newMission.level.enemies, oldMission.level.enemies);
        assert.deepEqual(newMission.level.rules, oldMission.level.rules);
        const oldPhysics = structuredClone(oldMission.level),
          newPhysics = structuredClone(newMission.level);
        delete oldPhysics.revision;
        delete newPhysics.revision;
        delete newPhysics.classic.combatPatrols;
        assert.deepEqual(newPhysics, oldPhysics);
        assert.deepEqual(
          resolveMission(compiled, 'unrelated-mission', { difficulty, mode }).level,
          resolveMission(prior, 'unrelated-mission', { difficulty, mode }).level,
        );
      }
  }
});

test('toggle compiles every preset with authored actors preserved and equal Solo/Versus boards', () => {
  const prepared = add(
    add(prepareCombatAuthoring(fixture(), missionId), 'optional-scout'),
    'optional-sentry',
  );
  const enabled = setMissionCombatEnabled(prepared, missionId, true);
  for (const difficulty of ['gentle', 'standard', 'expert']) {
    const off = resolve(prepared, missionId, { difficulty });
    const on = resolve(enabled, missionId, { difficulty });
    assert.equal(off.level.classic.combatPatrols.enabled, false);
    assert.equal(on.level.classic.combatPatrols.enabled, true);
    assert.equal(on.level.classic.combatPatrols.actors.length, 2);
    assert.deepEqual(off.level.classic.combatPatrols.actors, on.level.classic.combatPatrols.actors);
    assert.deepEqual(on.level.enemies, off.level.enemies);
    assert.deepEqual(on.level.rules, off.level.rules);
    assert.notEqual(on.simulationIdentity, off.simulationIdentity);
    assert.deepEqual(resolve(enabled, missionId, { difficulty, mode: 'versus' }).level, on.level);
  }
});

test('invalid commands, unprepared data and Team authoring roll back without partial edits', () => {
  const source = fixture(),
    prepared = prepareCombatAuthoring(source, missionId);
  for (const [candidate, command] of [
    [source, (s) => prepareCombatAuthoring(s, 'missing')],
    [source, (s) => setMissionCombatEnabled(s, missionId, true)],
    [prepared, (s) => setMissionCombatEnabled(s, 'missing', true)],
    ...[undefined, null, 0, 1, 'true', {}, []].map((value) => [
      prepared,
      (s) => setMissionCombatEnabled(s, missionId, value),
    ]),
  ]) {
    const snapshot = structuredClone(candidate);
    assert.throws(() => command(candidate));
    assert.deepEqual(candidate, snapshot);
  }
  const invalid = structuredClone(prepared);
  mission(invalid).combat.enabled = 'yes';
  const snapshot = structuredClone(invalid);
  assert.throws(() => prepareCombatAuthoring(invalid, missionId));
  assert.throws(() => setMissionCombatEnabled(invalid, missionId, true));
  assert.deepEqual(invalid, snapshot);
  const team = createTeamOpeningCandidates(),
    teamSnapshot = structuredClone(team);
  assert.throws(() => prepareCombatAuthoring(team, 'twin-landings'), /Team/);
  assert.throws(() => setMissionCombatEnabled(team, 'twin-landings', false), /Team/);
  assert.deepEqual(team, teamSnapshot);
});

test('draft history undoes and redoes preparation and toggles with their complete revision graph', () => {
  const source = fixture(),
    history = createDraftHistory(source);
  const prepared = prepareCombatAuthoring(history.current(), missionId);
  history.replace(prepared);
  const enabled = setMissionCombatEnabled(history.current(), missionId, true);
  history.replace(enabled);
  assert.deepEqual(history.undo(), prepared);
  assert.deepEqual(history.undo(), source);
  assert.deepEqual(history.redo(), prepared);
  assert.deepEqual(history.redo(), enabled);
  const checkpoint = history.export();
  assert.throws(() =>
    history.replace(setMissionCombatEnabled(history.current(), missionId, 'yes')),
  );
  assert.equal(history.export(), checkpoint);
});

test('removing the last optional actor preserves prepared combat and never downgrades the catalogue', () => {
  const prepared = prepareCombatAuthoring(fixture(), missionId);
  const withActor = add(prepared, 'optional-scout');
  const removed = editContentActor(withActor, missionId, {
    action: 'remove',
    id: 'optional-scout',
  });
  assert.deepEqual(mission(removed).combat, { version: 'mission-combat.v1', enabled: false });
  assert.equal(removed.actorCatalogId, 'journey-actors-v8');
  assert.deepEqual(mission(removed).actors, mission(prepared).actors);
  assert.deepEqual(prepareCombatAuthoring(removed, missionId), removed);
});

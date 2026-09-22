import test from 'node:test';
import assert from 'node:assert/strict';
import { createCandidateTeamHost } from '../content-design/team-host.mjs';
import { createTeamJourneyCandidates } from '../content-design/team-journey-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createMissionCard, paintMissionThumbnail } from '../content-design/mission-card.mjs';
import { createStarterProject } from '../content-design/starter.mjs';
import { createCoop } from '../coop/core.mjs';
import { validateCoopPack } from '../coop/recipes.mjs';
import { emptyJourneyProfile, applyJourneyEvent } from '../journey/profile.mjs';

const source = createTeamJourneyCandidates(),
  before = structuredClone(source);
const project = compileContentProject(source),
  corePackIds = source.packs.map((pack) => pack.id);
const host = createCandidateTeamHost(project, { corePackIds });

test('Team navigation crosses four campaign boundaries in authored order without flattening runtime editions or resetting the preset', () => {
  assert.equal(host.rows.length, 36);
  assert.equal(host.catalog.missions.length, 12);
  assert.equal(host.officialProgressEligible, false);
  for (const difficulty of ['gentle', 'standard', 'expert']) {
    let row = host.row(host.catalog.missions[0], difficulty),
      transitions = 0;
    const visited = [],
      editions = [];
    while (row) {
      assert(host.owns(row));
      assert(Object.isFrozen(row.level));
      assert.equal(row.difficulty, difficulty);
      assert.equal(row.level.journeyDifficulty, difficulty);
      assert.equal(row.officialProgressEligible, false);
      assert.equal(row.background, null);
      assert(validateCoopPack(row.pack).valid);
      assert(row.pack.levels.includes(row.level));
      const expected = resolveMission(project, row.mission.levelId, { mode: 'team', difficulty });
      assert.deepEqual(row.level, expected.level);
      assert.equal(row.simulationIdentity, expected.simulationIdentity);
      const run = createCoop(row.level);
      assert.equal(run.ruleset, row.pack.ruleset);
      assert.equal(run.team.reserves, { gentle: 4, standard: 2, expert: 1 }[difficulty]);
      visited.push(row.mission.levelId);
      editions.push(row.pack.version);
      const destination = host.destination(row);
      if (destination.crossesCampaign) transitions++;
      assert.equal(destination.final, !destination.next);
      row = destination.next;
      assert(visited.length <= 12);
    }
    assert.deepEqual(
      visited,
      source.missions.map((mission) => mission.id),
    );
    assert.deepEqual(
      editions,
      ['revealline-coop-pack.v2', 'revealline-coop-pack.v3', 'revealline-coop-pack.v4'].flatMap(
        (version) => Array(4).fill(version),
      ),
    );
    assert.equal(transitions, 4);
  }
  assert.deepEqual(source, before);
});

test('navigation is ownership-bound and cannot turn a cloned row, forged mission or another preset into an accepted destination', () => {
  const mission = host.catalog.missions[0],
    row = host.row(mission);
  assert.equal(host.row({ ...mission }), null);
  assert.equal(host.row(null), null);
  assert.equal(host.row(mission, 'random'), null);
  assert.equal(host.card({ ...mission }), null);
  assert.equal(host.destination({ ...row }), null);
  assert.equal(host.destination({ ...row, difficulty: 'expert' }), null);
  assert.equal(host.destination(null), null);
  assert.throws(() => createCandidateTeamHost(source, { corePackIds: [] }));
  assert.throws(() => createCandidateTeamHost(source, { corePackIds: ['missing'] }));
  assert.throws(() => createCandidateTeamHost(source));
});

test('explicit core selection, archive and reordering use the shared registry rather than a second Team map list', () => {
  const lastPack = source.packs.at(-1).id;
  const selected = createCandidateTeamHost(source, { corePackIds: [lastPack] });
  const start = selected.catalog.missions.find((mission) => selected.isCore(mission.id));
  assert.equal(start.levelId, 'shared-lookout');
  assert.equal(selected.destination(selected.row(selected.catalog.missions[0])).next, null);
  const altered = structuredClone(source);
  altered.campaigns.at(-1).missionIds.reverse();
  altered.missions.find((mission) => mission.id === 'twin-depots').archived = true;
  const edited = createCandidateTeamHost(altered, { corePackIds });
  assert.deepEqual(
    edited.catalog.missions.slice(-3).map((m) => m.levelId),
    ['last-rendezvous', 'changing-courtyard', 'shared-lookout'],
  );
  assert.equal(host.catalog.missions.length, 12);
});

test('Team cards show exact foundations, terrain, both seats and actual actor roles without using a Solo simulation', () => {
  for (const mission of host.catalog.missions) {
    const row = host.row(mission),
      card = host.card(mission),
      run = createCoop(row.level);
    assert.equal(host.card(mission), card);
    assert(Object.isFrozen(card.spawns[0]));
    assert.deepEqual(card.cells, [...run.cells]);
    assert.deepEqual(card.terrain, [...(run.terrain ?? new Uint8Array(run.cells.length))]);
    assert.deepEqual(
      card.spawns,
      run.players.map(({ id, x, y }) => ({ seat: id, x, y })),
    );
    assert.deepEqual(
      card.actors.map((actor) => actor.type),
      run.enemies.map((actor) => actor.type),
    );
    const calls = [],
      ctx = new Proxy(
        {},
        {
          get:
            (_, name) =>
            (...args) =>
              calls.push([name, ...args]),
        },
      );
    paintMissionThumbnail(ctx, card);
    assert.deepEqual(
      calls.filter(([name]) => name === 'fillText').map((call) => call[1]),
      ['1', '2'],
    );
    assert.equal(calls[0][0], 'save');
    assert.equal(calls.at(-1)[0], 'restore');
  }
  const solo = createMissionCard(
    resolveMission(compileContentProject(createStarterProject()), 'nearby-shore'),
  );
  assert.equal(Object.hasOwn(solo, 'spawns'), false, 'Historical Solo card shape is unchanged.');
});

test('candidate progress IDs survive display/version changes; skip remains separate from a verified clear', () => {
  const first = host.catalog.missions[0],
    second = host.next(first.id);
  let profile = applyJourneyEvent(emptyJourneyProfile(), {
    type: 'select',
    mode: 'team',
    missionId: first.id,
  });
  profile = applyJourneyEvent(profile, { type: 'skip', mode: 'team', missionId: first.id });
  profile = applyJourneyEvent(profile, { type: 'select', mode: 'team', missionId: second.id });
  assert.deepEqual(profile.clears.team, {});
  assert.deepEqual(profile.skipped.team, [first.id]);
  assert.equal(profile.cursors.team, second.id);
  const renamed = structuredClone(source);
  renamed.revision = 'later-candidate';
  renamed.name = 'Later test build';
  renamed.missions[0].name = 'Renamed opening';
  renamed.missions[0].revision = '2';
  const newer = createCandidateTeamHost(renamed, { corePackIds });
  assert.equal(newer.catalog.find(profile.cursors.team).levelId, second.levelId);
  assert.equal(newer.catalog.find(profile.skipped.team[0]).levelId, first.levelId);
  assert.notEqual(
    newer.row(newer.catalog.find(first.id)).executionKey,
    host.row(first).executionKey,
  );
  assert.deepEqual(profile.clears.team, {});
});

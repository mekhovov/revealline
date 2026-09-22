import test from 'node:test';
import assert from 'node:assert/strict';
import { createTeamJourneyCandidates } from '../content-design/team-journey-candidates.mjs';
import { createTeamPressureOriginalCandidates } from '../content-design/team-pressure-originals.mjs';
import { withPressureDifficulty } from '../content-design/pressure-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createCandidateTeamHost } from '../content-design/team-host.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';
import { readCoopPack } from '../coop/library.mjs';
import { teamPressureFixtures } from './helpers/team-pressure-fixtures.mjs';
import { assessTeamPressureRoute } from '../../scripts/lib/team-pressure-assessment.mjs';

const source = createTeamPressureOriginalCandidates(),
  project = compileContentProject(source);
const donor = compileContentProject(withPressureDifficulty(createTeamJourneyCandidates()));
const originals = createTeamJourneyCandidates({ artwork: true });
const rows = await teamPressureFixtures();

test('explicit pictured pressure edition preserves all36 tested runtime levels and old originals', () => {
  assert.notEqual(source.id, originals.id);
  assert.equal(project.difficulty.id, 'journey-difficulty-v2');
  assert.equal(source.missions.length, 12);
  assert.equal(source.campaigns.length, 5);
  assert.deepEqual(source.maps, originals.maps);
  assert.deepEqual(source.assets, originals.assets);
  assert.deepEqual(
    source.missions.map((m) => m.id),
    originals.missions.map((m) => m.id),
  );
  assert.equal(rows.length, 36);
  assert.equal(new Set(rows.map((r) => `${r.missionId}/${r.difficulty}`)).size, 36);
  for (const row of rows) {
    assert.deepEqual(row.outcomes.map((o) => `${o.jointCuts}/${o.swapped}`).sort(), [
      'false/false',
      'false/true',
      'true/false',
      'true/true',
    ]);
    const options = { mode: 'team', difficulty: row.difficulty };
    const manifest = resolveMission(project, row.missionId, options);
    assert.deepEqual(manifest.level, resolveMission(donor, row.missionId, options).level);
    assert.equal(manifest.simulationIdentity, row.simulationIdentity);
    assert.equal(manifest.officialProgressEligible, false);
    const old = originals.missions.find((m) => m.id === row.missionId);
    assert.deepEqual(
      source.missions.find((m) => m.id === row.missionId).presentation,
      old.presentation,
    );
    const pack = createTeamTestPack(source, row.missionId, row.difficulty);
    assert.deepEqual(readCoopPack(JSON.stringify(pack)).levels, [manifest.level]);
  }
  const changed = createTeamPressureOriginalCandidates();
  changed.missions[0].actors[0].heading[0] = 99;
  changed.assets[0].sha256 = 'invalid';
  assert.deepEqual(createTeamPressureOriginalCandidates(), source);
  assert.deepEqual(createTeamJourneyCandidates({ artwork: true }), originals);
});

test('pressure picture host owns all rows and crosses five immutable campaigns with no content gate', () => {
  const host = createCandidateTeamHost(source, { corePackIds: source.packs.map((p) => p.id) }),
    old = createCandidateTeamHost(originals, { corePackIds: originals.packs.map((p) => p.id) });
  assert.equal(host.catalog.missions.length, 12);
  for (const difficulty of ['gentle', 'standard', 'expert']) {
    let crosses = 0;
    for (const [index, mission] of host.catalog.missions.entries()) {
      const row = host.row(mission, difficulty),
        destination = host.destination(row);
      assert(host.owns(row));
      assert(!old.owns(row));
      assert.notEqual(
        row.executionKey,
        old.row(old.catalog.find(mission.id), difficulty).executionKey,
      );
      assert.equal(destination.final, index === 11);
      if (index < 11) {
        assert.equal(destination.next.mission, host.catalog.missions[index + 1]);
        assert.equal(destination.next.difficulty, difficulty);
      }
      crosses += Number(destination.crossesCampaign);
    }
    assert.equal(crosses, 4);
  }
});

for (const row of rows)
  test(`${row.missionId}/${row.difficulty}: original144 direct route checks remain exact`, () => {
    const { level } = resolveMission(project, row.missionId, {
      mode: 'team',
      difficulty: row.difficulty,
    });
    for (const { jointCuts, swapped, ...expected } of row.outcomes) {
      const actual = assessTeamPressureRoute(level, row.log, {
        jointCuts,
        swapped,
        delayTicks: row.delayTicks,
      });
      assert.deepEqual(actual, expected);
      assert.equal(actual.status, 'shared-no-loss-clear');
    }
  });

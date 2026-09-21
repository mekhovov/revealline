import test from 'node:test';
import assert from 'node:assert/strict';
import { createTeamRoamerCandidates } from '../content-design/team-roamer-candidates.mjs';
import { createTeamRoamerSpatialCandidates } from '../content-design/team-roamer-spatial-candidates.mjs';
import { withPressureDifficulty } from '../content-design/pressure-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createTeamCampaignTestPack } from '../content-design/team-export.mjs';
import { readCoopPack } from '../coop/library.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { createCoop, startCoop, stepCoop, FIELD } from '../coop/core.mjs';
import { inspectCaptureSnapshot } from '../core/capture-regions.mjs';

const original = withPressureDifficulty(createTeamRoamerCandidates());
const before = structuredClone(original),
  old = compileContentProject(original);
const source = createTeamRoamerSpatialCandidates(),
  project = compileContentProject(source);
const command = (direction) => ({ direction, boost: false, support: false });

test('two original spatial successors keep old editions and the qualified Team rule boundary intact', () => {
  assert.deepEqual(
    project.missions.map((m) => m.id),
    ['shared-lookout', 'twin-depots'],
  );
  assert.equal(source.difficultyCatalogId, 'journey-difficulty-v2');
  assert.deepEqual(project.assets, []);
  assert.equal(source.campaigns.length, 1);
  assert.equal(source.packs.length, 1);
  for (const mission of project.missions) {
    const previous = old.missions.find((m) => m.id === mission.id);
    assert.equal(mission.team.format, 'TeamMissionV3');
    assert.deepEqual(mission.modes, ['team']);
    assert.equal(mission.coverage, previous.coverage);
    assert.equal(mission.timeLimitSeconds, 0);
    assert.deepEqual(mission.objectives, []);
    assert.deepEqual(mission.bonuses, []);
    assert.deepEqual(mission.design.introduces, previous.design.introduces);
    assert(mission.actors.every((a) => a.tier === 'measured'));
    assert.notEqual(mission.revision, previous.revision);
  }
  assert.deepEqual(original, before);
  const changed = createTeamRoamerSpatialCandidates();
  changed.maps[0].walls[0].w++;
  assert.deepEqual(createTeamRoamerSpatialCandidates(), source);
});

for (const mission of project.missions)
  for (const difficulty of ['gentle', 'standard', 'expert'])
    test(`${mission.id}/${difficulty}: strict compiler, preview, export and occupied components agree`, () => {
      const manifest = resolveMission(project, mission.id, { mode: 'team', difficulty });
      assert.notEqual(
        manifest.simulationIdentity,
        resolveMission(old, mission.id, { mode: 'team', difficulty }).simulationIdentity,
      );
      assert(!manifest.diagnostics.some((d) => d.severity === 'error'));
      assert.equal(manifest.officialProgressEligible, false);
      assert.equal(manifest.background, null);
      assert.deepEqual(manifest.level.rules, { moveSpeed: 10, boostMultiplier: 1 });
      const run = createCoop(manifest.level);
      const preview = prepareContentPreview(project, mission.id, { mode: 'team', difficulty });
      assert.deepEqual([...run.cells], preview.geometry.cells);
      assert.equal(run.totalClaimable, run.cells.filter((cell) => cell === FIELD).length);
      const capture = inspectCaptureSnapshot(run);
      assert(capture.components.every((c) => c.retained));
      assert(capture.components.flatMap((c) => c.enemyIds).every((id) => !id.startsWith('roamer')));
      assert.equal(capture.components.length, mission.id === 'twin-depots' ? 2 : 1);
      assert(
        run.enemies
          .filter((e) => e.type === 'claimed-rover')
          .every((e) => e.rover.mode === 'dormant'),
      );
      const pack = createTeamCampaignTestPack(source, 'changing-common-ground', difficulty);
      assert.deepEqual(readCoopPack(JSON.stringify(pack)), pack);
      assert.deepEqual(
        pack.levels.find((l) => l.id === mission.id),
        manifest.level,
      );
      assert.throws(() => resolveMission(project, mission.id, { mode: 'solo', difficulty }));
      assert.throws(() => resolveMission(project, mission.id, { mode: 'versus', difficulty }));
    });

test('spawn inspection remains unpressured before players choose to expose a trail', () => {
  for (const mission of project.missions)
    for (const difficulty of ['gentle', 'standard', 'expert']) {
      const { level } = resolveMission(project, mission.id, { mode: 'team', difficulty });
      const run = startCoop(createCoop(level));
      for (let tick = 0; tick < 600; tick++) {
        stepCoop(run, [command(null), command(null)]);
        assert(!run.events.some((e) => e.type === 'player.downed' || e.type === 'rover.warning'));
      }
      assert.equal(run.coverage, 0);
      assert.equal(run.status, 'running');
    }
});

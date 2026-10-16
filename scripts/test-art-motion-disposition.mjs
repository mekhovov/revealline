import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildActorCoverage } from './actor-coverage.mjs';
import {
  artMotionPolicy,
  buildArtMotionDisposition,
  DISPOSITION_POLICIES,
} from './art-motion-disposition.mjs';

const coverage = await buildActorCoverage();
const compiled = JSON.parse(
  await readFile(new URL('../game/presentation/compiled/runtime.json', import.meta.url), 'utf8'),
);
const report = await buildArtMotionDisposition({ coverage, compiled });

test('every current authored actor joins one exact owner and one distinct appearance binding', () => {
  assert.equal(report.owners.length, coverage.missions.length);
  const owners = new Map(report.owners.map((owner) => [owner.id, owner]));
  assert.equal(owners.size, coverage.missions.length);
  const placements = report.actorBindings.flatMap((binding) =>
    binding.owners.map((placement) => {
      const owner = owners.get(placement.owner);
      assert(owner?.simulationIdentity && owner.missionRevision && owner.campaignRevision);
      const mission = coverage.missions.find(
        (mission) =>
          mission.mode === owner.mode &&
          mission.route === owner.route &&
          mission.campaignId === owner.campaignId &&
          mission.missionId === owner.missionId,
      );
      const actor = mission.actors.find((actor) => actor.id === placement.actorId);
      assert.equal(binding.role, actor.role);
      assert.equal(binding.runtimeType, actor.runtimeType);
      assert.equal(binding.campaignMaterialId, mission.campaignMaterialId);
      assert.equal(binding.fpvBodySlot, actor.fpvBodySlot);
      return `${owner.id}/${actor.id}`;
    }),
  );
  assert.equal(new Set(placements).size, placements.length);
  assert.equal(
    placements.length,
    coverage.missions.reduce((n, mission) => n + mission.actors.length, 0),
  );
  assert.equal(report.summary.authoredActorPlacements, placements.length);
});

test('all compiled categories and exact assets are retained without claiming mission selection', () => {
  assert.deepEqual(
    report.assets.map((asset) => asset.id).sort(),
    Object.keys(compiled.resolved.assets).sort(),
  );
  for (const row of report.assets) {
    const source = compiled.resolved.assets[row.id];
    assert.equal(row.asset.id, source.id);
    assert.equal(row.asset.revision, source.revision);
    assert.deepEqual(row.geometry, source.geometry);
    assert.equal(row.file?.sha256, source.file?.sha256);
    assert.match(row.asset.metadataSha256, /^[a-f0-9]{64}$/);
    assert.match(row.scope, /not per-mission selection/);
    assert(DISPOSITION_POLICIES[row.policy]?.next);
  }
  for (const category of ['terrain', 'pickup', 'effect', 'picture', 'team', 'control'])
    assert(report.summary.compiledCategories[category] > 0);
  assert(
    report.actorBindings.some(
      (binding) =>
        binding.role === 'field-keeper' &&
        binding.runtimeType === 'drifter' &&
        binding.fpvBodySlot === 'enemy.bouncer',
    ),
  );
  assert(
    report.actorBindings.some(
      (binding) => binding.campaignMaterialId && binding.policy === 'review-material',
    ),
  );
  assert.equal(report.summary.visualApproval, false);
  assert.equal(report.summary.dispositions.Replace, 0);
});

test('mission artwork ownership remains exact and separate from compiled picture capabilities', () => {
  const owners = new Map(report.owners.map((owner) => [owner.id, owner]));
  assert.equal(
    report.artworkBindings.reduce((n, row) => n + row.owners.length, 0),
    coverage.missions.filter((mission) => mission.artwork).length,
  );
  for (const row of report.artworkBindings) {
    for (const owner of row.owners) assert.deepEqual(row.artwork, owners.get(owner).artwork);
    assert.equal(row.disposition, 'Keep');
    assert.equal(row.policy, 'preserve-artwork');
  }
});

test('missing bindings and unknown categories cannot appear fully covered', async () => {
  const changed = structuredClone(compiled);
  delete changed.resolved.assets['enemy.bouncer'];
  delete changed.resolved.bindings['enemy.bouncer'];
  const unknown = structuredClone(compiled.resolved.assets['pickup.life']);
  unknown.id = 'unclassified.test';
  changed.resolved.assets['future.part'] = unknown;
  changed.resolved.bindings['future.part'] = { id: unknown.id, revision: unknown.revision };
  const next = await buildArtMotionDisposition({ coverage, compiled: changed });
  assert(next.summary.missingSlots.includes('enemy.bouncer'));
  assert.equal(
    next.missingBindings.find((row) => row.id === 'enemy.bouncer').disposition,
    'Repair',
  );
  assert.equal(next.assets.find((row) => row.id === 'future.part').policy, 'review-unknown');
  assert.notEqual(next.compiledSha256, report.compiledSha256);
  changed.resolved.bindings['future.part'].revision++;
  await assert.rejects(
    buildArtMotionDisposition({ coverage, compiled: changed }),
    /binding identity mismatch/,
  );
});

test('repair rules are bounded to identified prepared art and validate rig metadata', () => {
  const player = structuredClone(compiled.resolved.assets['player.scout.compact']);
  assert.equal(artMotionPolicy('player.scout.compact', player), 'repair-player-proportions');
  player.geometry.rotorAnchors.forEach((anchor) => {
    anchor.radius = 0.205;
  });
  assert.equal(artMotionPolicy('player.scout.compact', player), 'preserve-image');
  const patrol = structuredClone(compiled.resolved.assets['enemy.border-patrol']);
  assert.equal(artMotionPolicy('enemy.border-patrol', patrol), 'repair-patrol-rig');
  patrol.id = 'manual-unreviewed-patrol';
  patrol.quality.stage = 'produced';
  assert.equal(artMotionPolicy('enemy.border-patrol', patrol), 'review-component');
  patrol.geometry.rotorAnchors = [{ x: 99, y: 0.5, radius: 0.2, blades: 3 }];
  assert.throws(() => artMotionPolicy('enemy.border-patrol', patrol));
});

test('C4 distinguishes existing capabilities and greyboxes from default placements and acceptance', () => {
  const rows = new Map(report.behaviorCoverage.roles.map((row) => [row.role, row]));
  assert(rows.get('trail-pursuer').authoredPlacementsByMode.solo > 0);
  assert(rows.get('heading-interceptor').authoredPlacementsByMode.versus > 0);
  for (const role of ['optional-scout', 'optional-sentry']) {
    assert(rows.get(role).declaredCatalogs.length > 0);
    assert(rows.get(role).optionalStudyMissions.length > 0);
    assert.deepEqual(rows.get(role).authoredPlacementsByMode, { solo: 0, versus: 0, team: 0 });
  }
  assert.match(report.behaviorCoverage.optionalStudy.classification, /unqualified/);
  assert.match(report.behaviorCoverage.testStatus, /does not claim execution/);
  for (const scope of report.unknownCoverage) {
    assert.equal(scope.count, null);
    assert.equal(scope.coverage, 'unknown');
    assert.equal(scope.disposition, 'Review');
  }
});

test('regeneration is deterministic and does not mutate supplied metadata', async () => {
  const before = structuredClone({ coverage, compiled });
  assert.deepEqual(await buildArtMotionDisposition({ coverage, compiled }), report);
  assert.deepEqual({ coverage, compiled }, before);
});

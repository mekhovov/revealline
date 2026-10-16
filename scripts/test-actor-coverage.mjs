import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildActorCoverage,
  inventoryDefaultDrift,
  actorAssetDisposition,
} from './actor-coverage.mjs';
import { loadInventoryTeamRoute } from './content-inventory.mjs';
import { DEFAULT_JOURNEY_ROUTES } from '../game/content-design/default-entry.mjs';
import { TEAM_CONTENT_ROUTES } from '../game/content-design/content-lifecycle.mjs';
import { createTeamCulturalSpecialistV2OriginalCandidates } from '../game/content-design/team-cultural-specialist-v2-originals.mjs';

const report = await buildActorCoverage();

test('live coverage compiles ordinary mode entry instead of trusting old equal-count inventories', () => {
  assert.deepEqual(report.defaults, DEFAULT_JOURNEY_ROUTES);
  for (const mode of ['solo', 'versus', 'team']) {
    const route = report.routes.find((item) => item.mode === mode);
    assert.equal(route.route, DEFAULT_JOURNEY_ROUTES[mode]);
    const missions = report.missions.filter((mission) => mission.mode === mode);
    assert.equal(missions.length, route.missions);
    assert.equal(
      new Set(missions.map((mission) => `${mission.campaignId}/${mission.missionId}`)).size,
      missions.length,
    );
    assert(missions.every((mission) => mission.missionRevision && mission.simulationIdentity));
    assert.match(route.sourceSha256, /^[a-f0-9]{64}$/);
  }
  const solo = report.routes.find((route) => route.mode === 'solo');
  const versus = report.routes.find((route) => route.mode === 'versus');
  assert.equal(solo.sourceSha256, versus.sourceSha256);
  assert.deepEqual(report.summary.missingSlots, []);
});

test('Team uses its real runtime types while retaining authored role and exact edition', () => {
  const mission = report.missions.find(
    (item) => item.mode === 'team' && item.missionId === 'twin-landings',
  );
  assert(mission);
  assert(
    mission.actors.some(
      (actor) =>
        actor.role === 'field-keeper' &&
        actor.runtimeType === 'drifter' &&
        actor.fpvBodySlot === 'enemy.bouncer',
    ),
  );
  const source = createTeamCulturalSpecialistV2OriginalCandidates();
  assert.equal(
    report.routes.find((route) => route.mode === 'team').sourceRevision,
    source.revision,
  );
  const authored = source.missions.find((item) => item.id === mission.missionId);
  assert.equal(
    mission.artwork.sha256,
    source.assets.find((item) => item.id === authored.presentation.backgroundAssetId).sha256,
  );
  assert.deepEqual(mission.supportRoles, authored.team.supportRoles);
});

test('campaign materials and optional FPV bindings stay distinct from visual acceptance', () => {
  const mission = report.missions.find(
    (item) => item.mode === 'solo' && item.missionId === 'first-return',
  );
  assert.equal(mission.campaignMaterialId, 'horizon-enamel-v1');
  assert.equal(mission.actors[0].fpvBodySlot, 'enemy.bouncer');
  assert.equal(mission.evidence, 'compiled-source-only');
  assert(report.assets.every((asset) => asset.evidence === 'compiled-metadata-only'));
  for (const role of report.playerRoles) {
    assert(role.animationRecipe);
    assert(role.slots.every((slot) => report.assets.some((asset) => asset.slot === slot)));
  }
});

test('stale entry identity is detected even when mission counts match', () => {
  const routes = [
    { family: 'journey', classification: 'current', route: 'old-journey', missionCount: 91 },
    { family: 'team', classification: 'current', route: 'old-team', missionCount: 12 },
  ];
  assert.equal(inventoryDefaultDrift({ routes }, report.defaults).length, 3);
  routes[0].route = report.defaults.solo;
  routes[1].route = report.defaults.team;
  assert.deepEqual(inventoryDefaultDrift({ routes }, report.defaults), []);
});

test('Team inventory covers every lifecycle route and refuses an unknown successor', async () => {
  for (const { id } of TEAM_CONTENT_ROUTES) {
    const route = await loadInventoryTeamRoute(id);
    assert.equal(route.id, id);
    assert(route.source.missions.length > 0, id);
    assert(route.source.revision, id);
  }
  await assert.rejects(loadInventoryTeamRoute('unregistered-team-next'), /No inventory factory/);
});

test('rig disposition preserves old assets and rejects malformed anchors before reporting readiness', async () => {
  const compiled = JSON.parse(
    await readFile(new URL('../game/presentation/compiled/runtime.json', import.meta.url)),
  );
  const patrol = structuredClone(compiled.resolved.assets['enemy.border-patrol']);
  patrol.geometry.rotorAnchors = [];
  assert.equal(actorAssetDisposition('enemy.border-patrol', patrol).disposition, 'Repair');
  const player = compiled.resolved.assets['player.scout.compact'];
  assert.equal(actorAssetDisposition('player.scout.compact', player).disposition, 'Keep');
  patrol.geometry.rotorAnchors = [{ x: 99, y: 0.5, radius: 0.12, blades: 3 }];
  assert.throws(() => actorAssetDisposition('enemy.border-patrol', patrol));
});

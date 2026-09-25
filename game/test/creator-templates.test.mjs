import test from 'node:test';
import assert from 'node:assert/strict';
import { journeyActors } from '../content-design/catalogs.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { verifyReplayAsync } from '../replay.mjs';
import {
  CREATOR_TEMPLATES,
  CREATOR_TEMPLATE_REGISTRY_VERSION,
  CREATOR_TEMPLATE_VERSION,
  generateCreatorProject,
  selectCreatorTemplate,
  verifyCreatorRoutes,
  validateCreatorProvenance,
} from '../creator/templates.mjs';

const challengeGeometry = (map) => [
  ...map.walls.map((item) => ({ kind: 'wall', ...item })),
  ...map.foundations.map((item) => ({ kind: 'foundation', ...item })),
  ...map.terrain.map((item) => ({ kind: `terrain:${item.kind}`, ...item })),
];

const replayChallenge = (level) => ({
  walls: level.walls,
  foundations: level.foundations,
  terrain: level.classic.terrain,
  enemies: level.enemies,
});

test('six bounded families and both variants are selected deterministically', () => {
  assert.equal(CREATOR_TEMPLATES.length, 6);
  assert.equal(new Set(CREATOR_TEMPLATES.map((template) => template.id)).size, 6);
  assert.ok(
    CREATOR_TEMPLATES.every(
      (template) =>
        template.version === CREATOR_TEMPLATE_REGISTRY_VERSION &&
        template.variants.length === 2 &&
        Object.isFrozen(template),
    ),
  );
  const selections = Array.from({ length: 12 }, (_, seed) => selectCreatorTemplate(seed));
  assert.deepEqual(
    selections.slice(0, 6).map((row) => row.templateId),
    CREATOR_TEMPLATES.map((row) => row.id),
  );
  assert.deepEqual(
    selections.slice(6).map((row) => row.templateId),
    CREATOR_TEMPLATES.map((row) => row.id),
  );
  for (let seed = 0; seed < selections.length; seed++) {
    assert.deepEqual(selectCreatorTemplate(seed), selections[seed]);
    assert.equal(
      selections[seed].variantId,
      CREATOR_TEMPLATES[seed % 6].variants[Math.floor(seed / 6)],
    );
  }
  assert.throws(() => selectCreatorTemplate(-1), /unsigned 32-bit/);
  assert.throws(
    () =>
      generateCreatorProject({
        id: 'unknown-layout',
        name: 'Unknown layout',
        seed: 0,
        templateId: 'not-registered',
      }),
    /registered creator template/,
  );
});

test('every family variant produces distinct bounded challenge geometry and supported enemies', () => {
  const geometries = [];
  for (let seed = 0; seed < 12; seed++) {
    const made = generateCreatorProject({ id: `image-${seed}`, name: 'My pictures', seed });
    assert.deepEqual(
      made,
      generateCreatorProject({ id: `image-${seed}`, name: 'My pictures', seed }),
    );
    assert.deepEqual(made.provenance, {
      format: 'revealline-creator-generation.v1',
      ...selectCreatorTemplate(seed),
      generationSeed: seed,
      runtimeSeed: seed,
      missionId: 'picture-1',
      gameplayPolicy: 'compiled-preset-v1',
      policyId: made.project.policyId,
    });
    const map = made.project.maps[0];
    const obstacles = challengeGeometry(map);
    assert.ok(map.walls.length > 0, `${made.provenance.variantId}: needs a collision obstacle`);
    assert.ok(obstacles.length > 0, `${made.provenance.variantId}: needs an interior obstacle`);
    assert.ok(
      obstacles.reduce((area, item) => area + item.w * item.h, 0) >= 12,
      `${made.provenance.variantId}: challenge geometry is only decorative`,
    );
    for (const obstacle of obstacles) {
      assert.ok(
        obstacle.x >= 1 &&
          obstacle.y >= 1 &&
          obstacle.x + obstacle.w <= map.width - 1 &&
          obstacle.y + obstacle.h <= map.height - 1,
        `${made.provenance.variantId}: ${obstacle.kind} must be an interior challenge`,
      );
    }
    const mission = made.project.missions[0];
    const actorCatalog = journeyActors(made.project.actorCatalogId);
    assert.equal(
      mission.actors.length,
      1,
      `${made.provenance.variantId}: needs exactly one bounded enemy`,
    );
    assert.equal(mission.actors[0].role, 'field-keeper');
    assert.equal(
      Math.abs(mission.actors[0].heading[0]) + Math.abs(mission.actors[0].heading[1]),
      1,
      `${made.provenance.variantId}: keeper needs a cardinal moving heading`,
    );
    assert.ok(
      mission.actors.every((actor) => actorCatalog.roles[actor.role]),
      `${made.provenance.variantId}: enemy must use the project's registered actor catalog`,
    );
    const manifest = resolveMission(compileContentProject(made.project), mission.id, {
      mode: 'solo',
      difficulty: 'standard',
    });
    assert.equal(manifest.level.enemies.length, 1);
    assert.equal(manifest.level.enemies[0].type, 'bouncer');
    assert.ok(
      manifest.level.enemies.every(
        (enemy, index) => enemy.type === actorCatalog.roles[mission.actors[index].role].type,
      ),
      `${made.provenance.variantId}: authored enemies must compile through supported roles`,
    );
    geometries.push(
      JSON.stringify({
        walls: map.walls,
        foundations: map.foundations,
        terrain: map.terrain,
        spawns: map.spawns,
      }),
    );
    const relabeled = generateCreatorProject({
      id: `other-${seed}`,
      name: 'Different labels',
      seed,
    });
    assert.deepEqual(relabeled.project.maps, made.project.maps);
  }
  assert.equal(new Set(geometries).size, 12);
});

test('all twelve variants replay actual identities in every Solo preset and steering policy', async () => {
  for (let seed = 0; seed < 12; seed++) {
    const made = generateCreatorProject({ id: `route-${seed}`, name: 'My pictures', seed });
    const routes = await verifyCreatorRoutes(made.project, made.provenance);
    const compiled = compileContentProject(made.project);
    assert.equal(routes.length, 6);
    for (const route of routes) {
      const manifest = resolveMission(compiled, made.provenance.missionId, {
        mode: route.mode,
        difficulty: route.difficulty,
      });
      assert.equal(route.seed, seed);
      assert.equal(route.templateId, made.provenance.templateId);
      assert.equal(route.templateVersion, CREATOR_TEMPLATE_REGISTRY_VERSION);
      assert.equal(route.variantId, made.provenance.variantId);
      assert.equal(route.replay.level.id, made.provenance.missionId);
      assert.equal(route.replay.options.seed, seed);
      assert.equal(route.replay.summary.won, true);
      assert.equal(route.kind, 'automated');
      assert.equal(route.simulationIdentity, manifest.simulationIdentity);
      assert.deepEqual(
        replayChallenge(route.replay.level),
        replayChallenge(manifest.level),
        `${made.provenance.variantId}: evidence must replay the exact compiled obstacles and enemies`,
      );
      assert.ok(route.replay.level.enemies.length > 0);
      const replayed = await verifyReplayAsync(route.replay);
      assert.equal(replayed.match, true);
      assert.equal(replayed.actual.summary.won, true);
    }
    assert.deepEqual(
      new Set(routes.map((r) => r.difficulty)),
      new Set(['gentle', 'standard', 'expert']),
    );
    assert.deepEqual(
      new Set(routes.map((r) => r.turnPolicy)),
      new Set(['immediate', 'grid-center']),
    );
  }
});

test('Phase 1 provenance retains its original variant recipe and route evidence shape', async () => {
  const current = generateCreatorProject({
    id: 'legacy-picture',
    name: 'Legacy pictures',
    seed: 0,
    templateId: 'first-crossing',
  });
  const project = structuredClone(current.project);
  project.maps[0].id = 'crossing-map';
  project.maps[0].walls = [];
  project.maps[0].spawns[0].x = 18.5;
  project.missions[0].map.id = 'crossing-map';
  project.missions[0].actors = [];
  project.missions[0].design.counterplay = 'There are no enemies in this introductory template.';
  project.missions[0].design.difficulty.threatDensity = 0;
  const provenance = {
    ...current.provenance,
    templateVersion: CREATOR_TEMPLATE_VERSION,
    variantId: 'west',
    generationSeed: 1,
    runtimeSeed: 1,
  };
  assert.deepEqual(validateCreatorProvenance(provenance), provenance);
  const routes = await verifyCreatorRoutes(project, provenance);
  assert.equal(routes.length, 6);
  assert.ok(routes.every((route) => !Object.hasOwn(route, 'templateId')));
});

test('Phase 2 v2 provenance retains its enemy-free immutable recipe', async () => {
  const current = generateCreatorProject({
    id: 'legacy-batch',
    name: 'Legacy batch',
    seed: 1,
    templateId: 'island-chain',
  });
  const project = structuredClone(current.project);
  project.maps[0].walls = [];
  project.missions[0].actors = [];
  project.missions[0].design.counterplay =
    'There are no enemies in this verified creator template.';
  project.missions[0].design.difficulty.threatDensity = 0;
  const provenance = { ...current.provenance, templateVersion: 'creator-layouts.v2' };
  assert.deepEqual(validateCreatorProvenance(provenance), provenance);
  const routes = await verifyCreatorRoutes(project, provenance);
  assert.equal(routes.length, 6);
  assert.ok(
    routes.every(
      (route) =>
        route.templateVersion === 'creator-layouts.v2' && route.replay.level.enemies.length === 0,
    ),
  );
});

test('artwork and labels preserve simulation evidence, while a gameplay edit invalidates template approval', async () => {
  const made = generateCreatorProject({ id: 'picture', name: 'First collection', seed: 20 });
  const original = await verifyCreatorRoutes(made.project, made.provenance);
  const edited = structuredClone(made.project);
  edited.missions[0].name = 'A renamed picture';
  edited.assets.push({
    format: 'AssetRevisionV1',
    id: 'poster',
    revision: '1',
    kind: 'reveal-background',
    path: 'content-design/assets/creator/poster.png',
    sha256: 'a'.repeat(64),
    bytes: 123,
    width: 72,
    height: 36,
    alt: 'My reveal picture',
    review: 'candidate',
  });
  edited.missions[0].presentation.backgroundAssetId = 'poster';
  const changedArt = await verifyCreatorRoutes(edited, made.provenance);
  assert.deepEqual(
    changedArt.map((r) => r.simulationIdentity),
    original.map((r) => r.simulationIdentity),
  );
  assert.equal(changedArt[0].replay.level.name, 'A renamed picture');
  edited.missions[0].coverage = 0.6;
  await assert.rejects(verifyCreatorRoutes(edited, made.provenance), /Gameplay changed/);

  const obstacleEdited = structuredClone(made.project);
  const obstacle = challengeGeometry(obstacleEdited.maps[0])[0];
  assert.ok(obstacle, 'fixture must include challenge geometry');
  obstacleEdited.maps[0][
    obstacle.kind === 'wall' ? 'walls' : obstacle.kind === 'foundation' ? 'foundations' : 'terrain'
  ][0].x += 1;
  await assert.rejects(verifyCreatorRoutes(obstacleEdited, made.provenance), /Gameplay changed/);

  const actorEdited = structuredClone(made.project);
  assert.ok(actorEdited.missions[0].actors[0], 'fixture must include an enemy');
  actorEdited.missions[0].actors[0].x += 1;
  await assert.rejects(verifyCreatorRoutes(actorEdited, made.provenance), /Gameplay changed/);
});

test('unknown template versions, forged variants and cancellation cannot mint feasibility evidence', async () => {
  const made = generateCreatorProject({ id: 'picture', name: 'Collection', seed: 3 });
  assert.throws(
    () => validateCreatorProvenance({ ...made.provenance, templateVersion: 'future' }),
    /Unsupported/,
  );
  assert.throws(
    () => validateCreatorProvenance({ ...made.provenance, variantId: 'center' }),
    /variant/,
  );
  assert.throws(() => validateCreatorProvenance({ ...made.provenance, runtimeSeed: 4 }), /seed/);
  const stopped = new AbortController();
  stopped.abort();
  await assert.rejects(
    verifyCreatorRoutes(made.project, made.provenance, { signal: stopped.signal }),
    { name: 'AbortError' },
  );
  const running = new AbortController();
  const pending = verifyCreatorRoutes(made.project, made.provenance, { signal: running.signal });
  running.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});

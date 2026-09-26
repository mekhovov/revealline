import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWholePressureCandidates,
  createWholeCulturalPressureCandidates,
} from '../content-design/whole-spatial-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createAuthoredJourneyRoute } from '../content-design/route.mjs';
import { loadAuthoredJourneyRoute } from '../content-design/route-loader.mjs';
import {
  authoredJourneyModeHref,
  authoredJourneyUsesActorMaterials,
} from '../content-design/mode-href.mjs';
import { DEFAULT_JOURNEY_ROUTES } from '../content-design/default-entry.mjs';

const pursuit = ['cross-stitch-crossings', 'pysanka-sections', 'rushnyk-bands'];
const interception = ['four-motor-landings', 'circuit-lanes', 'twin-lens-chambers'];
const changed = new Set([...pursuit, ...interception]);
const baseline = createWholePressureCandidates({ artwork: true });
const source = createWholeCulturalPressureCandidates({ artwork: true });
const project = compileContentProject(source);

test('six existing Ukrainian/FPV missions adapt in place without duplicate content or geometry', () => {
  assert.equal(source.missions.length, 91);
  assert.equal(new Set(source.missions.map((mission) => mission.id)).size, 91);
  assert.deepEqual(source.maps, baseline.maps);
  assert.deepEqual(source.assets, baseline.assets);
  assert.deepEqual(
    source.campaigns.map(({ revision: _revision, ...campaign }) => campaign),
    baseline.campaigns.map(({ revision: _revision, ...campaign }) => campaign),
  );
  assert.deepEqual(
    source.packs.map(({ revision: _revision, ...pack }) => pack),
    baseline.packs.map(({ revision: _revision, ...pack }) => pack),
  );
  for (let index = 0; index < source.missions.length; index++) {
    const before = baseline.missions[index],
      after = source.missions[index];
    assert.equal(after.id, before.id);
    if (!changed.has(after.id)) {
      assert.deepEqual(after, before, after.id);
      continue;
    }
    assert.equal(after.map.id, before.map.id);
    assert.equal(after.map.revision, before.map.revision);
    assert.equal(after.presentation.backgroundAssetId, before.presentation.backgroundAssetId);
    assert.equal(after.actors.length, before.actors.length);
    const role = pursuit.includes(after.id) ? 'trail-pursuer' : 'heading-interceptor';
    assert.equal(after.actors.filter((actor) => actor.role === role).length, 1, after.id);
    assert.equal(
      after.actors.filter((actor, actorIndex) => actor.role !== before.actors[actorIndex].role)
        .length,
      1,
      after.id,
    );
  }
});

test('optional arcs use the same current-rules timing and paired-board manifests at every preset', () => {
  for (const difficulty of ['gentle', 'standard', 'expert'])
    for (const id of changed) {
      const solo = resolveMission(project, id, { difficulty, mode: 'solo' });
      const versus = resolveMission(project, id, { difficulty, mode: 'versus' });
      assert.deepEqual(versus.level, solo.level, `${id}/${difficulty}`);
      assert.equal(versus.simulationIdentity, solo.simulationIdentity);
      const pressure = solo.level.classic.enemyPressure.actors;
      assert.equal(pressure.length, 1);
      assert.equal(pressure[0].warningTicks, 90);
      assert.equal(pressure[0].commitTicks, 144);
      assert.equal(
        pressure[0].cooldownTicks,
        { gentle: 441, standard: 300, expert: 229 }[difficulty],
      );
      assert.equal(pressure[0].mode, pursuit.includes(id) ? 'trail-pursuit' : 'head-intercept');
    }
});

test('each optional sequence teaches once, then practices without changing its remaining mission', () => {
  for (const [ids, role] of [
    [pursuit, 'trail-pursuer'],
    [interception, 'heading-interceptor'],
  ]) {
    assert.deepEqual(source.missions.find((mission) => mission.id === ids[0]).design.introduces, [
      role,
    ]);
    for (const id of ids.slice(1)) {
      const mission = source.missions.find((candidate) => candidate.id === id);
      assert.deepEqual(mission.design.introduces, []);
      assert(mission.design.practices.includes(role));
    }
  }
  for (const id of ['tryzub-gates', 'component-trident'])
    assert.deepEqual(
      source.missions.find((mission) => mission.id === id),
      baseline.missions.find((mission) => mission.id === id),
    );
});

test('v7 remains historical while v8 keeps isolated progress after the normal entry advances', async () => {
  const old = createAuthoredJourneyRoute('whole-spatial-v7');
  const route = createAuthoredJourneyRoute('whole-spatial-v8');
  assert.deepEqual(await loadAuthoredJourneyRoute(route.id), route);
  assert.equal(route.profileKey, 'journey-whole-spatial-v8');
  assert.notEqual(route.profileKey, old.profileKey);
  for (const id of changed) {
    const historical = old.source.missions.find((mission) => mission.id === id);
    assert.equal(
      historical.actors.some((actor) =>
        ['trail-pursuer', 'heading-interceptor'].includes(actor.role),
      ),
      false,
      id,
    );
  }
  assert(authoredJourneyUsesActorMaterials(route.id));
  assert.equal(authoredJourneyModeHref(route.id, 'solo'), '../?journey=whole-spatial-v8');
  assert.equal(
    authoredJourneyModeHref(route.id, 'versus'),
    'couch/?journey=whole-spatial-v8&return=solo',
  );
  assert.equal(DEFAULT_JOURNEY_ROUTES.solo, 'whole-spatial-v25');
  assert.equal(DEFAULT_JOURNEY_ROUTES.versus, 'whole-spatial-v25');
  assert.equal(DEFAULT_JOURNEY_ROUTES.team, 'team-cultural-specialist-originals-2');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CURRENT_REMIX_PRESSURE_IDS,
  CURRENT_REMIX_PRESSURE_REVISION,
  createCurrentRemixPressureCandidates,
} from '../content-design/current-remix-pressure-candidates.mjs';
import { createCulturalPressureTriptychCandidates } from '../content-design/cultural-pressure-triptych-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createAuthoredJourneyRoute } from '../content-design/route.mjs';
import { loadAuthoredJourneyRoute } from '../content-design/route-loader.mjs';
import {
  AUTHORED_JOURNEY_ROUTE_IDS,
  authoredJourneyModeHref,
  authoredJourneyUsesActorMaterials,
} from '../content-design/mode-href.mjs';

const target = Object.freeze({
  'phase-remix': { actorId: 'east-carrier', role: 'heading-interceptor', mode: 'head-intercept' },
  'livewire-remix': { actorId: 'carrier', role: 'trail-pursuer', mode: 'trail-pursuit' },
});
const PRESETS = ['gentle', 'standard', 'expert'];
const beforeSource = createCulturalPressureTriptychCandidates({ artwork: true });
const source = createCurrentRemixPressureCandidates({ artwork: true });
const beforeProject = compileContentProject(beforeSource);
const project = compileContentProject(source);

test('current pair changes only the two Remix actor roles over v34', () => {
  assert.deepEqual(CURRENT_REMIX_PRESSURE_IDS, Object.keys(target));
  assert.deepEqual(source.maps, beforeSource.maps);
  assert.deepEqual(source.assets, beforeSource.assets);
  assert.deepEqual(source.campaigns, beforeSource.campaigns);
  assert.deepEqual(source.packs, beforeSource.packs);
  assert.equal(source.revision, CURRENT_REMIX_PRESSURE_REVISION);

  for (const current of source.missions) {
    const previous = beforeSource.missions.find((item) => item.id === current.id);
    const expected = target[current.id];
    if (!expected) {
      assert.deepEqual(current, previous, current.id);
      continue;
    }
    assert.equal(current.revision, CURRENT_REMIX_PRESSURE_REVISION);
    assert.equal(current.actors.length, previous.actors.length);
    assert.equal(
      previous.actors.find((actor) => actor.id === expected.actorId).role,
      'field-keeper',
    );
    assert.equal(current.actors.find((actor) => actor.id === expected.actorId).role, expected.role);
    assert.deepEqual(
      current.actors.filter((actor) => actor.id !== expected.actorId),
      previous.actors.filter((actor) => actor.id !== expected.actorId),
    );
    for (const key of [
      'map',
      'objectives',
      'bonuses',
      'timedBonuses',
      'coverage',
      'timeLimitSeconds',
      'presentation',
    ])
      assert.deepEqual(current[key], previous[key], `${current.id}/${key}`);
  }
});

test('finite pressure prepares once and paired boards stay identical across presets', () => {
  for (const [id, expected] of Object.entries(target))
    for (const difficulty of PRESETS) {
      const previous = resolveMission(beforeProject, id, { mode: 'solo', difficulty });
      const solo = resolveMission(project, id, { mode: 'solo', difficulty });
      const versus = resolveMission(project, id, { mode: 'versus', difficulty });
      assert.notEqual(solo.simulationIdentity, previous.simulationIdentity);
      assert.equal(solo.level.enemies.length, previous.level.enemies.length);
      assert.deepEqual(versus.level, solo.level);
      const pressure = solo.level.classic.enemyPressure.actors;
      assert.equal(pressure.length, 1, `${id}/${difficulty}`);
      assert.deepEqual(
        {
          id: pressure[0].id,
          warningTicks: pressure[0].warningTicks,
          commitTicks: pressure[0].commitTicks,
          cooldownTicks: pressure[0].cooldownTicks,
          mode: pressure[0].mode,
        },
        {
          id: expected.actorId,
          warningTicks: 90,
          commitTicks: 144,
          cooldownTicks: { gentle: 441, standard: 300, expert: 229 }[difficulty],
          mode: expected.mode,
        },
      );
      assert.equal(project.actors.roles[expected.role].retainsField, true);
    }
});

test('v35 is an immutable opt-in route and preserves v34', async () => {
  const current = createAuthoredJourneyRoute('whole-spatial-v35');
  const previous = createAuthoredJourneyRoute('whole-spatial-v34');
  const loaded = await loadAuthoredJourneyRoute('whole-spatial-v35');
  assert.equal(current.profileKey, 'journey-whole-spatial-v35');
  assert.equal(current.sessionKey, 'revealline.suspended.journey-whole-spatial.v35');
  assert.equal(current.source.revision, CURRENT_REMIX_PRESSURE_REVISION);
  assert.equal(previous.source.revision, beforeSource.revision);
  assert.deepEqual(loaded, current);
  assert(AUTHORED_JOURNEY_ROUTE_IDS.includes(current.id));
  assert(authoredJourneyUsesActorMaterials(current.id));
  assert(Object.isFrozen(current));
  assert(Object.isFrozen(current.source));
  assert.equal(authoredJourneyModeHref(current.id, 'solo'), '../?journey=whole-spatial-v35');
  assert.equal(
    authoredJourneyModeHref(current.id, 'versus'),
    'couch/?journey=whole-spatial-v35&return=solo',
  );
});

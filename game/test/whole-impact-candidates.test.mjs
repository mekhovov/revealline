import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWholeImpactCandidates,
  createWholeSortingCandidates,
} from '../content-design/whole-spatial-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createAuthoredJourneyRoute } from '../content-design/route.mjs';
import { loadAuthoredJourneyRoute } from '../content-design/route-loader.mjs';
import {
  authoredJourneyModeHref,
  authoredJourneyUsesActorMaterials,
} from '../content-design/mode-href.mjs';
import { DEFAULT_JOURNEY_ROUTES } from '../content-design/default-entry.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';

const baseline = createWholeSortingCandidates({ artwork: true });
const source = createWholeImpactCandidates({ artwork: true });
const project = compileContentProject(source);

test('successor preserves v5 geometry, objectives, pictures and actor motion while retiring carrier roles', () => {
  assert.equal(source.missions.length, 91);
  assert.deepEqual(source.maps, baseline.maps);
  assert.deepEqual(source.assets, baseline.assets);
  assert.deepEqual(
    source.missions.map(({ actors: _actors, design: _design, ...mission }) => mission),
    baseline.missions.map(({ actors: _actors, design: _design, ...mission }) => mission),
  );
  let retired = 0;
  for (let index = 0; index < source.missions.length; index++) {
    const before = baseline.missions[index],
      after = source.missions[index];
    assert.equal(after.id, before.id);
    assert.equal(after.actors.length, before.actors.length);
    for (let actor = 0; actor < after.actors.length; actor++) {
      const old = before.actors[actor],
        current = after.actors[actor];
      assert.deepEqual(
        { ...current, role: old.role },
        old,
        `${after.id}/${current.id} must retain its exact authored motion`,
      );
      if (old.role === 'impact-carrier') {
        retired++;
        assert.equal(current.role, 'field-keeper');
      } else assert.equal(current.role, old.role);
    }
  }
  assert.equal(retired, 14);
  assert.equal(
    source.missions
      .flatMap((mission) => mission.actors)
      .some((actor) => actor.role === 'impact-carrier'),
    false,
  );
});

test('current Journey compiles one global authored impact speed in Solo and Versus at every preset', () => {
  let resolved = 0;
  for (const mission of source.missions)
    for (const difficulty of ['gentle', 'standard', 'expert']) {
      const solo = resolveMission(project, mission.id, { mode: 'solo', difficulty });
      const versus = resolveMission(project, mission.id, { mode: 'versus', difficulty });
      for (const manifest of [solo, versus]) {
        assert.equal(manifest.policyId, 'journey-trail-impact-v3');
        assert.deepEqual(manifest.level.classic.lineImpact, {
          version: 'line-impact.v1',
          speed: 24,
        });
        resolved++;
      }
      assert.deepEqual(
        versus.level,
        solo.level,
        `${mission.id}/${difficulty} must use one paired-board simulation`,
      );
      assert.equal(versus.simulationIdentity, solo.simulationIdentity);
    }
  assert.equal(resolved, 546);
});

test('runtime tuning applies the authored impact speed exactly once', () => {
  const authored = resolveMission(project, 'first-return', { difficulty: 'standard' }).level;
  const near = (actual, expected) => assert(Math.abs(actual - expected) < 1e-9);
  assert.equal(authored.classic.lineImpact.speed, 24);
  near(
    applyGameplayTuning(authored, resolveGameplayTuning('gentle')).classic.lineImpact.speed,
    28.8,
  );
  near(
    applyGameplayTuning(authored, resolveGameplayTuning('standard')).classic.lineImpact.speed,
    38.4,
  );
  near(applyGameplayTuning(authored, resolveGameplayTuning('expert')).classic.lineImpact.speed, 48);
});

test('v5 remains historical while v6 keeps isolated persistence after the normal entry advances', async () => {
  const historical = compileContentProject(createWholeSortingCandidates());
  assert.equal(resolveMission(historical, 'first-return').level.classic.lineImpact, undefined);
  assert.equal(
    resolveMission(historical, 'return-in-reserve').level.classic.lineImpact.version,
    'line-impact.v2',
  );
  const route = createAuthoredJourneyRoute('whole-spatial-v6');
  assert.deepEqual(await loadAuthoredJourneyRoute(route.id), route);
  assert.equal(route.profileKey, 'journey-whole-spatial-v6');
  assert.notEqual(route.profileKey, createAuthoredJourneyRoute('whole-spatial-v5').profileKey);
  assert(authoredJourneyUsesActorMaterials(route.id));
  assert.equal(authoredJourneyModeHref(route.id, 'solo'), '../?journey=whole-spatial-v6');
  assert.equal(
    authoredJourneyModeHref(route.id, 'versus'),
    'couch/?journey=whole-spatial-v6&return=solo',
  );
  assert.deepEqual(DEFAULT_JOURNEY_ROUTES, {
    solo: 'whole-spatial-v25',
    versus: 'whole-spatial-v25',
    team: 'team-trail-impact-originals-1',
  });
});

test('the second Prologue mission teaches global impacts without changing the first three layouts or objectives', () => {
  assert.equal(source.missions[1].id, 'choose-your-share');
  assert(source.missions[1].design.introduces.includes('travelling-trail-impact'));
  for (let index = 0; index < 3; index++) {
    assert.deepEqual(source.missions[index].map, baseline.missions[index].map);
    assert.deepEqual(source.missions[index].objectives, baseline.missions[index].objectives);
  }
  for (const mission of source.missions.slice(2))
    assert(
      [...mission.design.introduces, ...mission.design.practices].includes(
        'travelling-trail-impact',
      ),
      mission.id,
    );
});

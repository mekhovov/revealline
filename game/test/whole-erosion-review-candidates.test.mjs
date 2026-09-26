import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWholeCulturalPressureCandidates,
  createWholeErosionReviewCandidates,
} from '../content-design/whole-spatial-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { inspectErosionCounterplay } from '../content-design/pressure-candidates.mjs';
import { createAuthoredJourneyRoute } from '../content-design/route.mjs';
import { loadAuthoredJourneyRoute } from '../content-design/route-loader.mjs';
import { authoredJourneyModeHref } from '../content-design/mode-href.mjs';
import { DEFAULT_JOURNEY_ROUTES } from '../content-design/default-entry.mjs';

const changed = new Set(['cooling-loop', 'crosswind-remix', 'final-broadcast', 'apex-remix']);
const baseline = createWholeCulturalPressureCandidates({ artwork: true });
const source = createWholeErosionReviewCandidates({ artwork: true });
const before = compileContentProject(baseline);
const project = compileContentProject(source);

test('erosion review changes four late design records without changing gameplay content', () => {
  assert.equal(source.missions.length, 91);
  assert.deepEqual(source.maps, baseline.maps);
  assert.deepEqual(source.assets, baseline.assets);
  for (let index = 0; index < source.missions.length; index++) {
    const old = baseline.missions[index],
      mission = source.missions[index];
    assert.equal(mission.id, old.id);
    assert.deepEqual(mission.map, old.map);
    assert.deepEqual(mission.actors, old.actors);
    assert.deepEqual(mission.objectives, old.objectives);
    assert.deepEqual(mission.bonuses, old.bonuses);
    assert.equal(mission.coverage, old.coverage);
    assert.equal(mission.timeLimitSeconds, old.timeLimitSeconds);
    assert.deepEqual(mission.presentation, old.presentation);
    if (!changed.has(mission.id)) assert.deepEqual(mission, old, mission.id);
    else {
      assert.equal(mission.revision, 'erosion-counterplay-1');
      assert(mission.design.practices.includes('territory-erosion'));
      assert.match(mission.design.counterplay, /repair/i);
      assert.match(mission.design.counterplay, /return|route|connector|circuit/i);
    }
  }
});

test('shared inspector records all eleven erosion missions without claiming human balance', () => {
  const audit = inspectErosionCounterplay(source);
  assert.equal(audit.format, 'JourneyErosionCounterplayAuditV1');
  assert.equal(audit.missionCount, 11);
  assert(audit.rows.every((row) => row.authoredSignalsPresent));
  assert(audit.rows.every((row) => row.permanentReturnCount > 0));
  assert(audit.rows.every((row) => row.coverage <= 0.85));
  assert(audit.rows.every((row) => row.recordsErosion));
  assert(
    audit.rows.every((row) =>
      row.requiredCaptureObjectiveIds.every((id) => !/repair|erosion/i.test(id)),
    ),
  );
  assert.deepEqual(audit.pending, [
    'repair-versus-escape-route-usefulness',
    'ordinary-clear-without-prolonged-cleanup',
    'warning-readability-and-voluntary-retry',
  ]);
});

test('late design corrections preserve exact simulation identities for every preset and mode', () => {
  for (const id of changed)
    for (const mode of ['solo', 'versus'])
      for (const difficulty of ['gentle', 'standard', 'expert']) {
        const old = resolveMission(before, id, { mode, difficulty });
        const current = resolveMission(project, id, { mode, difficulty });
        assert.equal(
          current.simulationIdentity,
          old.simulationIdentity,
          `${id}/${mode}/${difficulty}`,
        );
        assert.deepEqual(
          { ...current.level, revision: old.level.revision },
          old.level,
          `${id}/${mode}/${difficulty}`,
        );
      }
});

test('v8 stays historical while v9 gets isolated progress and becomes the normal entry', async () => {
  const old = createAuthoredJourneyRoute('whole-spatial-v8');
  const route = createAuthoredJourneyRoute('whole-spatial-v9');
  assert.deepEqual(await loadAuthoredJourneyRoute(route.id), route);
  assert.equal(route.profileKey, 'journey-whole-spatial-v9');
  assert.notEqual(route.profileKey, old.profileKey);
  assert.equal(authoredJourneyModeHref(route.id, 'solo'), '../?journey=whole-spatial-v9');
  assert.equal(
    authoredJourneyModeHref(route.id, 'versus'),
    'couch/?journey=whole-spatial-v9&return=solo',
  );
  assert.equal(DEFAULT_JOURNEY_ROUTES.solo, 'whole-spatial-v21');
  assert.equal(DEFAULT_JOURNEY_ROUTES.versus, 'whole-spatial-v21');
});

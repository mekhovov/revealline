import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createWholeSortingCandidates,
  createWholeVarietyCandidates,
} from '../content-design/whole-spatial-candidates.mjs';
import { createRoverSpatialCandidates } from '../content-design/rover-spatial-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createAuthoredJourneyRoute } from '../content-design/route.mjs';
import { loadAuthoredJourneyRoute } from '../content-design/route-loader.mjs';
import {
  authoredJourneyModeHref,
  authoredJourneyUsesActorMaterials,
} from '../content-design/mode-href.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../replay.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';
import {
  createSortingEvidence,
  sortingBeforeStep,
  observeSortingStep,
  inspectSortingEvidence,
} from './helpers/sorting-goal.mjs';

const project = compileContentProject(createWholeSortingCandidates({ artwork: true }));
const donor = compileContentProject(createRoverSpatialCandidates());
for (const artwork of [false, true])
  test(`one revised mission preserves the other90, all pictures and library order: ${artwork}`, () => {
    const before = createWholeVarietyCandidates({ artwork });
    const source = createWholeSortingCandidates({ artwork });
    const baseline = compileContentProject(before),
      combined = compileContentProject(source);
    assert.equal(source.missions.length, 91);
    assert.equal(source.maps.length, 91);
    assert.deepEqual(source.assets, before.assets);
    for (const key of ['missions', 'campaigns', 'packs'])
      assert.deepEqual(
        source[key].map((x) => x.id),
        before[key].map((x) => x.id),
      );
    assert.equal(source.revision, 'sorting-lanes-review-1');
    for (const mission of source.missions)
      for (const difficulty of ['gentle', 'standard', 'expert']) {
        const actual = resolveMission(combined, mission.id, { difficulty });
        const old = resolveMission(baseline, mission.id, { difficulty });
        assert.equal(actual.officialProgressEligible, false);
        assert.deepEqual(actual.background, old.background);
        assert.deepEqual(
          actual.level,
          resolveMission(combined, mission.id, { difficulty, mode: 'versus' }).level,
        );
        if (mission.id !== 'sorting-yard') assert.deepEqual(actual, old);
        else {
          assert.equal(
            actual.simulationIdentity,
            resolveMission(donor, mission.id, { difficulty }).simulationIdentity,
          );
          assert.notEqual(actual.simulationIdentity, old.simulationIdentity);
        }
      }
    source.maps.at(-1).walls[0].x++;
    assert.deepEqual(createWholeVarietyCandidates({ artwork }), before);
    assert.notDeepEqual(createWholeSortingCandidates({ artwork }), source);
  });

test('one shared route has isolated persistence, optional arcs, themes and same-edition mode links', async () => {
  const current = createAuthoredJourneyRoute('whole-spatial-v5'),
    old = createAuthoredJourneyRoute('whole-spatial-v4');
  assert.deepEqual(await loadAuthoredJourneyRoute(current.id), current);
  assert.equal(current.profileKey, 'journey-whole-spatial-v5');
  assert.notEqual(current.sessionKey, old.sessionKey);
  assert.notEqual(current.profileKey, old.profileKey);
  assert.deepEqual(current.corePackIds, old.corePackIds);
  assert.deepEqual(current.optionalCampaignIds, old.optionalCampaignIds);
  assert.equal(current.preserveOriginalThemes, true);
  assert(authoredJourneyUsesActorMaterials(current.id));
  assert.match(current.label, /balance pending/);
  assert.equal(authoredJourneyModeHref(current.id, 'solo'), '../?journey=whole-spatial-v5');
  assert.equal(
    authoredJourneyModeHref(current.id, 'versus'),
    'couch/?journey=whole-spatial-v5&return=solo',
  );
});

for (const kind of ['spatial', 'mastery']) {
  const fixture = JSON.parse(
    await readFile(new URL(`./fixtures/rover-sorting-${kind}-routes.json`, import.meta.url)),
  );
  for (const row of fixture.rows)
    test(`combined ${kind} route retains exact gameplay/replay/race: ${row.difficulty}/${row.turnPolicy}`, () => {
      const manifest = resolveMission(project, row.id, { difficulty: row.difficulty });
      assert.equal(manifest.simulationIdentity, row.simulationIdentity);
      const options = { seed: row.seed, classId: 'scout', turnPolicy: row.turnPolicy };
      const run = createRun(manifest.level, options),
        recorder = createRecorder(manifest.level, options);
      const duel = createDuel(manifest.level, options, {
        protocol: UNTIMED_DUEL_PROTOCOL,
        seconds: 0,
      });
      resumeDuel(duel);
      const evidence = createSortingEvidence(run);
      for (const { direction, ticks } of row.segments)
        for (let i = 0; i < ticks; i++) {
          assert.equal(run.status, 'running');
          const before = sortingBeforeStep(run);
          recordInput(recorder, { direction });
          stepRun(run, { direction }, FIXED_DT);
          stepDuel(duel, [{ direction }, { direction }]);
          observeSortingStep(run, evidence, before);
          assert.equal(run.classic.livesLost, 0);
        }
      assert.equal(run.status, 'won');
      assert.equal(run.tick, row.ticks);
      assert.equal(run.coverage, row.coverage);
      assert.equal(authoritativeCheckpoint(run).hash, row.checkpoint);
      assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
      assert.equal(duel.status, 'finished');
      assert.equal(duel.winner, null);
      for (const board of duel.runs)
        assert.equal(authoritativeCheckpoint(board).hash, authoritativeCheckpoint(run).hash);
      if (kind === 'mastery') assert.equal(inspectSortingEvidence(run, evidence).mastered, true);
    });
}

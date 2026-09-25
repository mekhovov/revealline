import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createSpatialNextBatchCandidates,
  SPATIAL_NEXT_BATCH_REVISION,
  SPATIAL_NEXT_BATCH_SELECTIONS,
  SPATIAL_NEXT_BATCH_SOURCES,
} from '../content-design/spatial-next-batch-candidates.mjs';
import { createWholeErosionReviewCandidates } from '../content-design/whole-spatial-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { inspectMissionTopology } from '../content-design/diagnostics.mjs';
import { createAuthoredJourneyRoute } from '../content-design/route.mjs';
import { loadAuthoredJourneyRoute } from '../content-design/route-loader.mjs';
import { DEFAULT_JOURNEY_ROUTES } from '../content-design/default-entry.mjs';
import {
  AUTHORED_JOURNEY_ROUTE_IDS,
  authoredJourneyModeHref,
  authoredJourneyUsesActorMaterials,
} from '../content-design/mode-href.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  exportReplay,
  recordInput,
  verifyReplay,
} from '../replay.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';

const IDS = SPATIAL_NEXT_BATCH_SELECTIONS.map((item) => item.id);
const PRESETS = ['gentle', 'standard', 'expert'];
const CONTROLS = ['immediate', 'grid-center'];
const RESERVED_BY_OPEN_SPATIAL_PRS = new Set([
  'two-bays',
  'neon-remix',
  'broken-yard',
  'read-the-arrows',
  'twin-receivers',
  'crossing-complete',
  'cross-stitch-crossings',
  'rushnyk-bands',
  'pysanka-sections',
  'four-motor-landings',
  'circuit-lanes',
  'twin-lens-chambers',
  'toolbench-weave',
  'dnipro-crossings',
  'two-districts',
  'two-ways-home',
  'second-approach',
  'windbreak-weave',
  'garden-refuges',
  'four-quarters',
  'survey-markers',
  'split-berths',
  'stepped-return',
  'dogleg-return',
  'staggered-circuit',
  'bank-the-crossing',
  'five-anchors',
  'dogleg-transfer',
  'first-link',
  'three-compounds',
  'spiral-stores',
  'nested-relays',
  'watchpost-exchange',
  'compass-array',
  'outer-loop',
]);
const oldSource = createWholeErosionReviewCandidates({ artwork: true });
const source = createSpatialNextBatchCandidates({ artwork: true });
const oldProject = compileContentProject(oldSource);
const project = compileContentProject(source);

const mission = (compiled, id) => compiled.missions.find((item) => item.id === id);
const map = (compiled, id) => {
  const owner = mission(compiled, id);
  return compiled.maps.find(
    (item) => item.source.id === owner.map.id && item.source.revision === owner.map.revision,
  );
};

test('selection is exactly three existing, culturally separated, unclaimed identities', () => {
  assert.deepEqual(IDS, ['stepping-stones', 'return-pocket', 'neutral-ground']);
  assert.equal(new Set(IDS).size, 3);
  assert(IDS.every((id) => oldSource.missions.some((item) => item.id === id)));
  assert(IDS.every((id) => !RESERVED_BY_OPEN_SPATIAL_PRS.has(id)));
  for (const selection of SPATIAL_NEXT_BATCH_SELECTIONS) {
    assert.equal(selection.approaches.length, 2);
    assert.equal(new Set(selection.approaches).size, 2);
    assert(selection.pressurePoints.length >= 3 && selection.pressurePoints.length <= 5);
    assert(selection.sourceIds.every((id) => SPATIAL_NEXT_BATCH_SOURCES[id]));
  }
  assert.deepEqual(
    SPATIAL_NEXT_BATCH_SELECTIONS.map((item) => item.sourceIds),
    [
      ['lemkoPysanka', 'pysankaTradition'],
      ['podilliaWovenRushnyk', 'podilliaEmbroideredRushnyk'],
      ['petrykivka'],
    ],
  );
  assert(!JSON.stringify(SPATIAL_NEXT_BATCH_SOURCES).toLowerCase().includes('vyshyvanka'));
  for (const item of Object.values(SPATIAL_NEXT_BATCH_SOURCES)) {
    assert.match(item.url, /^https:\/\/(honchar\.org\.ua|ich\.unesco\.org)\//);
    assert.match(
      item.adaptationBoundary,
      /(no |does not |do not |not a ).*(cop|reproduc|transcrib)/i,
    );
  }
});

for (const artwork of [false, true])
  test(`copy-on-write changes only three missions and their owning dependency records: artwork=${artwork}`, () => {
    const before = createWholeErosionReviewCandidates({ artwork });
    const snapshot = structuredClone(before);
    const revised = createSpatialNextBatchCandidates({ artwork });
    assert.deepEqual(createWholeErosionReviewCandidates({ artwork }), snapshot);
    assert.equal(revised.revision, SPATIAL_NEXT_BATCH_REVISION);
    assert.equal(revised.policyId, before.policyId);
    assert.equal(revised.actorCatalogId, before.actorCatalogId);
    assert.equal(revised.difficultyCatalogId, before.difficultyCatalogId);
    assert.deepEqual(revised.assets, before.assets);
    for (const key of ['missions', 'campaigns', 'packs'])
      assert.deepEqual(
        revised[key].map((item) => item.id),
        before[key].map((item) => item.id),
      );

    for (const current of revised.missions) {
      const previous = before.missions.find((item) => item.id === current.id);
      if (!IDS.includes(current.id)) assert.deepEqual(current, previous);
      else {
        assert.equal(current.revision, SPATIAL_NEXT_BATCH_REVISION);
        for (const key of [
          'id',
          'name',
          'spawnId',
          'modes',
          'actors',
          'objectives',
          'bonuses',
          'timedBonuses',
          'coverage',
          'timeLimitSeconds',
          'presentation',
        ])
          assert.deepEqual(current[key], previous[key], `${current.id}/${key}`);
        assert.deepEqual(current.design.difficulty, previous.design.difficulty);
      }
    }

    const owningCampaigns = new Set(['horizon-school', 'border-bloom', 'signal-gardens']);
    const owningPacks = new Set(['journey-opening', 'journey-border', 'journey-signal']);
    for (const current of revised.campaigns) {
      const previous = before.campaigns.find((item) => item.id === current.id);
      if (owningCampaigns.has(current.id)) {
        assert.equal(current.revision, SPATIAL_NEXT_BATCH_REVISION);
        assert.deepEqual(current.missionIds, previous.missionIds);
      } else assert.deepEqual(current, previous);
    }
    for (const current of revised.packs) {
      const previous = before.packs.find((item) => item.id === current.id);
      if (owningPacks.has(current.id)) {
        assert.equal(current.revision, SPATIAL_NEXT_BATCH_REVISION);
        assert.deepEqual(current.campaignIds, previous.campaignIds);
      } else assert.deepEqual(current, previous);
    }
  });

test('topology has one reachable field and no single-exit component', () => {
  const expectedWalls = { 'stepping-stones': 0, 'return-pocket': 0, 'neutral-ground': 0 };
  const expectedBudgets = {
    'stepping-stones': {
      oldFoundations: 64,
      newFoundations: 62,
      oldEligible: 2316,
      newEligible: 2318,
    },
    'return-pocket': {
      oldFoundations: 165,
      newFoundations: 154,
      oldEligible: 2215,
      newEligible: 2226,
    },
    'neutral-ground': {
      oldFoundations: 145,
      newFoundations: 140,
      oldEligible: 2235,
      newEligible: 2240,
    },
  };
  for (const id of IDS) {
    const previous = map(oldProject, id);
    const current = map(project, id);
    assert.notEqual(current.geometryIdentity, previous.geometryIdentity);
    assert.deepEqual(
      {
        oldFoundations: previous.geometry.foundationCount,
        newFoundations: current.geometry.foundationCount,
        oldEligible: previous.geometry.eligibleCount,
        newEligible: current.geometry.eligibleCount,
      },
      expectedBudgets[id],
    );
    const coverage = mission(project, id).coverage;
    assert(
      Math.ceil(current.geometry.eligibleCount * coverage) >=
        Math.ceil(previous.geometry.eligibleCount * coverage),
    );
    assert.equal(current.source.walls.length, expectedWalls[id]);
    assert.deepEqual(current.source.terrain, previous.source.terrain);
    assert.deepEqual(current.source.speedZones, previous.source.speedZones);
    assert.deepEqual(
      current.geometry.terrain.map((kind, index) => (current.geometry.eligible[index] ? kind : 0)),
      previous.geometry.terrain.map((kind, index) =>
        previous.geometry.eligible[index] ? kind : 0,
      ),
      `${id}/effective terrain`,
    );
    assert.equal(current.geometry.fieldComponents.length, 1);
    assert(current.geometry.safeComponents.every((component) => component.departures.length >= 4));
    assert.deepEqual(
      current.geometry.diagnostics.map((item) => item.code),
      ['disconnected-foundations'],
    );
    for (const difficulty of PRESETS) {
      const manifest = resolveMission(project, id, { difficulty });
      assert.deepEqual(inspectMissionTopology(manifest.level, current.geometry).diagnostics, []);
    }
  }
});

test('current collision actors, scaling, bonuses and movement rules are exact', () => {
  const roles = new Set(['field-keeper', 'frontier-patrol', 'perimeter-patrol']);
  for (const id of IDS)
    for (const difficulty of PRESETS) {
      const before = resolveMission(oldProject, id, { difficulty, mode: 'solo' });
      const solo = resolveMission(project, id, { difficulty, mode: 'solo' });
      const versus = resolveMission(project, id, { difficulty, mode: 'versus' });
      assert(mission(project, id).actors.every((actor) => roles.has(actor.role)));
      assert.deepEqual(solo.level.enemies, before.level.enemies);
      assert.deepEqual(solo.level.rules, before.level.rules);
      assert.deepEqual(solo.level.terrain, before.level.terrain);
      assert.deepEqual(solo.level.objectives, before.level.objectives);
      assert.deepEqual(solo.level.powerups, before.level.powerups);
      assert.deepEqual(solo.level.timedBonuses, before.level.timedBonuses);
      assert.deepEqual(versus.level, solo.level);
      assert.equal(solo.officialProgressEligible, false);
    }
});

function stepUntil(run, direction, predicate, sidecars = {}, maxTicks = 5000) {
  for (let tick = 0; tick < maxTicks; tick++) {
    if (sidecars.recorder) recordInput(sidecars.recorder, { direction });
    stepRun(run, { direction }, FIXED_DT);
    if (sidecars.duel) stepDuel(sidecars.duel, [{ direction }, { direction }]);
    assert.equal(run.status, 'running');
    assert.equal(run.classic.livesLost, 0);
    if (predicate(run)) return;
  }
  assert.fail(`route did not reach its authored decision within ${maxTicks} ticks`);
}

function closeRoute(run, id, approach, sidecars = {}) {
  const position = (direction, predicate) => stepUntil(run, direction, predicate, sidecars);
  const close = (direction) =>
    stepUntil(
      run,
      direction,
      (state) => state.events.some((event) => event.type === 'cut.closed'),
      sidecars,
    );
  if (id === 'stepping-stones' && approach === 'near-spikelet-first') close('down');
  else if (id === 'stepping-stones' && approach === 'sun-landing-first') {
    position('right', (state) => state.player.x >= 35.4);
    close('down');
  } else if (id === 'return-pocket' && approach === 'upper-band-first') {
    position('up', (state) => state.player.y <= 11.6);
    position('right', (state) => state.player.x >= 40.4);
    close('up');
  } else if (id === 'return-pocket' && approach === 'lower-band-first') {
    position('down', (state) => state.player.y >= 24.4);
    position('right', (state) => state.player.x >= 40.4);
    close('down');
  } else if (id === 'neutral-ground' && approach === 'slow-bed-first') {
    // Readable counterplay: commit once the west keeper is above and travelling
    // away from the horizontal trail, rather than relying on a fixed delay.
    position(null, (state) => {
      const keeper = state.enemies.find((enemy) => enemy.id === 'west');
      return keeper.y <= 14 && keeper.vy < 0;
    });
    close('left');
  } else if (id === 'neutral-ground' && approach === 'upper-branch-first') {
    position('up', (state) => state.player.y <= 8.6);
    close('right');
  } else throw new TypeError(`Unknown authored route ${id}/${approach}`);
}

const EXPECTED_CLAIMS = Object.freeze({
  'near-spikelet-first': 8,
  'sun-landing-first': 14,
  'upper-band-first': 9,
  'lower-band-first': 9,
  'slow-bed-first': 24,
  'upper-branch-first': 31,
});

for (const selection of SPATIAL_NEXT_BATCH_SELECTIONS)
  for (const difficulty of PRESETS)
    for (const turnPolicy of CONTROLS)
      test(`${selection.id} executes both documented approaches on ${difficulty}/${turnPolicy} across seeds`, () => {
        for (const approach of selection.approaches)
          for (const seed of [1, 2]) {
            const manifest = resolveMission(project, selection.id, { difficulty });
            const run = createRun(manifest.level, { seed, classId: 'scout', turnPolicy });
            closeRoute(run, selection.id, approach);
            assert.equal(run.claimedCount, EXPECTED_CLAIMS[approach]);
            assert.equal(run.player.cutting, false);
            assert.equal(run.player.speed, 0);
            assert.equal(run.events.filter((event) => event.type === 'cut.closed').length, 1);
          }
      });

for (const id of IDS)
  for (const difficulty of PRESETS)
    test(`${id} has a safe idle opening on ${difficulty} across seeds`, () => {
      const manifest = resolveMission(project, id, { difficulty });
      for (const seed of [1, 2]) {
        const run = createRun(manifest.level, { seed, classId: 'scout' });
        for (let tick = 0; tick < 720; tick++) stepRun(run, { direction: null }, FIXED_DT);
        assert.equal(run.status, 'running');
        assert.equal(run.classic.livesLost, 0);
        assert.equal(run.claimedCount, 0);
      }
    });

for (const selection of SPATIAL_NEXT_BATCH_SELECTIONS)
  for (const approach of selection.approaches)
    test(`${selection.id}/${approach} is replay-stable and equal on both Versus boards`, () => {
      const manifest = resolveMission(project, selection.id, { difficulty: 'standard' });
      const options = { seed: 1, classId: 'scout', turnPolicy: 'grid-center' };
      const run = createRun(manifest.level, options);
      const recorder = createRecorder(manifest.level, options);
      const duel = createDuel(manifest.level, options, {
        protocol: UNTIMED_DUEL_PROTOCOL,
        seconds: 0,
      });
      resumeDuel(duel);
      closeRoute(run, selection.id, approach, { recorder, duel });
      assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
      assert(duel.runs.every((candidate) => candidate.classic.livesLost === 0));
      assert.deepEqual(
        authoritativeCheckpoint(duel.runs[0]),
        authoritativeCheckpoint(duel.runs[1]),
      );
      assert.deepEqual(authoritativeCheckpoint(run), authoritativeCheckpoint(duel.runs[0]));
    });

test('registered successor preserves v9, authored Next order and same-edition navigation', async () => {
  const current = createAuthoredJourneyRoute('whole-spatial-v10');
  const previous = createAuthoredJourneyRoute('whole-spatial-v9');
  assert.deepEqual(await loadAuthoredJourneyRoute(current.id), current);
  assert.equal(current.profileKey, 'journey-whole-spatial-v10');
  assert.equal(current.sessionKey, 'revealline.suspended.journey-whole-spatial.v10');
  assert.notEqual(current.profileKey, previous.profileKey);
  assert.notEqual(current.sessionKey, previous.sessionKey);
  assert.deepEqual(previous.source, createWholeErosionReviewCandidates({ artwork: true }));
  assert.deepEqual(current.source, source);
  assert.deepEqual(current.corePackIds, previous.corePackIds);
  assert.deepEqual(current.optionalCampaignIds, previous.optionalCampaignIds);
  assert(authoredJourneyUsesActorMaterials(current.id));
  assert(AUTHORED_JOURNEY_ROUTE_IDS.includes(current.id));
  assert.deepEqual(DEFAULT_JOURNEY_ROUTES, {
    solo: 'whole-spatial-v12',
    versus: 'whole-spatial-v12',
    team: 'team-trail-impact-originals-1',
  });
  assert.equal(authoredJourneyModeHref(current.id, 'solo'), '../?journey=whole-spatial-v10');
  assert.equal(
    authoredJourneyModeHref(current.id, 'versus'),
    'couch/?journey=whole-spatial-v10&return=solo',
  );

  for (const key of ['campaigns', 'packs'])
    assert.deepEqual(
      current.source[key].map((item) =>
        key === 'campaigns' ? [item.id, item.missionIds] : [item.id, item.campaignIds],
      ),
      previous.source[key].map((item) =>
        key === 'campaigns' ? [item.id, item.missionIds] : [item.id, item.campaignIds],
      ),
    );
});

test('Studio retains separate v9 and v10 editions after the default advances', async () => {
  const html = await readFile(new URL('../studio/index.html', import.meta.url), 'utf8');
  const script = await readFile(new URL('../studio/studio.mjs', import.meta.url), 'utf8');
  assert.match(html, /value="erosion-counterplay-1">Erosion counterplay · v9/);
  assert.match(html, /value="cultural-spatial-triptych-1">[\s\S]*?spatial triptych · v10/i);
  assert.match(html, /journey=whole-spatial-v10/);
  assert.match(script, /'cultural-spatial-triptych-1': createSpatialNextBatchCandidates/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'parse5';
import {
  EARLY_CULTURAL_ROUTES_REVISION,
  EARLY_CULTURAL_ROUTES_SELECTIONS,
  EARLY_CULTURAL_ROUTES_SOURCES,
  createEarlyCulturalRoutesCandidates,
} from '../content-design/early-cultural-routes-candidates.mjs';
import { createBorderSignalCulturalNextBatchCandidates } from '../content-design/border-signal-cultural-next-batch-candidates.mjs';
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

const IDS = EARLY_CULTURAL_ROUTES_SELECTIONS.map((item) => item.id);
const PRESETS = ['gentle', 'standard', 'expert'];
const CONTROLS = ['immediate', 'grid-center'];
const beforeSource = createBorderSignalCulturalNextBatchCandidates({ artwork: true });
const source = createEarlyCulturalRoutesCandidates({ artwork: true });
const beforeProject = compileContentProject(beforeSource);
const project = compileContentProject(source);
const mission = (compiled, id) => compiled.missions.find((item) => item.id === id);
const map = (compiled, id) => {
  const owner = mission(compiled, id);
  return compiled.maps.find(
    (item) => item.source.id === owner.map.id && item.source.revision === owner.map.revision,
  );
};

test('selection is exactly three early-route identities with bounded cultural attribution', () => {
  assert.deepEqual(IDS, ['nearby-shore', 'two-bays', 'behind-the-patrol']);
  assert.equal(new Set(IDS).size, IDS.length);
  for (const selection of EARLY_CULTURAL_ROUTES_SELECTIONS) {
    assert(beforeSource.missions.some((item) => item.id === selection.id));
    assert.equal(selection.approaches.length, 2);
    assert.equal(new Set(selection.approaches).size, 2);
    assert(selection.pressurePoints.length >= 3 && selection.pressurePoints.length <= 5);
    assert(selection.sourceIds.every((id) => EARLY_CULTURAL_ROUTES_SOURCES[id]));
  }
  assert.match(EARLY_CULTURAL_ROUTES_SOURCES.crimeanTatarOrnek.url, /ich\.unesco\.org/);
  assert.match(EARLY_CULTURAL_ROUTES_SOURCES.ukrainianPysanka.url, /ich\.unesco\.org/);
  assert.match(
    EARLY_CULTURAL_ROUTES_SOURCES.krychevskyTactilePanels.url,
    /opishne-museum\.gov\.ua/,
  );
  for (const item of Object.values(EARLY_CULTURAL_ROUTES_SOURCES)) {
    assert(item.observedVocabulary.length >= 3);
    assert.match(item.adaptationBoundary, /No .*cop/i);
  }
});

for (const artwork of [false, true])
  test(`copy-on-write changes only selected missions and owners: artwork=${artwork}`, () => {
    const before = createBorderSignalCulturalNextBatchCandidates({ artwork });
    const snapshot = structuredClone(before);
    const revised = createEarlyCulturalRoutesCandidates({ artwork });
    assert.deepEqual(createBorderSignalCulturalNextBatchCandidates({ artwork }), snapshot);
    assert.equal(revised.revision, EARLY_CULTURAL_ROUTES_REVISION);
    assert.equal(revised.policyId, before.policyId);
    assert.equal(revised.actorCatalogId, before.actorCatalogId);
    assert.equal(revised.difficultyCatalogId, before.difficultyCatalogId);
    assert.deepEqual(revised.assets, before.assets);
    for (const current of revised.missions) {
      const previous = before.missions.find((item) => item.id === current.id);
      if (!IDS.includes(current.id)) assert.deepEqual(current, previous);
      else {
        assert.equal(current.revision, EARLY_CULTURAL_ROUTES_REVISION);
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
        assert.deepEqual(current.design.introduces, previous.design.introduces);
        assert.deepEqual(current.design.practices, previous.design.practices);
        assert.deepEqual(current.design.combines, previous.design.combines);
      }
    }
    for (const current of revised.campaigns) {
      const previous = before.campaigns.find((item) => item.id === current.id);
      if (['horizon-school', 'border-bloom'].includes(current.id)) {
        assert.equal(current.revision, EARLY_CULTURAL_ROUTES_REVISION);
        assert.deepEqual(current.missionIds, previous.missionIds);
      } else assert.deepEqual(current, previous);
    }
  });

test('geometry preserves the intended field structure without adding permanent area', () => {
  const expected = {
    'nearby-shore': { before: 25, after: 25, fields: 1, safeComponents: 3 },
    'two-bays': { before: 102, after: 91, fields: 2, safeComponents: 1 },
    'behind-the-patrol': { before: 35, after: 35, fields: 1, safeComponents: 2 },
  };
  for (const id of IDS) {
    const previous = map(beforeProject, id);
    const current = map(project, id);
    assert.notEqual(current.geometryIdentity, previous.geometryIdentity);
    assert.equal(previous.geometry.foundationCount, expected[id].before);
    assert.equal(current.geometry.foundationCount, expected[id].after);
    assert(current.geometry.eligibleCount >= previous.geometry.eligibleCount);
    assert.equal(current.geometry.fieldComponents.length, expected[id].fields);
    assert.equal(current.geometry.safeComponents.length, expected[id].safeComponents);
    assert(current.geometry.safeComponents.every((component) => component.departures.length >= 4));
    assert.deepEqual(current.source.walls, previous.source.walls);
    assert.deepEqual(current.source.terrain, previous.source.terrain);
    assert.deepEqual(current.source.speedZones, previous.source.speedZones);
    for (const difficulty of PRESETS) {
      const manifest = resolveMission(project, id, { difficulty });
      assert.deepEqual(inspectMissionTopology(manifest.level, current.geometry).diagnostics, []);
    }
  }
});

test('actors, rules, hazards, bonuses and objectives remain exact across presets and modes', () => {
  for (const id of IDS)
    for (const difficulty of PRESETS) {
      const before = resolveMission(beforeProject, id, { difficulty, mode: 'solo' });
      const solo = resolveMission(project, id, { difficulty, mode: 'solo' });
      const versus = resolveMission(project, id, { difficulty, mode: 'versus' });
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

function stepUntil(run, direction, predicate, sidecars = {}, maxTicks = 7000) {
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
  if (id === 'nearby-shore' && approach === 'near-landing-first') {
    position('left', (state) => state.player.x <= 28.6);
    close('down');
  } else if (id === 'nearby-shore' && approach === 'far-landing-first') {
    position('right', (state) => state.player.x >= 40.4);
    close('down');
  } else if (id === 'two-bays' && approach === 'upper-step-first') {
    position('up', (state) => state.player.y <= 5.6);
    position('left', (state) => state.player.x <= 25.6);
    position('down', (state) => state.player.y >= 12.4);
    close('right');
  } else if (id === 'two-bays' && approach === 'lower-step-first') {
    position('down', (state) => state.player.y >= 29.4);
    position('right', (state) => state.player.x >= 45.4);
    position('up', (state) => state.player.y <= 22.6);
    close('left');
  } else if (id === 'behind-the-patrol' && approach === 'crossbar-first') close('down');
  else if (id === 'behind-the-patrol' && approach === 'stair-tip-first') {
    position('right', (state) => state.player.x >= 24.4);
    position('down', (state) => state.player.y >= 20.4);
    close('left');
  } else throw new TypeError(`Unknown authored route ${id}/${approach}`);
}

const EXPECTED_CLAIMS = Object.freeze({
  'near-landing-first': 11,
  'far-landing-first': 19,
  'upper-step-first': 68,
  'lower-step-first': 77,
  'crossbar-first': 14,
  'stair-tip-first': 21,
});

for (const selection of EARLY_CULTURAL_ROUTES_SELECTIONS)
  for (const difficulty of PRESETS)
    for (const turnPolicy of CONTROLS)
      test(`${selection.id} executes both approaches on ${difficulty}/${turnPolicy} across seeds`, () => {
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

for (const selection of EARLY_CULTURAL_ROUTES_SELECTIONS)
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

test('registered v14 successor preserves v13 order and uses isolated progress ownership', async () => {
  const current = createAuthoredJourneyRoute('whole-spatial-v14');
  const previous = createAuthoredJourneyRoute('whole-spatial-v13');
  assert.deepEqual(await loadAuthoredJourneyRoute(current.id), current);
  assert.equal(current.profileKey, 'journey-whole-spatial-v14');
  assert.equal(current.sessionKey, 'revealline.suspended.journey-whole-spatial.v14');
  assert.notEqual(current.profileKey, previous.profileKey);
  assert.notEqual(current.sessionKey, previous.sessionKey);
  assert.deepEqual(previous.source, beforeSource);
  assert.deepEqual(current.source, source);
  assert.deepEqual(current.corePackIds, previous.corePackIds);
  assert.deepEqual(current.optionalCampaignIds, previous.optionalCampaignIds);
  assert(authoredJourneyUsesActorMaterials(current.id));
  assert(AUTHORED_JOURNEY_ROUTE_IDS.includes(current.id));
  assert.deepEqual(DEFAULT_JOURNEY_ROUTES, {
    solo: 'whole-spatial-v20',
    versus: 'whole-spatial-v20',
    team: 'team-trail-impact-originals-1',
  });
  assert.equal(authoredJourneyModeHref(current.id, 'solo'), '../?journey=whole-spatial-v14');
  assert.equal(
    authoredJourneyModeHref(current.id, 'versus'),
    'couch/?journey=whole-spatial-v14&return=solo',
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

test('Studio retains v13 and v14 after the selector advances to v20', async () => {
  const html = await readFile(new URL('../studio/index.html', import.meta.url), 'utf8');
  const script = await readFile(new URL('../studio/studio.mjs', import.meta.url), 'utf8');
  const nodes = [];
  const visit = (node) => {
    nodes.push(node);
    node.childNodes?.forEach(visit);
  };
  visit(parse(html));
  const attribute = (node, name) => node.attrs?.find((item) => item.name === name)?.value;
  const selector = nodes.find((node) => attribute(node, 'id') === 'whole-variety-edition');
  const options = selector.childNodes.filter((node) => node.tagName === 'option');
  assert.equal(
    options.filter((node) => attribute(node, 'value') === 'border-signal-cultural-routes-1').length,
    1,
  );
  assert.deepEqual(
    options
      .filter((node) => attribute(node, 'selected') !== undefined)
      .map((node) => attribute(node, 'value')),
    ['phaseworks-cultural-routes-1'],
  );
  assert.match(html, /journey=whole-spatial-v14/);
  assert.match(script, /'early-cultural-routes-1': createEarlyCulturalRoutesCandidates/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'parse5';
import {
  BORDER_SIGNAL_CULTURAL_NEXT_BATCH_REVISION,
  BORDER_SIGNAL_CULTURAL_NEXT_BATCH_SELECTIONS,
  BORDER_SIGNAL_CULTURAL_NEXT_BATCH_SOURCES,
  createBorderSignalCulturalNextBatchCandidates,
} from '../content-design/border-signal-cultural-next-batch-candidates.mjs';
import { createBorderCulturalNextBatchCandidates } from '../content-design/border-cultural-next-batch-candidates.mjs';
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

const IDS = BORDER_SIGNAL_CULTURAL_NEXT_BATCH_SELECTIONS.map((item) => item.id);
const PRESETS = ['gentle', 'standard', 'expert'];
const CONTROLS = ['immediate', 'grid-center'];
const beforeSource = createBorderCulturalNextBatchCandidates({ artwork: true });
const source = createBorderSignalCulturalNextBatchCandidates({ artwork: true });
const beforeProject = compileContentProject(beforeSource);
const project = compileContentProject(source);
const mission = (compiled, id) => compiled.missions.find((item) => item.id === id);
const map = (compiled, id) => {
  const owner = mission(compiled, id);
  return compiled.maps.find(
    (item) => item.source.id === owner.map.id && item.source.revision === owner.map.revision,
  );
};

test('selection is exactly the researched Border/Signal trio with bounded attribution', () => {
  assert.deepEqual(IDS, ['border-remix', 'dry-spine', 'wide-approach']);
  assert.equal(new Set(IDS).size, 3);
  for (const selection of BORDER_SIGNAL_CULTURAL_NEXT_BATCH_SELECTIONS) {
    assert(beforeSource.missions.some((item) => item.id === selection.id));
    assert.equal(selection.approaches.length, 2);
    assert.equal(new Set(selection.approaches).size, 2);
    assert(selection.pressurePoints.length >= 3 && selection.pressurePoints.length <= 5);
    assert(selection.sourceIds.every((id) => BORDER_SIGNAL_CULTURAL_NEXT_BATCH_SOURCES[id]));
  }
  assert.match(BORDER_SIGNAL_CULTURAL_NEXT_BATCH_SOURCES.poltavaShirts.url, /museum\.kh\.ua/);
  assert.match(
    BORDER_SIGNAL_CULTURAL_NEXT_BATCH_SOURCES.bukovynaPysanka.url,
    /honchar\.org\.ua\/en\/collections\/detail\/1188/,
  );
  assert.match(
    BORDER_SIGNAL_CULTURAL_NEXT_BATCH_SOURCES.slobozhanshchynaRushnyk.url,
    /honchar\.org\.ua\/collections\/detail\/2006/,
  );
  for (const item of Object.values(BORDER_SIGNAL_CULTURAL_NEXT_BATCH_SOURCES)) {
    assert(item.observedVocabulary.length >= 3);
    assert.match(item.adaptationBoundary, /no .*cop/i);
  }
});

for (const artwork of [false, true])
  test(`copy-on-write changes only the selected missions and owners: artwork=${artwork}`, () => {
    const before = createBorderCulturalNextBatchCandidates({ artwork });
    const snapshot = structuredClone(before);
    const revised = createBorderSignalCulturalNextBatchCandidates({ artwork });
    assert.deepEqual(createBorderCulturalNextBatchCandidates({ artwork }), snapshot);
    assert.equal(revised.revision, BORDER_SIGNAL_CULTURAL_NEXT_BATCH_REVISION);
    assert.equal(revised.policyId, before.policyId);
    assert.equal(revised.actorCatalogId, before.actorCatalogId);
    assert.equal(revised.difficultyCatalogId, before.difficultyCatalogId);
    assert.deepEqual(revised.assets, before.assets);
    for (const current of revised.missions) {
      const previous = before.missions.find((item) => item.id === current.id);
      if (!IDS.includes(current.id)) assert.deepEqual(current, previous);
      else {
        assert.equal(current.revision, BORDER_SIGNAL_CULTURAL_NEXT_BATCH_REVISION);
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
      if (['border-remixes', 'signal-gardens'].includes(current.id)) {
        assert.equal(current.revision, BORDER_SIGNAL_CULTURAL_NEXT_BATCH_REVISION);
        assert.deepEqual(current.missionIds, previous.missionIds);
      } else assert.deepEqual(current, previous);
    }
  });

test('geometry preserves hazards and never increases permanent foundation area', () => {
  const budgets = {
    'border-remix': [135, 124],
    'dry-spine': [105, 105],
    'wide-approach': [90, 80],
  };
  for (const id of IDS) {
    const previous = map(beforeProject, id);
    const current = map(project, id);
    assert.notEqual(current.geometryIdentity, previous.geometryIdentity);
    assert.deepEqual(
      [previous.geometry.foundationCount, current.geometry.foundationCount],
      budgets[id],
    );
    assert(current.geometry.eligibleCount >= previous.geometry.eligibleCount);
    assert.deepEqual(current.source.walls, previous.source.walls);
    assert.deepEqual(current.source.terrain, previous.source.terrain);
    assert.deepEqual(current.source.speedZones, previous.source.speedZones);
    assert.equal(current.geometry.fieldComponents.length, 1);
    assert(current.geometry.safeComponents.every((component) => component.departures.length >= 4));
    for (const difficulty of PRESETS) {
      const manifest = resolveMission(project, id, { difficulty });
      assert.deepEqual(inspectMissionTopology(manifest.level, current.geometry).diagnostics, []);
    }
  }
  assert.equal(
    map(project, 'dry-spine').source.terrain.reduce((n, item) => n + item.w * item.h, 0),
    488,
  );
  assert.equal(
    map(project, 'wide-approach').source.terrain.reduce((n, item) => n + item.w * item.h, 0),
    432,
  );
});

test('all non-geometry gameplay behavior remains exact across modes and presets', () => {
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
  if (id === 'border-remix' && approach === 'central-stem-first') close('right');
  else if (id === 'border-remix' && approach === 'far-leaf-first') {
    position('up', (state) => state.player.y <= 6.6);
    position('right', (state) => state.player.x >= 50.4);
    close('down');
  } else if (id === 'dry-spine' && approach === 'upper-shoulder-first') {
    position('up', (state) => state.player.y <= 11.6);
    position('left', (state) => state.player.x <= 27.6);
    position('up', (state) => state.player.y <= 8.6);
    close('right');
  } else if (id === 'dry-spine' && approach === 'lower-shoulder-first') {
    position('down', (state) => state.player.y >= 23.4);
    position('right', (state) => state.player.x >= 40.4);
    position('down', (state) => state.player.y >= 26.4);
    position('left', (state) => state.player.x <= 36.6);
    close('up');
  } else if (id === 'wide-approach' && approach === 'west-hook-first') close('down');
  else if (id === 'wide-approach' && approach === 'east-hook-first') {
    position('right', (state) => state.player.x >= 52.4);
    close('down');
  } else throw new TypeError(`Unknown authored route ${id}/${approach}`);
}

const EXPECTED_CLAIMS = Object.freeze({
  'central-stem-first': 9,
  'far-leaf-first': 51,
  'upper-shoulder-first': 14,
  'lower-shoulder-first': 10,
  'west-hook-first': 14,
  'east-hook-first': 9,
});

for (const selection of BORDER_SIGNAL_CULTURAL_NEXT_BATCH_SELECTIONS)
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

for (const selection of BORDER_SIGNAL_CULTURAL_NEXT_BATCH_SELECTIONS)
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

test('registered v13 successor preserves v12 and authored order with isolated ownership', async () => {
  const current = createAuthoredJourneyRoute('whole-spatial-v13');
  const previous = createAuthoredJourneyRoute('whole-spatial-v12');
  assert.deepEqual(await loadAuthoredJourneyRoute(current.id), current);
  assert.equal(current.profileKey, 'journey-whole-spatial-v13');
  assert.equal(current.sessionKey, 'revealline.suspended.journey-whole-spatial.v13');
  assert.notEqual(current.profileKey, previous.profileKey);
  assert.notEqual(current.sessionKey, previous.sessionKey);
  assert.deepEqual(previous.source, beforeSource);
  assert.deepEqual(current.source, source);
  assert.deepEqual(current.corePackIds, previous.corePackIds);
  assert.deepEqual(current.optionalCampaignIds, previous.optionalCampaignIds);
  assert(authoredJourneyUsesActorMaterials(current.id));
  assert(AUTHORED_JOURNEY_ROUTE_IDS.includes(current.id));
  assert.deepEqual(DEFAULT_JOURNEY_ROUTES, {
    solo: 'whole-spatial-v25',
    versus: 'whole-spatial-v25',
    team: 'team-complete-specialist-originals-1',
  });
  assert.equal(authoredJourneyModeHref(current.id, 'solo'), '../?journey=whole-spatial-v13');
  assert.equal(
    authoredJourneyModeHref(current.id, 'versus'),
    'couch/?journey=whole-spatial-v13&return=solo',
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

test('Studio retains v12 and v13 after its selector advances to v20', async () => {
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
    options.filter((node) => attribute(node, 'value') === 'border-cultural-routes-1').length,
    1,
  );
  assert.deepEqual(
    options
      .filter((node) => attribute(node, 'selected') !== undefined)
      .map((node) => attribute(node, 'value')),
    ['apex-cultural-routes-1'],
  );
  assert.match(html, /journey=whole-spatial-v13/);
  assert.match(
    script,
    /'border-signal-cultural-routes-1': createBorderSignalCulturalNextBatchCandidates/,
  );
});

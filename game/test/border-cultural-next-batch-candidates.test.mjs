import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'parse5';
import {
  BORDER_CULTURAL_NEXT_BATCH_REVISION,
  BORDER_CULTURAL_NEXT_BATCH_SELECTIONS,
  BORDER_CULTURAL_NEXT_BATCH_SOURCES,
  createBorderCulturalNextBatchCandidates,
} from '../content-design/border-cultural-next-batch-candidates.mjs';
import { createHorizonNextBatchCandidates } from '../content-design/horizon-next-batch-candidates.mjs';
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

const IDS = BORDER_CULTURAL_NEXT_BATCH_SELECTIONS.map((item) => item.id);
const PRESETS = ['gentle', 'standard', 'expert'];
const CONTROLS = ['immediate', 'grid-center'];
const beforeSource = createHorizonNextBatchCandidates({ artwork: true });
const source = createBorderCulturalNextBatchCandidates({ artwork: true });
const beforeProject = compileContentProject(beforeSource);
const project = compileContentProject(source);

const mission = (compiled, id) => compiled.missions.find((item) => item.id === id);
const map = (compiled, id) => {
  const owner = mission(compiled, id);
  return compiled.maps.find(
    (item) => item.source.id === owner.map.id && item.source.revision === owner.map.revision,
  );
};

test('selection is exactly three unowned Border identities with distinct attributed media', () => {
  assert.deepEqual(IDS, ['second-landing', 'long-rail', 'new-frontier']);
  assert.equal(new Set(IDS).size, 3);
  for (const selection of BORDER_CULTURAL_NEXT_BATCH_SELECTIONS) {
    assert(beforeSource.missions.some((item) => item.id === selection.id));
    assert.equal(selection.approaches.length, 2);
    assert.equal(new Set(selection.approaches).size, 2);
    assert(selection.pressurePoints.length >= 3 && selection.pressurePoints.length <= 5);
    assert(selection.sourceIds.every((id) => BORDER_CULTURAL_NEXT_BATCH_SOURCES[id]));
  }
  assert.deepEqual(
    BORDER_CULTURAL_NEXT_BATCH_SELECTIONS.map((item) => item.sourceIds),
    [['reshetylivkaWhiteOnWhite'], ['petrykivkaPainting'], ['kosivPaintedCeramics']],
  );
  const reshetylivka = BORDER_CULTURAL_NEXT_BATCH_SOURCES.reshetylivkaWhiteOnWhite;
  const petrykivka = BORDER_CULTURAL_NEXT_BATCH_SOURCES.petrykivkaPainting;
  const kosiv = BORDER_CULTURAL_NEXT_BATCH_SOURCES.kosivPaintedCeramics;
  assert.match(reshetylivka.url, /^https:\/\/www\.unesco-centerbg\.org\//);
  assert.match(petrykivka.url, /^https:\/\/ich\.unesco\.org\/en\/RL\/petrykivka-/);
  assert.match(petrykivka.inventoryUrl, /^https:\/\/ich\.unesco\.org\/doc\/src\//);
  assert.match(kosiv.url, /^https:\/\/ich\.unesco\.org\/en\/RL\/tradition-of-kosiv-/);
  assert.match(reshetylivka.register, /National Register.*Ukraine/);
  assert.equal(petrykivka.nominationNumber, '00893');
  assert.equal(kosiv.nominationNumber, '01456');
  for (const item of Object.values(BORDER_CULTURAL_NEXT_BATCH_SOURCES))
    assert.match(item.adaptationBoundary, /no .*cop/i);
  assert(!JSON.stringify(petrykivka).toLowerCase().includes('embroidery'));
  assert(!JSON.stringify(kosiv).toLowerCase().includes('vyshyvanka'));
  assert(!JSON.stringify(reshetylivka).toLowerCase().includes('ceramic'));
});

for (const artwork of [false, true])
  test(`copy-on-write changes only three missions and the Border owner: artwork=${artwork}`, () => {
    const before = createHorizonNextBatchCandidates({ artwork });
    const snapshot = structuredClone(before);
    const revised = createBorderCulturalNextBatchCandidates({ artwork });
    assert.deepEqual(createHorizonNextBatchCandidates({ artwork }), snapshot);
    assert.equal(revised.revision, BORDER_CULTURAL_NEXT_BATCH_REVISION);
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
        assert.equal(current.revision, BORDER_CULTURAL_NEXT_BATCH_REVISION);
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
      if (current.id === 'border-bloom') {
        assert.equal(current.revision, BORDER_CULTURAL_NEXT_BATCH_REVISION);
        assert.deepEqual(current.missionIds, previous.missionIds);
      } else assert.deepEqual(current, previous);
    }
    for (const current of revised.packs) {
      const previous = before.packs.find((item) => item.id === current.id);
      if (current.id === 'journey-border') {
        assert.equal(current.revision, BORDER_CULTURAL_NEXT_BATCH_REVISION);
        assert.deepEqual(current.campaignIds, previous.campaignIds);
      } else assert.deepEqual(current, previous);
    }
  });

test('Border topology remains foundation-only and no easier by permanent area', () => {
  const expectedBudgets = {
    'second-landing': {
      oldFoundations: 99,
      newFoundations: 99,
      oldEligible: 2281,
      newEligible: 2281,
    },
    'long-rail': {
      oldFoundations: 116,
      newFoundations: 114,
      oldEligible: 2264,
      newEligible: 2266,
    },
    'new-frontier': {
      oldFoundations: 96,
      newFoundations: 96,
      oldEligible: 2284,
      newEligible: 2284,
    },
  };
  for (const id of IDS) {
    const previous = map(beforeProject, id);
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
    assert.deepEqual(current.source.walls, []);
    assert.deepEqual(current.source.terrain, []);
    assert.deepEqual(current.source.speedZones, undefined);
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

test('compiled v11 identities and all non-geometry behavior remain exact', () => {
  assert.equal(mission(beforeProject, 'new-frontier').revision, 'pressure-v2-c4ed661aaea4b903');
  assert.equal(
    resolveMission(beforeProject, 'new-frontier', { difficulty: 'standard' }).simulationIdentity,
    '983ed12de8bd7f70',
  );
  for (const id of IDS)
    for (const difficulty of PRESETS) {
      const before = resolveMission(beforeProject, id, { difficulty, mode: 'solo' });
      const solo = resolveMission(project, id, { difficulty, mode: 'solo' });
      const versus = resolveMission(project, id, { difficulty, mode: 'versus' });
      assert(
        mission(project, id).actors.every((actor) =>
          ['field-keeper', 'perimeter-patrol', 'frontier-patrol'].includes(actor.role),
        ),
      );
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
  if (id === 'second-landing' && approach === 'near-aperture-first') {
    position('right', (state) => state.player.x >= 20.4);
    close('down');
  } else if (id === 'second-landing' && approach === 'far-window-first') {
    position('right', (state) => state.player.x >= 52.4);
    close('down');
  } else if (id === 'long-rail' && approach === 'central-stem-first') close('down');
  else if (id === 'long-rail' && approach === 'outer-branch-first') {
    position('right', (state) => state.player.x >= 44.4);
    close('down');
  } else if (id === 'new-frontier' && approach === 'near-shoulder-first') {
    position('left', (state) => state.player.x <= 29.6);
    close('down');
  } else if (id === 'new-frontier' && approach === 'far-shoulder-first') {
    position('right', (state) => state.player.x >= 40.4);
    close('down');
  } else throw new TypeError(`Unknown authored route ${id}/${approach}`);
}

const EXPECTED_CLAIMS = Object.freeze({
  'near-aperture-first': 10,
  'far-window-first': 23,
  'central-stem-first': 9,
  'outer-branch-first': 20,
  'near-shoulder-first': 11,
  'far-shoulder-first': 11,
});

for (const selection of BORDER_CULTURAL_NEXT_BATCH_SELECTIONS)
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

for (const selection of BORDER_CULTURAL_NEXT_BATCH_SELECTIONS)
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

test('registered v12 successor preserves v11 and authored order with isolated ownership', async () => {
  const current = createAuthoredJourneyRoute('whole-spatial-v12');
  const previous = createAuthoredJourneyRoute('whole-spatial-v11');
  assert.deepEqual(await loadAuthoredJourneyRoute(current.id), current);
  assert.equal(current.profileKey, 'journey-whole-spatial-v12');
  assert.equal(current.sessionKey, 'revealline.suspended.journey-whole-spatial.v12');
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
    team: 'team-trail-impact-originals-1',
  });
  assert.equal(authoredJourneyModeHref(current.id, 'solo'), '../?journey=whole-spatial-v12');
  assert.equal(
    authoredJourneyModeHref(current.id, 'versus'),
    'couch/?journey=whole-spatial-v12&return=solo',
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

test('Studio retains v11 and v12 after the selector advances to v20', async () => {
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
    options.filter((node) => attribute(node, 'value') === 'horizon-cultural-joins-1').length,
    1,
  );
  assert.deepEqual(
    options
      .filter((node) => attribute(node, 'selected') !== undefined)
      .map((node) => attribute(node, 'value')),
    ['apex-cultural-routes-1'],
  );
  assert.equal(
    options.filter((node) => attribute(node, 'value') === 'border-cultural-routes-1').length,
    1,
  );
  assert.match(html, /journey=whole-spatial-v12/);
  assert.match(script, /'border-cultural-routes-1': createBorderCulturalNextBatchCandidates/);
});

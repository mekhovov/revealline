import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createWholeTimedCandidates,
  createWholeVarietyCandidates,
} from '../content-design/whole-spatial-candidates.mjs';
import { createCulturalWorkshopArtCandidates } from '../content-design/cultural-workshop-art-candidates.mjs';
import { createSpatialBalanceCandidates } from '../content-design/spatial-balance-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createAuthoredJourneyRoute, createCandidateSequence } from '../content-design/route.mjs';
import {
  authoredJourneyModeHref,
  authoredJourneyUsesActorMaterials,
} from '../content-design/mode-href.mjs';
import { createCandidateSoloHost } from '../content-design/solo-host.mjs';
import { createCandidateVersusHost } from '../content-design/versus-host.mjs';
import { journeyActorThemeCandidates } from '../presentation/journey-actor-materials.mjs';
import { createJourneyCatalog } from '../journey/catalog.mjs';
import {
  createJourneyBackend,
  createJourneyProfileStore,
  emptyJourneyProfile,
} from '../journey/profile.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { VARIETY_ARCS, VARIETY_ROUTES } from './helpers/variety-routes.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';

const ids = VARIETY_ARCS.flat();
const isolated = compileContentProject(createCulturalWorkshopArtCandidates({ spatial: true }));
const greybox = compileContentProject(createSpatialBalanceCandidates());
const combined = compileContentProject(createWholeVarietyCandidates({ artwork: true }));

for (const artwork of [false, true])
  test(`eight optional additions preserve all83 existing missions: artwork=${artwork}`, () => {
    const before = createWholeTimedCandidates({ artwork });
    const source = createWholeVarietyCandidates({ artwork });
    const project = compileContentProject(source);
    const baseline = compileContentProject(before);
    const donor = artwork ? isolated : greybox;
    assert.equal(source.missions.length, 91);
    assert.equal(source.maps.length, 91);
    assert.equal(source.assets.length, artwork ? 91 : 0);
    assert.equal(source.revision, 'cultural-workshop-review-1');
    assert.equal(source.difficultyCatalogId, before.difficultyCatalogId);
    for (const key of ['maps', 'missions', 'assets'])
      assert.deepEqual(source[key].slice(0, before[key].length), before[key]);
    assert.deepEqual(
      source.missions.slice(83).map((m) => m.id),
      ids,
    );
    for (const mission of source.missions) {
      const expected = ids.includes(mission.id) ? donor : baseline;
      for (const difficulty of ['gentle', 'standard', 'expert'])
        for (const mode of ['solo', 'versus']) {
          const actual = resolveMission(project, mission.id, { difficulty, mode });
          const original = resolveMission(expected, mission.id, { difficulty, mode });
          assert.deepEqual(actual.level, original.level);
          assert.equal(actual.simulationIdentity, original.simulationIdentity);
          assert.deepEqual(actual.background, original.background);
          assert.equal(actual.officialProgressEligible, false);
        }
    }
    source.maps.at(-1).walls[0].x++;
    assert.notDeepEqual(createWholeVarietyCandidates({ artwork }), source);
    assert.deepEqual(createWholeTimedCandidates({ artwork }), before);
  });

test('both hosts keep71 core,12 stand-alone Remixes and two voluntary four-mission sequences', async () => {
  const route = createAuthoredJourneyRoute('whole-spatial-v4');
  const previous = createAuthoredJourneyRoute('whole-spatial-v3');
  const themes = journeyActorThemeCandidates(
    JSON.parse(await readFile(new URL('../content-design/themes.json', import.meta.url))).themes,
    { includeOriginals: route.preserveOriginalThemes },
  );
  assert.equal(route.profileKey, 'journey-whole-spatial-v4');
  assert.equal(route.sessionKey, 'revealline.suspended.journey-whole-spatial.v4');
  assert.match(route.label, /balance pending/);
  assert(authoredJourneyUsesActorMaterials(route.id));
  assert.equal(authoredJourneyModeHref(route.id, 'solo'), '../?journey=whole-spatial-v4');
  assert.equal(
    authoredJourneyModeHref(route.id, 'versus'),
    'couch/?journey=whole-spatial-v4&return=solo',
  );
  for (const create of [createCandidateSoloHost, createCandidateVersusHost]) {
    const host = create(route.source, {
      themes,
      corePackIds: route.corePackIds,
      optionalCampaignIds: route.optionalCampaignIds,
    });
    const old = create(previous.source, { themes, corePackIds: previous.corePackIds });
    const sequence = (h, first = h.catalog.missions[0]) => {
      const result = [];
      for (let m = first; m; m = h.next(m.id)) {
        assert(!result.includes(m.levelId));
        result.push(m.levelId);
      }
      return result;
    };
    assert.equal(sequence(host).length, 71);
    assert.deepEqual(sequence(host), sequence(old));
    assert.equal(host.catalog.missions.filter((m) => host.isOptionalSequence(m.id)).length, 8);
    const remixes = host.catalog.missions.filter(
      (m) => !host.isCore(m.id) && !host.isOptionalSequence(m.id),
    );
    assert.equal(remixes.length, 12);
    assert(remixes.every((m) => host.next(m.id) === null));
    for (const arc of VARIETY_ARCS) {
      assert.deepEqual(
        sequence(
          host,
          host.catalog.missions.find((m) => m.levelId === arc[0]),
        ),
        arc,
      );
      for (const id of arc) {
        const mission = host.catalog.missions.find((m) => m.levelId === id);
        assert(!host.isCore(mission.id));
        assert(host.isOptionalSequence(mission.id));
        assert.equal((host.select ?? host.row)({ ...mission }, 'standard'), null);
      }
    }
  }
});

test('optional sequence validates membership and cannot cross source/pack ownership', () => {
  const campaign = (source, packId, id, levels) => ({
    source,
    packId,
    id,
    title: id,
    levels: levels.map((id) => ({ id, name: id })),
  });
  const catalog = createJourneyCatalog([
    campaign('candidate', 'core', 'required', ['intro']),
    campaign('candidate', 'one', 'extra', ['a', 'b']),
    campaign('candidate', 'two', 'extra', ['a', 'b']),
    campaign('import', 'one', 'extra', ['a', 'b']),
  ]);
  const sequence = createCandidateSequence(catalog, ['core'], ['extra']);
  for (const [first, last] of [
    [1, 2],
    [3, 4],
    [5, 6],
  ]) {
    assert.equal(sequence.next(catalog.missions[first].id), catalog.missions[last]);
    assert.equal(sequence.next(catalog.missions[last].id), null);
  }
  assert.equal(sequence.next(catalog.missions[0].id), null);
  assert.equal(sequence.next('unknown'), null);
  assert.equal(sequence.isOptionalSequence('unknown'), false);
  for (const invalid of [
    null,
    'extra',
    ['missing'],
    ['extra', 'extra'],
    ['required'],
    ['../extra'],
  ])
    assert.throws(() => createCandidateSequence(catalog, ['core'], invalid), /optional campaigns/);
  assert.equal(createCandidateSequence(catalog, ['core']).next(catalog.missions[1].id), null);
});

test('v4 progress and backups never inherit v3 receipts', async () => {
  const disk = managedIndexedDB();
  const stores = ['whole-spatial-v3', 'whole-spatial-v4'].map((id) =>
    createJourneyProfileStore({
      backend: createJourneyBackend({
        ...disk,
        profileKey: createAuthoredJourneyRoute(id).profileKey,
      }),
    }),
  );
  await Promise.all(stores.map((s) => s.load()));
  stores[0].recordMany([
    {
      type: 'complete',
      mode: 'solo',
      missionId: 'candidate/journey-opening/prologue/first-return',
      runId: 'old',
      gameplayId: 'old',
      difficulty: 'standard',
    },
  ]);
  await stores[0].flush();
  assert.deepEqual(stores[1].snapshot(), emptyJourneyProfile());
  assert.throws(() => stores[1].restore(stores[0].export()), /different Journey edition/);
  assert.deepEqual(stores[1].snapshot(), emptyJourneyProfile());
});

test('48 existing recordings cover every new mission/preset/control exactly once', () => {
  assert.equal(VARIETY_ROUTES.length, 48);
  const expected = ids.flatMap((id) =>
    ['gentle', 'standard', 'expert'].flatMap((difficulty) =>
      ['immediate', 'grid-center'].map((turnPolicy) => `${id}/${difficulty}/${turnPolicy}`),
    ),
  );
  assert.deepEqual(
    VARIETY_ROUTES.map((r) => `${r.id}/${r.difficulty}/${r.turnPolicy}`).sort(),
    expected.sort(),
  );
  assert(VARIETY_ROUTES.every((r) => r.seed === 1));
});

for (const row of VARIETY_ROUTES)
  test(`integrated optional clear/replay/equal race: ${row.id}/${row.difficulty}/${row.turnPolicy}`, () => {
    const options = { seed: row.seed, classId: 'scout', turnPolicy: row.turnPolicy };
    const manifests = [combined, isolated, greybox].map((project) =>
      resolveMission(project, row.id, { difficulty: row.difficulty }),
    );
    assert(manifests.every((m) => m.simulationIdentity === row.identity));
    const runs = manifests.map((m) => createRun(m.level, options));
    const recorder = createRecorder(manifests[0].level, options);
    const versus = resolveMission(combined, row.id, { difficulty: row.difficulty, mode: 'versus' });
    const duel = createDuel(versus.level, options, { protocol: UNTIMED_DUEL_PROTOCOL, seconds: 0 });
    resumeDuel(duel);
    assert.notEqual(duel.runs[0].cells, duel.runs[1].cells);
    for (const [direction, ticks] of row.segments)
      for (let i = 0; i < ticks; i++) {
        recordInput(recorder, { direction });
        for (const run of runs) {
          assert.equal(run.status, 'running');
          stepRun(run, { direction }, FIXED_DT);
          assert.equal(run.classic.livesLost, 0);
        }
        assert.equal(duel.status, 'running');
        stepDuel(duel, [{ direction }, { direction }]);
      }
    assert(runs.every((run) => run.status === 'won'));
    assert.equal(authoritativeCheckpoint(runs[2]).hash, row.greyboxCheckpoint);
    assert.deepEqual(authoritativeCheckpoint(runs[0]), authoritativeCheckpoint(runs[1]));
    assert.deepEqual(runs[0], runs[1]);
    assert.equal(verifyReplay(exportReplay(recorder, runs[0])).match, true);
    assert.equal(duel.status, 'finished');
    assert.equal(duel.winner, null);
    for (const run of duel.runs) {
      assert.equal(run.status, 'won');
      assert.equal(run.classic.livesLost, 0);
      assert.deepEqual(authoritativeCheckpoint(run), authoritativeCheckpoint(runs[0]));
    }
  });

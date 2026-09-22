import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createWholeFieldCandidates,
  createWholeSpatialCandidates,
} from '../content-design/whole-spatial-candidates.mjs';
import { createApexFieldCandidates } from '../content-design/apex-field-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createAuthoredJourneyRoute } from '../content-design/route.mjs';
import {
  authoredJourneyUsesActorMaterials,
  authoredJourneyModeHref,
} from '../content-design/mode-href.mjs';
import { createCandidateSoloHost } from '../content-design/solo-host.mjs';
import { createCandidateVersusHost } from '../content-design/versus-host.mjs';
import { journeyActorThemeCandidates } from '../presentation/journey-actor-materials.mjs';
import {
  createJourneyBackend,
  createJourneyProfileStore,
  emptyJourneyProfile,
} from '../journey/profile.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { playApexFieldRoute } from './helpers/apex-field-route.mjs';

const field = compileContentProject(createApexFieldCandidates());
for (const artwork of [false, true])
  test(`only Home Signal changes in the full successor: artwork=${artwork}`, () => {
    const before = createWholeSpatialCandidates({ artwork });
    const base = compileContentProject(before);
    const source = createWholeFieldCandidates({ artwork });
    const project = compileContentProject(source);
    assert.equal(project.missions.length, 83);
    assert.equal(source.maps.length, 83);
    assert.equal(source.revision, 'field-finale-review-1');
    assert.equal(source.difficultyCatalogId, before.difficultyCatalogId);
    assert.deepEqual(source.assets, before.assets);
    assert.deepEqual(
      source.missions.map((m) => m.id),
      before.missions.map((m) => m.id),
    );
    for (const mission of source.missions) {
      const old = before.missions.find((m) => m.id === mission.id);
      assert.deepEqual(mission.presentation, old.presentation);
      if (mission.id !== 'home-signal') assert.deepEqual(mission, old);
      else {
        assert.equal(mission.encounter, null);
        assert.equal(mission.revision, 'home-field-2');
        assert.notDeepEqual(mission, old);
      }
      for (const difficulty of ['gentle', 'standard', 'expert'])
        for (const mode of ['solo', 'versus']) {
          const actual = resolveMission(project, mission.id, { difficulty, mode });
          const expected = resolveMission(mission.id === 'home-signal' ? field : base, mission.id, {
            difficulty,
            mode,
          });
          assert.deepEqual(actual.level, expected.level);
          assert.equal(actual.simulationIdentity, expected.simulationIdentity);
          assert.equal(actual.officialProgressEligible, false);
        }
    }
    assert.deepEqual(createWholeSpatialCandidates({ artwork }), before);
    source.maps.at(-1).foundations[0].x++;
    source.missions[0].name = 'caller edit';
    assert.notDeepEqual(createWholeFieldCandidates({ artwork }), source);
  });

test('both hosts preserve 71 core missions ending at the new finale and 12 voluntary Remixes', async () => {
  const old = createAuthoredJourneyRoute('whole-spatial-v1');
  const route = createAuthoredJourneyRoute('whole-spatial-v2');
  assert.equal(route.profileKey, 'journey-whole-spatial-v2');
  assert.equal(route.sessionKey, 'revealline.suspended.journey-whole-spatial.v2');
  assert.notEqual(route.profileKey, old.profileKey);
  assert.notEqual(route.sessionKey, old.sessionKey);
  assert.match(route.label, /balance pending/);
  assert(authoredJourneyUsesActorMaterials(route.id));
  assert.equal(authoredJourneyModeHref(route.id, 'solo'), '../?journey=whole-spatial-v2');
  assert.equal(
    authoredJourneyModeHref(route.id, 'versus'),
    'couch/?journey=whole-spatial-v2&return=solo',
  );
  assert(Object.isFrozen(route.source.missions[0]));
  const themes = journeyActorThemeCandidates(
    JSON.parse(await readFile(new URL('../content-design/themes.json', import.meta.url))).themes,
  );
  let sequence;
  for (const create of [createCandidateSoloHost, createCandidateVersusHost]) {
    const host = create(route.source, { themes, corePackIds: route.corePackIds });
    const core = [];
    for (let mission = host.catalog.missions[0]; mission; mission = host.next(mission.id)) {
      assert(!core.includes(mission.id));
      core.push(mission.id);
    }
    assert.equal(core.length, 71);
    assert.match(core.at(-1), /home-signal$/);
    const remixes = host.catalog.missions.filter((m) => !host.isCore(m.id));
    assert.equal(remixes.length, 12);
    assert(remixes.every((m) => host.next(m.id) === null));
    if (sequence) assert.deepEqual(core, sequence);
    sequence = core;
  }
});

test('new profile cannot inherit old-finale receipts or import another review edition backup', async () => {
  const disk = managedIndexedDB();
  const stores = ['whole-spatial-v1', 'whole-spatial-v2'].map((id) =>
    createJourneyProfileStore({
      backend: createJourneyBackend({
        ...disk,
        profileKey: createAuthoredJourneyRoute(id).profileKey,
      }),
    }),
  );
  const [old, current] = stores;
  await Promise.all(stores.map((store) => store.load()));
  old.recordMany([
    {
      type: 'complete',
      mode: 'solo',
      missionId: 'candidate/journey-apex/apex-aurora/home-signal',
      runId: 'old-finale',
      gameplayId: 'boss-edition',
      difficulty: 'standard',
    },
  ]);
  await old.flush();
  assert.deepEqual(current.snapshot(), emptyJourneyProfile());
  const before = current.snapshot();
  assert.throws(() => current.restore(old.export()), /different Journey edition/);
  assert.deepEqual(current.snapshot(), before);
  assert.equal(current.status().pending, 0);
});

test('all fourteen field-finale recordings retain checkpoints in the pictured combined source', async () => {
  const project = compileContentProject(createWholeFieldCandidates({ artwork: true }));
  for (const file of ['apex-field-clear-routes', 'apex-field-adapted-routes']) {
    const fixture = JSON.parse(await readFile(new URL(`./fixtures/${file}.json`, import.meta.url)));
    for (const row of fixture.rows) {
      const manifest = resolveMission(project, 'home-signal', { difficulty: row.difficulty });
      assert.equal(manifest.simulationIdentity, row.simulationIdentity);
      assert.deepEqual(playApexFieldRoute(manifest, row, { race: true }), row.evidence);
    }
  }
});

test('Studio links and Inspect action are explicit and keep Apply separate', async () => {
  const html = await readFile(new URL('../studio/index.html', import.meta.url), 'utf8');
  const js = await readFile(new URL('../studio/studio.mjs', import.meta.url), 'utf8');
  assert.match(html, /\.\.\/\?journey=whole-spatial-v2/);
  assert.match(html, /\.\.\/couch\/\?journey=whole-spatial-v2/);
  assert.match(html, /id="whole-field"/);
  const handler = js.slice(
    js.indexOf("$('whole-field').onclick"),
    js.indexOf("$('import').onchange"),
  );
  assert.match(handler, /if \(!discardSource\(\)\) return;/);
  assert.match(handler, /createWholeFieldCandidates\(\{ artwork: true \}\)/);
  assert.match(handler, /inspectSource\(\)/);
  assert.doesNotMatch(handler, /session\.(?:apply|replace|save)|\.publish/);
});

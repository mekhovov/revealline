import { createPursuitPilotCandidates } from '../content-design/pursuit-pilot-candidates.mjs';
import { prepareCreatorTeamSourceCampaign, importCreatorTeamCampaign } from '../creator/team.mjs';
// Boundary regressions authored for the current waiver; do not run automated suites.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  generateCreatorTeamCampaign,
  prepareCreatorTeamCampaign,
  exportCreatorTeamCampaign,
} from '../creator/team.mjs';
import {
  createInstalledTeamCampaignStore,
  CREATOR_TEAM_DATABASE,
} from '../creator/team-installed.mjs';
import { inspectCommunityPackage } from '../community/package-family.mjs';
import { createCommunityNativeInstalled } from '../community/native-installed.mjs';
import { createCommunityLibrary } from '../community/library.mjs';
import { createMemoryCommunityDownloadStore } from '../community/download-store.mjs';
import { createMemoryCommunityStateStore } from '../community/state.mjs';
import { createCreatorStore } from '../creator/installed.mjs';
import { preparePack } from '../../optional-practice/civilian-fpv/world-content.mjs';
import { openWorldStore } from '../../optional-practice/civilian-fpv/world-store.mjs';
const requireAuthoring = createRequire(
  new URL('../../authoring/fpv-worlds/package.json', import.meta.url),
);
const { IDBFactory } = requireAuthoring('fake-indexeddb');
function worldProject() {
  return {
    format: 'FPVWorldProject.v1',
    id: 'community-flight',
    title: 'Community flight',
    world: { id: 'community-flight' },
    courses: [
      {
        format: 'FlightCourse.v2',
        id: 'native-flight',
        revision: 'r1',
        environment: 'courtyard',
        world: { id: 'community-flight', theme: 'test-theme', style: 'test-style' },
        locales: Object.fromEntries(
          ['en', 'uk'].map((lang) => [lang, { title: 'Flight', brief: 'Fly', lesson: 'Practice' }]),
        ),
        spawn: { x: 0, y: 0, z: 0 },
        bounds: { min: { x: -10000, y: 0, z: -10000 }, max: { x: 10000, y: 15000, z: 10000 } },
        obstacles: [
          { id: 'pillar', min: { x: 4000, y: 0, z: 4000 }, max: { x: 5000, y: 2000, z: 5000 } },
        ],
        actors: [],
        steps: {
          'self-level': [{ type: 'survive', ticks: 20 }],
          acro: [{ type: 'survive', ticks: 20 }],
        },
      },
    ],
  };
}
async function nativePackages() {
  const source = generateCreatorTeamCampaign({ id: 'native-team', name: 'Native Team', seed: 0 });
  const team = await prepareCreatorTeamCampaign(source.pack, source.provenance);
  const sourceTeam = createPursuitPilotCandidates({ team: true });
  const pilots = await prepareCreatorTeamSourceCampaign(sourceTeam, {
    sourcePackId: sourceTeam.packs[0].id,
    campaignId: sourceTeam.campaigns[0].id,
    difficulty: 'standard',
  });
  return [
    exportCreatorTeamCampaign(team),
    exportCreatorTeamCampaign(pilots),
    await preparePack(worldProject()),
  ];
}
function editionFor(inspected, blob) {
  return {
    editionId: `ed_${inspected.editionId}`,
    collectionId: `co_${'b'.repeat(64)}`,
    slug: 'native-campaign',
    title: inspected.title,
    description: 'Native package',
    version: '1.0.0',
    packageSha256: inspected.editionId,
    packageSize: blob.size,
    publishedAt: '2026-10-03T12:00:00.000Z',
    family: inspected.family,
  };
}
test('native Team and FPV families use their immutable launch and recovery paths', async (t) => {
  for (const blob of await nativePackages()) {
    const indexedDB = new IDBFactory(),
      inspected = await inspectCommunityPackage(blob),
      edition = editionFor(inspected, blob);
    const nativeInstalled = createCommunityNativeInstalled({ indexedDB });
    const creatorStore = createCreatorStore({ indexedDB });
    const library = createCommunityLibrary({
      client: {
        catalog: async () => ({ editions: [edition], nextCursor: null }),
        download: async () => blob,
      },
      creatorStore,
      nativeInstalled,
      stateStore: createMemoryCommunityStateStore(),
      downloadStore: createMemoryCommunityDownloadStore(),
    });
    t.after(() => {
      library.close();
      creatorStore.close?.();
    });
    await library.install(edition, { offline: false });
    const installed = await library.status(edition.editionId);
    assert.equal(installed.family, inspected.family);
    assert.equal(installed.installed, true);
    assert.match(
      installed.playHref,
      inspected.family === 'team' ? /community-team=/ : /community-world=.*community-revision=/,
    );
    assert.equal(installed.profileKey, null); // Native stores own progress; never use Creator or official Snake keys.
    const removal = await library.reviewDownloadRemoval(edition);
    await library.removeDownload(edition, removal);
    await library.retainFromInstalled(edition);
    const review = await library.reviewInstalledOffload(edition);
    await library.offloadInstalled(edition, review);
    assert.equal((await library.status(edition.editionId)).offloaded, true);
    await library.install(edition);
    assert.equal(
      (await library.status(edition.editionId)).runtimeIdentity,
      installed.runtimeIdentity,
    );
  }
});
test('FPV exact revision offload preserves other installed revisions and rejects stale review', async (t) => {
  const indexedDB = new IDBFactory(),
    native = createCommunityNativeInstalled({ indexedDB });
  const first = await inspectCommunityPackage(await preparePack(worldProject()));
  const next = worldProject();
  next.title = 'Next flight';
  const second = await inspectCommunityPackage(await preparePack(next));
  await native.install(first);
  await native.install(second);
  const linked = (row) => ({
    family: 'fpv',
    runtimeIdentity: row.runtimeIdentity,
    creatorEditionId: row.editionId,
  });
  const review = await native.reviewOffload(linked(first));
  await native.install(second);
  await assert.rejects(() => native.offload(review), /changed/);
  await native.offload(await native.reviewOffload(linked(first)));
  assert.equal(await native.storage(linked(first)), null);
  assert.equal((await native.storage(linked(second))).installed, true);
  const store = await openWorldStore({ indexedDB });
  t.after(() => {
    native.close();
    store.close();
  });
  assert.equal((await store.get(first.runtimeIdentity)).sha256, second.editionId);
});
test('Team exact offload retains edition-owned progress bytes', async (t) => {
  const indexedDB = new IDBFactory(),
    store = createInstalledTeamCampaignStore({ indexedDB, managedStore: null });
  const source = generateCreatorTeamCampaign({
    id: 'progress-owner',
    name: 'Progress owner',
    seed: 0,
  });
  const prepared = await prepareCreatorTeamCampaign(source.pack, source.provenance);
  const { editionId } = await store.install(prepared);
  const db = await new Promise((resolve, reject) => {
    const open = indexedDB.open(CREATOR_TEAM_DATABASE);
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
  t.after(() => {
    db.close();
    store.close();
  });
  const progress = {
    format: 'revealline-installed-team-progress.v1',
    editionId,
    generation: 7,
    clears: {},
    attempts: {},
  };
  await new Promise((resolve, reject) => {
    const tx = db.transaction('progress', 'readwrite');
    tx.objectStore('progress').put(progress, editionId);
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error);
  });
  await store.offloadEdition(editionId, {
    expectedGeneration: (await store.inventory()).generation,
  });
  await store.install(prepared);
  assert.deepEqual((await store.inventory()).editions[0].progress, progress);
});
test('family admission rejects unsupported flight rules before installation', async () => {
  const source = worldProject();
  source.courses[0].rules = { arbitraryScript: 'run' };
  await assert.rejects(
    () => preparePack(source).then(inspectCommunityPackage),
    /not supported|Unsupported/i,
  );
});

test('pursuit Team packages pin editable source and reject altered runtime or self-attested clears', async () => {
  const source = createPursuitPilotCandidates({ team: true });
  const prepared = await prepareCreatorTeamSourceCampaign(source, {
    sourcePackId: source.packs[0].id,
    campaignId: source.campaigns[0].id,
    difficulty: 'standard',
  });
  const blob = exportCreatorTeamCampaign(prepared),
    imported = await importCreatorTeamCampaign(blob);
  assert.deepEqual(
    imported.pack.levels.map((level) => level.id),
    ['pincer-yard', 'relay-rendezvous'],
  );
  assert(
    imported.evidence.every(
      (row) => row.qualification === 'structural-only' && row.officialProgressEligible === false,
    ),
  );
  const changed = JSON.parse(await blob.text());
  changed.pack.levels[0].name = 'Forged runtime';
  await assert.rejects(
    () => importCreatorTeamCampaign(new Blob([JSON.stringify(changed)])),
    /differs/,
  );
  const claim = JSON.parse(await blob.text());
  claim.evidence[0].qualification = 'human-qualified';
  await assert.rejects(
    () => importCreatorTeamCampaign(new Blob([JSON.stringify(claim)])),
    /evidence/,
  );
});

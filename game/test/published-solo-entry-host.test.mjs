import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { register } from 'node:module';
import { addAuthoredRuntimeSnapshots } from '../../scripts/authored-runtime-snapshots.mjs';
import { createCandidateSoloHost } from '../content-design/solo-host.mjs';
import { journeyActorThemeCandidates } from '../presentation/journey-actor-materials.mjs';
import { createRun } from '../core/index.mjs';
import { createRecorder } from '../replay.mjs';
import { suspendSession } from '../sessions.mjs';
import { campaignKey } from '../library.mjs';
import { committedCaches } from './helpers/committed-caches.mjs';
import {
  createOfficialDownloads,
  OFFICIAL_CACHE,
  officialAssetURL,
} from '../official-downloads.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { openMissionLibrary, activateMissionCard } from './helpers/library-selection.mjs';

const entries = [
  {
    name: 'game/content-design/route-loader.mjs',
    bytes: await readFile(new URL('../content-design/route-loader.mjs', import.meta.url)),
  },
];
const generated = await addAuthoredRuntimeSnapshots(entries);
register(new URL('./helpers/published-solo-loader.mjs', import.meta.url), {
  data: { loader: entries[0].bytes.toString() },
});
const { soloPage, memoryStorage } = await import('./helpers/solo-dom.mjs');
const starter = generated.chapters.find((chapter) => chapter.descriptor.core);
const chapter =
  generated.chapters.find((item) => item.pack.id === 'journey-borderlines') ||
  generated.chapters.find((item) => !item.descriptor.core && !item.pack.id.includes('remix'));
const mission = chapter.source.missions[0];
const version = '0.132.2';
const files = new Map();
const groups = [];
const missions = [];
for (const item of generated.chapters) {
  const paths = [item.path, ...item.source.assets.map((asset) => `game/${asset.path}`)];
  files.set(item.path, { ...item.descriptor, path: item.path, kind: 'gameplay' });
  for (const asset of item.source.assets)
    files.set(`game/${asset.path}`, { ...asset, path: `game/${asset.path}`, kind: 'gameplay' });
  for (const mode of ['solo', 'versus']) {
    const id = item.descriptor.groups[mode];
    groups.push({ id, kind: 'gameplay', files: paths, requires: [] });
    for (const selected of item.source.missions)
      missions.push({
        routeId: generated.route.id,
        missionId: selected.id,
        modes: [mode],
        groups: [id],
      });
  }
}
const catalogue = {
  format: 'revealline-offline-content.v2',
  version,
  files: [...files.values()],
  groups,
  missions,
  destinations: [
    {
      path: 'game/couch/',
      mode: 'versus',
      routeId: generated.route.id,
      runtimeGroups: [starter.descriptor.groups.versus],
      groups: [starter.descriptor.groups.versus],
    },
  ],
};
const shipped = new Map(entries.map((entry) => [entry.name, entry.bytes]));
const runtimePath = (value) => {
  const text = String(value),
    index = text.lastIndexOf('/game/content-design/runtime/');
  return index < 0 ? null : text.slice(index + 1);
};
async function setup(
  t,
  { storage = memoryStorage(), caches = committedCaches(), offline = false } = {},
) {
  const runtimeReads = [],
    approved = new Set();
  const page = await soloPage(t, {
    search: '',
    storage,
    titleScreen: true,
    waitForPictures: false,
    journeyIndexedDB: managedIndexedDB().indexedDB,
    buildInfo: { version },
    browserSetup({ document, window, globals }) {
      const meta = document.createElement('meta');
      meta.setAttribute('name', 'revealline-offline');
      meta.content = JSON.stringify({
        format: 'revealline-offline.v1',
        buildId: 'a'.repeat(64),
        version,
        scope: '../',
        worker: '../service-worker.js',
        packageConsent: true,
      });
      document.documentElement.append(meta);
      globals.isSecureContext = true;
      globals.caches = caches;
      globals.navigator.serviceWorker = { getRegistration: async () => null };
      window.navigator = globals.navigator;
      window.caches = caches;
      window.localStorage = storage;
      window.matchMedia = globals.matchMedia;
    },
    fetchResponse: async (path) => {
      if (String(path).endsWith('/offline-content.json')) return Response.json(catalogue);
      const runtime = runtimePath(path);
      if (runtime) {
        runtimeReads.push(runtime);
        const item = generated.chapters.find((candidate) => candidate.path === runtime);
        if (item && !item.descriptor.core) {
          const local = await (
            await caches.open(OFFICIAL_CACHE)
          ).match(officialAssetURL(item.descriptor.sha256, 'http://localhost'));
          if (local) return local;
          if (offline) throw new Error('Network blocked for optional chapter runtime.');
          if (!approved.has(item.descriptor.groups.solo))
            throw new Error('A chapter runtime was fetched before consent.');
        }
        assert(shipped.has(runtime), `Published fixture must include ${runtime}`);
        return new Response(shipped.get(runtime));
      }
      if (String(path).includes('/content-design/assets/')) {
        const file = [...files.values()].find((item) => String(path).endsWith(item.path));
        if (offline && file) {
          const local = await (
            await caches.open(OFFICIAL_CACHE)
          ).match(officialAssetURL(file.sha256, 'http://localhost'));
          if (local) return local;
          throw new Error('Network blocked for optional chapter original.');
        }
        return new Response(await readFile(path));
      }
    },
  });
  async function connect() {
    await waitFor(() => page.$('install-offline-dialog')?.open, {
      message: 'Mission must ask before fetching its chapter.',
    });
    const frame = page.$('install-offline-dialog').querySelector('iframe'),
      messages = [];
    frame.contentWindow = { postMessage: (message) => messages.push(message), focus() {} };
    frame.emit('load');
    return { frame, messages };
  }
  async function approve(groupId, frame) {
    const group = groups.find((item) => item.id === groupId);
    const cache = await caches.open(OFFICIAL_CACHE);
    for (const path of group.files) {
      const file = files.get(path);
      const bytes =
        shipped.get(path) || (await readFile(new URL(`../../${path}`, import.meta.url)));
      await cache.put(
        officialAssetURL(file.sha256, 'http://localhost'),
        new Response(bytes, {
          headers: { 'Content-Length': file.bytes },
        }),
      );
    }
    approved.add(groupId);
    page.win.emit('message', {
      origin: 'http://localhost',
      source: frame.contentWindow,
      data: { format: 'revealline.offline-panel.v1', action: 'packages-ready', groups: [groupId] },
    });
  }
  return {
    ...page,
    page,
    caches,
    runtimeReads,
    connect,
    approve,
    store: createOfficialDownloads({
      caches,
      locks: globalThis.navigator.locks,
      origin: 'http://localhost',
      fetch: () => {
        throw new Error('Network blocked');
      },
    }),
  };
}
async function selectedCard(page) {
  await openMissionLibrary(page, 'shell-play');
  return [...page.$('journey-cards').children].find((card) =>
    JSON.parse(card.dataset.missionId)[3].endsWith(`/${mission.id}`),
  );
}
test('published Solo boots only the starter, browses metadata, and keeps its flight after cancelling an unloaded chapter', async (t) => {
  const h = await setup(t);
  assert.deepEqual(h.runtimeReads, [
    `game/content-design/${generated.navigationDescriptor.path}`,
    starter.path,
  ]);
  const card = await selectedCard(h.page);
  assert(card, 'Unloaded current missions remain visible.');
  assert.equal(h.$('journey-cards').children.length, 252);
  assert.equal(h.runtimeReads.length, 2, 'Browsing must not materialize other modes or chapters.');
  const previous = h.page.rendered.run;
  const cancelled = activateMissionCard(card);
  const first = await h.connect();
  assert(first.messages.some((message) => message.groupId === chapter.descriptor.groups.solo));
  h.$('install-offline-close').click();
  await cancelled;
  h.frame(0);
  assert.equal(h.page.rendered.run, previous);
  assert.equal(h.runtimeReads.length, 2);
  const next = await selectedCard(h.page);
  const launching = activateMissionCard(next);
  const second = await h.connect();
  await h.approve(chapter.descriptor.groups.solo, second.frame);
  await launching;
  await waitFor(() => {
    h.frame(0);
    return h.doc.body.dataset.flightState === 'running';
  });
  assert.equal(h.page.rendered.run.levelId, mission.id);
  assert.deepEqual(h.runtimeReads.slice(2), [chapter.path]);
});

test('an unloaded exact saved campaign has its title and restores only after consent, preserving saved bytes', async (t) => {
  const originalThemes = JSON.parse(
    await readFile(new URL('../content-design/themes.json', import.meta.url)),
  ).themes;
  const host = createCandidateSoloHost(chapter.source, {
    themes: journeyActorThemeCandidates(originalThemes, { includeOriginals: true }),
    corePackIds: [chapter.pack.id],
    optionalCampaignIds: [],
  });
  t.after(() => host.preparer.dispose());
  const target = host.catalog.missions.find((item) => item.levelId === mission.id);
  const entry = host.select(target, 'standard'),
    level = entry.campaign.levels[target.levelIndex];
  const options = {
    classId: 'scout',
    classRecipes: entry.classRecipes,
    seed: 19,
    turnPolicy: 'immediate',
  };
  const run = createRun(level, options),
    recorder = createRecorder(level, options, version);
  const theme = entry.themes.find(
    (item) => item.id === entry.manifests[target.levelIndex].presentation.themeId,
  );
  const saved = JSON.stringify(
    suspendSession({
      run,
      recorder,
      campaignKey: campaignKey(entry.campaign),
      themeId: theme.id,
      bodyId: theme.player,
      runId: 'published-saved-flight',
    }),
  );
  const storage = memoryStorage({ [generated.route.sessionKey]: saved });
  let caches;
  await t.test('first preparation preserves and pins the exact saved campaign', async (stage) => {
    const h = await setup(stage, { storage });
    assert(h.$('continue-saved-note').textContent.includes(level.name));
    assert.equal(h.runtimeReads.length, 2);
    h.$('shell-home').close();
    h.$('continue-saved').click();
    await h.connect();
    h.$('install-offline-close').click();
    await waitFor(() => !h.$('continue-saved').disabled);
    assert.equal(storage.getItem(generated.route.sessionKey), saved);
    assert.equal(h.runtimeReads.length, 2);
    h.$('continue-saved').click();
    const accepted = await h.connect();
    await h.approve(chapter.descriptor.groups.solo, accepted.frame);
    await waitFor(() => {
      h.frame(0);
      return h.page.rendered.run.levelId === level.id && !h.$('continue-saved').disabled;
    });
    assert.equal(h.doc.body.dataset.flightState, 'paused');
    assert.equal(storage.getItem(generated.route.sessionKey), saved);
    assert.deepEqual(h.runtimeReads.slice(2), [chapter.path]);
    caches = h.caches;
    const groupId = chapter.descriptor.groups.solo;
    const packageFiles = groups
      .find((item) => item.id === groupId)
      .files.map((path) => files.get(path));
    assert(
      (await h.store.states()).some(
        (state) => state.edition === 'played-dependencies' && state.package === groupId,
      ),
    );
    // Register the existing bytes as the normal downloaded selection, then remove it.
    await h.store.download({
      edition: 'http://localhost/',
      group: 'gameplay',
      files: packageFiles,
      selection: [groupId],
      baseURL: 'http://localhost/',
    });
    await h.store.retain({
      edition: 'http://localhost/',
      group: 'gameplay',
      files: [],
      selection: [],
    });
    assert.equal((await h.store.inspect(packageFiles, { verify: true })).ready, true);
  });
  await t.test(
    'a reopened page restores the deselected chapter from retained bytes with network blocked',
    async (stage) => {
      const beforeReopen = storage.getItem(generated.route.sessionKey);
      const h = await setup(stage, { storage, caches, offline: true });
      assert(h.$('continue-saved-note').textContent.includes(level.name));
      h.$('shell-home').close();
      h.$('continue-saved').click();
      await waitFor(() => {
        h.frame(0);
        return h.page.rendered.run.levelId === level.id && !h.$('continue-saved').disabled;
      });
      assert.equal(h.doc.body.dataset.flightState, 'paused');
      assert.equal(h.$('install-offline-dialog')?.open ?? false, false);
      assert.equal(storage.getItem(generated.route.sessionKey), beforeReopen);
      assert(h.runtimeReads.includes(chapter.path));
    },
  );
});

test('ordinary mode departure waits for its exact package and cancellation leaves Solo open', async (t) => {
  const h = await setup(t),
    before = globalThis.location.href;
  h.$('shell-title-versus').click();
  const first = await h.connect();
  assert(first.messages.some((message) => message.groupId === starter.descriptor.groups.versus));
  assert.equal(globalThis.location.href, before);
  h.$('install-offline-close').click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(globalThis.location.href, before);
  h.$('shell-title-versus').click();
  const second = await h.connect();
  await h.approve(starter.descriptor.groups.versus, second.frame);
  await waitFor(() => globalThis.location.href !== before);
  assert.equal(new URL(globalThis.location.href).pathname, '/game/couch/');
  assert.equal(h.runtimeReads.length, 2, 'The departing host must not execute Versus content.');
});

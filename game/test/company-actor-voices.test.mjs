import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parse } from 'acorn';
import { ACTOR_VOICE_RECORDINGS } from '../audio/reactions/actors.mjs';
import { REACTION_VOICE_PILOT } from '../audio/reactions/pilot.mjs';
import { createReactionVoiceLibrary } from '../journey/reaction-voice-library.mjs';
import {
  createCompanyActorVoiceDelivery,
  attachActorVoiceDownloads,
} from '../editions/actor-voice-delivery.mjs';
import {
  createOfficialDownloads,
  OFFICIAL_CACHE,
  officialAssetURL,
} from '../official-downloads.mjs';
import { memoryCaches } from './helpers/official-caches.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { attachContextualReactions } from '../ui/contextual-reactions.mjs';
import {
  editionActorVoiceResources,
  projectEditionActorVoices,
} from '../../scripts/edition-runtime.mjs';
import { editionOfflineOptionalPath } from '../../scripts/edition-offline.mjs';

const origin = 'https://game.example',
  baseURL = `${origin}/editions/example/releases/one/site/game/audio/reactions/`;
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const locks = { request: async (_name, _options, action) => action() };
const bytes = new TextEncoder().encode('pinned recording');
const recording = { ...ACTOR_VOICE_RECORDINGS[0], bytes: bytes.length, sha256: hash(bytes) };
function setup() {
  const caches = memoryCaches(),
    calls = [];
  let offline = false,
    bad = false;
  const fetch = async (url) => {
    calls.push(String(url));
    if (offline) throw new Error('offline');
    return new Response(bad ? new Uint8Array(bytes.length) : bytes);
  };
  const store = createOfficialDownloads({ caches, locks, origin, fetch });
  const delivery = createCompanyActorVoiceDelivery({ recordings: [recording], baseURL, store });
  return {
    caches,
    store,
    delivery,
    calls,
    offline: () => {
      offline = true;
    },
    corrupt: () => {
      bad = true;
    },
  };
}

test('Company actor originals are exact pinned optional media; pilot voices remain core', async () => {
  const resources = editionActorVoiceResources();
  const ledger = JSON.parse(
    await readFile(new URL('../editions/runtime-assets.json', import.meta.url)),
  );
  assert.equal(resources.length, 48);
  for (const clip of ACTOR_VOICE_RECORDINGS) {
    const path = `game/audio/reactions/${clip.file}`;
    assert.ok(resources.includes(path));
    assert.ok(editionOfflineOptionalPath(path));
    const asset = ledger.find((entry) => entry.path === path);
    assert.equal(asset.bytes, clip.bytes);
    assert.equal(asset.sha256, clip.sha256);
    const body = await readFile(new URL(`../audio/reactions/${clip.file}`, import.meta.url));
    assert.equal(body.length, clip.bytes);
    assert.equal(hash(body), clip.sha256);
  }
  for (const clip of REACTION_VOICE_PILOT)
    assert.equal(editionOfflineOptionalPath(`game/audio/reactions/${clip.file}`), false);
  const name = 'game/editions/standalone/actor-recordings.mjs';
  const source = await readFile(
    new URL('../editions/standalone/actor-recordings.mjs', import.meta.url),
  );
  const projected = projectEditionActorVoices(name, source).toString();
  const tree = parse(projected, { ecmaVersion: 'latest', sourceType: 'module' });
  const array = tree.body
    .flatMap((node) => node.declaration?.declarations ?? [])
    .find((node) => node.id.name === 'ACTOR_VOICE_RECORDINGS').init.arguments[0];
  assert.deepEqual(JSON.parse(projected.slice(array.start, array.end)), ACTOR_VOICE_RECORDINGS);
  assert.match(projected, /source identity: game\/audio\/reactions\/actors\.mjs [a-f0-9]{64}/);
  assert.throws(() =>
    projectEditionActorVoices(name, Buffer.from('export const ACTOR_VOICE_RECORDINGS = [1];')),
  );
});

test('construction, inspection and cache miss never download; explicit locale download enables offline reads', async () => {
  const h = setup();
  assert.equal(await h.delivery.read(recording), null);
  assert.equal((await h.delivery.status('en')).ready, false);
  assert.equal(h.calls.length, 0);
  await h.delivery.download('en');
  assert.equal(h.calls.length, 1);
  assert.ok(h.calls[0].endsWith(`/game/audio/reactions/${recording.file}`));
  h.offline();
  assert.deepEqual(new Uint8Array(await h.delivery.read(recording)), bytes);
  assert.equal((await h.delivery.status('en')).ready, true);
  await h.delivery.download('en');
  assert.equal(h.calls.length, 1, 'repair reuses verified cache');
});

test('corrupt bytes fail closed and cannot become a complete optional pack', async () => {
  const h = setup();
  h.corrupt();
  await assert.rejects(h.delivery.download('en'), /hash and size/);
  assert.equal((await h.delivery.status('en')).ready, false);
  const cache = await h.caches.open(OFFICIAL_CACHE);
  await cache.put(
    officialAssetURL(recording.sha256, origin),
    new Response(new Uint8Array(bytes.length)),
  );
  assert.equal(await h.delivery.read(recording), null);
  assert.throws(() =>
    createCompanyActorVoiceDelivery({ recordings: [recording, recording], baseURL }),
  );
  assert.throws(() =>
    createCompanyActorVoiceDelivery({
      recordings: [{ ...recording, file: '../../code.mjs' }],
      baseURL,
    }),
  );
});

test('offloading one Company cannot remove another owner’s originals', async () => {
  const h = setup();
  await h.delivery.download('en');
  const other = createCompanyActorVoiceDelivery({
    recordings: [recording],
    baseURL: baseURL.replace('/one/', '/two/'),
    store: h.store,
  });
  await other.download('en');
  await h.delivery.remove('en');
  assert.equal((await h.delivery.status('en')).owned, false);
  assert.equal((await other.status('en')).owned, true);
  assert.deepEqual(new Uint8Array(await other.read(recording)), bytes);
  await other.remove('en');
  assert.equal(await other.read(recording), null);
});

test('an already-aborted download does not fetch and an explicit retry remains available', async () => {
  const h = setup(),
    controller = new AbortController();
  controller.abort();
  await assert.rejects(h.delivery.download('en', { signal: controller.signal }), {
    name: 'AbortError',
  });
  assert.equal(h.calls.length, 0);
  await h.delivery.download('en');
  assert.equal((await h.delivery.status('en')).ready, true);
});

function recordingDatabase(record) {
  return {
    open() {
      const request = {};
      queueMicrotask(() => {
        request.result = {
          close() {},
          transaction() {
            const tx = { objectStore: () => ({ get: () => ({ result: record }) }) };
            queueMicrotask(() => tx.oncomplete());
            return tx;
          },
        };
        request.onsuccess();
      });
      return request;
    },
  };
}
test('missing optional cache retains online pilot originals, captions and precedence of custom actor recordings', async () => {
  const actor = ACTOR_VOICE_RECORDINGS[0],
    pilot = REACTION_VOICE_PILOT[0];
  let fetched = 0,
    cacheReads = 0;
  const library = createReactionVoiceLibrary({
    indexedDB: null,
    channelName: null,
    createActorDelivery: () => ({
      read: async () => {
        cacheReads++;
        return null;
      },
    }),
    fetch: async (url) => {
      fetched++;
      return new Response(await readFile(url));
    },
  });
  assert.equal((await library.resolve(pilot.lineId, pilot.locale)).sha256, pilot.sha256);
  assert.equal((await library.resolve(actor.lineId, actor.locale)).sha256, actor.sha256);
  assert.equal(fetched, 2);
  library.close();
  const custom = createReactionVoiceLibrary({
    channelName: null,
    indexedDB: recordingDatabase({
      active: 'custom',
      revisions: [
        {
          sha256: 'custom',
          base64: Buffer.from(bytes).toString('base64'),
          mime: 'audio/mp4',
          duration: 1,
        },
      ],
    }),
    createActorDelivery: () => ({
      read: async () => {
        throw new Error('custom must win');
      },
    }),
    fetch: async () => {
      throw new Error('custom must win');
    },
  });
  assert.equal((await custom.resolve(actor.lineId, actor.locale)).sha256, 'custom');
  custom.close();
  const offline = createReactionVoiceLibrary({
    indexedDB: null,
    channelName: null,
    createActorDelivery: () => ({ read: async () => null }),
    fetch: async () => new Response('', { status: 503 }),
  });
  assert.equal(
    await offline.resolve(actor.lineId, actor.locale),
    null,
    'caption path remains valid',
  );
  offline.close();
  assert.equal(cacheReads, 2);
});

test('voice download cancellation follows Settings moved into a dialog after mount', async () => {
  const doc = new Document(),
    container = doc.createElement('section');
  doc.body.append(container);
  let signal;
  const delivery = {
    packs: [{ locale: 'en', files: 24, bytes: 1000 }],
    status: async () => ({ ready: false, readyBytes: 0, owned: false }),
    download: async (_locale, options) => {
      signal = options.signal;
      await new Promise((_resolve, reject) =>
        signal.addEventListener('abort', () => reject(signal.reason)),
      );
    },
  };
  const view = attachActorVoiceDownloads({ container, document: doc, delivery });
  const dialog = doc.createElement('dialog');
  doc.body.append(dialog);
  dialog.append(container);
  dialog.showModal();
  container.querySelector('[data-actor-voice-download]').click();
  assert.equal(signal.aborted, false);
  dialog.close();
  assert.equal(signal.aborted, true);
  view.dispose();
});

test('another tab removing the same voice pack invalidates the visible verified status through the reaction library', async () => {
  const h = setup();
  await h.delivery.download('en');
  const doc = new Document(),
    container = doc.createElement('section'),
    settings = doc.createElement('section');
  doc.body.append(container, settings);
  let changed;
  const library = {
    originals: [],
    actorDownloads: h.delivery,
    subscribe(listener) {
      changed = listener;
      return () => {};
    },
  };
  const host = attachContextualReactions({
    container,
    settingsContainer: settings,
    document: doc,
    window: doc.defaultView,
    voiceLibrary: library,
    sound: { configureDialogue() {} },
    getStorage: () => ({ getItem: () => null }),
    getLocale: () => 'en',
  });
  const status = settings
    .querySelector('[data-actor-voice-locale]')
    .querySelector('[role="status"]');
  await waitFor(() => status.textContent === 'Verified for offline speech.');
  const otherTab = createCompanyActorVoiceDelivery({
    recordings: [recording],
    baseURL,
    store: h.store,
  });
  await otherTab.remove('en');
  changed(); // The shared library delivers the other tab's BroadcastChannel notice.
  await waitFor(() => status.textContent === 'Available online; download for offline speech.');
  assert.equal(settings.querySelector('[data-actor-voice-remove]').disabled, true);
  assert.equal(h.calls.length, 1, 'status refresh never downloads or repairs the pack');
  host.dispose();
});

test('returning to Settings rechecks optional voice ownership without repeated render inspections', async () => {
  const h = setup();
  await h.delivery.download('en');
  const doc = new Document(),
    container = doc.createElement('section');
  doc.body.append(container);
  let inspections = 0;
  const delivery = {
    ...h.delivery,
    status: async (...args) => {
      inspections++;
      return h.delivery.status(...args);
    },
  };
  const view = attachActorVoiceDownloads({ container, document: doc, delivery });
  const status = container.querySelector('[role="status"]');
  await waitFor(() => status.textContent === 'Verified for offline speech.');
  const before = inspections;
  for (let i = 0; i < 5; i++) view.refresh();
  assert.equal(inspections, before, 'locale and preference renders stay cheap');
  await h.delivery.remove('en');
  const dialog = doc.createElement('dialog');
  doc.body.append(dialog);
  dialog.append(container);
  dialog.showModal(); // Native dialog entry focuses its first control once.
  await waitFor(() => status.textContent === 'Available online; download for offline speech.');
  assert.equal(inspections, before + 1);
  doc.dispatchEvent({
    type: 'focusin',
    target: container.querySelector('[data-actor-voice-remove]'),
    relatedTarget: container.querySelector('[data-actor-voice-download]'),
  });
  assert.equal(inspections, before + 1, 'Moving within Settings does not inspect again.');
  dialog.close();
  dialog.showModal();
  assert.equal(inspections, before + 2, 'A later Settings entry inspects once again.');
  view.dispose();
});

test('cross-tab status inspection does not interrupt or repaint an active voice download', async () => {
  const doc = new Document(),
    container = doc.createElement('section');
  doc.body.append(container);
  let inspections = 0,
    signal;
  const delivery = {
    packs: [{ locale: 'en', files: 24, bytes: 1000 }],
    status: async () => {
      inspections++;
      return { ready: false, readyBytes: 0, owned: false };
    },
    download: async (_locale, options) => {
      signal = options.signal;
      await new Promise((_resolve, reject) =>
        signal.addEventListener('abort', () => reject(signal.reason)),
      );
    },
  };
  const view = attachActorVoiceDownloads({ container, document: doc, delivery });
  container.querySelector('[data-actor-voice-download]').click();
  const before = inspections;
  await view.synchronize();
  assert.equal(inspections, before);
  assert.equal(signal.aborted, false);
  assert.equal(container.querySelector('[role="status"]').textContent, 'Downloading…');
  view.dispose();
  assert.equal(signal.aborted, true);
});

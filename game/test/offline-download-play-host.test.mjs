import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, webcrypto } from 'node:crypto';
import { page } from './helpers/coop-host.mjs';
import { couchPage } from './helpers/couch-host.mjs';
import { waitFor } from './helpers/coop-presentation-fixture.mjs';
import { committedCaches } from './helpers/committed-caches.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { createTeamImpactOriginalCandidates } from '../content-design/team-impact-originals.mjs';
import { DEFAULT_JOURNEY_ROUTES } from '../content-design/default-entry.mjs';
import { assetDigest, OFFICIAL_CACHE, officialAssetURL } from '../official-downloads.mjs';
import { mountPresentationPage } from '../presentation/page.mjs';
import { CURRENT_PICTURES } from '../presentation/current-pictures.mjs';

const compiled = JSON.parse(
  await readFile(new URL('../presentation/compiled/runtime.json', import.meta.url), 'utf8'),
);
const versusOwner = CURRENT_PICTURES.find(
  (row) => row.owner.levelId === 'signal-01' && row.owner.themeId === 'fpv',
);
const versusAsset = compiled.resolved.assets[versusOwner.id];
const versusOriginal = await readFile(
  new URL(`../presentation/compiled/assets/${versusAsset.file.sha256}.png`, import.meta.url),
);
assert.equal(createHash('sha256').update(versusOriginal).digest('hex'), versusAsset.file.sha256);
const versusJourneyOriginal = await readFile(
  new URL('../content-design/assets/horizon-r1/first-return.png', import.meta.url),
);

const source = createTeamImpactOriginalCandidates();
const bytes = new TextEncoder().encode('verified Download & play dependency');
const file = {
  path: 'team-download-play.json',
  sha256: await assetDigest(bytes, webcrypto),
  bytes: bytes.length,
  kind: 'gameplay',
};
const version = 'download-play-test';
const catalogue = {
  format: 'revealline-offline-content.v2',
  version,
  files: [file],
  groups: [{ id: 'team:download-play', kind: 'gameplay', files: [file.path], requires: [] }],
  missions: [
    ...source.missions.map((mission) => ({
      routeId: DEFAULT_JOURNEY_ROUTES.team,
      missionId: mission.id,
      modes: ['team'],
      groups: ['team:download-play'],
    })),
    {
      routeId: DEFAULT_JOURNEY_ROUTES.versus,
      missionId: 'first-return',
      modes: ['versus'],
      groups: ['versus:download-play'],
    },
  ],
};
catalogue.groups.push({
  id: 'versus:download-play',
  kind: 'gameplay',
  files: [file.path],
  requires: [],
});

function connectPackagePanel(f, groupId) {
  const dialog = f.doc.getElementById('install-offline-dialog');
  assert.equal(dialog?.open, true);
  const frame = dialog.querySelector('iframe');
  assert.ok(frame);
  const messages = [];
  frame.contentWindow = {
    focus() {},
    postMessage(message) {
      messages.push(message);
    },
  };
  frame.emit('load');
  assert.ok(
    messages.some((message) => message.action === 'select-package' && message.groupId === groupId),
  );
  return frame;
}

function versusMedia() {
  const blobs = new Map();
  let sequence = 0;
  class URLImpl extends URL {
    static createObjectURL(blob) {
      const url = `blob:versus-download-play-${++sequence}`;
      blobs.set(url, blob);
      return url;
    }
    static revokeObjectURL(url) {
      blobs.delete(url);
    }
  }
  class Image {
    set src(value) {
      this.source = value;
      queueMicrotask(() => this.onload?.());
    }
    async decode() {
      const data = this.source.startsWith('data:image/png;base64,')
        ? Buffer.from(this.source.split(',')[1], 'base64')
        : Buffer.from(await blobs.get(this.source).arrayBuffer());
      this.width = this.naturalWidth = data.readUInt32BE(16);
      this.height = this.naturalHeight = data.readUInt32BE(20);
    }
    removeAttribute() {
      this.source = '';
    }
  }
  return { Image, URLImpl };
}

async function teamDownloadPlayPage(t) {
  const caches = committedCaches();
  const f = await page(t, {
    href: 'http://localhost/game/couch/relay-rescue.html',
    nativeFocus: true,
    nativeVisibility: true,
    waitPicture: false,
    beforeImport({ doc, win, install }) {
      const previousFetch = globalThis.fetch;
      const meta = doc.createElement('meta');
      meta.setAttribute('name', 'revealline-offline');
      meta.content = JSON.stringify({
        format: 'revealline-offline.v1',
        buildId: 'a'.repeat(64),
        version,
        scope: '../../',
        worker: '../../service-worker.js',
        packageConsent: true,
      });
      doc.documentElement.append(meta);
      // Node imports the real host from file:. Match that module-relative panel
      // origin while the modeled game location remains the packaged HTTP URL.
      win.location = new URL('../downloads.html', import.meta.url);
      globalThis.location.origin = 'http://localhost';
      globalThis.navigator.locks = { request: (_name, _options, work) => work() };
      globalThis.navigator.serviceWorker = { getRegistration: async () => null };
      const OriginalImage = globalThis.Image;
      install('Image', {
        value: class extends OriginalImage {
          async decode() {
            if (!this.source.startsWith('data:image/png;base64,')) return super.decode();
            const buffer = Buffer.from(this.source.split(',')[1], 'base64');
            this.width = this.naturalWidth = buffer.readUInt32BE(16);
            this.height = this.naturalHeight = buffer.readUInt32BE(20);
          }
        },
      });
      install('crypto', { value: webcrypto });
      install('caches', { value: caches });
      install('isSecureContext', { value: true });
      install('fetch', {
        value: async (url, options) => {
          if (String(url).endsWith('/offline-content.json')) return Response.json(catalogue);
          const asset = source.assets.find((row) => new URL(url).pathname.endsWith('/' + row.path));
          if (asset)
            return new Response(await readFile(new URL('../' + asset.path, import.meta.url)));
          return previousFetch(url, options);
        },
      });
    },
  });
  return { f, caches };
}

test('fresh Team missing package offers one Download & play action and starts only after exact verified readiness', async (t) => {
  const { f, caches } = await teamDownloadPlayPage(t);

  await waitFor(
    () => f.$('coop-picture-status').dataset.state === 'error',
    () => f.$('coop-picture-status').textContent,
  );
  const retry = f.$('coop-picture-retry');
  assert.equal(f.$('coop-start').disabled, true);
  assert.equal(retry.hidden, false);
  assert.match(retry.textContent, /Download & play/i);
  assert.equal(f.doc.body.classList.contains('playing'), false);

  retry.focus();
  let preparing = retry.onclick();
  await waitFor(
    () => f.doc.getElementById('install-offline-dialog')?.open,
    () => f.$('coop-picture-status').textContent,
  );
  connectPackagePanel(f, 'team:download-play');
  f.doc.getElementById('install-offline-dialog').close();
  await preparing;
  assert.equal(f.doc.body.classList.contains('playing'), false);
  assert.match(retry.textContent, /Download & play/i);

  retry.focus();
  preparing = retry.onclick();
  await waitFor(
    () => f.doc.getElementById('install-offline-dialog')?.open,
    () => f.$('coop-picture-status').textContent,
  );
  const frame = connectPackagePanel(f, 'team:download-play');
  assert.equal(f.doc.body.classList.contains('playing'), false);
  await (
    await caches.open(OFFICIAL_CACHE)
  ).put(
    officialAssetURL(file.sha256, 'http://localhost'),
    new Response(bytes, { headers: { 'Content-Length': file.bytes } }),
  );
  f.win.emit('message', {
    origin: 'null',
    source: frame.contentWindow,
    data: {
      format: 'revealline.offline-panel.v1',
      action: 'packages-ready',
      groups: ['team:download-play'],
    },
  });
  await preparing;
  await waitFor(
    () => f.doc.body.classList.contains('playing'),
    () =>
      JSON.stringify({
        state: f.$('coop-picture-status').dataset.state,
        status: f.$('coop-picture-status').textContent,
        focus: f.doc.activeElement.id,
      }),
  );
  assert.equal(f.$('coop-menu').hidden, true);
  assert.equal(f.$('coop-play').hidden, false);
});

test('Team Download & play never reclaims focus or starts after a newer lobby choice', async (t) => {
  const { f, caches } = await teamDownloadPlayPage(t);
  await waitFor(
    () => f.$('coop-picture-status').dataset.state === 'error',
    () => f.$('coop-picture-status').textContent,
  );
  const retry = f.$('coop-picture-retry');
  retry.focus();
  const preparing = retry.onclick();
  await waitFor(
    () => f.doc.getElementById('install-offline-dialog')?.open,
    () => f.$('coop-picture-status').textContent,
  );
  const frame = connectPackagePanel(f, 'team:download-play'),
    newerChoice = f.$('coop-settings-open');
  newerChoice.focus();
  assert.equal(f.doc.activeElement, newerChoice);
  await (
    await caches.open(OFFICIAL_CACHE)
  ).put(
    officialAssetURL(file.sha256, 'http://localhost'),
    new Response(bytes, { headers: { 'Content-Length': file.bytes } }),
  );
  f.win.emit('message', {
    origin: 'null',
    source: frame.contentWindow,
    data: {
      format: 'revealline.offline-panel.v1',
      action: 'packages-ready',
      groups: ['team:download-play'],
    },
  });
  await preparing;
  assert.equal(f.doc.body.classList.contains('playing'), false);
  assert.notEqual(f.doc.activeElement, f.$('coop-start'));
  assert.equal(f.$('coop-start').disabled, false);
});

test('fresh Versus missing package offers one Download & play action and admits that exact race once ready', async (t) => {
  const caches = committedCaches(),
    media = versusMedia(),
    memory = managedIndexedDB(),
    snapshot = { resolved: compiled.resolved, images: new Map(), canvas: {} };
  let presentation;
  const installedGlobals = new Map();
  const installGlobal = (key, value) => {
    installedGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  };
  t.after(() => {
    presentation?.close();
    for (const [key, descriptor] of installedGlobals)
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
  });
  const p = await couchPage(t, {
    href: 'http://localhost/game/couch/',
    initialLevel: null,
    nativeKeyboard: true,
    ImageClass: media.Image,
    URLImpl: media.URLImpl,
    assetDatabase: memory.indexedDB,
    lockManager: { request: (_name, _options, work) => work() },
    fetchResponse(url) {
      if (String(url).endsWith('/offline-content.json')) return Response.json(catalogue);
      if (String(url).endsWith('/content-design/assets/horizon-r1/first-return.png'))
        return new Response(versusJourneyOriginal, {
          headers: { 'Content-Length': versusJourneyOriginal.length },
        });
    },
    beforeImport({ document, window }) {
      const meta = document.createElement('meta');
      meta.setAttribute('name', 'revealline-offline');
      meta.content = JSON.stringify({
        format: 'revealline-offline.v1',
        buildId: 'a'.repeat(64),
        version,
        scope: '../../',
        worker: '../../service-worker.js',
        packageConsent: true,
      });
      document.documentElement.append(meta);
      window.location = new URL('../downloads.html', import.meta.url);
      globalThis.location.origin = 'http://localhost';
      globalThis.navigator.serviceWorker = { getRegistration: async () => null };
      installGlobal('crypto', webcrypto);
      installGlobal('caches', caches);
      installGlobal('isSecureContext', true);
      presentation = mountPresentationPage({
        document,
        window,
        createHost: () => ({
          async load() {
            return snapshot;
          },
          apply() {},
          close() {},
          async readPicture(slot, options) {
            assert.equal(slot, versusOwner.id);
            assert.equal(options.snapshot, snapshot);
            return {
              asset: versusAsset,
              blob: new Blob([versusOriginal], { type: 'image/png' }),
            };
          },
        }),
      });
    },
  });

  await waitFor(
    () => !p.$('race-chapter-retry').hidden,
    () => p.$('race-message').textContent,
  );
  const retry = p.$('race-chapter-retry');
  assert.equal(p.$('race-start').disabled, true);
  assert.match(
    retry.textContent,
    /Download & play/i,
    JSON.stringify({
      message: p.$('race-message').textContent,
      level: p.$('race-level').value,
      option: p.$('race-level').options.find((row) => row.value === p.$('race-level').value)?.label,
    }),
  );
  assert.equal(p.state(), 'ready');

  retry.focus();
  const preparing = retry.onclick();
  await waitFor(
    () => p.doc.getElementById('install-offline-dialog')?.open,
    () => p.$('race-message').textContent,
  );
  const frame = connectPackagePanel(p, 'versus:download-play');
  await retry.onclick();
  assert.equal(
    p.doc.getElementById('install-offline-dialog')?.open,
    true,
    'repeated Confirm cannot replace the owned package request',
  );
  await (
    await caches.open(OFFICIAL_CACHE)
  ).put(
    officialAssetURL(file.sha256, 'http://localhost'),
    new Response(bytes, { headers: { 'Content-Length': file.bytes } }),
  );
  p.win.emit('message', {
    origin: 'null',
    source: frame.contentWindow,
    data: {
      format: 'revealline.offline-panel.v1',
      action: 'packages-ready',
      groups: ['versus:download-play'],
    },
  });
  await preparing;
  p.frame();
  assert.equal(
    p.state(),
    'running',
    JSON.stringify({
      message: p.$('race-message').textContent,
      focus: p.doc.activeElement.id,
      startDisabled: p.$('race-start').disabled,
      cueHidden: p.$('race-start-cue').hidden,
      retryHidden: p.$('race-chapter-retry').hidden,
    }),
  );
  assert.equal(p.$('race-start').disabled, true);
});

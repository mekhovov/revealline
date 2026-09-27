import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { page } from './helpers/coop-host.mjs';
import { waitFor } from './helpers/coop-presentation-fixture.mjs';
import { committedCaches } from './helpers/committed-caches.mjs';
import { createTeamImpactOriginalCandidates } from '../content-design/team-impact-originals.mjs';
import { offlineAvailability } from '../offline.mjs';
import { DEFAULT_JOURNEY_ROUTES } from '../content-design/default-entry.mjs';
import {
  assetDigest,
  createOfficialDownloads,
  OFFICIAL_CACHE,
  officialAssetURL,
} from '../official-downloads.mjs';

const source = createTeamImpactOriginalCandidates();
const bytes = new TextEncoder().encode('verified Team dependency');
const file = {
  path: 'team-runtime.json',
  sha256: await assetDigest(bytes, webcrypto),
  bytes: bytes.length,
  kind: 'gameplay',
};
const version = '0.132.2';
const catalogue = {
  format: 'revealline-offline-content.v2',
  version,
  files: [file],
  groups: [{ id: 'team:fixture', kind: 'gameplay', files: [file.path], requires: [] }],
  missions: source.missions.map((mission) => ({
    routeId: DEFAULT_JOURNEY_ROUTES.team,
    missionId: mission.id,
    modes: ['team'],
    groups: ['team:fixture'],
  })),
};
async function fixture(t) {
  const caches = committedCaches(),
    queue = [];
  let blocked = false,
    lockRequests = 0;
  const locks = {
    async request(_name, _options, work) {
      lockRequests++;
      if (blocked) await new Promise((resolve) => queue.push(resolve));
      return work();
    },
  };
  await (
    await caches.open(OFFICIAL_CACHE)
  ).put(
    officialAssetURL(file.sha256, 'http://localhost'),
    new Response(bytes, { headers: { 'Content-Length': file.bytes } }),
  );
  const f = await page(t, {
    href: 'http://localhost/game/couch/relay-rescue.html',
    nativeFocus: true,
    nativeVisibility: true,
    retainInitialDifficulty: true,
    beforeImport({ install, doc }) {
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
      install('crypto', { value: webcrypto });
      install('caches', { value: caches });
      install('isSecureContext', { value: true });
      globalThis.location.origin = 'http://localhost';
      globalThis.navigator.locks = locks;
      globalThis.navigator.serviceWorker = { getRegistration: async () => null };
      const OriginalImage = globalThis.Image,
        previousFetch = globalThis.fetch;
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
  return {
    ...f,
    store: createOfficialDownloads({ caches, locks, origin: 'http://localhost' }),
    get lockRequests() {
      return lockRequests;
    },
    block() {
      blocked = true;
    },
    release() {
      blocked = false;
      for (const resolve of queue.splice(0)) resolve();
    },
  };
}

test('a prepared Team preview is not pinned; deliberate Start waits for retention and cancelled work cannot start later', async (t) => {
  const f = await fixture(t);
  assert.equal(offlineAvailability().packageConsent, true, JSON.stringify(offlineAvailability()));
  assert.equal(f.lockRequests, 0, 'passive picture preparation must not retain a chapter');
  f.block();
  f.$('coop-start').focus();
  f.tap('Enter');
  await waitFor(
    () => f.lockRequests === 1,
    () =>
      JSON.stringify({
        status: f.$('coop-picture-status').textContent,
        state: f.$('coop-picture-status').dataset,
        playing: f.doc.body.classList.contains('playing'),
        locks: f.lockRequests,
        focus: f.doc.activeElement.id,
      }),
  );
  assert.equal(f.doc.body.classList.contains('playing'), false);
  f.win.emit('blur');
  await new Promise((resolve) => setImmediate(resolve));
  f.release();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.doc.body.classList.contains('playing'), false);
  assert.equal(
    (await f.store.states()).some((state) => state.edition === 'played-dependencies'),
    false,
  );
  f.win.emit('focus');
  f.tick(); // A neutral controller sample re-arms deliberate keyboard confirmation.
  f.$('coop-start').focus();
  f.tap('Enter');
  await waitFor(
    () => f.doc.body.classList.contains('playing'),
    () =>
      JSON.stringify({
        status: f.$('coop-picture-status').textContent,
        state: f.$('coop-picture-status').dataset,
        locks: f.lockRequests,
        focus: f.doc.activeElement.id,
        disabled: f.$('coop-start').disabled,
      }),
  );
  assert.equal(f.lockRequests, 2);
  const retained = (await f.store.states()).filter(
    (state) => state.edition === 'played-dependencies',
  );
  assert.equal(retained.length, 1);
  assert.deepEqual(retained[0].hashes, [file.sha256]);
});

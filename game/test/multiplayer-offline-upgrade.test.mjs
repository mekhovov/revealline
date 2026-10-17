import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createMultiplayerExpansionCandidates } from '../content-design/multiplayer-expansion.mjs';
import { createOfficialDownloads, assetDigest, OFFICIAL_CACHE } from '../official-downloads.mjs';
import { createJourneyBackend, createJourneyProfileStore } from '../journey/profile.mjs';
import {
  activateInstalledEdition,
  stageInstalledEdition,
  readInstalledState,
  reviewInstalledMigration,
  recordInstalledMigration,
  INSTALLED_STATE_KEY,
} from '../installed-app.mjs';
import { committedCaches } from './helpers/committed-caches.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';

// Real authored Team/Duel Harbor sources and shared download code are hashed,
// downloaded and read through the production store. The two release numbers and
// changed source revisions are fixtures, not claims about published editions.
// CacheStorage, Web Locks, quota and IndexedDB are finite boundary adapters.
const origin = 'https://game.example';
const base = `${origin}/revealline/`;
const sources = ['team', 'versus'].map((mode) =>
  createMultiplayerExpansionCandidates({ mode, chapterId: 'harbors' }),
);
const shared = await readFile(new URL('../download-catalogue.mjs', import.meta.url));
const releases = await Promise.all(
  ['1.0.0', '2.0.0'].map(async (version, index) => {
    const bodies = new Map([
      ['game/download-catalogue.mjs', shared],
      ...sources.map((source, mode) => [
        `game/content/${mode ? 'duel' : 'team'}-harbors.json`,
        Buffer.from(JSON.stringify({ ...source, revision: String(index + 1) })),
      ]),
    ]);
    return {
      edition: {
        version,
        scope: `${base}releases/v${version}/site/`,
        buildId: String(index + 1).repeat(64),
        selection: ['base', 'team:harbors', 'versus:harbors'],
        allGameplay: false,
      },
      bodies,
      files: await Promise.all(
        [...bodies].map(async ([path, bytes]) => ({
          path,
          bytes: bytes.length,
          sha256: await assetDigest(bytes),
          kind: 'gameplay',
        })),
      ),
    };
  }),
);
const [earlier, candidate] = releases;
const locks = { request: async (name, options, work) => (work || options)({ name }) };
const profileKey = (release) => `revealline.library.release-${release.version}.v1`;

async function progressFixture() {
  const disk = managedIndexedDB(),
    owners = [];
  for (const [index, mode] of ['team', 'versus'].entries()) {
    const profileKey = `journey-${mode === 'team' ? 'team' : 'duel'}-expedition-v1`;
    const backend = createJourneyBackend({ ...disk, profileKey });
    const store = createJourneyProfileStore({ backend });
    await store.load();
    // Synthetic storage receipts; this test does not award or claim a game win.
    store.recordMany([
      {
        type: 'complete',
        mode,
        missionId: sources[index].missions[0].id,
        runId: `storage-fixture-${mode}`,
        gameplayId: `storage-fixture-${mode}-harbors`,
        difficulty: 'standard',
      },
      { type: 'select', mode, missionId: sources[index].missions[1].id },
    ]);
    assert.equal(await store.flush(), true);
    owners.push({ profileKey, expected: await backend.readState() });
  }
  return async () => {
    for (const owner of owners) {
      const reopened = createJourneyBackend({ ...disk, profileKey: owner.profileKey });
      assert.deepEqual(await reopened.readState(), owner.expected);
    }
  };
}

for (const fault of ['connection loss', 'cancel', 'quota write', 'storage estimate'])
  test(`Team/Duel immutable update preserves earlier verified content and progress after ${fault}, then resumes and rolls back`, async () => {
    const caches = committedCaches(),
      originalOpen = caches.open;
    let failure = null,
      rejectSelection = false;
    caches.open = async (name) => {
      const cache = await originalOpen(name),
        put = cache.put;
      return {
        ...cache,
        async put(key, response) {
          if (
            failure === 'quota write' &&
            name === OFFICIAL_CACHE &&
            String(key).endsWith(candidate.files[2].sha256)
          )
            throw new DOMException('Controlled storage quota exhaustion', 'QuotaExceededError');
          return put(key, response);
        },
      };
    };
    const calls = [],
      network = new Map(
        releases.flatMap(({ edition, bodies }) =>
          [...bodies].map(([path, body]) => [new URL(path, edition.scope).href, body]),
        ),
      );
    const environment = {
      caches,
      origin,
      locks,
      storage: {
        estimate: async () => ({ quota: failure === 'storage estimate' ? 0 : 1e9, usage: 0 }),
      },
      fetch: async (url) => {
        calls.push(String(url));
        if (
          failure === 'connection loss' &&
          String(url) === new URL(candidate.files[2].path, candidate.edition.scope).href
        )
          throw new TypeError('Controlled connection loss');
        assert.ok(network.has(String(url)), 'Only declared fixture files may be requested.');
        return new Response(network.get(String(url)));
      },
    };
    const values = new Map(),
      storage = {
        getItem: (key) => values.get(key) ?? null,
        setItem(key, value) {
          if (
            rejectSelection &&
            key === INSTALLED_STATE_KEY &&
            JSON.parse(value).active?.version === '2.0.0'
          )
            throw new DOMException('Controlled selection metadata quota', 'QuotaExceededError');
          values.set(key, value);
        },
      };
    const installation = {
      storage,
      locks,
      readAsset: async () => null,
      locationRef: new URL(`${base}app/update.html`),
    };
    const job = (release, extra = {}) => ({
      edition: release.edition.scope,
      group: 'gameplay',
      selection: release.edition.selection,
      files: release.files,
      baseURL: release.edition.scope,
      ...extra,
    });
    const oldStore = createOfficialDownloads(environment);
    await oldStore.download(job(earlier));
    await activateInstalledEdition(earlier.edition, installation);
    storage.setItem(profileKey(earlier.edition), 'preserved profile migration fixture');
    const checkProgress = await progressFixture();
    await (
      await caches.open('user-imports')
    ).put(`${origin}/custom-team-assets`, new Response('saved user assets'));
    const keepEarlier = async () => {
      assert.deepEqual(readInstalledState(storage).active, earlier.edition);
      assert.equal((await oldStore.inspect(earlier.files, { verify: true })).ready, true);
      for (const file of earlier.files)
        assert.deepEqual(
          Buffer.from(await (await oldStore.read(file.sha256)).arrayBuffer()),
          earlier.bodies.get(file.path),
        );
      assert.equal(
        storage.getItem(profileKey(earlier.edition)),
        'preserved profile migration fixture',
      );
      assert.equal(
        await (
          await (await caches.open('user-imports')).match(`${origin}/custom-team-assets`)
        ).text(),
        'saved user assets',
      );
      await checkProgress();
    };

    failure = fault;
    const controller = new AbortController(),
      store = createOfficialDownloads(environment);
    const attempt = store.download(
      job(candidate, {
        signal: controller.signal,
        onProgress(report) {
          if (
            fault === 'cancel' &&
            report.readyBytes === candidate.files[0].bytes + candidate.files[1].bytes
          )
            controller.abort();
        },
      }),
    );
    await assert.rejects(
      attempt,
      fault === 'cancel'
        ? { name: 'AbortError' }
        : fault === 'quota write'
          ? { name: 'QuotaExceededError' }
          : /connection loss|estimated storage/,
    );
    await keepEarlier();
    assert.equal(
      (await store.states()).find((state) => state.edition === candidate.edition.scope).complete,
      false,
    );
    const beforeRetry = calls.length;
    failure = null;
    const reopened = createOfficialDownloads(environment);
    await reopened.download(job(candidate));
    const retried = calls.slice(beforeRetry);
    assert.deepEqual(
      retried,
      candidate.files
        .slice(fault === 'storage estimate' ? 1 : 2)
        .map((file) => new URL(file.path, candidate.edition.scope).href),
      'Retry reuses every verified file, including shared bytes from the earlier edition.',
    );
    await stageInstalledEdition(candidate.edition, installation);
    let prepared = 0;
    const prepare = async () => {
      prepared++;
      assert.equal((await reopened.inspect(candidate.files, { verify: true })).ready, true);
    };
    assert.equal(
      (await activateInstalledEdition(candidate.edition, { ...installation, prepare })).activated,
      false,
    );
    assert.equal(
      prepared,
      0,
      'Existing progress requires reviewed transfer before replacing the core.',
    );
    await keepEarlier();
    const review = await reviewInstalledMigration(
      earlier.edition.version,
      candidate.edition.version,
      installation,
    );
    storage.setItem(profileKey(candidate.edition), 'reviewed compatible profile fixture');
    await recordInstalledMigration(review, installation);
    if (fault === 'quota write') {
      rejectSelection = true;
      await assert.rejects(
        activateInstalledEdition(candidate.edition, { ...installation, prepare }),
        { name: 'QuotaExceededError' },
      );
      await keepEarlier();
      rejectSelection = false;
    }
    assert.equal(
      (await activateInstalledEdition(candidate.edition, { ...installation, prepare })).activated,
      true,
    );
    assert.deepEqual(readInstalledState(storage).previous, earlier.edition);
    await checkProgress();
    assert.equal(
      (await activateInstalledEdition(earlier.edition, { ...installation, restorePrevious: true }))
        .activated,
      true,
    );
    await keepEarlier();
    assert.equal((await reopened.inspect(candidate.files, { verify: true })).ready, true);
    assert.equal(
      storage.getItem(profileKey(candidate.edition)),
      'reviewed compatible profile fixture',
    );
  });

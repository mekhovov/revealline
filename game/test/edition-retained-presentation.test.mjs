import test from 'node:test';
import assert from 'node:assert/strict';
import { retainedEditionFixture } from './helpers/retained-edition-fixture.mjs';
import {
  validateRetainedPresentation,
  loadRetainedPresentation,
} from '../editions/retained-presentation.mjs';
import { createContentExecutionCatalog } from '../content-design/execution.mjs';
import { createJourneyBackend } from '../journey/profile.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { acquireCandidatePicture } from '../content-design/picture.mjs';
import { loadPreviewArtwork } from '../content-design/assets.mjs';
import { PNGImage } from './helpers/png-image.mjs';

test('retained original preserves exact execution and receipt while new artwork keeps logical Journey progress', async () => {
  const f = await retainedEditionFixture();
  const old = createContentExecutionCatalog(f.original.route.source, { mode: 'solo' });
  const mission = old.journey().missions[0];
  const disk = managedIndexedDB(),
    backend = createJourneyBackend({ ...disk, profileKey: f.original.route.profileKey });
  const before = await backend.commit([
    {
      type: 'complete',
      mode: 'solo',
      missionId: mission.id,
      runId: 'retained-run',
      gameplayId: old.entries[0].manifests[0].simulationIdentity,
      difficulty: 'standard',
    },
  ]);
  f.replacePicture();
  const current = await f.load(),
    retained = await f.load(f.descriptor.id);
  const changed = createContentExecutionCatalog(current.route.source, { mode: 'solo' }),
    exact = createContentExecutionCatalog(retained.route.source, { mode: 'solo' });
  assert.notEqual(changed.entries[0].executionKey, old.entries[0].executionKey);
  assert.equal(exact.entries[0].executionKey, old.entries[0].executionKey);
  assert.equal(retained.authoredPresentationSha256, f.original.authoredPresentationSha256);
  assert.notEqual(current.authoredPresentationSha256, retained.authoredPresentationSha256);
  assert.deepEqual(exact.entries, old.entries);
  assert.equal(changed.journey().missions[0].id, mission.id);
  assert.equal(
    changed.entries[0].manifests[0].simulationIdentity,
    old.entries[0].manifests[0].simulationIdentity,
  );
  assert.equal(current.route.profileKey, retained.route.profileKey);
  assert.equal(current.route.sessionKey, retained.route.sessionKey);
  assert.deepEqual(
    await createJourneyBackend({ ...disk, profileKey: current.route.profileKey }).read(),
    before,
  );
  assert.equal(new URL(retained.href()).searchParams.get('presentation'), f.descriptor.id);
  assert.equal(
    new URL(retained.href({ presentation: null })).searchParams.has('presentation'),
    false,
  );
  assert.equal(
    new URL(retained.href({ edition: 'another-edition' })).searchParams.has('presentation'),
    false,
  );
});

test('retained lookup refuses unknown identities and corrupt or missing originals without substituting current data', async () => {
  const f = await retainedEditionFixture();
  f.replacePicture();
  await assert.rejects(f.load('f'.repeat(64)), /not registered/);
  const bytes = f.binary.get(f.descriptor.path);
  f.binary.set(f.descriptor.path, Buffer.concat([bytes, Buffer.from(' ')]));
  await assert.rejects(f.load(f.descriptor.id), /exceeds its pin/);
  f.binary.set(
    f.descriptor.path,
    Buffer.from(bytes.toString().replace('Sample company', 'Broken company')),
  );
  await assert.rejects(f.load(f.descriptor.id), /differ from the registered/);
  f.binary.delete(f.descriptor.path);
  await assert.rejects(f.load(f.descriptor.id), /unavailable/);
});

test('retained snapshot cannot admit another audience, omitted JSON, restricted art or a forged receipt', async () => {
  const f = await retainedEditionFixture();
  for (const mutate of [
    (s) => {
      s.catalog.editions[0].audience = 'employees';
    },
    (s) => {
      s.files.push({ path: 'game/private.json', data: {} });
    },
    (s) => {
      s.files.pop();
    },
    (s) => {
      s.authoredPresentationSha256 = 'f'.repeat(64);
    },
    (s) => {
      s.catalog.editions[0].presentationHistory = [f.descriptor];
    },
    (s) => {
      s.catalog.assets.push({
        id: 'secret',
        path: 'game/editions/assets/secret.png',
        sha256: 'a'.repeat(64),
        bytes: 1,
        publication: 'restricted',
        approved: false,
        dependencies: [],
      });
    },
  ]) {
    const value = structuredClone(f.snapshot);
    mutate(value);
    await assert.rejects(validateRetainedPresentation(value, { edition: f.catalog.editions[0] }));
  }
});

test('old pixels remain separately pinned and cannot fall back to the new image when absent or corrupt', async () => {
  const f = await retainedEditionFixture({ originalArtwork: true });
  f.replacePicture();
  const old = await f.load(f.descriptor.id);
  assert.equal(old.route.source.assets[0].id, 'old-picture');
  assert.equal((await f.load()).route.source.assets[0].id, 'new-picture');
  const path = 'game/editions/assets/old-picture.png',
    bytes = f.binary.get(path);
  const acquireOld = async () => {
    const retained = await f.load(f.descriptor.id);
    assert.equal(retained.authoredPresentationSha256, old.authoredPresentationSha256);
    assert.deepEqual(retained.route.source.assets[0], old.route.source.assets[0]);
    return acquireCandidatePicture(retained.route.source.assets[0], {
      loadArtwork: (source, options) =>
        loadPreviewArtwork(source, { ...options, fetchAsset: f.fetcher }),
      ImageClass: PNGImage,
    });
  };
  const picture = await acquireOld();
  assert.equal(picture.image.width, old.route.source.assets[0].width);
  picture.release();
  f.binary.set(path, Buffer.from(bytes).fill(0));
  await assert.rejects(acquireOld(), /digest differs/);
  f.binary.delete(path);
  await assert.rejects(acquireOld(), /failed to load/);
  assert.equal((await f.load()).route.source.assets[0].id, 'new-picture');
});

test('retained snapshot reads cancel stalled fetches and streams without late activation', async () => {
  const f = await retainedEditionFixture();
  const options = {
    edition: f.catalog.editions[0],
    baseURL: 'https://example.test/',
    timeoutMs: 5,
  };
  await assert.rejects(
    loadRetainedPresentation(f.descriptor, {
      ...options,
      fetcher: () => new Promise(() => {}),
    }),
    /did not load in time/,
  );
  const controller = new AbortController();
  let cancelled = false;
  const pending = loadRetainedPresentation(f.descriptor, {
    ...options,
    timeoutMs: 20000,
    signal: controller.signal,
    fetcher: async () =>
      new Response(
        new ReadableStream({
          cancel() {
            cancelled = true;
          },
        }),
      ),
  });
  await new Promise((resolve) => setImmediate(resolve));
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(cancelled, true);
});

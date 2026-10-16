/** Bounded production transactions; every run owns new UUID databases only. */
import { openRegionalLibrary } from '../../../optional-practice/civilian-fpv/regional-delivery.mjs';
import { openRegionalLocations } from '../../../optional-practice/civilian-fpv/regional-locations.mjs';
const assert = {
  equal(a, b) {
    if (a !== b) throw new Error(`Expected ${b}, received ${a}`);
  },
  deepEqual(a, b) {
    this.equal(JSON.stringify(a), JSON.stringify(b));
  },
  async rejects(promise, pattern) {
    try {
      await promise;
    } catch (error) {
      if (pattern.test(error.message)) return;
      throw error;
    }
    throw new Error('Expected rejection');
  },
  throws(action, pattern) {
    try {
      action();
    } catch (error) {
      if (pattern.test(error.message)) return;
      throw error;
    }
    throw new Error('Expected rejection');
  },
};
const digest = async (bytes) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
export async function verifyRevisionRemoval({ indexedDB, descriptorBytes: a, readSource }) {
  const descriptor = JSON.parse(new TextDecoder().decode(a));
  const b = new TextEncoder().encode(
    JSON.stringify({ ...descriptor, revision: 'removal-fixture-r2' }),
  );
  const pin = async (bytes, name) => ({
    url: `https://fixture.invalid/${name}/delivery.json`,
    bytes: bytes.length,
    sha256: await digest(bytes),
  });
  const pins = await Promise.all([pin(a, 'a'), pin(b, 'b')]);
  const fetchImpl = async (input) => {
    const path = new URL(input).pathname;
    if (path.endsWith('/delivery.json')) return new Response(path.startsWith('/a/') ? a : b);
    return new Response(await readSource(path.slice(3)));
  };
  const name = `fpv-removal-review-${crypto.randomUUID()}`;
  const store = await openRegionalLibrary({ indexedDB, name });
  const concurrent = await openRegionalLibrary({ indexedDB, name });
  const places = await openRegionalLocations({
    indexedDB,
    name: `${name}-places`,
  });
  const identity = {
    regionId: descriptor.id,
    revision: descriptor.revision,
    sha256: pins[0].sha256,
  };
  const cases = [];
  try {
    await store.install(pins[0], {
      fetchImpl,
      pageURL: 'https://fixture.invalid/',
    });
    await places.add(
      identity,
      {
        label: 'Keep this place',
        pose: { position: { x: 64000, y: 3000, z: 16000 }, heading: 0 },
      },
      { expectedGeneration: 0 },
    );
    const originalPlaces = await places.list(identity);
    const loaded = await store.load(descriptor.id, { sha256: pins[0].sha256 });
    const stale = await store.removalSnapshot(descriptor.id, {
      sha256: pins[0].sha256,
    });
    await concurrent.install(pins[1], {
      fetchImpl,
      pageURL: 'https://fixture.invalid/',
    });
    await assert.rejects(
      store.removeRevision(descriptor.id, pins[0].sha256, {
        expectedGeneration: stale.generation,
      }),
      /changed/,
    );
    assert.equal((await store.list({ includeRevisions: true })).length, 2);
    cases.push('Concurrent install invalidates stale removal without deleting either revision');
    let reviewed = await store.removalSnapshot(descriptor.id, {
      sha256: pins[1].sha256,
    });
    assert.equal(reviewed.revision, 'removal-fixture-r2');
    assert.equal(reviewed.bytes, descriptor.totalBytes);
    await store.removeRevision(descriptor.id, pins[1].sha256, {
      expectedGeneration: reviewed.generation,
    });
    assert.deepEqual(
      (await store.list({ includeRevisions: true })).map((r) => r.sha256),
      [pins[0].sha256],
    );
    await store.load(descriptor.id, { sha256: pins[0].sha256 });
    await assert.rejects(store.load(descriptor.id, { sha256: pins[1].sha256 }), /not installed/);
    cases.push('Removing active revision preserves exact retained revision and cache-only load');
    await store.install(pins[1], {
      fetchImpl,
      pageURL: 'https://fixture.invalid/',
    });
    reviewed = await store.removalSnapshot(descriptor.id, {
      sha256: pins[0].sha256,
    });
    await store.removeRevision(descriptor.id, pins[0].sha256, {
      expectedGeneration: reviewed.generation,
    });
    assert.deepEqual(
      (await store.list({ includeRevisions: true })).map((r) => r.sha256),
      [pins[1].sha256],
    );
    const asset = loaded.manifest.assets[0];
    const response = await loaded.source.fetchImpl(new URL(asset.path, loaded.source.baseURL).href);
    assert.equal(await digest(await response.arrayBuffer()), asset.sha256);
    assert.deepEqual(await places.list(identity), originalPlaces);
    cases.push(
      'Removing inactive revision preserves active revision, saved places and bytes captured by an already-loaded flight',
    );
    await assert.rejects(
      store.removalSnapshot(descriptor.id, { sha256: pins[0].sha256 }),
      /no longer/,
    );
    assert.throws(() => store.removeRevision(descriptor.id, pins[1].sha256), /Review/);
    const all = await store.removalSnapshot(descriptor.id);
    await store.remove(descriptor.id, { expectedGeneration: all.generation });
    assert.deepEqual(await store.list({ includeRevisions: true }), []);
    assert.deepEqual(await places.list(identity), originalPlaces);
    cases.push(
      'Missing/stale revisions reject; separately reviewed all-version removal retains places',
    );
    return { name, cases };
  } finally {
    store.close();
    concurrent.close();
    places.close();
  }
}

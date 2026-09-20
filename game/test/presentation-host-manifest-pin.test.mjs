import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createPresentationHost } from '../presentation/host.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { FORMATS } from '../presentation/model.mjs';
import { compilePresentation } from '../../scripts/compile-presentation.mjs';
import { hashPresentationBytes } from '../presentation/bundle.mjs';

const baseURL = 'https://game.test/releases/v1/game/presentation/compiled/';
let fixturePromise;
function fixture() {
  fixturePromise ??= (async () => {
    const document = structuredClone(createDefaultThemeBundle());
    const bytes = new Uint8Array(
      await fs.readFile(
        new URL('../assets/field-kit/sprites/player-scout-compact.png', import.meta.url),
      ),
    );
    const hash = await hashPresentationBytes(bytes);
    const slot = document.slots.find((s) => s.id === 'player.scout.compact');
    const asset = {
      format: FORMATS.asset,
      id: 'host.test.sprite',
      revision: 1,
      kind: 'image',
      description: 'Exact generated native pixel sprite used as a host fixture.',
      provenance: {
        creator: 'Test',
        source: 'Field Kit pixel source',
        license: 'Project artwork',
        prompt: '',
        parent: null,
      },
      file: { sha256: hash, bytes: bytes.length, mime: 'image/png', width: 32, height: 32 },
      geometry: structuredClone(slot.geometry),
      recipe: null,
      quality: { stage: 'produced', evidence: [] },
    };
    document.assets.push(asset);
    document.themes[1].bindings[slot.id] = { id: asset.id, revision: 1 };
    const compiled = await compilePresentation(document, new Map([[hash, new Blob([bytes])]]));
    return {
      ...compiled,
      hash,
      bytes,
      manifest: JSON.parse(new TextDecoder().decode(compiled.files.get('runtime.json'))),
    };
  })();
  return fixturePromise;
}
function environment(f, overrides = {}) {
  const requests = [],
    decoded = [],
    urls = [],
    revoked = [];
  let serial = 0;
  const host = createPresentationHost({
    baseURL,
    fetch: async (url, options) => {
      requests.push({ url, options });
      const key = url.slice(baseURL.length),
        bytes = f.files.get(key);
      return bytes ? new Response(bytes) : new Response(null, { status: 404 });
    },
    decodeImage: async () => {
      const image = {
        width: 32,
        height: 32,
        closes: 0,
        close() {
          this.closes++;
        },
      };
      decoded.push(image);
      return image;
    },
    createObjectURL: (blob) => {
      const url = `blob:host-${serial++}`;
      urls.push({ url, blob });
      return url;
    },
    revokeObjectURL: (url) => revoked.push(url),
    ...overrides,
  });
  return { host, requests, decoded, urls, revoked };
}

test('accepted snapshots expose the hash of exact compiler manifest bytes', async () => {
  const f = await fixture(),
    env = environment(f);
  const expected = await hashPresentationBytes(f.files.get('runtime.json'));
  const snapshot = await env.host.load({ expectedManifestSha256: expected });
  assert.equal(snapshot.manifestSha256, expected);
  assert.equal(snapshot, env.host.current());
  assert(Object.isFrozen(snapshot));
  assert.equal(snapshot.image('player.scout.compact').image, env.decoded[0]);
  env.host.close();
});

test('legacy callers still load without a pin and receive the measured identity', async () => {
  const f = await fixture(),
    env = environment(f);
  assert.equal(
    (await env.host.load()).manifestSha256,
    await hashPresentationBytes(f.files.get('runtime.json')),
  );
  env.host.close();
});

test('wrong manifest pin rejects before asset fetch, image decode or adoption', async () => {
  const f = await fixture(),
    env = environment(f),
    statuses = [];
  await assert.rejects(
    env.host.load({
      expectedManifestSha256: '0'.repeat(64),
      onStatus: (value) => statuses.push(value),
    }),
    /pinned release/,
  );
  assert.deepEqual(
    env.requests.map((entry) => entry.url),
    [baseURL + 'runtime.json'],
  );
  assert.equal(env.decoded.length, 0);
  assert.equal(env.urls.length, 0);
  assert.equal(env.host.current(), null);
  assert.equal(statuses[0].stage, 'reading');
  assert.equal(statuses.at(-1).status, 'error');
  env.host.close();
});

test('byte changes including equivalent JSON whitespace cannot impersonate a retained manifest', async () => {
  const f = await fixture();
  const expected = await hashPresentationBytes(f.files.get('runtime.json'));
  const files = new Map(f.files);
  files.set('runtime.json', new TextEncoder().encode(JSON.stringify(f.manifest, null, 2)));
  const env = environment({ ...f, files });
  await assert.rejects(env.host.load({ expectedManifestSha256: expected }), /pinned release/);
  assert.equal(env.decoded.length, 0);
  const actual = await hashPresentationBytes(files.get('runtime.json'));
  assert.notEqual(actual, expected);
  assert.equal((await env.host.load({ expectedManifestSha256: actual })).manifestSha256, actual);
  env.host.close();
});

test('a failed pin check preserves the accepted snapshot and its decoded resources', async () => {
  const f = await fixture(),
    env = environment(f);
  const current = await env.host.load();
  await assert.rejects(env.host.load({ expectedManifestSha256: '0'.repeat(64) }), /pinned release/);
  assert.equal(env.host.current(), current);
  assert.equal(env.decoded.length, 1);
  assert.equal(env.decoded[0].closes, 0);
  assert.equal(current.image('player.scout.compact').image, env.decoded[0]);
  assert.equal(env.revoked.length, 0);
  env.host.close();
  assert.equal(env.decoded[0].closes, 1);
});

test('malformed expectations fail before retiring an in-flight valid load', async () => {
  const f = await fixture();
  let finish, began;
  const gate = new Promise((resolve) => {
    finish = resolve;
  });
  const started = new Promise((resolve) => {
    began = resolve;
  });
  const env = environment(f, {
    fetch: async (url) => {
      began();
      await gate;
      return new Response(f.files.get(url.slice(baseURL.length)));
    },
  });
  const expected = await hashPresentationBytes(f.files.get('runtime.json'));
  const pending = env.host.load({ expectedManifestSha256: expected });
  await started;
  for (const bad of ['latest', 'A'.repeat(64), '', 123, {}])
    await assert.rejects(env.host.load({ expectedManifestSha256: bad }), /exact SHA-256/);
  finish();
  assert.equal((await pending).manifestSha256, expected);
  env.host.close();
});

test('cancelled pinned reads and superseded requests never replace the current snapshot', async () => {
  const f = await fixture(),
    env = environment(f);
  const current = await env.host.load();
  const expected = current.manifestSha256;
  const stop = new AbortController();
  const pending = env.host.load({ expectedManifestSha256: expected, signal: stop.signal });
  stop.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(env.host.current(), current);
  assert.equal(env.decoded[0].closes, 0);
  const first = env.host.load({ expectedManifestSha256: expected });
  const cancelled = assert.rejects(first, { name: 'AbortError' });
  const next = await env.host.load({ expectedManifestSha256: expected });
  await cancelled;
  assert.equal(env.host.current(), next);
  assert.equal(next.manifestSha256, expected);
  env.host.close();
});

test('independent hosts can prepare a pinned replacement while the old attempt remains usable', async () => {
  const f = await fixture(),
    live = environment(f),
    staged = environment(f);
  const original = await live.host.load();
  const replacement = await staged.host.load({ expectedManifestSha256: original.manifestSha256 });
  assert.notEqual(replacement, original);
  assert.equal(live.host.current(), original);
  assert.equal(live.decoded[0].closes, 0);
  staged.host.close();
  assert.equal(staged.decoded[0].closes, 1);
  assert.equal(live.decoded[0].closes, 0);
  assert.equal(original.image('player.scout.compact').image, live.decoded[0]);
  live.host.close();
});

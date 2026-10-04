import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createPresentationHost, validateCompiledPresentation } from '../presentation/host.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { FORMATS, LIMITS } from '../presentation/model.mjs';
import { compilePresentation } from '../../scripts/compile-presentation.mjs';
import { hashPresentationBytes } from '../presentation/bundle.mjs';
import { CURRENT_PICTURES } from '../presentation/current-pictures.mjs';
import { prepareStillAsset } from '../media-still.mjs';
import { rasterFixtures } from './helpers/raster-fixtures.mjs';
import { pageActorArtPool } from '../presentation/actor-art-pool.mjs';

const baseURL = 'https://game.test/releases/v1/game/presentation/compiled/';
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
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
function styleFixture() {
  const values = new Map();
  return {
    values,
    style: {
      getPropertyValue: (name) => values.get(name) ?? '',
      getPropertyPriority: () => '',
      setProperty: (name, value) => values.set(name, value),
      removeProperty: (name) => values.delete(name),
    },
  };
}

test('native landing skips only the two legacy title backdrops while other screens still load', async () => {
  const folder = new URL('../presentation/compiled/', import.meta.url);
  const manifest = JSON.parse(await fs.readFile(new URL('runtime.json', folder), 'utf8'));
  const byHash = new Map(
    Object.values(manifest.resolved.assets)
      .filter((asset) => asset.file)
      .map((asset) => [asset.file.sha256, asset.file]),
  );
  const seen = new Set();
  let nativeLanding = true;
  const host = createPresentationHost({
    baseURL,
    document: {
      querySelector: (selector) => (selector === '.native-landing' && nativeLanding ? {} : null),
    },
    fetch: async (url) => {
      const file = url.slice(baseURL.length);
      seen.add(file);
      return new Response(
        file === 'runtime.json'
          ? JSON.stringify(manifest)
          : await fs.readFile(new URL(file, folder)),
      );
    },
    decodeImage: async (blob) => {
      const hash = await hashPresentationBytes(new Uint8Array(await blob.arrayBuffer()));
      const file = byHash.get(hash);
      return { width: file.width, height: file.height, close() {} };
    },
    createObjectURL: () => 'blob:test',
    revokeObjectURL() {},
    fontFactory: () => ({ load: async () => {} }),
  });
  const snapshot = await host.load();
  for (const id of ['screen.title.background', 'screen.title.portrait']) {
    const asset = manifest.resolved.assets[id];
    assert.ok(asset, id);
    assert.equal(snapshot.image(id), null);
    assert.equal(seen.has(manifest.urls[asset.file.sha256]), false);
  }
  assert.ok(snapshot.image('player.scout.compact'));
  // A different screen may intentionally reuse one title image; its binding
  // still loads. The optimization filters slots rather than banning hashes.
  manifest.resolved.assets['screen.settings.background'] = structuredClone(
    manifest.resolved.assets['screen.title.background'],
  );
  manifest.resolved.bindings['screen.settings.background'] = structuredClone(
    manifest.resolved.bindings['screen.title.background'],
  );
  const replacement = await host.load();
  assert.ok(replacement.image('screen.settings.background'));
  assert.equal(replacement.image('screen.title.background'), null);
  nativeLanding = false;
  const classic = await host.load();
  assert.ok(classic.image('screen.title.background'));
  assert.ok(classic.image('screen.title.portrait'));
  host.close();
});

test('the host accepts actual deterministic compiler output and no authoring history or arbitrary URLs', async () => {
  const f = await fixture();
  assert.deepEqual(validateCompiledPresentation(f.manifest), f.manifest);
  for (const mutate of [
    (m) => {
      m.unknown = true;
    },
    (m) => {
      m.urls[f.hash] = `https://other.test/${f.hash}.png`;
    },
    (m) => {
      m.urls[f.hash] = `./assets/${f.hash}.png?path=other`;
    },
    (m) => {
      m.urls[f.hash] = './assets/../source.png';
    },
    (m) => {
      delete m.urls[f.hash];
    },
    (m) => {
      m.resolved.bindings['player.scout.compact'].revision++;
    },
    (m) => {
      delete m.resolved.assets['player.scout.compact'];
    },
    (m) => {
      delete m.resolved.tokens.cyan;
    },
    (m) => {
      m.resolved.tokens.cyan = 'url(https://other.test)';
    },
    (m) => {
      m.resolved.assets['player.scout.compact'].geometry.pivot.x = 2;
    },
  ]) {
    const value = structuredClone(f.manifest);
    mutate(value);
    assert.throws(() => validateCompiledPresentation(value));
  }
});

test('loading is lazy, hash-pinned, and owns decoded assets until close without storage access', async () => {
  const f = await fixture(),
    e = environment(f);
  assert.equal(e.host.current(), null);
  assert.equal(e.requests.length, 0);
  const statuses = [];
  const loading = e.host.load({ onStatus: (status) => statuses.push(status) });
  assert.equal(statuses[0].stage, 'reading');
  const snapshot = await loading;
  assert.ok(statuses.some((status) => status.stage === 'decoding'));
  assert.equal(statuses.at(-1).status, 'ready');
  assert.equal(snapshot.image('player.scout.compact').image, e.decoded[0]);
  assert.equal(snapshot.image('scene.reveal.wide'), null);
  assert.equal(snapshot.picturePolicy, 'durable-defaults-for-new-attempts');
  assert.deepEqual(
    e.requests.map((r) => r.url),
    [baseURL + 'runtime.json', baseURL + `assets/${f.hash}.png`],
  );
  assert.ok(
    e.requests.every(
      (r) => r.options.redirect === 'error' && r.options.credentials === 'same-origin',
    ),
  );
  assert.equal(e.decoded[0].closes, 0);
  e.host.close();
  e.host.close();
  assert.equal(e.decoded[0].closes, 1);
  assert.deepEqual(
    e.revoked,
    e.urls.map((r) => r.url),
  );
  await assert.rejects(e.host.load(), /closed/);
});

test('DOM-isolated actor owners share the actual page budget and independently offload and reinstall', async (t) => {
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'document'),
    document = { defaultView: { navigator: { deviceMemory: 8 } } };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
  t.after(() => {
    if (prior) Object.defineProperty(globalThis, 'document', prior);
    else delete globalThis.document;
  });
  const f = await fixture(),
    page = environment(f, { document }),
    actor = environment(f, { profile: 'actors', document: null }),
    pool = pageActorArtPool(document);
  t.after(() => {
    page.host.close();
    actor.host.close();
  });
  const original = await page.host.load(),
    isolated = await actor.host.load();
  assert.strictEqual(
    isolated.image('player.scout.compact').image,
    original.image('player.scout.compact').image,
  );
  assert.equal(actor.decoded.length, 0, 'No second decoder for the same page-owned SHA.');
  assert.equal(pool.stats().limit, 64 * 1024 * 1024);
  assert.equal(pool.stats().reservedBytes, 4096);
  assert.equal(pool.stats().leases, 2);
  page.host.close();
  assert.equal(page.decoded[0].closes, 0, 'The active actor owner survives page-theme offload.');
  actor.host.close();
  assert.equal(page.decoded[0].closes, 1);
  assert.equal(pool.stats().reservedBytes, 0);
  const reinstalled = environment(f, { profile: 'actors', document: null });
  t.after(() => reinstalled.host.close());
  await reinstalled.host.load();
  assert.equal(reinstalled.decoded.length, 1, 'A later install cannot reuse a disposed image.');
  assert.equal(pool.stats().reservedBytes, 4096);
  reinstalled.host.close();
  assert.equal(reinstalled.decoded[0].closes, 1);
  assert.equal(pool.stats().reservedBytes, 0);
});

test('registered native origins retain the same closed hash-derived path boundary', async () => {
  const f = await fixture();
  for (const origin of ['revealline://app', 'capacitor://localhost']) {
    const base = `${origin}/game/presentation/compiled/`,
      requests = [];
    const e = environment(f, {
      baseURL: base,
      fetch: async (url) => {
        requests.push(url);
        return new Response(f.files.get(url.slice(base.length)));
      },
    });
    await e.host.load();
    assert.ok(requests.every((url) => url.startsWith(base)));
    e.host.close();
  }
  for (const invalid of [
    'file:///tmp/compiled/',
    'revealline://other/compiled/',
    'capacitor://remote/compiled/',
    'unknown://app/compiled/',
  ])
    assert.throws(() => createPresentationHost({ baseURL: invalid }), /registered/);
});

test('CSS cleanup restores only owned values and preserves later user or screen changes', async () => {
  const e = environment(await fixture()),
    element = styleFixture();
  element.style.setProperty('--fk-bg', '#112233');
  await e.host.load();
  const undo = e.host.apply(element);
  assert.equal(element.style.getPropertyValue('--fk-bg'), '#070b12');
  assert.match(
    element.style.getPropertyValue('--fk-asset-player-scout-compact'),
    /^url\("blob:host-/,
  );
  element.style.setProperty('--fk-text', '#abcdef');
  undo();
  undo();
  assert.equal(element.style.getPropertyValue('--fk-bg'), '#112233');
  assert.equal(element.style.getPropertyValue('--fk-text'), '#abcdef');
  assert.equal(element.style.getPropertyValue('--fk-asset-player-scout-compact'), '');
  e.host.close();
});

test('a failed replacement leaves the previous accepted snapshot and its assets alive atomically', async () => {
  const f = await fixture();
  let fail = false;
  const e = environment(f, {
    fetch: async (url) => {
      const bytes = f.files.get(url.slice(baseURL.length));
      return fail && url.endsWith('.png') ? new Response(bytes.slice(1)) : new Response(bytes);
    },
  });
  const before = await e.host.load();
  fail = true;
  const failed = [];
  await assert.rejects(e.host.load({ onStatus: (status) => failed.push(status) }), /Truncated/);
  assert.equal(failed.at(-1).status, 'error');
  assert.equal(e.host.current(), before);
  assert.equal(e.decoded[0].closes, 0);
  e.host.close();
  assert.equal(e.decoded[0].closes, 1);
});

test('bad hashes, oversized bodies, redirects, dimensions and unavailable files cannot be adopted', async () => {
  const f = await fixture();
  for (const mode of ['hash', 'size', 'redirect', 'dimension', 'missing']) {
    const decoded = [];
    const e = environment(f, {
      fetch: async (url) => {
        const bytes = f.files.get(url.slice(baseURL.length));
        if (!url.endsWith('.png')) return new Response(bytes);
        if (mode === 'missing') return new Response(null, { status: 404 });
        if (mode === 'redirect') return { ok: true, redirected: true, url };
        if (mode === 'size') return new Response(new Uint8Array(bytes.length + 1));
        const bad = new Uint8Array(bytes);
        if (mode === 'hash') bad[bad.length - 1] ^= 1;
        return new Response(bad);
      },
      decodeImage: async () => {
        const image = {
          width: mode === 'dimension' ? 31 : 32,
          height: 32,
          closes: 0,
          close() {
            this.closes++;
          },
        };
        decoded.push(image);
        return image;
      },
    });
    await assert.rejects(e.host.load());
    assert.equal(e.host.current(), null);
    assert.ok(decoded.every((image) => image.closes === 1));
    e.host.close();
  }
});

test('a small compressed manifest cannot allocate an unbounded decoded image set', async () => {
  const f = await fixture(),
    manifest = structuredClone(f.manifest),
    files = new Map(f.files);
  for (let i = 1; i <= 17; i++) {
    const slot = `enemy.budget-${i}`,
      hash = i.toString(16).padStart(64, '0');
    const asset = structuredClone(manifest.resolved.assets['player.scout.compact']);
    asset.id = `budget-${i}`;
    asset.file.sha256 = hash;
    asset.file.width = asset.file.height = 1024;
    manifest.resolved.assets[slot] = asset;
    manifest.resolved.bindings[slot] = { id: asset.id, revision: asset.revision };
    manifest.urls[hash] = `./assets/${hash}.png`;
  }
  files.set('runtime.json', new TextEncoder().encode(JSON.stringify(manifest)));
  const e = environment({ files });
  await assert.rejects(e.host.load(), /decoded pixel budget/);
  assert.equal(e.requests.length, 1);
  assert.equal(e.decoded.length, 0);
  e.host.close();
});

test('superseded late image decoding is disposed and cannot release the newer accepted snapshot', async () => {
  const f = await fixture();
  let release,
    count = 0;
  const stale = {
      width: 32,
      height: 32,
      closes: 0,
      close() {
        this.closes++;
      },
    },
    fresh = { ...stale };
  const e = environment(f, {
    decodeImage: async () => {
      if (count++ === 0)
        return new Promise((resolve) => {
          release = resolve;
        });
      return fresh;
    },
  });
  const oldStatus = [],
    nextStatus = [];
  const first = e.host.load({ onStatus: (status) => oldStatus.push(status) });
  while (!release) await tick();
  const rejected = assert.rejects(first, { name: 'AbortError' });
  const oldCount = oldStatus.length;
  const replacement = e.host.load({ onStatus: (status) => nextStatus.push(status) });
  await tick();
  assert.equal(count, 1, 'A cancelled codec retains its reservation until it settles.');
  release(stale);
  await rejected;
  const second = await replacement;
  assert.equal(oldStatus.length, oldCount);
  assert.equal(nextStatus.at(-1).status, 'ready');
  assert.equal(stale.closes, 1);
  assert.equal(fresh.closes, 0);
  assert.equal(e.host.current(), second);
  e.host.close();
  assert.equal(fresh.closes, 1);
});

test('close cancels a stalled byte stream; a previous external signal cannot abort a later load', async () => {
  const f = await fixture();
  let cancelled = 0,
    requested = false;
  const e = environment(f, {
    fetch: async () => {
      requested = true;
      return new Response(
        new ReadableStream({
          cancel() {
            cancelled++;
          },
        }),
      );
    },
  });
  const loading = e.host.load(),
    rejected = assert.rejects(loading, { name: 'AbortError' });
  while (!requested) await tick();
  e.host.close();
  await rejected;
  assert.equal(cancelled, 1);
  const second = environment(f),
    old = new AbortController();
  await second.host.load({ signal: old.signal });
  const accepted = await second.host.load();
  old.abort();
  assert.equal(second.host.current(), accepted);
  second.host.close();
});

test('atlas frames are cropped once and the original and cropped bitmap have independent owned lifetimes', async () => {
  const f = await fixture(),
    manifest = structuredClone(f.manifest),
    files = new Map(f.files);
  const geometry = manifest.resolved.assets['player.scout.compact'].geometry;
  geometry.frame = { x: 8, y: 4, width: 16, height: 16 };
  const calls = [],
    cropped = {
      width: 16,
      height: 16,
      closes: 0,
      close() {
        this.closes++;
      },
    };
  files.set('runtime.json', new TextEncoder().encode(JSON.stringify(manifest)));
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ drawImage: (...args) => calls.push(args) }),
    toBlob: (callback) => callback(new Blob([f.bytes], { type: 'image/png' })),
  };
  const e = environment(
    { files },
    {
      document: { createElement: () => canvas },
      cropImage: async (original, frame) => {
        assert.equal(original.width, 32);
        assert.deepEqual(frame, geometry.frame);
        return cropped;
      },
    },
  );
  const snapshot = await e.host.load();
  assert.equal(snapshot.image('player.scout.compact').image, cropped);
  assert.deepEqual(calls, [[cropped, 0, 0]]);
  assert.equal(canvas.width, 0);
  assert.equal(canvas.height, 0);
  e.host.close();
  assert.equal(cropped.closes, 1);
  assert.equal(e.decoded[0].closes, 1);
});

test('a cancelled actor CSS export retains its accounted scratch pixels until encoding settles', async () => {
  const f = await fixture(),
    manifest = structuredClone(f.manifest),
    files = new Map(f.files);
  manifest.resolved.assets['player.scout.compact'].geometry.frame = {
    x: 8,
    y: 4,
    width: 16,
    height: 16,
  };
  files.set('runtime.json', new TextEncoder().encode(JSON.stringify(manifest)));
  let finish,
    cropClosed = 0;
  const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage() {} }),
      toBlob: (callback) => {
        finish = callback;
      },
    },
    document = { createElement: () => canvas },
    pool = pageActorArtPool(document),
    e = environment(
      { files },
      {
        document,
        cropImage: async () => ({ width: 16, height: 16, close: () => cropClosed++ }),
      },
    ),
    loading = e.host.load(),
    rejected = assert.rejects(loading, { name: 'AbortError' });
  while (!finish) await tick();
  assert.equal(pool.stats().reservedBytes, 4096 + 1024 + 1024);
  e.host.close();
  assert.equal(e.decoded[0].closes, 1);
  assert.equal(cropClosed, 1);
  assert.equal(canvas.width, 16, 'The encoder still owns this backing store.');
  assert.equal(pool.stats().reservedBytes, 1024);
  finish(new Blob([f.bytes], { type: 'image/png' }));
  await rejected;
  assert.equal(canvas.width, 0);
  assert.equal(canvas.height, 0);
  assert.equal(pool.stats().reservedBytes, 0);
  assert.equal(e.urls.length, 0, 'A cancelled export cannot create a CSS image URL.');
});

test('actor CSS crop export refuses capacity before allocating a scratch canvas', async () => {
  const f = await fixture(),
    manifest = structuredClone(f.manifest),
    files = new Map(f.files);
  manifest.resolved.assets['player.scout.compact'].geometry.frame = {
    x: 8,
    y: 4,
    width: 16,
    height: 16,
  };
  files.set('runtime.json', new TextEncoder().encode(JSON.stringify(manifest)));
  let canvases = 0,
    cropsClosed = 0;
  const document = {
      createElement: () => {
        canvases++;
        return {};
      },
    },
    pool = pageActorArtPool(document),
    height = (pool.stats().limit - 5120) / 4,
    otherActors = await pool.acquire({
      key: 'other-live-actors',
      width: 1,
      height,
      load: () => ({ width: 1, height }),
    }),
    e = environment(
      { files },
      {
        document,
        cropImage: async () => ({ width: 16, height: 16, close: () => cropsClosed++ }),
      },
    );
  await assert.rejects(e.host.load(), /decoded byte budget/);
  assert.equal(canvases, 0);
  assert.equal(e.host.current(), null);
  assert.equal(e.decoded[0].closes, 1);
  assert.equal(cropsClosed, 1);
  assert.equal(pool.stats().reservedBytes, pool.stats().limit - 5120);
  e.host.close();
  otherActors.release();
  assert.equal(pool.stats().reservedBytes, 0);
});

test('font bytes are pinned and decoded before atomic registration, with owned CSS family and disposal', async () => {
  const f = await fixture(),
    manifest = structuredClone(f.manifest),
    files = new Map(f.files);
  const bytes = new Uint8Array(
      await fs.readFile(new URL('../ui/fonts/field-kit/ibm-plex-mono-500.woff2', import.meta.url)),
    ),
    hash = await hashPresentationBytes(bytes);
  const asset = manifest.resolved.assets['font.numeric'];
  Object.assign(asset, {
    id: 'compiled.numeric',
    kind: 'font',
    recipe: null,
    file: { sha256: hash, bytes: bytes.length, mime: 'font/woff2', width: null, height: null },
  });
  manifest.resolved.bindings['font.numeric'] = { id: asset.id, revision: 1 };
  manifest.urls[hash] = `./assets/${hash}.woff2`;
  files.set('runtime.json', new TextEncoder().encode(JSON.stringify(manifest)));
  files.set(`assets/${hash}.woff2`, bytes);
  const registered = [],
    removed = [],
    faces = [];
  let fail = false;
  const e = environment(
    { files },
    {
      document: {
        fonts: { add: (font) => registered.push(font), delete: (font) => removed.push(font) },
      },
      fontFactory: (family, source) => {
        assert.deepEqual(new Uint8Array(source), bytes);
        const face = {
          family,
          async load() {
            if (fail) throw new Error('Font decode failed.');
            return this;
          },
        };
        faces.push(face);
        return face;
      },
    },
  );
  const snapshot = await e.host.load(),
    element = styleFixture();
  e.host.apply(element);
  assert.deepEqual(registered, [faces[0]]);
  assert.equal(element.style.getPropertyValue('--fk-font-mono'), `'RLAsset-${hash}', monospace`);
  assert.equal(snapshot.fonts.numeric, `'RLAsset-${hash}', monospace`);
  fail = true;
  await assert.rejects(e.host.load(), /Font decode failed/);
  assert.equal(e.host.current(), snapshot);
  assert.equal(registered.length, 1);
  assert.equal(removed.length, 0);
  e.host.close();
  assert.deepEqual(removed, [faces[0]]);
  let finishFont, announce;
  const started = new Promise((resolve) => {
    announce = resolve;
  });
  const lateManifest = structuredClone(manifest),
    lateFiles = new Map(files);
  lateManifest.resolved.assets = {
    'player.scout.compact': lateManifest.resolved.assets['player.scout.compact'],
    ...lateManifest.resolved.assets,
  };
  lateFiles.set('runtime.json', new TextEncoder().encode(JSON.stringify(lateManifest)));
  const late = environment(
    { files: lateFiles },
    {
      fontFactory: (family) => ({
        family,
        load() {
          announce();
          return new Promise((resolve) => {
            finishFont = resolve;
          });
        },
      }),
    },
  );
  const loading = late.host.load(),
    rejected = assert.rejects(loading, { name: 'AbortError' });
  await started;
  late.host.close();
  assert.equal(
    late.decoded[0].closes,
    1,
    'Already decoded images release before a pending font settles',
  );
  finishFont();
  await rejected;
  assert.equal(late.decoded[0].closes, 1);
});

test('picture originals remain lazy exact bytes and host close cancels a late original response', async () => {
  const f = await fixture(),
    manifest = structuredClone(f.manifest),
    slot = CURRENT_PICTURES.find((row) => row.owner.themeId === 'fpv').id,
    original = manifest.resolved.assets['player.scout.compact'];
  delete manifest.resolved.assets['player.scout.compact'];
  delete manifest.resolved.bindings['player.scout.compact'];
  manifest.resolved.assets[slot] = original;
  manifest.resolved.bindings[slot] = { id: original.id, revision: original.revision };
  for (const shared of ['scene.reveal.legacy', 'scene.reveal.wide']) {
    manifest.resolved.assets[shared] = original;
    manifest.resolved.bindings[shared] = { id: original.id, revision: original.revision };
  }
  const files = new Map(f.files);
  files.set('runtime.json', new TextEncoder().encode(JSON.stringify(manifest)));
  const env = environment({ ...f, files });
  const snapshot = await env.host.load();
  assert.equal(env.requests.length, 1);
  assert.equal(env.decoded.length, 0);
  const picture = await env.host.readPicture(slot, { snapshot });
  assert.equal(
    await hashPresentationBytes(new Uint8Array(await picture.blob.arrayBuffer())),
    f.hash,
  );
  assert.equal(env.decoded.length, 0, 'Still store owns complete original decoding.');
  for (const shared of ['scene.reveal.legacy', 'scene.reveal.wide']) {
    const fallback = await env.host.readPicture(shared, { snapshot });
    assert.equal(
      await hashPresentationBytes(new Uint8Array(await fallback.blob.arrayBuffer())),
      f.hash,
    );
  }
  await assert.rejects(env.host.readPicture('ui.panel'), /FPV original/);
  env.host.close();
  await assert.rejects(env.host.readPicture(slot, { snapshot }), /current picture/);

  let finish,
    started,
    cancelled = 0;
  const gate = new Promise((resolve) => {
      finish = resolve;
    }),
    began = new Promise((resolve) => {
      started = resolve;
    });
  const late = environment(
    { ...f, files },
    {
      fetch: async (url) => {
        if (url.endsWith('/runtime.json')) return new Response(files.get('runtime.json'));
        started();
        await gate;
        return {
          ok: true,
          body: {
            cancel: async () => {
              cancelled++;
            },
          },
        };
      },
    },
  );
  await late.host.load();
  const pending = late.host.readPicture(slot),
    rejected = assert.rejects(pending, { name: 'AbortError' });
  await began;
  late.host.close();
  finish();
  await rejected;
  assert.equal(cancelled, 1);
});

async function webpPictureFixture({ bytes, width = 1, frameWidth = width, fileBytes } = {}) {
  const f = await fixture(),
    manifest = structuredClone(f.manifest),
    slot = CURRENT_PICTURES.find((row) => row.owner.themeId === 'fpv').id,
    asset = manifest.resolved.assets['player.scout.compact'];
  bytes ??= rasterFixtures().find((row) => row.extension === 'webp').bytes;
  const hash = await hashPresentationBytes(bytes);
  delete manifest.resolved.assets['player.scout.compact'];
  delete manifest.resolved.bindings['player.scout.compact'];
  asset.file = {
    sha256: hash,
    bytes: fileBytes ?? bytes.length,
    mime: 'image/webp',
    width,
    height: 1,
  };
  asset.geometry.frame = { x: 0, y: 0, width: frameWidth, height: 1 };
  manifest.resolved.assets[slot] = asset;
  manifest.resolved.bindings[slot] = { id: asset.id, revision: asset.revision };
  manifest.urls = { [hash]: `./assets/${hash}.webp` };
  const files = new Map([
    ['runtime.json', new TextEncoder().encode(JSON.stringify(manifest))],
    [`assets/${hash}.webp`, bytes],
  ]);
  return { files, manifest, slot, hash, bytes };
}

test('full-frame WebP picture reads keep exact lazy bytes and still require downstream complete decode', async () => {
  const f = await webpPictureFixture(),
    env = environment(f);
  try {
    const snapshot = await env.host.load();
    assert.equal(env.requests.length, 1, 'Loading the presentation does not acquire originals.');
    const picture = await env.host.readPicture(f.slot, { snapshot });
    assert.deepEqual(Buffer.from(await picture.blob.arrayBuffer()), f.bytes);
    assert.equal(picture.blob.type, 'image/webp');
    assert.equal(picture.asset.file.sha256, f.hash);
    assert.ok(Object.isFrozen(picture.asset.file));
    assert.equal(env.requests.at(-1).url, baseURL + `assets/${f.hash}.webp`);
    assert.equal(env.requests.at(-1).options.redirect, 'error');
    assert.equal(env.decoded.length, 0, 'A verified header is not a complete browser decode.');
    const metadata = {
      id: 'webp-original',
      provenance: { kind: 'original', credit: 'Test', source: 'Owned raster fixture' },
    };
    await assert.rejects(
      prepareStillAsset(picture.blob, metadata, {
        decodeImage: async () => {
          throw new Error('Complete decoder refused fixture');
        },
      }),
      /Complete decoder refused/,
    );
    const prepared = await prepareStillAsset(picture.blob, metadata, {
      decodeImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }),
    });
    assert.equal(prepared.asset.sha256, f.hash);
    assert.deepEqual(Buffer.from(await prepared.blob.arrayBuffer()), f.bytes);
  } finally {
    env.host.close();
  }
});

test('WebP picture admission rejects cropped, malformed, mismatched and oversized originals without replacing its snapshot', async () => {
  const bytes = rasterFixtures().find((row) => row.extension === 'webp').bytes,
    animated = Buffer.from(bytes);
  animated.write('ANIM', 12);
  for (const [name, options, response, expected] of [
    ['cropped', { width: 2, frameWidth: 1 }, null, /complete PNG\/JPEG\/WebP/],
    ['animated', { bytes: animated }, null, /header disagrees/],
    ['truncated container', { bytes: bytes.subarray(0, -1) }, null, /header disagrees/],
    ['dimensions', { width: 2 }, null, /header disagrees/],
    ['wrong hash', {}, Buffer.from(bytes).fill(0), /hash mismatch/],
    ['oversized body', {}, Buffer.concat([bytes, Buffer.from([0])]), /byte budget/],
  ]) {
    const f = await webpPictureFixture(options);
    if (response) f.files.set(`assets/${f.hash}.webp`, response);
    const env = environment(f);
    try {
      const snapshot = await env.host.load();
      await assert.rejects(env.host.readPicture(f.slot), expected, name);
      assert.equal(env.host.current(), snapshot, name);
      assert.equal(env.decoded.length, 0, name);
      assert.equal(env.urls.length, 0, name);
      if (name === 'cropped') assert.equal(env.requests.length, 1, 'Crop rejected before fetch.');
    } finally {
      env.host.close();
    }
  }
  const oversized = environment(await webpPictureFixture({ fileBytes: LIMITS.assetBytes + 1 }));
  try {
    await assert.rejects(oversized.host.load(), /identity\/budget/);
    assert.equal(oversized.requests.length, 1);
    assert.equal(oversized.host.current(), null);
  } finally {
    oversized.host.close();
  }
});

test('aborted WebP original reads cancel late bodies and cannot retire the accepted snapshot', async () => {
  const f = await webpPictureFixture();
  let resolveBody,
    began,
    cancelled = 0;
  const pendingBody = new Promise((resolve) => {
      resolveBody = resolve;
    }),
    started = new Promise((resolve) => {
      began = resolve;
    }),
    controller = new AbortController(),
    env = environment(f, {
      fetch: async (url) => {
        if (url.endsWith('/runtime.json')) return new Response(f.files.get('runtime.json'));
        began();
        await pendingBody;
        return {
          ok: true,
          body: {
            cancel: async () => {
              cancelled++;
            },
          },
        };
      },
    });
  try {
    const snapshot = await env.host.load(),
      pending = env.host.readPicture(f.slot, { signal: controller.signal }),
      rejected = assert.rejects(pending, { name: 'AbortError' });
    await started;
    controller.abort();
    resolveBody();
    await rejected;
    assert.equal(cancelled, 1);
    assert.equal(env.host.current(), snapshot);
    assert.equal(env.decoded.length, 0);
    assert.equal(env.urls.length, 0);
  } finally {
    env.host.close();
  }
});

test('retained hosts load exact historical bytes beside shared assets without selecting the current manifest', async () => {
  const original = await fixture();
  const bytes = original.files.get('runtime.json');
  const pin = await hashPresentationBytes(bytes);
  const path = `runtime.${pin}.json`;
  const files = new Map(original.files);
  files.set(path, bytes);
  files.set('runtime.json', new TextEncoder().encode('unrelated current release'));
  const e = environment({ ...original, files }, { retainedManifestSha256: pin });
  try {
    const snapshot = await e.host.load({ expectedManifestSha256: pin });
    assert.equal(snapshot.manifestSha256, pin);
    assert.deepEqual(snapshot.resolved, original.manifest.resolved);
    assert.deepEqual(
      e.requests.map((request) => request.url),
      [baseURL + path, baseURL + `assets/${original.hash}.png`],
    );
    assert.equal(snapshot.image('player.scout.compact').image, e.decoded[0]);
  } finally {
    e.host.close();
  }
  assert.equal(e.decoded[0].closes, 1);
  assert.equal(e.revoked.length, e.urls.length);
});

test('retained host requires a matching explicit pin before fetching and rejects path-like authorities', async () => {
  const f = await fixture();
  const pin = await hashPresentationBytes(f.files.get('runtime.json'));
  for (const invalid of [
    '',
    'A'.repeat(64),
    '0'.repeat(63),
    '../runtime.json',
    `${pin}?v=1`,
    {},
    1,
  ]) {
    assert.throws(() => environment(f, { retainedManifestSha256: invalid }), /exact SHA-256/);
  }
  const e = environment(f, { retainedManifestSha256: pin });
  try {
    await assert.rejects(e.host.load(), /matching exact manifest pin/);
    await assert.rejects(
      e.host.load({ expectedManifestSha256: '0'.repeat(64) }),
      /matching exact manifest pin/,
    );
    assert.equal(e.requests.length, 0);
    assert.equal(e.host.current(), null);
  } finally {
    e.host.close();
  }
});

test('missing or altered retained manifests fail visibly without current-release fallback or bitmap allocation', async () => {
  const original = await fixture();
  const bytes = original.files.get('runtime.json');
  const pin = await hashPresentationBytes(bytes);
  const path = `runtime.${pin}.json`;
  for (const replacement of [
    null,
    new TextEncoder().encode(new TextDecoder().decode(bytes) + '\n'),
  ]) {
    const files = new Map(original.files);
    if (replacement) files.set(path, replacement);
    const e = environment({ ...original, files }, { retainedManifestSha256: pin });
    const statuses = [];
    try {
      await assert.rejects(
        e.host.load({ expectedManifestSha256: pin, onStatus: (status) => statuses.push(status) }),
        replacement ? /differs from its pinned release/ : /unavailable/,
      );
      assert.deepEqual(
        e.requests.map((request) => request.url),
        [baseURL + path],
      );
      assert.equal(e.decoded.length, 0);
      assert.equal(e.host.current(), null);
      assert.equal(statuses.at(-1).status, 'error');
    } finally {
      e.host.close();
    }
  }
});

test('failed retained reload and aborted preparation preserve the accepted owner until explicit close', async () => {
  const original = await fixture();
  const bytes = original.files.get('runtime.json');
  const pin = await hashPresentationBytes(bytes);
  const path = `runtime.${pin}.json`;
  const files = new Map(original.files);
  files.set(path, bytes);
  const e = environment({ ...original, files }, { retainedManifestSha256: pin });
  try {
    const snapshot = await e.host.load({ expectedManifestSha256: pin });
    files.delete(path);
    await assert.rejects(e.host.load({ expectedManifestSha256: pin }), /unavailable/);
    assert.equal(e.host.current(), snapshot);
    assert.equal(e.decoded[0].closes, 0);
    const controller = new AbortController();
    controller.abort();
    const count = e.requests.length;
    await assert.rejects(e.host.load({ expectedManifestSha256: pin, signal: controller.signal }), {
      name: 'AbortError',
    });
    assert.equal(e.requests.length, count);
    assert.equal(e.host.current(), snapshot);
    assert.equal(e.decoded[0].closes, 0);
  } finally {
    e.host.close();
  }
  assert.equal(e.decoded[0].closes, 1);
});

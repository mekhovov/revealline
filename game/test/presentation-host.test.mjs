import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createPresentationHost, validateCompiledPresentation } from '../presentation/host.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { FORMATS } from '../presentation/model.mjs';
import { compilePresentation } from '../../scripts/compile-presentation.mjs';
import { hashPresentationBytes } from '../presentation/bundle.mjs';
import { CURRENT_PICTURES } from '../presentation/current-pictures.mjs';

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
  const snapshot = await e.host.load();
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
  await assert.rejects(e.host.load(), /Truncated/);
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
  const first = e.host.load();
  while (!release) await tick();
  const rejected = assert.rejects(first, { name: 'AbortError' });
  const second = await e.host.load();
  release(stale);
  await rejected;
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

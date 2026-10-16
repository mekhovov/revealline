import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mountArtworkCollectionPanel } from '../../authoring/asset-studio/artwork-panel.mjs';
import {
  createArtworkCollection,
  importArtworkCollection,
} from '../../authoring/asset-studio/artwork-collection.mjs';
import { hashPresentationBytes } from '../presentation/bundle.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';
import { pngBytes, deferred } from './helpers/media-fixtures.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

// JPEG is a static header fixture. All native decodes are modeled at this host
// boundary: these checks prove byte/MIME/ownership behavior, not codec acceptance.
const samples = [
  ['source', 'source.PNG', 'image/png', pngBytes()],
  [
    'photo',
    'retained-photo.jpeg',
    'image/jpeg',
    Buffer.from([255, 216, 255, 192, 0, 11, 8, 0, 1, 0, 1, 1, 1, 17, 0, 255, 217]),
  ],
  [
    'web',
    'retained-picture.webp',
    'image/webp',
    Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64'),
  ],
  [
    'candidate',
    'separate-candidate.png',
    'image/png',
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    ),
  ],
];

async function fixture() {
  const artworks = await Promise.all(
    samples.map(async ([id, name, mime, bytes]) => ({
      id,
      role: 'reveal',
      medium: 'pixel-art',
      file: {
        name,
        mime,
        bytes: bytes.length,
        sha256: await hashPresentationBytes(bytes),
        width: 1,
        height: 1,
      },
      provenance: {
        origin: id === 'candidate' ? 'derivative' : 'original',
        creator: 'Handoff fixture author',
        license: {
          status: 'original',
          name: 'Test fixture only',
          url: null,
          evidence: 'No production claim.',
        },
        sourceIds: [],
        derivative:
          id === 'candidate'
            ? { parent: 'source', changes: 'Separate test pixels; no preparation claim.' }
            : null,
        prompt: '',
      },
    })),
  );
  return createArtworkCollection({
    id: 'handoff-cohort',
    revision: 7,
    name: 'Handoff fixtures',
    artworks,
  });
}

async function host(t) {
  const source = await fixture(),
    document = new Document(),
    window = new Events(),
    live = new Map();
  const html = await readFile(
    new URL('../../authoring/asset-studio/index.html', import.meta.url),
    'utf8',
  );
  for (const [, tag, id] of html.matchAll(/<(\w+)\b[^>]*\bid="(artwork-[^"]+)"/g)) {
    const node = document.createElement(tag);
    node.id = id;
    document.body.append(node);
  }
  const $ = (id) => document.getElementById(id),
    originalImage = globalThis.Image,
    locale = getLocale();
  let nextDecode = null,
    serial = 0,
    decodes = 0;
  globalThis.Image = class {
    naturalWidth = 1;
    naturalHeight = 1;
    gate = nextDecode;
    constructor() {
      nextDecode = null;
    }
    set src(value) {
      if (value) queueMicrotask(() => this.onload?.());
    }
    decode() {
      decodes++;
      this.gate?.started.resolve();
      return this.gate?.promise;
    }
    removeAttribute() {}
  };
  t.mock.method(URL, 'createObjectURL', (blob) => {
    const url = `blob:handoff-${++serial}`;
    live.set(url, blob);
    return url;
  });
  t.mock.method(URL, 'revokeObjectURL', (url) => live.delete(url));
  setLocale('en', { persist: false });
  const panel = mountArtworkCollectionPanel({ document, window });
  t.after(() => {
    try {
      panel.dispose();
      assert.equal(live.size, 0, 'All image and download URLs are released.');
    } finally {
      globalThis.Image = originalImage;
      setLocale(locale, { persist: false });
    }
  });
  const load = async (metadata = source) => {
    $('artwork-files').files = [
      new File([JSON.stringify(metadata)], 'collection.json'),
      ...samples.map(
        ([, name, , bytes], index) => new File([bytes], metadata.artworks[index].file.name ?? name),
      ),
    ];
    await $('artwork-files').onchange();
  };
  const select = (id) => {
    $('artwork-item').value = id;
    $('artwork-item').onchange();
  };
  const hold = () => {
    const gate = { ...deferred(), started: deferred() };
    nextDecode = gate;
    return gate;
  };
  return {
    $,
    source,
    load,
    select,
    hold,
    live,
    panel,
    document,
    window,
    html,
    decodes: () => decodes,
  };
}

test('actual panel offers exact PNG/JPEG/WebP originals and selected derivative, separately from unchanged .rlart', async (t) => {
  const f = await host(t),
    { $ } = f;
  assert.equal($('artwork-download-file').disabled, true);
  await $('artwork-download-file').onclick();
  assert.equal(f.live.size, 0);
  await f.load();
  await $('artwork-export').onclick();
  const packetLink = $('artwork-download').querySelector('a'),
    packet = f.live.get(packetLink.href);
  const before = await packet.arrayBuffer();
  for (const [id, name, mime, expected] of samples) {
    f.select(id);
    assert.equal(
      $('artwork-file-download').children.length,
      0,
      'Selection retires the prior exact-file offer.',
    );
    const preview = $('artwork-preview').children[0];
    await $('artwork-download-file').onclick();
    const link = $('artwork-file-download').querySelector('a'),
      blob = f.live.get(link.href);
    assert.equal(link.download, name);
    assert.equal(blob.type, mime);
    assert.equal(blob.size, expected.length);
    assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), new Uint8Array(expected));
    assert.equal(
      await hashPresentationBytes(new Uint8Array(await blob.arrayBuffer())),
      f.source.artworks.find((entry) => entry.id === id).file.sha256,
    );
    assert.equal($('artwork-preview').children[0], preview);
    assert.equal($('artwork-item').value, id);
    assert.equal(
      $('artwork-download').querySelector('a'),
      packetLink,
      'Full-provenance export remains available.',
    );
    assert.equal(
      $('artwork-status').textContent,
      `Exact file ${name} prepared from ${id}, collection revision 7. Keep the .rlart packet for full provenance.`,
    );
  }
  setLocale('uk', { persist: false });
  assert.equal(
    $('artwork-status').textContent,
    'Точний файл separate-candidate.png підготовлено із candidate, редакція колекції 7. Збережіть пакет .rlart із повними даними про походження.',
  );
  await $('artwork-export').onclick();
  const after = f.live.get($('artwork-download').querySelector('a').href);
  assert.deepEqual(await after.arrayBuffer(), before);
  const restored = await importArtworkCollection(after, {
    decodeImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }),
  });
  assert.deepEqual(restored.document, f.source);
  assert.match(
    f.html,
    /id="artwork-download-file"[^>]*disabled[^>]*aria-describedby="artwork-download-file-help"/s,
  );
});

test('handoff stays disabled during import and cannot compete with pending verification', async (t) => {
  const f = await host(t),
    { $ } = f,
    gate = f.hold();
  const importing = f.load();
  await gate.started.promise;
  const count = f.decodes();
  assert.equal($('artwork-download-file').disabled, true);
  await $('artwork-download-file').onclick();
  assert.equal(f.decodes(), count);
  assert.equal($('artwork-file-download').children.length, 0);
  gate.resolve();
  await importing;
  assert.equal($('artwork-download-file').disabled, false);
});

test('cancel, selection, import, revision and lifecycle changes cannot offer a stale selected file', async (t) => {
  for (const action of [
    'cancel',
    'selection',
    'selection-without-event',
    'import',
    'revision',
    'hide',
    'dispose',
  ]) {
    await t.test(action, async (t) => {
      const f = await host(t),
        { $ } = f;
      await f.load();
      f.select('candidate');
      const gate = f.hold(),
        pending = $('artwork-download-file').onclick();
      await gate.started.promise;
      for (const id of [
        'artwork-download-file',
        'artwork-item',
        'artwork-treatment',
        'artwork-export',
        'artwork-prepare',
      ])
        assert.equal($(id).disabled, true, id);
      const count = f.decodes();
      await $('artwork-download-file').onclick();
      assert.equal(
        f.decodes(),
        count,
        'A disabled direct handler cannot start another verification.',
      );
      if (action === 'cancel') $('artwork-cancel').onclick();
      else if (action === 'selection') f.select('photo');
      else if (action === 'selection-without-event') $('artwork-item').value = 'web';
      else if (action === 'import') await f.load({ ...f.source, id: 'replacement', revision: 8 });
      else if (action === 'revision') {
        $('artwork-treatment').value = 'photographic-reveals';
        $('artwork-treatment').onchange();
      } else if (action === 'hide') f.window.emit('pagehide', { persisted: true });
      else f.panel.dispose();
      gate.resolve();
      await pending;
      assert.equal($('artwork-file-download').children.length, 0);
      assert.doesNotMatch($('artwork-status').textContent, /Exact file .* prepared/);
      if (action === 'hide') {
        f.window.emit('pageshow', { persisted: true });
        assert.equal(f.live.size, 0, 'Return does not restart or offer a download.');
      }
      if (action === 'dispose') assert.equal($('artwork-download-file').onclick, null);
      if (action === 'revision') assert.match($('artwork-provenance').textContent, /revision 8/);
      if (action === 'import') assert.equal($('artwork-item').value, 'source');
    });
  }
});

test('decode failure and unsafe or mismatched names cannot masquerade as a new accepted file', async (t) => {
  const f = await host(t),
    { $ } = f;
  await f.load();
  await $('artwork-export').onclick();
  const packet = $('artwork-download').querySelector('a'),
    preview = $('artwork-preview').children[0];
  const gate = f.hold(),
    pending = $('artwork-download-file').onclick();
  await gate.started.promise;
  gate.reject(new Error('Injected native decode failure.'));
  await pending;
  assert.match(
    $('artwork-status').textContent,
    /Selected file was not prepared: Injected native decode failure/,
  );
  assert.equal($('artwork-preview').children[0], preview);
  assert.equal($('artwork-download').querySelector('a'), packet);
  assert.equal($('artwork-file-download').children.length, 0);
  for (const name of ['misleading.html', 'wrong.jpeg', 'extensionless']) {
    const document = structuredClone(f.source);
    document.artworks[0].file.name = name;
    await f.load(document);
    await $('artwork-download-file').onclick();
    assert.match($('artwork-status').textContent, /declared filename must use its image format/);
    assert.equal($('artwork-file-download').children.length, 0);
    await $('artwork-export').onclick();
    assert.ok(
      $('artwork-download').querySelector('a'),
      'Historical packet acceptance is unchanged.',
    );
  }
  const current = $('artwork-preview').children[0];
  const unsafe = structuredClone(f.source);
  unsafe.artworks[0].file.name = '../source.png';
  await f.load(unsafe);
  assert.match($('artwork-status').textContent, /unique local basenames/);
  assert.equal($('artwork-preview').children[0], current);
  await $('artwork-download-file').onclick();
  assert.equal(
    $('artwork-file-download').children.length,
    0,
    'Rejected import did not replace the accepted extensionless draft.',
  );
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  artworkComparisonPair,
  createArtworkParentPreview,
} from '../../authoring/asset-studio/artwork-comparison.mjs';
import { mountArtworkCollectionPanel } from '../../authoring/asset-studio/artwork-panel.mjs';
import {
  createArtworkCollection,
  importArtworkCollection,
} from '../../authoring/asset-studio/artwork-collection.mjs';
import { hashPresentationBytes } from '../presentation/bundle.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';
import { deferred, pngBytes } from './helpers/media-fixtures.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

async function fixture() {
  const bytes = pngBytes();
  const source = {
    id: 'retained-source',
    role: 'reveal',
    medium: 'pixel-art',
    file: {
      name: 'original.png',
      sha256: await hashPresentationBytes(bytes),
      bytes: bytes.length,
      mime: 'image/png',
      width: 1,
      height: 1,
    },
    provenance: {
      origin: 'original',
      creator: 'Test author',
      license: { status: 'original', name: 'Test original', url: null, evidence: 'Fixture only.' },
      sourceIds: [],
      derivative: null,
      prompt: '',
    },
  };
  const unrelated = structuredClone(source);
  unrelated.id = 'candidate-original';
  unrelated.file.name = 'candidate-original.png';
  const candidate = structuredClone(source);
  candidate.id = 'candidate';
  candidate.file.name = 'candidate.png';
  candidate.provenance.origin = 'derivative';
  candidate.provenance.derivative = { parent: source.id, changes: 'Test explicit relation.' };
  const document = createArtworkCollection({
    id: 'test-comparison',
    revision: 7,
    name: 'Comparison fixture',
    artworks: [source, unrelated, candidate],
  });
  return {
    document,
    assets: new Map(document.artworks.map(({ file }) => [file.name, new Blob([bytes])])),
  };
}

function displayHost() {
  const document = new Document(),
    images = [],
    live = new Map(),
    timers = new Map(),
    states = [];
  const create = document.createElement.bind(document);
  document.createElement = (tag) => {
    const element = create(tag);
    if (tag === 'img') {
      element.naturalWidth = element.naturalHeight = 1;
      images.push(element);
    }
    return element;
  };
  let serial = 0;
  const urls = {
    createObjectURL(blob) {
      const url = `blob:comparison-${++serial}`;
      live.set(url, blob);
      return url;
    },
    revokeObjectURL(url) {
      assert.ok(live.delete(url), 'URL is released exactly once');
    },
  };
  const preview = create('div');
  const controller = createArtworkParentPreview({
    document,
    preview,
    urls,
    onState: (...values) => states.push(values),
    schedule: (fn) => {
      const id = ++serial;
      timers.set(id, fn);
      return id;
    },
    cancel: (id) => timers.delete(id),
  });
  return { document, images, live, timers, states, preview, controller, urls };
}

// Exact donor metadata only; image payloads and their rights/visual approval are not
// adopted by this test fixture. See fixtures/artwork-collection-revision7.md.
test('pinned revision7 metadata resolves immediate retained parents by identity, including revised Poltava', async () => {
  const collection = JSON.parse(
    await readFile(
      new URL('./fixtures/artwork-collection-revision7.json', import.meta.url),
      'utf8',
    ),
  );
  const expected = {
    'workshop-original-wide-r2': 'workshop-original',
    'workshop-original-classic-r5': 'workshop-original',
    'synevyr-original-wide-r4': 'synevyr-original',
    'poltava-original-wide-r3': 'poltava-original',
    'poltava-revised-r6': 'poltava-original',
    'poltava-revised-r6-wide-r7': 'poltava-revised-r6',
  };
  for (const [id, parent] of Object.entries(expected)) {
    const pair = artworkComparisonPair(collection, id);
    assert.equal(pair.collection.revision, 7);
    assert.equal(pair.selected.id, id);
    assert.equal(pair.parent.id, parent);
    assert.deepEqual(
      pair.parent,
      collection.artworks.find((artwork) => artwork.id === parent),
    );
  }
  assert.equal(artworkComparisonPair(collection, 'synevyr-original').parent, null);
  assert.throws(() => artworkComparisonPair(collection, 'unknown'), /Select retained artwork/);
  collection.artworks.at(-1).provenance.derivative.parent = 'missing';
  assert.throws(
    () => artworkComparisonPair(collection, 'poltava-revised-r6-wide-r7'),
    /parent must be retained/,
  );
});

test('only an explicit relationship permits mixed-medium comparison; filenames infer no parent', async () => {
  const current = await fixture();
  assert.equal(artworkComparisonPair(current.document, 'candidate').parent.id, 'retained-source');
  assert.equal(artworkComparisonPair(current.document, 'candidate-original').parent, null);
  const photographic = structuredClone(current.document);
  photographic.treatment = 'photographic-reveals';
  photographic.artworks[0].medium = 'photograph';
  const pair = artworkComparisonPair(photographic, 'candidate');
  assert.equal(pair.parent.medium, 'photograph');
  assert.equal(pair.selected.medium, 'pixel-art');
});

test('one optional parent decode retains exact bytes and releases its URL on replacement and disposal', async () => {
  const current = await fixture(),
    host = displayHost();
  const before = JSON.stringify(current.document);
  const pending = host.controller.show(current, 'candidate');
  assert.equal(host.images.length, 1);
  const image = host.images[0];
  assert.deepEqual(
    await host.live.get(image.src).arrayBuffer(),
    await current.assets.get('original.png').arrayBuffer(),
  );
  assert.equal(host.preview.children.length, 0);
  await image.onload();
  assert.equal(await pending, true);
  assert.equal(host.preview.children[0], image);
  assert.equal(host.states.at(-1)[1].parent.id, 'retained-source');
  assert.equal(host.timers.size, 0);
  assert.equal(JSON.stringify(current.document), before);
  assert.equal(await host.controller.show(current, 'retained-source'), false);
  assert.equal(host.live.size, 0);
  assert.equal(host.preview.children.length, 0);
  assert.equal(host.states.at(-1)[0], 'noParent');
  host.controller.dispose();
  assert.equal(await host.controller.show(current, 'candidate'), false);
  assert.equal(host.images.length, 1);
});

test('cancel, replacement and departure reject late decode completion without displaying stale parents', async () => {
  const current = await fixture();
  for (const action of ['cancel', 'clear', 'replace', 'dispose']) {
    const host = displayHost(),
      gate = deferred();
    const pending = host.controller.show(current, 'candidate');
    const image = host.images[0];
    image.decode = () => gate.promise;
    const decoding = image.onload();
    if (action === 'replace') await host.controller.show(current, 'candidate-original');
    else host.controller[action]();
    assert.equal(await pending, false);
    gate.resolve();
    await decoding;
    assert.equal(host.preview.children.length, 0, action);
    assert.equal(host.live.size, 0, action);
    assert.equal(host.timers.size, 0, action);
    assert.ok(!host.states.some(([state]) => state === 'ready'), action);
    host.controller.dispose();
  }
});

test('decode error, dimension mismatch and bounded timeout leave no parent resources', async () => {
  const current = await fixture();
  for (const failure of ['decode', 'dimensions', 'timeout']) {
    const host = displayHost();
    const pending = host.controller.show(current, 'candidate');
    const image = host.images[0];
    if (failure === 'timeout') [...host.timers.values()][0]();
    else {
      if (failure === 'decode')
        image.decode = async () => {
          throw Error('Cannot decode');
        };
      else image.naturalWidth = 2;
      await image.onload();
    }
    assert.equal(await pending, false);
    assert.equal(host.live.size, 0);
    assert.equal(host.timers.size, 0);
    assert.equal(host.states.at(-1)[0], 'failed');
    host.controller.dispose();
  }
});

async function panelHost() {
  const current = await fixture(),
    host = displayHost(),
    window = new Events();
  host.controller.dispose();
  const html = await readFile(
    new URL('../../authoring/asset-studio/index.html', import.meta.url),
    'utf8',
  );
  for (const [, tag, id] of html.matchAll(/<(\w+)\b[^>]*\bid="(artwork-[^"]+)"/g)) {
    const element = host.document.createElement(tag);
    element.id = id;
    host.document.body.append(element);
  }
  const $ = (id) => host.document.getElementById(id);
  const panel = mountArtworkCollectionPanel({ document: host.document, window, urls: host.urls });
  async function load(source = current.document) {
    $('artwork-files').files = [
      new File([JSON.stringify(source)], 'collection.json'),
      ...[...current.assets].map(([name, blob]) => new File([blob], name)),
    ];
    await $('artwork-files').onchange();
  }
  return { ...host, current, window, $, panel, load, html };
}

test('mounted comparison shows exact localized identities, uses native scroll markup and exports unchanged packet bytes', async () => {
  const originalImage = globalThis.Image,
    originalFetch = globalThis.fetch,
    locale = getLocale();
  globalThis.Image = class {
    naturalWidth = 1;
    naturalHeight = 1;
    set src(value) {
      if (value) queueMicrotask(() => this.onload?.());
    }
    removeAttribute() {}
  };
  globalThis.fetch = () => {
    throw Error('Comparison must not fetch remote references');
  };
  let host;
  try {
    setLocale('en', { persist: false });
    host = await panelHost();
    const { $, current } = host;
    await host.load();
    assert.equal($('artwork-compare').disabled, true);
    assert.match($('artwork-comparison-status').textContent, /no declared retained parent/);
    $('artwork-item').value = 'candidate';
    $('artwork-item').onchange();
    const selectedImage = $('artwork-preview').children[0];
    const pending = $('artwork-compare').onclick();
    await host.images.at(-1).onload();
    await pending;
    assert.equal($('artwork-selected-caption').textContent, 'Selected · candidate · 1 × 1');
    assert.equal(
      $('artwork-parent-caption').textContent,
      'Retained parent · retained-source · 1 × 1',
    );
    assert.match(
      $('artwork-parent-facts').textContent,
      new RegExp(current.document.artworks[0].file.sha256),
    );
    assert.match($('artwork-parent-facts').textContent, /test-comparison · revision 7 · pixel-art/);
    assert.match($('artwork-parent-rights').textContent, /Test author/);
    setLocale('uk', { persist: false });
    assert.equal(
      $('artwork-parent-caption').textContent,
      'Збережене джерело · retained-source · 1 × 1',
    );
    assert.match(
      $('artwork-parent-facts').textContent,
      new RegExp(current.document.artworks[0].file.sha256),
    );
    setLocale('en', { persist: false });
    const resources = host.live.size;
    $('artwork-view').focus();
    $('artwork-view').value = 'native';
    $('artwork-view').onchange();
    assert.equal($('artwork-review').getAttribute('data-view'), 'native');
    assert.equal($('artwork-preview').tabIndex, 0);
    assert.equal($('artwork-parent-preview').tabIndex, 0);
    assert.equal(host.document.activeElement, $('artwork-view'));
    assert.equal($('artwork-preview').children[0], selectedImage);
    assert.equal(host.live.size, resources, 'view mode does not decode or allocate images');
    await $('artwork-export').onclick();
    const packet = host.live.get($('artwork-download').querySelector('a').href);
    const exported = await importArtworkCollection(packet, {
      decodeImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }),
    });
    assert.deepEqual(exported.document, current.document);
    for (const [name, blob] of current.assets)
      assert.deepEqual(await exported.assets.get(name).arrayBuffer(), await blob.arrayBuffer());
    host.window.emit('pagehide', { persisted: true });
    assert.equal(host.live.size, 0);
    host.window.emit('pageshow', { persisted: true });
    assert.equal(host.live.size, 0, 'return does not start comparison or source decode');
    assert.equal($('artwork-compare').getAttribute('aria-pressed'), 'false');
    host.panel.dispose();
    assert.equal($('artwork-view').onchange, null);
    assert.equal($('artwork-compare').onclick, null);
    const css = await readFile(
      new URL('../../authoring/asset-studio/studio.css', import.meta.url),
      'utf8',
    );
    assert.match(
      css,
      /\.artwork-source-preview\s*\{[^}]*height: min\(50dvh, 420px\)[^}]*overflow: auto/s,
    );
    assert.match(
      css,
      /data-view='native'[^}]*width: auto;[^}]*height: auto;[^}]*max-width: none;/s,
    );
    assert.match(
      host.html,
      /id="artwork-compare"[^>]*aria-pressed="false"[^>]*aria-controls="artwork-parent"/s,
    );
  } finally {
    host?.panel.dispose();
    globalThis.Image = originalImage;
    globalThis.fetch = originalFetch;
    setLocale(locale, { persist: false });
  }
});

test('mounted selection and cancelled import cannot reveal a parent from a previous pending decode', async () => {
  const originalImage = globalThis.Image;
  globalThis.Image = class {
    naturalWidth = 1;
    naturalHeight = 1;
    set src(value) {
      if (value) queueMicrotask(() => this.onload?.());
    }
    removeAttribute() {}
  };
  let host;
  try {
    host = await panelHost();
    const { $ } = host;
    await host.load();
    for (const action of ['selection', 'cancelled-import', 'replacement', 'departure']) {
      $('artwork-item').value = 'candidate';
      $('artwork-item').onchange();
      const pending = $('artwork-compare').onclick();
      const old = host.images.at(-1),
        gate = deferred();
      old.decode = () => gate.promise;
      const decoding = old.onload();
      if (action === 'selection') {
        $('artwork-item').value = 'candidate-original';
        $('artwork-item').onchange();
      } else if (action === 'cancelled-import') {
        const metadataGate = deferred();
        const metadata = new File([JSON.stringify(host.current.document)], 'collection.json');
        metadata.text = () => metadataGate.promise;
        $('artwork-files').files = [
          metadata,
          ...[...host.current.assets].map(([name, blob]) => new File([blob], name)),
        ];
        const importing = $('artwork-files').onchange();
        $('artwork-cancel').onclick();
        metadataGate.resolve(JSON.stringify(host.current.document));
        await importing;
      } else if (action === 'replacement') {
        const replacement = structuredClone(host.current.document);
        replacement.revision = 8;
        replacement.artworks.at(-1).provenance.derivative.parent = 'candidate-original';
        await host.load(replacement);
      } else host.window.emit('pagehide', { persisted: false });
      gate.resolve();
      await decoding;
      assert.equal(await pending, false, action);
      assert.equal($('artwork-parent-preview').children.length, 0, action);
      assert.equal($('artwork-parent').hidden, true, action);
      assert.equal(host.live.size, action === 'departure' ? 0 : 1, action);
    }
  } finally {
    host?.panel.dispose();
    globalThis.Image = originalImage;
  }
});

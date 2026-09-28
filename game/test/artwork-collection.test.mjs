import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createArtworkCollection,
  validateArtworkCollection,
  verifyArtworkCollection,
  exportArtworkCollection,
  importArtworkCollection,
  decodeArtworkImage,
} from '../../authoring/asset-studio/artwork-collection.mjs';
import {
  createArtworkCollectionDraft,
  mountArtworkCollectionPanel,
} from '../../authoring/asset-studio/artwork-panel.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { validateThemeBundle, validateAssetCollection } from '../presentation/model.mjs';
import { importThemeBundle, hashPresentationBytes } from '../presentation/bundle.mjs';
import { pngBytes, deferred } from './helpers/media-fixtures.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

const rights = () => ({
  status: 'original',
  name: 'Original test fixture',
  url: null,
  evidence: 'Injected fixture only; no production-art claim.',
});
const dimensions = async () => ({ naturalWidth: 1, naturalHeight: 1 });
async function fixture() {
  const bytes = pngBytes();
  const document = createArtworkCollection({
    id: 'test-artwork',
    revision: 1,
    name: 'Test source collection',
    sources: [
      {
        id: 'reference',
        use: 'reference-only',
        creator: 'Reference creator',
        source: 'https://example.org/reference',
        license: {
          status: 'unverified',
          name: 'No reuse permission established',
          url: null,
          evidence: 'Visual reference only; no source pixels copied.',
        },
      },
    ],
    artworks: [
      {
        id: 'source',
        role: 'reveal',
        medium: 'pixel-art',
        file: {
          name: 'source.png',
          sha256: await hashPresentationBytes(bytes),
          bytes: bytes.length,
          mime: 'image/png',
          width: 1,
          height: 1,
        },
        provenance: {
          origin: 'generated',
          creator: 'Test generator',
          license: rights(),
          sourceIds: ['reference'],
          derivative: null,
          prompt: 'Original test fixture.',
        },
      },
    ],
  });
  return { document, files: new Map([['source.png', new Blob([bytes])]]), bytes };
}
const changed = (source, change) => {
  const next = structuredClone(source);
  change(next);
  return next;
};

test('versioned collection policy defaults to pixel art; photographic reveals are explicit and limited to reveals', async () => {
  const { document } = await fixture();
  assert.equal(document.treatment, 'pixel-art');
  assert.ok(Object.isFrozen(document.artworks[0].provenance));
  const photo = changed(document, (next) => {
    next.artworks[0].medium = 'photograph';
  });
  assert.throws(() => validateArtworkCollection(photo), /explicit photographic-reveals/);
  photo.treatment = 'photographic-reveals';
  assert.equal(validateArtworkCollection(photo).artworks[0].medium, 'photograph');
  photo.artworks[0].role = 'actor';
  assert.throws(() => validateArtworkCollection(photo), /reveal role/);
  assert.throws(
    () =>
      validateArtworkCollection(
        changed(document, (next) => {
          delete next.treatment;
        }),
      ),
    /missing fields/,
  );
  assert.throws(
    () => validateArtworkCollection({ ...document, format: 'revealline-artwork-collection.v2' }),
    /Unsupported/,
  );
});

test('reference-only is not reuse authority; incorporated material and derivatives require explicit provenance', async () => {
  const { document } = await fixture();
  const incorporated = changed(document, (next) => {
    next.sources[0].use = 'incorporated';
  });
  assert.throws(() => validateArtworkCollection(incorporated), /reuse basis/);
  incorporated.sources[0].license = {
    status: 'public-domain',
    name: 'CC0',
    url: 'https://creativecommons.org/publicdomain/zero/1.0/',
    evidence: 'Declared source attribution page; requires independent rights review.',
  };
  assert.equal(validateArtworkCollection(incorporated).sources[0].use, 'incorporated');
  const derivative = changed(document, (next) => {
    const asset = structuredClone(next.artworks[0]);
    asset.id = 'derived';
    asset.file.name = 'derived.png';
    asset.provenance.origin = 'derivative';
    asset.provenance.derivative = {
      parent: 'source',
      changes: 'Separate test derivative; source bytes retained.',
    };
    next.artworks.push(asset);
  });
  assert.equal(validateArtworkCollection(derivative).artworks.length, 2);
  derivative.artworks.shift();
  assert.throws(() => validateArtworkCollection(derivative), /parent must be retained/);
  derivative.artworks[0].provenance.derivative.parent = 'derived';
  assert.throws(() => validateArtworkCollection(derivative), /cycle/);
});

test('strict packet boundary rejects extra authority, remote payloads, invalid URLs and quotas without evaluating getters', async () => {
  const { document } = await fixture();
  for (const change of [
    (next) => {
      next.approved = true;
    },
    (next) => {
      next.artworks[0].file.name = '../source.png';
    },
    (next) => {
      next.sources[0].source = 'javascript:alert(1)';
    },
    (next) => {
      next.sources[0].source = 'https://user:password@example.org';
    },
    (next) => {
      next.artworks[0].file.bytes = 4 * 1024 * 1024 + 1;
    },
    (next) => {
      next.artworks[0].file.width = 8193;
    },
    (next) => {
      next.artworks[0].provenance.sourceIds = ['missing'];
    },
    (next) => {
      next.artworks[0].provenance.prompt = '';
    },
  ])
    assert.throws(() => validateArtworkCollection(changed(document, change)));
  let invoked = false;
  assert.throws(() =>
    validateArtworkCollection({
      ...document,
      get name() {
        invoked = true;
        return 'Bad';
      },
    }),
  );
  assert.equal(invoked, false);
});

test('all byte hashes and static headers pass before any decode; metadata and original files are owned before awaiting', async () => {
  const { document, files, bytes } = await fixture();
  let calls = 0;
  const options = {
    decodeImage: async () => {
      calls++;
      return dimensions();
    },
  };
  const badHash = changed(document, (next) => {
    next.artworks[0].file.sha256 = '0'.repeat(64);
  });
  await assert.rejects(verifyArtworkCollection(badHash, files, options), /SHA-256/);
  assert.equal(calls, 0);
  const badSize = changed(document, (next) => {
    next.artworks[0].file.bytes++;
  });
  await assert.rejects(verifyArtworkCollection(badSize, files, options), /byte count/);
  const badDimensions = changed(document, (next) => {
    next.artworks[0].file.width = 2;
  });
  await assert.rejects(verifyArtworkCollection(badDimensions, files, options), /header differs/);
  assert.equal(calls, 0);
  const gate = deferred(),
    mutable = structuredClone(document),
    sourceFiles = new Map(files);
  const pending = verifyArtworkCollection(mutable, sourceFiles, {
    decodeImage: async () => {
      await gate.promise;
      return dimensions();
    },
  });
  mutable.artworks[0].file.sha256 = 'f'.repeat(64);
  sourceFiles.clear();
  gate.resolve();
  const result = await pending;
  assert.equal(result.document.artworks[0].file.sha256, document.artworks[0].file.sha256);
  assert.deepEqual(
    new Uint8Array(await result.assets.get('source.png').arrayBuffer()),
    new Uint8Array(bytes),
  );
  await assert.rejects(
    verifyArtworkCollection(document, files, {
      decodeImage: async () => ({ naturalWidth: 2, naturalHeight: 1 }),
    }),
    /Decoded image dimensions/,
  );
});

test('portable .rlart round-trip preserves originals/provenance, rejects malformed framing and never enters historical readers', async () => {
  const { document, files, bytes } = await fixture();
  const packet = await exportArtworkCollection(document, files, { decodeImage: dimensions });
  const result = await importArtworkCollection(packet, { decodeImage: dimensions });
  assert.deepEqual(result.document, document);
  assert.deepEqual(
    new Uint8Array(await result.assets.get('source.png').arrayBuffer()),
    new Uint8Array(bytes),
  );
  assert.deepEqual(
    await (
      await exportArtworkCollection(result.document, result.assets, { decodeImage: dimensions })
    ).arrayBuffer(),
    await packet.arrayBuffer(),
  );
  await assert.rejects(
    importArtworkCollection(new Blob([packet, new Uint8Array([1])]), { decodeImage: dimensions }),
    /trailing/,
  );
  await assert.rejects(
    importArtworkCollection(packet.slice(0, -1), { decodeImage: dimensions }),
    /Truncated/,
  );
  await assert.rejects(importThemeBundle(packet, { decodeImage: dimensions }), /Unsupported/);
  assert.throws(() => validateAssetCollection(document));
  const legacy = createDefaultThemeBundle();
  assert.throws(() => validateThemeBundle({ ...legacy, artworkTreatment: 'pixel-art' }));
  assert.equal(validateThemeBundle(legacy).format, 'revealline-theme-bundle.v1');
});

test('cancellation prevents late decode adoption; stale/failed imports preserve the accepted draft and disposal closes it', async () => {
  const { document, files } = await fixture();
  const controller = new AbortController(),
    gate = deferred();
  const pending = verifyArtworkCollection(document, files, {
    signal: controller.signal,
    decodeImage: async () => {
      controller.abort();
      await gate.promise;
      return dimensions();
    },
  });
  gate.resolve();
  await assert.rejects(pending, { name: 'AbortError' });
  const draft = createArtworkCollectionDraft();
  const accepted = await draft.load(() =>
    verifyArtworkCollection(document, files, { decodeImage: dimensions }),
  );
  const slow = deferred(),
    stale = draft.load(() => slow.promise);
  assert.equal(await draft.load(async () => accepted), accepted);
  slow.resolve({ document: { id: 'stale' } });
  assert.equal(await stale, null);
  await assert.rejects(
    draft.load(async () => {
      throw new Error('Bad original');
    }),
    /Bad original/,
  );
  assert.equal(draft.current, accepted);
  const photo = draft.setTreatment('photographic-reveals');
  assert.equal(photo.document.treatment, 'photographic-reveals');
  assert.equal(photo.document.revision, accepted.document.revision + 1);
  assert.equal(draft.setTreatment('photographic-reveals'), photo);
  assert.equal(photo.assets, accepted.assets);
  const late = deferred(),
    departing = draft.load(() => late.promise);
  draft.dispose();
  late.resolve(accepted);
  assert.equal(await departing, null);
  assert.equal(draft.current, null);
  await assert.rejects(
    draft.load(async () => accepted),
    /closed/,
  );
});

test('native decode adapter releases temporary URLs on success, failure and cancellation', async () => {
  const originalImage = globalThis.Image,
    create = URL.createObjectURL,
    revoke = URL.revokeObjectURL;
  const images = [],
    revoked = [];
  class FakeImage {
    constructor() {
      this.naturalWidth = this.naturalHeight = 1;
      images.push(this);
    }
    removeAttribute() {
      this.src = '';
    }
  }
  try {
    globalThis.Image = FakeImage;
    URL.createObjectURL = () => `blob:test-${images.length}`;
    URL.revokeObjectURL = (url) => revoked.push(url);
    const good = decodeArtworkImage(new Blob(['fixture']));
    await images.at(-1).onload();
    assert.deepEqual(await good, { naturalWidth: 1, naturalHeight: 1 });
    const failed = decodeArtworkImage(new Blob(['fixture']));
    images.at(-1).onerror();
    await assert.rejects(failed, /could not decode/);
    const controller = new AbortController(),
      cancelled = decodeArtworkImage(new Blob(['fixture']), { signal: controller.signal });
    controller.abort();
    await assert.rejects(cancelled, { name: 'AbortError' });
    assert.equal(revoked.length, 3);
    assert.equal(new Set(revoked).size, 3);
    assert.ok(
      images.every((image) => image.src === '' && image.onload === null && image.onerror === null),
    );
  } finally {
    globalThis.Image = originalImage;
    URL.createObjectURL = create;
    URL.revokeObjectURL = revoke;
  }
});

test('Asset Studio exposes the real packet panel and disposes its handlers on departure', async () => {
  const html = await readFile(
    new URL('../../authoring/asset-studio/index.html', import.meta.url),
    'utf8',
  );
  const nodes = new Map();
  for (const [, id] of html.matchAll(/id="(artwork-[^"]+)"/g))
    nodes.set(id, {
      disabled: false,
      children: [],
      value: '',
      textContent: '',
      setAttribute() {},
      replaceChildren(...children) {
        this.children = children;
      },
    });
  const listeners = new Map();
  const window = {
    addEventListener: (key, fn) => listeners.set(key, fn),
    removeEventListener: (key) => listeners.delete(key),
  };
  const panel = mountArtworkCollectionPanel({
    document: { getElementById: (id) => nodes.get(id) },
    window,
  });
  assert.equal(typeof nodes.get('artwork-files').onchange, 'function');
  assert.equal(typeof nodes.get('artwork-export').onclick, 'function');
  assert.equal(nodes.get('artwork-treatment').disabled, true);
  listeners.get('pagehide')({ persisted: true });
  listeners.get('pageshow')({ persisted: true });
  assert.match(nodes.get('artwork-status').textContent, /Select an artwork/);
  listeners.get('pagehide')({ persisted: false });
  assert.equal(nodes.get('artwork-files').onchange, null);
  assert.equal(nodes.get('artwork-export').onclick, null);
  assert.equal(listeners.size, 0);
  panel.dispose();
});

test('actual panel imports JSON with originals, previews declarations, exports unchanged payloads and retains the prior view on failure', async () => {
  const { document: source, bytes } = await fixture();
  const html = await readFile(
    new URL('../../authoring/asset-studio/index.html', import.meta.url),
    'utf8',
  );
  const document = new Document(),
    window = new Events();
  for (const [, tag, id] of html.matchAll(/<(\w+)\b[^>]*\bid="(artwork-[^"]+)"/g)) {
    const element = document.createElement(tag);
    element.id = id;
    document.body.append(element);
  }
  const $ = (id) => document.getElementById(id);
  const originalImage = globalThis.Image,
    create = URL.createObjectURL,
    revoke = URL.revokeObjectURL,
    fetch = globalThis.fetch;
  const live = new Map();
  const originalLocale = getLocale();
  let serial = 0;
  class FakeImage {
    naturalWidth = 1;
    naturalHeight = 1;
    set src(value) {
      if (value) queueMicrotask(() => this.onload?.());
    }
    removeAttribute() {}
  }
  let panel;
  try {
    globalThis.Image = FakeImage;
    globalThis.fetch = () => {
      throw new Error('Reference URLs must not be fetched.');
    };
    URL.createObjectURL = (blob) => {
      const url = `blob:packet-${++serial}`;
      live.set(url, blob);
      return url;
    };
    URL.revokeObjectURL = (url) => live.delete(url);
    panel = mountArtworkCollectionPanel({ document, window });
    $('artwork-files').files = [
      new File([JSON.stringify(source)], 'packet.json'),
      new File([bytes], 'source.png'),
    ];
    await $('artwork-files').onchange();
    const preview = $('artwork-preview').children[0];
    assert.equal(preview.dataset.medium, 'pixel-art');
    preview.onload();
    assert.match($('artwork-status').textContent, /Verified source preview/);
    assert.match(
      $('artwork-provenance').textContent,
      /Reference only; no source pixels incorporated/,
    );
    assert.match($('artwork-provenance').textContent, /not approval/);
    assert.equal(live.size, 1, 'only the accepted preview URL remains');
    const gate = deferred();
    const delayedJSON = new File([JSON.stringify(source)], 'packet.json');
    delayedJSON.text = () => gate.promise;
    $('artwork-files').files = [delayedJSON, new File([bytes], 'source.png')];
    const importing = $('artwork-files').onchange();
    assert.match($('artwork-status').textContent, /Verifying original bytes/);
    preview.onload();
    assert.match(
      $('artwork-status').textContent,
      /Verifying original bytes/,
      'retained preview cannot overwrite the newer operation status',
    );
    $('artwork-cancel').onclick();
    gate.resolve(JSON.stringify(source));
    await importing;
    assert.equal($('artwork-preview').children[0], preview);
    assert.match($('artwork-status').textContent, /Cancelled/);
    const referenceLink = $('artwork-provenance').querySelector('a');
    assert.equal(referenceLink.href, source.sources[0].source);
    assert.equal(referenceLink.target, '_blank');
    assert.equal(referenceLink.rel, 'noreferrer noopener');
    setLocale('uk', { persist: false });
    assert.match($('artwork-status').textContent, /Скасовано/);
    assert.match($('artwork-provenance').textContent, /Лише референс/);
    assert.match($('artwork-provenance').textContent, /Test generator/);
    assert.equal($('artwork-treatment').value, 'pixel-art');
    assert.equal($('artwork-provenance').querySelector('a'), referenceLink);
    assert.equal(referenceLink.isConnected, true);
    assert.equal(referenceLink.href, source.sources[0].source);
    setLocale('en', { persist: false });
    assert.equal($('artwork-provenance').querySelector('a'), referenceLink);
    assert.equal(referenceLink.isConnected, true);
    assert.equal(referenceLink.href, source.sources[0].source);
    $('artwork-files').files = [
      new File(
        [
          JSON.stringify(
            changed(source, (next) => {
              next.artworks[0].file.sha256 = '0'.repeat(64);
            }),
          ),
        ],
        'packet.json',
      ),
      new File([bytes], 'source.png'),
    ];
    await $('artwork-files').onchange();
    assert.match($('artwork-status').textContent, /SHA-256/);
    assert.equal($('artwork-preview').children[0], preview);
    assert.equal(live.size, 1);
    const multiArtwork = changed(source, (next) => {
      const second = structuredClone(next.artworks[0]);
      second.id = 'second-source';
      second.file.name = 'second.png';
      next.artworks.push(second);
    });
    $('artwork-files').files = [
      new File([JSON.stringify(multiArtwork)], 'packet.json'),
      new File([bytes], 'source.png'),
      new File([bytes], 'second.png'),
    ];
    await $('artwork-files').onchange();
    assert.equal(
      $('artwork-item').value,
      'source',
      'a newly imported packet starts with its first artwork',
    );
    $('artwork-item').value = 'second-source';
    $('artwork-item').onchange();
    assert.match($('artwork-provenance').textContent, /second\.png/);
    $('artwork-treatment').value = 'photographic-reveals';
    $('artwork-treatment').onchange();
    assert.match($('artwork-provenance').textContent, /revision 2 · photographic-reveals/);
    assert.equal(
      $('artwork-item').value,
      'second-source',
      'treatment revisions preserve the selected artwork',
    );
    assert.match($('artwork-provenance').textContent, /second\.png/);
    await $('artwork-export').onclick();
    const link = $('artwork-download').querySelector('a');
    assert.equal(link.download, 'test-artwork-r2.rlart');
    const exported = await importArtworkCollection(live.get(link.href), {
      decodeImage: dimensions,
    });
    assert.equal(exported.document.treatment, 'photographic-reveals');
    assert.deepEqual(
      new Uint8Array(await exported.assets.get('source.png').arrayBuffer()),
      new Uint8Array(bytes),
    );
    assert.equal(live.size, 2, 'one preview and one download URL');
    window.emit('pagehide', { persisted: true });
    assert.equal(live.size, 0);
    assert.equal($('artwork-preview').children.length, 0);
    window.emit('pageshow', { persisted: true });
    assert.equal(live.size, 0, 'BFCache return does not allocate a preview');
    $('artwork-preview-source').onclick();
    assert.equal(live.size, 1);
    window.emit('pagehide', { persisted: false });
    assert.equal(live.size, 0);
  } finally {
    panel?.dispose();
    globalThis.Image = originalImage;
    URL.createObjectURL = create;
    URL.revokeObjectURL = revoke;
    globalThis.fetch = fetch;
    setLocale(originalLocale, { persist: false });
  }
});

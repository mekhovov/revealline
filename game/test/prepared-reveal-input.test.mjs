import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, webcrypto } from 'node:crypto';
import { parse } from 'parse5';
import { Document } from './helpers/couch-dom.mjs';
import { mountRevealAuditViewer } from '../../authoring/design-atlas/reveal-audit-viewer.mjs';
import { mountAuthoringInputHost } from '../ui/authoring-input-host.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
import {
  readPreparedRevealText,
  readPreparedRevealManifest,
  validatePreparedRevealManifest,
  loadPreparedRevealImage,
  revealReviewURLs,
} from '../../authoring/library/fpv-field-kit/prepared/reveals/review-model.mjs';
import {
  PREPARED_REVEAL_MANIFEST,
  PREPARED_REVEAL_GUIDE,
  PREPARED_REVEAL_ORIGINALS,
} from '../../authoring/library/fpv-field-kit/prepared/reveals/review-sources.mjs';
import { mountPreparedRevealManifestViewer } from '../../authoring/library/fpv-field-kit/prepared/reveals/review-manifest-viewer.mjs';

const folder = 'authoring/library/fpv-field-kit/prepared/reveals/';
const source = (path) => readFile(new URL('../../' + path, import.meta.url));
const manifestBytes = await source(folder + 'reveals.json');
const manifest = JSON.parse(manifestBytes);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const settle = async () => {
  for (let i = 0; i < 6; i++) await new Promise((resolve) => setImmediate(resolve));
};

// Finite DOM and decode hooks qualify ownership and verified byte flow only;
// they do not claim browser layout, PNG pixel decoding or physical controllers.
function environment(t, { fetchSource = async () => new Response(manifestBytes) } = {}) {
  const doc = new Document(),
    win = doc.defaultView;
  doc.parentNode = win;
  const frames = new Map(),
    timers = new Map(),
    observers = new Set(),
    requests = [],
    revoked = [],
    storageWrites = [];
  let serial = 0;
  Object.assign(win, {
    document: doc,
    localStorage: {
      getItem: () => null,
      setItem: (...args) => storageWrites.push(['local', ...args]),
      removeItem: (...args) => storageWrites.push(['local-remove', ...args]),
    },
    sessionStorage: {
      getItem: () => null,
      setItem: (...args) => storageWrites.push(['session', ...args]),
      removeItem: (...args) => storageWrites.push(['session-remove', ...args]),
    },
    location: new URL('https://reveal.test/' + folder + 'review.html'),
    crypto: webcrypto,
    fetch(url, options) {
      requests.push({ url, options });
      return fetchSource(url, options);
    },
    requestAnimationFrame(fn) {
      const id = ++serial;
      frames.set(id, fn);
      return id;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
    setTimeout(fn, delay) {
      const id = ++serial;
      timers.set(id, { fn, delay });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    scrollBy() {},
    MutationObserver: class {
      constructor(callback) {
        this.callback = callback;
      }
      observe() {
        observers.add(this);
      }
      disconnect() {
        observers.delete(this);
      }
    },
    URL: {
      createObjectURL: () => 'blob:prepared-' + ++serial,
      revokeObjectURL: (url) => revoked.push(url),
    },
  });
  const create = doc.createElement.bind(doc);
  doc.createElement = (tag) => {
    const node = create(tag);
    if (tag === 'img') {
      node.naturalWidth = manifest.assets[0].file.width;
      node.naturalHeight = manifest.assets[0].file.height;
      node.decode = async () => {};
    }
    return node;
  };
  doc.createTextNode = (text) => {
    const node = create('span');
    node.textContent = text;
    return node;
  };
  const oldLocale = getLocale();
  setLocale('en', { persist: false });
  t.after(() => {
    doc.body.replaceChildren();
    doc.head.replaceChildren();
    setLocale(oldLocale, { persist: false });
  });
  return {
    doc,
    win,
    frames,
    timers,
    observers,
    requests,
    revoked,
    storageWrites,
    observe: () => [...observers].forEach((observer) => observer.callback()),
    deadline() {
      const entries = [...timers.values()];
      timers.clear();
      entries.forEach(({ fn }) => fn());
    },
    $: (id) => doc.getElementById(id),
  };
}

function manifestFixture(t, options = {}) {
  const f = environment(t);
  const origin = f.doc.createElement('button'),
    newer = f.doc.createElement('button');
  origin.id = 'manifest-opener';
  newer.id = 'newer-owner';
  f.doc.body.append(origin, newer);
  const host = mountAuthoringInputHost({ document: f.doc, window: f.win, readPads: () => [] });
  const viewer = mountPreparedRevealManifestViewer({
    document: f.doc,
    window: f.win,
    navigation: host.navigation,
    readText: async () => manifestBytes.toString(),
    ...options,
  });
  t.after(() => {
    viewer.destroy();
    host.destroy();
  });
  return {
    ...f,
    origin,
    newer,
    host,
    viewer,
    open() {
      origin.focus();
      return viewer.open('manifest', origin);
    },
    dialog: f.$('prepared-reveal-manifest-dialog'),
  };
}

test('historical manifest and bounded source descriptors preserve 44 specimens, 38 compositions and 56 exact owners', async () => {
  assert.equal(manifestBytes.length, 266665);
  assert.equal(
    sha(manifestBytes),
    'fc25cf8c335518bdfd2259e26cb08e99184a9cfcf0c01018063d1b928103f92b',
  );
  assert.equal(PREPARED_REVEAL_MANIFEST.bytes, 266665);
  assert.equal(PREPARED_REVEAL_MANIFEST.sha256, sha(manifestBytes));
  assert.deepEqual(validatePreparedRevealManifest(manifest), manifest);
  assert.deepEqual(manifest.planned, { compositions: 38, exports: 44, owners: 56 });
  assert.equal(manifest.assets.length, 44);
  assert.equal(new Set(manifest.assets.map((asset) => asset.compositionId)).size, 38);
  assert.equal(new Set(manifest.assets.flatMap((asset) => asset.slotIds)).size, 56);
  assert.equal(PREPARED_REVEAL_ORIGINALS.length, 38);
  assert.equal(Object.isFrozen(PREPARED_REVEAL_ORIGINALS), true);
  for (const pin of PREPARED_REVEAL_ORIGINALS) {
    const original = manifest.assets.find((asset) => asset.provenance.source.path === pin.path)
      ?.provenance.source;
    assert.deepEqual(
      { bytes: pin.bytes, sha256: pin.sha256, width: pin.width, height: pin.height },
      {
        bytes: original.bytes,
        sha256: original.sha256,
        width: original.width,
        height: original.height,
      },
    );
  }
  const guide = await source(PREPARED_REVEAL_GUIDE.path);
  assert.equal(guide.length, PREPARED_REVEAL_GUIDE.bytes);
  assert.equal(sha(guide), PREPARED_REVEAL_GUIDE.sha256);
});

for (const [name, mutate] of [
  ['missing specimen', (data) => data.assets.pop()],
  [
    'duplicate owner',
    (data) => {
      data.assets[1].slotIds[0] = data.assets[0].slotIds[0];
    },
  ],
  [
    'escaped derivative',
    (data) => {
      data.assets[0].file.path = '../outside.png';
    },
  ],
  [
    'external original',
    (data) => {
      data.assets[0].provenance.source.path = 'https://foreign.test/original.png';
    },
  ],
  [
    'wrong byte total',
    (data) => {
      data.assets[0].file.bytes++;
    },
  ],
  [
    'unbounded geometry',
    (data) => {
      data.assets[0].file.width = 9000;
    },
  ],
])
  test('manifest validation rejects ' + name, () => {
    const bad = structuredClone(manifest);
    mutate(bad);
    assert.throws(() => validatePreparedRevealManifest(bad));
  });

test('exact oversized manifest is read explicitly, while changed, short and overflow bodies reject', async (t) => {
  const rootURL = new URL('https://reveal.test/');
  const f = environment(t);
  assert.equal(await readPreparedRevealText({ window: f.win, rootURL }), manifestBytes.toString());
  assert.deepEqual(await readPreparedRevealManifest({ window: f.win, rootURL }), manifest);
  for (const bad of [
    Buffer.concat([manifestBytes, Buffer.from(' ')]),
    manifestBytes.subarray(1),
    Buffer.from(manifestBytes.toString().replace('revealline-prepared', 'reveallinE-prepared')),
  ]) {
    const next = environment(t, { fetchSource: async () => new Response(bad) });
    await assert.rejects(readPreparedRevealText({ window: next.win, rootURL }));
  }
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    readPreparedRevealText({ window: f.win, rootURL, signal: controller.signal }),
  );
});

test('public compiled image failure never fetches source art; local fallback keeps exact prepared bytes', async (t) => {
  const asset = manifest.assets[0],
    bytes = await source(asset.file.path);
  const publicHost = environment(t, {
    fetchSource: async () => new Response(null, { status: 404 }),
  });
  await assert.rejects(
    loadPreparedRevealImage(asset, {
      window: publicHost.win,
      pageURL: 'https://example.test/project/' + folder + 'review.mjs',
    }),
  );
  assert.equal(publicHost.requests.length, 1);
  assert.match(
    publicHost.requests[0].url,
    new RegExp('/project/game/presentation/compiled/assets/' + asset.file.sha256),
  );
  const local = environment(t, {
    fetchSource: async (url) =>
      new Response(url.includes('/compiled/') ? null : bytes, {
        status: url.includes('/compiled/') ? 404 : 200,
      }),
  });
  const result = await loadPreparedRevealImage(asset, {
    window: local.win,
    pageURL: 'http://localhost/project/' + folder + 'review.mjs',
  });
  assert.equal(result.path, asset.file.path);
  assert.equal(local.requests.length, 2);
  assert.equal(local.requests[1].url, 'http://localhost/project/' + asset.file.path);
  result.dispose();
  assert.equal(local.revoked.length, 1);
  assert.equal(
    revealReviewURLs(asset, 'https://localhost.example/' + folder + 'review.mjs').sourceOriginal,
    null,
  );
});

test('manifest modal only accepts its fixed source and restores exact opener after bounded reading', async (t) => {
  const f = manifestFixture(t);
  assert.equal(f.viewer.open('arbitrary-document', f.origin), false);
  assert.equal(f.open(), true);
  await settle();
  assert.equal(f.dialog.dataset.state, 'ready');
  const region = f.$('prepared-reveal-manifest-region');
  assert.equal(region.querySelector('pre').textContent, manifestBytes.toString());
  region.scrollHeight = 2000;
  region.clientHeight = 300;
  f.$('prepared-reveal-manifest-end').click();
  assert.equal(region.scrollTop, 1700);
  f.$('prepared-reveal-manifest-start').click();
  assert.equal(region.scrollTop, 0);
  const read = f.$('prepared-reveal-manifest-read');
  read.focus();
  read.click();
  assert.equal(f.host.navigation.readingState()?.regionId, region.id);
  f.host.navigation.handle({ back: true });
  assert.equal(f.doc.activeElement === read, true);
  f.$('prepared-reveal-manifest-back').focus();
  f.$('prepared-reveal-manifest-back').click();
  assert.equal(f.dialog.open, false);
  assert.equal(f.doc.activeElement === f.origin, true);
});

async function pendingManifestRetry(t) {
  const wait = deferred();
  let count = 0,
    signal;
  const f = manifestFixture(t, {
    readText: (options) => {
      if (++count === 1) return Promise.resolve(manifestBytes.toString());
      signal = options.signal;
      return wait.promise;
    },
  });
  f.open();
  await settle();
  const retry = f.$('prepared-reveal-manifest-retry'),
    back = f.$('prepared-reveal-manifest-back');
  f.host.navigation.engage();
  retry.focus();
  f.host.navigation.beginConfirm();
  f.host.navigation.commitConfirm();
  assert.equal(f.dialog.dataset.state, 'loading');
  assert.equal(retry.disabled, true);
  assert.equal(back.disabled, false);
  assert.equal(f.doc.activeElement === back, true);
  // Poll the actual shared navigator while Retry is ineligible. Its fallback
  // must not replace the route's explicit, cancelable pending focus owner.
  for (let i = 0; i < 4; i++) f.host.navigation.handle({});
  assert.equal(f.doc.activeElement === back, true);
  return { ...f, retry, back, wait, signal };
}

for (const outcome of ['success', 'failure', 'timeout'])
  test(
    'owned manifest Retry returns focus after ' + outcome + ' and neutral polling',
    async (t) => {
      const f = await pendingManifestRetry(t);
      if (outcome === 'success') f.wait.resolve(manifestBytes.toString());
      if (outcome === 'failure') f.wait.reject(new Error('unavailable'));
      if (outcome === 'timeout') {
        f.deadline();
        assert.equal(f.signal.aborted, true);
        f.wait.resolve('late timeout response');
      }
      await settle();
      assert.equal(f.dialog.dataset.state, outcome === 'success' ? 'ready' : 'error');
      assert.equal(f.retry.disabled, false);
      assert.equal(f.doc.activeElement === f.retry, true);
      const text = f.$('prepared-reveal-manifest-region').querySelector('pre');
      assert.equal(
        text?.textContent ?? null,
        outcome === 'success' ? manifestBytes.toString() : null,
      );
    },
  );

test('manifest Retry does not reclaim Back after an intervening modal focus choice', async (t) => {
  const f = await pendingManifestRetry(t),
    newer = f.doc.createElement('button');
  f.dialog.append(newer);
  newer.focus();
  f.back.focus();
  f.wait.resolve(manifestBytes.toString());
  await settle();
  assert.equal(f.dialog.dataset.state, 'ready');
  assert.equal(f.doc.activeElement === f.back, true);
});

for (const event of ['back', 'blur', 'hidden', 'modal'])
  test(
    'pending manifest Retry ' + event + ' revokes captured focus and ignores late completion',
    async (t) => {
      const f = await pendingManifestRetry(t);
      if (event === 'back') {
        f.host.navigation.handle({ back: true });
        assert.equal(f.dialog.open, false);
        assert.equal(f.doc.activeElement === f.origin, true);
      }
      if (event === 'blur') f.win.emit('blur');
      if (event === 'hidden') {
        f.doc.hidden = true;
        f.doc.emit('visibilitychange');
      }
      if (event === 'modal') {
        const modal = f.doc.createElement('dialog');
        f.doc.body.append(modal);
        modal.showModal();
        f.observe();
      }
      assert.equal(f.signal.aborted, true);
      const focus = f.doc.activeElement;
      f.wait.resolve(manifestBytes.toString());
      await settle();
      assert.equal(f.doc.activeElement === focus, true);
      assert.equal(f.$('prepared-reveal-manifest-region').querySelector('pre'), null);
    },
  );

for (const event of ['cancel', 'blur', 'hidden', 'pagehide', 'newer-focus', 'modal', 'timeout'])
  test('pending manifest ' + event + ' cannot publish late or steal a newer owner', async (t) => {
    const wait = deferred();
    let signal;
    const f = manifestFixture(t, {
      readText: (options) => {
        signal = options.signal;
        return wait.promise;
      },
    });
    f.open();
    assert.equal(f.dialog.dataset.state, 'loading');
    if (event === 'cancel') f.$('prepared-reveal-manifest-back').click();
    if (event === 'blur') f.win.emit('blur');
    if (event === 'hidden') {
      f.doc.hidden = true;
      f.doc.emit('visibilitychange');
    }
    if (event === 'pagehide') f.win.emit('pagehide', { persisted: true });
    if (event === 'newer-focus') {
      f.newer.focus();
      f.doc.emit('focusin', { target: f.newer });
    }
    if (event === 'modal') {
      const modal = f.doc.createElement('dialog');
      f.doc.body.append(modal);
      modal.showModal();
      f.observe();
    }
    if (event === 'timeout') f.deadline();
    const focus = f.doc.activeElement;
    assert.equal(signal.aborted, true);
    wait.resolve(manifestBytes.toString());
    await settle();
    assert.equal(f.$('prepared-reveal-manifest-region').querySelector('pre'), null);
    assert.equal(f.doc.activeElement === focus, true);
  });

test('old manifest completion and queued close cannot retire a newer successful visit', async (t) => {
  const wait = deferred();
  let count = 0;
  const f = manifestFixture(t, {
    readText: () => (++count === 1 ? wait.promise : Promise.resolve(manifestBytes.toString())),
  });
  f.open();
  f.viewer.close();
  f.open();
  await settle();
  f.dialog.emit('close');
  wait.resolve('stale');
  await settle();
  assert.equal(f.dialog.open, true);
  assert.equal(f.dialog.dataset.state, 'ready');
  assert.equal(
    f.$('prepared-reveal-manifest-region').querySelector('pre').textContent,
    manifestBytes.toString(),
  );
});

test('shared source reader still rejects the oversized manifest before fetching', async (t) => {
  const f = environment(t),
    origin = f.doc.createElement('button');
  f.doc.body.append(origin);
  const host = mountAuthoringInputHost({ document: f.doc, window: f.win, readPads: () => [] });
  const viewer = mountRevealAuditViewer({
    document: f.doc,
    window: f.win,
    navigation: host.navigation,
    sources: [PREPARED_REVEAL_MANIFEST],
  });
  t.after(() => {
    viewer.destroy();
    host.destroy();
  });
  origin.focus();
  viewer.open('manifest', origin);
  await settle();
  assert.equal(f.requests.length, 0);
  assert.equal(f.$('reveal-source-dialog').dataset.state, 'error');
  assert.equal(f.$('reveal-source-region').querySelector('pre'), null);
});

// Serve-origin adaptation only; actual imports and production ownership remain.
const viewerURL = new URL('../../authoring/design-atlas/reveal-audit-viewer.mjs', import.meta.url);
const servedViewerCode = (await readFile(viewerURL, 'utf8'))
  .replace(/from '([^']+)'/g, (_, path) => `from '${new URL(path, viewerURL).href}'`)
  .replaceAll(
    'import.meta.url',
    JSON.stringify('https://reveal.test/authoring/design-atlas/reveal-audit-viewer.mjs'),
  );
const servedViewerURL = `data:text/javascript;base64,${Buffer.from(servedViewerCode).toString('base64')}`;
const reviewURL = new URL('../../' + folder + 'review.mjs', import.meta.url);
const servedReviewCode = (await readFile(reviewURL, 'utf8')).replace(
  /from '([^']+)'/g,
  (_, path) =>
    `from '${path.endsWith('/design-atlas/reveal-audit-viewer.mjs') ? servedViewerURL : new URL(path, reviewURL).href}'`,
);
const { mountPreparedRevealReview } = await import(
  `data:text/javascript;base64,${Buffer.from(servedReviewCode).toString('base64')}`
);
const markup = parse((await source(folder + 'review.html')).toString());
function reviewFixture(
  t,
  {
    readManifest = async () => structuredClone(manifest),
    loadImage,
    local = false,
    fetchSource,
  } = {},
) {
  const f = environment(t, { fetchSource });
  if (local) f.win.location = new URL('http://localhost/' + folder + 'review.html');
  const append = (parent, sourceNode) => {
    if (sourceNode.nodeName === '#text') {
      parent._text = (parent._text || '') + sourceNode.value;
      return;
    }
    if (!sourceNode.tagName) return;
    const node = f.doc.createElement(sourceNode.tagName);
    for (const { name, value } of sourceNode.attrs || []) {
      node.setAttribute(name, value);
      if (['id', 'type', 'value', 'href', 'content', 'src'].includes(name)) node[name] = value;
      if (name === 'class') node.className = value;
      if (['hidden', 'disabled', 'open', 'checked', 'selected'].includes(name)) node[name] = true;
    }
    parent.append(node);
    for (const child of sourceNode.childNodes || []) append(node, child);
  };
  const html = markup.childNodes.find((node) => node.tagName === 'html');
  for (const name of ['head', 'body'])
    html.childNodes
      .find((node) => node.tagName === name)
      .childNodes.forEach((node) => append(f.doc[name], node));
  const loaded = [],
    disposed = [],
    reads = [];
  const result = (asset, label = asset.id) => {
    const image = f.doc.createElement('img');
    image.naturalWidth = asset.file.width;
    image.naturalHeight = asset.file.height;
    image.src = 'blob:' + label;
    return {
      image,
      dispose() {
        disposed.push(label);
      },
    };
  };
  const host = mountPreparedRevealReview({
    document: f.doc,
    window: f.win,
    autoStart: false,
    readManifest(options) {
      reads.push(options);
      return readManifest(options);
    },
    loadImage(asset, options) {
      loaded.push({ asset, options });
      return loadImage ? loadImage(asset, options, result) : Promise.resolve(result(asset));
    },
  });
  t.after(() => host.destroy());
  return {
    ...f,
    host,
    loaded,
    disposed,
    reads,
    result,
    start() {
      f.$('prepared-reveal-retry').focus();
      return host.load();
    },
  };
}

test('complete ready inventory preserves every specimen, exact provenance, truthful native size and useful Sections', async (t) => {
  const f = reviewFixture(t);
  await f.start();
  assert.equal(f.$('status').dataset.state, 'ready');
  assert.equal(f.doc.activeElement?.id, 'prepared-reveal-retry');
  assert.equal(f.$('inventory').children.length, 44);
  assert.equal(f.loaded.length, 44);
  for (const asset of manifest.assets) {
    const id = asset.id,
      heading = f.$('prepared-reveal-' + id),
      read = f.$('prepared-reveal-read-' + id),
      native = f.$('prepared-reveal-native-' + id).querySelector('img'),
      provenance = JSON.parse(
        f.$('prepared-reveal-provenance-' + id).querySelector('pre').textContent,
      );
    assert.equal(heading.dataset.authoringTarget, read.id);
    assert.deepEqual([native.width, native.height], [asset.file.width, asset.file.height]);
    assert.deepEqual(provenance.source, asset.provenance.source);
    assert.deepEqual(provenance.owners, asset.slotIds);
    assert.equal(provenance.prompt, asset.provenance.prompt);
    assert.deepEqual(provenance.crop, asset.preparation.sourceCrop);
    assert.equal(
      f.$('prepared-reveal-original-' + id),
      null,
      'public route has no source-original action',
    );
  }
  const cards = [...f.$('inventory').children];
  await f.start();
  assert.equal(
    f.$('inventory').children.every((node, index) => node === cards[index]),
    true,
  );
  assert.equal(f.disposed.length, 44);
});

test('native and provenance readers bound both axes, preserve exact Back and own no storage', async (t) => {
  const f = reviewFixture(t);
  await f.start();
  const id = manifest.assets[0].id,
    read = f.$('prepared-reveal-native-read-' + id),
    region = f.$('prepared-reveal-native-' + id);
  f.$('prepared-reveal-native-details-' + id).open = true;
  region.scrollWidth = 1152;
  region.clientWidth = 300;
  region.scrollHeight = 576;
  region.clientHeight = 200;
  read.focus();
  f.host.navigation.handle({ confirm: true });
  assert.equal(read.getAttribute('aria-pressed'), 'true');
  for (let i = 0; i < 10; i++) {
    f.host.navigation.handle({ direction: 'right' });
    f.host.navigation.handle({ direction: 'down' });
  }
  assert.deepEqual([region.scrollLeft, region.scrollTop], [852, 376]);
  f.host.navigation.handle({ back: true });
  assert.equal(read.getAttribute('aria-pressed'), 'false');
  assert.equal(f.doc.activeElement === read, true);
  const provenanceRead = f.$('prepared-reveal-provenance-read-' + id);
  f.$('prepared-reveal-provenance-details-' + id).open = true;
  provenanceRead.focus();
  f.host.navigation.handle({ confirm: true });
  assert.equal(provenanceRead.getAttribute('aria-pressed'), 'true');
  f.win.emit('blur');
  assert.equal(provenanceRead.getAttribute('aria-pressed'), 'false');
  assert.deepEqual(f.storageWrites, []);
});

for (const boundary of ['cancel', 'blur', 'hidden', 'pagehide', 'modal', 'timeout', 'destroy'])
  test(
    'pending inventory ' + boundary + ' disposes staging and never publishes late',
    async (t) => {
      const wait = deferred();
      const f = reviewFixture(t, { readManifest: () => wait.promise });
      const pending = f.start();
      assert.equal(f.doc.activeElement?.id, 'prepared-reveal-cancel');
      if (boundary === 'cancel') f.$('prepared-reveal-cancel').click();
      if (boundary === 'blur') f.win.emit('blur');
      if (boundary === 'hidden') {
        f.doc.hidden = true;
        f.doc.emit('visibilitychange');
      }
      if (boundary === 'pagehide') f.win.emit('pagehide', { persisted: true });
      if (boundary === 'modal') {
        const dialog = f.doc.createElement('dialog');
        f.doc.body.append(dialog);
        dialog.showModal();
        f.observe();
      }
      if (boundary === 'timeout') f.deadline();
      if (boundary === 'destroy') f.host.destroy();
      const currentFocus = f.doc.activeElement;
      assert.equal(f.reads[0].signal.aborted, true);
      wait.resolve(structuredClone(manifest));
      await pending;
      assert.equal(f.$('inventory').children.length, 0);
      assert.equal(f.loaded.length, 0);
      assert.equal(f.doc.activeElement === currentFocus, true);
    },
  );

test('late successful inventory preserves a newer focused action', async (t) => {
  const wait = deferred();
  const f = reviewFixture(t, { readManifest: () => wait.promise });
  const pending = f.start();
  const newer = f.$('prepared-reveal-source-guide');
  newer.focus();
  wait.resolve(structuredClone(manifest));
  await pending;
  assert.equal(f.$('status').dataset.state, 'ready');
  assert.equal(f.doc.activeElement === newer, true);
});

test('cancel releases already-acquired images immediately, and each late sibling exactly once', async (t) => {
  const later = new Map();
  const f = reviewFixture(t, {
    loadImage(asset, options, result) {
      if (asset === manifest.assets[0] || asset.id === manifest.assets[0].id)
        return Promise.resolve(result(asset));
      const wait = deferred();
      later.set(asset.id, { wait, result: result(asset) });
      return wait.promise;
    },
  });
  const pending = f.start();
  await settle();
  assert.equal(later.size, 43);
  assert.equal(f.$('inventory').children.length, 0);
  f.$('prepared-reveal-cancel').click();
  assert.deepEqual(f.disposed, [manifest.assets[0].id]);
  for (const item of later.values()) item.wait.resolve(item.result);
  await pending;
  assert.equal(f.disposed.length, 44);
  assert.equal(new Set(f.disposed).size, 44);
  assert.equal(f.$('inventory').children.length, 0);
  assert.equal(f.$('status').dataset.state, 'cancelled');
});

test('failed frame dimensions retain a previous complete inventory, and Retry recovers', async (t) => {
  let broken = false;
  const f = reviewFixture(t, {
    loadImage(asset, options, result) {
      const value = result(asset);
      if (broken && asset.id === manifest.assets[0].id) value.image.naturalWidth++;
      return Promise.resolve(value);
    },
  });
  await f.start();
  const specimen = f.$('prepared-reveal-specimen-' + manifest.assets[0].id).firstElementChild;
  broken = true;
  await f.start();
  assert.equal(f.$('status').dataset.state, 'error');
  assert.equal(
    f.$('prepared-reveal-specimen-' + manifest.assets[0].id).firstElementChild === specimen,
    true,
  );
  assert.equal(f.$('inventory').children.length, 44);
  broken = false;
  await f.start();
  assert.equal(f.$('status').dataset.state, 'ready');
});

test('local original opens inside the owner; Back during pending read prevents late publication', async (t) => {
  const wait = deferred();
  const f = reviewFixture(t, { local: true, fetchSource: () => wait.promise });
  await f.start();
  const opener = f.$('prepared-reveal-original-' + manifest.assets[0].id);
  assert.ok(opener);
  opener.focus();
  opener.click();
  await settle();
  assert.equal(f.$('reveal-source-dialog').open, true);
  assert.equal(f.requests.length, 1);
  assert.equal(
    f.requests[0].url,
    'https://reveal.test/' + manifest.assets[0].provenance.source.path,
  );
  f.$('reveal-source-close').click();
  assert.equal(f.requests[0].options.signal.aborted, true);
  wait.resolve(new Response(await source(manifest.assets[0].provenance.source.path)));
  await settle();
  assert.equal(f.$('reveal-source-dialog').open, false);
  assert.equal(f.$('reveal-source-region').querySelector('img'), null);
  assert.equal(f.doc.activeElement === opener, true);
});

test('a canceled older inventory cannot replace or refocus a newer completed visit', async (t) => {
  const wait = deferred();
  let count = 0;
  const f = reviewFixture(t, {
    readManifest: () => (++count === 1 ? wait.promise : Promise.resolve(structuredClone(manifest))),
  });
  const old = f.start();
  f.host.cancel();
  await f.start();
  const first = f.$('inventory').children[0],
    newer = f.$('prepared-reveal-source-guide');
  newer.focus();
  wait.resolve(structuredClone(manifest));
  await old;
  assert.equal(f.$('status').dataset.state, 'ready');
  assert.equal(f.loaded.length, 44);
  assert.equal(f.$('inventory').children[0] === first, true);
  assert.equal(f.doc.activeElement === newer, true);
});

test('public image loading verifies compiled bytes and rejects a same-size hash mismatch', async (t) => {
  const asset = manifest.assets[0],
    bytes = await source(asset.file.path);
  const f = environment(t, { fetchSource: async () => new Response(bytes) });
  const image = await loadPreparedRevealImage(asset, {
    window: f.win,
    pageURL: 'https://reveal.test/' + folder + 'review.mjs',
  });
  assert.equal(f.requests.length, 1);
  assert.match(image.path, /^game\/presentation\/compiled\/assets\//);
  image.dispose();
  const changed = Buffer.from(bytes);
  changed[changed.length - 1] ^= 1;
  const bad = environment(t, { fetchSource: async () => new Response(changed) });
  await assert.rejects(
    loadPreparedRevealImage(asset, {
      window: bad.win,
      pageURL: 'https://reveal.test/' + folder + 'review.mjs',
    }),
  );
  assert.equal(bad.requests.length, 1);
  assert.equal(bad.revoked.length, 0);
});

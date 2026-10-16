import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto, createHash } from 'node:crypto';
import { Document } from './helpers/couch-dom.mjs';
import { mountAuthoringInputHost } from '../ui/authoring-input-host.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

const moduleURL = new URL('../../authoring/design-atlas/reveal-audit-viewer.mjs', import.meta.url);
// Serve-origin boundary only: imports remain the actual modules and all viewer
// code executes unchanged, but Node's file: module URL becomes its browser URL.
const code = (await readFile(moduleURL, 'utf8'))
  .replace(/from '([^']+)'/g, (_, path) => `from '${new URL(path, moduleURL).href}'`)
  .replaceAll(
    'import.meta.url',
    JSON.stringify('https://audit.test/authoring/design-atlas/reveal-audit-viewer.mjs'),
  );
const { mountRevealAuditViewer } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
);
const sha = (value) => createHash('sha256').update(value).digest('hex');
const text = '# Literal audit\n<script>never executed</script>\n{"record":"unchanged"}\n';
const textBytes = new TextEncoder().encode(text);
const png = new Uint8Array(24);
new DataView(png.buffer).setUint32(0, 0x89504e47);
new DataView(png.buffer).setUint32(4, 0x0d0a1a0a);
new DataView(png.buffer).setUint32(12, 0x49484452);
new DataView(png.buffer).setUint32(16, 1774);
new DataView(png.buffer).setUint32(20, 887);
const sources = [
  {
    id: 'text',
    path: 'docs/audit.md',
    kind: 'text',
    bytes: textBytes.length,
    sha256: sha(textBytes),
    title: 'Recorded audit',
  },
  {
    id: 'image',
    path: 'authoring/library/original.png',
    kind: 'image',
    bytes: png.length,
    sha256: sha256png(),
    width: 1774,
    height: 887,
    title: 'Recorded picture',
  },
];
function sha256png() {
  return sha(png);
}
const settle = async () => {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
};
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

function fixture(
  t,
  {
    fetchSource = async (url) => new Response(url.endsWith('.png') ? png : textBytes),
    decode = async () => {},
    list = sources,
  } = {},
) {
  const doc = new Document(),
    win = doc.defaultView;
  doc.parentNode = win;
  const frames = new Map(),
    observers = new Set(),
    requests = [],
    blobs = new Map(),
    revoked = [];
  let time = 1000,
    frameId = 0,
    urlId = 0;
  const pad = {
    id: 'Source viewer pad',
    index: 0,
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  Object.assign(win, {
    crypto: webcrypto,
    location: new URL('https://audit.test/authoring/design-atlas/reveal-audit.html'),
    performance: { now: () => time },
    requestAnimationFrame(callback) {
      frames.set(++frameId, callback);
      return frameId;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
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
      createObjectURL(blob) {
        const url = `blob:test-${++urlId}`;
        blobs.set(url, blob);
        return url;
      },
      revokeObjectURL(url) {
        revoked.push(url);
        blobs.delete(url);
      },
    },
    fetch(url, options) {
      requests.push({ url, options });
      return fetchSource(url, options);
    },
  });
  const create = doc.createElement.bind(doc);
  doc.createElement = (tag) => {
    const node = create(tag);
    if (tag === 'img') {
      node.naturalWidth = 1774;
      node.naturalHeight = 887;
      node.decode = () => decode(node);
    }
    return node;
  };
  doc.createTextNode = (value) => {
    const node = create('span');
    node.textContent = value;
    return node;
  };
  const origin = create('button'),
    newer = create('button');
  origin.id = 'source-opener';
  origin.textContent = 'Open exact source';
  newer.id = 'newer-owner';
  newer.textContent = 'Newer action';
  doc.body.append(origin, newer);
  const locale = getLocale();
  setLocale('en', { persist: false });
  const host = mountAuthoringInputHost({ document: doc, window: win, readPads: () => [pad] });
  const viewer = mountRevealAuditViewer({
    document: doc,
    window: win,
    navigation: host.navigation,
    sources: list,
  });
  const $ = (id) => doc.getElementById(id);
  Object.assign($('reveal-source-region'), {
    clientHeight: 200,
    scrollHeight: 1800,
    scrollTop: 0,
    clientWidth: 300,
    scrollWidth: 1774,
    scrollLeft: 0,
  });
  origin.onclick = () => viewer.open('text', origin);
  t.after(() => {
    viewer.destroy();
    host.destroy();
    doc.body.replaceChildren();
    setLocale(locale, { persist: false });
  });
  const tick = () => {
    time += 50;
    pad.timestamp = time;
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((fn) => fn(time));
    [...observers].forEach((observer) => observer.callback());
  };
  const pulse = (index) => {
    tick();
    pad.buttons[index] = { pressed: true, value: 1 };
    tick();
    pad.buttons[index] = { pressed: false, value: 0 };
    tick();
  };
  const key = (key) => {
    const node = doc.activeElement,
      event = node.emit('keydown', { key, code: key });
    node.emit('keyup', { key, code: key });
    if (!event.defaultPrevented && ['Enter', ' '].includes(key) && node.tagName === 'BUTTON')
      node.click();
    // The finite host models native dialog Escape only when no reader consumed it.
    if (!event.defaultPrevented && key === 'Escape') {
      const dialog = [...doc.querySelectorAll('dialog[open]')].at(-1);
      if (dialog && !dialog.emit('cancel', { cancelable: true }).defaultPrevented) dialog.close();
    }
    return event;
  };
  const open = (id = 'text') => {
    origin.focus();
    assert.equal(viewer.open(id, origin), true);
  };
  tick();
  tick();
  return {
    doc,
    win,
    host,
    viewer,
    origin,
    newer,
    $,
    tick,
    pulse,
    key,
    open,
    requests,
    blobs,
    revoked,
  };
}

test('viewer renders only exact declared UTF-8 text literally, with no navigation or HTML execution', async (t) => {
  const h = fixture(t);
  h.open();
  await settle();
  assert.equal(h.$('reveal-source-dialog').dataset.state, 'ready');
  assert.equal(h.$('reveal-source-region').querySelector('pre').textContent, text);
  assert.equal(h.$('reveal-source-region').querySelector('script'), null);
  assert.equal(h.requests[0].options.redirect, 'error');
  assert.equal(h.doc.activeElement, h.$('reveal-source-close'));
  h.viewer.close();
  assert.equal(h.doc.activeElement, h.origin);
  assert.equal(h.viewer.open('https://foreign.test/private', h.origin), false);
  assert.equal(h.requests.length, 1);
});

for (const device of ['native', 'controller'])
  test(`${device} source reading consumes first Back and closes on second Back to exact opener`, async (t) => {
    const h = fixture(t);
    h.origin.focus();
    if (device === 'native') h.key('Enter');
    else h.pulse(0);
    await settle();
    h.$('reveal-read-source').focus();
    if (device === 'native') h.key('Enter');
    else h.pulse(0);
    assert.equal(h.host.navigation.readingState()?.regionId, 'reveal-source-region');
    if (device === 'native') h.key('ArrowDown');
    else h.pulse(13);
    assert.ok(h.$('reveal-source-region').scrollTop > 0);
    if (device === 'native') h.key('Escape');
    else h.pulse(1);
    assert.equal(h.doc.activeElement, h.$('reveal-read-source'));
    assert.equal(h.$('reveal-source-dialog').open, true);
    if (device === 'native') h.key('Escape');
    else h.pulse(1);
    assert.equal(h.$('reveal-source-dialog').open, false);
    assert.equal(h.doc.activeElement, h.origin);
  });

test('explicit text edges bound long records without changing the text', async (t) => {
  const h = fixture(t);
  h.open();
  await settle();
  h.$('reveal-source-end').focus();
  h.pulse(0);
  assert.equal(h.$('reveal-source-region').scrollTop, 1600);
  h.$('reveal-source-start').focus();
  h.pulse(0);
  assert.equal(h.$('reveal-source-region').scrollTop, 0);
  assert.equal(h.$('reveal-source-region').textContent, text);
});

test('PNG signature/hash/decode precede publication; actual-size panning is bounded in both axes and Back restores', async (t) => {
  const h = fixture(t);
  h.open('image');
  await settle();
  const region = h.$('reveal-source-region'),
    image = region.querySelector('img');
  assert.ok(image);
  assert.equal(h.blobs.size, 1);
  assert.equal(image.dataset.size, 'fit');
  assert.equal(region.tabIndex, -1, 'Inactive image viewport is not a stray native Tab stop.');
  assert.equal(
    await [...h.blobs.values()][0].arrayBuffer().then((x) => sha(new Uint8Array(x))),
    sha(png),
  );
  h.$('reveal-source-actual').focus();
  h.key('Enter');
  assert.equal(image.dataset.size, 'actual');
  h.$('reveal-read-source').focus();
  h.key('Enter');
  assert.equal(region.dataset.revealSourceReading, 'true');
  h.key('End');
  assert.equal(region.scrollTop, 1600);
  assert.equal(region.scrollLeft, 1474);
  h.key('Home');
  assert.equal(region.scrollTop, 0);
  assert.equal(region.scrollLeft, 0);
  h.pulse(15);
  h.pulse(13);
  assert.ok(region.scrollTop > 0);
  assert.ok(region.scrollLeft > 0);
  h.pulse(1);
  assert.equal(h.doc.activeElement, h.$('reveal-read-source'));
  assert.equal(region.hasAttribute('data-reveal-source-reading'), false);
  h.pulse(1);
  assert.equal(h.doc.activeElement, h.origin);
  assert.equal(h.blobs.size, 0);
  assert.equal(h.revoked.length, 1);
});

for (const kind of ['bytes', 'sha', 'utf8', 'redirect', 'oversize', 'unstreamed'])
  test(`invalid ${kind} remains an explicit source error with reachable Back`, async (t) => {
    const list = sources.map((row) => ({ ...row }));
    let body = textBytes,
      custom;
    if (kind === 'bytes') list[0].bytes++;
    if (kind === 'sha') list[0].sha256 = '0'.repeat(64);
    if (kind === 'utf8') {
      body = new Uint8Array([0xff]);
      list[0].bytes = 1;
      list[0].sha256 = sha(body);
    }
    if (kind === 'redirect') custom = { ok: true, redirected: true };
    if (kind === 'oversize') body = new Uint8Array(textBytes.length + 1);
    if (kind === 'unstreamed')
      custom = { ok: true, headers: new Headers(), arrayBuffer: async () => body.buffer };
    const h = fixture(t, { list, fetchSource: async () => custom || new Response(body) });
    h.open();
    await settle();
    assert.equal(h.$('reveal-source-dialog').dataset.state, 'error');
    assert.equal(h.$('reveal-source-region').children.length, 0);
    assert.equal(h.$('reveal-read-source').disabled, true);
    h.pulse(1);
    assert.equal(h.doc.activeElement, h.origin);
  });

test('pending close aborts and fences late response; a fresh retry has its own generation', async (t) => {
  const old = deferred();
  let count = 0;
  const h = fixture(t, {
    fetchSource: () => (++count === 1 ? old.promise : Promise.resolve(new Response(textBytes))),
  });
  h.open();
  h.pulse(1);
  assert.equal(h.requests[0].options.signal.aborted, true);
  assert.equal(h.doc.activeElement, h.origin);
  h.open();
  await settle();
  old.resolve(new Response(new Uint8Array([0xff])));
  await settle();
  assert.equal(h.$('reveal-source-dialog').dataset.state, 'ready');
  assert.equal(h.$('reveal-source-region').textContent, text);
  assert.equal(h.$('reveal-source-status').dataset.error, 'false');
});

for (const event of ['blur', 'hidden', 'newer-focus', 'persisted-pagehide', 'pagehide'])
  test(`pending source ${event} cannot publish or steal focus on late completion`, async (t) => {
    const pending = deferred();
    const h = fixture(t, { fetchSource: () => pending.promise });
    h.open();
    if (event === 'blur') h.win.emit('blur');
    else if (event === 'hidden') {
      h.doc.hidden = true;
      h.doc.emit('visibilitychange');
    } else if (event === 'newer-focus') h.newer.focus();
    else h.win.emit('pagehide', { persisted: event === 'persisted-pagehide' });
    const active = h.doc.activeElement;
    assert.equal(h.requests[0].options.signal.aborted, true);
    pending.resolve(new Response(textBytes));
    await settle();
    assert.equal(h.doc.activeElement, active);
    assert.equal(h.blobs.size, 0);
    assert.equal(h.$('reveal-source-region')?.textContent || '', '');
  });

test('late PNG decode after close is revoked and cannot populate a newer text view', async (t) => {
  const pending = deferred();
  const h = fixture(t, { decode: () => pending.promise });
  h.open('image');
  await settle();
  assert.equal(h.blobs.size, 1);
  h.viewer.close();
  await settle();
  assert.equal(h.blobs.size, 0);
  h.open();
  await settle();
  pending.resolve();
  await settle();
  assert.equal(h.$('reveal-source-region').textContent, text);
  assert.equal(h.blobs.size, 0);
  assert.equal(h.revoked.length, 1);
});

test('failed PNG decode revokes its Blob and leaves retry/Back accessible', async (t) => {
  const h = fixture(t, {
    decode: async () => {
      throw new Error('Native decoder failed');
    },
  });
  h.open('image');
  await settle();
  assert.equal(h.$('reveal-source-dialog').dataset.state, 'error');
  assert.equal(h.blobs.size, 0);
  assert.equal(h.revoked.length, 1);
  assert.equal(h.$('reveal-source-retry').disabled, false);
  assert.equal(h.$('reveal-source-close').disabled, false);
});

test('Menu retires the viewer before Sections can route to page controls behind it', async (t) => {
  const h = fixture(t);
  h.open();
  await settle();
  h.pulse(9);
  assert.equal(h.$('reveal-source-dialog').open, false);
  assert.equal(h.doc.querySelector('.authoring-sections-dialog').open, true);
  assert.ok(h.doc.querySelector('.authoring-sections-dialog').contains(h.doc.activeElement));
});

test('live locale keeps source text/identity and ready state; destruction cleans handlers and URLs', async (t) => {
  const h = fixture(t);
  h.open();
  await settle();
  const region = h.$('reveal-source-region'),
    reader = h.$('reveal-read-source');
  setLocale('uk', { persist: false });
  assert.match(reader.textContent, /Читати/);
  assert.equal(region.textContent, text);
  setLocale('en', { persist: false });
  assert.match(reader.textContent, /Read/);
  assert.equal(h.$('reveal-source-region'), region);
  h.viewer.destroy();
  assert.equal(reader.onclick, null);
  assert.equal(h.$('reveal-source-dialog'), null);
});

test('external dialog closure releases a decoded PNG without stealing newer focus', async (t) => {
  const h = fixture(t);
  h.open('image');
  await settle();
  assert.equal(h.blobs.size, 1);
  h.newer.focus();
  h.$('reveal-source-dialog').close();
  assert.equal(h.blobs.size, 0);
  assert.equal(h.doc.activeElement, h.newer);
  assert.equal(h.$('reveal-source-region').children.length, 0);
});

test('external dialog closure aborts pending text and prevents late publication', async (t) => {
  const pending = deferred();
  const h = fixture(t, { fetchSource: () => pending.promise });
  h.open();
  h.$('reveal-source-dialog').close();
  assert.equal(h.requests[0].options.signal.aborted, true);
  pending.resolve(new Response(textBytes));
  await settle();
  assert.equal(h.$('reveal-source-region').children.length, 0);
  assert.equal(h.$('reveal-source-dialog').open, false);
});

for (const mutation of ['hash', 'header', 'dimensions'])
  test(`PNG ${mutation} mismatch cannot become a displayed source`, async (t) => {
    const list = sources.map((source) => ({ ...source }));
    let bytes = png;
    if (mutation === 'hash') list[1].sha256 = '0'.repeat(64);
    if (mutation === 'header') {
      bytes = png.slice();
      bytes[0] = 0;
      list[1].sha256 = sha(bytes);
    }
    if (mutation === 'dimensions') list[1].width++;
    const h = fixture(t, { list, fetchSource: async () => new Response(bytes) });
    h.open('image');
    await settle();
    assert.equal(h.$('reveal-source-dialog').dataset.state, 'error');
    assert.equal(h.blobs.size, 0);
    assert.equal(h.$('reveal-source-region').querySelector('img'), null);
  });

test('loaded source cached pagehide releases image and reading without reopening on pageshow', async (t) => {
  const h = fixture(t);
  h.open('image');
  await settle();
  h.$('reveal-read-source').focus();
  h.pulse(0);
  assert.equal(h.$('reveal-source-region').dataset.revealSourceReading, 'true');
  h.win.emit('pagehide', { persisted: true });
  h.win.emit('pageshow', { persisted: true });
  assert.equal(h.blobs.size, 0);
  assert.equal(h.$('reveal-source-dialog').open, false);
  assert.equal(h.$('reveal-source-region').hasAttribute('data-reveal-source-reading'), false);
  assert.equal(h.requests.length, 1);
});

test('controller Confirm opens one modal and fences a native compatibility click on its new Back control', async (t) => {
  const h = fixture(t);
  h.origin.focus();
  h.pulse(0);
  await settle();
  assert.equal(h.requests.length, 1);
  assert.equal(h.$('reveal-source-dialog').open, true);
  assert.equal(h.doc.activeElement, h.$('reveal-source-close'));
  // Native compatibility click on the new control is fenced by the existing host.
  h.$('reveal-source-close').emit('click', { isTrusted: true, detail: 0 });
  assert.equal(h.$('reveal-source-dialog').open, true);
  h.pulse(1);
  assert.equal(h.$('reveal-source-dialog').open, false);
  assert.equal(h.doc.activeElement, h.origin);
});

test('queued close from an older view cannot clear a newly opened decoded source', async (t) => {
  const h = fixture(t),
    dialog = h.$('reveal-source-dialog'),
    queued = [];
  // Browser close events arrive in a later task; replace only this platform boundary.
  const emit = dialog.emit.bind(dialog);
  dialog.emit = (type, detail) =>
    type === 'close' ? queued.push(() => emit(type, detail)) : emit(type, detail);
  h.open();
  await settle();
  h.viewer.close();
  assert.equal(queued.length, 1);
  h.open('image');
  await settle();
  const image = h.$('reveal-source-region').querySelector('img');
  assert.ok(image);
  assert.equal(h.blobs.size, 1);
  queued.shift()();
  assert.equal(dialog.open, true);
  assert.equal(dialog.dataset.state, 'ready');
  assert.equal(h.$('reveal-source-region').querySelector('img'), image);
  assert.equal(h.blobs.size, 1);
  assert.equal(h.doc.activeElement, h.$('reveal-source-close'));
});

test('first source open and another source immediately own their visible and accessible titles', async (t) => {
  const h = fixture(t);
  h.open();
  assert.equal(h.$('reveal-source-title').textContent, 'Recorded audit');
  assert.equal(
    h.$('reveal-read-source').getAttribute('aria-label'),
    'Read and scroll: Recorded audit',
  );
  h.viewer.close();
  h.open('image');
  assert.equal(h.$('reveal-source-title').textContent, 'Recorded picture');
  assert.equal(
    h.$('reveal-read-source').getAttribute('aria-label'),
    'Read and scroll: Recorded picture',
  );
  await settle();
  assert.equal(h.doc.activeElement, h.$('reveal-source-close'));
});

test('live source-title producers update EN/UK names without replacing text or reader ownership', async (t) => {
  const list = sources.map((source) => ({
    ...source,
    title: () => (getLocale() === 'uk' ? `Джерело ${source.id}` : `Source ${source.id}`),
  }));
  const h = fixture(t, { list });
  h.open();
  const deadline = Date.now() + 5000;
  while (h.$('reveal-source-dialog').dataset.state === 'loading') {
    assert.ok(Date.now() < deadline, 'The source should finish its bounded test load');
    await settle();
  }
  h.$('reveal-read-source').focus();
  h.key('Enter');
  const region = h.$('reveal-source-region'),
    pre = region.querySelector('pre');
  for (const locale of ['uk', 'en']) {
    setLocale(locale, { persist: false });
    h.tick();
    const title = list[0].title();
    assert.equal(h.$('reveal-source-title').textContent, title);
    assert.ok(h.$('reveal-read-source').getAttribute('aria-label').endsWith(`: ${title}`));
    assert.equal(h.host.navigation.readingState()?.label, title);
    assert.equal(h.host.navigation.readingState()?.regionId, region.id);
    assert.equal(h.doc.activeElement, region);
    assert.equal(region.querySelector('pre'), pre);
    assert.equal(pre.textContent, text);
  }
  h.key('Escape');
  h.key('Escape');
  setLocale('uk', { persist: false });
  h.open('image');
  assert.equal(h.$('reveal-source-title').textContent, 'Джерело image');
  assert.ok(h.$('reveal-read-source').getAttribute('aria-label').endsWith(': Джерело image'));
});

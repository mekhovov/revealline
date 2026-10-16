import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto, createHash } from 'node:crypto';
import { parse } from 'parse5';
import { Document } from './helpers/couch-dom.mjs';
import { mountAuthoringInputHost } from '../ui/authoring-input-host.mjs';
import { getLocale, setLocale, t as translate } from '../i18n/index.mjs';
import { CREATOR_GUIDE_DOCUMENTS } from '../../authoring/community/creator-guide-documents.mjs';

const moduleURL = new URL(
  '../../authoring/community/creator-guide-document-viewer.mjs',
  import.meta.url,
);
// Serve-origin boundary only: the production viewer and its actual imports run
// unchanged while Node's file: module URL is represented as a browser URL.
const code = (await readFile(moduleURL, 'utf8'))
  .replace(/from '([^']+)'/g, (_, path) => `from '${new URL(path, moduleURL).href}'`)
  .replaceAll(
    'import.meta.url',
    JSON.stringify('https://guide.test/authoring/community/creator-guide-document-viewer.mjs'),
  );
const { mountCreatorGuideDocumentViewer } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
);
const sha = (value) => createHash('sha256').update(value).digest('hex');
const text =
  '# Exact document\n<script>never executed</script>\n[Inert link](https://example.test/)\nУкраїнська Ґґ Єє Іі Її\n';
const textBytes = new TextEncoder().encode(text);
const sources = [
  {
    id: 'first',
    path: 'authoring/community/first.md',
    bytes: textBytes.length,
    sha256: sha(textBytes),
    titleKey: 'tools:creatorGuide.docs.imageCampaign',
  },
  {
    id: 'second',
    path: 'authoring/community/second.md',
    bytes: textBytes.length,
    sha256: sha(textBytes),
    titleKey: 'tools:creatorGuide.docs.phase1Acceptance',
  },
];
const settle = async (condition = () => true) => {
  const deadline = Date.now() + 5000;
  for (let count = 0; count < 5 || !condition(); count++) {
    assert.ok(Date.now() < deadline, 'Asynchronous viewer condition did not settle');
    await new Promise((resolve) => setImmediate(resolve));
  }
};
const loaded = (h) => settle(() => h.$('dialog')?.dataset.state !== 'loading');
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
  { fetchSource = async () => new Response(textBytes), list = sources, crypto = webcrypto } = {},
) {
  const doc = new Document(),
    win = doc.defaultView;
  doc.parentNode = win;
  const frames = new Map(),
    observers = new Set(),
    requests = [];
  let time = 1000,
    serial = 0;
  const pad = {
    id: 'Creator Guide document test pad',
    index: 0,
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  Object.assign(win, {
    crypto,
    location: new URL('https://guide.test/authoring/community/index.html'),
    performance: { now: () => time },
    requestAnimationFrame(callback) {
      frames.set(++serial, callback);
      return serial;
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
    fetch(url, options) {
      requests.push({ url, options });
      return fetchSource(url, options);
    },
  });
  doc.createTextNode = (value) => {
    const node = doc.createElement('span');
    node.textContent = value;
    return node;
  };
  const section = doc.createElement('section'),
    origin = doc.createElement('a'),
    newer = doc.createElement('button');
  section.scrollTop = 237;
  origin.id = 'document-opener';
  origin.href = sources[0].path;
  origin.setAttribute('href', origin.href);
  origin.textContent = 'Read original document';
  newer.id = 'newer-owner';
  newer.textContent = 'Newer action';
  section.append(origin);
  doc.body.append(section, newer);
  const locale = getLocale();
  setLocale('en', { persist: false });
  const host = mountAuthoringInputHost({ document: doc, window: win, readPads: () => [pad] });
  const viewer = mountCreatorGuideDocumentViewer({
    document: doc,
    window: win,
    navigation: host.navigation,
    sources: list,
  });
  const $ = (id) => doc.getElementById(`creator-guide-document-${id}`);
  Object.assign($('region'), {
    clientHeight: 200,
    scrollHeight: 1800,
    scrollTop: 0,
    clientWidth: 300,
    scrollWidth: 300,
    scrollLeft: 0,
  });
  origin.onclick = (event) => {
    event.preventDefault();
    viewer.open('first', origin);
  };
  const tick = () => {
    time += 50;
    pad.timestamp = time;
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback(time));
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
    if (
      !event.defaultPrevented &&
      ['Enter', ' '].includes(key) &&
      ['BUTTON', 'A'].includes(node.tagName)
    )
      node.click();
    // Model native dialog Escape only after the actual reader has declined it.
    if (!event.defaultPrevented && key === 'Escape') {
      const dialog = [...doc.querySelectorAll('dialog[open]')].at(-1);
      if (dialog && !dialog.emit('cancel', { cancelable: true }).defaultPrevented) dialog.close();
    }
    [...observers].forEach((observer) => observer.callback());
    return event;
  };
  const open = (id = 'first') => {
    origin.focus();
    assert.equal(viewer.open(id, origin), true);
  };
  t.after(() => {
    viewer.destroy();
    host.destroy();
    doc.body.replaceChildren();
    setLocale(locale, { persist: false });
  });
  tick();
  tick();
  return {
    doc,
    win,
    host,
    viewer,
    origin,
    section,
    newer,
    $,
    tick,
    pulse,
    key,
    open,
    requests,
    frames,
    observers,
    pad,
  };
}

test('all ten document descriptors pin the exact direct Markdown links and both downloads stay separate', async () => {
  const html = await readFile(
    new URL('../../authoring/community/index.html', import.meta.url),
    'utf8',
  );
  const links = [];
  const walk = (node) => {
    if (node.tagName === 'a')
      links.push(Object.fromEntries(node.attrs.map(({ name, value }) => [name, value])));
    node.childNodes?.forEach(walk);
  };
  walk(parse(html));
  assert.equal(CREATOR_GUIDE_DOCUMENTS.length, 10);
  assert.equal(new Set(CREATOR_GUIDE_DOCUMENTS.map((source) => source.id)).size, 10);
  const markdown = links
    .filter((link) => link.href?.endsWith('.md'))
    .map((link) => `authoring/community/${link.href}`)
    .sort();
  assert.deepEqual(CREATOR_GUIDE_DOCUMENTS.map((source) => source.path).sort(), markdown);
  assert.ok(Object.isFrozen(CREATOR_GUIDE_DOCUMENTS));
  for (const source of CREATOR_GUIDE_DOCUMENTS) {
    const bytes = await readFile(new URL(`../../${source.path}`, import.meta.url));
    assert.equal(source.bytes, bytes.length, source.path);
    assert.equal(source.sha256, sha(bytes), source.path);
    assert.ok(source.bytes <= 64 * 1024, source.path);
    assert.ok(Object.isFrozen(source));
    assert.ok(new TextDecoder('utf-8', { fatal: true }).decode(bytes).length);
    assert.notEqual(translate(source.titleKey), source.titleKey);
  }
  assert.deepEqual(
    links
      .filter((link) => 'download' in link)
      .map((link) => link.href)
      .sort(),
    ['example-project.json', 'examples/two-crossings.expansion.json'],
  );
});

test('exact UTF-8 document renders literally without active markup, navigation or completion focus theft', async (t) => {
  const h = fixture(t),
    href = h.win.location.href;
  h.open();
  const loading = h.$('status').textContent;
  h.$('back').focus();
  await loaded(h);
  assert.equal(h.$('dialog').dataset.state, 'ready');
  assert.equal(h.$('region').querySelector('pre').textContent, text);
  assert.equal(h.$('region').querySelector('script'), null);
  assert.equal(h.$('region').querySelector('a'), null);
  assert.notEqual(h.$('status').textContent, loading);
  assert.equal(h.doc.activeElement, h.$('back'));
  assert.equal(h.$('region').tabIndex, -1);
  assert.ok(h.$('read').getAttribute('aria-label').endsWith(translate(sources[0].titleKey)));
  assert.equal(h.win.location.href, href);
  assert.equal(h.requests[0].url, 'https://guide.test/authoring/community/first.md');
  assert.equal(h.requests[0].options.redirect, 'error');
  assert.equal(h.requests[0].options.credentials, 'same-origin');
  assert.equal(h.requests[0].options.cache, 'no-store');
  assert.equal(h.viewer.open('https://outside.test/source.md', h.origin), false);
  assert.equal(h.requests.length, 1);
});

for (const device of ['native keyboard', 'controller'])
  test(`${device} first Confirm reads and two Back actions restore the exact source opener`, async (t) => {
    const h = fixture(t);
    h.origin.focus();
    device === 'controller' ? h.pulse(0) : h.key('Enter');
    await loaded(h);
    h.$('read').focus();
    device === 'controller' ? h.pulse(0) : h.key('Enter');
    assert.equal(h.host.navigation.readingState()?.regionId, h.$('region').id);
    device === 'controller' ? h.pulse(13) : h.key('ArrowDown');
    assert.ok(h.$('region').scrollTop > 0);
    device === 'controller' ? h.pulse(1) : h.key('Escape');
    assert.equal(h.host.navigation.readingState(), null);
    assert.equal(h.doc.activeElement, h.$('read'));
    assert.equal(h.$('dialog').open, true);
    h.tick();
    assert.equal(h.$('region').tabIndex, -1);
    device === 'controller' ? h.pulse(1) : h.key('Escape');
    assert.equal(h.$('dialog').open, false);
    assert.equal(h.doc.activeElement, h.origin);
    assert.equal(h.section.scrollTop, 237);
    assert.equal(h.$('region').children.length, 0);
  });

test('Start and End provide bounded long-document reading without mutating text', async (t) => {
  const h = fixture(t);
  h.open();
  await loaded(h);
  h.$('end').focus();
  h.pulse(0);
  assert.equal(h.$('region').scrollTop, 1600);
  h.$('start').focus();
  h.pulse(0);
  assert.equal(h.$('region').scrollTop, 0);
  assert.equal(h.$('region').textContent, text);
  h.$('region').scrollHeight = 100;
  h.$('end').focus();
  h.key('Enter');
  assert.equal(h.$('region').scrollTop, 0);
});

for (const kind of [
  'bytes',
  'hash',
  'utf8',
  'redirect',
  'oversize',
  'unstreamed',
  'descriptor limit',
  'unsafe path',
  'wrong extension',
  'HTTP failure',
])
  test(`invalid ${kind} reports an error with reachable Retry and Back, without publishing partial text`, async (t) => {
    const list = sources.map((source) => ({ ...source }));
    let body = textBytes,
      custom;
    if (kind === 'bytes') list[0].bytes++;
    if (kind === 'hash') list[0].sha256 = '0'.repeat(64);
    if (kind === 'utf8') {
      body = new Uint8Array([0xff]);
      list[0].bytes = 1;
      list[0].sha256 = sha(body);
    }
    if (kind === 'redirect') custom = { ok: true, redirected: true };
    if (kind === 'oversize') body = new Uint8Array(textBytes.length + 1);
    if (kind === 'unstreamed')
      custom = { ok: true, headers: new Headers(), arrayBuffer: async () => body.buffer };
    if (kind === 'descriptor limit') list[0].bytes = 64 * 1024 + 1;
    if (kind === 'unsafe path') list[0].path = '../private.md';
    if (kind === 'wrong extension') list[0].path = 'authoring/community/first.html';
    if (kind === 'HTTP failure') custom = new Response('', { status: 404 });
    const h = fixture(t, { list, fetchSource: async () => custom || new Response(body) });
    h.open();
    await loaded(h);
    assert.equal(h.$('dialog').dataset.state, 'error');
    assert.equal(h.$('region').children.length, 0);
    assert.equal(h.$('read').disabled, true);
    assert.equal(h.$('retry').disabled, false);
    assert.equal(h.$('back').disabled, false);
    h.pulse(1);
    assert.equal(h.doc.activeElement, h.origin);
  });

test('failed load retries on explicit activation and clears its old error without moving focus', async (t) => {
  let count = 0;
  const h = fixture(t, {
    fetchSource: async () =>
      ++count === 1 ? new Response('', { status: 404 }) : new Response(textBytes),
  });
  h.open();
  await loaded(h);
  assert.equal(h.$('status').dataset.error, 'true');
  h.$('retry').focus();
  h.key('Enter');
  assert.equal(h.$('dialog').dataset.state, 'loading');
  h.$('back').focus();
  await loaded(h);
  assert.equal(h.$('status').dataset.error, 'false');
  assert.equal(h.$('dialog').dataset.state, 'ready');
  assert.equal(h.$('region').textContent, text);
  assert.equal(h.doc.activeElement, h.$('back'));
  assert.equal(h.requests.length, 2);
});

test('pending Back aborts and a late old response cannot overwrite a newer document visit', async (t) => {
  const old = deferred();
  let count = 0;
  const h = fixture(t, {
    fetchSource: () => (++count === 1 ? old.promise : Promise.resolve(new Response(textBytes))),
  });
  h.open();
  assert.equal(h.$('dialog').dataset.state, 'loading');
  assert.equal(h.$('retry').disabled, true);
  h.pulse(1);
  assert.equal(h.requests[0].options.signal.aborted, true);
  assert.equal(h.doc.activeElement, h.origin);
  h.open('second');
  await loaded(h);
  old.resolve(new Response(new Uint8Array([0xff])));
  await settle();
  assert.equal(h.$('dialog').dataset.documentId, 'second');
  assert.equal(h.$('dialog').dataset.state, 'ready');
  assert.ok(h.$('read').getAttribute('aria-label').endsWith(translate(sources[1].titleKey)));
  assert.equal(h.$('title').textContent, translate(sources[1].titleKey));
  assert.equal(h.$('region').textContent, text);
  assert.equal(h.$('status').dataset.error, 'false');
});

test('late digest resolution cannot publish after cancellation or replace a fresh visit', async (t) => {
  const digest = deferred();
  let count = 0;
  const h = fixture(t, {
    crypto: {
      subtle: {
        digest: (...args) => (++count === 1 ? digest.promise : webcrypto.subtle.digest(...args)),
      },
    },
  });
  h.open();
  await settle(() => count === 1);
  assert.equal(count, 1);
  h.pulse(1);
  h.open('second');
  await loaded(h);
  const current = h.$('region').querySelector('pre');
  digest.resolve(await webcrypto.subtle.digest('SHA-256', textBytes));
  await settle();
  assert.equal(h.$('dialog').dataset.documentId, 'second');
  assert.equal(h.$('region').querySelector('pre'), current);
  assert.equal(h.$('region').children.length, 1);
  assert.equal(h.doc.activeElement, h.$('back'));
});

for (const event of ['blur', 'hidden', 'newer focus', 'cached pagehide', 'terminal pagehide'])
  test(`pending ${event} aborts and cannot steal focus or publish on late completion`, async (t) => {
    const pending = deferred(),
      h = fixture(t, { fetchSource: () => pending.promise });
    h.open();
    if (event === 'blur') h.win.emit('blur');
    else if (event === 'hidden') {
      h.doc.hidden = true;
      h.doc.emit('visibilitychange');
    } else if (event === 'newer focus') h.newer.focus();
    else h.win.emit('pagehide', { persisted: event === 'cached pagehide' });
    const active = h.doc.activeElement;
    assert.equal(h.requests[0].options.signal.aborted, true);
    pending.resolve(new Response(textBytes));
    await settle();
    assert.equal(h.doc.activeElement, active);
    assert.equal(h.$('region')?.textContent || '', '');
    assert.equal(h.host.navigation.readingState(), null);
    if (event === 'terminal pagehide') assert.equal(h.$('dialog'), null);
  });

test('Menu retires the source before Sections owns input, without activating the source opener', async (t) => {
  const h = fixture(t);
  h.open();
  await loaded(h);
  h.pulse(9);
  assert.equal(h.$('dialog').open, false);
  assert.equal(h.$('region').children.length, 0);
  const sections = h.doc.querySelector('.authoring-sections-dialog');
  assert.equal(sections.open, true);
  assert.ok(sections.contains(h.doc.activeElement));
  assert.equal(h.requests.length, 1);
});

test('EN/UK/EN preserves source bytes and reader ownership while updating derived accessible names', async (t) => {
  const h = fixture(t);
  h.open();
  await loaded(h);
  const region = h.$('region'),
    en = h.$('title').textContent;
  h.$('read').focus();
  h.pulse(0);
  for (const locale of ['uk', 'en']) {
    setLocale(locale, { persist: false });
    h.tick();
    const title = h.$('title').textContent;
    assert.equal(title === en, locale === 'en');
    assert.ok(h.$('read').getAttribute('aria-label').endsWith(title));
    assert.equal(h.host.navigation.readingState()?.label, title);
    assert.equal(h.host.navigation.readingState()?.regionId, region.id);
    assert.equal(region.textContent, text);
    assert.equal(h.$('dialog').dataset.state, 'ready');
    assert.equal(h.doc.activeElement, region);
  }
});

test('an external close clears source content without stealing newer focus', async (t) => {
  const h = fixture(t);
  h.open();
  await loaded(h);
  h.newer.focus();
  h.$('dialog').close();
  assert.equal(h.$('region').children.length, 0);
  assert.equal(h.doc.activeElement, h.newer);
});

test('a queued close for an old visit cannot retire an already loaded new document', async (t) => {
  const h = fixture(t),
    dialog = h.$('dialog'),
    queued = [],
    emit = dialog.emit.bind(dialog);
  dialog.emit = (type, detail) =>
    type === 'close' ? queued.push(() => emit(type, detail)) : emit(type, detail);
  h.open();
  await loaded(h);
  h.viewer.close();
  assert.equal(queued.length, 1);
  h.open('second');
  await loaded(h);
  const pre = h.$('region').querySelector('pre');
  queued.shift()();
  assert.equal(dialog.open, true);
  assert.equal(dialog.dataset.state, 'ready');
  assert.equal(dialog.dataset.documentId, 'second');
  assert.equal(h.$('region').querySelector('pre'), pre);
  assert.equal(h.doc.activeElement, h.$('back'));
});

test('held controller Confirm commits once on release and fences a compatibility click on new Back', async (t) => {
  const h = fixture(t);
  h.origin.focus();
  h.pad.buttons[0] = { pressed: true, value: 1 };
  h.tick();
  h.tick();
  assert.equal(h.$('dialog').open, false);
  h.pad.buttons[0] = { pressed: false, value: 0 };
  h.tick();
  await loaded(h);
  assert.equal(h.requests.length, 1);
  assert.equal(h.$('dialog').open, true);
  h.$('back').emit('click', { isTrusted: true, detail: 0 });
  assert.equal(h.$('dialog').open, true);
  h.pulse(1);
  assert.equal(h.$('dialog').open, false);
  assert.equal(h.doc.activeElement, h.origin);
});

test('cached pagehide releases a loaded reader and pageshow cannot implicitly reopen or reload it', async (t) => {
  const h = fixture(t);
  h.open();
  await loaded(h);
  h.$('read').focus();
  h.pulse(0);
  assert.ok(h.host.navigation.readingState());
  h.win.emit('pagehide', { persisted: true });
  h.win.emit('pageshow', { persisted: true });
  assert.equal(h.host.navigation.readingState(), null);
  assert.equal(h.$('dialog').open, false);
  assert.equal(h.$('region').children.length, 0);
  assert.equal(h.requests.length, 1);
  h.open();
  await loaded(h);
  assert.equal(h.$('dialog').dataset.state, 'ready');
  assert.equal(h.requests.length, 2);
});

test('unknown, hidden, background and modal-owned entry points do not fetch or take focus', (t) => {
  const h = fixture(t);
  h.origin.focus();
  assert.equal(h.viewer.open('missing', h.origin), false);
  h.origin.hidden = true;
  assert.equal(h.viewer.open('first', h.origin), false);
  h.origin.hidden = false;
  h.doc.hidden = true;
  assert.equal(h.viewer.open('first', h.origin), false);
  h.doc.hidden = false;
  h.doc.focused = false;
  assert.equal(h.viewer.open('first', h.origin), false);
  h.doc.focused = true;
  const modal = h.doc.createElement('dialog'),
    action = h.doc.createElement('button');
  modal.append(action);
  h.doc.body.append(modal);
  modal.showModal();
  assert.equal(h.viewer.open('first', h.origin), false);
  assert.equal(h.doc.activeElement, action);
  assert.equal(h.requests.length, 0);
});

test('terminal disposal removes local handlers, reader and observers without changing source href', async (t) => {
  const h = fixture(t);
  h.open();
  await loaded(h);
  h.$('read').focus();
  h.pulse(0);
  const reader = h.$('read'),
    before = h.observers.size,
    href = h.origin.href;
  h.viewer.destroy();
  assert.equal(h.$('dialog'), null);
  assert.equal(reader.onclick, null);
  assert.equal(h.host.navigation.readingState(), null);
  assert.equal(h.observers.size, before - 1);
  assert.equal(h.origin.href, href);
  assert.equal(h.viewer.open('first', h.origin), false);
});

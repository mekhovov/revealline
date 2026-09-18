import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Document, Element, Events } from './helpers/couch-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';

const html = await readFile(new URL('../../site/about.html', import.meta.url), 'utf8');
const packCatalog = JSON.parse(
  await readFile(new URL('../content/packs/catalog.json', import.meta.url), 'utf8'),
);
const releases = {
  releases: [
    { version: 'v0.28.0', play: 'v0.28.0/site/game/' },
    { version: 'v0.29.0', play: 'v0.29.0/site/game/' },
  ],
};
let serial = 0;
const until = (predicate) =>
  waitFor(predicate, { message: 'About did not reach the expected host state.' });

// Mount real markup. DOM geometry, native SUMMARY/Enter defaults, hardware and
// request completion are finite boundaries. Landing, the About host, router,
// navigation, URL validation and catalogue preparation remain actual modules.
// This is not native browser layout, scrolling or physical-controller evidence.
function mount(doc) {
  doc.documentElement.dataset.currentVersion = html.match(/data-current-version="([^"]+)"/)[1];
  class NativeElement extends Element {
    get label() {
      return this.getAttribute('label') ?? this.textContent;
    }
    get selectedOptions() {
      return this.options.filter((option) => option.value === this.value);
    }
    append(...nodes) {
      super.append(...nodes);
      if (this.tagName === 'SELECT') {
        const selected = nodes.findLast((node) => node.selected);
        if (selected) this.value = selected.value;
      }
    }
    click() {
      if (this.tagName !== 'SUMMARY') return super.click();
      const event = this.emit('click');
      if (!event.defaultPrevented && this.parentElement?.tagName === 'DETAILS') {
        this.parentElement.open = !this.parentElement.open;
        this.parentElement.emit('toggle');
      }
    }
  }
  doc.createElement = (tag) => new NativeElement(doc, tag);
  const stack = [doc.body];
  for (const [token] of html
    .split(/<body\b[^>]*>/)[1]
    .split('</body>')[0]
    .matchAll(/<!--[\s\S]*?-->|<\/?[^>]+>|[^<]+/g)) {
    if (token.startsWith('<!--')) continue;
    if (token.startsWith('</')) {
      stack.pop();
      continue;
    }
    if (!token.startsWith('<')) {
      stack.at(-1)._text = (stack.at(-1)._text || '') + token.trim();
      continue;
    }
    const tag = token.match(/^<([\w-]+)/)[1],
      element = doc.createElement(tag);
    for (const [, name, quoted, bare] of token
      .slice(tag.length + 1, -1)
      .matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|([^\s]+)))?/g)) {
      const value = quoted ?? bare ?? '';
      element.setAttribute(name, value);
      if (['value', 'href', 'type'].includes(name)) element[name] = value;
      if (name === 'class') element.className = value;
      if (['hidden', 'disabled', 'open', 'inert'].includes(name)) element[name] = true;
    }
    stack.at(-1).append(element);
    if (tag === 'option' && element.hasAttribute('selected'))
      element.parentElement.value = element.value;
    if (!['meta', 'link', 'input', 'br', 'img', 'hr'].includes(tag)) stack.push(element);
  }
}

async function about(
  t,
  pageHref = 'https://example.test/revealline/releases/v0.60.8/site/site/about.html#versions',
) {
  const doc = new Document(),
    win = new Events(),
    callbacks = new Map(),
    requests = [],
    navigations = [],
    writes = [];
  mount(doc);
  let resolveArchive,
    resolvePacks,
    resolveBody,
    evaluation,
    bodyPending = false,
    nextFrame = 0,
    now = 0,
    reads = 0,
    pads = [];
  const archiveGate = new Promise((resolve) => (resolveArchive = resolve)),
    packsGate = new Promise((resolve) => (resolvePacks = resolve)),
    bodyGate = new Promise((resolve) => (resolveBody = resolve));
  const device = {
    index: 0,
    id: 'Modeled About controller',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  const location = { href: pageHref };
  win.location = location;
  const globals = {
    document: doc,
    window: win,
    location,
    navigator: {
      getGamepads: () => {
        reads++;
        return pads;
      },
    },
    localStorage: { getItem: () => null, setItem: (...values) => writes.push(values) },
    sessionStorage: { getItem: () => null, setItem: (...values) => writes.push(values) },
    requestAnimationFrame(callback) {
      callbacks.set(++nextFrame, callback);
      return nextFrame;
    },
    cancelAnimationFrame(id) {
      callbacks.delete(id);
    },
    Option: function (text, value, defaultSelected = false, selected = false) {
      const option = doc.createElement('option');
      option.textContent = text;
      option.value = value;
      option.defaultSelected = defaultSelected;
      option.selected = selected;
      return option;
    },
    fetch: async (url, options) => {
      const href = String(url);
      requests.push({ href, options });
      if (/\/releases\/index\.json$/.test(href)) return archiveGate;
      assert.match(href, /\/game\/content\/packs\/catalog\.json$/);
      return packsGate;
    },
  };
  const previous = Object.fromEntries(
    Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  t.after(async () => {
    win.emit('pagehide', { persisted: false });
    resolveArchive(new Response('', { status: 503 }));
    resolveBody(releases);
    resolvePacks(new Response('', { status: 503 }));
    if (evaluation) await evaluation;
    for (const [key, descriptor] of Object.entries(previous))
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
  });
  for (const anchor of doc.querySelectorAll('a'))
    anchor.addEventListener('click', (event) => {
      event.preventDefault();
      navigations.push(new URL(anchor.href, pageHref).href);
    });
  const $ = (id) => doc.getElementById(id),
    tick = () => {
      assert.ok(callbacks.size <= 1, 'Exactly one About animation loop may be scheduled.');
      const pending = [...callbacks.values()];
      callbacks.clear();
      now += 16;
      pending.forEach((callback) => callback(now));
    },
    setPad = (pressed = []) => {
      device.buttons = Array.from({ length: 17 }, (_, index) => ({
        pressed: pressed.includes(index),
        value: Number(pressed.includes(index)),
      }));
      pads = [device];
    },
    tap = (button) => {
      setPad();
      tick();
      setPad([button]);
      tick();
      setPad();
      tick();
    },
    walk = (element) => {
      for (let index = 0; index < 100 && doc.activeElement !== element; index++) tap(13);
      assert.equal(doc.activeElement, element, 'D-pad reaches the requested real control.');
    };
  const resolve = (fn, payload) =>
    fn(new Response(payload ? JSON.stringify(payload) : '', { status: payload ? 200 : 503 }));
  return {
    doc,
    win,
    $,
    navigations,
    writes,
    requests,
    tick,
    tap,
    walk,
    setPad,
    readCount: () => reads,
    pendingFrames: () => callbacks.size,
    bodyPending: () => bodyPending,
    releaseBody: () => resolveBody(releases),
    async start() {
      evaluation = import(`../../site/landing.mjs?about-navigation-host=${++serial}`);
      await until(() => requests.length > 0);
      assert.ok($('about-return'), 'The actual About page owns an explicit Return action.');
    },
    join() {
      setPad();
      tick();
      tap(0);
      assert.deepEqual(navigations, [], 'Joining is not activation of a page action.');
    },
    unplug() {
      pads = [];
      win.emit('gamepaddisconnected', { gamepad: device });
      tick();
    },
    archive(payload = releases, { holdBody = false } = {}) {
      if (!holdBody) return resolve(resolveArchive, payload);
      const response = new Response('', { status: 200 });
      response.json = () => {
        bodyPending = true;
        return bodyGate;
      };
      resolveArchive(response);
    },
    async finish(packPayload = null) {
      resolve(resolveArchive, releases);
      resolveBody(releases);
      resolve(resolvePacks, packPayload);
      await evaluation;
    },
    key(value) {
      const element = doc.activeElement,
        event = element.emit('keydown', { key: value });
      if (
        !event.defaultPrevented &&
        value === 'Enter' &&
        ['A', 'SUMMARY', 'BUTTON'].includes(element.tagName)
      )
        element.click();
      return event;
    },
  };
}

for (const [page, target] of [
  ['https://example.test/revealline/site/about.html', 'https://example.test/revealline/game/'],
  [
    'https://example.test/revealline/releases/v0.60.8/site/site/about.html#versions',
    'https://example.test/revealline/releases/v0.60.8/site/game/',
  ],
  [
    'https://mekhovov.github.io/revealline-archive-21/releases/v0.61.3/site/site/about.html',
    'https://mekhovov.github.io/revealline-archive-21/releases/v0.61.3/site/game/',
  ],
])
  test(`controller Return is ready before catalogue completion and stays in the same build: ${page}`, async (t) => {
    const h = await about(t, page);
    await h.start();
    assert.equal(h.requests.length, 1);
    assert.equal(h.$('about-return').getAttribute('href'), '../game/');
    if (page.includes('/revealline-archive-21/'))
      assert.equal(h.requests[0].href, 'https://mekhovov.github.io/revealline/releases/index.json');
    h.join();
    h.tap(1);
    assert.equal(h.doc.activeElement, h.$('about-return'));
    assert.deepEqual(h.navigations, [], 'Back focuses Return without navigating.');
    h.tap(0);
    assert.deepEqual(h.navigations, [target]);
    assert.deepEqual(h.writes, []);
  });

test('first controller join establishes visible Return focus before a later Confirm can activate it', async (t) => {
  const h = await about(t);
  await h.start();
  h.setPad();
  h.tick();
  assert.ok(h.doc.activeElement === h.doc.body, 'Neutral arrival is not a focus request.');
  h.setPad([0]);
  h.tick();
  assert.ok(h.doc.activeElement === h.$('about-return'), 'Return owns the active focus.');
  assert.ok(h.$('about-return').classList.contains('controller-focus'));
  h.tick();
  h.tick();
  assert.deepEqual(h.navigations, [], 'Joining and holding Confirm cannot activate Return.');
  h.setPad();
  h.tick();
  assert.ok(h.doc.activeElement === h.$('about-return'), 'Return owns the active focus.');
  assert.ok(h.$('about-return').classList.contains('controller-focus'));
  assert.deepEqual(h.navigations, [], 'Releasing the join keeps the visible selection inert.');
  h.tap(0);
  assert.deepEqual(h.navigations, ['https://example.test/revealline/releases/v0.60.8/site/game/']);
  assert.deepEqual(h.writes, []);
});

test('controller join marks a previously focused disclosure without changing or activating it', async (t) => {
  const h = await about(t);
  await h.start();
  const summary = h.$('versions').querySelector('summary');
  summary.focus();
  h.setPad();
  h.tick();
  h.setPad([0]);
  h.tick();
  assert.ok(h.doc.activeElement === summary, 'The previously focused summary keeps focus.');
  assert.ok(summary.classList.contains('controller-focus'));
  assert.equal(h.$('about-return').classList.contains('controller-focus'), false);
  h.tick();
  h.setPad();
  h.tick();
  assert.ok(h.doc.activeElement === summary, 'The previously focused summary keeps focus.');
  assert.equal(h.$('versions').open, false, 'Join, hold and release do not toggle disclosure.');
  assert.deepEqual(h.navigations, []);
  h.tap(0);
  assert.equal(h.$('versions').open, true, 'Only a subsequent Confirm activates its selection.');
  assert.deepEqual(h.writes, []);
});

test('held arrival Confirm waits for neutral and join before any page action', async (t) => {
  const h = await about(t);
  h.setPad([0]);
  await h.start();
  h.tick();
  h.tick();
  assert.ok(h.doc.activeElement === h.doc.body, 'Held arrival has not joined or claimed focus.');
  assert.deepEqual(h.navigations, []);
  assert.equal(h.$('versions').open, false);
  h.join();
  assert.ok(h.doc.activeElement === h.$('about-return'), 'Return owns the active focus.');
  assert.ok(h.$('about-return').classList.contains('controller-focus'));
  assert.deepEqual(h.navigations, []);
  h.tap(1);
  assert.ok(h.doc.activeElement === h.$('about-return'), 'Return owns the active focus.');
});

test('D-pad and Confirm operate the real disclosure and preserved-build select without automatic navigation', async (t) => {
  const h = await about(t);
  await h.start();
  h.join();
  const summary = h.$('versions').querySelector('summary');
  h.walk(summary);
  h.tap(0);
  assert.equal(h.$('versions').open, true);
  h.archive();
  await h.finish();
  const picker = h.$('version-picker'),
    original = picker.value;
  h.walk(picker);
  const pageStatus = h.$('about-navigation-status'),
    statusText = Object.getOwnPropertyDescriptor(Element.prototype, 'textContent');
  let pageAnnouncements = 0;
  Object.defineProperty(pageStatus, 'textContent', {
    configurable: true,
    get() {
      return statusText.get.call(this);
    },
    set(value) {
      pageAnnouncements++;
      statusText.set.call(this, value);
    },
  });
  h.tap(0);
  assert.equal(picker.getAttribute('data-controller-editing'), 'true');
  const preview = h.doc.querySelector('.controller-editor'),
    initialPreview = preview.textContent;
  assert.equal(preview.getAttribute('role'), 'status');
  h.tap(13);
  assert.notEqual(
    preview.textContent,
    initialPreview,
    'The local live preview announces the changed draft.',
  );
  assert.equal(
    pageAnnouncements,
    0,
    'Draft announcements are not duplicated in the page navigation status.',
  );
  assert.equal(picker.value, original, 'The select draft has not committed.');
  assert.equal(h.$('version-play').href, '../game/');
  h.tap(1);
  assert.equal(picker.getAttribute('data-controller-editing'), null);
  assert.equal(picker.value, original);
  assert.equal(h.doc.activeElement, picker, 'Edit Back does not run page Back.');
  h.tap(0);
  h.tap(13);
  h.tap(0);
  assert.equal(picker.value, picker.options[1].value);
  assert.equal(h.$('version-play').href, picker.value);
  assert.deepEqual(h.navigations, []);
  h.walk(h.$('version-play'));
  h.tap(0);
  assert.deepEqual(h.navigations, [picker.value]);
  assert.deepEqual(h.writes, []);
});

test('late preserved-build options retire an active edit without moving focus or applying it', async (t) => {
  const h = await about(t);
  await h.start();
  h.join();
  h.walk(h.$('versions').querySelector('summary'));
  h.tap(0);
  const picker = h.$('version-picker');
  h.walk(picker);
  h.tap(0);
  assert.equal(picker.getAttribute('data-controller-editing'), 'true');
  h.archive();
  await h.finish();
  h.tick();
  assert.equal(picker.getAttribute('data-controller-editing'), null);
  assert.equal(h.doc.activeElement, picker);
  assert.equal(picker.value, '../game/');
  assert.equal(h.$('version-play').href, '../game/');
  assert.deepEqual(h.navigations, []);
});

test('actual pack catalogue replacement retires its stale select edit and preserves explicit play', async (t) => {
  const h = await about(t);
  await h.start();
  h.join();
  h.archive();
  await until(() => h.requests.length === 2);
  const picker = h.$('landing-pack-select');
  h.walk(picker);
  h.tap(0);
  assert.equal(picker.getAttribute('data-controller-editing'), 'true');
  await h.finish(packCatalog);
  h.tick();
  assert.ok(
    picker.options.length > 1,
    'Actual catalogue preparation replaced the starter choices.',
  );
  assert.equal(picker.getAttribute('data-controller-editing'), null);
  assert.equal(h.doc.activeElement, picker);
  assert.deepEqual(h.navigations, []);
  assert.deepEqual(h.writes, []);
});

test('catalogue failure retains Return, disclosure and current-build actions', async (t) => {
  const h = await about(t);
  await h.start();
  h.archive(null);
  await h.finish();
  assert.match(h.$('version-status').textContent, /current build is ready/);
  h.join();
  h.walk(h.$('versions').querySelector('summary'));
  h.tap(0);
  h.walk(h.$('version-play'));
  assert.equal(h.$('version-play').href, '../game/');
  h.tap(1);
  assert.equal(h.doc.activeElement, h.$('about-return'));
  assert.deepEqual(h.navigations, []);
});

test('catalogue completion keeps a deliberately focused Return and its operation status', async (t) => {
  const h = await about(t);
  await h.start();
  h.$('about-return').focus();
  const focus = h.doc.activeElement;
  h.archive();
  await h.finish();
  h.tick();
  assert.equal(h.doc.activeElement, focus);
  assert.match(h.$('version-status').textContent, /2 preserved builds/);
  assert.deepEqual(h.navigations, []);
});

test('native Tab, select arrows and disclosure activation retain defaults; Escape cancels before page Back', async (t) => {
  const h = await about(t);
  await h.start();
  const summary = h.$('versions').querySelector('summary');
  summary.focus();
  assert.equal(h.key('Tab').defaultPrevented, false);
  assert.equal(h.key('Enter').defaultPrevented, false);
  assert.equal(h.$('versions').open, true);
  const picker = h.$('version-picker');
  picker.focus();
  assert.equal(h.key('ArrowDown').defaultPrevented, false);
  assert.equal(h.key('Escape').defaultPrevented, false);
  assert.equal(
    h.doc.activeElement,
    picker,
    'Native select cancellation keeps its browser default.',
  );
  h.join();
  h.walk(picker);
  h.tap(0);
  assert.equal(picker.getAttribute('data-controller-editing'), 'true');
  assert.equal(h.key('Escape').defaultPrevented, true);
  assert.equal(picker.getAttribute('data-controller-editing'), null);
  assert.equal(h.doc.activeElement, picker, 'The first Escape cancels only the controller edit.');
  assert.equal(h.key('Escape').defaultPrevented, false);
  assert.equal(
    h.doc.activeElement,
    picker,
    'After controller editing ends, Escape belongs to the native select.',
  );
  summary.focus();
  assert.equal(h.key('Escape').defaultPrevented, true);
  assert.equal(h.doc.activeElement, h.$('about-return'));
  assert.deepEqual(h.navigations, []);
});

for (const input of ['keyboard', 'pointer'])
  test(`${input} intent retires a controller select draft without committing it`, async (t) => {
    const h = await about(t);
    await h.start();
    h.archive();
    await h.finish();
    h.join();
    h.walk(h.$('versions').querySelector('summary'));
    h.tap(0);
    const picker = h.$('version-picker');
    h.walk(picker);
    h.tap(0);
    h.tap(13);
    assert.equal(picker.getAttribute('data-controller-editing'), 'true');
    if (input === 'keyboard') h.key('Tab');
    else h.$('about-return').emit('pointerdown');
    assert.equal(picker.getAttribute('data-controller-editing'), null);
    assert.equal(picker.value, '../game/');
    assert.equal(h.$('version-play').href, '../game/');
    assert.deepEqual(h.navigations, []);
  });

for (const lifecycle of ['blur', 'hidden', 'persisted pagehide'])
  test(`${lifecycle} clears edit/input and restoration requires neutral without a duplicate loop`, async (t) => {
    const h = await about(t);
    await h.start();
    h.archive();
    await h.finish();
    h.join();
    h.walk(h.$('versions').querySelector('summary'));
    h.tap(0);
    h.walk(h.$('version-picker'));
    h.tap(0);
    h.tap(13);
    if (lifecycle === 'blur') {
      h.doc.focused = false;
      h.win.emit('blur');
    } else if (lifecycle === 'hidden') {
      h.doc.hidden = true;
      h.doc.emit('visibilitychange');
    } else h.win.emit('pagehide', { persisted: true });
    assert.equal(h.$('version-picker').getAttribute('data-controller-editing'), null);
    const reads = h.readCount();
    h.setPad([0]);
    h.tick();
    assert.equal(h.readCount(), reads, 'Inactive pages do not sample the controller.');
    if (lifecycle === 'blur') {
      h.doc.focused = true;
      h.win.emit('focus');
    } else if (lifecycle === 'hidden') {
      h.doc.hidden = false;
      h.doc.emit('visibilitychange');
    } else h.win.emit('pageshow', { persisted: true });
    h.win.emit('focus');
    h.win.emit('pageshow', { persisted: true });
    h.tick();
    h.tick();
    assert.equal(h.pendingFrames(), 1);
    assert.equal(h.$('version-picker').value, '../game/');
    assert.equal(h.$('version-picker').getAttribute('data-controller-editing'), null);
    assert.deepEqual(h.navigations, [], 'Held Confirm after return is inert.');
    h.setPad();
    h.tick();
    h.tap(1);
    assert.equal(h.doc.activeElement, h.$('about-return'));
  });

test('persisted departure during loading may complete catalogues without reviving focus or polling', async (t) => {
  const h = await about(t);
  await h.start();
  h.$('about-return').focus();
  h.win.emit('pagehide', { persisted: true });
  h.archive();
  await h.finish();
  assert.equal(h.pendingFrames(), 0);
  assert.equal(h.doc.activeElement, h.$('about-return'));
  assert.deepEqual(h.navigations, []);
  h.setPad([0]);
  h.win.emit('pageshow', { persisted: true });
  h.tick();
  assert.deepEqual(h.navigations, []);
  assert.equal(h.pendingFrames(), 1);
});

for (const boundary of ['headers', 'body', 'packs'])
  test(`terminal departure before ${boundary} completion prevents late updates and owner restart`, async (t) => {
    const h = await about(t);
    await h.start();
    if (boundary === 'body') {
      h.archive(releases, { holdBody: true });
      await until(h.bodyPending);
    } else if (boundary === 'packs') {
      h.archive();
      await until(() => h.requests.length === 2);
    }
    const before = {
      version: h.$('version-status').textContent,
      pack: h.$('landing-pack-status').textContent,
      options: h.$('version-picker').options.length,
    };
    h.win.emit('pagehide', { persisted: false });
    await h.finish(packCatalog);
    h.win.emit('pageshow', { persisted: true });
    h.win.emit('focus');
    h.doc.emit('visibilitychange');
    h.tick();
    assert.equal(h.pendingFrames(), 0);
    assert.equal(h.$('version-status').textContent, before.version);
    assert.equal(h.$('landing-pack-status').textContent, before.pack);
    assert.equal(h.$('version-picker').options.length, before.options);
    assert.deepEqual(h.navigations, []);
    assert.deepEqual(h.writes, []);
    for (const target of [h.doc, h.win])
      for (const listeners of [target.listeners, target.captureListeners])
        assert.equal(
          [...listeners.values()].reduce((count, handlers) => count + handlers.size, 0),
          0,
          'Terminal cleanup removes the About owner and shared input listeners.',
        );
  });

test('disconnect retires edits and reconnect requires neutral and a fresh join', async (t) => {
  const h = await about(t);
  await h.start();
  h.join();
  h.walk(h.$('versions').querySelector('summary'));
  h.tap(0);
  h.walk(h.$('version-picker'));
  h.tap(0);
  h.unplug();
  assert.equal(h.$('version-picker').getAttribute('data-controller-editing'), null);
  h.setPad([0]);
  h.tick();
  h.tick();
  assert.deepEqual(h.navigations, []);
  h.join();
  h.tap(1);
  assert.equal(h.doc.activeElement, h.$('about-return'));
});

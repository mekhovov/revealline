import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { Document, Events } from './helpers/couch-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { DISPLAY_PREFERENCES_KEY } from '../display-preferences.mjs';

const NativeURL = URL;
const repository = new NativeURL('../../', import.meta.url);
const origin = 'https://authoring.test/';
const registerBytes = readFileSync(new NativeURL('authoring/production/register.json', repository));
const register = JSON.parse(registerBytes);
const work = register.works[0];
const picture = work.files.find((file) => file.role === 'original');
const pictureBytes = readFileSync(new NativeURL(picture.file.path, repository));
const defaults = { textFace: 'pixel', textSize: 'standard', reducedEffects: false };
const encode = (patch = {}) => JSON.stringify({ ...defaults, ...patch });
let serial = 0;

function deferred() {
  let resolve;
  const promise = new Promise((yes) => (resolve = yes));
  return { promise, resolve };
}
const until = (predicate, message) => waitFor(predicate, { message });
const settle = async () => {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
};

// Parse the actual host markup. Native layout, image decoding and frame loading
// are modeled; application entries, shared authority, register and panel stay real.
function mountMarkup(doc, html) {
  const stack = [doc.body];
  for (const [token] of html
    .split(/<body\b[^>]*>/u)[1]
    .split('</body>')[0]
    .matchAll(/<\/?[^>]+>|[^<]+/g)) {
    if (token.startsWith('</')) {
      stack.pop();
      continue;
    }
    if (!token.startsWith('<')) {
      const parent = stack.at(-1);
      parent._text = (parent._text || '') + token.trim();
      continue;
    }
    const tag = token.match(/^<([\w-]+)/)[1],
      node = doc.createElement(tag);
    for (const [, name, quoted, bare] of token
      .slice(tag.length + 1, -1)
      .matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|([^\s]+)))?/g)) {
      const value = quoted ?? bare ?? '';
      node.setAttribute(name, value);
      if (['type', 'value', 'width', 'height', 'src'].includes(name)) node[name] = value;
      if (name === 'class') node.className = value;
      if (['hidden', 'disabled', 'checked', 'inert', 'open'].includes(name)) node[name] = true;
    }
    stack.at(-1).append(node);
    if (tag === 'option' && node.hasAttribute('selected')) node.parentElement.value = node.value;
    if (!['meta', 'link', 'input', 'br', 'img', 'hr'].includes(tag)) stack.push(node);
  }
}

async function harness(
  t,
  route,
  {
    stored = encode(),
    reduced = false,
    denied = false,
    holdRegister = false,
    startApplication = true,
  } = {},
) {
  const doc = new Document(),
    win = new Events(),
    media = Object.assign(new Events(), { matches: reduced }),
    requests = [],
    decoded = [],
    allocated = [],
    released = [],
    reads = [],
    writes = [],
    registerGate = deferred();
  let raw = stored,
    unavailable = denied,
    frameSourceWrites = 0;
  win.location = { href: `${origin}authoring/${route}/` };
  win.matchMedia = function (query) {
    assert.equal(this, win);
    assert.equal(query, '(prefers-reduced-motion: reduce)');
    return media;
  };
  const storage = {
    getItem(key) {
      reads.push(key);
      assert.equal(key, DISPLAY_PREFERENCES_KEY, 'This host only reads the shared display record.');
      if (unavailable) throw new Error('Storage denied');
      return raw;
    },
    setItem(key, value) {
      writes.push([key, value]);
      throw new Error('Read-only authoring hosts must never save preferences or game data.');
    },
  };
  win.localStorage = storage;
  Object.assign(win, doc.defaultView);
  doc.defaultView = win;
  const html = readFileSync(new NativeURL(`authoring/${route}/index.html`, repository), 'utf8');
  mountMarkup(doc, html);
  const scripts = [...html.matchAll(/<script\b([^>]*)>/gu)].map((match) => {
    const attributes = Object.fromEntries(
      [...match[1].matchAll(/([^\s=]+)\s*=\s*"([^"]*)"/gu)].map((value) => [value[1], value[2]]),
    );
    return { attributes, offset: match.index };
  });
  const displayScripts = scripts.filter((script) =>
      script.attributes.src?.endsWith('/host-display-entry.mjs'),
    ),
    displayScript = displayScripts[0],
    appScript = scripts.find((script) =>
      (script.attributes['data-module'] ?? script.attributes.src)?.endsWith('browser.mjs'),
    );
  assert.ok(appScript, 'Actual HTML supplies the application entry.');
  if (displayScript) {
    assert.equal(displayScript.attributes.type, 'module');
    assert.ok(
      displayScript.offset < appScript.offset,
      'Display is mounted before the application loader.',
    );
  }
  const documentURL = new NativeURL(`authoring/${route}/index.html`, repository),
    displayEntryURL = displayScript
      ? new NativeURL(displayScript.attributes.src, documentURL)
      : null,
    appEntryURL = new NativeURL(
      appScript.attributes['data-module'] ?? appScript.attributes.src,
      documentURL,
    );
  const $ = (id) => doc.getElementById(id);
  const frame = $('game-frame');
  if (frame) {
    let src = frame.src || '';
    Object.defineProperty(frame, 'src', {
      configurable: true,
      get: () => src,
      set(value) {
        src = value;
        frameSourceWrites++;
      },
    });
  }
  const createElement = doc.createElement.bind(doc);
  doc.createElement = (tag) => {
    const node = createElement(tag);
    if (tag === 'img') {
      const gate = deferred();
      node.naturalWidth = picture.width;
      node.naturalHeight = picture.height;
      node.decode = () => {
        decoded.push({ node, gate });
        return gate.promise;
      };
    }
    return node;
  };
  // Node imports have file: metadata. Rebase only this captured repository's
  // resource URLs to its modeled served origin; retain the real URL parser and
  // sourceURL same-origin/path validation. No application source is rewritten.
  class HostedURL extends NativeURL {
    constructor(value, base) {
      const url = new NativeURL(value, base);
      super(
        url.href.startsWith(repository.href)
          ? new NativeURL(url.href.slice(repository.href.length), origin).href
          : url.href,
      );
    }
    static createObjectURL() {
      const value = `blob:authoring-test-${allocated.length + 1}`;
      allocated.push(value);
      return value;
    }
    static revokeObjectURL(value) {
      released.push(value);
    }
  }
  const globals = {
    document: doc,
    window: win,
    URL: HostedURL,
    crypto: webcrypto,
    localStorage: new Proxy(
      {},
      {
        get() {
          throw new Error('Use the owning window, not global storage.');
        },
      },
    ),
    fetch: async (url, options) => {
      requests.push({ url: String(url), signal: options.signal, display: { ...doc.body.dataset } });
      if (String(url) === `${origin}authoring/production/register.json`) {
        if (holdRegister) await registerGate.promise;
        return new Response(registerBytes);
      }
      if (String(url) === `${origin}${picture.file.path}`) return new Response(pictureBytes);
      throw new Error(`Unexpected host request: ${url}`);
    },
  };
  const previous = new Map();
  for (const [key, value] of Object.entries(globals)) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  t.after(async () => {
    win.emit('pagehide', { persisted: false });
    registerGate.resolve();
    for (const entry of decoded) entry.gate.resolve();
    await settle();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  // Missing adoption in the original HTML must reach the real application,
  // so its functional cases fail on display state rather than a missing tag.
  if (displayEntryURL) await import(`${displayEntryURL.href}?display-host=${++serial}`);
  let applicationStarted = false;
  const loadApplication = async ({ fail = false } = {}) => {
    assert.equal(applicationStarted, false, 'The application module has one loader owner.');
    applicationStarted = true;
    // Model the browser's independent module-loader boundary. Rejection here
    // means no application evaluation; this is not a native networking claim.
    if (fail) throw new Error('Modeled application dependency graph unavailable.');
    await import(`${appEntryURL.href}?display-host=${++serial}`);
  };
  if (startApplication) await loadApplication();
  return {
    doc,
    win,
    media,
    $,
    requests,
    decoded,
    allocated,
    released,
    reads,
    writes,
    loadApplication,
    displayEntryCount: displayScripts.length,
    displayEntryBeforeApplication: !!displayScript && displayScript.offset < appScript.offset,
    frameSourceWrites: () => frameSourceWrites,
    allowStorage: () => {
      unavailable = false;
    },
    releaseRegister: () => registerGate.resolve(),
    setStored(value) {
      raw = value;
    },
    share(patch) {
      raw = encode(patch);
      win.emit('storage', { key: DISPLAY_PREFERENCES_KEY, storageArea: storage, newValue: raw });
    },
    motion(value) {
      media.matches = value;
      media.emit('change');
    },
  };
}
const display = (h) => ({
  textFace: h.doc.body.dataset.textFace,
  textSize: h.doc.body.dataset.textSize,
  effects: h.doc.body.dataset.effects,
});
const button = (root, label) => {
  const node = root.querySelectorAll('button').find((candidate) => candidate._text === label);
  assert.ok(node, `Button is available: ${label}`);
  return node;
};
async function productionReady(h) {
  await until(
    () => h.$('production-panel').querySelector('tbody').children.length > 0,
    'register loaded',
  );
}
function openPicture(h) {
  const root = h.$('production-panel'),
    search = root.querySelector('input[aria-label="Find a slot or work"]');
  search.value = work.title;
  search.emit('input');
  const row = button(root, work.title);
  row.click();
  return { root, search, row, detail: h.$('production-detail') };
}
function viewportState(h) {
  return {
    target: h.$('target').value,
    preset: h.$('preset').value,
    source: h.$('game-frame').src,
    width: h.$('game-frame').width,
    height: h.$('game-frame').height,
    hidden: h.$('game-frame').hidden,
    empty: h.$('empty-preview').hidden,
    loaded: h.$('loaded-target').textContent,
    dimensions: h.$('dimensions').value,
    status: h.$('status').textContent,
    action: h.$('load-target').textContent,
    disabled: h.$('load-target').disabled,
    direct: h.$('direct-open').href,
    sourceWrites: h.frameSourceWrites(),
  };
}

test('Production adopts saved text and the effective system cap before its held register read, without writes', async (t) => {
  const h = await harness(t, 'production', {
    stored: encode({ textFace: 'plain', textSize: 'large' }),
    reduced: true,
    holdRegister: true,
  });
  const expected = { textFace: 'plain', textSize: 'large', effects: 'reduced' };
  assert.deepEqual(display(h), expected);
  assert.deepEqual(h.requests[0].display, expected, 'Preference adoption precedes expensive work.');
  assert.equal(h.$('production-panel').querySelector('tbody').children.length, 0);
  assert.equal(h.$('snapshot-baseline').getAttribute('aria-current'), 'page');
  h.share({ textFace: 'pixel', textSize: 'standard' });
  assert.deepEqual(display(h), { textFace: 'pixel', textSize: 'standard', effects: 'reduced' });
  h.motion(false);
  assert.equal(display(h).effects, 'full');
  h.releaseRegister();
  await productionReady(h);
  assert.equal(h.requests.length, 1);
  assert.deepEqual(h.writes, []);
});

test('Production live preferences preserve filter, detail focus, pending decode and the exact loaded preview owner', async (t) => {
  const h = await harness(t, 'production');
  await productionReady(h);
  const { root, search, row, detail } = openPicture(h),
    heading = detail.querySelector('h2'),
    preview = button(detail, 'Preview original');
  preview.focus();
  preview.click();
  await until(() => h.decoded.length === 1, 'real bytes verified and native decode requested');
  const request = h.requests.at(-1),
    image = h.decoded[0].node;
  h.share({ textFace: 'plain', textSize: 'large', reducedEffects: true });
  assert.deepEqual(display(h), { textFace: 'plain', textSize: 'large', effects: 'reduced' });
  assert.ok(h.doc.activeElement === preview, 'Preference adoption keeps the operated button.');
  assert.ok(root.querySelector('input[aria-label="Find a slot or work"]') === search);
  assert.ok(h.$('production-detail') === detail && detail.querySelector('h2') === heading);
  assert.equal(search.value, work.title);
  assert.equal(detail.hidden, false);
  assert.equal(request.signal.aborted, false, 'Font choice does not cancel image ownership.');
  assert.equal(h.decoded.length, 1);
  assert.equal(h.allocated.length, 1);
  assert.equal(h.released.length, 0);
  h.decoded[0].gate.resolve();
  await until(() => image.isConnected, 'same prepared image adopted');
  h.share({ textFace: 'pixel' });
  h.motion(true);
  assert.ok(detail.querySelector('img') === image, 'Loaded image is not decoded or replaced.');
  assert.equal(h.requests.length, 2);
  assert.equal(h.decoded.length, 1);
  assert.equal(h.released.length, 0);
  assert.equal(search.value, work.title);
  button(detail, 'Back to slots').click();
  assert.ok(h.doc.activeElement === row, 'Existing Back still restores the exact list row.');
  assert.equal(h.released.length, 1);
  assert.deepEqual(h.writes, []);
});

test('Production cached lifecycle keeps its display owner but preserves existing preview cancellation and terminal cleanup', async (t) => {
  const h = await harness(t, 'production');
  await productionReady(h);
  const { search, detail } = openPicture(h);
  button(detail, 'Preview original').click();
  await until(() => h.decoded.length === 1, 'decode pending');
  const image = h.decoded[0].node,
    request = h.requests.at(-1);
  h.win.emit('pagehide', { persisted: true });
  assert.equal(request.signal.aborted, true, 'The existing panel still cancels work on pagehide.');
  h.setStored(encode({ textFace: 'plain', textSize: 'large' }));
  h.media.matches = true;
  h.win.emit('pageshow', { persisted: true });
  assert.deepEqual(display(h), { textFace: 'plain', textSize: 'large', effects: 'reduced' });
  assert.equal(search.value, work.title);
  assert.ok(h.$('production-detail') === detail);
  h.decoded[0].gate.resolve();
  await settle();
  assert.equal(image.isConnected, false, 'Late decode cannot revive the cancelled preview.');
  assert.equal(h.released.length, 1);
  assert.equal(h.requests.length, 2);
  assert.equal(h.win.listeners.get('storage').size, 1);
  assert.equal(h.media.listeners.get('change').size, 1);
  h.win.emit('pageshow', { persisted: true });
  assert.equal(h.win.listeners.get('storage').size, 1, 'Cached return does not remount the owner.');
  h.win.emit('pagehide', { persisted: false });
  const before = display(h);
  h.share({ textFace: 'pixel' });
  h.motion(false);
  h.win.emit('pageshow', { persisted: true });
  assert.deepEqual(display(h), before);
  assert.equal(h.win.listeners.get('storage').size, 0);
  assert.equal(h.win.listeners.get('pageshow').size, 0);
  assert.equal(h.media.listeners.get('change').size, 0);
  assert.deepEqual(h.writes, []);
});

test('Viewport adopts saved host preferences without loading a game or altering a pending selection', async (t) => {
  const h = await harness(t, 'viewport-lab', {
    stored: encode({ textFace: 'plain', textSize: 'large' }),
    reduced: true,
  });
  assert.deepEqual(display(h), { textFace: 'plain', textSize: 'large', effects: 'reduced' });
  assert.equal(h.frameSourceWrites(), 0);
  h.$('target').value = 'solo';
  h.$('target').emit('change');
  h.$('target').focus();
  const before = viewportState(h),
    frame = h.$('game-frame');
  h.share({ textFace: 'pixel' });
  h.motion(false);
  assert.deepEqual(display(h), { textFace: 'pixel', textSize: 'standard', effects: 'full' });
  assert.deepEqual(viewportState(h), before);
  assert.ok(h.$('game-frame') === frame && h.doc.activeElement === h.$('target'));
  assert.equal(h.requests.length, 0);
  assert.deepEqual(h.writes, []);
});

test('Viewport reading changes keep the loaded frame, pending replacement, dimensions and input focus intact', async (t) => {
  const h = await harness(t, 'viewport-lab');
  h.$('target-form').emit('submit');
  h.$('preset').value = '390x844';
  h.$('preset').emit('change');
  h.$('target').value = 'solo';
  h.$('target').emit('change');
  h.$('preset').focus();
  const frame = h.$('game-frame'),
    before = viewportState(h);
  assert.equal(before.source, '../../game/couch/');
  assert.equal(before.width, '390');
  assert.equal(before.height, '844');
  assert.equal(before.sourceWrites, 1);
  assert.match(before.status, /Couch remains loaded/);
  h.share({ textFace: 'plain', textSize: 'large', reducedEffects: true });
  h.motion(true);
  h.motion(false);
  assert.deepEqual(display(h), { textFace: 'plain', textSize: 'large', effects: 'reduced' });
  assert.deepEqual(viewportState(h), before);
  assert.ok(h.$('game-frame') === frame && h.doc.activeElement === h.$('preset'));
  h.$('load-target').focus();
  h.$('target-form').emit('submit');
  assert.equal(frame.src, '../../game/');
  assert.equal(h.frameSourceWrites(), 2, 'Only explicit Load replaces the target.');
  assert.ok(h.doc.activeElement === h.$('target'), 'Existing Load focus handoff still works.');
  const loaded = viewportState(h);
  h.share({ textFace: 'pixel' });
  assert.deepEqual(viewportState(h), loaded);
  assert.ok(h.$('game-frame') === frame);
  assert.deepEqual(h.writes, []);
});

test('Viewport persisted return adopts missed shared/system changes without frame reload and terminal exit retires ownership', async (t) => {
  const h = await harness(t, 'viewport-lab');
  h.$('target-form').emit('submit');
  h.$('preset').value = '844x390';
  h.$('preset').emit('change');
  const before = viewportState(h),
    frame = h.$('game-frame');
  h.win.emit('pagehide', { persisted: true });
  h.setStored(encode({ textFace: 'plain', textSize: 'large' }));
  h.media.matches = true;
  h.win.emit('pageshow', { persisted: true });
  assert.deepEqual(display(h), { textFace: 'plain', textSize: 'large', effects: 'reduced' });
  assert.deepEqual(viewportState(h), before);
  assert.ok(h.$('game-frame') === frame);
  assert.equal(h.win.listeners.get('storage').size, 1);
  assert.equal(h.win.listeners.get('pageshow').size, 1);
  h.win.emit('pagehide', { persisted: false });
  h.share({ textFace: 'pixel' });
  h.motion(false);
  h.win.emit('pageshow', { persisted: true });
  assert.deepEqual(display(h), { textFace: 'plain', textSize: 'large', effects: 'reduced' });
  assert.deepEqual(viewportState(h), before);
  assert.equal(h.win.listeners.get('storage').size, 0);
  assert.equal(h.win.listeners.get('pageshow').size, 0);
  assert.equal(h.media.listeners.get('change').size, 0);
  assert.deepEqual(h.writes, []);
});

for (const route of ['production', 'viewport-lab']) {
  for (const failure of ['denied', 'malformed']) {
    test(`${route}: ${failure} storage retains a usable host, system reduction and later valid shared adoption`, async (t) => {
      const h = await harness(t, route, {
        stored: failure === 'malformed' ? '{broken' : encode({ textFace: 'plain' }),
        denied: failure === 'denied',
        reduced: true,
      });
      assert.deepEqual(display(h), { textFace: 'pixel', textSize: 'standard', effects: 'reduced' });
      if (route === 'production') {
        await productionReady(h);
        const { detail, search } = openPicture(h);
        assert.equal(detail.hidden, false);
        assert.equal(search.value, work.title);
      } else {
        h.$('target').value = 'solo';
        h.$('target').emit('change');
        h.$('target-form').emit('submit');
        assert.equal(h.$('game-frame').src, '../../game/');
        assert.equal(h.frameSourceWrites(), 1);
      }
      h.allowStorage();
      h.share({ textFace: 'plain', textSize: 'large' });
      assert.deepEqual(display(h), { textFace: 'plain', textSize: 'large', effects: 'reduced' });
      h.motion(false);
      assert.equal(display(h).effects, 'full');
      assert.ok(h.reads.length > 0 && h.reads.every((key) => key === DISPLAY_PREFERENCES_KEY));
      assert.deepEqual(h.writes, []);
    });
  }
}

for (const route of ['production', 'viewport-lab']) {
  test(`${route}: independent HTML display entry survives a held then rejected application-module loader`, async (t) => {
    const h = await harness(t, route, {
      stored: encode({ textFace: 'plain', textSize: 'large' }),
      reduced: true,
      startApplication: false,
    });
    assert.equal(
      h.displayEntryCount,
      1,
      'The actual host HTML owns one independent display entry.',
    );
    assert.equal(h.displayEntryBeforeApplication, true);
    assert.deepEqual(display(h), { textFace: 'plain', textSize: 'large', effects: 'reduced' });
    assert.equal(h.requests.length, 0, 'The application graph has not evaluated.');
    assert.equal(h.frameSourceWrites(), 0);
    const staticContent = h.doc.body.textContent;
    h.share({ textFace: 'pixel', textSize: 'standard' });
    h.motion(false);
    assert.deepEqual(display(h), { textFace: 'pixel', textSize: 'standard', effects: 'full' });
    assert.equal(h.doc.body.textContent, staticContent, 'Host adoption keeps the fallback markup.');
    await assert.rejects(h.loadApplication({ fail: true }), /dependency graph unavailable/);
    h.share({ textFace: 'plain', textSize: 'large' });
    assert.deepEqual(display(h), { textFace: 'plain', textSize: 'large', effects: 'full' });
    assert.equal(h.doc.body.textContent, staticContent);
    assert.equal(h.requests.length, 0);
    assert.equal(h.win.listeners.get('storage').size, 1);
    assert.equal(h.media.listeners.get('change').size, 1);
    h.win.emit('pagehide', { persisted: false });
    h.share({ textFace: 'pixel' });
    h.motion(true);
    assert.deepEqual(display(h), { textFace: 'plain', textSize: 'large', effects: 'full' });
    assert.equal(h.win.listeners.get('storage').size, 0);
    assert.equal(h.media.listeners.get('change').size, 0);
    assert.deepEqual(h.writes, []);
  });
}

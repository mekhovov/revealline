import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { Document, Element, Events } from './helpers/couch-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { DISPLAY_PREFERENCES_KEY } from '../display-preferences.mjs';
import { applyFieldKitCopy } from '../ui/field-kit-copy.mjs';
import { CONTROLLER_PREVIEW_STATUS_FORMAT } from '../ui/controller-preview.mjs';
import { editorCellFromPointer } from '../playground/board-view.mjs';

const defaults = { textFace: 'pixel', textSize: 'standard', reducedEffects: false };
const encode = (patch = {}) => JSON.stringify({ ...defaults, ...patch });
let serial = 0;
function deferred() {
  let resolve;
  const result = { settled: false };
  result.promise = new Promise((yes) => (resolve = yes));
  result.resolve = () => {
    result.settled = true;
    resolve();
  };
  return result;
}

class ToolElement extends Element {
  get src() {
    return this.getAttribute('src') ?? '';
  }
  set src(value) {
    this.sourceWrites = (this.sourceWrites ?? 0) + 1;
    this.setAttribute('src', value);
  }
  get href() {
    return this.getAttribute('href') ?? '';
  }
  set href(value) {
    this.setAttribute('href', value);
  }
  emit(type, extra = {}) {
    // The host helper does not model currentTarget. Native change events do.
    return super.emit(type, { currentTarget: this, ...extra });
  }
  getContext() {
    this.paintCalls ??= [];
    return (this.context ??= new Proxy(
      { canvas: this },
      {
        get: (target, key) =>
          key in target
            ? target[key]
            : (...args) => {
                assert.ok(args.filter((arg) => typeof arg === 'number').every(Number.isFinite));
                this.paintCalls.push({ op: key, args });
              },
        set: (target, key, value) => {
          target[key] = value;
          this.paintCalls.push({ property: key, value });
          return true;
        },
      },
    ));
  }
}
class ToolDocument extends Document {
  createElement(tag) {
    return new ToolElement(this, tag, { clientWidth: 1280 });
  }
}
function attributes(node, source) {
  for (const [, name, quoted, bare] of source.matchAll(
    /([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|([^\s]+)))?/g,
  )) {
    const value = quoted ?? bare ?? '';
    node.setAttribute(name, value);
    if (name === 'class') node.className = value;
    if (name.startsWith('data-'))
      node.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
    if (['type', 'value', 'width', 'height', 'src'].includes(name)) node[name] = value;
    if (['hidden', 'disabled', 'checked', 'inert', 'open'].includes(name)) node[name] = true;
  }
}
function mountMarkup(doc, html) {
  attributes(doc.body, html.match(/<body\b([^>]*)>/)[1]);
  const stack = [doc.body];
  for (const [token] of html
    .match(/<body[^>]*>([\s\S]*)<\/body>/)[1]
    .matchAll(/<!--[\s\S]*?-->|<\/?[^>]+>|[^<]+/g)) {
    if (token.startsWith('<!--')) continue;
    if (token.startsWith('</')) {
      stack.pop();
      continue;
    }
    if (!token.startsWith('<')) {
      stack.at(-1)._text += token.trim();
      continue;
    }
    const tag = token.match(/^<([\w-]+)/)[1],
      node = doc.createElement(tag);
    attributes(node, token.slice(tag.length + 1, -1));
    stack.at(-1).append(node);
    if (tag === 'option' && node.hasAttribute('selected')) node.parentElement.value = node.value;
    if (!['meta', 'link', 'input', 'br', 'img', 'hr'].includes(tag)) stack.push(node);
  }
}

// Actual markup, display entry, authority and application run unchanged. DOM,
// native frame transport, storage, layout and scheduling are modeled boundaries.
async function harness(
  t,
  route,
  { stored = encode(), reduced = false, denied = false, holdBoot = false } = {},
) {
  const doc = new ToolDocument(),
    host = new Events(),
    media = Object.assign(new Events(), { matches: reduced });
  const routeURL = new URL(`../${route}/`, import.meta.url);
  const html = await readFile(new URL('index.html', routeURL), 'utf8');
  mountMarkup(doc, html);
  const scripts = [...html.matchAll(/<script\b([^>]*)>/g)].map((match) => ({
    offset: match.index,
    attrs: Object.fromEntries(
      [...match[1].matchAll(/([^\s=]+)\s*=\s*"([^"]*)"/g)].map((m) => [m[1], m[2]]),
    ),
  }));
  const displayScripts = scripts.filter((script) =>
    script.attrs.src?.endsWith('/tool-display-entry.mjs'),
  );
  const appScript = scripts.find(
    (script) =>
      script.attrs['data-module'] === (route === 'controller-lab' ? 'lab.mjs' : 'playground.mjs'),
  );
  assert.ok(appScript, 'Actual HTML supplies its application module.');
  const reads = [],
    displayWrites = [],
    sessionWrites = [],
    posts = [],
    requests = [],
    jobs = [];
  const storageValues = new Map(),
    timers = new Map(),
    intervals = new Map(),
    frames = new Map(),
    observers = [];
  const fetchGates = new Map();
  const boot = { entered: deferred(), released: deferred() };
  if (holdBoot) fetchGates.set('../content/campaign.json', boot);
  let raw = stored,
    unavailable = denied,
    writeFailure = false,
    timer = 0;
  const storage = {
    getItem(key) {
      reads.push(key);
      assert.equal(key, DISPLAY_PREFERENCES_KEY, 'Only the separate display record may be read.');
      if (unavailable) throw new Error('Storage unavailable');
      return raw;
    },
    setItem(key, value) {
      assert.equal(key, DISPLAY_PREFERENCES_KEY, 'No player/profile write is authorized.');
      displayWrites.push([key, value]);
      if (unavailable || writeFailure) throw new Error('Storage unavailable');
      raw = value;
    },
  };
  host.location = { origin: 'https://tools.test', href: `https://tools.test/game/${route}/` };
  host.localStorage = storage;
  host.matchMedia = (query) => {
    assert.equal(query, '(prefers-reduced-motion: reduce)');
    return media;
  };
  host.getComputedStyle = (element) => ({
    display: element.style.display || 'block',
    visibility: element.style.visibility || 'visible',
  });
  doc.defaultView = host;
  doc.documentElement.clientWidth = 1280;
  const $ = (id) => doc.getElementById(id);
  const frame = $(route === 'controller-lab' ? 'game-frame' : 'preview-frame');
  const child = Object.assign(new Events(), {
    location: host.location,
    parent: host,
    frameElement: frame,
    innerWidth: 1280,
    innerHeight: 720,
    focus() {},
    postMessage(data, origin) {
      posts.push({ data, origin });
    },
  });
  frame.contentWindow = child;
  frame.contentDocument = null;
  const originalGlobals = new Map();
  const set = (key, value) => {
    originalGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  };
  const track = (promise) => {
    jobs.push(promise);
    promise.catch(() => {});
    return promise;
  };
  set('document', doc);
  set('window', host);
  set('crypto', webcrypto);
  set('Option', function (label, value) {
    const node = doc.createElement('option');
    node.textContent = label;
    node.value = value;
    return node;
  });
  set('sessionStorage', {
    getItem: (key) => storageValues.get(key) ?? null,
    setItem(key, value) {
      assert.equal(key, 'revealline.playground.current');
      sessionWrites.push([key, value]);
      storageValues.set(key, value);
    },
  });
  set('fetch', (path) =>
    track(
      (async () => {
        requests.push(String(path));
        const gate = fetchGates.get(String(path));
        if (gate) {
          gate.entered.resolve();
          await gate.released.promise;
        }
        const bytes = await readFile(new URL(path, routeURL), 'utf8');
        return { ok: true, json: async () => JSON.parse(bytes) };
      })(),
    ),
  );
  set('setTimeout', (fn, ms) => {
    const id = ++timer;
    timers.set(id, { fn, ms });
    return id;
  });
  set('clearTimeout', (id) => timers.delete(id));
  set('setInterval', (fn, ms) => {
    const id = ++timer;
    intervals.set(id, { fn, ms });
    return id;
  });
  set('clearInterval', (id) => intervals.delete(id));
  set('requestAnimationFrame', (fn) => {
    const id = ++timer;
    frames.set(id, fn);
    return id;
  });
  set('cancelAnimationFrame', (id) => frames.delete(id));
  set(
    'ResizeObserver',
    class {
      constructor(callback) {
        this.callback = callback;
        observers.push(this);
      }
      observe(node) {
        this.node = node;
      }
      disconnect() {
        this.disconnected = true;
      }
    },
  );
  let appPromise;
  t.after(async () => {
    // Do not let a failing assertion leave a module/fetch resuming against the
    // next test's globals. Release every deliberately held operation first.
    for (const gate of fetchGates.values()) gate.released.resolve();
    await Promise.allSettled(jobs);
    if (appPromise) await Promise.allSettled([appPromise]);
    await Promise.allSettled(jobs);
    try {
      host.emit('pagehide', { persisted: false });
    } finally {
      timers.clear();
      intervals.clear();
      frames.clear();
      for (const [key, descriptor] of originalGlobals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
      }
    }
  });
  // A missing baseline display tag does not block the actual application: the
  // functional assertions then detect unadopted saved policy. Wiring has its own cases.
  if (displayScripts[0])
    await import(`${new URL(displayScripts[0].attrs.src, routeURL).href}?display=${++serial}`);
  const surfaces = scripts.find((script) => script.attrs.src?.endsWith('/field-kit-surfaces.mjs'));
  if (surfaces) await import(`${new URL(surfaces.attrs.src, routeURL).href}?surface=${++serial}`);
  return {
    $,
    doc,
    host,
    media,
    frame,
    child,
    scripts,
    appScript,
    displayScripts,
    reads,
    displayWrites,
    sessionWrites,
    posts,
    requests,
    timers,
    intervals,
    frames,
    observers,
    storageValues,
    boot,
    track,
    get raw() {
      return raw;
    },
    set writeFailure(value) {
      writeFailure = value;
    },
    set unavailable(value) {
      unavailable = value;
    },
    start() {
      return (appPromise ??= track(
        import(`${new URL(appScript.attrs['data-module'], routeURL).href}?host=${++serial}`),
      ));
    },
    hold(path) {
      const gate = { entered: deferred(), released: deferred() };
      fetchGates.set(path, gate);
      return gate;
    },
    external(patch, { notify = true } = {}) {
      raw = encode(patch);
      if (notify)
        host.emit('storage', { key: DISPLAY_PREFERENCES_KEY, storageArea: storage, newValue: raw });
    },
    flushFrames() {
      for (const [id, fn] of [...frames]) {
        frames.delete(id);
        fn();
      }
    },
    ready(sequence = 0, readSequence = -1) {
      const session = new URL(frame.src, host.location.href).searchParams.get('controller-session');
      host.emit('message', {
        source: child,
        origin: host.location.origin,
        data: {
          format: CONTROLLER_PREVIEW_STATUS_FORMAT,
          session,
          sequence,
          readSequence,
          scope: 'flight',
          focusedId: '',
          focusedLabel: '',
          assigned: false,
          message: 'Ready',
        },
      });
    },
  };
}
function policy(f, face, size, effects) {
  assert.equal(f.doc.body.dataset.textFace, face);
  assert.equal(f.doc.body.dataset.textSize, size);
  assert.equal(f.doc.body.dataset.effects, effects);
}
function currentFrame(f) {
  const frame = f.$('game-frame') ?? f.$('preview-frame');
  assert.ok(frame, 'The actual document still contains its hosted frame.');
  return frame;
}
function hostState(f) {
  const frame = currentFrame(f);
  return {
    src: frame.src,
    sourceWrites: frame.sourceWrites,
    width: frame.width,
    height: frame.height,
    style: { ...frame.style },
    sessionWrites: f.sessionWrites.length,
    posts: f.posts.length,
    timers: [...f.timers.keys()],
    intervals: [...f.intervals.keys()],
    frames: [...f.frames.keys()],
    paints: f.$('map-editor')?.paintCalls?.length ?? 0,
  };
}
function controllerClick(f, id) {
  f.$(id).emit('click', { detail: 0 });
}
function selector(f) {
  return (
    f.doc.querySelector('[data-tool-text-size]') ??
    f.doc.querySelector('[data-field-kit-text-size]')
  );
}

for (const route of ['controller-lab', 'playground']) {
  test(`${route}: saved policy applies while the actual boot fetch is pending`, async (t) => {
    const f = await harness(t, route, {
      stored: encode({ textFace: 'plain', textSize: 'large' }),
      reduced: true,
      holdBoot: true,
    });
    const originalFrame = currentFrame(f),
      app = f.start();
    await waitFor(() => f.boot.entered.settled, {
      message: 'Actual application reached the held campaign fetch.',
    });
    policy(f, 'plain', 'large', 'reduced');
    assert.equal(currentFrame(f).sourceWrites ?? 0, 0);
    assert.equal(f.sessionWrites.length, 0);
    assert.equal(f.displayWrites.length, 0);
    if (route === 'controller-lab') assert.equal(selector(f).value, 'large');
    else assert.equal(f.doc.querySelector('[data-boot-inert]').inert, true);
    f.boot.released.resolve();
    await app;
    assert.ok(currentFrame(f) === originalFrame, 'Boot retains its mounted iframe.');
    assert.match(currentFrame(f).src, /practice=1/);
    assert.equal(f.sessionWrites.length, 1);
    assert.equal(f.displayWrites.length, 0);
    policy(f, 'plain', 'large', 'reduced');
  });
}

test('Controller: modeled reading-control change is one writer and does not release held input or replace fields', async (t) => {
  const f = await harness(t, 'controller-lab');
  await f.start();
  f.ready();
  controllerClick(f, 'connect');
  f.$('gesture').value = 'hold';
  const pad = f.doc.querySelector('[data-pad="0"]');
  pad.emit('click', { detail: 0 });
  assert.equal(f.posts.at(-1).data.pad.buttons[0], true);
  const control = selector(f),
    axis = f.$('axis-0'),
    mission = f.$('mission');
  axis.value = '0.65'; // Unsaved physical-axis draft must survive host reading changes.
  control.focus();
  const originalFrame = currentFrame(f),
    before = hostState(f),
    selectedMission = mission.value;
  f.external({ textFace: 'plain', textSize: 'large', reducedEffects: true });
  policy(f, 'plain', 'large', 'reduced');
  assert.equal(control.value, 'large');
  assert.deepEqual(hostState(f), before);
  control.value = 'standard';
  control.emit('change');
  policy(f, 'plain', 'standard', 'reduced');
  assert.equal(f.displayWrites.length, 1);
  assert.deepEqual(JSON.parse(f.raw), {
    textFace: 'plain',
    textSize: 'standard',
    reducedEffects: true,
  });
  assert.deepEqual(hostState(f), before);
  assert.ok(
    currentFrame(f) === originalFrame,
    'A reading change preserves the actual iframe node.',
  );
  assert.ok(f.doc.activeElement === control && selector(f) === control);
  assert.ok(f.$('axis-0') === axis && f.$('mission') === mission);
  assert.equal(axis.value, '0.65');
  assert.equal(mission.value, selectedMission);
  assert.equal(f.posts.at(-1).data.pad.buttons[0], true);
  assert.equal(control.listeners.get('change')?.size, 1, 'The legacy surface listener is absent.');
});

test('Controller: failed persistence retains accepted intent and a terminal late change cannot write', async (t) => {
  const f = await harness(t, 'controller-lab');
  await f.start();
  const originalFrame = currentFrame(f),
    control = selector(f);
  control.focus();
  f.writeFailure = true;
  control.value = 'large';
  control.emit('change');
  policy(f, 'pixel', 'large', 'full');
  assert.equal(f.displayWrites.length, 1);
  assert.match(f.$('host-display-notice').textContent, /could not be saved/);
  const saveWarning = f.$('host-display-notice').textContent;
  applyFieldKitCopy(f.doc);
  assert.equal(
    f.$('host-display-notice').textContent,
    saveWarning,
    'A later copy refresh preserves the active save warning.',
  );
  assert.ok(f.doc.activeElement === control && selector(f) === control);
  assert.equal(control.value, 'large');
  f.external({ textFace: 'plain', textSize: 'standard' });
  f.host.emit('pagehide', { persisted: true });
  f.host.emit('pageshow', { persisted: true });
  policy(f, 'pixel', 'large', 'full');
  assert.equal(control.value, 'large');
  assert.ok(
    currentFrame(f) === originalFrame,
    'Failed saving and persisted return retain the iframe.',
  );
  const lateChange = [...(control.listeners.get('change') ?? [])];
  f.host.emit('pagehide', { persisted: false });
  control.value = 'standard';
  control.emit('change');
  for (const listener of lateChange) listener({ currentTarget: control });
  policy(f, 'pixel', 'large', 'full');
  assert.equal(f.displayWrites.length, 1);
  assert.equal(control.listeners.get('change')?.size ?? 0, 0);
});

test('Controller: persisted return converges policy but never reconnects or reloads practice', async (t) => {
  const f = await harness(t, 'controller-lab');
  await f.start();
  f.ready();
  controllerClick(f, 'connect');
  f.$('gesture').value = 'hold';
  f.doc.querySelector('[data-pad="0"]').emit('click', { detail: 0 });
  const frame = currentFrame(f),
    src = frame.src,
    writes = f.sessionWrites.length;
  f.host.emit('pagehide', { persisted: true });
  assert.equal(f.posts.at(-1).data.pad.connected, false);
  f.external({ textFace: 'plain', textSize: 'large' }, { notify: false });
  f.media.matches = true;
  f.host.emit('pageshow', { persisted: true });
  policy(f, 'plain', 'large', 'reduced');
  assert.ok(currentFrame(f) === frame);
  assert.equal(currentFrame(f).src, src);
  assert.equal(f.sessionWrites.length, writes);
  assert.equal(f.posts.at(-1).data.pad.connected, false);
  assert.ok(f.posts.at(-1).data.pad.buttons.every((value) => !value));
  assert.equal([...f.intervals.values()].filter((item) => item.ms === 150).length, 1);
  f.host.emit('pagehide', { persisted: false });
  assert.equal(f.intervals.size, 0, 'Existing Controller lifecycle retires its heartbeat.');
  f.external({ textFace: 'pixel', textSize: 'standard' });
  f.media.matches = false;
  f.media.emit('change');
  f.host.emit('pageshow', { persisted: true });
  policy(f, 'plain', 'large', 'reduced');
  assert.equal(f.host.listeners.get('storage')?.size ?? 0, 0);
  assert.equal(f.media.listeners.get('change')?.size ?? 0, 0);
  assert.equal(f.displayWrites.length, 0);
});

test('Playground: live policy retains focused JSON, undo owner, map, frame and queued work', async (t) => {
  const f = await harness(t, 'playground');
  await f.start();
  f.$('class-select').value = 'scout';
  f.$('class-select').onchange();
  assert.equal(f.$('undo-button').disabled, false);
  const text = f.$('level-json'),
    craft = f.$('class-select'),
    option = craft.children[0];
  const draft = `${text.value}\n \n`;
  text.value = draft;
  text.selectionStart = 7;
  text.selectionEnd = 19;
  text.focus();
  f.flushFrames();
  const originalFrame = currentFrame(f),
    before = hostState(f),
    status = f.$('editor-status').textContent;
  f.external({ textFace: 'plain', textSize: 'large' });
  f.media.matches = true;
  f.media.emit('change');
  policy(f, 'plain', 'large', 'reduced');
  assert.deepEqual(hostState(f), before);
  assert.ok(currentFrame(f) === originalFrame, 'Live policy retains the actual preview iframe.');
  assert.ok(f.doc.activeElement === text && f.$('level-json') === text);
  assert.ok(f.$('class-select') === craft && craft.children[0] === option);
  assert.equal(text.value, draft);
  assert.equal(text.selectionStart, 7);
  assert.equal(text.selectionEnd, 19);
  assert.equal(f.$('editor-status').textContent, status);
  assert.equal(f.$('undo-button').disabled, false);
  assert.equal(f.displayWrites.length, 0);
});

test('Playground: a real pending import keeps its ticket and running preview across display changes', async (t) => {
  const f = await harness(t, 'playground');
  await f.start();
  const id = 'tactical-borrowed-seconds';
  const gate = f.hold(`../../authoring/library/tactical-teaching/scenarios/${id}.json`);
  const originalFrame = currentFrame(f),
    source = originalFrame.src,
    writes = f.sessionWrites.length;
  const priorLevel = JSON.parse(f.$('level-json').value);
  const button = f
    .$('teaching-examples')
    .children.find((node) => node.dataset.teachingScenario === id);
  const job = f.track(button.onclick());
  await waitFor(() => gate.entered.settled, {
    message: 'Actual teaching action reached the held fetch.',
  });
  assert.equal(f.$('preview-button').disabled, true);
  const before = hostState(f);
  f.$('pack-json').value = '{"unapplied":true}';
  f.$('pack-json').focus();
  f.flushFrames();
  const pending = hostState(f);
  f.external({ textFace: 'plain', textSize: 'large', reducedEffects: true });
  policy(f, 'plain', 'large', 'reduced');
  assert.deepEqual(hostState(f), pending);
  assert.equal(f.$('preview-button').disabled, true);
  assert.equal(f.$('open-preview').getAttribute('href'), null);
  assert.equal(f.$('pack-json').value, '{"unapplied":true}');
  assert.ok(f.doc.activeElement === f.$('pack-json'));
  assert.ok(currentFrame(f) === originalFrame, 'A pending import keeps the mounted preview.');
  assert.equal(currentFrame(f).sourceWrites, before.sourceWrites);
  gate.released.resolve();
  await job;
  assert.equal(JSON.parse(f.$('level-json').value).id, id);
  assert.equal(f.$('preview-button').disabled, false);
  assert.ok(currentFrame(f) === originalFrame);
  assert.equal(currentFrame(f).src, source);
  assert.equal(f.sessionWrites.length, writes);
  f.$('undo-button').click();
  assert.deepEqual(JSON.parse(f.$('level-json').value), priorLevel);
  assert.equal(f.displayWrites.length, 0);
});

test('Playground: persisted return retains display owner and terminal disposal stops only its bindings', async (t) => {
  const f = await harness(t, 'playground');
  await f.start();
  const originalFrame = currentFrame(f),
    source = originalFrame.src,
    writes = f.sessionWrites.length,
    draft = f.$('level-json');
  draft.value += '\n ';
  const draftValue = draft.value;
  f.host.emit('pagehide', { persisted: true });
  f.external({ textFace: 'plain', textSize: 'large' }, { notify: false });
  f.media.matches = true;
  f.host.emit('pageshow', { persisted: true });
  policy(f, 'plain', 'large', 'reduced');
  assert.ok(currentFrame(f) === originalFrame);
  assert.equal(currentFrame(f).src, source);
  assert.equal(f.sessionWrites.length, writes);
  assert.equal(draft.value, draftValue);
  assert.ok(f.$('level-json') === draft);
  assert.equal(f.host.listeners.get('storage')?.size, 1);
  f.host.emit('pagehide', { persisted: false });
  f.external({ textFace: 'pixel', textSize: 'standard' });
  f.media.matches = false;
  f.media.emit('change');
  policy(f, 'plain', 'large', 'reduced');
  assert.equal(f.host.listeners.get('storage')?.size ?? 0, 0);
  assert.equal(f.media.listeners.get('change')?.size ?? 0, 0);
  assert.equal(f.displayWrites.length, 0);
  // The existing measurement interval is intentionally not attributed to this owner.
});

for (const route of ['controller-lab', 'playground']) {
  test(`${route}: denied storage uses defaults and system motion without touching player records`, async (t) => {
    const f = await harness(t, route, { denied: true, reduced: true });
    await f.start();
    policy(f, 'pixel', 'standard', 'reduced');
    assert.match(currentFrame(f).src, /practice=1/);
    assert.equal(f.displayWrites.length, 0);
    assert.ok(f.reads.length > 0 && f.reads.every((key) => key === DISPLAY_PREFERENCES_KEY));
    assert.deepEqual([...f.storageValues.keys()], ['revealline.playground.current']);
  });
  test(`${route}: actual HTML independently wires exactly one reading owner before the app launcher`, async (t) => {
    const f = await harness(t, route, { stored: '{malformed' });
    assert.equal(f.displayScripts.length, 1);
    assert.equal(f.displayScripts[0].attrs.type, 'module');
    assert.ok(f.displayScripts[0].offset < f.appScript.offset);
    const cosmetic = f.scripts.find((item) =>
      item.attrs.src?.endsWith('/presentation/page-entry.mjs'),
    );
    assert.ok(!cosmetic || f.displayScripts[0].offset < cosmetic.offset);
    policy(f, 'pixel', 'standard', 'full');
    assert.equal(
      f.requests.length,
      0,
      'Reading adoption does not depend on the application graph.',
    );
    assert.equal(f.displayWrites.length, 0);
    if (route === 'controller-lab') {
      assert.equal(f.doc.querySelectorAll('[data-tool-text-size]').length, 1);
      assert.equal(f.doc.querySelectorAll('[data-field-kit-text-size]').length, 0);
    }
  });
}

test('Playground: readable map diagnostics follow actual edits and Undo without changing pixel or cell geometry', async (t) => {
  const f = await harness(t, 'playground');
  await f.start();
  const list = f.$('map-diagnostic-list'),
    details = f.$('map-diagnostics');
  assert.ok(list && details);
  details.open = false;
  const initialText = list.textContent,
    level = JSON.parse(f.$('level-json').value);
  level.signalZones = [
    {
      id: 'slow-west',
      x: 3,
      y: 5,
      w: 4,
      h: 3,
      speedFactor: 0.5,
      disableBoost: true,
      lockAbility: false,
    },
    {
      id: 'quiet-east',
      x: 24,
      y: 15,
      w: 6,
      h: 5,
      speedFactor: 0.75,
      disableBoost: false,
      lockAbility: true,
    },
  ];
  level.hangars = [
    { id: 'home-one', x: 24.5, y: 0.5, radius: 2 },
    { id: 'home-two', x: 0.5, y: 18.5, radius: 1.5 },
  ];
  f.$('level-json').value = JSON.stringify(level);
  await f.track(f.$('apply-json').onclick());
  assert.deepEqual(JSON.parse(f.$('level-json').value).signalZones, level.signalZones);
  assert.ok(f.$('map-diagnostics') === details && f.$('map-diagnostic-list') === list);
  assert.equal(
    details.open,
    false,
    'Map refresh preserves the chosen diagnostics disclosure state.',
  );
  const rows = list.children.map((node) => node.textContent);
  for (const id of ['slow-west', 'quiet-east', 'home-one', 'home-two'])
    assert.ok(
      rows.some((text) => text.includes(id)),
      `Diagnostic includes ${id}.`,
    );
  assert.match(list.textContent, /50%/);
  assert.match(list.textContent, /75%/);
  assert.match(list.textContent, /1\.5/);
  const canvas = f.$('map-editor'),
    intrinsic = [canvas.width, canvas.height];
  canvas._rect = { x: 10, y: 20, width: 384, height: 288 };
  canvas.clientLeft = canvas.clientTop = 0;
  canvas.offsetWidth = canvas.clientWidth = 768;
  canvas.offsetHeight = canvas.clientHeight = 576;
  const originalFrame = currentFrame(f),
    cell = editorCellFromPointer(level, canvas, 94, 112),
    before = hostState(f),
    descriptions = list.textContent;
  assert.deepEqual(cell, { x: 10, y: 11 });
  f.external({ textFace: 'plain', textSize: 'large' });
  policy(f, 'plain', 'large', 'full');
  assert.deepEqual(hostState(f), before);
  assert.ok(currentFrame(f) === originalFrame);
  assert.deepEqual([canvas.width, canvas.height], intrinsic);
  assert.deepEqual(editorCellFromPointer(level, canvas, 94, 112), cell);
  assert.equal(list.textContent, descriptions);
  f.$('undo-button').click();
  assert.equal(list.textContent, initialText);
  assert.ok(f.$('map-diagnostics') === details);
  assert.equal(details.open, false);
  assert.deepEqual(JSON.parse(f.$('level-json').value).signalZones, []);
});

// Model the native disabled-button focus retirement observed in the browser.
// Application handlers remain real; focus/layout below are explicit fixture boundaries.
function retireUndoFocus(f, afterRetire = () => {}) {
  const undo = f.$('undo-button');
  let disabled = undo.disabled;
  Object.defineProperty(undo, 'disabled', {
    configurable: true,
    get: () => disabled,
    set(value) {
      disabled = value;
      if (value && f.doc.activeElement === undo) {
        f.doc.activeElement = f.doc.body;
        afterRetire();
      }
    },
  });
  return undo;
}
function changePlaygroundClass(f, value = 'bomber') {
  assert.notEqual(f.$('class-select').value, value, 'Each history entry changes the actual class.');
  f.$('class-select').value = value;
  f.$('class-select').onchange();
  assert.equal(f.$('class-select').value, value);
}
function previewIdentity(f) {
  return {
    src: f.frame.src,
    writes: f.frame.sourceWrites,
    sessionWrites: f.sessionWrites.length,
    saved: f.storageValues.get('revealline.playground.current'),
  };
}

test('Playground: last focused Undo returns to the selected brush and preserves the running preview', async (t) => {
  const f = await harness(t, 'playground');
  await f.start();
  const original = f.$('level-json').value,
    preview = previewIdentity(f),
    brush = f.doc.querySelector('[data-brush="signal"]');
  brush.click();
  changePlaygroundClass(f);
  f.$('level-json').value = '{"unapplied":"draft Я"}';
  const undo = retireUndoFocus(f);
  undo.focus();
  undo.click();
  assert.equal(undo.disabled, true);
  assert.equal(f.$('class-select').value, 'scout');

  assert.equal(f.doc.activeElement?.dataset.brush, 'signal');
  assert.equal(brush.getAttribute('aria-pressed'), 'true');
  assert.equal(
    f.$('level-json').value,
    original,
    'Undo deliberately restores the working-map JSON.',
  );
  assert.deepEqual(
    previewIdentity(f),
    preview,
    'Only explicit Play may refresh the child preview.',
  );
  assert.match(f.$('editor-status').textContent, /Play configuration to refresh the preview/);
  f.$('preview-button').click();
  assert.equal(f.frame.sourceWrites, preview.writes + 1);
  assert.equal(f.sessionWrites.length, preview.sessionWrites + 1);
  assert.notEqual(f.frame.src, preview.src);
});

test('Playground: an Undo with more history keeps focus on Undo', async (t) => {
  const f = await harness(t, 'playground');
  await f.start();
  changePlaygroundClass(f, 'bomber');
  changePlaygroundClass(f, 'fiber');
  const undo = retireUndoFocus(f),
    preview = previewIdentity(f);
  undo.focus();
  undo.click();
  assert.equal(undo.disabled, false);
  assert.equal(f.$('class-select').value, 'bomber');

  assert.equal(f.doc.activeElement?.id, 'undo-button');
  assert.deepEqual(previewIdentity(f), preview);
  undo.click();
  assert.equal(undo.disabled, true);
  assert.equal(f.$('class-select').value, 'scout');
  assert.deepEqual(previewIdentity(f), preview);
});

for (const guard of ['unrelated editor', 'newer focus', 'hidden document', 'unfocused document']) {
  test(`Playground: last Undo does not steal ${guard} focus`, async (t) => {
    const f = await harness(t, 'playground');
    await f.start();
    changePlaygroundClass(f);
    const editor = f.$('level-json'),
      undo = retireUndoFocus(f, () => {
        if (guard === 'newer focus') editor.focus();
      });
    if (guard === 'unrelated editor') editor.focus();
    else undo.focus();
    if (guard === 'hidden document') f.doc.hidden = true;
    if (guard === 'unfocused document') f.doc.focused = false;
    const preview = previewIdentity(f);
    undo.click();
    assert.equal(undo.disabled, true);
    assert.equal(f.$('class-select').value, 'scout');

    assert.equal(f.doc.activeElement?.tagName, guard.includes('document') ? 'BODY' : 'TEXTAREA');
    if (!guard.includes('document')) assert.equal(f.doc.activeElement?.id, 'level-json');
    assert.deepEqual(previewIdentity(f), preview);
  });
}

test('Playground: last Undo skips an unavailable selected brush for an existing editor action', async (t) => {
  const f = await harness(t, 'playground');
  await f.start();
  changePlaygroundClass(f);
  const selected = f.doc.querySelector('[data-brush][aria-pressed="true"]'),
    undo = retireUndoFocus(f);
  selected.disabled = true;
  // The fixture does not model closed-details layout; explicitly make that
  // fallback unavailable rather than treating a hidden coordinate action as visible.
  f.$('paint-cell').hidden = true;
  undo.focus();
  undo.click();
  assert.equal(f.$('class-select').value, 'scout');

  assert.equal(f.doc.activeElement?.id, 'preview-button');
});

function mountedMeasurementChild(f, { controls = true, launch = true } = {}) {
  const doc = new ToolDocument(),
    arena = doc.createElement('section');
  arena.id = 'arena-shell';
  arena._rect = { x: 0, y: 60, width: 360, height: 270 };
  doc.body.append(arena);
  doc.documentElement.scrollWidth = 390;
  doc.documentElement.scrollHeight = 844;
  doc.documentElement.dataset.bootState = 'ready';
  f.child.innerWidth = 390;
  f.child.innerHeight = 844;
  f.child.devicePixelRatio = 1;
  f.child.scrollX = f.child.scrollY = 0;
  f.child.getComputedStyle = f.host.getComputedStyle;
  f.child.matchMedia = () => ({ matches: false });
  doc.defaultView = f.child;
  const actions = [];
  if (controls) {
    for (const [id, x, width, height] of [
      ['pause-button', 5, 48, 46],
      ['action-button', 75, 52, 44],
    ]) {
      const button = doc.createElement('button');
      button.id = id;
      button._rect = { x, y: 380, width, height };
      doc.body.append(button);
      actions.push(button);
    }
  }
  const launchButton = doc.createElement('button');
  launchButton.id = 'fixture-launch';
  launchButton.textContent = 'Continue';
  launchButton._rect = { x: 10, y: 430, width: 120, height: 48 };
  if (launch) doc.body.append(launchButton);
  // The minimal DOM supports ordinary selectors, but not this descendant+not selector.
  const query = doc.querySelectorAll.bind(doc);
  doc.querySelectorAll = (selector) =>
    selector === '#game-overlay button:not([hidden])'
      ? launch
        ? [launchButton]
        : []
      : query(selector);
  doc.elementFromPoint = () => (launch ? launchButton : null);
  f.frame.contentDocument = doc;
  f.frame.emit('load');
  return { doc, arena, actions, launchButton };
}
function measureCurrentChild(f) {
  const interval = [...f.intervals.values()].find((item) => item.ms === 500);
  assert.ok(interval, 'The actual application installed its existing measurement callback.');
  interval.fn();
}
function liveMeasurementCopy(f) {
  return Object.fromEntries(
    ['viewport-readout', 'layout-readout', 'control-readout', 'launch-readout'].map((id) => [
      id,
      f.$(id).textContent,
    ]),
  );
}
function captureCurrentChild(f) {
  f.$('capture-geometry').click();
  f.flushFrames();
  const source = f.$('geometry-readout').textContent,
    report = JSON.parse(source);
  assert.equal(report.format, 'revealline-control-geometry.v1');
  return source;
}

test('Playground: live measurement handles empty and nonfinite controls without a vacuous visibility claim', async (t) => {
  const f = await harness(t, 'playground');
  await f.start();
  const child = mountedMeasurementChild(f, { controls: false, launch: false });
  assert.match(f.$('control-readout').textContent, /no measurable action boxes/);
  assert.doesNotMatch(f.$('control-readout').textContent, /Infinity|NaN|all actions visible/);
  assert.match(f.$('launch-readout').textContent, /No measurable launch actions/);
  const button = child.doc.createElement('button');
  button.id = 'pause-button';
  button._rect = { x: 0, y: 380, width: Infinity, height: 44 };
  child.doc.body.append(button);
  measureCurrentChild(f);
  assert.match(f.$('control-readout').textContent, /no measurable action boxes/);
  button._rect = { x: 0, y: 380, width: 0, height: 0 };
  measureCurrentChild(f);
  assert.match(f.$('control-readout').textContent, /no measurable action boxes/);
  button._rect = { x: 350, y: 380, width: 52, height: 44 };
  measureCurrentChild(f);
  assert.match(f.$('control-readout').textContent, /1 measured box · minimum 52 × 44/);
  assert.match(f.$('control-readout').textContent, /some measured boxes outside viewport/);
  button._rect.x = 10;
  measureCurrentChild(f);
  assert.match(f.$('control-readout').textContent, /all measured boxes inside viewport/);
  assert.equal(f.frame.sourceWrites, 1);
  assert.equal(f.sessionWrites.length, 1);
});

test('Playground: new preview clears live measurements immediately while retaining the explicit snapshot', async (t) => {
  const f = await harness(t, 'playground');
  await f.start();
  mountedMeasurementChild(f);
  assert.match(f.$('control-readout').textContent, /minimum 48 × 44/);
  assert.match(f.$('launch-readout').textContent, /Continue 120 × 48/);
  const snapshot = captureCurrentChild(f),
    frame = f.frame,
    previousSrc = frame.src;
  f.$('preview-button').click();
  assert.notEqual(frame.src, previousSrc);
  for (const value of Object.values(liveMeasurementCopy(f))) {
    assert.match(value, /Waiting for the current preview document/);
    assert.doesNotMatch(value, /Continue|minimum|whole arena visible/);
  }
  // Native navigation can retain the prior document until the replacement loads.
  measureCurrentChild(f);
  assert.match(f.$('control-readout').textContent, /Waiting for the current preview document/);
  assert.equal(f.$('geometry-readout').textContent, snapshot);
  assert.match(f.$('geometry-status').textContent, /Previous capture retained/);
  mountedMeasurementChild(f, { controls: false, launch: false });
  assert.match(f.$('control-readout').textContent, /no measurable action boxes/);
  assert.equal(f.$('geometry-readout').textContent, snapshot);
});

test('Playground: unavailable current document, arena or viewport clears only live measurement state', async (t) => {
  const f = await harness(t, 'playground');
  await f.start();
  mountedMeasurementChild(f);
  const snapshot = captureCurrentChild(f),
    preview = previewIdentity(f);
  for (const fault of [
    'missing arena',
    'zero arena',
    'nonfinite arena',
    'missing document',
    'invalid viewport',
    'inaccessible document',
  ]) {
    const child = mountedMeasurementChild(f);
    assert.match(f.$('control-readout').textContent, /minimum 48 × 44/);
    if (fault === 'missing arena') child.arena.remove();
    if (fault === 'zero arena') child.arena._rect.width = 0;
    if (fault === 'nonfinite arena') child.arena._rect.x = NaN;
    if (fault === 'missing document') f.frame.contentDocument = null;
    if (fault === 'invalid viewport') f.child.innerWidth = Infinity;
    if (fault === 'inaccessible document')
      Object.defineProperty(f.frame, 'contentDocument', {
        configurable: true,
        get() {
          throw new Error('Blocked child document');
        },
      });
    measureCurrentChild(f);
    for (const value of Object.values(liveMeasurementCopy(f))) {
      assert.doesNotMatch(value, /Infinity|NaN|Continue|minimum|whole arena visible/);
    }
    assert.match(f.$('control-readout').textContent, /unavailable/);
    assert.equal(f.$('geometry-readout').textContent, snapshot);
    assert.deepEqual(previewIdentity(f), preview);
  }
});

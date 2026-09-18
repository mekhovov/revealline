import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Script, createContext, constants } from 'node:vm';
import { Document, Element, Events } from './helpers/couch-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { DISPLAY_PREFERENCES_KEY } from '../display-preferences.mjs';
import { applyFieldKitCopy } from '../ui/field-kit-copy.mjs';

const NativeURL = globalThis.URL;
const route = new NativeURL('../../authoring/motion-lab/', import.meta.url);
const defaults = { textFace: 'pixel', textSize: 'standard', reducedEffects: false };
const encode = (patch = {}) => JSON.stringify({ ...defaults, ...patch });
let serial = 0;
function deferred() {
  let resolve;
  const promise = new Promise((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
class MotionElement extends Element {
  get nextElementSibling() {
    const siblings = this.parentElement?.children ?? [];
    return siblings[siblings.indexOf(this) + 1] ?? null;
  }
  // Explicit native boundary: fieldset inheritance does not change a child's
  // own disabled property; canvas focus is gated separately by inert markup.
  get unavailable() {
    const formControl = ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(this.tagName);
    for (let node = this; node; node = node.parentElement) {
      if (node.hasAttribute?.('inert')) return true;
      if (formControl && node.tagName === 'FIELDSET' && node.disabled) return true;
    }
    return formControl && this.disabled;
  }
  focus() {
    if (!this.unavailable) super.focus();
  }
  click() {
    if (!this.unavailable) super.click();
  }
  getContext() {
    return (this.context ??= new Proxy(
      { canvas: this, calls: [] },
      {
        get(target, key) {
          if (key in target) return target[key];
          if (key === 'measureText') return (text) => ({ width: String(text).length * 0.3 });
          return (...args) => {
            target.calls.push({ op: key, args });
          };
        },
        set(target, key, value) {
          target[key] = value;
          target.calls.push({ property: key, value });
          return true;
        },
      },
    ));
  }
}
class MotionDocument extends Document {
  createElement(tag) {
    return new MotionElement(this, tag);
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
    if (['type', 'value', 'width', 'height'].includes(name)) node[name] = value;
    if (['hidden', 'disabled', 'checked'].includes(name)) node[name] = true;
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

// Real HTML-selected entry and real application run against modeled transport,
// images, DOM and animation scheduling. These assertions do not prove layout.
async function harness(
  t,
  {
    stored = encode(),
    reduced = false,
    holdBoot = false,
    failBoot = false,
    denied = false,
    withLauncher = false,
    failModule = false,
    prepareAbility = (value) => value,
  } = {},
) {
  const doc = new MotionDocument(),
    host = new Events(),
    media = Object.assign(new Events(), { matches: reduced });
  doc.defaultView = host;
  doc.documentElement.lang = 'uk'; // Existing English fallback remains explicit.
  const html = await readFile(new NativeURL('index.html', route), 'utf8');
  mountMarkup(doc, html);
  const scripts = [...html.matchAll(/<script\b([^>]*)>/g)].map((match) => ({
    offset: match.index,
    attrs: Object.fromEntries(
      [...match[1].matchAll(/([^\s=]+)\s*=\s*"([^"]*)"/g)].map((m) => [m[1], m[2]]),
    ),
  }));
  const entries = scripts.filter((script) => script.attrs.src === './display-entry.mjs');
  const appScript = scripts.find((script) => script.attrs['data-module'] === 'app.js');
  assert.ok(appScript, 'The actual HTML provides its application entry.');
  const $ = (id) => doc.getElementById(id);
  $('arena')._rect = { x: 0, y: 0, width: 960, height: 720 };
  const frames = new Map(),
    cancelled = [],
    images = [],
    observers = [],
    writes = [],
    reads = [],
    requests = [],
    revoked = [],
    objectURLs = [];
  const boot = deferred(),
    entered = deferred();
  if (!holdBoot) boot.resolve();
  let raw = stored,
    failWrites = denied,
    counter = 0,
    imageId = 0;
  const storage = {
    getItem(key) {
      reads.push(key);
      assert.ok([DISPLAY_PREFERENCES_KEY, 'xonix.motion-lab.collection.v1'].includes(key));
      if (denied) throw new Error('Storage unavailable');
      return key === DISPLAY_PREFERENCES_KEY ? raw : null;
    },
    setItem(key, value) {
      writes.push([key, value]);
      assert.equal(
        key,
        DISPLAY_PREFERENCES_KEY,
        'These display actions must not save the separate lab collection or a player profile.',
      );
      if (failWrites) throw new Error('Storage unavailable');
      raw = value;
    },
  };
  host.localStorage = storage;
  host.matchMedia = () => media;
  host.requestAnimationFrame = (fn) => {
    const id = ++counter;
    frames.set(id, fn);
    return id;
  };
  host.cancelAnimationFrame = (id) => {
    if (frames.has(id)) cancelled.push(frames.get(id));
    frames.delete(id);
  };
  const globals = new Map();
  const set = (key, value) => {
    if (!globals.has(key)) globals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  };
  set('document', doc);
  set('window', host);
  set('localStorage', storage);
  set('RevealLineToolLaunch', undefined);
  set('location', { origin: 'https://motion.test' });
  set('matchMedia', host.matchMedia);
  set('requestAnimationFrame', host.requestAnimationFrame);
  set('cancelAnimationFrame', host.cancelAnimationFrame);
  set(
    'URL',
    class extends NativeURL {
      constructor(value, base) {
        const url = new NativeURL(value, base);
        // A modeled HTTP origin preserves the production same-origin image policy.
        // It changes transport only, never the actual presets/recipes under test.
        if (url.href.startsWith(route.href))
          return new NativeURL(
            url.href.slice(route.href.length),
            'https://motion.test/authoring/motion-lab/',
          );
        return url;
      }
      static createObjectURL(blob) {
        const url = `blob:motion-test/${++imageId}`;
        objectURLs.push({ url, blob });
        return url;
      }
      static revokeObjectURL(url) {
        revoked.push(url);
      }
    },
  );
  set(
    'Image',
    class {
      naturalWidth = 64;
      naturalHeight = 64;
      constructor() {
        images.push(this);
      }
      set src(value) {
        this.url = value;
      }
      get src() {
        return this.url;
      }
      removeAttribute(name) {
        if (name === 'src') this.url = '';
      }
    },
  );
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
  const jobs = [];
  set('fetch', (url, options) => {
    requests.push({ url: String(url), signal: options?.signal });
    entered.resolve();
    const job = (async () => {
      await boot.promise;
      if (failBoot) throw new Error('Study unavailable');
      const name = new NativeURL(url).pathname.split('/').at(-1);
      return {
        ok: true,
        json: async () => {
          const value = JSON.parse(await readFile(new NativeURL(name, route), 'utf8'));
          // Authored fixture presets still pass the real application validators.
          return name === 'ability-presets.json' ? prepareAbility(value) : value;
        },
      };
    })();
    jobs.push(job);
    job.catch(() => {});
    return job;
  });
  let appPromise;
  let delivery = null,
    launcherDirectory = null,
    launcherContext = null;
  const startupTimers = new Map();
  let launchStarted = false,
    launchError = null;
  const startApp = () =>
    (appPromise ??= import(
      `${new NativeURL(appScript.attrs['data-module'], route).href}?motionApp=${++serial}`
    ));
  const deliveryDone = () =>
    delivery?.finished ||
    (!delivery?.started && (doc.documentElement.dataset.toolState === 'error' || launchError));
  const waitDelivery = async () => {
    await waitFor(deliveryDone, {
      message: 'Motion module delivery did not complete or report failure.',
    });
    if (delivery?.job) await Promise.allSettled([delivery.job]);
    await waitFor(() => startupTimers.size === 0, {
      message: 'Real launcher did not settle after module delivery.',
    });
  };
  const waitReady = async (module) => {
    if (module.ready) await module.ready;
    else
      await waitFor(() => ['ready', 'error'].includes($('motion-load-status').dataset.state), {
        message: 'Motion startup must settle',
      });
  };
  t.after(async () => {
    try {
      // Complete owned startup, including held JSON work, before restoring any
      // globals. Failure must still reach the finally cleanup below.
      if (delivery) {
        delivery.closed = true;
        delivery.gate.resolve();
      }
      boot.resolve();
      if (launchStarted) await waitDelivery();
      if (appPromise) {
        const result = await Promise.allSettled([appPromise]);
        if (result[0].status === 'fulfilled') await waitReady(result[0].value);
      }
      await Promise.allSettled(jobs);
    } finally {
      try {
        host.emit('pagehide', { persisted: false });
      } finally {
        frames.clear();
        for (const [key, value] of globals)
          value ? Object.defineProperty(globalThis, key, value) : delete globalThis[key];
        if (launcherDirectory) await rm(launcherDirectory, { recursive: true, force: true });
      }
    }
  });
  if (entries[0])
    await import(`${new NativeURL(entries[0].attrs.src, route).href}?motionEntry=${++serial}`);
  // This real later cosmetic mount must have no competing text-size writer.
  const surfaces = scripts.find((script) => script.attrs.src?.endsWith('/field-kit-surfaces.mjs'));
  if (surfaces)
    await import(`${new NativeURL(surfaces.attrs.src, route).href}?motionSurface=${++serial}`);
  if (withLauncher) {
    assert.equal(entries.length, 1, 'Actual HTML provides one independent display entry.');
    assert.ok(entries[0].offset < appScript.offset);
    const script = doc.querySelector('script[data-module]');
    assert.equal(script.dataset.module, 'app.js');
    const launcher = await readFile(new NativeURL(appScript.attrs.src, route), 'utf8');
    launcherDirectory = await mkdtemp(join(tmpdir(), 'revealline-motion-startup-'));
    delivery = {
      gate: deferred(),
      started: false,
      finished: false,
      closed: false,
      job: null,
      error: null,
      load: startApp,
    };
    const key = `motionDelivery${++serial}`;
    set(key, delivery);
    // This temporary module models delivery only. Both HTML-selected display
    // and the actual classic launcher/application execute their real bodies.
    await writeFile(
      join(launcherDirectory, 'app.js'),
      `
const owner = globalThis[${JSON.stringify(key)}];
if (owner) {
  owner.started = true;
  owner.job = (async () => {
    await owner.gate.promise;
    if (owner.closed) return;
    ${failModule ? "throw new Error('Motion application graph unavailable');" : 'await owner.load();'}
  })();
  try { await owner.job; }
  catch (error) { owner.error = String(error.message || error); throw error; }
  finally { owner.finished = true; }
}
`,
    );
    // A temporary package boundary makes the wrapper's .js module explicit on
    // both supported Node versions; production module bytes are not rewritten.
    await writeFile(join(launcherDirectory, 'package.json'), '{"type":"module"}');
    doc.baseURI = pathToFileURL(join(launcherDirectory, 'index.html')).href;
    doc.readyState = 'complete';
    doc.currentScript = script;
    let timerId = 0;
    launcherContext = createContext({
      document: doc,
      URL: NativeURL,
      String,
      Object,
      setTimeout(callback) {
        startupTimers.set(++timerId, callback);
        return timerId;
      },
      clearTimeout(id) {
        startupTimers.delete(id);
      },
      addEventListener: host.addEventListener.bind(host),
    });
    launcherContext.launchMotion = () => {
      assert.equal(launchStarted, false, 'One actual launcher owns application delivery.');
      launchStarted = true;
      try {
        new Script(launcher, {
          filename: 'direct-tool-launch.js',
          importModuleDynamically: constants.USE_MAIN_CONTEXT_DEFAULT_LOADER,
        }).runInContext(launcherContext);
        set('RevealLineToolLaunch', launcherContext.RevealLineToolLaunch);
      } catch (error) {
        launchError = error;
        throw error;
      }
    };
  }
  return {
    doc,
    host,
    media,
    $,
    frames,
    cancelled,
    images,
    observers,
    writes,
    reads,
    requests,
    revoked,
    objectURLs,
    entries,
    appScript,
    scripts,
    boot,
    entered,
    get raw() {
      return raw;
    },
    set failWrites(value) {
      failWrites = value;
    },
    async start() {
      assert.equal(withLauncher, false, 'Launcher cases cannot bypass delivery.');
      return startApp();
    },
    async settled() {
      if (withLauncher) {
        assert.ok(launchStarted, 'Start the actual launcher first.');
        await waitDelivery();
        if (appPromise) await waitReady(await appPromise);
      } else await waitReady(await this.start());
    },
    launch() {
      assert.ok(launcherContext);
      launcherContext.launchMotion();
    },
    async moduleStarted() {
      await waitFor(
        () => delivery?.started || doc.documentElement.dataset.toolState === 'error' || launchError,
        { message: 'Motion module wrapper did not start or report failure.' },
      );
      assert.ok(delivery.started);
    },
    slow() {
      assert.equal(startupTimers.size, 1);
      [...startupTimers.values()][0]();
    },
    async deliver() {
      delivery.gate.resolve();
      await waitDelivery();
    },
    reload() {
      return (
        doc.querySelectorAll('a').find((node) => node.textContent === 'Reload this tool') ?? null
      );
    },
    async ready() {
      await this.settled();
      assert.equal($('motion-load-status').dataset.state, 'ready');
    },
    external(patch, notify = true) {
      raw = encode(patch);
      if (notify)
        host.emit('storage', { key: DISPLAY_PREFERENCES_KEY, storageArea: storage, newValue: raw });
    },
    change(id, value, type = 'change') {
      $(id).value = value;
      $(id).emit(type);
    },
    cap(value, notify = true) {
      media.matches = value;
      if (notify) media.emit('change');
    },
    tick(time) {
      assert.equal(frames.size, 1, 'Exactly one owned frame is runnable');
      const [id, fn] = frames.entries().next().value;
      frames.delete(id);
      fn(time);
    },
    key(code, repeat = false) {
      host.emit('keydown', { target: $('arena'), code, repeat });
    },
  };
}
function policy(h, face, size, effects) {
  assert.equal(h.doc.body.dataset.textFace, face);
  assert.equal(h.doc.body.dataset.textSize, size);
  assert.equal(h.doc.body.dataset.effects, effects);
}
function freezeView(h) {
  return {
    queue: h.$('turn-queue').textContent,
    classId: h.$('ability-class').value,
    link: h.$('ability-equipment').value,
    scale: h.$('character-scale').value,
    recipe: h.$('animation-recipe').value,
    character: h.$('character').value,
    context: h.$('collection-context').value,
    blades: h.$('blade-count').value,
    shape: h.$('blade-shape').value,
    radius: h.$('rotor-radius').value,
    speed: h.$('cruise-speed').value,
    terrain: h.$('terrain-layer').value,
  };
}

test('Motion HTML adopts reading policy before held app startup with one explicit size writer', async (t) => {
  const h = await harness(t, {
    stored: encode({ textFace: 'plain', textSize: 'large' }),
    holdBoot: true,
  });
  assert.equal(h.entries.length, 1);
  assert.ok(
    h.entries[0].offset <
      Math.min(...h.scripts.filter((s) => s !== h.entries[0]).map((s) => s.offset)),
  );
  policy(h, 'plain', 'large', 'full');
  assert.equal(h.doc.querySelectorAll('[data-field-kit-text-size]').length, 0);
  await h.start();
  await h.entered.promise;
  assert.equal(h.$('motion-load-status').dataset.state, 'busy');
  const control = h.$('motion-text-size');
  control.focus();
  h.change('motion-text-size', 'standard');
  assert.equal(h.writes.length, 1);
  policy(h, 'plain', 'standard', 'full');
  h.boot.resolve();
  await h.settled();
  assert.equal(h.$('motion-load-status').dataset.state, 'ready');
  assert.equal(h.doc.activeElement, control);
  assert.equal(h.$('motion-text-size'), control);
  assert.equal(h.writes.length, 1);
});

test('Motion failed app startup retains independent size controls and failed-save intent', async (t) => {
  const h = await harness(t, { failBoot: true });
  await h.start();
  await h.settled();
  assert.equal(h.$('motion-load-status').dataset.state, 'error');
  assert.equal(h.$('motion-text-size').disabled, false);
  h.failWrites = true;
  h.$('motion-text-size').focus();
  h.change('motion-text-size', 'large');
  assert.match(h.$('motion-display-notice').textContent, /could not be saved/);
  applyFieldKitCopy(h.doc);
  h.external({ textFace: 'plain', textSize: 'standard' });
  h.host.emit('pageshow', { persisted: true });
  policy(h, 'pixel', 'large', 'full');
  assert.match(h.$('motion-display-notice').textContent, /could not be saved/);
  assert.equal(h.doc.activeElement, h.$('motion-text-size'));
  assert.equal(h.frames.size, 0);
});

test('Motion saved and system reduction cap local choice without changing live run or authored values', async (t) => {
  const h = await harness(t);
  await h.ready();
  h.change('turn-policy', 'grid-center');
  h.$('play-pause').click();
  h.key('KeyD');
  h.change('character-scale', '1.4', 'input');
  h.change('blade-count', '4');
  h.$('boost').emit('pointerdown', { button: 0, pointerId: 7 });
  h.tick(100);
  h.tick(200);
  const before = freezeView(h),
    frame = [...h.frames.keys()][0],
    focus = h.$('blade-count');
  const arena = h.$('arena'),
    inspection = h.$('inspection');
  focus.focus();
  h.external({ textFace: 'plain', textSize: 'large', reducedEffects: true });
  assert.deepEqual(freezeView(h), before);
  assert.equal(h.$('play-pause').textContent, 'Pause');
  assert.equal(h.$('arena'), arena);
  assert.equal(h.$('inspection'), inspection);
  assert.equal(h.$('reduced-motion').checked, false);
  assert.match(h.$('rotor-state').textContent, /frozen/);
  assert.equal(h.$('boost').getAttribute('aria-pressed'), 'true');
  assert.equal(h.doc.activeElement, focus);
  assert.deepEqual([...h.frames.keys()], [frame]);
  const fonts = h.$('arena').context.calls.filter((call) => call.property === 'font');
  assert.match(
    fonts.at(-1).value,
    /^500 0\.9px system-ui/,
    'Real app maps Plain/Large to 18 CSS-pixel canvas labels',
  );
  h.cap(true);
  h.external({ reducedEffects: false });
  assert.match(h.$('rotor-state').textContent, /frozen/);
  h.cap(false);
  assert.doesNotMatch(h.$('rotor-state').textContent, /frozen/);
  assert.equal(h.$('reduced-motion').checked, false);
  assert.equal(h.writes.length, 0);
  h.tick(300);
  assert.notEqual(h.$('turn-queue').textContent, before.queue);
});

test('Motion local reduced choice survives shared caps and paused preference edits do not resume', async (t) => {
  const h = await harness(t, { reduced: true });
  await h.ready();
  assert.equal(h.$('play-pause').textContent, 'Play');
  assert.equal(h.frames.size, 0);
  assert.equal(h.$('reduced-motion').checked, false);
  h.$('reduced-motion').checked = true;
  h.$('reduced-motion').emit('change');
  h.cap(false);
  h.external({ textSize: 'large', textFace: 'plain' });
  assert.equal(h.$('reduced-motion').checked, true);
  assert.match(h.$('rotor-state').textContent, /frozen/);
  assert.equal(h.frames.size, 0);
  assert.equal(h.$('play-pause').textContent, 'Play');
  h.$('play-pause').click();
  assert.equal(h.frames.size, 1);
  h.$('reduced-motion').checked = false;
  h.$('reduced-motion').emit('change');
  assert.equal(h.$('play-pause').textContent, 'Pause');
  assert.equal(h.frames.size, 1);
  assert.equal(h.writes.length, 0);
});

const backgroundFixtures = new NativeURL('./fixtures/motion-background/', import.meta.url);
async function backgroundFile(name, type = 'image/png') {
  const bytes = await readFile(new NativeURL(name, backgroundFixtures));
  return Object.assign(new Blob([bytes], { type }), { name });
}
function selectBackground(h, file) {
  h.$('background-file').files = [file];
  h.$('background-file').emit('change');
}
async function uploadBackground(h, name, type = 'image/png') {
  const before = h.objectURLs.length;
  selectBackground(h, await backgroundFile(name, type));
  await waitFor(() => h.objectURLs.length > before, {
    message: 'Real background preparation must produce a modeled native-image source',
  });
  return h.images.at(-1);
}
const settleBackground = () => new Promise((resolve) => setImmediate(resolve));

test('Motion loaded body and local background survive reading changes and cached return', async (t) => {
  const h = await harness(t);
  await h.ready();
  const body = h.images.find((image) => image.src.startsWith('https:'));
  assert.ok(body);
  body.onload();
  const background = await uploadBackground(h, 'static-default.png');
  background.onload();
  h.$('play-pause').click();
  const before = freezeView(h);
  const arena = h.$('arena'),
    inspection = h.$('inspection'),
    policyPaintStart = arena.context.calls.length;
  h.external({ textFace: 'plain', textSize: 'large' });
  const policyPaints = arena.context.calls
    .slice(policyPaintStart)
    .filter((call) => call.op === 'drawImage')
    .map((call) => call.args[0]);
  assert.ok(policyPaints.includes(body));
  assert.ok(policyPaints.includes(background));
  h.host.emit('pagehide', { persisted: true });
  h.external({ textFace: 'pixel', textSize: 'standard' }, false);
  h.cap(true, false);
  const returnPaintStart = arena.context.calls.length;
  h.host.emit('pageshow', { persisted: true });
  policy(h, 'pixel', 'standard', 'reduced');
  assert.deepEqual(freezeView(h), before);
  assert.equal(h.frames.size, 0);
  assert.equal(h.$('play-pause').textContent, 'Play');
  assert.equal(h.revoked.includes(background.src), false);
  assert.equal(h.$('arena'), arena);
  assert.equal(h.$('inspection'), inspection);
  const painted = arena.context.calls
    .slice(returnPaintStart)
    .filter((call) => call.op === 'drawImage')
    .map((call) => call.args[0]);
  assert.ok(painted.includes(body));
  assert.ok(painted.includes(background));
  assert.equal(h.$('inspection-status').hidden, true);
});

test('Motion interruption before pending startup prevents automatic start and stale frames cannot return', async (t) => {
  const h = await harness(t, { holdBoot: true });
  await h.start();
  await h.entered.promise;
  h.host.emit('blur');
  h.boot.resolve();
  await h.settled();
  assert.equal(h.$('play-pause').textContent, 'Play');
  assert.equal(h.frames.size, 0);
  h.change('turn-policy', 'grid-center');
  h.$('play-pause').click();
  h.key('KeyD');
  h.tick(100);
  h.tick(200);
  h.$('boost').emit('pointerdown', { button: 0, pointerId: 4 });
  h.host.emit('pagehide', { persisted: true });
  assert.equal(h.frames.size, 0);
  assert.equal(h.$('boost').hasPointerCapture(4), false);
  const stale = h.cancelled.at(-1),
    before = freezeView(h);
  h.host.emit('pageshow', { persisted: true });
  stale(50000);
  assert.equal(h.frames.size, 0);
  assert.deepEqual(freezeView(h), before);
  h.$('play-pause').click();
  const id = [...h.frames.keys()][0];
  stale(51000);
  assert.deepEqual([...h.frames.keys()], [id]);
  h.tick(60000);
  assert.deepEqual(freezeView(h), before, 'First resumed frame must not spend time away');
});

test('Motion terminal departure fences held initialization and leaves no authority or app listeners', async (t) => {
  const h = await harness(t, { holdBoot: true });
  await h.start();
  await h.entered.promise;
  const status = h.$('motion-load-status').textContent;
  h.host.emit('pagehide', { persisted: false });
  h.boot.resolve();
  await h.settled();
  assert.equal(h.$('motion-load-status').textContent, status);
  assert.equal(h.frames.size, 0);
  assert.ok(h.requests.every((request) => request.signal.aborted));
  h.external({ textSize: 'large' });
  h.cap(true);
  h.change('motion-text-size', 'large');
  policy(h, 'pixel', 'standard', 'full');
  assert.equal(h.writes.length, 0);
  for (const event of ['blur', 'pagehide', 'pageshow', 'storage', 'keydown', 'keyup'])
    assert.equal(h.host.listeners.get(event)?.size ?? 0, 0, event);
  assert.equal(h.doc.listeners.get('visibilitychange')?.size ?? 0, 0);
  assert.equal(h.media.listeners.get('change')?.size ?? 0, 0);
});

test('Motion hidden and terminal loaded lifecycle cancels images, releases input and disconnects observer', async (t) => {
  const h = await harness(t);
  await h.ready();
  const pending = await uploadBackground(h, 'static-default.png'),
    late = pending.onload,
    url = pending.src;
  h.doc.hidden = true;
  h.doc.emit('visibilitychange');
  assert.equal(h.frames.size, 0);
  h.doc.hidden = false;
  h.doc.emit('visibilitychange');
  assert.equal(h.frames.size, 0);
  h.host.emit('pagehide', { persisted: false });
  const status = h.$('background-status').textContent,
    paints = h.$('arena').context.calls.length;
  late();
  h.observers[0].callback();
  h.$('play-pause').click();
  h.key('KeyD');
  assert.equal(h.frames.size, 0);
  assert.equal(h.$('background-status').textContent, status);
  assert.equal(h.$('arena').context.calls.length, paints);
  assert.ok(h.revoked.includes(url));
  assert.equal(h.observers[0].disconnected, true);
});

test('Motion unavailable inspection image is described in ordinary DOM and storage denial remains session-only', async (t) => {
  const h = await harness(t, { denied: true });
  await h.ready();
  const body = h.images.find((image) => image.src.startsWith('https:'));
  body.onerror();
  assert.equal(h.$('inspection-status').hidden, false);
  assert.match(h.$('inspection-status').textContent, /Body unavailable/);
  assert.equal(h.$('inspection').getAttribute('aria-describedby'), 'inspection-status');
  assert.equal(
    h.$('inspection').context.calls.some((call) => call.op === 'fillText'),
    false,
  );
  h.change('motion-text-size', 'large');
  policy(h, 'pixel', 'large', 'full');
  assert.match(h.$('motion-display-notice').textContent, /could not be saved/);
  assert.equal(h.writes.length, 1);
});

test('Motion application graph completing after terminal departure cannot remount or fetch', async (t) => {
  const h = await harness(t);
  const before = h.doc.body.textContent;
  h.host.emit('pagehide', { persisted: false });
  await h.start();
  await h.settled();
  assert.equal(h.requests.length, 0);
  assert.equal(h.frames.size, 0);
  assert.equal(h.doc.body.textContent, before);
  assert.equal(h.reads.includes('xonix.motion-lab.collection.v1'), false);
});

test('Motion graph first arriving in an unfocused document starts paused until explicit Play', async (t) => {
  const h = await harness(t);
  h.doc.focused = false;
  await h.ready();
  assert.equal(h.$('play-pause').textContent, 'Play');
  assert.equal(h.frames.size, 0);
  h.doc.focused = true;
  h.host.emit('focus');
  assert.equal(h.frames.size, 0);
  h.$('play-pause').click();
  assert.equal(h.frames.size, 1);
});

test('Motion cached interruption before first application delivery cannot autoplay before or after return', async (t) => {
  const h = await harness(t);
  h.host.emit('pagehide', { persisted: true });
  // Visible/focused flags can already look normal when the delayed application
  // first evaluates. Entry-owned interruption, not those flags, must win.
  assert.equal(h.doc.hidden, false);
  assert.equal(h.doc.hasFocus(), true);
  await h.ready();
  assert.equal(h.$('play-pause').textContent, 'Play');
  assert.equal(h.frames.size, 0);
  h.$('play-pause').click();
  assert.equal(h.frames.size, 0, 'An away document cannot accept a running request');
  h.host.emit('pageshow', { persisted: true });
  assert.equal(h.$('play-pause').textContent, 'Play');
  assert.equal(h.frames.size, 0);
  h.$('play-pause').click();
  assert.equal(h.frames.size, 1);
  h.tick(100);
  assert.equal(h.frames.size, 1);
  h.host.emit('pagehide', { persisted: false });
  for (const type of ['blur', 'pagehide', 'pageshow', 'storage'])
    assert.equal(h.host.listeners.get(type)?.size ?? 0, 0, type);
  assert.equal(h.doc.listeners.get('visibilitychange')?.size ?? 0, 0);
});

function studyLocked(h, locked) {
  assert.equal(h.$('motion-study').disabled, locked);
  assert.equal(h.$('arena').getAttribute('tabindex'), locked ? '-1' : '0');
  assert.equal(h.$('arena').getAttribute('aria-disabled'), String(locked));
  assert.equal(h.$('arena').hasAttribute('inert'), locked);
  assert.equal(h.$('motion-text-size').disabled, false);
  assert.equal(h.$('motion-text-size').closest('fieldset'), null);
  const back = h.doc.querySelectorAll('a').find((node) => node.textContent === 'Return to game');
  assert.ok(
    back && !back.closest('fieldset'),
    'Return navigation remains outside the startup gate.',
  );
}

for (const blurToBody of [false, true]) {
  test(`Motion real launcher retires Reload into independent reading controls while presets stay locked (${blurToBody ? 'body' : 'anchor'} focus model)`, async (t) => {
    const h = await harness(t, {
      withLauncher: true,
      holdBoot: true,
      reduced: true,
      stored: encode({ textFace: 'plain', textSize: 'large' }),
    });
    studyLocked(h, true);
    h.$('motion-text-size').focus();
    h.$('arena').focus();
    assert.ok(
      h.doc.activeElement === h.$('motion-text-size'),
      'The modeled inert arena cannot take startup focus.',
    );
    assert.equal(h.frames.size, 0);
    h.launch();
    await h.moduleStarted();
    h.slow();
    assert.match(h.$('motion-load-status').textContent, /Still loading/);
    const reload = h.reload();
    reload.focus();
    if (blurToBody) {
      let hidden = reload.hidden;
      Object.defineProperty(reload, 'hidden', {
        configurable: true,
        get: () => hidden,
        set(value) {
          hidden = value;
          if (value && h.doc.activeElement === reload) h.doc.activeElement = h.doc.body;
        },
      });
    }
    h.external({ textFace: 'plain', textSize: 'large' });
    assert.equal(h.requests.length, 0, 'Held application delivery has not started preset reads.');
    await h.deliver();
    assert.equal(h.requests.length, 3);
    assert.equal(reload.hidden, true);
    assert.equal(
      h.$('motion-retry').hidden,
      true,
      'Pending presets do not offer a failed-study retry.',
    );
    assert.ok(h.doc.activeElement === h.$('motion-text-size'));
    studyLocked(h, true);
    assert.equal(h.$('motion-load-status').dataset.state, 'busy');
    h.change('motion-text-size', 'standard');
    policy(h, 'plain', 'standard', 'reduced');
    assert.equal(h.writes.length, 1);
    assert.equal(h.frames.size, 0);
    h.boot.resolve();
    await h.ready();
    assert.equal(h.$('motion-retry').hidden, true, 'Successful setup keeps its retry hidden.');
    studyLocked(h, false);
    assert.equal(
      h.$('clear-background').disabled,
      true,
      'Unlocking the group preserves Clear without a background.',
    );
    assert.equal(h.frames.size, 0, 'Reduced preview still waits for explicit Play.');
    assert.ok(h.doc.activeElement === h.$('motion-text-size'));
    h.$('play-pause').click();
    assert.equal(h.frames.size, 1);
  });
}

test('Motion real launcher graph failure retains locked study, Reload, navigation and the independent size writer', async (t) => {
  const h = await harness(t, { withLauncher: true, failModule: true });
  h.launch();
  await h.moduleStarted();
  const back = h.doc.querySelectorAll('a').find((node) => node.textContent === 'Return to game');
  back.focus();
  await h.deliver();
  assert.equal(h.$('motion-load-status').dataset.state, 'error');
  assert.match(
    h.$('motion-load-status').textContent,
    /could not start.*Motion application graph unavailable/,
  );
  assert.equal(h.reload().hidden, false);
  assert.equal(
    h.$('motion-retry').hidden,
    true,
    'Graph failure keeps only its existing launcher retry.',
  );
  assert.equal(h.reload().href, h.doc.baseURI);
  studyLocked(h, true);
  assert.equal(h.requests.length, 0);
  assert.equal(h.frames.size, 0);
  assert.ok(h.doc.activeElement === back);
  h.change('motion-text-size', 'large');
  policy(h, 'pixel', 'large', 'full');
  assert.equal(h.writes.length, 1);
  assert.ok(h.reads.every((key) => key === DISPLAY_PREFERENCES_KEY));
});

for (const failure of ['network', 'validation']) {
  test(`Motion ${failure} failure after actual delivery provides retry without taking current focus`, async (t) => {
    const h = await harness(t, {
      withLauncher: true,
      failBoot: failure === 'network',
      prepareAbility: (value) =>
        failure === 'validation' ? { ...value, version: 'invalid' } : value,
    });
    const owner =
      failure === 'network'
        ? h.$('motion-text-size')
        : h.doc.querySelectorAll('a').find((node) => node.textContent === 'Return to game');
    owner.focus();
    h.launch();
    await h.moduleStarted();
    h.slow();
    await h.deliver();
    await h.settled();
    const retry = h.$('motion-retry');
    assert.ok(retry && !retry.hidden, 'Preset failure provides an available in-tool retry.');
    assert.equal(retry.closest('fieldset'), null);
    assert.equal(retry.getAttribute('href'), './');
    assert.equal(
      retry.getAttribute('tabindex'),
      null,
      'The authored link uses normal sequential focus.',
    );
    assert.equal(
      h.reload().hidden,
      true,
      'Retired module Reload does not compete with preset retry.',
    );
    assert.equal(h.requests.length, 3);
    assert.equal(h.$('motion-load-status').dataset.state, 'error');
    assert.match(h.$('motion-load-status').textContent, /Reload this page to retry/);
    assert.equal(retry.textContent, 'Retry loading study');
    studyLocked(h, true);
    assert.equal(h.frames.size, 0);
    assert.ok(h.doc.activeElement === owner);
    h.change('motion-text-size', 'large');
    policy(h, 'pixel', 'large', 'full');
    assert.equal(h.writes.length, 1);
    retry.focus();
    assert.ok(h.doc.activeElement === retry, 'The retry remains outside the disabled study.');
  });
}

test('Motion terminal departure ignores a late failed preset read without exposing retry', async (t) => {
  const h = await harness(t, { withLauncher: true, holdBoot: true, failBoot: true });
  h.launch();
  await h.moduleStarted();
  await h.deliver();
  const back = h.doc.querySelectorAll('a').find((node) => node.textContent === 'Return to game');
  back.focus();
  h.host.emit('pagehide', { persisted: false });
  const status = h.$('motion-load-status').textContent;
  h.boot.resolve();
  await h.settled();
  assert.equal(h.$('motion-retry').hidden, true);
  assert.equal(h.$('load-error').hidden, true);
  assert.equal(h.$('motion-load-status').textContent, status);
  assert.equal(h.frames.size, 0);
  assert.ok(h.doc.activeElement === back);
  studyLocked(h, true);
});

for (const inactive of ['hidden', 'unfocused']) {
  test(`Motion real launcher does not take Reload focus in an ${inactive} document or defer it until return`, async (t) => {
    const h = await harness(t, { withLauncher: true });
    h.launch();
    await h.moduleStarted();
    h.slow();
    const reload = h.reload(),
      size = h.$('motion-text-size');
    reload.focus();
    let focuses = 0;
    const focus = size.focus.bind(size);
    size.focus = () => {
      focuses++;
      focus();
    };
    h.doc.hidden = inactive === 'hidden';
    h.doc.focused = inactive !== 'unfocused';
    await h.deliver();
    await h.ready();
    assert.equal(reload.hidden, true);
    assert.equal(focuses, 0);
    assert.ok(h.doc.activeElement === reload);
    studyLocked(h, false);
    assert.equal(h.frames.size, 0);
    h.doc.hidden = false;
    h.doc.focused = true;
    h.doc.emit('visibilitychange');
    h.host.emit('focus');
    h.host.emit('pageshow', { persisted: true });
    assert.equal(focuses, 0);
    assert.equal(h.frames.size, 0, 'Returning does not grant Play intent.');
    h.$('play-pause').click();
    assert.equal(h.frames.size, 1);
  });
}

for (const timing of ['before', 'during']) {
  test(`Motion actual Reload retirement preserves navigation focus acquired ${timing} attachment`, async (t) => {
    const h = await harness(t, { withLauncher: true, reduced: true });
    h.launch();
    await h.moduleStarted();
    h.slow();
    const reload = h.reload(),
      size = h.$('motion-text-size');
    const back = h.doc.querySelectorAll('a').find((node) => node.textContent === 'Return to game');
    reload.focus();
    let focuses = 0,
      retirements = 0;
    const focus = size.focus.bind(size);
    size.focus = () => {
      focuses++;
      focus();
    };
    if (timing === 'before') back.focus();
    else {
      // Explicit modeled reentrant hide/blur boundary, not native blur evidence.
      let hidden = reload.hidden;
      Object.defineProperty(reload, 'hidden', {
        configurable: true,
        get: () => hidden,
        set(value) {
          const retiring = !hidden && value && h.doc.activeElement === reload;
          hidden = value;
          if (retiring) {
            retirements++;
            h.doc.activeElement = h.doc.body;
            back.focus();
          }
        },
      });
    }
    await h.deliver();
    await h.ready();
    assert.equal(retirements, timing === 'during' ? 1 : 0);
    assert.equal(reload.hidden, true);
    assert.equal(focuses, 0);
    assert.ok(h.doc.activeElement === back);
    studyLocked(h, false);
    assert.equal(h.frames.size, 0);
    assert.deepEqual(h.writes, []);
  });
}

test('Motion successful startup gate preserves Clear, locked Equip and disabled ability ownership', async (t) => {
  const h = await harness(t, { withLauncher: true, reduced: true });
  h.launch();
  await h.moduleStarted();
  await h.deliver();
  await h.ready();
  studyLocked(h, false);
  assert.equal(h.$('clear-background').disabled, true);
  h.change('character', 'fpv-racer');
  assert.equal(
    h.$('equip-character').disabled,
    true,
    'Earned craft remains locked in a fresh lab profile.',
  );
  h.$('ability-enabled').checked = false;
  h.$('ability-enabled').emit('change');
  assert.equal(h.$('ability-action').disabled, true);
  assert.equal(h.$('ability-pickup').disabled, true);
  h.external({ textFace: 'plain', textSize: 'large' });
  h.cap(false);
  studyLocked(h, false);
  assert.equal(h.$('clear-background').disabled, true);
  assert.equal(h.$('equip-character').disabled, true);
  assert.equal(h.$('ability-action').disabled, true);
  assert.equal(h.$('ability-pickup').disabled, true);
  assert.deepEqual(h.writes, []);
});

test('Motion real launcher late application delivery after terminal departure cannot unlock or focus the departed study', async (t) => {
  const h = await harness(t, { withLauncher: true });
  h.launch();
  await h.moduleStarted();
  h.slow();
  const reload = h.reload(),
    size = h.$('motion-text-size');
  reload.focus();
  let focuses = 0;
  const focus = size.focus.bind(size);
  size.focus = () => {
    focuses++;
    focus();
  };
  const status = h.$('motion-load-status').textContent;
  h.host.emit('pagehide', { persisted: false });
  await h.deliver();
  await h.settled();
  studyLocked(h, true);
  assert.equal(h.requests.length, 0);
  assert.equal(h.frames.size, 0);
  assert.equal(focuses, 0);
  assert.equal(h.$('motion-load-status').textContent, status);
  h.change('motion-text-size', 'large');
  assert.deepEqual(h.writes, []);
});

test('Motion full stage labels survive shortened canvas captions and reading changes without moving focus or replacing rows', async (t) => {
  const fullLabel = 'Ґанок · Єдність · Імпульс · Їжак · I l 1 · О O 0 · ʼ ’ — '.repeat(12);
  const h = await harness(t, {
    prepareAbility(config) {
      config.stage.targets.find((target) => target.id === 'tile-a').label = fullLabel;
      return config;
    },
  });
  await h.ready();
  const legend = h.$('ability-stage-legend');
  const list = h.$('ability-stage-labels');
  const row = list.querySelector('[data-ability-label="target:tile-a"]');
  assert.equal(legend.hidden, false);
  assert.ok(row.textContent.includes(fullLabel), 'The full authored text stays available in DOM.');
  assert.equal(
    legend.hasAttribute('aria-live'),
    false,
    'Moving markers must not cause continuous announcements.',
  );
  const labels = h
    .$('arena')
    .context.calls.filter((call) => call.op === 'fillText')
    .map((call) => call.args[0]);
  assert.equal(labels.includes(fullLabel), false);
  assert.ok(labels.some((text) => String(text).endsWith('…')));
  const rows = [...list.children];
  const study = freezeView(h);
  h.$('motion-text-size').focus();
  const focused = h.doc.activeElement;
  const frame = [...h.frames.keys()][0];
  h.external({ textFace: 'plain', textSize: 'large' });
  assert.deepEqual([...list.children], rows);
  assert.equal(list.querySelector('[data-ability-label="target:tile-a"]'), row);
  assert.equal(h.doc.activeElement, focused);
  assert.deepEqual(freezeView(h), study);
  assert.deepEqual([...h.frames.keys()], [frame]);
  assert.ok(row.textContent.includes(fullLabel));
  h.$('ability-enabled').checked = false;
  h.$('ability-enabled').emit('change');
  assert.equal(legend.hidden, true);
  assert.equal(list.children.length, 0, 'A hidden study leaves no stale target text.');
  assert.equal(h.doc.activeElement, focused);
  h.$('ability-enabled').checked = true;
  h.$('ability-enabled').emit('change');
  assert.equal(legend.hidden, false);
  assert.ok(list.textContent.includes(fullLabel));
  assert.equal(h.writes.length, 0);
});

test('Motion real scan reveals and expires DOM note text on the rendering frame before the general readout refresh', async (t) => {
  const secret = 'Таємна Їжакова нотатка';
  const h = await harness(t, {
    prepareAbility(config) {
      config.stage.targets.find((target) => target.id === 'note-a').label = secret;
      config.classes.find((item) => item.id === 'scout').tuning.duration = 0.125;
      return config;
    },
  });
  await h.ready();
  const list = h.$('ability-stage-labels');
  const row = list.querySelector('[data-ability-label="target:note-a"]');
  assert.ok(row.textContent.includes('Concealed note'));
  assert.equal(h.doc.body.textContent.includes(secret), false);
  h.key('KeyE');
  assert.ok(row.textContent.includes(secret));
  assert.match(h.$('ability-readout').textContent, /0 markers updated · 1 notes visible/);
  h.tick(100);
  h.tick(200);
  assert.ok(row.textContent.includes(secret));
  h.$('arena').context.calls.length = 0;
  h.tick(234); // Cross the authoritative 120 Hz expiry before the 80 ms readout tick.
  assert.equal(list.querySelector('[data-ability-label="target:note-a"]'), row);
  assert.ok(row.textContent.includes('Concealed note'));
  assert.equal(h.doc.body.textContent.includes(secret), false);
  assert.equal(row.getAttribute('title'), null);
  assert.equal(row.getAttribute('aria-label'), null);
  assert.match(
    h.$('ability-readout').textContent,
    /1 notes visible/,
    'The general readout deliberately has not refreshed in these 34 ms.',
  );
  const painted = h
    .$('arena')
    .context.calls.filter((call) => call.op === 'fillText')
    .map((call) => call.args[0]);
  assert.equal(painted.includes(secret), false);
  assert.ok(painted.includes('?'));
  h.tick(300);
  assert.match(h.$('ability-readout').textContent, /0 markers updated · 0 notes visible/);
  assert.equal(h.writes.length, 0);
});

test('Motion APNG upload derives exact static PNG bytes while retaining the original File', async (t) => {
  const h = await harness(t);
  await h.ready();
  const file = await backgroundFile('animated-separate-default.png'),
    original = await file.arrayBuffer();
  selectBackground(h, file);
  await waitFor(() => h.objectURLs.length === 1);
  const preview = h.objectURLs[0].blob;
  assert.notEqual(preview, file);
  assert.equal(preview.type, 'image/png');
  assert.deepEqual(
    Buffer.from(await preview.arrayBuffer()),
    await readFile(new NativeURL('static-default.png', backgroundFixtures)),
  );
  assert.deepEqual(await file.arrayBuffer(), original);
  h.images.at(-1).onload();
  assert.match(h.$('background-status').textContent, /Static PNG default preview/);
});

test('Motion GIF and WebP keep the original File source and native-image path', async (t) => {
  const h = await harness(t);
  await h.ready();
  for (const [name, type] of [
    ['animated-first-frame.gif', 'image/gif'],
    ['animated-first-frame.webp', 'image/webp'],
  ]) {
    const file = await backgroundFile(name, type);
    selectBackground(h, file);
    assert.equal(h.objectURLs.at(-1).blob, file);
    h.images.at(-1).onload();
    assert.match(h.$('background-status').textContent, new RegExp(name.replaceAll('.', '\\.')));
  }
});

test('Motion superseded PNG byte read cannot allocate a URL or replace the newer preview', async (t) => {
  const h = await harness(t);
  await h.ready();
  const gate = deferred();
  selectBackground(h, {
    name: 'slow.png',
    type: 'image/png',
    size: 122,
    arrayBuffer: () => gate.promise,
  });
  assert.equal(h.objectURLs.length, 0);
  const accepted = await uploadBackground(h, 'animated-first-frame.webp', 'image/webp');
  accepted.onload();
  const status = h.$('background-status').textContent,
    urls = h.objectURLs.length;
  gate.resolve(await (await backgroundFile('static-default.png')).arrayBuffer());
  await settleBackground();
  assert.equal(h.objectURLs.length, urls);
  assert.equal(h.$('background-status').textContent, status);
  assert.equal(h.revoked.includes(accepted.src), false);
});

test('Motion Clear while reading PNG bytes prevents late URL, image and status resurrection', async (t) => {
  const h = await harness(t);
  await h.ready();
  const gate = deferred();
  selectBackground(h, {
    name: 'slow.png',
    type: 'image/png',
    size: 122,
    arrayBuffer: () => gate.promise,
  });
  h.$('clear-background').click();
  const status = h.$('background-status').textContent;
  gate.resolve(await (await backgroundFile('static-default.png')).arrayBuffer());
  await settleBackground();
  assert.equal(h.objectURLs.length, 0);
  assert.equal(h.$('clear-background').disabled, true);
  assert.equal(h.$('background-status').textContent, status);
});

for (const persisted of [true, false])
  test(`Motion ${persisted ? 'cached' : 'terminal'} departure invalidates the pending PNG byte read`, async (t) => {
    const h = await harness(t);
    await h.ready();
    const accepted = await uploadBackground(h, 'static-default.png');
    accepted.onload();
    const gate = deferred();
    selectBackground(h, {
      name: 'slow.png',
      type: 'image/png',
      size: 122,
      arrayBuffer: () => gate.promise,
    });
    h.host.emit('pagehide', { persisted });
    const status = h.$('background-status').textContent,
      urls = h.objectURLs.length;
    if (persisted) h.host.emit('pageshow', { persisted: true });
    gate.resolve(await (await backgroundFile('static-default.png')).arrayBuffer());
    await settleBackground();
    assert.equal(h.objectURLs.length, urls);
    assert.equal(h.$('background-status').textContent, status);
    assert.equal(h.frames.size, 0);
    assert.equal(h.revoked.includes(accepted.src), !persisted);
  });

test('Motion rejected or malformed PNG preparation retains accepted art, current focus and Clear', async (t) => {
  const h = await harness(t);
  await h.ready();
  const accepted = await uploadBackground(h, 'static-default.png');
  accepted.onload();
  const control = h.$('motion-text-size');
  control.focus();
  const count = h.objectURLs.length;
  selectBackground(h, {
    name: 'read-error.png',
    type: 'image/png',
    size: 122,
    arrayBuffer: async () => {
      throw new Error('Read failed');
    },
  });
  await settleBackground();
  assert.match(h.$('background-status').textContent, /could not be prepared/);
  selectBackground(h, await backgroundFile('invalid-signature-only.png'));
  await settleBackground();
  assert.match(h.$('background-status').textContent, /could not be prepared/);
  assert.equal(h.objectURLs.length, count);
  assert.equal(h.revoked.includes(accepted.src), false);
  assert.equal(h.$('clear-background').disabled, false);
  assert.equal(h.doc.activeElement, control);
});

test('Motion prepared replacement native decode failure preserves prior image and retires derivative URL', async (t) => {
  const h = await harness(t);
  await h.ready();
  const accepted = await uploadBackground(h, 'static-default.png');
  accepted.onload();
  const pending = await uploadBackground(h, 'animated-separate-default.png');
  pending.onerror();
  assert.match(h.$('background-status').textContent, /could not be decoded/);
  assert.equal(h.revoked.includes(pending.src), true);
  assert.equal(h.revoked.includes(accepted.src), false);
  assert.equal(h.$('clear-background').disabled, false);
});

test('Motion late PNG preparation rejection after a new image cannot overwrite current success', async (t) => {
  const h = await harness(t);
  await h.ready();
  let reject;
  const pending = new Promise((resolve, no) => {
    reject = no;
  });
  selectBackground(h, {
    name: 'slow-error.png',
    type: 'image/png',
    size: 122,
    arrayBuffer: () => pending,
  });
  const accepted = await uploadBackground(h, 'static-default.png');
  accepted.onload();
  const status = h.$('background-status').textContent;
  reject(new Error('Late file read failure'));
  await settleBackground();
  assert.equal(h.$('background-status').textContent, status);
  assert.equal(h.revoked.includes(accepted.src), false);
});

const sliderLabels = [
  ['rotor-radius', 'Rotor radius', 'rotor-radius-output', '16 percent of body'],
  ['character-scale', 'Character scale', 'scale-output', '1.00 times'],
  ['background-opacity', 'Background opacity', 'background-opacity-output', '28 percent'],
  ['cruise-speed', 'Cruise speed', 'speed-output', '9 cells per second'],
  ['turn-rate', 'Body turn response', 'turn-output', '360 degrees per second'],
];
function sliderLabel(h, id) {
  const input = h.$(id);
  const label = h.doc.querySelector(`label[for="${id}"]`);
  assert.ok(label, `${id} must have its own explicit visible label`);
  assert.equal(input.getAttribute('aria-labelledby'), label.id);
  assert.equal(label.querySelectorAll('output,input').length, 0);
  return label.textContent;
}

test('Motion sliders keep stable visible labels while the actual study startup is held', async (t) => {
  const h = await harness(t, { holdBoot: true });
  await h.start();
  await h.entered.promise;
  studyLocked(h, true);
  for (const [id, name, output, initial] of sliderLabels) {
    assert.equal(sliderLabel(h, id), name);
    assert.equal(h.$(id).type, 'range', 'Native range semantics and key handling stay in use');
    assert.equal(h.$(id).getAttribute('aria-valuetext'), initial);
    assert.equal(h.$(output).getAttribute('aria-hidden'), 'true');
  }
  h.boot.resolve();
  await h.ready();
  assert.equal(sliderLabel(h, 'turn-rate'), 'Body turn response');
  assert.equal(Number(h.$('turn-rate').value), 540, 'The actual preset replaces the HTML default');
  assert.equal(h.$('turn-output').textContent, '540°/s');
  assert.equal(h.$('turn-rate').getAttribute('aria-valuetext'), '540 degrees per second');
});

test('Motion slider input updates current units without changing its name, focus or paused intent', async (t) => {
  const h = await harness(t);
  await h.ready();
  h.host.emit('blur');
  assert.equal(h.frames.size, 0);
  const writes = h.writes.length;
  for (const [id, name, output, value, visible, spoken] of [
    [
      'rotor-radius',
      'Rotor radius',
      'rotor-radius-output',
      '0.28',
      '28% of body',
      '28 percent of body',
    ],
    ['character-scale', 'Character scale', 'scale-output', '1.75', '1.75×', '1.75 times'],
    [
      'background-opacity',
      'Background opacity',
      'background-opacity-output',
      '0.7',
      '70%',
      '70 percent',
    ],
    [
      'cruise-speed',
      'Cruise speed',
      'speed-output',
      '12.5',
      '12.5 cells/s',
      '12.5 cells per second',
    ],
    ['turn-rate', 'Body turn response', 'turn-output', '720', '720°/s', '720 degrees per second'],
  ]) {
    h.$(id).focus();
    h.change(id, value, 'input');
    assert.equal(sliderLabel(h, id), name);
    assert.equal(h.$(output).textContent, visible);
    assert.equal(h.$(id).getAttribute('aria-valuetext'), spoken);
    assert.equal(h.doc.activeElement, h.$(id));
    assert.equal(h.$('play-pause').textContent, 'Play');
    assert.equal(h.frames.size, 0);
  }
  assert.equal(h.writes.length, writes, 'Slider feedback does not save reading or player data');
});

test('Motion recipe replacement refreshes the rotor value text after a manual radius override', async (t) => {
  const h = await harness(t);
  await h.ready();
  h.change('rotor-radius', '0.28', 'input');
  assert.equal(h.$('rotor-radius').getAttribute('aria-valuetext'), '28 percent of body');
  h.$('animation-recipe').focus();
  h.change('animation-recipe', 'heavy-props');
  assert.equal(Number(h.$('rotor-radius').value), 0.08);
  assert.equal(h.$('rotor-radius-output').textContent, '8% of body');
  assert.equal(h.$('rotor-radius').getAttribute('aria-valuetext'), '8 percent of body');
  assert.equal(sliderLabel(h, 'rotor-radius'), 'Rotor radius');
  assert.equal(h.doc.activeElement, h.$('animation-recipe'));
});

function rotationGeometry(h) {
  h.host.innerWidth = h.doc.documentElement.clientWidth = 844;
  h.host.innerHeight = h.doc.documentElement.clientHeight = 390;
  h.host.getComputedStyle = (node) => ({
    display: node.style.display || 'block',
    visibility: node.style.visibility || 'visible',
    overflowY: node.style.overflowY || 'visible',
    overflowX: node.style.overflowX || 'visible',
  });
  const controls = h.doc.querySelector('.controls');
  controls.style.overflowY = 'auto';
  controls._rect = { x: 610, y: 55, width: 220, height: 325 };
  const target = h.$('rotor-radius'),
    field = target.closest('.range-field');
  field._rect = { x: 624, y: 340, width: 180, height: 80 };
  target._rect = { x: 624, y: 390, width: 180, height: 30 };
  return { controls, target, field };
}

test('Motion rotation reveals the currently focused rotor field without changing its paused study', async (t) => {
  const h = await harness(t);
  await h.ready();
  h.$('play-pause').click();
  h.change('rotor-radius', '0.27', 'input');
  const { target, field } = rotationGeometry(h);
  target.focus();
  const before = freezeView(h),
    arena = h.$('arena'),
    requests = h.requests.length,
    images = [...h.images],
    scrolls = [];
  t.mock.method(target, 'focus', () => assert.fail('Rotation must not assign focus.'));
  t.mock.method(field, 'scrollIntoView', (options) => {
    scrolls.push(options);
    // Model the ordinary nearest-scroll result, not a browser layout engine.
    field._rect.y = 220;
    target._rect.y = 270;
  });
  h.host.emit('resize');
  assert.deepEqual(scrolls, [{ block: 'nearest', inline: 'nearest', behavior: 'instant' }]);
  assert.equal(h.doc.activeElement, target);
  assert.deepEqual(freezeView(h), before);
  assert.equal(h.$('arena'), arena);
  assert.equal(h.$('play-pause').textContent, 'Play');
  assert.equal(h.frames.size, 0);
  assert.equal(h.requests.length, requests);
  assert.deepEqual(h.images, images);
  assert.deepEqual(h.writes, []);
  h.host.emit('resize');
  assert.equal(scrolls.length, 1, 'A visible field needs no second scroll.');
});

test('Motion rotation accounts for the settings clip even while a focused slider is inside the viewport', async (t) => {
  const h = await harness(t);
  await h.ready();
  const { controls, target, field } = rotationGeometry(h);
  controls._rect.height = 165;
  field._rect.y = 200;
  target._rect.y = 250;
  target.focus();
  const calls = [];
  t.mock.method(field, 'scrollIntoView', (options) => calls.push(options));
  h.host.emit('resize');
  assert.equal(calls.length, 1, 'The inner scroller clips a viewport-visible control.');
  controls.style.overflowY = 'visible';
  h.host.emit('resize');
  assert.equal(calls.length, 1, 'Portrait flow has no inner clipping boundary.');
  assert.equal(h.doc.activeElement, target);
});

test('Motion rotation reveals the rotor when its entire settings panel moves above the viewport', async (t) => {
  const h = await harness(t);
  await h.ready();
  h.$('play-pause').click();
  h.change('rotor-radius', '0.27', 'input');
  const { controls, target, field } = rotationGeometry(h);
  // Actual native portrait-to-landscape failure: document scroll retained while
  // the settings panel became its own scroller, leaving both ancestors clipped.
  controls._rect = { x: 610, y: -768.109375, width: 220, height: 330 };
  field._rect = { x: 624, y: 1979.84375, width: 180, height: 105.59375 };
  target._rect = { x: 624, y: 2041.4375, width: 180, height: 44 };
  target.focus();
  const before = freezeView(h),
    scrolls = [];
  t.mock.method(target, 'focus', () => assert.fail('Rotation must keep native focus.'));
  t.mock.method(field, 'scrollIntoView', (options) => scrolls.push(options));
  h.host.emit('resize');
  assert.deepEqual(scrolls, [{ block: 'nearest', inline: 'nearest', behavior: 'instant' }]);
  assert.equal(h.doc.activeElement, target);
  assert.deepEqual(freezeView(h), before);
  assert.equal(h.$('play-pause').textContent, 'Play');
  assert.equal(h.frames.size, 0);
  assert.deepEqual(h.writes, []);
});

for (const condition of [
  'hidden',
  'inert',
  'disabled',
  'fieldset',
  'background',
  'away',
  'disposed',
])
  test(`Motion rotation cannot reveal an ${condition} current control`, async (t) => {
    const h = await harness(t);
    await h.ready();
    const { controls, target, field } = rotationGeometry(h);
    target.focus();
    if (condition === 'hidden') controls.hidden = true;
    if (condition === 'inert') controls.setAttribute('inert', '');
    if (condition === 'disabled') target.disabled = true;
    if (condition === 'fieldset') h.$('motion-study').disabled = true;
    if (condition === 'background') h.doc.focused = false;
    if (condition === 'away') h.host.emit('pagehide', { persisted: true });
    if (condition === 'disposed') h.host.emit('pagehide', { persisted: false });
    t.mock.method(field, 'scrollIntoView', () =>
      assert.fail('An ineligible control must not scroll.'),
    );
    const resize = [...(h.host.listeners.get('resize') || [])];
    h.host.emit('resize');
    for (const callback of resize) callback({ target: h.host });
    assert.equal(h.doc.activeElement, target);
    if (condition === 'away' || condition === 'disposed') {
      assert.equal(h.frames.size, 0);
      assert.equal(h.$('play-pause').textContent, 'Play');
    }
  });

test('Motion resize cannot scroll after measurement changes the focused owner or loses foreground', async (t) => {
  const h = await harness(t);
  await h.ready();
  const { target, field } = rotationGeometry(h);
  const rect = field.getBoundingClientRect.bind(field);
  t.mock.method(field, 'scrollIntoView', () =>
    assert.fail('Stale focus cannot reveal the old field.'),
  );
  let interruption = 'focus';
  t.mock.method(field, 'getBoundingClientRect', () => {
    if (interruption === 'focus') h.$('animation-recipe').focus();
    else h.doc.focused = false;
    return rect();
  });
  target.focus();
  h.host.emit('resize');
  assert.equal(h.doc.activeElement, h.$('animation-recipe'));
  interruption = 'background';
  target.focus();
  h.host.emit('resize');
  assert.equal(h.doc.activeElement, target);
});

test('Motion resize reveals the control when its labeled field is taller than the visible settings area', async (t) => {
  const h = await harness(t);
  await h.ready();
  const { controls, target, field } = rotationGeometry(h);
  controls._rect.height = 60;
  target.focus();
  const calls = [];
  t.mock.method(field, 'scrollIntoView', () =>
    assert.fail('An oversized field cannot hide its control.'),
  );
  t.mock.method(target, 'scrollIntoView', (options) => calls.push(options));
  const rect = target.getBoundingClientRect.bind(target);
  t.mock.method(target, 'getBoundingClientRect', () => {
    h.host.emit('resize');
    return rect();
  });
  h.host.emit('resize');
  assert.equal(calls.length, 1, 'Reentrant measurement does not schedule repeated scrolls.');
  target.emit('resize');
  assert.equal(calls.length, 1, 'Descendant events cannot pretend to be a viewport resize.');
});

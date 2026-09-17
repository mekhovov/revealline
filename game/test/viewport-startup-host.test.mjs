import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Script, createContext, constants } from 'node:vm';
import { Document, Events } from './helpers/couch-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { DISPLAY_PREFERENCES_KEY } from '../display-preferences.mjs';

const html = await readFile(
  new URL('../../authoring/viewport-lab/index.html', import.meta.url),
  'utf8',
);
const launcher = await readFile(new URL('../ui/direct-tool-launch.js', import.meta.url), 'utf8');
let sequence = 0;
function deferred() {
  let resolve;
  const promise = new Promise((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
const reloadLink = (doc) =>
  doc.querySelectorAll('a').find((link) => link.textContent === 'Reload this tool') ?? null;

class ViewportDocument extends Document {
  createElement(tag) {
    const node = super.createElement(tag);
    // Explicit platform boundary needed by the launcher's target.after(link)
    // contract. The shared helper intentionally has no general DOM sibling API.
    Object.defineProperty(node, 'nextElementSibling', {
      get() {
        const siblings = this.parentElement?.children ?? [];
        return siblings[siblings.indexOf(this) + 1] ?? null;
      },
    });
    return node;
  }
}

function markup(doc) {
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
      stack.at(-1)._text = (stack.at(-1)._text || '') + token.trim();
      continue;
    }
    const tag = token.match(/^<([\w-]+)/)[1],
      node = doc.createElement(tag);
    for (const [, name, quoted, bare] of token
      .slice(tag.length + 1, -1)
      .matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|([^\s]+)))?/g)) {
      const value = quoted ?? bare ?? '';
      node.setAttribute(name, value);
      if (name === 'class') node.className = value;
      if (name.startsWith('data-'))
        node.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
      if (['type', 'value', 'href', 'width', 'height'].includes(name)) node[name] = value;
      if (['hidden', 'disabled'].includes(name)) node[name] = true;
    }
    stack.at(-1).append(node);
    if (tag === 'option' && node.hasAttribute('selected')) node.parentElement.value = node.value;
    if (!['meta', 'link', 'input', 'br', 'img', 'hr'].includes(tag)) stack.push(node);
  }
}

async function fixture(t, { failure = false, withDisplay = false } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'revealline-viewport-startup-'));
  const doc = new ViewportDocument(),
    events = new Events(),
    timers = new Map();
  const restores = [],
    gate = deferred();
  const reads = [],
    writes = [];
  const media = Object.assign(new Events(), { matches: true });
  const defaults = { textFace: 'pixel', textSize: 'standard', reducedEffects: false };
  let raw = JSON.stringify({ ...defaults, textFace: 'plain', textSize: 'large' });
  const storage = {
    getItem(key) {
      reads.push(key);
      assert.equal(key, DISPLAY_PREFERENCES_KEY);
      return raw;
    },
    setItem(key, value) {
      writes.push([key, value]);
      assert.fail('The authoring display owner is read-only.');
    },
  };
  Object.assign(events, doc.defaultView, {
    localStorage: storage,
    matchMedia(query) {
      assert.equal(query, '(prefers-reduced-motion: reduce)');
      return media;
    },
  });
  doc.defaultView = events;
  const owner = { gate, started: false, finished: false, closed: false, job: null, error: null };
  let running = false,
    launchError = null;
  const reportedError = () => doc.documentElement.dataset.toolState === 'error';
  const delivered = () => owner.finished || (!owner.started && (reportedError() || launchError));
  t.after(async () => {
    // Stop a not-yet-delivered wrapper from beginning application work, and
    // release any deliberately held job before restoring process globals.
    owner.closed = true;
    gate.resolve();
    events.emit('pagehide', { persisted: false });
    try {
      if (running) {
        await waitFor(delivered, {
          message: `Viewport delivery did not settle: ${owner.error ?? launchError ?? 'no completion observed'}`,
        });
        if (owner.job) await Promise.allSettled([owner.job]);
        await waitFor(() => timers.size === 0, {
          message: 'Launcher did not retire its timer after observed module completion.',
        });
      }
    } finally {
      // An already-entered native import must finish before its global document
      // is restored, even if a preceding test assertion/elapsed wait failed.
      if (owner.job) await Promise.allSettled([owner.job]);
      for (const restore of restores.reverse()) restore();
      await rm(directory, { recursive: true, force: true });
      if (withDisplay) {
        assert.equal(events.listeners.get('storage')?.size ?? 0, 0);
        assert.equal(events.listeners.get('pageshow')?.size ?? 0, 0);
        assert.equal(media.listeners.get('change')?.size ?? 0, 0);
      }
    }
  });
  markup(doc);
  const frame = doc.getElementById('game-frame');
  let frameSource = frame.src,
    frameSourceWrites = 0;
  Object.defineProperty(frame, 'src', {
    configurable: true,
    get: () => frameSource,
    set(value) {
      frameSource = value;
      frameSourceWrites++;
    },
  });
  const script = doc.querySelector('script[data-module]');
  assert.ok(
    script,
    'Behavior fixture requires candidate HTML; test original markup with the separate wiring discriminator.',
  );
  assert.equal(script.dataset.module, './browser.mjs');
  assert.equal(script.dataset.status, 'viewport-load-status');
  const key = `viewportStartup${++sequence}`;
  const install = (name, value) => {
    const old = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    restores.push(() =>
      old ? Object.defineProperty(globalThis, name, old) : delete globalThis[name],
    );
  };
  install('document', doc);
  install(key, owner);
  if (withDisplay) {
    const entries = [...html.matchAll(/<script\b([^>]*)>/gu)].map((match) => ({
      attributes: Object.fromEntries(
        [...match[1].matchAll(/([^\s=]+)\s*=\s*"([^"]*)"/gu)].map((attribute) => [
          attribute[1],
          attribute[2],
        ]),
      ),
      offset: match.index,
    }));
    const display = entries.filter((entry) =>
      entry.attributes.src?.endsWith('/host-display-entry.mjs'),
    );
    assert.equal(display.length, 1, 'Actual HTML has one independent display entry.');
    assert.equal(display[0].attributes.type, 'module');
    const launch = entries.find((entry) => entry.attributes['data-module'] === './browser.mjs');
    assert.ok(launch && display[0].offset < launch.offset);
    const documentURL = new URL('../../authoring/viewport-lab/index.html', import.meta.url);
    const entryURL = new URL(display[0].attributes.src, documentURL);
    await import(`${entryURL.href}?viewport-startup-display=${sequence}`);
  }
  const app = new URL(
    `../../authoring/viewport-lab/browser.mjs?viewport-startup=${sequence}`,
    import.meta.url,
  ).href;
  // This gate models delivery only. The actual launcher and application remain
  // unchanged. A late wrapper sees a retired/missing owner and cannot import
  // the app against the next fixture's document.
  await writeFile(
    join(directory, 'browser.mjs'),
    `
const owner = globalThis[${JSON.stringify(key)}];
if (owner) {
  owner.started = true;
  owner.job = (async () => {
    await owner.gate.promise;
    if (owner.closed) return;
    ${failure ? "throw new Error('Viewport module unavailable');" : `await import(${JSON.stringify(app)});`}
  })();
  try { await owner.job; }
  catch (error) { owner.error = String(error.message || error); throw error; }
  finally { owner.finished = true; }
}
`,
  );
  doc.baseURI = pathToFileURL(join(directory, 'index.html')).href;
  doc.readyState = 'complete';
  doc.currentScript = script;
  let timerId = 0;
  const context = createContext({
    document: doc,
    URL,
    String,
    Object,
    setTimeout: (callback) => {
      timers.set(++timerId, callback);
      return timerId;
    },
    clearTimeout: (id) => timers.delete(id),
    addEventListener: events.addEventListener.bind(events),
  });
  const run = () => {
    running = true;
    try {
      new Script(launcher, {
        filename: 'direct-tool-launch.js',
        importModuleDynamically: constants.USE_MAIN_CONTEXT_DEFAULT_LOADER,
      }).runInContext(context);
      install('RevealLineToolLaunch', context.RevealLineToolLaunch);
    } catch (error) {
      launchError = error;
      throw error;
    }
  };
  const started = async () => {
    await waitFor(() => owner.started || reportedError() || launchError, {
      message: 'Viewport module delivery did not enter its wrapper or report failure.',
    });
    assert.ok(
      owner.started,
      `Viewport wrapper did not start: ${doc.getElementById('viewport-load-status').textContent}`,
    );
  };
  const complete = async () => {
    gate.resolve();
    await waitFor(delivered, {
      message: 'Actual Viewport module job did not complete or report a loader error.',
    });
    if (owner.job) await Promise.allSettled([owner.job]);
    await waitFor(() => timers.size === 0, {
      message: 'Launcher did not settle after the observed module job.',
    });
  };
  const $ = (id) => doc.getElementById(id);
  return {
    doc,
    events,
    context,
    timers,
    $,
    gate,
    started,
    complete,
    run,
    reads,
    writes,
    media,
    frameSourceWrites: () => frameSourceWrites,
    share(patch) {
      raw = JSON.stringify({ ...defaults, ...patch });
      events.emit('storage', { key: DISPLAY_PREFERENCES_KEY, storageArea: storage, newValue: raw });
    },
    motion(value) {
      media.matches = value;
      media.emit('change');
    },
  };
}

// Original-HTML comparison runs this discriminator alone. Behavioral baseline
// comparison uses explicitly augmented candidate HTML + original browser.mjs;
// the full fixture is not an original-HTML behavioral baseline.
test('Viewport original-markup wiring discriminator: waiting controls and independent recovery launcher', () => {
  const doc = new ViewportDocument();
  markup(doc);
  const h = { doc, $: (id) => doc.getElementById(id) };
  const script = doc.querySelector('script[data-module]');
  assert.ok(script, 'Original markup lacks the recoverable launcher.');
  assert.equal(script.dataset.module, './browser.mjs');
  assert.equal(script.dataset.status, 'viewport-load-status');
  assert.equal(h.$('viewport-load-status').dataset.state, 'busy');
  assert.match(h.$('viewport-load-status').textContent, /Preparing preview controls/);
  assert.equal(
    h.$('viewport-load-status').querySelector('[role="status"]').textContent.includes('directly'),
    true,
  );
  for (const id of ['target', 'preset', 'load-target']) assert.equal(h.$(id).disabled, true);
  assert.equal(h.$('direct-open').href, '../../game/couch/');
  assert.equal(h.$('game-frame').hidden, true);
  assert.equal(h.$('game-frame').getAttribute('src'), null);
  assert.doesNotMatch(html, /<script[^>]+type="module"[^>]+src="(?:\.\/)?browser\.mjs"/);
});

test('held Viewport startup reports waiting, then enables controls without starting a game or moving focus', async (t) => {
  const h = await fixture(t),
    frame = h.$('game-frame');
  h.$('direct-open').focus();
  h.run();
  await h.started();
  const slow = [...h.timers.values()][0];
  slow();
  assert.match(h.$('viewport-load-status').textContent, /Still loading/);
  const reload = reloadLink(h.doc);
  assert.equal(reload.hidden, false);
  await h.complete();
  assert.equal(h.$('viewport-load-status').hidden, true);
  assert.equal(reload.hidden, true);
  for (const id of ['target', 'preset', 'load-target']) assert.equal(h.$(id).disabled, false);
  assert.ok(h.$('game-frame') === frame);
  assert.equal(frame.getAttribute('src'), null);
  assert.equal(frame.hidden, true);
  assert.ok(h.doc.activeElement === h.$('direct-open'));
  assert.match(h.$('status').textContent, /Choose a game/);
  slow();
  assert.equal(h.$('viewport-load-status').hidden, true);
});

test('ready Viewport hands focus from only the retiring Reload link to Game', async (t) => {
  const h = await fixture(t);
  h.run();
  await h.started();
  const slow = [...h.timers.values()][0];
  slow();
  const reload = reloadLink(h.doc),
    target = h.$('target');
  assert.ok(reload && h.$('viewport-load-status').nextElementSibling === reload);
  reload.focus();
  // Model the browser moving focus to body when the focused anchor is hidden.
  // The production branch also accepts a platform retaining the hidden node.
  let hidden = reload.hidden;
  Object.defineProperty(reload, 'hidden', {
    configurable: true,
    get: () => hidden,
    set(value) {
      hidden = value;
      if (value && h.doc.activeElement === reload) h.doc.activeElement = h.doc.body;
    },
  });
  await h.complete();
  assert.equal(reload.hidden, true);
  assert.ok(h.doc.activeElement === target && h.$('target') === target);
  assert.equal(target.disabled, false);
  assert.equal(h.$('game-frame').getAttribute('src'), null);
  assert.equal(h.$('game-frame').hidden, true);
  slow();
  assert.ok(h.doc.activeElement === target);
});

for (const inactive of ['hidden', 'unfocused']) {
  test(`ready Viewport does not move Reload focus in an ${inactive} document or on later return`, async (t) => {
    const h = await fixture(t);
    h.run();
    await h.started();
    [...h.timers.values()][0]();
    const reload = reloadLink(h.doc),
      target = h.$('target');
    reload.focus();
    let focusCalls = 0;
    const focus = target.focus.bind(target);
    target.focus = () => {
      focusCalls++;
      focus();
    };
    h.doc.hidden = inactive === 'hidden';
    h.doc.focused = inactive !== 'unfocused';
    await h.complete();
    assert.equal(reload.hidden, true);
    assert.equal(target.disabled, false, 'Readiness may enable controls without taking focus.');
    assert.equal(focusCalls, 0, 'Inactive completion must not focus the ready selector.');
    assert.equal(h.frameSourceWrites(), 0);
    assert.ok(h.doc.activeElement === reload);
    h.doc.hidden = false;
    h.doc.focused = true;
    h.events.emit('focus');
    h.events.emit('pageshow', { persisted: true });
    assert.equal(focusCalls, 0, 'Foreground return must not replay a delayed focus handoff.');
    assert.equal(h.frameSourceWrites(), 0);
  });
}

const displayState = (h) => ({
  textFace: h.doc.body.dataset.textFace,
  textSize: h.doc.body.dataset.textSize,
  effects: h.doc.body.dataset.effects,
});

test('ready Viewport preserves a newer focus owner acquired during actual Reload retirement', async (t) => {
  const h = await fixture(t, { withDisplay: true });
  const frame = h.$('game-frame');
  h.run();
  await h.started();
  [...h.timers.values()][0]();
  const reload = reloadLink(h.doc),
    target = h.$('target'),
    direct = h.$('direct-open');
  reload.focus();
  let hidden = reload.hidden,
    retirements = 0,
    targetFocusCalls = 0;
  const focus = target.focus.bind(target);
  target.focus = () => {
    targetFocusCalls++;
    focus();
  };
  // Model a reentrant hide/blur boundary. The real launcher still owns
  // attached() and hides Reload after the app captures its prior focus owner.
  // A newer usable control takes focus at that boundary, not before startup.
  Object.defineProperty(reload, 'hidden', {
    configurable: true,
    get: () => hidden,
    set(value) {
      const retiring = !hidden && value && h.doc.activeElement === reload;
      hidden = value;
      if (retiring) {
        retirements++;
        h.doc.activeElement = h.doc.body;
        direct.focus();
      }
    },
  });
  await h.complete();
  assert.equal(retirements, 1, 'The newer owner was established during actual retirement.');
  assert.equal(reload.hidden, true);
  assert.equal(h.$('viewport-load-status').hidden, true);
  for (const id of ['target', 'preset', 'load-target']) assert.equal(h.$(id).disabled, false);
  assert.ok(h.doc.activeElement === direct);
  assert.equal(targetFocusCalls, 0, 'Readiness must respect a newer focus owner.');
  assert.ok(h.$('game-frame') === frame);
  assert.equal(h.frameSourceWrites(), 0);
  h.share({ textFace: 'pixel', textSize: 'standard', reducedEffects: false });
  h.motion(false);
  assert.deepEqual(displayState(h), { textFace: 'pixel', textSize: 'standard', effects: 'full' });
  assert.ok(h.doc.activeElement === direct);
  assert.equal(targetFocusCalls, 0);
  assert.equal(h.frameSourceWrites(), 0);
  assert.deepEqual(h.writes, []);
});

test('independent display and real startup launcher preserve preferences, focus and explicit iframe ownership together', async (t) => {
  const h = await fixture(t, { withDisplay: true });
  const frame = h.$('game-frame');
  assert.deepEqual(displayState(h), { textFace: 'plain', textSize: 'large', effects: 'reduced' });
  assert.deepEqual(h.reads, [DISPLAY_PREFERENCES_KEY]);
  assert.equal(h.frameSourceWrites(), 0);
  h.run();
  await h.started();
  [...h.timers.values()][0]();
  const reload = reloadLink(h.doc);
  reload.focus();
  h.share({ textFace: 'pixel', textSize: 'standard', reducedEffects: false });
  assert.deepEqual(displayState(h), {
    textFace: 'pixel',
    textSize: 'standard',
    effects: 'reduced',
  });
  h.motion(false);
  assert.equal(
    h.doc.body.dataset.effects,
    'full',
    'The system cap did not become saved raw intent.',
  );
  h.share({ textFace: 'plain', textSize: 'large', reducedEffects: false });
  assert.ok(h.doc.activeElement === reload);
  assert.equal(h.frameSourceWrites(), 0);
  for (const id of ['target', 'preset', 'load-target']) assert.equal(h.$(id).disabled, true);
  await h.complete();
  assert.deepEqual(displayState(h), { textFace: 'plain', textSize: 'large', effects: 'full' });
  assert.ok(h.doc.activeElement === h.$('target'));
  assert.equal(reload.hidden, true);
  for (const id of ['target', 'preset', 'load-target']) assert.equal(h.$(id).disabled, false);
  assert.equal(h.frameSourceWrites(), 0);
  assert.equal(frame.hidden, true);
  h.$('load-target').focus();
  h.$('target-form').emit('submit');
  assert.equal(frame.src, '../../game/couch/');
  assert.equal(h.frameSourceWrites(), 1);
  h.$('target').value = 'solo';
  h.$('target').emit('change');
  h.$('target').focus();
  const pending = {
    width: frame.width,
    height: frame.height,
    preset: h.$('preset').value,
    status: h.$('status').textContent,
  };
  h.share({ textFace: 'pixel', textSize: 'standard', reducedEffects: false });
  h.motion(true);
  assert.deepEqual(displayState(h), {
    textFace: 'pixel',
    textSize: 'standard',
    effects: 'reduced',
  });
  assert.ok(h.$('game-frame') === frame);
  assert.equal(frame.src, '../../game/couch/');
  assert.equal(h.frameSourceWrites(), 1);
  assert.equal(h.$('target').value, 'solo');
  assert.equal(h.$('load-target').disabled, false);
  assert.deepEqual(
    {
      width: frame.width,
      height: frame.height,
      preset: h.$('preset').value,
      status: h.$('status').textContent,
    },
    pending,
  );
  assert.ok(h.doc.activeElement === h.$('target'));
  assert.deepEqual(h.writes, []);
});

test('independent display keeps responding when the real startup launcher reports application failure', async (t) => {
  const h = await fixture(t, { failure: true, withDisplay: true });
  h.$('direct-open').focus();
  h.run();
  await h.started();
  h.share({ textFace: 'pixel', textSize: 'standard', reducedEffects: false });
  assert.deepEqual(displayState(h), {
    textFace: 'pixel',
    textSize: 'standard',
    effects: 'reduced',
  });
  await h.complete();
  assert.equal(h.$('viewport-load-status').dataset.state, 'error');
  const reload = reloadLink(h.doc);
  assert.equal(reload.hidden, false);
  h.share({ textFace: 'plain', textSize: 'large', reducedEffects: false });
  h.motion(false);
  assert.deepEqual(displayState(h), { textFace: 'plain', textSize: 'large', effects: 'full' });
  assert.ok(h.doc.activeElement === h.$('direct-open'));
  for (const id of ['target', 'preset', 'load-target']) assert.equal(h.$(id).disabled, true);
  assert.equal(h.frameSourceWrites(), 0);
  assert.deepEqual(h.writes, []);
});

test('all five real Viewport presets preserve loaded and pending game ownership through display changes', async (t) => {
  const h = await fixture(t, { withDisplay: true });
  const frame = h.$('game-frame'),
    preset = h.$('preset'),
    viewport = h.$('viewport');
  // User-visible size contract, independent of the application presets map.
  const expected = [
    ['390x844', 390, 844],
    ['844x390', 844, 390],
    ['768x1024', 768, 1024],
    ['1280x720', 1280, 720],
    ['1280x800', 1280, 800],
  ];
  assert.deepEqual(
    preset.options.map((option) => option.value),
    expected.map(([value]) => value),
  );
  h.run();
  await h.started();
  await h.complete();
  const checkSize = (value, width, height) => {
    assert.equal(preset.value, value);
    assert.equal(frame.width, String(width));
    assert.equal(frame.height, String(height));
    assert.equal(viewport.style['--viewport-width'], `${width}px`);
    assert.equal(viewport.style['--viewport-height'], `${height}px`);
    assert.equal(h.$('dimensions').value, `${width} × ${height} CSS px`);
    assert.ok(h.$('game-frame') === frame);
    assert.ok(h.doc.activeElement === preset);
  };
  for (const loaded of [false, true]) {
    if (loaded) {
      h.$('target-form').emit('submit');
      assert.equal(frame.src, '../../game/couch/');
      assert.equal(h.frameSourceWrites(), 1);
      h.$('target').value = 'solo';
      h.$('target').emit('change');
      assert.equal(h.$('direct-open').href, '../../game/');
    }
    const status = h.$('status').textContent;
    const loadedLabel = h.$('loaded-target').textContent;
    for (const [index, [value, width, height]] of expected.entries()) {
      preset.focus();
      preset.value = value;
      preset.emit('change');
      checkSize(value, width, height);
      const textFace = index % 2 ? 'pixel' : 'plain';
      const textSize = index % 2 ? 'standard' : 'large';
      h.share({ textFace, textSize, reducedEffects: false });
      h.motion(true);
      assert.deepEqual(displayState(h), { textFace, textSize, effects: 'reduced' });
      checkSize(value, width, height);
      h.motion(false);
      assert.deepEqual(displayState(h), { textFace, textSize, effects: 'full' });
      checkSize(value, width, height);
      assert.equal(h.frameSourceWrites(), loaded ? 1 : 0);
      assert.equal(frame.hidden, !loaded);
      assert.equal(h.$('empty-preview').hidden, loaded);
      assert.equal(h.$('target').value, loaded ? 'solo' : 'couch');
      assert.equal(h.$('load-target').disabled, false);
      assert.equal(h.$('loaded-target').textContent, loadedLabel);
      assert.equal(h.$('status').textContent, status);
      if (loaded) assert.equal(frame.src, '../../game/couch/');
    }
  }
  // Only the deliberate Load action may replace the preserved Couch child.
  h.$('target-form').emit('submit');
  assert.equal(frame.src, '../../game/');
  assert.equal(h.frameSourceWrites(), 2);
  assert.ok(h.$('game-frame') === frame);
  h.$('target-form').emit('submit');
  assert.equal(
    h.frameSourceWrites(),
    2,
    'Submitting the already loaded target does not reload it.',
  );
  assert.deepEqual(h.writes, []);
});

test('failed Viewport module keeps a Reload link while controls stay unavailable', async (t) => {
  const h = await fixture(t, { failure: true });
  h.$('direct-open').focus();
  h.run();
  await h.started();
  await h.complete();
  await waitFor(() => h.$('viewport-load-status').dataset.state === 'error');
  assert.match(
    h.$('viewport-load-status').textContent,
    /could not start.*Viewport module unavailable/,
  );
  const reload = reloadLink(h.doc);
  assert.equal(reload.href, h.doc.baseURI);
  assert.equal(reload.hidden, false);
  for (const id of ['target', 'preset', 'load-target']) assert.equal(h.$(id).disabled, true);
  assert.ok(h.doc.activeElement === h.$('direct-open'));
  assert.equal(h.$('direct-open').href, '../../game/couch/');
  assert.equal(h.$('game-frame').getAttribute('src'), null);
});

test('ready Viewport retains explicit target replacement and exact iframe resizing', async (t) => {
  const h = await fixture(t);
  h.run();
  await h.started();
  await h.complete();
  const frame = h.$('game-frame');
  h.$('load-target').focus();
  h.$('target-form').emit('submit');
  assert.equal(frame.src, '../../game/couch/');
  assert.ok(h.doc.activeElement === h.$('target'));
  h.$('target').value = 'solo';
  h.$('target').emit('change');
  assert.equal(frame.src, '../../game/couch/');
  assert.match(h.$('status').textContent, /Couch remains loaded/);
  h.$('preset').value = '390x844';
  h.$('preset').emit('change');
  assert.equal(frame.width, '390');
  assert.equal(frame.height, '844');
  assert.ok(h.$('game-frame') === frame);
  assert.equal(frame.src, '../../game/couch/');
  h.$('target-form').emit('submit');
  assert.equal(frame.src, '../../game/');
  assert.ok(h.$('game-frame') === frame);
});

test('terminal departure prevents a late module failure from replacing the old status', async (t) => {
  const h = await fixture(t, { failure: true });
  h.run();
  await h.started();
  const status = h.$('viewport-load-status').textContent;
  h.events.emit('pagehide', { persisted: false });
  await h.complete();
  assert.equal(h.$('viewport-load-status').textContent, status);
  assert.equal(reloadLink(h.doc), null);
  assert.equal(h.$('game-frame').getAttribute('src'), null);
});

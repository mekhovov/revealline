import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Document, Element, Events } from './helpers/couch-dom.mjs';
import { deferred } from './helpers/media-fixtures.mjs';

const read = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const settle = async () => {
  for (let n = 0; n < 5; n++) await new Promise((resolve) => setImmediate(resolve));
};
const png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
let serial = 0;

class EditorElement extends Element {
  get href() {
    return this.getAttribute('href') ?? '';
  }
  set href(value) {
    this.setAttribute('href', value);
  }
  getContext() {
    this.calls ??= [];
    return (this.context ??= new Proxy(
      { canvas: this },
      {
        get: (target, key) =>
          key in target
            ? target[key]
            : (...args) => {
                assert.ok(
                  args.filter((arg) => typeof arg === 'number').every(Number.isFinite),
                  `finite Canvas2D ${String(key)}`,
                );
                this.calls.push({ op: key, args });
              },
        set: (target, key, value) => {
          target[key] = value;
          return true;
        },
      },
    ));
  }
}
class EditorDocument extends Document {
  createElement(tag) {
    return new EditorElement(this, tag, { clientWidth: 1280 });
  }
}
function mount(document, html) {
  const stack = [document.body];
  for (const token of html
    .match(/<body[^>]*>([\s\S]*)<\/body>/)[1]
    .matchAll(/<!--[\s\S]*?-->|<\/?[^>]+>|[^<]+/g)) {
    const text = token[0];
    if (text.startsWith('<!--')) continue;
    if (text.startsWith('</')) {
      stack.pop();
      continue;
    }
    if (!text.startsWith('<')) {
      stack.at(-1)._text += text.trim();
      continue;
    }
    const tag = text.match(/^<([\w-]+)/)[1],
      node = document.createElement(tag);
    for (const [, name, quoted, bare] of text
      .slice(tag.length + 1, -1)
      .matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|([^\s]+)))?/g)) {
      const value = quoted ?? bare ?? '';
      node.setAttribute(name, value);
      if (name === 'class') node.className = value;
      if (name.startsWith('data-'))
        node.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
      if (['type', 'value'].includes(name)) node[name] = value;
      if (['hidden', 'disabled', 'checked', 'inert'].includes(name)) node[name] = true;
    }
    stack.at(-1).append(node);
    if (!['meta', 'link', 'input', 'br', 'img', 'hr'].includes(tag)) stack.push(node);
  }
}
async function harness(t, { deferImage = false, classicRole = false, tacticalResponse } = {}) {
  const document = new EditorDocument(),
    window = new Events(),
    images = [],
    writes = [],
    storage = new Map(),
    layoutFrames = [],
    resizeObservers = [];
  mount(document, await readFile(new URL('../playground/index.html', import.meta.url), 'utf8'));
  const documents = new Map(
    await Promise.all(
      [
        'campaign.json',
        'themes.json',
        'classes.json',
        'packs/index.json',
        'packs/classic-lab.json',
      ].map(async (path) => [`../content/${path}`, await read(`../content/${path}`)]),
    ),
  );
  for (const id of [
    'tactical-read-clearing',
    'tactical-borrowed-seconds',
    'tactical-quiet-crossing',
  ]) {
    const path = `../../authoring/library/tactical-teaching/scenarios/${id}.json`;
    documents.set(path, await read(path));
  }
  const originals = new Map();
  const set = (key, value) => {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  };
  t.after(() => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  set('document', document);
  set('window', window);
  set('Option', function (label, value) {
    const node = document.createElement('option');
    node.textContent = label;
    node.value = value;
    return node;
  });
  set('sessionStorage', {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => {
      writes.push([key, value]);
      storage.set(key, value);
    },
  });
  let poll;
  set('setInterval', (callback) => {
    poll = callback;
    return 1;
  });
  set('requestAnimationFrame', (callback) => {
    layoutFrames.push(callback);
    return layoutFrames.length;
  });
  set(
    'ResizeObserver',
    class {
      constructor(callback) {
        this.callback = callback;
        resizeObservers.push(this);
      }
      observe(node) {
        this.node = node;
      }
      disconnect() {
        this.disconnected = true;
      }
    },
  );
  set(
    'Image',
    class {
      naturalWidth = 1;
      naturalHeight = 1;
      set src(value) {
        this.value = value;
        images.push(this);
      }
      async decode() {}
      removeAttribute() {}
    },
  );
  set('fetch', async (path) => {
    assert.ok(documents.has(path), `Expected authoring fetch ${path}`);
    const value = structuredClone(documents.get(path));
    if (tacticalResponse && String(path).includes('/tactical-teaching/'))
      return tacticalResponse(path, value);
    if ((deferImage || classicRole) && String(path).endsWith('/classic-lab.json'))
      value.visualOverrides = {
        [classicRole ? 'rover' : 'background']: {
          dataUrl: png,
          name: 'Deferred decode fixture',
          fit: 'contain',
        },
      };
    return { ok: true, json: async () => value };
  });
  await import(`../playground/playground.mjs?host=${++serial}`);
  await settle();
  const $ = (id) => document.getElementById(id);
  assert.doesNotMatch($('editor-status').textContent, /could not load/);
  const load = document
    .querySelectorAll('#example-packs')[0]
    .children.find((e) => e.textContent === 'Load classic lab');
  assert.ok(load);
  return {
    $,
    poll: () => poll(),
    holdReplayYields() {
      const nativeTimer = globalThis.setTimeout,
        callbacks = [];
      set('setTimeout', (callback, delay) => {
        assert.equal(delay, 0, 'the real verifier yields to the host without an invented delay');
        callbacks.push(callback);
      });
      return {
        callbacks,
        restore: () => {
          globalThis.setTimeout = nativeTimer;
        },
      };
    },
    document,
    window,
    flushLayout: () => layoutFrames.splice(0).forEach((callback) => callback()),
    resizeFeedback: () => resizeObservers.forEach((observer) => observer.callback()),
    resizeObservers,
    load,
    images,
    writes,
    storage,
    teaching: (id) =>
      $('teaching-examples').children.find((node) => node.dataset.teachingScenario === id),
    current: () => JSON.parse($('level-json').value),
    saved: () => JSON.parse(storage.get('revealline.playground.current')),
    finishImage: async (index) => {
      assert.ok(images[index]);
      await images[index].onload();
      await settle();
    },
  };
}

test('actual Playground entry blocks Play/open/mode launch during chosen pack decode, then paints and launches Classic Lab', async (t) => {
  const f = await harness(t, { deferImage: true }),
    source = f.$('preview-frame').src,
    saved = f.storage.get('revealline.playground.current');
  assert.equal(
    f.$('asset-role').children.some((node) => node.value === 'rover'),
    false,
  );
  const job = f.load.onclick();
  await settle();
  assert.equal(f.images.length, 1);
  assert.equal(f.$('preview-button').disabled, true);
  assert.equal(f.$('preview-mode').disabled, true);
  assert.equal(f.$('open-preview').getAttribute('href'), null);
  assert.equal(f.$('preview-button').onclick(), false, 'handler itself rejects a stale launch');
  let prevented = false;
  f.$('open-preview').onclick({
    preventDefault() {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
  f.$('preview-mode').value = 'couch';
  f.$('preview-mode').onchange();
  assert.equal(f.$('preview-frame').src, source);
  assert.equal(f.storage.get('revealline.playground.current'), saved);
  await f.finishImage(0);
  await job;
  assert.equal(f.current().version, 'xonix-level.v4');
  assert.equal(
    f.$('asset-role').children.some((node) => node.value === 'rover'),
    true,
  );
  assert.ok(f.current().classic.powerups.length);
  assert.equal(f.$('apply-mastery').disabled, true);
  assert.equal(f.$('clear-goal').disabled, true);
  assert.match(f.$('mastery-readout').textContent, /Classic edition/);
  assert.equal(f.$('preview-button').disabled, false);
  assert.equal(f.$('map-editor').width, 1152);
  assert.equal(f.$('map-editor').height, 576);
  assert.equal(
    f.$('preview-frame').src,
    source,
    'import does not silently replace the current practice run',
  );
  f.$('level-select').value = '2';
  f.$('level-select').onchange();
  assert.equal(
    f.current().id,
    'contour-watch',
    'editor can paint a recipe containing edge-based patrols',
  );
  f.$('preview-mode').value = 'solo';
  f.$('preview-button').click();
  assert.equal(f.saved().format, 'xonix-playground.v5');
  assert.equal(f.saved().level.id, 'contour-watch');
  assert.notEqual(f.$('preview-frame').src, source);
});

test('Couch preview opens the Legacy installed library without changing the editor, history or saved Solo configuration', async (t) => {
  const f = await harness(t),
    original = f.current();
  await f.teaching('tactical-read-clearing').onclick();
  f.$('preview-button').click();
  const editor = f.$('level-json').value,
    classId = f.$('class-select').value,
    turnPolicy = f.$('turn-select').value,
    storage = [...f.storage.entries()],
    writes = f.writes.length;
  assert.equal(f.current().id, 'tactical-read-clearing');
  assert.match(f.$('preview-frame').src, /^\.\.\/\?practice=1&revision=/);

  f.$('preview-mode').value = 'couch';
  f.$('preview-mode').onchange();

  assert.equal(f.$('preview-frame').src, '../couch/?journey=legacy&focus=1');
  assert.equal(f.$('open-preview').href, '../couch/?journey=legacy&focus=1');
  assert.match(f.$('editor-status').textContent, /Couch preview uses installed maps and packs/);
  assert.equal(f.$('level-json').value, editor);
  assert.equal(f.$('class-select').value, classId);
  assert.equal(f.$('turn-select').value, turnPolicy);
  assert.deepEqual([...f.storage.entries()], storage);
  assert.equal(f.writes.length, writes, 'Couch preview does not overwrite the Solo scenario');

  f.$('undo-button').click();
  assert.deepEqual(f.current(), original, 'preview selection creates no editor-history entry');
  assert.deepEqual(
    [...f.storage.entries()],
    storage,
    'Undo does not alter the saved Solo scenario',
  );
});

test('three native teaching buttons adopt exact scenarios only through import and explicit practice launch', async (t) => {
  const f = await harness(t);
  assert.equal(f.$('teaching-examples').children.length, 3);
  for (const id of [
    'tactical-read-clearing',
    'tactical-borrowed-seconds',
    'tactical-quiet-crossing',
  ]) {
    const scenario = await read(`../../authoring/library/tactical-teaching/scenarios/${id}.json`);
    const before = f.current(),
      priorPreview = f.$('preview-frame').src,
      writes = f.writes.length;
    const button = f.teaching(id);
    assert.equal(button.type, 'button');
    await button.onclick();
    assert.deepEqual(f.current(), scenario.level);
    assert.equal(f.$('class-select').value, scenario.settings.classId);
    assert.equal(f.$('preview-frame').src, priorPreview);
    assert.equal(f.writes.length, writes, 'loading does not launch or write any game record');
    assert.match(f.$('editor-status').textContent, /Practice grants no campaign awards/);
    f.$('preview-button').click();
    assert.deepEqual(f.saved().level, scenario.level);
    assert.deepEqual(f.saved().classRecipes, scenario.classRecipes);
    assert.equal(f.saved().settings.classId, scenario.settings.classId);
    assert.match(f.$('preview-frame').src, /^\.\.\/\?practice=1&revision=/);
    assert.deepEqual([...f.storage.keys()], ['revealline.playground.current']);
    f.$('undo-button').click();
    assert.deepEqual(f.current(), before, 'Undo restores the prior editable map');
  }
});

test('teaching requests retain the import gate across stale responses and preserve prior content on failure', async (t) => {
  const first = deferred(),
    next = deferred();
  let calls = 0;
  const f = await harness(t, {
    tacticalResponse: (_path, value) => {
      const gate = ++calls === 1 ? first : calls === 2 ? next : null;
      return gate
        ? gate.promise.then(() => ({ ok: true, json: async () => value }))
        : { ok: false };
    },
  });
  const before = f.current(),
    preview = f.$('preview-frame').src,
    writes = f.writes.length;
  const old = f.teaching('tactical-read-clearing').onclick();
  const latest = f.teaching('tactical-borrowed-seconds').onclick();
  first.resolve();
  await old;
  assert.equal(f.$('preview-button').disabled, true);
  assert.equal(f.$('preview-button').onclick(), false);
  assert.deepEqual(f.current(), before);
  assert.equal(f.$('preview-frame').src, preview);
  assert.equal(f.writes.length, writes);
  next.resolve();
  await latest;
  assert.equal(f.current().id, 'tactical-borrowed-seconds');
  assert.equal(f.$('preview-button').disabled, false);
  const accepted = f.current();
  await f.teaching('tactical-quiet-crossing').onclick();
  assert.deepEqual(f.current(), accepted);
  assert.equal(f.$('preview-button').disabled, false);
  assert.match(f.$('editor-status').textContent, /Teaching scenario is unavailable/);
  assert.equal(f.writes.length, writes);
});

test('older decode completion cannot release a newer import; failed reads release the gate and preserve current content', async (t) => {
  const f = await harness(t, { deferImage: true });
  const old = f.load.onclick();
  await settle();
  const latest = f.load.onclick();
  await settle();
  assert.equal(f.images.length, 2);
  await f.finishImage(0);
  await old;
  assert.equal(f.$('preview-button').disabled, true);
  assert.notEqual(f.current().version, 'xonix-level.v4');
  await f.finishImage(1);
  await latest;
  assert.equal(f.current().version, 'xonix-level.v4');
  assert.equal(f.$('preview-button').disabled, false);
  const before = f.$('level-json').value;
  f.$('import-file').files = [{ size: 2, text: async () => '{bad' }];
  await f.$('import-file').onchange();
  assert.equal(f.$('preview-button').disabled, false);
  assert.equal(f.$('preview-mode').disabled, false);
  assert.equal(f.$('open-preview').getAttribute('aria-disabled'), null);
  assert.equal(f.$('level-json').value, before);
  assert.match(f.$('editor-status').textContent, /Import rejected/);
});

test('explicit cancellation preserves the current map and preview while a late decode releases', async (t) => {
  const f = await harness(t, { deferImage: true });
  const before = f.$('level-json').value,
    href = f.$('open-preview').getAttribute('href');
  const pending = f.load.onclick();
  await settle();
  assert.equal(f.$('editor-status').dataset.state, 'busy');
  assert.equal(f.$('cancel-import').hidden, false);
  f.$('cancel-import').onclick();
  assert.equal(f.$('preview-button').disabled, false);
  assert.equal(f.$('open-preview').getAttribute('href'), href);
  await f.finishImage(0);
  await pending;
  assert.equal(f.$('level-json').value, before);
  assert.match(f.$('editor-status').textContent, /cancelled/);
});

test('actual classic JSON edit retains descriptors; explicit generator replacement returns to its legacy edition', async (t) => {
  const f = await harness(t, { classicRole: true });
  const loading = f.load.onclick();
  await settle();
  await f.finishImage(0);
  await loading;
  const original = f.current().classic;
  const edited = f.current();
  edited.name = 'Edited classic recipe';
  f.$('level-json').value = JSON.stringify(edited);
  const applying = f.$('apply-json').onclick();
  await settle();
  await f.finishImage(1);
  await applying;
  assert.deepEqual(f.current().classic, original);
  assert.equal(f.current().name, 'Edited classic recipe');
  assert.equal(f.$('preview-button').disabled, false);
  f.$('seed-input').value = 'classic-import-host';
  await f.$('generate-button').onclick();
  assert.equal(f.current().version, 'xonix-level.v1');
  assert.equal(
    f.$('asset-role').children.some((node) => node.value === 'rover'),
    false,
  );
  assert.equal(Object.hasOwn(f.current(), 'classic'), false);
  f.$('preview-button').click();
  assert.equal(f.saved().format, 'xonix-playground.v2');
  assert.equal(f.$('apply-mastery').disabled, false);
  assert.deepEqual(f.saved().visualOverrides, {});
  f.$('undo-button').click();
  f.$('preview-button').click();
  assert.equal(f.saved().format, 'xonix-playground.v5');
  assert.ok(f.saved().visualOverrides.rover, 'Undo restores the original Classic binding');
});

test('preview iframe load waits for the child readiness marker and does not reuse the previous child state', async (t) => {
  const f = await harness(t),
    child = new Document();
  child.documentElement = child.createElement('html');
  child.documentElement.dataset.bootState = 'loading';
  const feedback = f.$('preview-load-status');
  assert.ok(
    f.$('editor-feedback').contains(feedback),
    'header Play uses the same visible reading region',
  );
  assert.equal(f.document.querySelectorAll('#preview-load-status').length, 1);
  assert.equal(feedback.hidden, false, 'preparation text cannot replace the pending child status');
  assert.equal(f.$('editor-status').hidden, true);
  f.$('preview-frame').contentDocument = child;
  f.$('preview-frame').emit('load');
  assert.equal(f.$('preview-load-status').dataset.state, 'busy');
  child.documentElement.dataset.bootState = 'ready';
  f.poll();
  assert.equal(f.$('preview-load-status').dataset.state, 'ready');
  assert.equal(feedback.hidden, false);
  f.$('preview-button').focus();
  const originalSource = f.$('preview-frame').src;
  f.$('preview-button').onclick();
  assert.equal(f.document.activeElement, f.$('preview-button'));
  assert.equal(feedback.hidden, false);
  assert.equal(f.$('editor-status').hidden, true);
  assert.notEqual(f.$('preview-frame').src, originalSource);
  f.poll();
  assert.equal(f.$('preview-load-status').dataset.state, 'busy');
  child.documentElement.dataset.bootState = 'failed';
  f.$('preview-frame').emit('load');
  assert.equal(f.$('preview-load-status').dataset.state, 'error');
  assert.match(f.$('preview-load-status').textContent, /recovery controls/);
  assert.equal(feedback.hidden, false);
  assert.equal(f.$('preview-load-status'), feedback);
});

test('replay file reading acknowledges immediately, cancellation preserves the result, and a fresh real recording verifies', async (t) => {
  const f = await harness(t),
    readGate = deferred();
  f.$('replay-result').textContent = 'Previous verification';
  f.$('replay-file').files = [{ size: 100, text: () => readGate.promise }];
  f.$('replay-file').onchange();
  assert.equal(f.$('replay-status').dataset.state, 'busy');
  assert.match(f.$('replay-status').textContent, /Reading the selected replay/);
  f.$('cancel-replay').onclick();
  readGate.resolve('{bad');
  await settle();
  assert.equal(f.$('replay-status').dataset.state, 'cancelled');
  assert.equal(f.$('replay-result').textContent, 'Previous verification');
  f.$('replay-paste').value = await readFile(
    new URL('../replay-theater/data/fieldcraft-01.replay.json', import.meta.url),
    'utf8',
  );
  await f.$('verify-replay-json').onclick();
  assert.equal(f.$('replay-status').dataset.state, 'ready');
  assert.match(f.$('replay-status').textContent, /matches its full recorded/);
  assert.equal(JSON.parse(f.$('replay-result').textContent).match, true);
  assert.equal(f.$('cancel-replay').hidden, true);
});

test('the original editor status and Cancel share one bounded sticky region through decode, cancel, failure and Undo', async (t) => {
  const f = await harness(t, { deferImage: true }),
    rail = f.$('editor-feedback'),
    status = f.$('editor-status'),
    cancel = f.$('cancel-import'),
    before = f.$('level-json').value,
    preview = f.$('preview-frame').src;
  assert.ok(rail, 'deep operations need a persistent shared feedback region');
  assert.equal(status.parentElement, f.$('editor-messages'));
  assert.ok(rail.contains(cancel));
  assert.equal(
    status.getAttribute('tabindex'),
    '0',
    'the complete bounded message remains keyboard-readable',
  );
  assert.equal(f.document.querySelectorAll('#editor-status').length, 1);
  assert.equal(f.document.querySelectorAll('#cancel-import').length, 1);
  const pending = f.load.onclick();
  await settle();
  assert.equal(status.dataset.state, 'busy');
  assert.equal(cancel.hidden, false);
  assert.equal(status.parentElement, f.$('editor-messages'));
  assert.ok(rail.contains(cancel));
  cancel.focus();
  cancel.onclick();
  await f.finishImage(0);
  await pending;
  assert.equal(f.$('level-json').value, before);
  assert.equal(f.$('preview-frame').src, preview);
  assert.match(status.textContent, /cancelled/);
  f.$('import-file').files = [{ size: 2, text: async () => '{bad' }];
  await f.$('import-file').onchange();
  assert.equal(status.dataset.state, 'error');
  assert.ok(rail.contains(status), 'errors remain in the same visible owner');
  const generate = f.$('generate-button');
  generate.focus();
  await generate.onclick();
  assert.notEqual(f.$('level-json').value, before);
  assert.equal(f.document.activeElement, generate, 'status changes do not move focus');
  f.$('undo-button').onclick();
  assert.equal(f.$('level-json').value, before, 'Undo retains original content bytes');
  assert.equal(f.$('editor-status'), status);
  assert.equal(f.$('cancel-import'), cancel);
  const css = await readFile(new URL('../playground/playground.css', import.meta.url), 'utf8'),
    common = await readFile(new URL('../style.css', import.meta.url), 'utf8');
  assert.equal(rail.classList.contains('dialog-operation-rail'), true);
  assert.match(common, /\.dialog-operation-rail\s*\{[^}]*position:\s*sticky/s);
  assert.match(css, /#editor-messages\s*\{[^}]*max-block-size:\s*24dvh[^}]*overflow:\s*auto/s);
  assert.match(css, /#editor-feedback \.feedback-actions button\s*\{[^}]*min-block-size:\s*44px/s);
  assert.match(css, /#editor-messages\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column/s);
  assert.match(css, /#editor-feedback \.editor-status\s*\{[^}]*flex:\s*0 0 auto/s);
});

test('page feedback clears only an obscured focused control and releases listeners on pagehide', async (t) => {
  const f = await harness(t),
    rail = f.$('editor-feedback'),
    root = f.document.documentElement,
    generate = f.$('generate-button');
  root.scrollTop = 1500;
  let railHeight = 152,
    initialTop = 140;
  rail.getBoundingClientRect = () => ({ top: 0, bottom: railHeight, height: railHeight });
  generate.getBoundingClientRect = () => ({
    top: initialTop + 1500 - root.scrollTop,
    bottom: initialTop + 1500 - root.scrollTop + 44,
    height: 44,
  });
  generate.focus();
  f.flushLayout();
  assert.equal(
    root.scrollTop,
    1480,
    'minimum20px clearance for a44px control in short-landscape geometry',
  );
  assert.equal(generate.getBoundingClientRect().top, 160);
  assert.equal(f.document.activeElement, generate);
  assert.equal(root.style.scrollPaddingBlockStart, '160px');
  f.flushLayout();
  assert.equal(root.scrollTop, 1480, 'no oscillation after the scheduled layout');
  railHeight = 202;
  f.resizeFeedback();
  f.flushLayout();
  assert.equal(
    generate.getBoundingClientRect().top,
    210,
    'actual rail growth clears the same control',
  );
  const beforeManual = root.scrollTop;
  root.scrollTop += 900;
  f.window.emit('scroll');
  f.flushLayout();
  assert.equal(root.scrollTop, beforeManual + 900, 'ordinary manual scrolling is not overridden');
  f.resizeFeedback();
  f.flushLayout();
  assert.equal(
    root.scrollTop,
    beforeManual + 900,
    'a deliberately offscreen old focus is not pulled back',
  );
  f.$('editor-status').focus();
  f.resizeFeedback();
  f.flushLayout();
  assert.equal(
    root.scrollTop,
    beforeManual + 900,
    'keyboard reading inside feedback keeps its own scroll',
  );
  root.scrollTop = 1500;
  initialTop = 398.53125;
  railHeight = 202;
  generate.focus();
  f.flushLayout();
  assert.equal(root.scrollTop, 1500, 'native portrait trigger geometry already clears the rail');
  f.window.emit('pagehide');
  const disposedScroll = root.scrollTop;
  initialTop = 40;
  generate.focus();
  f.resizeFeedback();
  f.flushLayout();
  assert.equal(root.scrollTop, disposedScroll, 'late queued work cannot scroll a departed page');
  assert.ok(f.resizeObservers.every((observer) => observer.disconnected));
  f.window.emit('pageshow', { persisted: true });
  f.flushLayout();
  assert.equal(
    generate.getBoundingClientRect().top,
    210,
    'persisted Back restores measured focus protection',
  );
  assert.equal(f.document.activeElement, generate);
  const restoredObservers = f.resizeObservers.length;
  f.window.emit('pageshow', { persisted: true });
  f.flushLayout();
  assert.equal(
    f.resizeObservers.length,
    restoredObservers,
    'repeated pageshow never duplicates the owner',
  );
  assert.equal(f.resizeObservers.filter((observer) => !observer.disconnected).length, 1);
});

test('editor and replay owners share one visible region without hiding either pending Cancel or accepting stale verification', async (t) => {
  const f = await harness(t, { deferImage: true }),
    rail = f.$('editor-feedback'),
    replayStatus = f.$('replay-status'),
    replayCancel = f.$('cancel-replay'),
    editorStatus = f.$('editor-status'),
    editorCancel = f.$('cancel-import'),
    readGate = deferred(),
    before = f.$('level-json').value,
    previousResult = 'Previous verification remains until a current result commits';
  for (const node of [replayStatus, replayCancel, editorStatus, editorCancel]) {
    assert.ok(rail.contains(node));
    assert.equal(f.document.querySelectorAll(`#${node.id}`).length, 1);
  }
  assert.equal(replayStatus.parentElement, editorStatus.parentElement);
  assert.equal(replayCancel.parentElement, editorCancel.parentElement);
  f.$('replay-result').textContent = previousResult;
  f.$('replay-paste').value = 'Retained paste draft';
  f.$('replay-file').files = [{ size: 100, text: () => readGate.promise }];
  f.$('editor-messages').scrollTop = 90;
  f.$('replay-file').onchange();
  assert.equal(replayStatus.style.order, '-1');
  assert.equal(editorStatus.style.order, '0');
  assert.equal(
    f.$('editor-messages').scrollTop,
    0,
    'new replay owner is visible before the first read',
  );
  assert.equal(replayStatus.hidden, false);
  assert.equal(editorStatus.hidden, true, 'old Generate/editor message gives way to replay work');
  assert.equal(replayCancel.hidden, false);
  assert.equal(replayStatus.dataset.state, 'busy');
  const editJob = f.load.onclick();
  await settle();
  assert.equal(editorStatus.style.order, '-1');
  assert.equal(replayStatus.style.order, '0');
  for (const node of [replayStatus, replayCancel, editorStatus, editorCancel])
    assert.equal(node.hidden, false, 'concurrent owner retains its message and escape action');
  editorCancel.onclick();
  await f.finishImage(0);
  await editJob;
  assert.equal(f.$('level-json').value, before);
  assert.equal(replayCancel.hidden, false, 'editor completion cannot detach replay ownership');
  const timer = f.holdReplayYields(),
    replay = await readFile(
      new URL('../replay-theater/data/fieldcraft-01.replay.json', import.meta.url),
      'utf8',
    );
  f.$('editor-messages').scrollTop = 12;
  readGate.resolve(replay);
  await settle();
  assert.equal(f.$('editor-messages').scrollTop, 12, 'progress does not reset reading scroll');
  assert.match(replayStatus.textContent, /Verifying recorded simulation/);
  assert.equal(timer.callbacks.length, 1, 'actual verification reached its first host yield');
  replayCancel.focus();
  replayCancel.onclick();
  assert.equal(f.document.activeElement, replayCancel, 'presentation never assigns focus');
  assert.equal(replayCancel.hidden, true);
  assert.equal(replayStatus.hidden, false);
  assert.equal(editorStatus.hidden, true);
  timer.restore();
  timer.callbacks.shift()();
  await settle();
  assert.equal(replayStatus.dataset.state, 'cancelled');
  assert.equal(f.$('replay-result').textContent, previousResult);
  assert.equal(f.$('replay-paste').value, 'Retained paste draft');
  assert.equal(f.$('level-json').value, before);
  f.$('replay-paste').value = replay;
  await f.$('verify-replay-json').onclick();
  assert.equal(replayStatus.hidden, false, 'pasted JSON uses the same visible status owner');
  assert.equal(replayStatus.dataset.state, 'ready');
  assert.equal(JSON.parse(f.$('replay-result').textContent).match, true);
  assert.equal(f.$('replay-paste').value, replay, 'verification preserves exact pasted bytes');
  assert.equal(f.$('replay-status'), replayStatus);
  assert.equal(f.$('cancel-replay'), replayCancel);
  replayStatus.focus();
  const messages = f.$('editor-messages');
  messages.scrollTop = 9;
  replayStatus.getBoundingClientRect = () => ({ top: replayStatus.style.order === '-1' ? 10 : 74 });
  f.$('clear-goal').onclick();
  assert.equal(editorStatus.style.order, '-1', 'the actual newest owner is ordered first');
  assert.equal(messages.scrollTop, 73, 'focused message keeps its prior reading offset');
  assert.equal(
    replayStatus.hidden,
    false,
    'another owner cannot hide the message currently being read',
  );
  assert.equal(f.document.activeElement, replayStatus);
});

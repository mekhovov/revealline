import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script, createContext } from 'node:vm';
import { parse as parseModule } from 'acorn';
import { parse as parseHTML } from 'parse5';
import { Document, Element, Events } from './helpers/couch-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { createBenchmarkSelection } from '../../authoring/playable-benchmark/session.mjs';
import { createSceneComparison } from '../../authoring/playable-benchmark/comparison.mjs';
import {
  createReadyCue,
  createResultFocusCue,
  attachDeliberateButton,
} from '../../authoring/playable-benchmark/result-controls.mjs';
import { createPreviewLifecycle } from '../../authoring/game-feel-lab/lifecycle.mjs';

const appURL = new URL('../../authoring/playable-benchmark/app.mjs', import.meta.url);
const source = await readFile(appURL, 'utf8');
const html = await readFile(new URL('./index.html', appURL), 'utf8');
const imports = parseModule(source, { ecmaVersion: 'latest', sourceType: 'module' }).body.filter(
  (node) => node.type === 'ImportDeclaration',
);
const hostSource = imports
  .reduceRight((text, node) => text.slice(0, node.start) + text.slice(node.end), source)
  .replaceAll('import.meta.url', JSON.stringify(appURL.href));
const flush = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => {
  let resolve;
  const promise = new Promise((yes) => (resolve = yes));
  return { promise, resolve };
};

// Model only native focusability and closed-details behavior. This is not a
// browser layout check. The application handlers and async owners run unchanged.
class FocusElement extends Element {
  getClientRects() {
    for (let parent = this.parentElement; parent; parent = parent.parentElement)
      if (
        parent.tagName === 'DETAILS' &&
        !parent.open &&
        !parent.querySelector('summary')?.contains(this)
      )
        return [];
    return super.getClientRects();
  }
  focus() {
    if (!this.disabled && !this.closest('[inert]') && this.getClientRects().length) super.focus();
  }
  getContext() {
    return {};
  }
}

async function harness(t) {
  const document = new Document();
  document.createElement = (tag) => new FocusElement(document, tag);
  const mount = (node, parent) => {
    if (!node.tagName) {
      for (const child of node.childNodes ?? []) mount(child, parent);
      return;
    }
    if (['html', 'body', 'head'].includes(node.tagName)) {
      for (const child of node.childNodes ?? []) mount(child, parent);
      return;
    }
    const element = document.createElement(node.tagName);
    for (const { name, value } of node.attrs) {
      element.setAttribute(name, value);
      if (name === 'class') element.className = value;
      if (['type', 'value'].includes(name)) element[name] = value;
      if (['hidden', 'disabled', 'checked', 'open'].includes(name)) element[name] = true;
    }
    parent.append(element);
    for (const child of node.childNodes ?? []) mount(child, element);
  };
  mount(parseHTML(html), document.body);
  const $ = (id) => document.getElementById(id);
  const setup = $('mission').closest('details');
  const summary = setup.querySelector('summary');
  const window = new Events();
  const scenes = [],
    requests = [],
    candidates = [];
  const catalog = {
    entries: ['first', 'second'].map((id) => ({ id, manifest: { level: { name: id } } })),
  };
  const input = {
    clears: 0,
    clear() {
      this.clears++;
    },
    poll: () => ({}),
    destroy() {},
  };
  function scene(entry, options) {
    const session = {
      playing: false,
      run: { tick: 0, status: 'running', level: { goal: { coverage: 0.3 } } },
      summary: { tick: 0, status: 'running', coverage: 0, lives: 3, score: 0, time: 0 },
      events: [],
      pause() {
        this.playing = false;
      },
      start() {
        this.playing = true;
        return true;
      },
    };
    const actors = { snapshot: {}, pin: () => ({ approved: true }) };
    const comparison = createSceneComparison({
      actors,
      session,
      onStatus: options.onComparisonStatus,
      acquire: () => {
        const request = deferred();
        const result = {
          snapshot: {},
          provenance: {},
          releases: 0,
          release() {
            this.releases++;
          },
        };
        // The real comparison owner may dispose this even after cancellation.
        result.release = result.release.bind(result);
        candidates.push({ ...request, result });
        return request.promise;
      },
    });
    const result = {
      entry,
      session,
      actors,
      comparison,
      painters: [{ draw() {} }, { draw() {} }],
      disposals: 0,
      dispose() {
        this.disposals++;
        comparison.dispose();
      },
    };
    scenes.push(result);
    return result;
  }
  const dependencies = {
    loadBenchmarkCatalog: async () => catalog,
    createBenchmarkSelection,
    prepareBenchmarkScene: (entry, options) => {
      const request = deferred();
      requests.push({ ...request, options, result: scene(entry, options) });
      return request.promise;
    },
    createReadyCue,
    createResultFocusCue,
    attachDeliberateButton,
    boardPaintSizeForRun: () => ({ width: 1152, height: 576 }),
    attachBenchmarkInput: () => input,
    createPreviewLifecycle,
  };
  for (const item of imports)
    for (const specifier of item.specifiers)
      assert.ok(specifier.local.name in dependencies, `Explicit boundary: ${specifier.local.name}`);
  const context = createContext({
    ...dependencies,
    document,
    window,
    matchMedia: () => ({ matches: false }),
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {},
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    URL,
    AbortController,
  });
  new Script(hostSource, { filename: appURL.pathname }).runInContext(context);
  t.after(() => window.emit('pagehide', { persisted: false }));
  await waitFor(() => requests.length === 1, { message: 'Actual boot did not start preparation.' });
  const accept = async (request = requests.at(-1)) => {
    request.resolve(request.result);
    await flush();
  };
  const cancel = () => {
    $('cancel').focus();
    $('cancel').click();
  };
  return { $, document, setup, summary, requests, scenes, candidates, input, accept, cancel };
}

test('automatic first preparation cancels to the visible native summary, retaining late disposal', async (t) => {
  const h = await harness(t);
  assert.equal(h.setup.open, false);
  assert.equal(h.$('mission').getClientRects().length, 0);
  h.cancel();
  assert.equal(h.document.activeElement, h.summary);
  assert.equal(h.setup.open, false, 'Cancellation does not change the native details state.');
  assert.equal(h.$('start').disabled, true);
  assert.equal(h.$('loading').textContent, 'Loading cancelled. Choose a mission when ready.');
  assert.equal(h.requests[0].options.signal.aborted, true);
  h.$('show-comparison').focus();
  await h.accept(h.requests[0]);
  assert.equal(h.scenes[0].disposals, 1, 'A late scene never becomes the accepted run.');
  assert.equal(
    h.document.activeElement,
    h.$('show-comparison'),
    'Late completion cannot claim focus.',
  );
});

test('mission and Load cancellation each return to their own visible opener', async (t) => {
  const h = await harness(t);
  await h.accept();
  h.setup.open = true;
  for (const opener of ['mission', 'load']) {
    h.$('mission').value = 'second';
    h.$(opener).focus();
    h.$(opener).emit(opener === 'mission' ? 'change' : 'click');
    h.cancel();
    assert.equal(h.document.activeElement, h.$(opener));
    assert.equal(h.$('mission').value, 'first');
    assert.equal(h.scenes[0].session.playing, false);
    await h.accept();
  }
});

test('appearance cancellation returns to Actors without changing the retained run or override', async (t) => {
  const h = await harness(t);
  await h.accept();
  h.$('start').click();
  h.setup.open = true;
  const previousClears = h.input.clears;
  h.$('comparison-body').focus();
  h.$('comparison-body').value = 'v3-detailed';
  h.$('comparison-body').emit('change');
  assert.equal(h.scenes[0].session.playing, false);
  assert.ok(h.input.clears > previousClears, 'The existing neutral-input boundary stays intact.');
  h.cancel();
  assert.equal(h.document.activeElement, h.$('comparison-body'));
  assert.equal(h.$('comparison-body').value, 'approved');
  assert.equal(h.$('loading').textContent, 'Loading cancelled. The previous run remains paused.');
  assert.equal(h.scenes[0].session.run.tick, 0);
  h.$('show-comparison').focus();
  const late = h.candidates[0];
  late.resolve(late.result);
  await flush();
  assert.equal(late.result.releases, 1);
  assert.equal(h.scenes[0].comparison.body, 'approved');
  assert.equal(h.document.activeElement, h.$('show-comparison'));
});

test('collapsed or unavailable setup falls back to summary or enabled Start without reopening details', async (t) => {
  const h = await harness(t);
  await h.accept();
  for (const hidden of [false, true]) {
    h.setup.hidden = false;
    h.setup.open = true;
    h.$('comparison-body').value = 'v3-compact';
    h.$('comparison-body').emit('change');
    h.setup.open = false;
    h.setup.hidden = hidden;
    h.cancel();
    assert.equal(h.document.activeElement, hidden ? h.$('start') : h.summary);
    assert.equal(h.setup.open, false);
    assert.equal(h.scenes[0].session.playing, false);
    const late = h.candidates.at(-1);
    late.resolve(late.result);
    await flush();
  }
});

test('cancellation preserves unrelated focus and old completion cannot retire a newer opener', async (t) => {
  const h = await harness(t);
  await h.accept();
  h.setup.open = true;
  h.$('comparison-body').value = 'v3-compact';
  h.$('comparison-body').emit('change');
  const first = h.candidates[0];
  h.$('comparison-body').value = 'v3-detailed';
  h.$('comparison-body').emit('change');
  first.resolve(first.result);
  await flush();
  h.cancel();
  assert.equal(
    h.document.activeElement,
    h.$('comparison-body'),
    'Newer operation retains its opener.',
  );
  const second = h.candidates[1];
  second.resolve(second.result);
  await flush();
  h.$('mission').value = 'second';
  h.$('mission').emit('change');
  h.$('show-comparison').focus();
  h.$('cancel').onclick();
  assert.equal(
    h.document.activeElement,
    h.$('show-comparison'),
    'An action cannot override moved focus.',
  );
  await h.accept();
  assert.equal(h.document.activeElement, h.$('show-comparison'));
});

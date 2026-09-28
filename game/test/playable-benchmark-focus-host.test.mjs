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
import { outcomeMessage } from '../../authoring/playable-benchmark/outcome.mjs';
import {
  createReadyCue,
  createResultFocusCue,
  attachDeliberateButton,
} from '../../authoring/playable-benchmark/result-controls.mjs';
import { createPreviewLifecycle } from '../../authoring/game-feel-lab/lifecycle.mjs';
import {
  createBenchmarkPerformance,
  candidateMemory,
} from '../../authoring/playable-benchmark/performance.mjs';

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
  let scheduledFrame = null;
  let cpuClock = 0;
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
      advances: 0,
      advance() {
        if (this.playing) this.advances++;
      },
      pause() {
        this.playing = false;
      },
      start() {
        this.playing = true;
        return true;
      },
      retry() {
        this.playing = false;
        this.run.tick = 0;
        this.run.status = 'running';
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
      painters: [0, 1].map(() => ({
        draws: 0,
        draw(_context, _run, _dt, options) {
          this.draws++;
          this.lastOptions = options;
        },
      })),
      resetPresentation() {},
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
    createBenchmarkPerformance,
    candidateMemory,
    outcomeMessage,
  };
  for (const item of imports)
    for (const specifier of item.specifiers)
      assert.ok(specifier.local.name in dependencies, `Explicit boundary: ${specifier.local.name}`);
  const context = createContext({
    ...dependencies,
    document,
    window,
    matchMedia: () => ({ matches: false }),
    requestAnimationFrame: (callback) => {
      scheduledFrame = callback;
      return 1;
    },
    cancelAnimationFrame() {
      scheduledFrame = null;
    },
    performance: { now: () => (cpuClock += 0.5) },
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
  return {
    $,
    document,
    window,
    setup,
    summary,
    requests,
    scenes,
    candidates,
    input,
    accept,
    cancel,
    frame(now) {
      assert.ok(scheduledFrame, 'Host owns an active frame callback.');
      scheduledFrame(now);
    },
    metrics() {
      $('performance-panel').emit('toggle');
      return JSON.parse($('performance-output').textContent);
    },
  };
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

test('host measures only opted-in uninterrupted play and retains both painter costs', async (t) => {
  const h = await harness(t);
  await h.accept();
  h.$('start').click();
  h.frame(1000);
  h.frame(1016);
  assert.equal(h.metrics().timing.totalSamples, 0);
  const advances = h.scenes[0].session.advances;
  h.$('measure-performance').checked = true;
  h.$('measure-performance').emit('change');
  h.frame(1032);
  assert.equal(h.metrics().timing.totalSamples, 0, 'First active frame establishes a baseline.');
  h.frame(1048);
  h.frame(1148);
  let report = h.metrics();
  assert.equal(report.timing.totalSamples, 2);
  assert.equal(report.timing.frameInterval.worstMs, 100, 'Slow active intervals are not clipped.');
  assert.equal(report.timing.referenceDrawCPU.p50Ms, 0.5);
  assert.equal(report.timing.comparisonDrawCPU.p50Ms, 0.5);
  assert.equal(h.scenes[0].session.advances, advances + 3);
  h.$('pause').click();
  h.frame(1164);
  h.frame(1180);
  assert.equal(h.metrics().timing.totalSamples, 2, 'Paused RAF callbacks cannot become samples.');
  h.$('start').click();
  h.frame(1196);
  assert.equal(h.metrics().timing.totalSamples, 2, 'Resume does not bridge paused time.');
  h.frame(1212);
  h.frame(1600);
  report = h.metrics();
  assert.equal(report.timing.totalSamples, 3);
  assert.equal(report.timing.excludedGapCount, 2);
  assert.equal(h.scenes[0].session.playing, false, 'Existing long-frame pause remains.');
  assert.equal(report.timing.frameInterval.worstMs, 100);
  assert.equal(h.scenes[0].painters[0].draws, h.scenes[0].painters[1].draws);
  assert.equal(
    report.candidateMemory.approvedSharedBytes,
    null,
    'Unknown shared memory is not zero.',
  );
});

test('changing comparison conditions and viewport resets samples without mixing configurations', async (t) => {
  const h = await harness(t);
  await h.accept();
  h.$('measure-performance').checked = true;
  h.$('measure-performance').emit('change');
  h.$('start').click();
  h.frame(1000);
  h.frame(1016);
  assert.equal(h.metrics().timing.totalSamples, 1);
  h.$('show-comparison').checked = false;
  h.$('show-comparison').emit('change');
  h.frame(1032);
  h.frame(1048);
  let report = h.metrics();
  assert.equal(report.comparisonVisible, false);
  assert.equal(report.timing.totalSamples, 1);
  assert.equal(report.timing.comparisonDrawCPU.sampleCount, 1, 'Hidden painter still runs.');
  h.window.emit('resize');
  assert.equal(h.metrics().timing.totalSamples, 0);
  h.frame(1064);
  h.frame(1080);
  h.$('comparison-body').value = 'v4-detailed';
  h.$('comparison-body').emit('change');
  h.frame(1096);
  h.frame(1112);
  assert.equal(h.metrics().timing.totalSamples, 0, 'Pending appearance does not collect frames.');
  h.cancel();
  report = h.metrics();
  assert.equal(report.comparison, 'approved');
  assert.equal(report.timing.totalSamples, 0);
  h.$('reference-reduced').checked = true;
  h.$('reference-reduced').emit('change');
  report = h.metrics();
  assert.equal(report.referenceReduced, true);
  assert.equal(report.timing.totalSamples, 0);
});

test('a controller pause during the actual input poll cannot append a paused timing sample', async (t) => {
  const h = await harness(t);
  await h.accept();
  h.$('measure-performance').checked = true;
  h.$('measure-performance').emit('change');
  h.$('start').click();
  h.frame(1000);
  h.frame(1016);
  const advances = h.scenes[0].session.advances;
  h.input.poll = () => {
    h.$('pause').click();
    return {};
  };
  h.frame(1032);
  const report = h.metrics();
  assert.equal(h.scenes[0].session.playing, false);
  assert.equal(h.scenes[0].session.advances, advances);
  assert.equal(report.timing.totalSamples, 1);
  assert.equal(report.timing.referenceDrawCPU.sampleCount, 1);
  assert.equal(report.timing.comparisonDrawCPU.sampleCount, 1);
  assert.equal(report.timing.excludedGapCount, 1);
});

test('Retry cue and background return begin new measurement segments without sampling waits', async (t) => {
  const h = await harness(t);
  await h.accept();
  h.$('measure-performance').checked = true;
  h.$('measure-performance').emit('change');
  h.$('start').click();
  h.frame(1000);
  h.frame(1016);
  assert.equal(h.metrics().timing.totalSamples, 1);
  h.$('retry').emit('pointerdown', { button: 0, pointerId: 7, isPrimary: true });
  h.$('retry').emit('pointerup', { pointerId: 7 });
  h.$('retry').emit('click', { detail: 1 });
  for (const now of [1032, 1232, 1432, 1632]) h.frame(now);
  assert.equal(h.metrics().timing.totalSamples, 0, 'The 600 ms cue never becomes play timing.');
  h.frame(1648);
  h.frame(1664);
  assert.equal(h.metrics().timing.totalSamples, 1);
  h.document.hidden = true;
  h.document.emit('visibilitychange');
  h.document.hidden = false;
  h.document.emit('visibilitychange');
  assert.equal(h.scenes[0].session.playing, false);
  h.frame(2000);
  assert.equal(h.metrics().timing.totalSamples, 1);
  h.$('start').click();
  h.frame(2016);
  h.frame(2032);
  assert.equal(h.metrics().timing.totalSamples, 2);
  assert.equal(h.metrics().timing.frameInterval.worstMs, 16);
});

test('contact study pauses and clears input, resets measurements and only changes the second painter', async (t) => {
  const h = await harness(t);
  await h.accept();
  const scene = h.scenes[0];
  h.$('measure-performance').checked = true;
  h.$('measure-performance').emit('change');
  h.$('start').click();
  h.frame(1000);
  h.frame(1016);
  assert.equal(h.metrics().timing.totalSamples, 1);
  const advances = scene.session.advances;
  const clears = h.input.clears;
  h.setup.open = true;
  h.$('contact-style').focus();
  h.$('contact-style').value = 'fine-outline';
  h.$('contact-style').emit('change');
  assert.equal(scene.session.playing, false);
  assert.equal(scene.session.advances, advances);
  assert.ok(h.input.clears > clears);
  assert.equal(h.document.activeElement, h.$('contact-style'));
  assert.equal(h.metrics().timing.totalSamples, 0);
  assert.equal(h.metrics().accents.contactStyle, 'fine-outline');
  assert.equal(scene.painters[0].lastOptions.feedbackComparison, undefined);
  assert.equal(scene.painters[1].lastOptions.feedbackComparison.contactStyle, 'fine-outline');
  assert.match(h.$('comparison-label').textContent, /fine contact study/);
  h.$('retry').emit('pointerdown', { button: 0, pointerId: 3, isPrimary: true });
  h.$('retry').emit('pointerup', { pointerId: 3 });
  h.$('retry').emit('click', { detail: 1 });
  assert.equal(
    scene.comparison.feedback.contactStyle,
    'fine-outline',
    'Retry retains accepted study',
  );
  h.$('pause').click();
  h.$('contact-style').value = 'hide-contact';
  h.$('contact-style').emit('change');
  assert.equal(h.$('contact-style').value, 'standard');
  assert.equal(scene.painters[1].lastOptions.feedbackComparison.contactStyle, 'standard');
});

test('actual event handler replaces stale loss feedback without stealing focus or repeating status', async (t) => {
  const h = await harness(t);
  await h.accept();
  h.setup.open = true;
  h.$('mission').focus();
  const run = h.scenes[0].session.run;
  const onStep = h.requests[0].options.onStep;
  let text = h.$('outcome').textContent,
    writes = 0;
  Object.defineProperty(h.$('outcome'), 'textContent', {
    configurable: true,
    get: () => text,
    set: (value) => {
      text = value;
      writes++;
    },
  });
  Object.assign(run, { status: 'respawning', failureCause: 'self-contact', lives: 2 });
  onStep([{ type: 'player.failed', cause: 'self-contact', lives: 2 }], run);
  assert.match(text, /unfinished line crossed itself/i);
  assert.doesNotMatch(text, /self-contact/);
  assert.equal(writes, 1);
  onStep([], run);
  onStep([{ type: 'cut.started' }], run);
  assert.equal(writes, 1);
  run.status = 'running';
  onStep([{ type: 'player.respawned' }], run);
  assert.doesNotMatch(text, /crossed itself|recovery continues/i);
  assert.equal(writes, 2);
  onStep([{ type: 'cells.claimed', indices: [1, 2], coverage: 0.21 }], run);
  assert.equal(writes, 3);
  const beforeWin = text;
  run.status = 'won';
  onStep([{ type: 'cells.claimed', coverage: 0.31 }, { type: 'run.completed' }], run);
  assert.notEqual(text, beforeWin);
  assert.match(text, /won|complete/i);
  assert.doesNotMatch(text, /crossed itself|self-contact/i);
  assert.equal(writes, 4);
  assert.equal(h.$('loading').textContent, '', 'Terminal narration uses only the outcome region');
  assert.equal(h.document.activeElement, h.$('mission'), 'Status never takes setup focus');
  onStep([], run);
  assert.equal(writes, 4);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  reviewTarget,
  frameSummary,
  resourceSummary,
} from '../docs/verification/company-review-model.mjs';

test('review targets stay on the same server and never navigate outside a company player', () => {
  const base = 'http://localhost:8775/docs/verification/company-review.html';
  assert.equal(
    reviewTarget('../../game/company.html?edition=coupa-all', base),
    'http://localhost:8775/game/company.html?edition=coupa-all',
  );
  assert.equal(
    reviewTarget('/baseline/game/company.html', base),
    'http://localhost:8775/baseline/game/company.html',
  );
  for (const url of [
    'https://example.com/game/company.html',
    '/game/index.html',
    'javascript:alert(1)',
    'http://name@localhost:8775/game/company.html',
  ])
    assert.throws(() => reviewTarget(url, base));
});
test('frame summaries retain slow frames, reject invalid samples and do not fabricate empty measurements', () => {
  assert.equal(frameSummary([]), null);
  assert.deepEqual(frameSummary([16, 17, 16, 80, 0, -1, NaN]), {
    frames: 4,
    p50Ms: 16,
    p95Ms: 80,
    maxMs: 80,
    over33ms: 1,
  });
});
test('resource counts retain cached/zero-transfer entries without presenting them as network downloads', () => {
  assert.deepEqual(
    resourceSummary([
      { transferSize: 0, decodedBodySize: 100 },
      { transferSize: 350, decodedBodySize: 50 },
    ]),
    {
      resourceTimingEntries: 2,
      resourceTimingMayBeIncomplete: true,
      transferBytes: 350,
      decodedBytes: 150,
      zeroTransferEntries: 1,
    },
  );
});

import { mountCompanyReview } from '../docs/verification/company-review.mjs';

class Events {
  listeners = new Map();
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
  }
  removeEventListener(type, callback) {
    this.listeners.get(type)?.delete(callback);
  }
  emit(type, event = {}) {
    for (const callback of [...(this.listeners.get(type) ?? [])]) callback(event);
  }
}
class Element extends Events {
  constructor(id) {
    super();
    this.id = id;
    this.textContent = '';
    this.value = '';
    this.dataset = {};
    this.disabled = false;
    this.hidden = false;
    this.parentElement = null;
  }
  closest(selector) {
    if (selector === 'button') return this;
    if (selector === '[hidden], [inert]')
      return this.hidden ? this : (this.parentElement?.closest(selector) ?? null);
    return null;
  }
  getClientRects() {
    return this.hidden ? [] : [this.getBoundingClientRect()];
  }
  getBoundingClientRect() {
    return { left: 0, right: 100, top: 0, bottom: 44, width: 100, height: 44 };
  }
  getAttribute() {
    return null;
  }
}
function reviewHarness() {
  let now = 0,
    nextTimer = 0;
  const timers = new Map(),
    pages = [],
    parent = new Events(),
    ui = new Map();
  for (const id of [
    'label',
    'target',
    'width',
    'load',
    'frames',
    'layout',
    'game',
    'log',
    'status',
    'export',
  ])
    ui.set(id, new Element(id));
  ui.get('label').value = 'Frozen baseline';
  ui.get('target').value = '../../game/company.html?edition=coupa-all';
  ui.get('width').value = '1280';
  ui.get('frames').disabled = ui.get('layout').disabled = true;
  parent.hidden = false;
  parent.getElementById = (id) => ui.get(id);
  const window = Object.assign(new Events(), {
    location: { href: 'http://localhost:8775/docs/verification/company-review.html' },
    performance: { now: () => now },
    setTimeout(callback, ms) {
      const id = ++nextTimer;
      timers.set(id, { at: now + ms, callback });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  });
  const dispose = mountCompanyReview({ document: parent, window });
  function page(href = 'http://localhost:8775/game/company.html?edition=coupa-all') {
    const doc = Object.assign(new Events(), {
      hidden: false,
      title: 'Company game',
      documentElement: { dataset: { companyState: 'loading' }, scrollWidth: 1280 },
    });
    const nodes = new Map();
    for (const id of [
      'play-screen',
      'play-overlay',
      'pause-button',
      'campaigns',
      'notice',
      'start-campaign',
      'resume-button',
      'mission-title',
    ])
      nodes.set(id, new Element(id));
    nodes.get('play-screen').hidden = true;
    nodes.get('resume-button').parentElement = nodes.get('play-screen');
    nodes.get('start-campaign').disabled = true;
    nodes.get('notice').textContent = 'Preparing';
    nodes.get('mission-title').textContent = 'First Connection';
    nodes.get('pause-button').textContent = 'Pause';
    const resources = [],
      frames = new Map();
    let nextFrame = 0;
    const win = Object.assign(new Events(), {
      location: { href },
      performance: { getEntriesByType: () => [...resources] },
      innerWidth: 1280,
      innerHeight: 800,
      devicePixelRatio: 1,
      requestAnimationFrame(callback) {
        const id = ++nextFrame;
        frames.set(id, callback);
        return id;
      },
      cancelAnimationFrame(id) {
        frames.delete(id);
      },
    });
    doc.getElementById = (id) => nodes.get(id);
    doc.querySelectorAll = () => [...nodes.values()];
    const result = {
      doc,
      win,
      nodes,
      resources,
      frames,
      ready() {
        doc.documentElement.dataset.companyState = 'ready';
        nodes.get('campaigns').childElementCount = 5;
        nodes.get('notice').textContent = 'Choose your journey';
        nodes.get('start-campaign').disabled = false;
      },
      play() {
        nodes.get('play-screen').hidden = false;
        nodes.get('play-overlay').hidden = true;
        nodes.get('pause-button').textContent = 'Pause';
      },
    };
    pages.push(result);
    return result;
  }
  function load(child = page()) {
    ui.get('load').onclick();
    navigate(child);
    return child;
  }
  function navigate(child) {
    ui.get('game').contentWindow = child.win;
    ui.get('game').contentDocument = child.doc;
    ui.get('game').onload();
  }
  function tick(ms = 16, frameTime = null) {
    now += ms;
    for (const [id, timer] of [...timers])
      if (timer.at <= now) {
        timers.delete(id);
        timer.callback();
      }
    for (const child of pages) {
      const callbacks = [...child.frames.values()];
      child.frames.clear();
      for (const callback of callbacks) callback(frameTime ?? now);
    }
  }
  function ready(child) {
    child.ready();
    tick();
    tick();
  }
  return {
    ui,
    parent,
    window,
    page,
    load,
    navigate,
    tick,
    ready,
    dispose,
    timers,
    records: () => JSON.parse(ui.get('log').textContent || '[]'),
  };
}

test('observer requires enabled successful bootstrap and consecutive visible ready frames; slow readiness is not a passing timing', () => {
  const h = reviewHarness(),
    p = h.load();
  p.nodes.get('campaigns').childElementCount = 5;
  p.nodes.get('notice').textContent = 'Choose';
  h.tick();
  h.tick();
  assert.equal(h.ui.get('frames').disabled, true);
  p.doc.documentElement.dataset.companyState = 'failed';
  p.nodes.get('start-campaign').disabled = false;
  h.tick();
  h.tick();
  assert.equal(h.records().length, 0);
  h.tick(30000);
  assert.match(h.records().at(-1).outcome, /Timed out/);
  h.ready(p);
  assert.equal(h.ui.get('frames').disabled, false);
  assert.equal(h.records().at(-1).ms, null);
  assert.equal(h.records().at(-1).qualified, false);
  h.dispose();
  assert.equal(p.frames.size, 0);
  assert.equal(h.timers.size, 0);

  const visible = reviewHarness(),
    child = visible.load();
  child.ready();
  visible.tick();
  visible.parent.hidden = true;
  visible.parent.emit('visibilitychange');
  visible.tick();
  visible.parent.hidden = false;
  visible.parent.emit('visibilitychange');
  visible.tick();
  assert.equal(visible.records().length, 0);
  visible.tick();
  assert.equal(
    visible.records().at(-1).ms,
    null,
    'hidden load timing must not later become a successful measurement',
  );
  visible.dispose();
});

test('20-second observations retain the original label and identify animation callbacks without granting qualification', () => {
  const h = reviewHarness(),
    p = h.load();
  h.ready(p);
  p.play();
  h.ui.get('frames').onclick();
  assert.equal(h.ui.get('frames').disabled, true);
  h.ui.get('label').value = 'Changed label during sample';
  for (let i = 0; i < 1250; i++) h.tick(16);
  const result = h.records().at(-1);
  assert.equal(result.sample, 'Frozen baseline');
  assert.equal(result.frames, 1249);
  assert.equal(result.elapsedMs, 20000);
  assert.match(result.metric, /not render duration/);
  assert.equal(result.qualified, false);
  assert.equal(h.ui.get('frames').disabled, false);
  h.dispose();
});

test('paused, hidden and navigated samples are discarded and a full reload detaches the old observer', () => {
  for (const reason of ['pause', 'hidden', 'navigate']) {
    const h = reviewHarness(),
      p = h.load();
    h.ready(p);
    p.play();
    h.ui.get('frames').onclick();
    h.tick();
    if (reason === 'pause') p.nodes.get('play-overlay').hidden = false;
    if (reason === 'hidden') {
      p.doc.hidden = true;
      p.doc.emit('visibilitychange');
    }
    if (reason === 'navigate') p.win.emit('pagehide');
    h.tick();
    assert.ok(h.records().some((record) => /discarded/.test(record.outcome)));
    assert.equal(
      h.records().some((record) => record.frames !== undefined),
      false,
    );
    if (reason === 'navigate') {
      assert.equal(h.ui.get('frames').disabled, true);
      assert.equal(p.frames.size, 0);
      assert.equal(p.doc.listeners.get('click').size, 0);
      const next = h.page('http://localhost:8775/game/company.html?edition=droneaid-community');
      h.navigate(next);
      h.ready(next);
      assert.equal(h.records().at(-1).navigation, 2);
      assert.match(h.records().at(-1).target, /droneaid-community/);
      assert.equal(h.ui.get('frames').disabled, false);
    }
    h.dispose();
  }
});

test('same-origin redirects are revalidated and old controls stay disabled for inaccessible documents', () => {
  const h = reviewHarness(),
    p = h.load();
  h.ready(p);
  const foreign = h.page('https://elsewhere.test/game/company.html');
  h.navigate(foreign);
  assert.equal(h.ui.get('frames').disabled, true);
  assert.equal(h.ui.get('layout').disabled, true);
  assert.equal(p.frames.size, 0);
  assert.equal(foreign.frames.size, 0);
  assert.match(h.records().at(-1).outcome, /review server/);
  h.dispose();
});

test('frame arrays, retained observations and layout detail stay bounded', () => {
  const h = reviewHarness(),
    p = h.load();
  h.ready(p);
  p.play();
  h.ui.get('frames').onclick();
  for (let i = 0; i < 10003; i++) h.tick(0, i);
  assert.match(h.records().at(-1).outcome, /sample limit.*discarded/);
  const controls = Array.from({ length: 3000 }, (_, index) => {
    const node = new Element(`clipped-${index}`);
    node.textContent = 'x'.repeat(1000);
    node.getBoundingClientRect = () => ({
      left: -10,
      right: 40,
      top: 0,
      bottom: 44,
      width: 50,
      height: 44,
    });
    return node;
  });
  p.doc.querySelectorAll = () => controls;
  h.ui.get('layout').onclick();
  assert.equal(h.records().at(-1).clipped.length, 100);
  assert.equal(h.records().at(-1).inspectedControls, 2000);
  assert.equal(h.records().at(-1).controlLimitReached, true);
  h.ui.get('target').value = '/not-a-game';
  for (let i = 0; i < 150; i++) h.ui.get('load').onclick();
  assert.equal(h.records().length, 100);
  assert.ok(h.records().every((record) => record.qualified === false));
  h.dispose();
});

test('hidden mission preparation and Resource Timing resets cannot become invented successful request counts', () => {
  const h = reviewHarness(),
    p = h.load();
  h.ready(p);
  const start = p.nodes.get('start-campaign');
  start.textContent = 'Start';
  p.doc.emit('click', { target: start, isTrusted: true });
  p.doc.hidden = true;
  p.doc.emit('visibilitychange');
  p.play();
  h.tick();
  assert.match(h.records().at(-1).outcome, /Hidden preparation.*discarded/);
  p.doc.hidden = false;
  p.resources.push({ transferSize: 20, decodedBodySize: 20 });
  p.doc.emit('click', { target: start, isTrusted: true });
  p.resources.length = 0;
  h.tick();
  const result = h.records().at(-1);
  assert.equal(result.newResourceTimingEntries, null);
  assert.equal(result.resourceTimingMayBeIncomplete, true);
  assert.equal(result.qualified, false);
  h.dispose();
});

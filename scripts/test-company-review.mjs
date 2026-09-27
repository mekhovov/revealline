import test from 'node:test';
import assert from 'node:assert/strict';
import {
  reviewTarget,
  reviewViewport,
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
  assert.equal(
    reviewTarget('/candidate/game/index.html?edition=droneaid-nl-community', base),
    'http://localhost:8775/candidate/game/index.html?edition=droneaid-nl-community',
  );
  for (const url of [
    'https://example.com/game/company.html',
    '/game/playground.html',
    'javascript:alert(1)',
    'http://name@localhost:8775/game/company.html',
  ])
    assert.throws(() => reviewTarget(url, base));
});
test('review viewport has independent bounded width and height', () => {
  assert.deepEqual(reviewViewport('844', '390'), { width: 844, height: 390 });
  for (const pair of [
    [0, 800],
    [1280, 0],
    [2561, 720],
    [390, NaN],
    [390, 844.5],
  ])
    assert.throws(() => reviewViewport(...pair));
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
    this.style = {};
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
    'height',
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
  ui.get('height').value = '800';
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
    const solo = new URL(href).pathname.endsWith('/index.html');
    const doc = Object.assign(new Events(), {
      hidden: false,
      title: 'Company game',
      documentElement: { dataset: { companyState: 'loading' }, scrollWidth: 1280 },
      body: { dataset: { flightState: 'briefing', pictureState: 'pending' } },
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
      ...(solo
        ? [
            'game-canvas',
            'shell-home',
            'shell-continue',
            'game-overlay',
            'level-select',
            'start-button',
          ]
        : []),
    ])
      nodes.set(id, new Element(id));
    nodes.get('play-screen').hidden = true;
    nodes.get('resume-button').parentElement = nodes.get('play-screen');
    nodes.get('start-campaign').disabled = true;
    nodes.get('notice').textContent = 'Preparing';
    nodes.get('mission-title').textContent = 'First Connection';
    nodes.get('pause-button').textContent = 'Pause';
    if (solo) {
      doc.documentElement.dataset.bootState = 'loading';
      nodes.get('shell-continue').disabled = true;
      nodes.get('level-select').selectedOptions = [{ textContent: 'First Connection' }];
    }
    const resources = [],
      frames = new Map();
    let nextFrame = 0;
    const win = Object.assign(new Events(), {
      location: { href },
      performance: { getEntriesByType: () => [...resources] },
      innerWidth: 1280,
      innerHeight: 800,
      devicePixelRatio: 1,
      getComputedStyle: (node) => node.style,
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
    doc.querySelectorAll = (selector) =>
      selector === 'dialog[open]'
        ? solo && nodes.get('shell-home').open
          ? [nodes.get('shell-home')]
          : []
        : [...nodes.values()];
    const result = {
      doc,
      win,
      nodes,
      resources,
      frames,
      ready() {
        if (solo) {
          doc.documentElement.dataset.bootState = 'ready';
          nodes.get('shell-continue').disabled = false;
          nodes.get('shell-home').open = true;
        }
        doc.documentElement.dataset.companyState = 'ready';
        nodes.get('campaigns').childElementCount = 5;
        nodes.get('notice').textContent = 'Choose your journey';
        nodes.get('start-campaign').disabled = false;
      },
      play() {
        if (solo) {
          doc.body.dataset.flightState = 'running';
          doc.body.dataset.pictureState = 'ready';
          nodes.get('game-overlay').hidden = true;
          nodes.get('shell-home').open = false;
        }
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

test('shared Solo redirect observes real boot, pictures, activation and flight state without legacy nodes', () => {
  const h = reviewHarness(),
    p = h.load(h.page('http://localhost:8775/game/index.html?edition=coupa-all'));
  // The former company entry point redirects here. No old shell may qualify it.
  for (const id of [
    'campaigns',
    'play-screen',
    'play-overlay',
    'notice',
    'start-campaign',
    'resume-button',
    'mission-title',
  ])
    p.nodes.delete(id);
  p.nodes.get('shell-continue').disabled = false;
  p.doc.documentElement.dataset.bootState = 'failed';
  h.tick();
  h.tick();
  assert.equal(h.ui.get('frames').disabled, true);
  p.doc.documentElement.dataset.bootState = 'ready';
  p.nodes.get('shell-home').open = true;
  h.tick();
  h.tick();
  assert.equal(h.records().at(-1).host, 'solo');
  assert.match(h.records().at(-1).target, /index\.html/);
  assert.equal(h.ui.get('frames').disabled, false);
  const start = p.nodes.get('shell-continue');
  start.textContent = 'Continue';
  p.doc.emit('click', { target: start, isTrusted: true });
  p.doc.body.dataset.flightState = 'running';
  p.nodes.get('game-overlay').hidden = true;
  p.doc.body.dataset.pictureState = 'pending';
  h.tick();
  assert.equal(h.records().length, 1, 'Pending pictures cannot qualify a flight.');
  p.doc.body.dataset.pictureState = 'ready';
  h.tick();
  assert.equal(h.records().length, 1, 'An open menu cannot qualify a running flight.');
  p.nodes.get('shell-home').open = false;
  h.tick();
  assert.equal(h.records().at(-1).outcome, 'Running flight observed after activation');
  assert.equal(h.records().at(-1).mission, 'First Connection');
  assert.equal(h.records().at(-1).trustedActivation, true);
  h.ui.get('frames').onclick();
  for (let i = 0; i < 1250; i++) h.tick(16);
  assert.equal(h.records().at(-1).frames, 1249);
  assert.equal(h.records().at(-1).host, 'solo');
  assert.equal(h.records().at(-1).qualified, false);
  h.dispose();
});

test('measurement can be armed while Solo is paused and never starts or resumes the game itself', () => {
  const h = reviewHarness(),
    p = h.load(h.page('http://localhost:8775/game/index.html?edition=coupa-all'));
  h.ready(p);
  p.doc.body.dataset.flightState = 'paused';
  h.ui.get('frames').onclick();
  assert.match(h.records().at(-1).outcome, /Armed/);
  p.win.emit('blur');
  assert.match(
    h.records().at(-1).outcome,
    /Armed/,
    'Arming never counts parent focus as gameplay.',
  );
  h.tick(4000);
  assert.equal(p.doc.body.dataset.flightState, 'paused');
  assert.equal(
    h.records().some((r) => r.frames !== undefined),
    false,
  );
  p.play();
  h.tick();
  assert.match(h.records().at(-1).outcome, /observation started/);
  for (let i = 0; i < 1250; i++) h.tick(16);
  assert.equal(h.records().at(-1).elapsedMs, 20000, 'The wait for Resume is excluded.');
  p.doc.body.dataset.flightState = 'paused';
  h.ui.get('frames').onclick();
  h.tick(30001);
  assert.match(h.records().at(-1).outcome, /No running flight.*discarded/);
  assert.equal(h.ui.get('frames').disabled, false);
  h.ui.get('frames').onclick();
  p.doc.hidden = true;
  p.doc.emit('visibilitychange');
  assert.match(h.records().at(-1).outcome, /Hidden sample discarded/);
  h.dispose();
});

test('focus interruption discards an active sample even when the game resumes before the next RAF', () => {
  const h = reviewHarness(),
    p = h.load(h.page('http://localhost:8775/game/index.html?edition=coupa-all'));
  h.ready(p);
  p.play();
  h.ui.get('frames').onclick();
  h.tick(16);
  p.doc.body.dataset.flightState = 'paused';
  p.win.emit('blur');
  assert.match(h.records().at(-1).outcome, /Focus interrupted sample discarded/);
  p.play();
  for (let i = 0; i < 1250; i++) h.tick(16);
  assert.equal(
    h.records().some((record) => record.frames !== undefined),
    false,
    'A frame gap cannot conceal a pause and become a continuous-play report.',
  );
  assert.equal(h.ui.get('frames').disabled, false);
  h.dispose();
  assert.equal(p.win.listeners.get('blur').size, 0);
});

test('arming excludes an activation RAF timestamp from before preparation but retains later long frames', () => {
  const h = reviewHarness(),
    p = h.load(h.page('http://localhost:8775/game/index.html?edition=coupa-all'));
  h.ready(p);
  p.doc.body.dataset.flightState = 'paused';
  h.ui.get('frames').onclick();
  const beforePreparation = h.window.performance.now();
  p.play();
  // Earlier callbacks in this same animation frame finished expensive mission
  // preparation. RAF's shared timestamp predates the observer's sample start.
  h.tick(2000, beforePreparation);
  h.tick(16);
  h.tick(16);
  h.tick(250);
  for (let i = 0; i < 1233; i++) h.tick(16);
  const result = h.records().at(-1);
  assert.equal(result.outcome, '20 seconds observed; not device qualification');
  assert.equal(result.elapsedMs, 20010);
  assert.equal(result.p95Ms, 16);
  assert.equal(
    result.maxMs,
    250,
    'Preparation before the sample is excluded; an actual later stall is retained.',
  );
  assert.equal(result.over33ms, 1);
  assert.equal(result.qualified, false);
  h.dispose();
});

test('review layout reports vertical overflow and applies the selected landscape height', () => {
  const h = reviewHarness();
  h.ui.get('width').value = '844';
  h.ui.get('height').value = '390';
  const p = h.load();
  assert.equal(h.ui.get('game').width, 844);
  assert.equal(h.ui.get('game').style.height, '390px');
  h.ready(p);
  const control = p.nodes.get('start-campaign');
  control.getBoundingClientRect = () => ({
    left: 0,
    right: 100,
    top: 780,
    bottom: 824,
    width: 100,
    height: 44,
  });
  h.ui.get('layout').onclick();
  assert.equal(h.records().at(-1).clippedTotal, 1);
  assert.equal(h.records().at(-1).clipped[0].outsideViewport, true);
  h.dispose();
});

test('review layout distinguishes native scroll access from unreachable overflow and fixed descendants', () => {
  const h = reviewHarness(),
    p = h.load();
  h.ready(p);
  const arena = new Element('arena-shell'),
    overlay = new Element('game-overlay'),
    control = p.nodes.get('start-campaign');
  arena.getBoundingClientRect = () => ({
    left: 200,
    right: 1080,
    top: 200,
    bottom: 600,
    width: 880,
    height: 400,
  });
  overlay.parentElement = arena;
  overlay.style = { position: 'fixed', overflowX: 'hidden', overflowY: 'auto' };
  overlay.scrollTop = 0;
  overlay.scrollHeight = 1200;
  overlay.clientHeight = 800;
  overlay.getBoundingClientRect = () => ({
    left: 0,
    right: 1280,
    top: 0,
    bottom: 800,
    width: 1280,
    height: 800,
  });
  control.parentElement = overlay;
  control.getBoundingClientRect = () => ({
    left: 0,
    right: 100,
    top: 900,
    bottom: 944,
    width: 100,
    height: 44,
  });
  h.ui.get('layout').onclick();
  assert.equal(h.records().at(-1).clippedTotal, 0);
  assert.equal(h.records().at(-1).scrollableOffscreen, 1);
  assert.match(h.records().at(-1).limitation, /overlap or occlusion/);
  overlay.scrollHeight = 820;
  h.ui.get('layout').onclick();
  assert.equal(
    h.records().at(-1).clippedTotal,
    1,
    'Insufficient scroll range is not reachability.',
  );
  overlay.scrollHeight = 1200;
  control.style.position = 'fixed';
  h.ui.get('layout').onclick();
  assert.equal(
    h.records().at(-1).clippedTotal,
    1,
    'Fixed controls do not move with an ancestor scroll port.',
  );
  control.style.position = 'static';
  control.getBoundingClientRect = () => ({
    left: 0,
    right: 100,
    top: 700,
    bottom: 744,
    width: 100,
    height: 44,
  });
  h.ui.get('layout').onclick();
  assert.equal(
    h.records().at(-1).clippedTotal,
    0,
    'A fixed pause panel is not bounded by the arena DOM ancestor.',
  );
  assert.equal(h.records().at(-1).scrollableOffscreen, 0);
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

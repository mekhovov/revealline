import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(
  new URL('../docs/verification/journey-performance.mjs', import.meta.url),
  'utf8',
);
function harness(
  mode = 'solo',
  { loaded = true, performanceEntries = {}, memory = undefined } = {},
) {
  let clock = 0,
    serial = 0;
  const rafs = new Map();
  const timers = new Map();
  const element = (id) => ({
    id,
    value: '',
    textContent: '',
    disabled: false,
    hidden: false,
    dataset: {},
    listeners: new Map(),
    closest() {
      return this.hidden || this.inert ? this : null;
    },
    getClientRects() {
      return this.hidden ? [] : [{}];
    },
    addEventListener(type, fn) {
      this.listeners.set(type, fn);
    },
    removeEventListener(type) {
      this.listeners.delete(type);
    },
  });
  const outer = new Map(['game', 'status', 'log', 'load', 'mode'].map((id) => [id, element(id)]));
  const nodes = new Map(
    [
      'shell-continue',
      'shell-featured',
      'shell-catalogue',
      'missions-catalogue',
      'race-journey-find',
      'journey-chooser',
      'journey-cards',
      'level-select',
      'race-level',
      'race-start',
      'race-pause',
      'race-boards',
      'flight-preparation-status',
      'race-preparation',
      'shell-flight-status',
    ].map((id) => [id, element(id)]),
  );
  const doc = {
    ...element('doc'),
    documentElement: { dataset: { [mode === 'solo' ? 'bootState' : 'toolState']: 'ready' } },
    body: { dataset: {} },
    getElementById: (id) => nodes.get(id),
  };
  nodes.get('race-pause').textContent = 'Pause';
  nodes.get('journey-cards').querySelector = () => nodes.get('journey-library-card');
  nodes.set('journey-library-card', element('journey-library-card'));
  const root = { ...element('root'), querySelector: (id) => outer.get(id.slice(1)) };
  const win = {
    ...element('win'),
    performance: {
      getEntriesByType: (type) => performanceEntries[type] || [],
      ...(memory ? { memory } : {}),
    },
    innerWidth: 1000,
    innerHeight: 700,
    devicePixelRatio: 1,
    requestAnimationFrame: (fn) => {
      rafs.set(++serial, fn);
      return serial;
    },
    cancelAnimationFrame: (id) => rafs.delete(id),
  };
  Object.assign(outer.get('game'), { contentWindow: win, contentDocument: doc });
  outer.get('mode').value = mode;
  const outerWin = element('outer-window');
  vm.runInNewContext(source, {
    document: root,
    window: outerWin,
    performance: { now: () => clock },
    setTimeout: (fn, ms) => {
      timers.set(++serial, { fn, at: clock + ms });
      return serial;
    },
    clearTimeout: (id) => timers.delete(id),
  });
  outer.get('load').listeners.get('click')();
  if (loaded) outer.get('game').onload();
  return {
    doc,
    root,
    outer,
    nodes,
    win,
    outerWin,
    records: () => JSON.parse(outer.get('log').textContent),
    frame(ms = 16) {
      clock += ms;
      for (const [id, timer] of [...timers])
        if (timer.at <= clock) {
          timers.delete(id);
          timer.fn();
        }
      const callbacks = [...rafs.values()];
      rafs.clear();
      callbacks.forEach((fn) => fn());
    },
    click(id, trusted = true, text = '', missionId) {
      const button = element(id);
      button.textContent = text;
      if (missionId) button.dataset.missionId = missionId;
      const target = { closest: () => button };
      doc.listeners.get('click')({ target, isTrusted: trusted });
    },
    running() {
      doc.body.dataset = { flightState: 'running', pictureState: 'ready' };
    },
  };
}

test('observer records supported navigation, paint and heap snapshots without inventing unavailable values', () => {
  const h = harness('solo', {
    performanceEntries: {
      navigation: [
        {
          responseStart: 12,
          domInteractive: 34,
          domContentLoadedEventEnd: 56,
          loadEventEnd: 78,
        },
      ],
      paint: [
        { name: 'first-paint', startTime: 23 },
        { name: 'first-contentful-paint', startTime: 45 },
      ],
      resource: [],
    },
    memory: {
      usedJSHeapSize: 1024,
      totalJSHeapSize: 2048,
      jsHeapSizeLimit: 4096,
    },
  });

  assert.deepEqual(h.records()[0].browserAtFrameLoad, {
    navigation: {
      responseStartMs: 12,
      domInteractiveMs: 34,
      domContentLoadedMs: 56,
      loadEventEndMs: 78,
    },
    paint: { firstPaintMs: 23, firstContentfulPaintMs: 45 },
    jsHeap: { supported: true, usedBytes: 1024, totalBytes: 2048, limitBytes: 4096 },
  });
  h.frame();
  h.frame();
  assert.deepEqual(h.records().at(-1).browserAtReady, h.records()[0].browserAtFrameLoad);

  const unsupported = harness();
  assert.deepEqual(unsupported.records()[0].browserAtFrameLoad, {
    navigation: null,
    paint: { firstPaintMs: null, firstContentfulPaintMs: null },
    jsHeap: { supported: false },
  });
});

test('observer waits two ready frames, records native and controller activation, and never drives input', () => {
  const h = harness();
  h.frame();
  assert.equal(h.records().length, 1);
  h.frame();
  assert.equal(h.records().at(-1).action, 'Load to playable menu');
  assert.equal(h.records().at(-1).ms, 32);
  h.click('next-button');
  h.frame(100);
  assert.equal(h.records().length, 2);
  h.running();
  h.nodes.get('level-select').value = 'next';
  h.frame();
  h.frame();
  assert.equal(h.records().at(-1).action, 'Next');
  assert.equal(h.records().at(-1).ms, 132);
  assert.equal(h.records().at(-1).trustedActivation, true);
  h.click('retry-button', false);
  h.frame();
  h.frame();
  assert.equal(h.records().at(-1).trustedActivation, false);
});

test('unready pictures, preparation errors, hidden pages and superseded actions never become passes', () => {
  const h = harness();
  h.frame();
  h.frame();
  h.click('shell-continue');
  h.doc.body.dataset.flightState = 'running';
  h.frame(30001);
  assert.match(h.records().at(-1).outcome, /timeout/);
  h.click('next-button');
  h.nodes.get('flight-preparation-status').dataset.state = 'error';
  h.frame();
  assert.match(h.records().at(-1).outcome, /preparation error/);
  h.nodes.get('flight-preparation-status').dataset.state = '';
  h.click('next-button');
  h.click('retry-button');
  assert.equal(h.records().at(-1).outcome, 'superseded');
  h.root.hidden = true;
  h.root.listeners.get('visibilitychange')();
  assert.match(h.records().at(-1).outcome, /discarded/);
  assert(
    h
      .records()
      .slice(2)
      .every((r) => r.ms === null),
  );
});

test('skip first activation is not timed and navigation detaches the observer', () => {
  const h = harness();
  h.frame();
  h.frame();
  h.running();
  h.click('journey-skip', true, 'Skip mission');
  h.frame();
  h.frame();
  assert.equal(h.records().length, 2);
  h.click('journey-skip', true, 'Confirm skip');
  h.nodes.get('level-select').value = 'next';
  h.frame();
  h.frame();
  assert.equal(h.records().at(-1).action, 'Confirmed skip');
  h.click('next-button');
  h.outer.get('game').onload();
  assert.match(h.records().at(-2).outcome, /discarded/);
  assert.equal(h.doc.listeners.has('click'), false);
});

test('only confirmed restart is timed, excluding time spent deciding', () => {
  const h = harness();
  h.frame();
  h.frame();
  h.click('overlay-restart');
  h.frame(10000);
  assert.equal(h.records().length, 2);
  h.click('restart-confirm');
  h.running();
  h.frame();
  h.frame();
  assert.equal(h.records().at(-1).action, 'Confirmed restart');
  assert.equal(h.records().at(-1).ms, 32);
});

test('both modes time mission-library readiness only after the chooser has a usable card', () => {
  for (const [mode, trigger] of [
    ['solo', 'shell-catalogue'],
    ['versus', 'race-journey-find'],
  ]) {
    const h = harness(mode);
    h.frame();
    h.frame();
    h.click(trigger);
    h.frame(100);
    assert.notEqual(h.records().at(-1).action, 'Open mission library');
    h.nodes.get('journey-chooser').open = true;
    h.frame();
    h.frame();
    assert.equal(h.records().at(-1).action, 'Open mission library');
    assert.equal(h.records().at(-1).ms, 132);
    assert.equal(
      h.records().at(-1).outcome,
      'two consecutive animation-frame readiness observations',
    );
  }
});

test('both modes reject cancelled/detached/error preparations and explicit cancellation', () => {
  for (const mode of ['solo', 'versus'])
    for (const state of ['cancelled', 'detached', 'error']) {
      const h = harness(mode);
      h.frame();
      h.frame();
      h.click(mode === 'solo' ? 'next-button' : 'race-journey-next');
      h.nodes.get(
        mode === 'solo' ? 'flight-preparation-status' : 'race-preparation',
      ).dataset.state = state;
      h.running();
      h.frame();
      h.frame();
      assert.match(h.records().at(-1).outcome, new RegExp(`preparation ${state}`));
      assert.equal(h.records().at(-1).ms, null);
    }
  for (const id of ['flight-preparation-cancel', 'shell-flight-cancel', 'race-picture-cancel']) {
    const h = harness();
    h.frame();
    h.frame();
    h.click('next-button');
    h.click(id);
    h.running();
    h.frame();
    h.frame();
    assert.match(h.records().at(-1).outcome, /cancelled by player/);
  }
});

test('retained previous gameplay is not accepted as a completed Next', () => {
  const h = harness();
  h.frame();
  h.frame();
  h.running();
  h.click('next-button');
  h.frame();
  h.frame();
  assert.equal(h.records().length, 2);
  h.nodes.get('level-select').value = 'different-mission';
  h.frame();
  h.frame();
  assert.equal(h.records().at(-1).action, 'Next');
});

test('navigation is bounded even before load and disposal/visibility cannot produce stale passes', () => {
  for (const ending of ['timeout', 'visibility', 'pagehide', 'new-load']) {
    const h = harness('solo', { loaded: false });
    if (ending === 'timeout') h.frame(30001);
    if (ending === 'visibility') {
      h.root.hidden = true;
      h.root.listeners.get('visibilitychange')();
    }
    if (ending === 'pagehide') h.outerWin.listeners.get('pagehide')();
    if (ending === 'new-load') h.outer.get('load').listeners.get('click')();
    assert.equal(h.records()[0].ms, null);
    assert.match(h.records()[0].outcome, /timeout|discarded/);
  }
});

test('Versus readiness requires visible boards and an enabled pause control', () => {
  const h = harness('versus');
  h.frame();
  h.frame();
  h.nodes.get('race-pause').disabled = true;
  h.click('race-start');
  h.frame();
  h.frame();
  assert.equal(h.records().length, 2);
  h.nodes.get('race-pause').disabled = false;
  h.nodes.get('race-boards').hidden = true;
  h.frame();
  h.frame();
  assert.equal(h.records().length, 2);
  h.nodes.get('race-boards').hidden = false;
  h.frame();
  h.frame();
  assert.equal(h.records().at(-1).action, 'Start/rematch');
});

test('unbooted, inert and failed shells do not pass load readiness', () => {
  for (const mode of ['solo', 'versus']) {
    const h = harness(mode);
    const bootKey = mode === 'solo' ? 'bootState' : 'toolState';
    h.doc.documentElement.dataset[bootKey] = 'loading';
    h.frame();
    h.frame();
    assert.equal(h.records().length, 1);
    h.doc.documentElement.dataset[bootKey] = 'ready';
    for (const id of ['shell-continue', 'shell-featured', 'race-start'])
      h.nodes.get(id).inert = true;
    h.frame();
    h.frame();
    assert.equal(h.records().length, 1);
    h.doc.documentElement.dataset[bootKey] = mode === 'solo' ? 'failed' : 'error';
    h.frame();
    assert.match(h.records().at(-1).outcome, /boot failed/);
  }
});

test('Versus results review is not active play and Journey endings are not Next transitions', () => {
  const h = harness('versus');
  h.frame();
  h.frame();
  h.click('race-start');
  h.nodes.get('race-pause').textContent = 'Results';
  h.frame();
  h.frame();
  assert.equal(h.records().length, 2);
  const s = harness();
  s.frame();
  s.frame();
  s.running();
  for (const label of [
    'End of sequence · find missions',
    'Journey complete · replay or exit',
    'View collection →',
  ]) {
    s.click('next-button', true, label);
    s.frame();
    s.frame();
    assert.equal(s.records().length, 2);
  }
});

test('title operation owns its own failures and ignores stale in-flight failures', () => {
  const h = harness();
  h.frame();
  h.frame();
  h.nodes.get('flight-preparation-status').dataset.state = 'error';
  h.click('shell-continue');
  h.running();
  h.frame();
  h.frame();
  assert.equal(h.records().at(-1).action, 'Continue');
  assert.equal(h.records().at(-1).ms, 32);
  h.click('shell-continue');
  h.nodes.get('shell-flight-status').dataset.state = 'cancelled';
  h.frame();
  assert.match(h.records().at(-1).outcome, /preparation cancelled/);
  h.click('retry-button');
  h.frame();
  h.frame();
  assert.equal(h.records().at(-1).action, 'Retry');
  assert.equal(h.records().at(-1).ms, 32);
});

test('Versus chooser uses the full mission identity, not only the last path segment', () => {
  const h = harness('versus');
  h.frame();
  h.frame();
  h.nodes.get('race-level').value = 'source/pack/campaign/first-return/standard';
  h.click('mission-card', true, '', 'source/pack/campaign/choose-your-share');
  h.frame();
  h.frame();
  assert.equal(h.records().length, 2);
  h.nodes.get('race-level').value = 'source/pack/campaign/choose-your-share/standard';
  h.frame();
  h.frame();
  assert.equal(h.records().at(-1).action, 'Choose mission');
  assert.equal(h.records().at(-1).mission, 'source/pack/campaign/choose-your-share');
});

test('title fresh mission errors and visible focus departure discard the pending sample', () => {
  const h = harness();
  h.frame();
  h.frame();
  h.click('shell-continue');
  h.nodes.get('flight-preparation-status').dataset.state = 'error';
  h.frame();
  assert.match(h.records().at(-1).outcome, /preparation error/);
  h.click('start-button');
  h.win.listeners.get('blur')();
  h.running();
  h.frame();
  h.frame();
  assert.match(h.records().at(-1).outcome, /focus left/);
  assert.equal(h.records().at(-1).ms, null);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { Document, Events } from '../game/test/helpers/couch-dom.mjs';
import {
  observeDiscovery,
  discoveryCycleSurface,
} from '../docs/verification/discovery-observer.mjs';
import {
  validateDiscoveryObservation,
  compareDiscoveryObservations,
  summarizeDiscoverySession,
  summarizeDiscoveryLifecycle,
} from '../docs/verification/discovery-comparison.mjs';
import { runDiscoveryCycles } from './observe-discovery-cycles.mjs';

// These clocks/DOMs test observer logic only. They are never desktop evidence.
const binding = () => ({
  label: 'Synthetic observer unit fixture',
  deviceLabel: 'synthetic-test',
  editionId: 'fixture',
  gameplayId: 'authored-exact-gameplay',
  inputProtocol: 'stationary',
  settingsIdentity: 'default-silent',
  sourceKind: 'compiled-artifact',
  sourceIdentity: 'a'.repeat(64),
});
function harness({ longTasks = true } = {}) {
  const document = new Document(),
    window = new Events(),
    frames = new Map();
  let clock = 0,
    serial = 0,
    callback,
    disconnected = false;
  Object.assign(window, {
    navigator: { userAgent: 'Synthetic browser', platform: 'test', hardwareConcurrency: 2 },
    innerWidth: 1280,
    innerHeight: 800,
    devicePixelRatio: 1,
    performance: { now: () => clock, timeOrigin: 10, getEntriesByType: () => [] },
    requestAnimationFrame(fn) {
      frames.set(++serial, fn);
      return serial;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
  });
  if (longTasks)
    window.PerformanceObserver = class {
      static supportedEntryTypes = ['longtask'];
      constructor(fn) {
        callback = fn;
      }
      observe() {}
      takeRecords() {
        return [];
      }
      disconnect() {
        disconnected = true;
      }
    };
  for (const [tag, id] of [
    ['canvas', 'game-canvas'],
    ['dialog', 'shell-home'],
    ['button', 'shell-continue'],
    ['section', 'game-overlay'],
    ['section', 'completion-reward-result'],
    ['select', 'level-select'],
    ['dialog', 'completion-reward-dialog'],
    ['dialog', 'collection-dialog'],
  ]) {
    const node = document.createElement(tag);
    node.id = id;
    document.body.append(node);
  }
  const $ = (id) => document.getElementById(id);
  document.documentElement.dataset.bootState = 'ready';
  document.body.dataset.effects = 'full';
  document.body.dataset.pictureState = 'ready';
  $('level-select').selectedOptions = [{ textContent: 'Exact mission' }];
  $('game-overlay').hidden = false;
  $('game-overlay').dataset.kind = 'ready';
  $('completion-reward-result').hidden = false;
  const observer = observeDiscovery({ document, window, binding: binding() });
  return {
    document,
    window,
    observer,
    $,
    get disconnected() {
      return disconnected;
    },
    frame(ms = 16) {
      clock += ms;
      const batch = [...frames.values()];
      frames.clear();
      batch.forEach((fn) => fn(clock));
    },
    run() {
      document.body.dataset.flightState = 'running';
      $('game-overlay').hidden = true;
      $('completion-reward-result').hidden = true;
    },
    result() {
      document.body.dataset.flightState = 'paused';
      $('game-overlay').hidden = false;
      $('game-overlay').dataset.kind = 'won';
      $('completion-reward-result').hidden = false;
    },
    longTask(duration) {
      callback({ getEntries: () => [{ startTime: clock, duration }] });
    },
  };
}
async function report() {
  const h = harness();
  h.run();
  const pending = h.observer.sample();
  for (let i = 0; i < 1300; i++) h.frame();
  await pending;
  h.observer.dispose();
  return h.observer.exportReport();
}

test('observer measures genuine phase transitions, excludes interrupted intervals, and never mutates game state', async () => {
  const h = harness(),
    before = JSON.stringify(h.document.body.dataset);
  let pending = h.observer.sample({ kind: 'result-reveal', durationMs: 1000 });
  h.frame();
  h.frame();
  assert.equal(JSON.stringify(h.document.body.dataset), before);
  h.result();
  for (let i = 0; i < 70; i++) h.frame();
  const result = await pending;
  assert.equal(result.outcome, 'observed');
  assert.equal(result.frameIntervals.p95Ms, 16);
  assert.equal(result.surfaceVisibleWhenArmed, false);
  assert.equal(result.rewardTaskAttribution.supported, false);
  h.run();
  h.frame();
  assert.equal(h.observer.exportReport().cycles.result, 1);
  pending = h.observer.sample();
  h.frame();
  h.frame();
  h.window.emit('blur');
  assert.match((await pending).outcome, /discarded/);
  h.observer.dispose();
  assert(h.disconnected);
});

test('missing browser identity or sample input counters cannot become comparable evidence', async () => {
  for (const change of [
    (x) => delete x.environment.userAgent,
    (x) => (x.environment.width = 0),
    (x) => delete x.records.find((r) => r.kind === 'sample').inputEvents,
    (x) => (x.records.find((r) => r.kind === 'sample').scenario = 'invented'),
  ]) {
    const value = await report();
    change(value);
    assert.throws(() => validateDiscoveryObservation(value));
  }
  assert.throws(() => validateDiscoveryObservation(undefined), /bounded JSON/);
});

test('the CLI runner preserves a failed public result transition and refuses to invent wins', async () => {
  const calls = [];
  await assert.rejects(
    () =>
      runDiscoveryCycles({
        session: 'synthetic-test',
        binding: binding(),
        invoke: async (args) => {
          calls.push(args);
          return args[1].includes('cycle runner failed') ? { state: { overlay: 'ready' } } : false;
        },
      }),
    (error) => {
      assert.match(error.message, /Earn a normal mission win/);
      assert.equal(error.observation.qualified, false);
      assert.equal(error.observation.step, 'initial surface check');
      assert.equal(error.observation.diagnostic.state.overlay, 'ready');
      return true;
    },
  );
  assert(calls.every(([command]) => command === 'eval'));
});

test('the CLI result wait is bounded and records the failed step without counting requested cycles', async () => {
  await assert.rejects(
    () =>
      runDiscoveryCycles({
        session: 'synthetic-test',
        binding: binding(),
        waitMs: 1,
        invoke: async ([command, source]) => {
          if (command !== 'eval') return true;
          if (source.includes('cycle runner failed'))
            return { report: { cycles: { result: 0, rewardViewer: 0 } } };
          if (source.includes('return Boolean(')) return false;
          return true;
        },
      }),
    (error) => {
      assert.match(error.message, /Timed out observing visible result Explore control/);
      assert.equal(error.observation.step, 'result 1: show result');
      assert.equal(error.observation.diagnostic.report.cycles.rewardViewer, 0);
      return true;
    },
  );
});

test('navigation automation validates each actual edition before summarizing observed documents', async () => {
  const targets = ['first', 'second'].map((editionId) => ({
    url: `http://127.0.0.1:8791/game/index.html?edition=${editionId}`,
    binding: { ...binding(), editionId },
  }));
  const fixture = await report();
  let current,
    opened = 0;
  const invoke = async ([command, source]) => {
    if (command === 'open') {
      current = targets[opened++ % 2];
      return true;
    }
    if (source.includes('return document.body.dataset.editionId')) return current.binding.editionId;
    if (source.includes('return discoveryObservation.exportReport()'))
      return { ...fixture, binding: current.binding };
    return true;
  };
  const value = await runDiscoveryCycles({ session: 'synthetic-test', targets, cycles: 2, invoke });
  assert.equal(opened, 3);
  assert.equal(value.summary.editionTransitions, 2);
  assert.equal(value.summary.twentyEditionTransitionsObserved, false);
  assert.equal(value.qualified, false);
});

test('twenty result/collection/viewer cycles retain raw counters without claiming detached-resource knowledge', () => {
  const h = harness({ longTasks: false });
  for (let i = 0; i < 20; i++) {
    h.result();
    h.frame();
    h.$('completion-reward-dialog').open = true;
    h.frame();
    h.$('completion-reward-dialog').open = false;
    h.frame();
    h.$('collection-dialog').open = true;
    h.frame();
    h.$('collection-dialog').open = false;
    h.run();
    h.frame();
  }
  const report = h.observer.exportReport();
  assert.deepEqual(report.cycles, { result: 20, rewardViewer: 20, collection: 20 });
  assert.equal(report.records[0].resources.usedJSHeapBytes, null);
  assert.equal(report.records[0].resources.detachedNodes, null);
  assert.equal(validateDiscoveryObservation(report).qualified, false);
  const session = summarizeDiscoverySession([report]);
  assert(session.twentyResultCyclesObserved);
  assert.equal(session.twentyEditionTransitionsObserved, false);
  assert.equal(session.retainedResourceStabilityVerified, false);
  h.observer.dispose();
});

test('long tasks keep their page scope and an unobserved target times out instead of passing', async () => {
  const h = harness();
  h.run();
  const pending = h.observer.sample({ durationMs: 1000 });
  h.frame();
  h.longTask(77);
  for (let i = 0; i < 70; i++) h.frame();
  const observed = await pending;
  assert.equal(observed.pageLongTasks.maxMs, 77);
  assert.match(observed.pageLongTasks.scope, /not attributed/);
  const absent = h.observer.sample({ kind: 'result-reveal' });
  h.frame(30001);
  assert.match((await absent).outcome, /did not appear/);
  h.observer.dispose();
});

test('comparisons require exact environment, gameplay, settings, source class and complete 20-second samples', async () => {
  const baseline = await report(),
    candidate = structuredClone(baseline);
  candidate.binding.sourceIdentity = 'b'.repeat(64);
  const comparison = compareDiscoveryObservations(baseline, candidate);
  assert.equal(comparison.comparable, true);
  assert.equal(comparison.qualified, false);
  assert.equal(comparison.comparisons[0].withinFivePercentEngineeringTarget, true);
  assert.equal(comparison.rewardRenderingTaskLimit.verified, false);
  for (const change of [
    (x) => x.environment.width++,
    (x) => (x.binding.gameplayId = 'different-map'),
    (x) => (x.binding.deviceLabel = 'other-device'),
    (x) => (x.binding.inputProtocol = 'moving'),
    (x) => (x.binding.sourceKind = 'worktree'),
    (x) => (x.records.find((r) => r.kind === 'sample').durationMs = 1000),
    (x) => (x.records.find((r) => r.kind === 'sample').effects = 'reduced'),
    (x) => (x.records.find((r) => r.kind === 'sample').inputEvents.synthetic = 1),
  ]) {
    const invalid = structuredClone(candidate);
    change(invalid);
    const result = compareDiscoveryObservations(baseline, invalid);
    assert.equal(result.comparable, false);
    assert.deepEqual(result.comparisons, []);
  }
});

test('same-build effects comparison is distinct from artifact regression and rejects invented measurements or cycles', async () => {
  const baseline = await report(),
    candidate = structuredClone(baseline);
  baseline.binding.sourceKind = candidate.binding.sourceKind = 'worktree';
  candidate.records.find((r) => r.kind === 'sample').effects = 'reduced';
  assert(
    compareDiscoveryObservations(baseline, candidate, { kind: 'same-build-effects' }).comparable,
  );
  assert.equal(compareDiscoveryObservations(baseline, candidate).comparable, false);
  candidate.cycles.result = 20;
  assert.throws(() => validateDiscoveryObservation(candidate), /Cycle totals/);
  candidate.cycles.result = 0;
  candidate.records.find((r) => r.kind === 'sample').frameIntervals.p95Ms = NaN;
  assert.throws(() => validateDiscoveryObservation(candidate), /measurements/);
});

test('passive cycle diagnostics distinguish pending, decoded and broken visible images', () => {
  const h = harness(),
    image = h.document.createElement('img');
  h.$('completion-reward-dialog').append(image);
  h.$('completion-reward-dialog').open = true;
  image.complete = false;
  image.naturalWidth = image.naturalHeight = 0;
  assert.equal(discoveryCycleSurface(h.document).decodedVisibleImages, 0);
  image.complete = true;
  assert.equal(discoveryCycleSurface(h.document).brokenVisibleImages, 1);
  image.naturalWidth = 640;
  image.naturalHeight = 480;
  assert.equal(discoveryCycleSurface(h.document).decodedVisibleImages, 1);
  image.hidden = true;
  assert.equal(discoveryCycleSurface(h.document).decodedVisibleImages, 0);
  h.observer.dispose();
});

test('diagnostics retain lost pointer-target evidence without changing controls or recording arbitrary text', async () => {
  const h = harness(),
    control = h.document.createElement('button');
  control.id = 'view-picture';
  control.textContent = 'Unrecorded label';
  h.document.body.append(control);
  h.document.emit('pointerdown', { target: control, isTrusted: true });
  control.remove();
  h.document.emit('pointerup', { target: h.document.body, isTrusted: true });
  const records = h.observer
    .exportReport()
    .records.filter((record) => record.kind === 'public-control');
  assert.equal(records.length, 2);
  assert.equal(records[0].control, 'view-picture');
  assert.equal(records[1].targetStillMatches, false);
  assert(!JSON.stringify(records).includes('Unrecorded label'));
  h.run();
  h.document.hasFocus = () => false;
  const pending = h.observer.sample();
  h.frame();
  assert.match((await pending).outcome, /not focused/);
  h.observer.dispose();
  for (const values of h.window.listeners.values()) assert.equal(values.size, 0);
  for (const values of h.document.captureListeners.values()) assert.equal(values.size, 0);
});

async function simulatedPublicCycles({ broken = false } = {}) {
  const h = harness(),
    document = h.document;
  for (const id of ['view-picture', 'show-result']) {
    const button = document.createElement('button');
    button.id = id;
    document.body.append(button);
  }
  const explore = document.createElement('button');
  explore.setAttribute('data-reward-surface', 'result');
  h.$('completion-reward-result').append(explore);
  const close = document.createElement('button');
  h.$('completion-reward-dialog').append(close);
  h.result();
  const invoke = async ([command, source]) => {
    if (command === 'click') {
      if (source === '#view-picture') {
        h.$('game-overlay').hidden = h.$('completion-reward-result').hidden = true;
      } else if (source === '#show-result') h.result();
      else if (source.includes('data-reward-surface')) {
        h.$('completion-reward-dialog').open = true;
        const image = document.createElement('img');
        image.complete = true;
        image.naturalWidth = image.naturalHeight = broken ? 0 : 640;
        h.$('completion-reward-dialog').append(image);
      } else if (source.includes('dialog > button')) {
        h.$('completion-reward-dialog').open = false;
        h.$('completion-reward-dialog').querySelector('img').remove();
      } else throw Error('Unexpected public fixture command');
      return true;
    }
    if (source.includes("await import('/docs/verification/discovery-observer.mjs')")) {
      h.observer.dispose();
      h.observer = observeDiscovery({ document, window: h.window, binding: binding() });
      return true;
    }
    if (source.includes('Visible-frame observation timed out')) {
      h.frame();
      h.frame();
      return true;
    }
    return vm.runInNewContext(source, { document, discoveryObservation: h.observer });
  };
  try {
    return await runDiscoveryCycles({
      session: 'synthetic-test',
      binding: binding(),
      cycles: 20,
      invoke,
      waitMs: 1000,
    });
  } finally {
    h.observer.dispose();
  }
}

test('runner unit fixture counts observed viewer/result exits and summaries only connected closed-view resources', async () => {
  const result = await simulatedPublicCycles();
  assert.equal(result.observation.cycles.result, 20);
  assert.equal(result.observation.cycles.rewardViewer, 20);
  assert.equal(result.lifecycle.twentyResultViewerPairsObserved, true);
  assert.equal(result.lifecycle.closedCheckpoints, 20);
  assert.equal(result.lifecycle.connectedMetrics.connectedImages.delta, 0);
  assert.equal(result.lifecycle.retainedResourceStabilityVerified, false);
  assert.equal(result.lifecycle.rewardRenderingTaskLimitVerified, false);
  assert.deepEqual(summarizeDiscoveryLifecycle(result.observation), result.lifecycle);
  await assert.rejects(simulatedPublicCycles({ broken: true }), (error) => {
    assert.match(error.message, /without decoded pixels/);
    assert.equal(error.observation.step, 'result 1: load exact image');
    assert.equal(error.observation.diagnostic.surface.brokenVisibleImages, 1);
    assert.equal(error.observation.diagnostic.report.cycles.rewardViewer, 0);
    return true;
  });
});

test('unknown historical arming state remains readable but cannot establish a comparable transition', async () => {
  const baseline = await report(),
    candidate = structuredClone(baseline);
  candidate.binding.sourceIdentity = 'b'.repeat(64);
  delete baseline.records.find((record) => record.kind === 'sample').surfaceVisibleWhenArmed;
  delete candidate.records.find((record) => record.kind === 'sample').surfaceVisibleWhenArmed;
  assert(validateDiscoveryObservation(baseline));
  const result = compareDiscoveryObservations(baseline, candidate);
  assert.equal(result.comparable, false);
  assert(result.reasons.some((reason) => /already visible surface/.test(reason)));
});

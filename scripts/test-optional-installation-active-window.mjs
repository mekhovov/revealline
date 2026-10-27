import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { setTimeout as pause } from 'node:timers/promises';
import {
  ACTIVE_WINDOW_MODE,
  FOCUS_SOURCE_SHA256,
  selectHistoricalWindowMode,
  configureHistoricalSessionWindow,
  minimizeHistoricalSessionWindow,
  restoreHistoricalSessionWindow,
  disposeHistoricalSessionWindow,
} from './optional-installation-active-window.mjs';
const expectedPreviousURL =
  'http://127.0.0.1:4321/revealline/practice/civilian-fpv/releases/v0.142.4/site/optional-practice/civilian-fpv/index.html?lang=en';
const expectedUpdateURL = 'http://127.0.0.1:4321/revealline/practice/civilian-fpv/app/';
function fixture() {
  const events = [],
    windows = [
      { windowState: 'normal', left: 10, top: 20, width: 1280, height: 900 },
      { windowState: 'normal', left: 30, top: 40, width: 1280, height: 900 },
    ];
  const focus = [true, true],
    detached = [false, false],
    pages = [],
    sessions = [];
  const flags = { sameWindow: false, failRestore: false };
  const pendingBounds = new Map();
  const context = {
    pages: () => pages,
    newCDPSession: async (page) => sessions[pages.indexOf(page)],
  };
  for (const [index, url] of [expectedPreviousURL, expectedUpdateURL].entries()) {
    pages.push({
      url: () => url,
      context: () => context,
      bringToFront: async () => events.push({ kind: 'front', index }),
    });
    sessions.push({
      send: async (method, params) => {
        events.push({ index, method, params });
        if (method === 'Target.getTargetInfo')
          return { targetInfo: { targetId: 'target' + index, url } };
        if (method === 'Browser.getWindowForTarget')
          return { windowId: flags.sameWindow ? 1 : index + 1, bounds: { ...windows[index] } };
        if (method === 'Browser.getWindowBounds') {
          if (flags.hangRead) return new Promise(() => {});
          const change = pendingBounds.get(params.windowId);
          if (change && change.reads-- <= 0) {
            Object.assign(windows[params.windowId - 1], change.bounds);
            pendingBounds.delete(params.windowId);
          }
          return { bounds: { ...windows[params.windowId - 1] } };
        }
        if (method === 'Browser.setWindowBounds') {
          if (flags.failRestore && params.bounds.windowState === 'normal')
            throw Error('Restore failed');
          if (params.bounds.windowState && flags.ignoreState === params.bounds.windowState)
            return {};
          if (flags.deferReads)
            pendingBounds.set(params.windowId, {
              reads: flags.deferReads,
              bounds: { ...params.bounds },
            });
          else Object.assign(windows[params.windowId - 1], params.bounds);
          return {};
        }
        if (method === 'Emulation.setFocusEmulationEnabled') {
          focus[index] = params.enabled;
          return {};
        }
        assert.fail('Unexpected CDP mutation ' + method);
      },
      detach: async () => {
        detached[index] = true;
        events.push({ kind: 'detach', index });
      },
    });
  }
  const receipt = {};
  return {
    context,
    pages,
    sessions,
    windows,
    focus,
    detached,
    events,
    flags,
    receipt,
    options: {
      context,
      previousPage: pages[0],
      updatePage: pages[1],
      expectedPreviousURL,
      expectedUpdateURL,
      mode: ACTIVE_WINDOW_MODE,
      playwrightSourceSha256: FOCUS_SOURCE_SHA256,
      receipt,
    },
  };
}
test('strict opt-in and pinned ownership reject before browser modification', async () => {
  assert.equal(selectHistoricalWindowMode(undefined), false);
  assert.equal(selectHistoricalWindowMode(ACTIVE_WINDOW_MODE), true);
  for (const mode of ['', true, 'all', 'headful'])
    assert.throws(() => selectHistoricalWindowMode(mode));
  for (const patch of [
    { mode: undefined },
    { playwrightSourceSha256: '0'.repeat(64) },
    { expectedPreviousURL: expectedPreviousURL.replace('v0.142.4', 'v0.151.1') },
    { expectedUpdateURL: 'http://127.0.0.1:9999/revealline/practice/civilian-fpv/app/' },
    { timeoutMs: 5001 },
  ]) {
    const f = fixture();
    await assert.rejects(configureHistoricalSessionWindow({ ...f.options, ...patch }));
    assert.equal(f.events.length, 0);
  }
  const f = fixture();
  f.pages[1].context = () => ({});
  await assert.rejects(configureHistoricalSessionWindow(f.options));
  assert.equal(f.events.length, 0);
});
test('normal distinct windows use only native focus configuration/minimize/restore, with independent cleanup', async () => {
  const f = fixture(),
    g = await configureHistoricalSessionWindow(f.options);
  try {
    assert.deepEqual(f.focus, [false, false]);
    assert.equal(f.receipt.ordinaryWindowSwitchQualified, false);
    await minimizeHistoricalSessionWindow(g);
    assert.equal(f.windows[0].windowState, 'minimized');
    await restoreHistoricalSessionWindow(g);
    assert.equal(f.windows[0].windowState, 'normal');
    assert(f.events.some((e) => e.kind === 'front' && e.index === 0));
    await assert.rejects(minimizeHistoricalSessionWindow(g));
  } finally {
    assert.equal((await disposeHistoricalSessionWindow(g)).completed, true);
  }
  assert.deepEqual(f.focus, [true, true]);
  assert.deepEqual(f.detached, [true, true]);
  assert(f.events.every((e) => !e.method || !e.method.startsWith('Runtime.')));
});
test('same-window or initially minimized ownership fails and detaches both sessions', async () => {
  for (const tweak of [
    (f) => {
      f.flags.sameWindow = true;
    },
    (f) => {
      f.windows[0].windowState = 'minimized';
    },
  ]) {
    const f = fixture();
    tweak(f);
    await assert.rejects(configureHistoricalSessionWindow(f.options));
    assert.deepEqual(f.detached, [true, true]);
    assert(
      !f.events.some(
        (e) => e.method === 'Emulation.setFocusEmulationEnabled' && e.params.enabled === false,
      ),
    );
  }
});
test('a failed bounds restore does not skip either default restoration or detach', async () => {
  const f = fixture(),
    g = await configureHistoricalSessionWindow(f.options);
  await minimizeHistoricalSessionWindow(g);
  f.flags.failRestore = true;
  const result = await disposeHistoricalSessionWindow(g);
  assert.equal(result.completed, false);
  assert.deepEqual(f.focus, [true, true]);
  assert.deepEqual(f.detached, [true, true]);
});
test('late in-flight focus configuration cannot be reported as clean after defaults restore', async () => {
  const f = fixture();
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  const send = f.sessions[0].send;
  f.sessions[0].send = async (method, params) => {
    if (method === 'Emulation.setFocusEmulationEnabled' && !params.enabled) await pending;
    return send(method, params);
  };
  await assert.rejects(configureHistoricalSessionWindow({ ...f.options, timeoutMs: 25 }));
  assert.equal(f.receipt.cleanup.completed, false);
  assert(f.receipt.cleanup.pendingAtStart.includes('Emulation.setFocusEmulationEnabled'));
  assert.deepEqual(f.focus, [true, true]);
  assert.deepEqual(f.detached, [true, true]);
  release();
  await pause(10);
  assert.equal(
    f.receipt.cleanup.completed,
    false,
    'Late settlement never upgrades unresolved cleanup',
  );
});

test('asynchronous native minimize/normal transitions are observed, never inferred from command acknowledgement', async () => {
  const f = fixture(),
    g = await configureHistoricalSessionWindow(f.options);
  f.flags.deferReads = 2;
  try {
    await minimizeHistoricalSessionWindow(g);
    const minimized = f.receipt.windowTransitions[0];
    assert.deepEqual(
      minimized.samples.map((row) => row.bounds.windowState),
      ['normal', 'normal', 'minimized'],
    );
    assert.equal(minimized.passed, true);
    f.windows[0].left += 7;
    await restoreHistoricalSessionWindow(g);
    const normal = f.receipt.windowTransitions.find((row) => row.expected === 'normal');
    assert.deepEqual(
      normal.samples.map((row) => row.bounds.windowState),
      ['minimized', 'minimized', 'normal'],
    );
    const geometry = f.receipt.windowTransitions.find((row) => row.geometry);
    assert.deepEqual(
      geometry.samples.map((row) => row.bounds.left),
      [17, 17, 10],
    );
    assert.equal(f.receipt.restored, true);
  } finally {
    assert.equal((await disposeHistoricalSessionWindow(g)).completed, true);
  }
});

test('unsupported/no-op minimize preserves the last normal state and fails within its declared bound', async () => {
  const f = fixture(),
    g = await configureHistoricalSessionWindow({ ...f.options, timeoutMs: 80 });
  f.flags.ignoreState = 'minimized';
  try {
    await assert.rejects(minimizeHistoricalSessionWindow(g), /minimized/);
    assert.notEqual(f.receipt.minimized, true);
    const row = f.receipt.windowTransitions[0];
    assert.equal(row.passed, false);
    assert.equal(row.limitMs, 80);
    assert(
      row.samples.length > 0 &&
        row.samples.every((sample) => sample.bounds.windowState === 'normal'),
    );
  } finally {
    await disposeHistoricalSessionWindow(g);
  }
  assert.deepEqual(f.detached, [true, true]);
});

test('unsupported restore fails both verification and cleanup but never skips default restoration or detach', async () => {
  const f = fixture(),
    g = await configureHistoricalSessionWindow({ ...f.options, timeoutMs: 80 });
  await minimizeHistoricalSessionWindow(g);
  f.flags.ignoreState = 'normal';
  await assert.rejects(restoreHistoricalSessionWindow(g), /normal/);
  assert.notEqual(f.receipt.restored, true);
  assert.equal((await disposeHistoricalSessionWindow(g)).completed, false);
  assert.deepEqual(f.focus, [true, true]);
  assert.deepEqual(f.detached, [true, true]);
});

test('a valid bounds result delivered after event-loop blocking cannot beat the monotonic deadline', async () => {
  const f = fixture(),
    g = await configureHistoricalSessionWindow({ ...f.options, timeoutMs: 20 });
  const original = f.sessions[0].send;
  let blocked = false;
  f.sessions[0].send = async (method, params) => {
    if (method === 'Browser.getWindowBounds' && !blocked) {
      blocked = true;
      // Unit-only synchronous stall deliberately prevents timeout callbacks from
      // firing first. The returned native state is correct but too late.
      const until = performance.now() + 45;
      while (performance.now() < until) {
        /* block the test event loop */
      }
    }
    return original(method, params);
  };
  try {
    await assert.rejects(minimizeHistoricalSessionWindow(g));
    assert.equal(f.receipt.windowTransitions[0].passed, false);
    assert.equal(f.receipt.windowTransitions[0].samples.length, 0);
    assert.notEqual(f.receipt.minimized, true);
  } finally {
    assert.equal((await disposeHistoricalSessionWindow(g)).completed, true);
  }
  assert.deepEqual(f.detached, [true, true]);
  assert.deepEqual(f.focus, [true, true]);
});

test('a stalled bounds read is bounded and leaves cleanup unverified', async () => {
  const f = fixture(),
    g = await configureHistoricalSessionWindow({ ...f.options, timeoutMs: 40 });
  f.flags.hangRead = true;
  await assert.rejects(minimizeHistoricalSessionWindow(g), /deadline/);
  assert.equal(f.receipt.windowTransitions[0].passed, false);
  assert.notEqual(f.receipt.minimized, true);
  const result = await disposeHistoricalSessionWindow(g);
  assert.equal(result.completed, false);
  assert(result.pendingAtStart.length > 0);
  assert.deepEqual(f.focus, [true, true]);
  assert.deepEqual(f.detached, [true, true]);
});

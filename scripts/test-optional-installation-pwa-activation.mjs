import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { setTimeout as pause } from 'node:timers/promises';
import { runInNewContext } from 'node:vm';
import { readFile } from 'node:fs/promises';
import {
  PWA_ACTIVATION_MODE,
  configureHistoricalPWAActivation,
  activateHistoricalPWAUpdater,
  returnHistoricalPWAWindow,
  disposeHistoricalPWAActivation,
  installTrustedBlurWitness,
  assertTrustedActivationBlur,
} from './optional-installation-pwa-activation.mjs';
const sourcePin = '9393fa79e1c67c74edc26b610d65a4f7ed73d345a762465cc88340a33a2454ac';
const A =
  'http://127.0.0.1:12345/revealline/practice/civilian-fpv/releases/v0.142.4/site/optional-practice/civilian-fpv/index.html?lang=en';
const B = A.split('?')[0];
function fixture() {
  const f = {
    commands: [],
    receipt: {},
    focused: true,
    standalone: true,
    events: [],
    closes: 0,
    disposes: 0,
    detaches: [],
    pausedCalls: 0,
    armedAt: 1,
  };
  f.handle = {
    evaluate: async (fn) =>
      fn({
        snapshot: () => ({
          armedAt: f.armedAt,
          focused: f.focused,
          events: f.events.map((v) => ({ ...v })),
        }),
        close: () => {
          f.closes++;
        },
      }),
    dispose: async () => {
      f.disposes++;
    },
  };
  const page = (url) => ({
    url: () => url,
    context: () => f.context,
    evaluate: async (fn) => (fn.toString().includes('matchMedia') ? f.standalone : f.focused),
    evaluateHandle: async () => f.handle,
  });
  f.a = page(A);
  f.b = page(B);
  f.sessions = ['A', 'B'].map((id, index) => ({
    send: async (method, params) => {
      f.commands.push({ id, method, params });
      if (method === 'Target.getTargetInfo')
        return {
          targetInfo: {
            targetId: id,
            type: 'page',
            url: index ? B : A,
            browserContextId: 'owned-context',
          },
        };
      if (method === 'Browser.getWindowForTarget')
        return {
          windowId: index + 1,
          bounds: {
            windowState: 'normal',
            left: 0,
            top: 0,
            width: 1280,
            height: 900,
          },
        };
      if (method === 'Target.activateTarget' && params.targetId === 'B') {
        f.focused = false;
        f.events.push({ trusted: true, focused: false, at: 2 });
      }
      if (method === 'Target.activateTarget' && params.targetId === 'A') f.focused = true;
      return {};
    },
    detach: async () => {
      f.detaches.push(id);
    },
  }));
  f.context = {
    pages: () => [f.a, f.b],
    newCDPSession: async (p) => f.sessions[p === f.a ? 0 : 1],
  };
  f.options = {
    context: f.context,
    previousPage: f.a,
    updatePage: f.b,
    expectedPreviousURL: A,
    expectedUpdateURL: B,
    mode: PWA_ACTIVATION_MODE,
    playwrightSourceSha256: sourcePin,
    receipt: f.receipt,
  };
  f.activate = (g, extra = {}) =>
    activateHistoricalPWAUpdater(g, {
      sessionDeadlineAt: performance.now() + 1000,
      observePaused: async () => {
        f.pausedCalls++;
      },
      ...extra,
    });
  return f;
}
test('exact new opt-in, pinned localhost URLs, owned pages, standalone A are mandatory', async () => {
  for (const kind of [
    'mode',
    'pin',
    'URL',
    'context',
    'same-page',
    'not-owned',
    'not-standalone',
  ]) {
    const f = fixture();
    if (kind === 'mode') f.options.mode = 'owned-window-minimize-98ad851';
    if (kind === 'pin') f.options.playwrightSourceSha256 = '0'.repeat(64);
    if (kind === 'URL')
      f.options.expectedUpdateURL = 'http://127.0.0.1:12345/revealline/practice/civilian-fpv/other';
    if (kind === 'context') f.b.context = () => ({});
    if (kind === 'same-page') f.options.updatePage = f.a;
    if (kind === 'not-owned') f.context.pages = () => [f.a];
    if (kind === 'not-standalone') f.standalone = false;
    await assert.rejects(configureHistoricalPWAActivation(f.options), kind);
    assert(!f.commands.some((x) => x.method === 'Emulation.setFocusEmulationEnabled'));
  }
});
test('exact target identity, browser context and distinct native windows are mandatory', async () => {
  for (const kind of ['url', 'context', 'target', 'window', 'type']) {
    const f = fixture(),
      native = f.sessions[1].send;
    f.sessions[1].send = async (method, params) => {
      const r = await native(method, params);
      if (method === 'Target.getTargetInfo') {
        if (kind === 'url') r.targetInfo.url += '?untrusted=1';
        if (kind === 'context') r.targetInfo.browserContextId = 'foreign';
        if (kind === 'target') r.targetInfo.targetId = 'A';
        if (kind === 'type') r.targetInfo.type = 'service_worker';
      }
      if (method === 'Browser.getWindowForTarget' && kind === 'window') r.windowId = 1;
      return r;
    };
    await assert.rejects(configureHistoricalPWAActivation(f.options));
    assert.deepEqual(f.detaches, ['A', 'B']);
    assert(f.receipt.cleanup.completed);
    assert(!f.commands.some((x) => x.method === 'Emulation.setFocusEmulationEnabled'));
  }
});
test('one native B activation then actual trusted blur plus existing paused HUD; return A and independent cleanup', async () => {
  const f = fixture(),
    g = await configureHistoricalPWAActivation(f.options);
  await f.activate(g);
  await returnHistoricalPWAWindow(g);
  assert.equal(f.pausedCalls, 1);
  assert(f.receipt.activated && f.receipt.returned && f.receipt.transfer.passed);
  assert.equal(f.receipt.returnObservation.beforeFocused, false);
  assert.equal(f.receipt.returnObservation.observations.at(-1).focused, true);
  assert.equal(f.receipt.returnObservation.passed, true);
  assert.deepEqual(
    f.commands.filter((x) => x.method === 'Target.activateTarget').map((x) => x.params.targetId),
    ['B', 'A'],
  );
  assert(
    !f.commands.some(
      (x) => x.method === 'Browser.setWindowBounds' || x.method === 'Page.bringToFront',
    ),
  );
  const cleanup = await disposeHistoricalPWAActivation(g);
  assert(cleanup.completed);
  assert.equal(f.closes, 1);
  assert.equal(f.disposes, 1);
  assert.deepEqual(f.detaches, ['A', 'B']);
  assert.equal(
    f.commands.filter((x) => x.method === 'Emulation.setFocusEmulationEnabled' && x.params.enabled)
      .length,
    2,
  );
  assert.equal(f.receipt.qualified, false);
});
test('fresh trusted blur predicate rejects stale, synthetic, missing and still-focused events', () => {
  for (const value of [
    {
      armedAt: 2,
      focused: false,
      events: [{ at: 1, trusted: true, focused: false }],
    },
    {
      armedAt: 1,
      focused: false,
      events: [{ at: 2, trusted: false, focused: false }],
    },
    {
      armedAt: 1,
      focused: true,
      events: [{ at: 2, trusted: true, focused: false }],
    },
    { armedAt: 1, focused: false, events: [] },
  ])
    assert.throws(() => assertTrustedActivationBlur(value));
});
test('owned closure observes real event trust and removes exactly its listener without globals', () => {
  let listener,
    removed,
    focused = true,
    now = 1;
  const sandbox = {
    performance: { now: () => now },
    document: { hasFocus: () => focused, visibilityState: 'visible' },
    addEventListener: (name, fn) => {
      assert.equal(name, 'blur');
      listener = fn;
    },
    removeEventListener: (name, fn) => {
      assert.equal(name, 'blur');
      removed = fn;
    },
  };
  const before = Object.keys(sandbox);
  const value = runInNewContext(`(${installTrustedBlurWitness.toString()})()`, sandbox);
  focused = false;
  now = 2;
  listener({ isTrusted: false });
  assert.throws(() => assertTrustedActivationBlur(value.snapshot()));
  listener({ isTrusted: true });
  assertTrustedActivationBlur(value.snapshot());
  value.close();
  assert.equal(removed, listener);
  assert.deepEqual(Object.keys(sandbox), before);
  const n = value.snapshot().events.length;
  listener({ isTrusted: true });
  assert.equal(value.snapshot().events.length, n);
});
test('no-op native activation fails within transfer bound before any paused/update callback', async () => {
  const f = fixture(),
    native = f.sessions[1].send;
  f.sessions[1].send = (method, params) =>
    method === 'Target.activateTarget' ? Promise.resolve({}) : native(method, params);
  const g = await configureHistoricalPWAActivation(f.options);
  await assert.rejects(f.activate(g, { transferMs: 15 }));
  assert.equal(f.pausedCalls, 0);
  assert(!f.receipt.activated);
  const cleanup = await disposeHistoricalPWAActivation(g);
  assert(cleanup.results.every((row) => row.passed));
  assert.equal(
    cleanup.completed,
    cleanup.pendingAtStart.length === 0 && cleanup.pending.length === 0,
  );
});
test('native blur alone cannot waive maintained paused HUD or authorize late callback success', async () => {
  for (const late of [false, true]) {
    const f = fixture(),
      g = await configureHistoricalPWAActivation(f.options);
    let release;
    await assert.rejects(
      f.activate(g, {
        transferMs: 15,
        observePaused: () =>
          late
            ? new Promise((r) => {
                release = r;
              })
            : Promise.reject(Error('HUD still active')),
      }),
    );
    assert(!f.receipt.activated);
    const c = await disposeHistoricalPWAActivation(g);
    assert.equal(c.completed, !late);
    if (release) {
      release();
      await pause(1);
      assert.equal(c.completed, false);
      assert(!f.receipt.activated);
    }
  }
});
test('expired shared session never issues activation and stale blur before command is refused', async () => {
  for (const stale of [false, true]) {
    const f = fixture(),
      g = await configureHistoricalPWAActivation(f.options);
    if (stale) f.events.push({ trusted: true, focused: false, at: 2 });
    await assert.rejects(f.activate(g, stale ? {} : { sessionDeadlineAt: performance.now() - 1 }));
    assert(!f.commands.some((x) => x.method === 'Target.activateTarget'));
    assert((await disposeHistoricalPWAActivation(g)).completed);
  }
});
test('event-loop stall after native response cannot pass the transfer deadline', async () => {
  const f = fixture(),
    native = f.sessions[1].send;
  f.sessions[1].send = async (method, params) => {
    const r = await native(method, params);
    if (method === 'Target.activateTarget') {
      const end = performance.now() + 25;
      while (performance.now() < end) {}
    }
    return r;
  };
  const g = await configureHistoricalPWAActivation(f.options);
  await assert.rejects(f.activate(g, { transferMs: 10 }));
  assert.equal(f.pausedCalls, 0);
  assert(!f.receipt.activated);
  assert((await disposeHistoricalPWAActivation(g)).completed);
});
test('late session acquisition is detached once and captured cleanup stays unverified', async () => {
  const f = fixture();
  let release;
  f.context.newCDPSession = () =>
    new Promise((r) => {
      release = r;
    });
  await assert.rejects(configureHistoricalPWAActivation({ ...f.options, timeoutMs: 10 }));
  assert.equal(f.receipt.cleanup.completed, false);
  release(f.sessions[0]);
  await pause(2);
  assert.deepEqual(f.detaches, ['A']);
  assert.equal(f.receipt.cleanup.completed, false);
});
test('listener cleanup failure never skips independent focus restoration/session detach', async () => {
  const f = fixture(),
    g = await configureHistoricalPWAActivation(f.options);
  await f.activate(g);
  f.handle.evaluate = async () => {
    throw Error('listener realm unavailable');
  };
  assert.equal((await disposeHistoricalPWAActivation(g)).completed, false);
  assert.equal(f.disposes, 1);
  assert.deepEqual(f.detaches, ['A', 'B']);
});
test('ownership captured before post-resolution stall still detaches the acquired session', async () => {
  const f = fixture();
  f.context.newCDPSession = async () => {
    queueMicrotask(() =>
      queueMicrotask(() => {
        const end = performance.now() + 25;
        while (performance.now() < end) {}
      }),
    );
    return f.sessions[0];
  };
  await assert.rejects(configureHistoricalPWAActivation({ ...f.options, timeoutMs: 10 }));
  assert.deepEqual(f.detaches, ['A']);
  assert(f.receipt.cleanup.results.every((row) => row.passed));
});
test('late listener acquisition is removed and disposed, never authorizes activation', async () => {
  const f = fixture();
  let release;
  f.a.evaluateHandle = () =>
    new Promise((r) => {
      release = r;
    });
  const g = await configureHistoricalPWAActivation(f.options);
  await assert.rejects(f.activate(g, { sessionDeadlineAt: performance.now() + 10 }));
  const cleanup = await disposeHistoricalPWAActivation(g);
  assert.equal(cleanup.completed, false);
  release(f.handle);
  await pause(2);
  assert.equal(f.closes, 1);
  assert.equal(f.disposes, 1);
  assert(!f.commands.some((x) => x.method === 'Target.activateTarget'));
  assert.equal(cleanup.completed, false);
});
test('failed focus override restoration still attempts both owned session detachments', async () => {
  const f = fixture(),
    g = await configureHistoricalPWAActivation(f.options);
  const native = f.sessions[0].send;
  f.sessions[0].send = async (method, params) => {
    if (method === 'Emulation.setFocusEmulationEnabled' && params.enabled)
      throw Error('restore failed');
    return native(method, params);
  };
  assert.equal((await disposeHistoricalPWAActivation(g)).completed, false);
  assert.deepEqual(f.detaches, ['A', 'B']);
});
test('cleanup response after a timer-dispatch stall cannot claim clean teardown', async () => {
  const f = fixture(),
    g = await configureHistoricalPWAActivation({ ...f.options, timeoutMs: 10 });
  f.sessions[0].detach = async () => {
    f.detaches.push('A');
    const end = performance.now() + 25;
    while (performance.now() < end) {}
  };
  const cleanup = await disposeHistoricalPWAActivation(g);
  assert.equal(cleanup.completed, false);
  assert.deepEqual(f.detaches, ['A', 'B']);
  assert.equal(cleanup.results.find((row) => row.name === 'detach owned A session').passed, false);
  assert.equal(cleanup.results.find((row) => row.name === 'detach owned B session').passed, true);
});
test('native return must observe A unfocused before command and focused afterward', async () => {
  for (const kind of ['no-op', 'already-focused', 'late-response']) {
    const f = fixture(),
      g = await configureHistoricalPWAActivation(f.options);
    await f.activate(g);
    const native = f.sessions[0].send;
    if (kind === 'already-focused') f.focused = true;
    f.sessions[0].send = async (method, params) => {
      if (method === 'Target.activateTarget' && params.targetId === 'A') {
        if (kind === 'no-op') return {};
        const r = await native(method, params);
        if (kind === 'late-response') {
          const end = performance.now() + 25;
          while (performance.now() < end) {}
        }
        return r;
      }
      return native(method, params);
    };
    await assert.rejects(returnHistoricalPWAWindow(g, { returnMs: 10 }));
    assert.equal(f.receipt.returned, false);
    assert.equal(f.receipt.returnObservation.passed, false);
    if (kind === 'already-focused')
      assert(
        !f.commands.some((x) => x.method === 'Target.activateTarget' && x.params.targetId === 'A'),
      );
    await disposeHistoricalPWAActivation(g);
  }
});
test('integration keeps old dispatch intact; new headed-only branch has no minimization fallback', async () => {
  const source = await readFile(
    new URL('./observe-optional-installation.mjs', import.meta.url),
    'utf8',
  );
  assert(source.includes('pwaActivationEnabled || selectHistoricalWindowMode(activeWindowMode)'));
  assert(source.includes('headless: ordinaryWindowEnabled || !activeWindowEnabled'));
  const selection = source.slice(
    source.indexOf('const pwaActivationEnabled ='),
    source.indexOf('const ordinaryWindowEnabled ='),
  );
  const select = (mode, env) =>
    runInNewContext(selection, {
      assert,
      PWA_ACTIVATION_MODE,
      activeWindowMode: mode,
      process: { env },
      selectHistoricalWindowMode: () => false,
    });
  assert.doesNotThrow(() => select(PWA_ACTIVATION_MODE, {}));
  for (const flag of [
    'OPTIONAL_INSTALLATION_DOWNLOAD_FAULTS',
    'OPTIONAL_INSTALLATION_QUOTA_PROBE',
    'OPTIONAL_INSTALLATION_QUOTA_PACKAGES',
    'OPTIONAL_INSTALLATION_MIGRATION',
    'OPTIONAL_INSTALLATION_VERIFICATION_CANCEL',
    'OPTIONAL_INSTALLATION_IMPORTED_WORLD',
    'OPTIONAL_INSTALLATION_OFFLINE_FLIGHT',
  ]) {
    for (const value of ['', 'all-three-en'])
      assert.throws(() => select(PWA_ACTIVATION_MODE, { [flag]: value }), /separate fault-free/);
    assert.doesNotThrow(() => select(undefined, { [flag]: 'all-three-en' }));
  }
  const branch = source.slice(
    source.indexOf('if (pwaActivationEnabled) {'),
    source.indexOf('await stageLauncher(fpv);', source.indexOf('if (pwaActivationEnabled) {')),
  );
  const own = branch.split('} else {')[0];
  assert(own.includes('sessionDeadlineAt: sessionGuard.deadline'));
  assert(own.includes('snapshotPausedAfterTransfer(sessionGuard)'));
  assert(!own.includes('bringToFront') && !own.includes('minimize'));
  assert(branch.includes('minimizeHistoricalSessionWindow(windowGuard)'));
  assert(
    source
      .replace(/\s+/g, ' ')
      .includes(
        'activeWindow.standaloneObserved && activeWindow.activated && activeWindow.returned && activeWindow.returnObservation?.passed && activeWindow.transfer?.passed',
      ),
  );
});

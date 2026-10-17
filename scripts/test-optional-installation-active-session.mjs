import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import {
  selectHistoricalActiveSession,
  validateHistoricalSessionURL,
  parseVisibleHistoricalHUD,
  historicalHUDSnapshot,
  prepareHistoricalAcademySession,
  snapshotPausedAfterTransfer,
  verifyHistoricalSessionAfterUpdate,
  disposeHistoricalAcademySession,
  historicalHeightIncreased,
} from './optional-installation-active-session.mjs';

const mode = 'academy-v0.142.4-98ad851';
const expectedURL =
  'http://127.0.0.1:4321/revealline/practice/civilian-fpv/releases/v0.142.4/site/optional-practice/civilian-fpv/index.html?lang=en';
const raw = () => ({
  locale: 'en',
  viewportVisible: true,
  hudVisible: true,
  detailsVisible: true,
  courseIdentity: 'Lift and land',
  modeIdentity: 'self-level',
  gauge: 'Height',
  details: 'Height 0.2 m · 1.2–2.4 m',
  action: 'Raise throttle',
  phase: 'active',
  shellPhase: 'playing',
  toolbarVisible: true,
  toolbarEnabled: true,
  toolbar: 'Pause',
  focused: true,
  visibility: 'visible',
  viewportFocused: true,
});

// Deliberately blocks timer dispatch in a synthetic unit fixture, not a native flight.
function blockTimerDispatch(ms) {
  const deadline = performance.now() + ms;
  while (performance.now() < deadline) {
    // A resolved operation must still be rejected after its monotonic deadline.
  }
}

test('a resolved read after a timer-dispatch stall cannot pass its deadline', async () => {
  const f = fixture(),
    receipt = {};
  const evaluate = f.page.evaluate;
  f.page.evaluate = async (fn) => {
    const result = await evaluate(fn);
    blockTimerDispatch(60);
    return result;
  };
  await assert.rejects(
    prepareHistoricalAcademySession(f.page, {
      expectedURL,
      receipt,
      mode,
      timeoutMs: 40,
    }),
    /Deadline exceeded: capture time origin/,
  );
  assert.equal(receipt.failure, 'capture time origin');
  assert.equal(receipt.passed, false);
  assert.equal(receipt.witnesses.length, 0);
  assert.equal(receipt.actions.length, 0);
  assert.equal(receipt.cleanup.completed, true);
  assert.equal(f.state.disposed, true);
  assert.equal(f.listeners.size, 0);
});

test('a handle resolved after a dispatch stall remains owned for independent cleanup', async () => {
  const f = fixture(),
    receipt = {};
  const acquire = f.page.evaluateHandle;
  let disposals = 0;
  f.page.evaluateHandle = async () => {
    const handle = await acquire();
    const dispose = handle.dispose;
    handle.dispose = async () => {
      disposals++;
      await dispose();
    };
    blockTimerDispatch(60);
    return handle;
  };
  await assert.rejects(
    prepareHistoricalAcademySession(f.page, {
      expectedURL,
      receipt,
      mode,
      timeoutMs: 40,
    }),
    /Deadline exceeded: capture document identity/,
  );
  assert.equal(receipt.failure, 'capture document identity');
  assert.equal(receipt.passed, false);
  assert.equal(receipt.actions.length, 0);
  assert.equal(disposals, 1);
  assert.equal(f.state.disposed, true);
  assert.equal(receipt.cleanup.completed, true);
  assert.equal(f.listeners.size, 0);
});

test('cleanup returning after its unchanged one-second budget cannot report verified cleanup', async () => {
  const f = fixture(),
    receipt = {};
  const guard = await prepareHistoricalAcademySession(f.page, {
    expectedURL,
    receipt,
    mode,
  });
  const off = f.page.off;
  f.page.off = (...args) => {
    off(...args);
    blockTimerDispatch(1020);
  };
  const cleanup = await disposeHistoricalAcademySession(guard);
  assert.equal(cleanup.completed, false);
  assert.equal(
    cleanup.results.find((row) => row.name === 'remove navigation listener').passed,
    false,
  );
  assert.equal(f.state.disposed, true, 'Other independent cleanup is still attempted.');
  assert.equal(f.listeners.size, 0);
  assert.equal(f.state.held.size, 0);
  assert.equal(receipt.passed, false);
});

test('strict opt-in and historical URL reject current versions, foreign hosts and locales', () => {
  assert.equal(selectHistoricalActiveSession(undefined), false);
  assert.equal(selectHistoricalActiveSession(mode), true);
  for (const value of ['', true, 'all', 'academy'])
    assert.throws(() => selectHistoricalActiveSession(value));
  assert.equal(validateHistoricalSessionURL(expectedURL), expectedURL);
  for (const value of [
    expectedURL.replace('v0.142.4', 'v0.151.1'),
    expectedURL.replace('127.0.0.1', 'localhost'),
    expectedURL.replace('127.0.0.1', 'u:p@127.0.0.1'),
    expectedURL.replace('lang=en', 'lang=uk'),
    expectedURL + '&other=1',
    expectedURL + '#hash',
  ])
    assert.throws(() => validateHistoricalSessionURL(value));
});

test('strict visible HUD parser rejects hidden metrics, wrong phases and unsafe height', () => {
  assert.equal(parseVisibleHistoricalHUD(raw(), 'active').height, 0.2);
  for (const patch of [
    { hudVisible: false },
    { detailsVisible: false },
    { focused: false },
    { viewportFocused: false },
    { locale: 'uk' },
    { courseIdentity: 'Other lesson' },
    { modeIdentity: 'acro' },
    { gauge: 'Speed' },
    { toolbar: 'Resume' },
    { shellPhase: 'paused' },
    { details: 'Height 1.2 m · 1.2–2.4 m' },
    { details: 'Height 0.2 m · 0–0.6 m' },
    { details: 'Speed 0.2 m/s · 1.2–2.4 m/s' },
  ])
    assert.throws(() => parseVisibleHistoricalHUD({ ...raw(), ...patch }, 'active'));
});

test('motion requires positive height gain and rejects gravity falls or reset to ground', () => {
  assert(historicalHeightIncreased(0, 0.2, 0.2));
  assert(historicalHeightIncreased(0.3, 0.4));
  assert(!historicalHeightIncreased(0.3, 0));
  assert(!historicalHeightIncreased(0.3, 0.2));
  assert(!historicalHeightIncreased(0.3, 0.3));
  assert.throws(() => historicalHeightIncreased(0, Infinity));
});

/** Synthetic public-DOM unit fixture. Not simulated flight or browser evidence. */
function fixture({ failKey = false, failDispose = false, startDisarmed = false } = {}) {
  const events = [],
    selectors = [],
    listeners = new Map();
  const state = {
    phase: 'disarmed',
    height: 0,
    focused: true,
    visible: true,
    surface: 'home',
    detailed: false,
    held: new Set(),
    url: expectedURL,
    origin: 123,
    disposed: false,
    input: 'keyboard',
    preset: 'two-stick',
    mode: 'self-level',
  };
  const element = (extra = {}) =>
    Object.defineProperties(
      { getClientRects: () => [{}] },
      Object.getOwnPropertyDescriptors(extra),
    );
  const root = element({ lang: 'en' }),
    viewport = element({ contains: () => state.surface === 'play' });
  const details = element({
    get textContent() {
      return `Height ${state.height.toFixed(1)} m · 1.2–2.4 m`;
    },
    getClientRects: () => (state.detailed ? [{}] : []),
  });
  const hud = element({
    querySelector(selector) {
      if (selector === '[data-hud-part="details"]') return details;
      if (selector === '[data-hud-part="gauge-name"]') return { textContent: 'Height' };
      if (selector === '[data-hud-part="action"]')
        return {
          textContent: state.phase === 'paused' ? 'Paused' : 'Raise throttle',
        };
      assert.fail(`Unexpected HUD field ${selector}`);
    },
  });
  const document = {
    documentElement: root,
    hasFocus: () => state.focused,
    get visibilityState() {
      return state.visible ? 'visible' : 'hidden';
    },
    activeElement: {},
    querySelector(selector) {
      selectors.push(selector);
      if (selector === '#viewport') return viewport;
      if (selector === '[data-sim-hud="flight"]') return hud;
      if (selector === '#course-title') return { textContent: 'Lift and land' };
      if (selector === '#mode') return { value: state.mode };
      if (selector === '#flight-app') return { dataset: { flightState: state.phase } };
      if (selector === '[data-mode-play-shell="academy-shell"]')
        return {
          dataset: {
            phase: state.phase === 'active' ? 'playing' : state.phase,
          },
        };
      if (selector === '#academy-shell-action-pause')
        return element({
          disabled: false,
          textContent: state.phase === 'active' ? 'Pause' : 'Resume',
        });
      assert.fail(`Legacy/private DOM read forbidden: ${selector}`);
    },
  };
  const sandbox = {
    document,
    getComputedStyle: () => ({ visibility: 'visible', display: 'block' }),
    performance: {
      get timeOrigin() {
        return state.origin;
      },
    },
  };
  const evaluate = (fn, argument) =>
    runInNewContext(`(${fn.toString()})(argument)`, { ...sandbox, argument });
  const mainFrame = {};
  const page = {
    url: () => state.url,
    mainFrame: () => mainFrame,
    on: (event, callback) => listeners.set(event, callback),
    off: (event, callback) => {
      assert.equal(listeners.get(event), callback);
      listeners.delete(event);
      events.push('listener removed');
    },
    evaluate: async (fn) => {
      if (fn === historicalHUDSnapshot && state.phase === 'active' && state.held.has('w'))
        state.height += 0.1;
      return evaluate(fn);
    },
    evaluateHandle: async () => ({
      evaluate: async (fn) => evaluate(fn, root),
      dispose: async () => {
        state.disposed = true;
        events.push('handle disposed');
        if (failDispose) throw Error('dispose failed');
      },
    }),
    bringToFront: async () => {
      state.focused = true;
      state.visible = true;
      events.push('foreground');
    },
    locator: (selector) => {
      const requireVisible = () => {
        if (selector === '#academy-shell-action-settings') assert.equal(state.surface, 'home');
        else if (selector === '#academy-shell-action-primary') assert.equal(state.surface, 'home');
        else if (selector === '#academy-shell-action-start')
          assert.equal(state.surface, 'briefing');
        else if (selector === '#academy-flight-resume') assert.equal(state.surface, 'play');
        else assert.equal(state.surface, 'settings');
      };
      return {
        waitFor: async ({ state: visibility }) => {
          assert.equal(visibility, 'visible');
          requireVisible();
        },
        isEnabled: async () => {
          if (selector === '#academy-flight-resume') {
            state.armChecks = (state.armChecks ?? 0) + 1;
            return state.armChecks >= 3;
          }
          return true;
        },
        press: async (key) => {
          requireVisible();
          assert.equal(key, 'Enter');
          events.push(selector);
          if (selector === '#academy-shell-action-settings') state.surface = 'settings';
          else if (selector === '#academy-shell-action-settings-back') state.surface = 'home';
          else if (selector === '#academy-shell-action-primary') state.surface = 'briefing';
          else if (selector === '#academy-shell-action-start') {
            state.surface = 'play';
            state.phase = startDisarmed ? 'disarmed' : 'active';
          } else if (selector === '#academy-flight-resume') {
            assert(state.armChecks >= 3);
            state.phase = 'active';
          } else assert.fail(`Unexpected activation ${selector}`);
        },
        selectOption: async (value) => {
          requireVisible();
          events.push(`${selector}=${value}`);
          if (selector === '[data-hud-preference="mode"]') {
            assert.equal(value, 'detailed');
            state.detailed = true;
          } else if (selector === '#input-source') {
            assert.equal(value, 'keyboard');
            state.input = value;
          } else if (selector === '#keyboard-preset') {
            assert.equal(value, 'two-stick');
            state.preset = value;
          } else if (selector === '#mode') {
            assert.equal(value, 'self-level');
            state.mode = value;
          } else assert.fail(`Unexpected selection ${selector}`);
        },
      };
    },
    keyboard: {
      down: async (key) => {
        events.push(`down:${key}`);
        state.held.add(key);
        if (failKey) throw Error('Native key-down failed');
        assert.equal(state.surface, 'play');
        assert(state.focused);
        if (key === 'Space') state.phase = state.phase === 'active' ? 'paused' : 'active';
        else assert.equal(key, 'w');
      },
      up: async (key) => {
        events.push(`up:${key}`);
        state.held.delete(key);
      },
    },
  };
  return {
    page,
    state,
    events,
    selectors,
    listeners,
    mainFrame,
    sandbox,
    transfer() {
      state.focused = false;
      state.phase = 'paused';
      events.push('natural unit focus transfer');
    },
  };
}

test('unit route preserves actual DOM-reader restrictions and explicit pause/resume ordering', async () => {
  const f = fixture(),
    receipt = {};
  const guard = await prepareHistoricalAcademySession(f.page, {
    expectedURL,
    receipt,
    mode,
  });
  try {
    assert.equal(receipt.passed, false);
    assert.equal(f.state.phase, 'active');
    f.transfer();
    await snapshotPausedAfterTransfer(guard);
    await verifyHistoricalSessionAfterUpdate(guard);
    assert.equal(receipt.passed, true);
    assert.equal(receipt.qualified, false);
    assert.equal(receipt.exactTickContinuity, false);
    assert.equal(receipt.uninterruptedBackgroundFlight, false);
    assert.equal(f.state.phase, 'paused');
    assert.equal(receipt.witnesses.length, 8);
    assert(
      !f.selectors.some((selector) =>
        ['#height', '#speed', '#power', '#step-progress'].includes(selector),
      ),
    );
    assert(
      f.events.indexOf('#academy-shell-action-settings-back') <
        f.events.indexOf('#academy-shell-action-start'),
    );
    assert.equal(f.events.filter((event) => event === 'down:Space').length, 4);
    assert.equal(f.events.filter((event) => event === 'down:w').length, 3);
  } finally {
    assert.equal((await disposeHistoricalAcademySession(guard)).completed, true);
  }
  assert.equal(f.listeners.size, 0);
  assert(f.state.disposed);
  assert.equal(f.state.held.size, 0);
});

test('identity, URL, navigation, paused-height and auto-resume changes fail closed', async () => {
  for (const sabotage of [
    (f) => {
      f.state.url = expectedURL.replace('v0.142.4', 'v0.151.1');
    },
    (f) => {
      f.state.origin++;
    },
    (f) => {
      f.sandbox.document.documentElement = { lang: 'en' };
    },
    (f) => {
      f.listeners.get('framenavigated')(f.mainFrame);
    },
    (f) => {
      f.state.height += 0.1;
    },
    (f) => {
      f.state.phase = 'active';
    },
  ]) {
    const f = fixture(),
      receipt = {};
    const guard = await prepareHistoricalAcademySession(f.page, {
      expectedURL,
      receipt,
      mode,
    });
    try {
      f.transfer();
      await snapshotPausedAfterTransfer(guard);
      sabotage(f);
      await assert.rejects(verifyHistoricalSessionAfterUpdate(guard));
      assert.equal(receipt.passed, false);
    } finally {
      await disposeHistoricalAcademySession(guard);
    }
  }
});

test('missing opt-in, out-of-order verification, and fabricated guards cannot qualify', async () => {
  const f = fixture();
  await assert.rejects(prepareHistoricalAcademySession(f.page, { expectedURL, receipt: {} }));
  assert.deepEqual(f.events, []);
  await assert.rejects(snapshotPausedAfterTransfer({ stage: 'running-before-transfer' }));
  const receipt = {},
    guard = await prepareHistoricalAcademySession(f.page, {
      expectedURL,
      receipt,
      mode,
    });
  try {
    await assert.rejects(verifyHistoricalSessionAfterUpdate(guard));
    f.state.phase = 'paused';
    await assert.rejects(snapshotPausedAfterTransfer(guard)); // No natural focus transfer.
    assert.equal(receipt.passed, false);
  } finally {
    await disposeHistoricalAcademySession(guard);
  }
});

test('failed native focus transfer preserves one bounded last public snapshot', async () => {
  const f = fixture(),
    receipt = {};
  const guard = await prepareHistoricalAcademySession(f.page, {
    expectedURL,
    receipt,
    mode,
  });
  try {
    await assert.rejects(snapshotPausedAfterTransfer(guard), /1500ms/);
    assert.equal(receipt.passed, false);
    assert(receipt.transferDiagnostics.attempts > 0 && receipt.transferDiagnostics.attempts < 40);
    assert.equal(receipt.transferDiagnostics.lastSnapshot.phase, 'active');
    assert.equal(receipt.transferDiagnostics.lastSnapshot.focused, true);
    assert.equal(receipt.transferDiagnostics.lastSnapshot.visibility, 'visible');
    assert.equal(receipt.transferDiagnostics.maximumWaitMs, 1500);
  } finally {
    await disposeHistoricalAcademySession(guard);
  }
});

test('native key failure releases owned key; handle failure does not skip listener cleanup', async () => {
  const f = fixture({ failKey: true, failDispose: true }),
    receipt = {};
  await assert.rejects(prepareHistoricalAcademySession(f.page, { expectedURL, receipt, mode }));
  assert.equal(receipt.passed, false);
  assert.equal(receipt.cleanup.completed, false);
  assert.equal(f.state.held.size, 0);
  assert.equal(f.listeners.size, 0);
  assert(f.state.disposed);
  assert(f.events.includes('up:w'));
});

test('one shared expired deadline rejects the later stage and still permits independent disposal', async () => {
  const f = fixture(),
    receipt = {};
  const guard = await prepareHistoricalAcademySession(f.page, {
    expectedURL,
    receipt,
    mode,
  });
  try {
    assert.equal(receipt.deadlineMs, 30000);
    // Unit-only expiry of the guard's wall-clock budget, never a browser/model time override.
    guard.deadline = performance.now() - 1;
    f.transfer();
    await assert.rejects(snapshotPausedAfterTransfer(guard), /30 seconds/);
    assert.equal(receipt.passed, false);
  } finally {
    await disposeHistoricalAcademySession(guard);
  }
  assert.equal(f.listeners.size, 0);
  assert(f.state.disposed);
});

test('late visibility or enabled results cannot emit an activation after timeout/disposal', async () => {
  for (const method of ['waitFor', 'isEnabled']) {
    const f = fixture(),
      receipt = {};
    let release,
      entered = false;
    const waiting = new Promise((resolve) => {
      release = resolve;
    });
    const original = f.page.locator;
    f.page.locator = (selector) => {
      const control = original(selector);
      if (selector === '#academy-shell-action-settings')
        control[method] = async () => {
          entered = true;
          await waiting;
          return method === 'isEnabled' ? true : undefined;
        };
      return control;
    };
    await assert.rejects(
      prepareHistoricalAcademySession(f.page, {
        expectedURL,
        receipt,
        mode,
        timeoutMs: 100,
      }),
    );
    assert(entered);
    assert.equal(receipt.cleanup.completed, true);
    release();
    await delay(20);
    assert(!f.events.includes('#academy-shell-action-settings'));
    assert(!f.events.some((event) => event.startsWith('down:')));
    assert.equal(f.listeners.size, 0);
  }
});

test('already in-flight activation prevents a verified cleanup even if it settles later', async () => {
  const f = fixture(),
    receipt = {};
  let release,
    entered = false;
  const waiting = new Promise((resolve) => {
    release = resolve;
  });
  const original = f.page.locator;
  f.page.locator = (selector) => {
    const control = original(selector);
    if (selector === '#academy-shell-action-settings') {
      const press = control.press;
      control.press = async (key) => {
        entered = true;
        await waiting;
        return press(key);
      };
    }
    return control;
  };
  await assert.rejects(
    prepareHistoricalAcademySession(f.page, {
      expectedURL,
      receipt,
      mode,
      timeoutMs: 100,
    }),
  );
  assert(entered);
  assert.equal(receipt.cleanup.completed, false);
  assert.equal(receipt.cleanup.pendingOwned, 1);
  release();
  await delay(20);
  assert(f.events.includes('#academy-shell-action-settings'));
  assert(!f.events.some((event) => event.startsWith('#input-source=')));
  assert.equal(
    receipt.cleanup.completed,
    false,
    'Do not reclassify unresolved cleanup after late action',
  );
  assert.equal(receipt.passed, false);
});

test('a late native key-down is released again and cannot qualify cleanup', async () => {
  const f = fixture(),
    receipt = {};
  let release,
    entered = false;
  const waiting = new Promise((resolve) => {
    release = resolve;
  });
  const down = f.page.keyboard.down;
  f.page.keyboard.down = async (key) => {
    entered = true;
    await waiting;
    return down(key);
  };
  await assert.rejects(
    prepareHistoricalAcademySession(f.page, {
      expectedURL,
      receipt,
      mode,
      timeoutMs: 100,
    }),
  );
  assert(entered);
  assert.equal(receipt.cleanup.completed, false);
  release();
  await delay(20);
  assert.equal(f.state.held.size, 0);
  assert.equal(receipt.passed, false);
  assert(f.events.lastIndexOf('up:w') > f.events.indexOf('down:w'));
});

test('a disarmed Start is recorded, then only visible enabled native Arm permits another action', async () => {
  const f = fixture({ startDisarmed: true }),
    receipt = {};
  const guard = await prepareHistoricalAcademySession(f.page, {
    expectedURL,
    receipt,
    mode,
  });
  try {
    assert.deepEqual(receipt.startAttempt, {
      phase: 'disarmed',
      additionalArmRequired: true,
      additionalArmActivated: true,
    });
    assert.equal(f.state.armChecks, 3);
    assert(
      f.events.indexOf('#academy-shell-action-start') < f.events.indexOf('#academy-flight-resume'),
    );
    assert.equal(f.events.filter((event) => event === '#academy-flight-resume').length, 1);
  } finally {
    await disposeHistoricalAcademySession(guard);
  }
});

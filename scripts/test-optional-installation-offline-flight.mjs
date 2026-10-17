/** Synthetic public UI fixtures only; never native browser evidence. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import {
  selectOfflineFlightMode,
  validateOfflineFlightURL,
  parseOfflineFlightHUD,
  readOfflineFlightDOM,
  observeOfflineFlight,
  assertOfflineFlightMatrix,
} from './optional-installation-offline-flight.mjs';
const ids = ['civilian-flight', 'civilian-fpv'];
const url = (id) =>
  `http://127.0.0.1:3200/revealline/practice/${id}/releases/v0.151.1/site/optional-practice/${id}/index.html?lang=en`;
function raw(id, height = 0, paused = false) {
  return {
    locale: 'en',
    visible: true,
    focused: true,
    phase: paused ? 'paused' : id === ids[0] ? 'playing' : 'active',
    details: id === ids[0] ? `10, 16 · ${height} m · 0°` : `Height ${height} m · 1.2–2.4 m`,
    drill: 'lift-and-land',
    title: 'Lift and land',
    courseNumber: '01 / 12 · Self-level',
    source: 'keyboard',
    preset: 'two-stick',
    mode: 'self-level',
    gauge: 'Height',
  };
}
function fixture(
  id,
  {
    bad = {},
    delayed = 0,
    stuckSettings = false,
    failCapture = false,
    lateDown = false,
    failAfterDown = false,
    cleanupStall = 0,
  } = {},
) {
  let height = 0,
    down = false,
    paused = false,
    started = false,
    open = false,
    backs = 0;
  const calls = [];
  const page = {
    url: () => url(id),
    evaluate: async (fn) => {
      assert.equal(fn, readOfflineFlightDOM);
      return {
        ...raw(id, height, paused),
        ...bad,
        ...(failAfterDown && down ? { visible: false } : {}),
      };
    },
    waitForTimeout: async (ms) => {
      await new Promise((r) => setTimeout(r, ms));
      if (down) height = 0.2;
    },
    keyboard: {
      down: async (key) => {
        calls.push(['down', key]);
        if (lateDown) await new Promise((r) => setTimeout(r, 50));
        down = true;
      },
      up: async (key) => {
        calls.push(['up', key]);
        const until = performance.now() + cleanupStall;
        while (performance.now() < until) {}
        down = false;
      },
      press: async (key) => {
        assert.equal(key, 'Space');
        paused = true;
        calls.push(['key', key]);
      },
    },
    locator(selector) {
      return {
        waitFor: async () => {
          if (delayed) await new Promise((r) => setTimeout(r, delayed));
        },
        isEnabled: async () => true,
        getAttribute: async (name) =>
          name === 'open'
            ? open
              ? ''
              : null
            : started
              ? id === ids[0]
                ? 'playing'
                : 'active'
              : 'ready',
        press: async (value) => {
          calls.push(['press', selector, value]);
          if (selector.endsWith('-settings')) open = true;
          if (selector.endsWith('settings-back') && ++backs === 2 && !stuckSettings) open = false;
          if (selector.endsWith('-primary')) started = true;
        },
        click: async () => {
          calls.push(['click', selector]);
          if (selector.endsWith('-pause')) paused = true;
        },
        selectOption: async (value) => calls.push(['select', selector, value]),
      };
    },
  };
  return {
    page,
    calls,
    opts: {
      packageId: id,
      expectedURL: url(id),
      deadlineAt: Date.now() + 10000,
      requireActive() {},
      receipt: {},
      restartConfirmed: true,
      networkProbeFailed: true,
      capture: async () => {
        if (failCapture) throw Error('capture failed');
        return { sha256: 'a'.repeat(64) };
      },
    },
  };
}
test('strict omitted/all-three selection and incompatible flags', () => {
  assert.equal(selectOfflineFlightMode(undefined), false);
  assert(
    selectOfflineFlightMode('all-three-en', {
      worldSeed: true,
      importedWorld: true,
    }),
  );
  for (const patch of [
    { worldSeed: false },
    { importedWorld: false },
    { quota: '0' },
    { quotaPackages: 'all' },
    { download: 'all-short' },
    { historical: true },
    { activeWindow: 'x' },
    { diagnostics: '1' },
    { unexpected: true },
  ])
    assert.throws(() =>
      selectOfflineFlightMode('all-three-en', {
        worldSeed: true,
        importedWorld: true,
        ...patch,
      }),
    );
  assert.throws(() => selectOfflineFlightMode('all', {}));
});
test('exact bounded entry identity', () => {
  for (const id of ids) {
    assert.equal(validateOfflineFlightURL(url(id), id), url(id));
    for (const v of [
      url(id) + '#packs',
      url(id) + '&x=1',
      url(id).replace('?lang=en', ''),
      url(id).replace('127.0.0.1', 'user@127.0.0.1'),
      url(id).replace('en', 'uk'),
      url(id).replace('/revealline', ''),
    ])
      assert.throws(() => validateOfflineFlightURL(v, id));
  }
});
test('rendered measurements and first-course identity fail closed', () => {
  for (const id of ids) {
    assert.equal(parseOfflineFlightHUD(raw(id, 0.2), id).height, 0.2);
    for (const patch of [
      { visible: false },
      { focused: false },
      { locale: 'uk' },
      { phase: 'complete' },
      { details: 'Height 99 m' },
      ...(id === ids[0]
        ? [{ drill: 'another' }]
        : [
            { source: 'radio' },
            { mode: 'acro' },
            { title: 'Other' },
            { gauge: 'Speed' },
            { courseNumber: '02 / 12 · Self-level' },
          ]),
    ])
      assert.throws(() => parseOfflineFlightHUD({ ...raw(id), ...patch }, id));
    assert.throws(() => parseOfflineFlightHUD(raw(id, 0.8), id));
  }
  const source = readOfflineFlightDOM.toString();
  for (const forbidden of [
    "'#height'",
    "'#speed'",
    "'#power'",
    "'#step-progress'",
    'snapshot',
    'localStorage',
    'indexedDB',
  ])
    assert(!source.includes(forbidden));
});
for (const id of ids)
  test(`native public adapter ${id}: explicit Start, lift, pause and screenshot`, async () => {
    const f = fixture(id);
    await observeOfflineFlight(f.page, f.opts);
    const r = f.opts.receipt;
    assert(r.passed && r.cleanup.completed && r.explicitStart && r.explicitPause);
    assert.equal(r.before.height, 0);
    assert.equal(r.after.height, 0.2);
    assert.equal(r.paused.length, 4);
    assert.deepEqual(
      f.calls.filter((c) => c[0] === 'down'),
      [['down', id === ids[0] ? 'r' : 'w']],
    );
    assert(f.calls.some((c) => c[0] === 'up'));
    assert(!r.exerciseCompleted);
  });
test('wrong focus/state rejects before throttle; pre-abort rejects before any UI action', async () => {
  for (const patch of [{ bad: { focused: false } }, { bad: { title: 'other' } }]) {
    const f = fixture(ids[1], patch);
    await assert.rejects(observeOfflineFlight(f.page, f.opts));
    assert(!f.calls.some((c) => c[0] === 'down'));
  }
  const f = fixture(ids[0]);
  f.opts.signal = AbortSignal.abort();
  await assert.rejects(observeOfflineFlight(f.page, f.opts));
  assert.equal(f.calls.length, 0);
});
test('late visibility cannot activate after shared deadline', async () => {
  const f = fixture(ids[0], { delayed: 50 });
  f.opts.deadlineAt = Date.now() + 15;
  await assert.rejects(observeOfflineFlight(f.page, f.opts));
  await new Promise((r) => setTimeout(r, 65));
  assert.equal(f.calls.length, 0);
  assert.equal(f.opts.receipt.cleanup.completed, false);
});
test('late owned keydown releases itself and cannot qualify cleanup', async () => {
  const f = fixture(ids[0], { lateDown: true });
  f.opts.deadlineAt = Date.now() + 20;
  await assert.rejects(observeOfflineFlight(f.page, f.opts));
  await new Promise((r) => setTimeout(r, 70));
  assert(f.calls.filter((c) => c[0] === 'up').length >= 2);
  assert.equal(f.opts.receipt.cleanup.completed, false);
  assert(!f.opts.receipt.passed);
});
test('cleanup rejects a key-up delivered beyond its monotonic limit despite stalled timer dispatch', async () => {
  const f = fixture(ids[0], { failAfterDown: true, cleanupStall: 20 });
  f.opts.cleanupMs = 5;
  await assert.rejects(observeOfflineFlight(f.page, f.opts));
  assert(f.calls.some((c) => c[0] === 'up'));
  assert.equal(f.opts.receipt.cleanup.completed, false);
  assert(f.opts.receipt.cleanup.errors.some((e) => /absolute deadline/.test(e)));
});
test('failed screenshot never passes; Settings back is bounded', async () => {
  const f = fixture(ids[0], { failCapture: true });
  await assert.rejects(observeOfflineFlight(f.page, f.opts), /capture/);
  assert(!f.opts.receipt.passed && f.opts.receipt.cleanup.completed);
  const b = fixture(ids[1], { stuckSettings: true });
  await assert.rejects(observeOfflineFlight(b.page, b.opts));
  assert.equal(b.calls.filter((c) => c[1]?.endsWith('settings-back')).length, 5);
});
test('six-route parent gate rejects missing flights, failed imported route or unstable source', () => {
  const good = {
      sourceStable: true,
      runtime: Array(6).fill({}),
      flights: ['browser-process-restart-launcher', 'browser-process-restart-standalone'].flatMap(
        (route) =>
          ids.map((packageId) => ({
            route,
            packageId,
            passed: true,
            cleanup: { completed: true, errors: [] },
            screenshot: { sha256: 'a'.repeat(64) },
            explicitStart: true,
            explicitPause: true,
            replay: false,
            networkProbeFailed: true,
            processRestartConfirmed: true,
            before: { height: 0 },
            after: { height: 0.2 },
            paused: [0, 210, 420, 630].map((at) => ({
              height: 0.2,
              phase: 'paused',
              visible: true,
              at,
            })),
          })),
      ),
    },
    imported = {
      passed: true,
      flights: ['browser-process-restart-launcher', 'browser-process-restart-standalone'].map(
        (label) => ({
          label,
          passed: true,
          cleanup: { completed: true },
          networkProbeFailed: true,
          processRestartConfirmed: true,
        }),
      ),
    };
  assert(assertOfflineFlightMatrix(good, imported, { passed: true }));
  for (const mutate of [
    (r) => (r.flights[0].paused[1].at = -1),
    (r) => (r.flights[0].paused[1].at = NaN),
    (r) => (r.flights[0].screenshot.sha256 = 'fake'),
    (r) => (r.flights[0].replay = true),
  ]) {
    const changed = structuredClone(good);
    mutate(changed);
    assert.throws(() => assertOfflineFlightMatrix(changed, imported, { passed: true }));
  }
  for (const patch of [{ flights: good.flights.slice(1) }, { sourceStable: false }])
    assert.throws(() =>
      assertOfflineFlightMatrix({ ...good, ...patch }, imported, {
        passed: true,
      }),
    );
  assert.throws(() =>
    assertOfflineFlightMatrix(good, { ...imported, passed: false }, { passed: true }),
  );
  assert.throws(() => assertOfflineFlightMatrix(good, imported, { passed: false }));
});

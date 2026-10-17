import assert from 'node:assert/strict';
import test from 'node:test';
import {
  exportWorkerDiagnostics,
  parseWorkerOptions,
  WORKER_DIAGNOSTIC_WINDOW_MS,
} from './solo-worker-diagnostics.mjs';

test('worker diagnostics are opt-in and preserve the default engine and access fixture', () => {
  assert.deepEqual(parseWorkerOptions([]), {
    engine: 'chromium',
    diagnostics: false,
    idleControl: false,
    fixtureAccess: false,
  });
  assert.deepEqual(parseWorkerOptions(['--browser=webkit', '--fixture-access']), {
    engine: 'webkit',
    diagnostics: false,
    idleControl: false,
    fixtureAccess: true,
  });
  assert.deepEqual(parseWorkerOptions(['--browser=webkit', '--diagnostics', '--idle-control']), {
    engine: 'webkit',
    diagnostics: true,
    idleControl: true,
    fixtureAccess: false,
  });
  assert.equal(WORKER_DIAGNOSTIC_WINDOW_MS, 12000);
});
test('unknown, duplicate and unqualified control options are rejected', () => {
  for (const flags of [
    ['--idle-control'],
    ['--diagnostics', '--diagnostics'],
    ['--browser=webkit', '--browser=chromium'],
    ['--browser=firefox'],
    ['--diagnostics=0'],
    ['--resume'],
  ])
    assert.throws(() => parseWorkerOptions(flags));
});
function pageFixture(state, value = { phase: 'paused', recentFrames: [] }) {
  const calls = [];
  return {
    calls,
    locator(selector) {
      return {
        async getAttribute(name) {
          calls.push(['read', selector, name]);
          return state;
        },
        async click(options) {
          calls.push(['click', selector, options]);
          state = 'paused';
        },
      };
    },
    async waitForFunction(fn, arg, options) {
      calls.push(['wait', options]);
      assert.equal(state, 'paused');
    },
    async evaluate(fn) {
      if (!/RevealLineSoloPerformance\.export/.test(fn.toString())) {
        calls.push(['post-window']);
        return { flightState: state, visibilityState: 'visible', hasFocus: true };
      }
      calls.push(['export']);
      assert.notEqual(state, 'running');
      return value;
    },
  };
}
test('successful active diagnostic uses the public force-pause menu before export', async () => {
  const page = pageFixture('running'),
    evidence = {};
  await exportWorkerDiagnostics(page, evidence);
  assert.equal(evidence.publicPauseRequested, true);
  assert.equal(evidence.postWindowAction, 'public-menu-forced-pause');
  assert.deepEqual(page.calls, [
    ['post-window'],
    ['click', '#shell-menu', { timeout: 10000 }],
    ['wait', { timeout: 10000 }],
    ['export'],
  ]);
});
test('unexpected auto-pause is exported without a resume or another click', async () => {
  const page = pageFixture('paused'),
    evidence = {};
  await exportWorkerDiagnostics(page, evidence);
  assert.equal(evidence.publicPauseRequested, false);
  assert.deepEqual(page.calls, [['post-window'], ['export']]);
});
test('unavailable or oversized diagnostic exports do not silently pass', async () => {
  const page = pageFixture('paused', { payload: 'x'.repeat(1024 * 1024) });
  await assert.rejects(exportWorkerDiagnostics(page, {}), /fixed bound/);
  const unavailable = pageFixture('paused');
  unavailable.evaluate = async () => {
    throw new Error('Bounded application performance session unavailable.');
  };
  await assert.rejects(exportWorkerDiagnostics(unavailable, {}), /unavailable/);
});

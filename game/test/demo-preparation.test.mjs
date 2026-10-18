import test from 'node:test';
import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import { createDemoPreparation, reportDemoPreparation } from '../demo-preparation.mjs';

test('preparation keeps fixed stage totals and four immutable candidate summaries', () => {
  let now = 0;
  const evidence = createDemoPreparation({ now: () => now });
  evidence.report('candidate', { variant: 'chromium', engineHint: 'chromium', prefetched: true });
  evidence.report('payload');
  now = 4;
  evidence.report('verification');
  evidence.report('progress', { tick: 240, totalTicks: 19020 });
  now = 10;
  const before = evidence.snapshot();
  evidence.report('candidate-failed', { code: 'demo-content-mismatch' });
  evidence.report('candidate', { variant: 'default', engineHint: 'chromium' });
  evidence.report('payload');
  now = 12;
  evidence.report('verification');
  now = 30;
  evidence.report('candidate-verified');
  evidence.report('renderer');
  now = 34;
  const after = evidence.finish('ready');
  assert.equal(after.elapsedMs, 34);
  assert.equal(after.durationsMs.payload, 6);
  assert.equal(after.durationsMs.verification, 24);
  assert.equal(after.durationsMs.renderer, 4);
  assert.equal(after.candidates[0].tick, 240);
  assert.equal(after.candidates[0].status, 'failed');
  assert.equal(after.candidates[1].status, 'verified');
  assert.equal(before.candidates[0].status, 'loading');
  assert.equal(before.candidates[0].elapsedMs, 10);
  assert.throws(() => {
    after.candidates[0].tick = 1;
  }, TypeError);
  assert.throws(() => {
    after.durationsMs.renderer = 999;
  }, TypeError);
  now = 100000;
  evidence.report('verification');
  evidence.report('progress', { tick: 999, totalTicks: 19020 });
  assert.equal(evidence.snapshot(), after);

  const bounded = createDemoPreparation({ now: () => now });
  for (let index = 0; index < 100; index++) {
    bounded.report('candidate', { variant: 'x'.repeat(1000), engineHint: 'x'.repeat(1000) });
    bounded.report('progress', { tick: Infinity, totalTicks: Infinity });
    bounded.report('unknown-stage');
  }
  assert.equal(bounded.snapshot().candidates.length, 4);
  assert.ok(JSON.stringify(bounded.snapshot()).length < 2000);
});

test('abort freezes timing and progress immediately and removes the only observer listener', () => {
  let now = 0;
  const controller = new AbortController();
  const evidence = createDemoPreparation({ now: () => now });
  evidence.bind(controller.signal);
  evidence.report('candidate', { variant: 'chromium' });
  evidence.report('verification');
  evidence.report('progress', { tick: 240, totalTicks: 19020 });
  now = 15000;
  controller.abort(Object.assign(new Error('Timed out'), { code: 'demo-load-timeout' }));
  const frozen = evidence.snapshot();
  assert.equal(frozen.status, 'failed');
  assert.equal(frozen.elapsedMs, 15000);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  now = 90000;
  evidence.report('progress', { tick: 19020, totalTicks: 19020 });
  assert.equal(evidence.finish('ready'), frozen);
  assert.equal(frozen.candidates[0].tick, 240);
});

test('explicit cancellation remains distinct and diagnostic observers cannot throw into gameplay', () => {
  const controller = new AbortController();
  const evidence = createDemoPreparation();
  controller.abort();
  evidence.bind(controller.signal);
  assert.equal(evidence.snapshot().status, 'cancelled');
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  assert.doesNotThrow(() =>
    reportDemoPreparation(() => {
      throw Error('Bad observer');
    }, 'progress'),
  );
});

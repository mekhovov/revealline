import test from 'node:test';
import assert from 'node:assert/strict';
import { attachControllerConfirmTrace } from '../ui/controller-confirm-trace.mjs';

test('disabled trace records nothing and creates no UI', () => {
  const trace = attachControllerConfirmTrace({ enabled: false });
  trace.record({ event: 'start', targetId: 'sound' });
  assert.deepEqual(trace.snapshot(), []);
  trace.destroy();
});

test('trace is bounded and stores only the diagnostic allowlist', () => {
  const trace = attachControllerConfirmTrace({ enabled: true, document: null, limit: 16 });
  for (let index = 0; index < 20; index++)
    trace.record({
      time: index,
      gamepadTimestamp: index * 2,
      event: 'frame',
      phase: 'active',
      buttons: [0, 2],
      nativeEventType: 'click',
      targetId: 'sound',
      winner: 'gamepad',
      typedText: 'must not be stored',
    });
  const entries = trace.snapshot();
  assert.equal(entries.length, 16);
  assert.equal(entries[0].t, 4);
  assert.deepEqual(Object.keys(entries[0]), [
    't',
    'gp',
    'event',
    'phase',
    'buttons',
    'native',
    'target',
    'winner',
    'reason',
  ]);
  assert.equal(JSON.stringify(entries).includes('must not be stored'), false);
});

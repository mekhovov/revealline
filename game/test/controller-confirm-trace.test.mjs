import test from 'node:test';
import assert from 'node:assert/strict';
import { attachControllerConfirmTrace } from '../ui/controller-confirm-trace.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

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

test('trace UI follows live locale changes without clearing diagnostics', () => {
  const elements = [];
  const document = {
    body: { append: (...nodes) => elements.push(...nodes) },
    createElement: (tagName) => ({
      tagName,
      textContent: '',
      children: [],
      append(...nodes) {
        this.children.push(...nodes);
      },
      setAttribute() {},
      remove() {},
    }),
  };
  const previousLocale = getLocale();
  setLocale('en', { persist: false });
  const trace = attachControllerConfirmTrace({ document, enabled: true, version: 'v1' });
  const [summary, output] = elements[0].children;
  assert.equal(summary.textContent, 'Controller trace · v1');
  assert.equal(output.textContent, 'Waiting for Confirm input…');

  setLocale('uk', { persist: false });
  assert.equal(summary.textContent, 'Трасування контролера · v1');
  assert.equal(output.textContent, 'Очікуємо натискання «Підтвердити»…');

  trace.record({ time: 1, event: 'start', phase: 'active', buttons: [0] });
  const diagnostic = output.textContent;
  setLocale('en', { persist: false });
  assert.equal(output.textContent, diagnostic);
  assert.equal(trace.snapshot().length, 1);
  trace.destroy();
  setLocale(previousLocale, { persist: false });
});

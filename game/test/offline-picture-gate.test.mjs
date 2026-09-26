import test from 'node:test';
import assert from 'node:assert/strict';
import { withOfflinePictureGate } from '../ui/offline-picture-gate.mjs';

test('human download consent finishes before bounded image acquisition starts', async () => {
  const calls = [];
  let accept;
  const gate = withOfflinePictureGate(
    {
      ensure: async (theme, { signal }) => {
        signal.throwIfAborted();
        calls.push(theme);
        return true;
      },
      cancel() {},
      dispose() {},
      ready: () => false,
    },
    () =>
      new Promise((resolve) => {
        accept = resolve;
      }),
  );
  const preparing = gate.ensure('original');
  assert.deepEqual(calls, []);
  accept();
  assert.equal(await preparing, true);
  assert.deepEqual(calls, ['original']);
});

for (const action of ['cancel', 'dispose'])
  test(`${action} retires a pending consent without acquiring a picture`, async () => {
    let accept,
      acquisitions = 0;
    const gate = withOfflinePictureGate(
      {
        ensure: () => acquisitions++,
        cancel() {},
        dispose() {},
      },
      () =>
        new Promise((resolve) => {
          accept = resolve;
        }),
    );
    const preparing = gate.ensure('original');
    gate[action]();
    accept();
    await assert.rejects(preparing, { name: 'AbortError' });
    assert.equal(acquisitions, 0);
  });

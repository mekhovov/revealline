// Authored regression coverage; automated suites remain explicitly waived.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mountPracticeOfflineControls } from '../../optional-practice/civilian-fpv/offline.mjs';
import { waitFor } from './helpers/wait-for.mjs';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
function fixture(t, { available = true } = {}) {
  const win = new EventTarget(),
    prepareButton = new EventTarget(),
    removeButton = new EventTarget(),
    document = { body: {} },
    dialog = {},
    pending = deferred(),
    statuses = [],
    calls = [],
    records = new Map([
      ['flight-proof', 'retained'],
      ['world-pack', 'retained'],
    ]);
  Object.assign(win, {
    location: new URL(
      'https://example.test/practice/fpv-worlds/releases/v1.0.0/site/optional-practice/fpv-worlds/index.html',
    ),
    isSecureContext: true,
    navigator: available ? { serviceWorker: {} } : {},
    caches: {},
  });
  prepareButton.closest = () => dialog;
  const controls = mountPracticeOfflineControls({
    prepareButton,
    removeButton,
    document,
    window: win,
    packageId: 'fpv-worlds',
    storage: records,
    onStatus: (...args) => statuses.push(args),
    prepare(options) {
      calls.push({ kind: 'prepare', options });
      return pending.promise;
    },
    remove(options) {
      calls.push({ kind: 'remove', options });
      return pending.promise;
    },
  });
  t.after(() => controls.dispose());
  return {
    controls,
    win,
    prepareButton,
    removeButton,
    document,
    dialog,
    pending,
    statuses,
    calls,
    records,
  };
}
const click = (node) => node.dispatchEvent(new Event('click'));

test('offline actions serialize button intent and retain the invoking dialog owner', async (t) => {
  const f = fixture(t);
  click(f.prepareButton);
  click(f.prepareButton);
  click(f.removeButton);
  assert.equal(f.calls.length, 1);
  assert.equal(f.prepareButton.disabled, true);
  assert.equal(f.removeButton.disabled, true);
  assert.equal(f.calls[0].options.progressParent, f.dialog);
  assert.equal(f.calls[0].options.document, f.document);
  assert.equal(f.calls[0].options.packageId, 'fpv-worlds');
  f.pending.resolve(true);
  await waitFor(() => f.statuses.some(([kind]) => kind === 'ready'));
  assert.equal(f.prepareButton.disabled, false);
  assert.equal(f.removeButton.disabled, false);
});

test('native offload uses only the runtime remover and retains world and proof data', async (t) => {
  const f = fixture(t),
    before = [...f.records];
  click(f.removeButton);
  assert.equal(f.calls[0].kind, 'remove');
  assert.equal(f.calls[0].options.packageId, 'fpv-worlds');
  assert.equal(f.calls[0].options.caches, f.win.caches);
  f.pending.resolve();
  await waitFor(() => f.statuses.some(([kind]) => kind === 'removed'));
  assert.deepEqual([...f.records], before);
});

test('unavailable workers disable both native controls without invoking operations', (t) => {
  const f = fixture(t, { available: false });
  assert.equal(f.controls.available, false);
  click(f.prepareButton);
  click(f.removeButton);
  assert.equal(f.calls.length, 0);
  assert.equal(f.prepareButton.disabled, true);
  assert.equal(f.removeButton.disabled, true);
});

test('disposal aborts the download and a late success cannot repaint the removed host', async (t) => {
  const f = fixture(t);
  click(f.prepareButton);
  f.controls.dispose();
  assert.equal(f.calls[0].options.signal.aborted, true);
  f.pending.resolve(true);
  await f.pending.promise;
  await Promise.resolve();
  assert.deepEqual(
    f.statuses.map(([kind]) => kind),
    ['preparing'],
  );
  click(f.removeButton);
  assert.equal(f.calls.length, 1);
});

test('pagehide cancels preparation, reports cancellation and releases busy ownership', async (t) => {
  const f = fixture(t);
  click(f.prepareButton);
  f.win.dispatchEvent(new Event('pagehide'));
  assert.equal(f.calls[0].options.signal.aborted, true);
  f.pending.reject(new DOMException('Cancelled', 'AbortError'));
  await waitFor(() => f.statuses.some(([kind]) => kind === 'cancelled'));
  assert.equal(f.prepareButton.disabled, false);
  assert.equal(f.removeButton.disabled, false);
});

test('failed removal remains retryable and never reports a removed installation', async (t) => {
  const f = fixture(t);
  click(f.removeButton);
  f.pending.reject(new Error('Download is still stopping'));
  await waitFor(() => f.statuses.some(([kind]) => kind === 'error'));
  assert.equal(
    f.statuses.some(([kind]) => kind === 'removed'),
    false,
  );
  assert.equal(f.removeButton.disabled, false);
});

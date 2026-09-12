import { MAX_BACKUP_BYTES } from '../backup.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  exportJSONFile,
  nativePlatform,
  onNativeInactive,
  MAX_EXPORT_BYTES,
} from '../platform.mjs';
import { offlineAvailability, prepareOffline } from '../offline.mjs';

test('native origin detection does not mistake web previews or lookalike hosts for shells', () => {
  for (const [href, expected] of [
    ['revealline://app/game/', 'desktop'],
    ['capacitor://localhost/game/index.html', 'ios'],
    ['https://localhost/game/', null],
    ['http://127.0.0.1:8767/game/', null],
    ['revealline://app.evil/game/', null],
    ['capacitor://localhost:8888/game/', null],
    ['revealline://user@app/game/', null],
    ['file:///game/index.html', null],
  ])
    assert.equal(nativePlatform({ href }), expected);
  assert.equal(nativePlatform({}), null);
});
test('web export requests a local download without claiming it was saved', async () => {
  const actions = [],
    anchor = {
      click() {
        actions.push(['click', this.href, this.download]);
      },
    };
  const result = await exportJSONFile({ score: 10 }, 'progress.json', {
    locationRef: { href: 'https://example.com/game/' },
    documentRef: { createElement: () => anchor },
    URLImpl: {
      createObjectURL(blob) {
        assert.equal(blob.type, 'application/json');
        return 'blob:local';
      },
      revokeObjectURL(url) {
        actions.push(['revoke', url]);
      },
    },
    schedule(callback, delay) {
      assert.equal(delay, 60000);
      callback();
    },
    loadBridge() {
      assert.fail('web must not load native dependencies');
    },
  });
  assert.equal(result.status, 'requested');
  assert.match(result.message, /Check your downloads or Save dialog/);
  assert.deepEqual(actions, [
    ['click', 'blob:local', 'progress.json'],
    ['revoke', 'blob:local'],
  ]);
});
test('iOS export awaits the bridge and retains cancellation and failures', async () => {
  const options = {
    locationRef: { href: 'capacitor://localhost/game/' },
    documentRef: {
      createElement() {
        assert.fail('iOS must not use blob downloads');
      },
    },
    loadBridge: async () => ({
      async exportJSON({ text, name }) {
        assert.deepEqual(JSON.parse(text), { score: 5 });
        assert.equal(name, 'backup.json');
        return { status: 'cancelled', message: 'Share sheet closed without a destination.' };
      },
    }),
  };
  assert.equal((await exportJSONFile({ score: 5 }, 'backup.json', options)).status, 'cancelled');
  await assert.rejects(
    exportJSONFile({}, 'backup.json', {
      ...options,
      loadBridge: async () => {
        throw new Error('bridge failed');
      },
    }),
    /bridge failed/,
  );
});
test('export rejects unsafe filenames before accessing any host API', async () => {
  for (const name of [
    '../save.json',
    'a/b.json',
    'a\\b.json',
    'save.exe',
    'x..json',
    '.json',
    'a\n.json',
  ])
    await assert.rejects(exportJSONFile({}, name), /simple .json filename/);
});
test('native inactivity keeps callback identity and does not attach on web', async () => {
  const callback = () => {},
    remove = () => {};
  assert.equal(
    await onNativeInactive(callback, {
      locationRef: { href: 'capacitor://localhost/game/' },
      loadBridge: async () => ({
        onInactive(fn) {
          assert.equal(fn, callback);
          return remove;
        },
      }),
    }),
    remove,
  );
  const detach = await onNativeInactive(callback, {
    locationRef: { href: 'https://example.com/' },
    loadBridge() {
      assert.fail();
    },
  });
  assert.equal(typeof detach, 'function');
});
test('native apps explain bundled offline files and never install a service worker', async () => {
  for (const href of ['revealline://app/game/', 'capacitor://localhost/game/']) {
    const options = {
      locationRef: { href },
      documentRef: {
        querySelector() {
          assert.fail('no browser cache marker needed');
        },
      },
    };
    const status = offlineAvailability(options);
    assert.equal(status.bundled, true);
    assert.equal(status.available, false);
    await assert.rejects(prepareOffline(options), /includes its game files/);
  }
});

test('transfer envelope fits compact complete backups without pretty-print inflation', async () => {
  assert.ok(MAX_EXPORT_BYTES >= MAX_BACKUP_BYTES);
  const payload = { nested: Array.from({ length: 100 }, () => [1, 2, 3]) };
  await exportJSONFile(payload, 'backup.json', {
    locationRef: { href: 'capacitor://localhost/game/' },
    loadBridge: async () => ({
      exportJSON({ text }) {
        assert.equal(text, JSON.stringify(payload));
        assert.ok(text.length < JSON.stringify(payload, null, 2).length);
        return { status: 'shared', message: 'Shared' };
      },
    }),
  });
});

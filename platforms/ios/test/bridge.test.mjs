import test from 'node:test';
import assert from 'node:assert/strict';
import { createBridge, MAX_EXPORT_BYTES } from '../bridge/bridge-entry.mjs';

function fixture({
  share = async () => ({ activityType: 'com.apple.UIKit.activity.SaveToFiles' }),
  files = [],
  write = null,
  remove = null,
} = {}) {
  const calls = [],
    activeListeners = new Set();
  const runtime = {
    Directory: { Cache: 'CACHE' },
    Encoding: { UTF8: 'utf8' },
    Filesystem: {
      async readdir(options) {
        calls.push(['read', options]);
        return { files };
      },
      async writeFile(options) {
        calls.push(['write', options]);
        if (write) return write(options);
      },
      async getUri(options) {
        calls.push(['uri', options]);
        return { uri: `file:///cache/${options.path}` };
      },
      async deleteFile(options) {
        calls.push(['delete', options]);
        if (remove) return remove(options);
      },
    },
    Share: {
      async canShare() {
        return { value: true };
      },
      async share(options) {
        calls.push(['share', options]);
        return share(options);
      },
    },
    App: {
      async addListener(type, callback) {
        calls.push(['listen', type]);
        activeListeners.add(callback);
        return {
          async remove() {
            calls.push(['remove-listener']);
            activeListeners.delete(callback);
          },
        };
      },
    },
  };
  const bridge = createBridge({
    plugins: async () => runtime,
    now: () => 2000000000000,
    id: () => 'unique-id',
  });
  return { bridge, calls, runtime, activeListeners };
}
const value = {
  name: 'reveal-line-complete-backup.json',
  text: '{"format":"xonix-backup.v1","note":"Україна"}\n',
};

test('native export writes exact UTF-8 JSON to cache, shares a local file, then cleans it', async () => {
  const { bridge, calls } = fixture();
  const result = await bridge.exportJSON(value);
  assert.equal(result.status, 'shared');
  assert.match(result.message, /Check the destination/);
  const written = calls.find(([action]) => action === 'write')[1];
  assert.equal(written.data, value.text);
  assert.equal(written.encoding, 'utf8');
  assert.equal(written.directory, 'CACHE');
  assert.equal(written.recursive, true);
  const shared = calls.find(([action]) => action === 'share')[1];
  assert.equal(shared.title, value.name);
  assert.deepEqual(shared.files, [`file:///cache/${written.path}`]);
  assert.deepEqual(calls.at(-1), ['delete', { path: written.path, directory: 'CACHE' }]);
});
test('native sheet cancellation and an empty destination never report saved/shared', async () => {
  for (const share of [
    async () => ({}),
    async () => ({ activityType: '' }),
    async () => {
      throw new Error('Share canceled');
    },
  ]) {
    const { bridge, calls } = fixture({ share });
    assert.equal((await bridge.exportJSON(value)).status, 'cancelled');
    assert.equal(calls.at(-1)[0], 'delete');
  }
});
test('write/share failures reject, release the busy state and clean any temporary file', async () => {
  for (const options of [
    {
      write: async () => {
        throw new Error('Out of space');
      },
    },
    {
      share: async () => {
        throw new Error('Permission failure');
      },
    },
  ]) {
    const { bridge, calls } = fixture(options);
    await assert.rejects(bridge.exportJSON(value), /Out of space|Permission failure/);
    assert.equal(calls.at(-1)[0], 'delete');
    await assert.rejects(bridge.exportJSON(value), /Out of space|Permission failure/);
  }
});
test('invalid JSON, unsafe destinations and oversized text reject before touching native APIs', async () => {
  const { bridge, calls } = fixture();
  for (const invalid of [
    null,
    {},
    { ...value, name: '../secret.json' },
    { ...value, name: 'file.js' },
    { ...value, name: 'file..json' },
    { ...value, name: 'x'.repeat(200) + '.json' },
    { ...value, text: 'run()' },
    { ...value, text: '' },
    { ...value, text: ' '.repeat(MAX_EXPORT_BYTES + 1) },
  ])
    await assert.rejects(bridge.exportJSON(invalid));
  assert.equal(calls.length, 0);
});
test('one bridge cannot open overlapping share sheets', async () => {
  let finish, entered;
  const sharing = new Promise((resolve) => {
    entered = resolve;
  });
  const { bridge } = fixture({
    share: async () => {
      entered();
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  });
  const first = bridge.exportJSON(value);
  await sharing;
  await assert.rejects(bridge.exportJSON(value), /current share sheet/);
  finish({ activityType: 'files' });
  assert.equal((await first).status, 'shared');
});
test('stale cleanup deletes at most 32 old owned files and leaves fresh/unrelated paths alone', async () => {
  const files = [
    ...Array.from({ length: 40 }, (_, n) => ({
      type: 'file',
      name: `export-1900000000000-id${n}.json`,
    })),
    { type: 'file', name: 'export-2000000000000-recent.json' },
    { type: 'file', name: '../outside.json' },
    { type: 'file', name: 'someone-elses.json' },
    { type: 'directory', name: 'export-1900000000000-directory.json' },
  ];
  const { bridge, calls } = fixture({ files });
  await bridge.exportJSON(value);
  const deleted = calls.filter(([type]) => type === 'delete').map(([, item]) => item.path);
  assert.equal(deleted.length, 33);
  assert.equal(
    deleted
      .slice(0, -1)
      .every((name) => /^revealline-json-exports-v1\/export-1900000000000-id\d+\.json$/.test(name)),
    true,
  );
  assert.equal(
    deleted.some((name) => /recent|outside|elses|directory/.test(name)),
    false,
  );
});
test('cleanup failure reports the remaining cache copy without falsely reversing a completed share', async () => {
  const { bridge } = fixture({
    remove: async () => {
      throw new Error('Busy');
    },
  });
  const result = await bridge.exportJSON(value);
  assert.equal(result.status, 'shared');
  assert.match(result.message, /temporary cache copy remains/);
});
test('lifecycle bridge forwards inactivity only and releases its listener once', async () => {
  const { bridge, calls, activeListeners } = fixture();
  let inactive = 0;
  const remove = await bridge.onInactive(() => inactive++);
  const listener = [...activeListeners][0];
  listener({ isActive: true });
  listener({ isActive: false });
  assert.equal(inactive, 1);
  await remove();
  await remove();
  listener({ isActive: false });
  assert.equal(inactive, 1);
  assert.equal(activeListeners.size, 0);
  assert.equal(calls.filter(([type]) => type === 'remove-listener').length, 1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { claimProfileWriter } from '../profile-writer.mjs';
class Locks {
  held = new Set();
  calls = [];
  async request(key, options, callback) {
    this.calls.push({ key, options });
    if (this.held.has(key)) return callback(null);
    this.held.add(key);
    try {
      return await callback({ name: key, mode: 'exclusive' });
    } finally {
      this.held.delete(key);
    }
  }
}
const turn = () => new Promise((resolve) => setTimeout(resolve, 0));
test('one tab receives a lifetime exclusive lease while a second stays session-only', async () => {
  const locks = new Locks(),
    first = await claimProfileWriter(locks, 'profile'),
    second = await claimProfileWriter(locks, 'profile');
  assert.equal(first.writable, true);
  assert.equal(second.writable, false);
  assert.match(second.reason, /close the other game tab/);
  assert.deepEqual(locks.calls[0], {
    key: 'profile',
    options: { mode: 'exclusive', ifAvailable: true },
  });
  assert.equal(locks.held.has('profile'), true);
  second.release();
  assert.equal(first.writable, true);
  first.release();
  assert.equal(first.writable, false);
  await turn();
  assert.equal(locks.held.size, 0);
});
test('release is idempotent and a later reload can claim without reviving the old lease', async () => {
  const locks = new Locks(),
    old = await claimProfileWriter(locks, 'profile');
  old.release();
  old.release();
  await turn();
  const next = await claimProfileWriter(locks, 'profile');
  assert.equal(next.writable, true);
  assert.equal(old.writable, false);
  old.release();
  assert.equal(next.writable, true);
  next.release();
  await turn();
});
test('profile keys are isolated so source and release can own separate storage channels', async () => {
  const locks = new Locks(),
    source = await claimProfileWriter(locks, 'profile-dev'),
    release = await claimProfileWriter(locks, 'profile-release');
  assert.equal(source.writable, true);
  assert.equal(release.writable, true);
  source.release();
  release.release();
  await turn();
});
test('missing Web Locks and synchronous or asynchronous denial never pretend persistence is available', async () => {
  for (const manager of [
    undefined,
    {},
    {
      request() {
        throw new Error('denied');
      },
    },
    {
      request: async () => {
        throw new Error('denied');
      },
    },
  ]) {
    const lease = await claimProfileWriter(manager, 'profile');
    assert.equal(lease.writable, false);
    assert.match(lease.reason, /session-only/);
    lease.release();
  }
});
test('invalid keys do not call the lock manager or allocate a holding lock', async () => {
  const locks = new Locks();
  for (const key of [null, '', 'x'.repeat(513)])
    assert.equal((await claimProfileWriter(locks, key)).writable, false);
  assert.equal(locks.calls.length, 0);
});
test('unexpected lock request rejection revokes an already returned lease', async () => {
  let reject;
  const manager = {
    request(_key, _options, callback) {
      void callback({ name: 'p' });
      return new Promise((_resolve, no) => {
        reject = no;
      });
    },
  };
  const lease = await claimProfileWriter(manager, 'p');
  assert.equal(lease.writable, true);
  reject(new Error('lost document'));
  await turn();
  assert.equal(lease.writable, false);
  lease.release();
});

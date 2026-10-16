import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { ERRORS } from '@tus/server';
import {
  createTusExpiryCleaner,
  PostgresTusLocker,
  PostgresTusUploadRegistry,
} from '../src/tus-coordination.mjs';

class AdvisoryLockPool {
  constructor() {
    this.clients = new Set();
    this.owners = new Map();
  }

  async connect() {
    const client = new EventEmitter();
    client.released = false;
    client.query = async (sql, parameters = []) => {
      if (sql.startsWith('LISTEN') || sql.startsWith('UNLISTEN')) return { rows: [] };
      if (sql.includes('pg_try_advisory_lock')) {
        const key = parameters.join(':');
        const owner = this.owners.get(key);
        if (!owner) this.owners.set(key, client);
        return { rows: [{ acquired: !owner || owner === client }] };
      }
      if (sql.includes('pg_advisory_unlock')) {
        const key = parameters.join(':');
        const released = this.owners.get(key) === client;
        if (released) this.owners.delete(key);
        return { rows: [{ released }] };
      }
      if (sql.includes('pg_notify')) {
        queueMicrotask(() => {
          for (const target of this.clients)
            target.emit('notification', {
              channel: 'revealline_tus_lock_release',
              payload: parameters[0],
            });
        });
        return { rows: [] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    };
    client.release = () => {
      client.released = true;
      this.clients.delete(client);
    };
    this.clients.add(client);
    return client;
  }
}

test('PostgreSQL tus locks coordinate replicas and ask the current request to drain', async () => {
  const pool = new AdvisoryLockPool();
  const firstLocker = new PostgresTusLocker({ pool, retryDelayMs: 1, acquireTimeoutMs: 200 });
  const secondLocker = new PostgresTusLocker({ pool, retryDelayMs: 1, acquireTimeoutMs: 200 });
  const first = firstLocker.newLock('same-upload');
  const second = secondLocker.newLock('same-upload');
  let releaseRequests = 0;
  await first.lock(new AbortController().signal, async () => {
    releaseRequests += 1;
    await first.unlock();
  });
  await second.lock(new AbortController().signal, () => {});
  assert.equal(releaseRequests, 1);
  await second.unlock();
  assert.equal(pool.owners.size, 0);
  assert.equal(pool.clients.size, 0);
});

test('PostgreSQL tus locks release their pool client after timeout and abort', async () => {
  const pool = new AdvisoryLockPool();
  const locker = new PostgresTusLocker({ pool, retryDelayMs: 1, acquireTimeoutMs: 10 });
  const held = locker.newLock('held');
  await held.lock(new AbortController().signal, () => {});
  const waiting = locker.newLock('held');
  await assert.rejects(
    waiting.lock(new AbortController().signal, () => {}),
    (error) => error === ERRORS.ERR_LOCK_TIMEOUT,
  );
  await held.unlock();
  const aborted = new AbortController();
  aborted.abort();
  await assert.rejects(
    locker.newLock('aborted').lock(aborted.signal, () => {}),
    (error) => error === ERRORS.ABORTED,
  );
  assert.equal(pool.clients.size, 0);
});

test('expiry cleanup claims and removes only one bounded batch', async () => {
  const completed = [];
  const retried = [];
  const registry = {
    async claimExpired({ limit }) {
      assert.equal(limit, 2);
      return [{ uploadId: 'missing' }, { uploadId: 'present' }];
    },
    async completeCleanup({ uploadId }) {
      completed.push(uploadId);
    },
    async retryCleanup({ uploadId }) {
      retried.push(uploadId);
    },
  };
  const removed = [];
  const datastore = {
    async remove(uploadId) {
      if (uploadId === 'missing') throw ERRORS.FILE_NOT_FOUND;
      removed.push(uploadId);
    },
  };
  const locker = {
    newLock() {
      return { async lock() {}, async unlock() {} };
    },
  };
  const clean = createTusExpiryCleaner({
    registry,
    datastore,
    locker,
    batchSize: 2,
    workerId: 'cleaner-a',
  });
  assert.deepEqual(await clean(), { claimed: 2, removed: 2 });
  assert.deepEqual(completed, ['missing', 'present']);
  assert.deepEqual(removed, ['present']);
  assert.deepEqual(retried, []);
});

test('expiry cleanup releases failed claims for a bounded retry', async () => {
  const retried = [];
  const clean = createTusExpiryCleaner({
    registry: {
      async claimExpired() {
        return [{ uploadId: 'busy' }];
      },
      async completeCleanup() {
        assert.fail('failed cleanup cannot complete its claim');
      },
      async retryCleanup(input) {
        retried.push(input);
      },
    },
    datastore: { async remove() {} },
    locker: {
      newLock() {
        return {
          async lock() {
            throw ERRORS.ERR_LOCK_TIMEOUT;
          },
          async unlock() {
            assert.fail('unacquired lock cannot be unlocked');
          },
        };
      },
    },
    retryAfterMs: 1234,
    workerId: 'cleaner-b',
  });
  assert.deepEqual(await clean(), { claimed: 1, removed: 0 });
  assert.deepEqual(retried, [{ uploadId: 'busy', workerId: 'cleaner-b', retryAfterMs: 1234 }]);
});

test('PostgreSQL expiry claims use database time, skip locked rows, and retain ownership', async () => {
  const calls = [];
  const pool = {
    async query(sql, parameters) {
      calls.push({ sql, parameters });
      if (sql.includes('RETURNING upload.upload_id')) return { rows: [{ uploadId: 'upload-a' }] };
      if (sql.includes('RETURNING upload_id')) return { rows: [{ upload_id: 'upload-a' }] };
      return { rows: [] };
    },
  };
  const registry = new PostgresTusUploadRegistry({ pool });
  await registry.register({
    uploadId: 'upload-a',
    submissionId: '00000000-0000-4000-8000-000000000001',
    ownerSubject: 'creator-a',
    expirationMs: 1000,
  });
  assert.deepEqual(await registry.claimExpired({ workerId: 'worker-a', limit: 8, leaseMs: 2000 }), [
    { uploadId: 'upload-a' },
  ]);
  await registry.completeCleanup({ uploadId: 'upload-a', workerId: 'worker-a' });
  await registry.retryCleanup({
    uploadId: 'upload-b',
    workerId: 'worker-a',
    retryAfterMs: 3000,
  });
  assert.match(calls[0].sql, /ON CONFLICT \(upload_id\).*submission_id/su);
  assert.match(calls[1].sql, /clock_timestamp\(\).*FOR UPDATE SKIP LOCKED.*LIMIT \$2/su);
  assert.match(calls[2].sql, /cleanup_owner=\$2/u);
  assert.match(calls[3].sql, /cleanup_owner=\$2/u);
});

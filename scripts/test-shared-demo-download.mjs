import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readQualificationJSONDownload } from './shared-demo-download.mjs';

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
function fixture(overrides = {}) {
  const page = new EventEmitter(),
    calls = [];
  const download = {
    failure: async () => {
      calls.push('completed');
      return null;
    },
    path: async () => {
      calls.push('path');
      return '/owned/export.json';
    },
    cancel: async () => {
      calls.push('cancel');
    },
    delete: async () => {
      calls.push('delete');
    },
    ...overrides,
  };
  return {
    page,
    calls,
    download,
    trigger: () => {
      assert.equal(page.listenerCount('download'), 1, 'Own the event before clicking export.');
      page.emit('download', download);
    },
  };
}

test('validates the completed actual export and retires only its owned artifact', async () => {
  const f = fixture();
  const completion = deferred();
  f.download.failure = () => completion.promise;
  const operation = readQualificationJSONDownload({
    ...f,
    read: async (file, encoding) => {
      assert.equal(file, '/owned/export.json');
      assert.equal(encoding, 'utf8');
      f.calls.push('read');
      return '{"records":[{"proof":{"mode":"acro"}}]}';
    },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(f.calls, [], 'Do not inspect or delete an unfinished download.');
  completion.resolve(null);
  assert.deepEqual(await operation, { records: [{ proof: { mode: 'acro' } }] });
  assert.deepEqual(f.calls, ['path', 'read', 'delete']);
  assert.equal(f.page.listenerCount('download'), 0);
});

test('failed export cannot supply a proof and still retires its artifact', async () => {
  const f = fixture({ failure: async () => 'canceled' });
  await assert.rejects(
    readQualificationJSONDownload({
      ...f,
      read: () => assert.fail('Must not read a failed download.'),
    }),
    /Export download failed: canceled/,
  );
  assert.deepEqual(f.calls, ['cancel', 'delete']);
  assert.equal(f.page.listenerCount('download'), 0);
});

test('pending export times out, is canceled/deleted, and cannot continue reading later', async () => {
  const completion = deferred();
  const f = fixture({ failure: () => completion.promise });
  f.download.cancel = async () => {
    f.calls.push('cancel');
    completion.resolve('canceled');
  };
  await assert.rejects(
    readQualificationJSONDownload({
      ...f,
      timeoutMs: 15,
      read: () => assert.fail('Timed-out continuation must not read.'),
    }),
    /Export download exceeded 15ms/,
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(f.calls, ['cancel', 'delete']);
  assert.equal(f.page.listenerCount('download'), 0);
});

test('missing download event and trigger failure remove the temporary listener', async () => {
  const page = new EventEmitter();
  await assert.rejects(
    readQualificationJSONDownload({ page, trigger: () => {}, timeoutMs: 15 }),
    /Export download exceeded 15ms/,
  );
  assert.equal(page.listenerCount('download'), 0);
  await assert.rejects(
    readQualificationJSONDownload({
      page,
      trigger: () => {
        throw new Error('Click failed.');
      },
    }),
    /Click failed/,
  );
  assert.equal(page.listenerCount('download'), 0);
});

test('invalid downloaded JSON fails verification after retiring the owned artifact', async () => {
  const f = fixture();
  await assert.rejects(
    readQualificationJSONDownload({ ...f, read: async () => '{broken' }),
    SyntaxError,
  );
  assert.deepEqual(f.calls, ['completed', 'path', 'cancel', 'delete']);
});

test('stalled artifact cleanup is bounded and preserves the original download failure', async () => {
  const f = fixture({
    failure: async () => 'interrupted',
    cancel: () => new Promise(() => {}),
    delete: () => new Promise(() => {}),
  });
  await assert.rejects(readQualificationJSONDownload({ ...f, cleanupTimeoutMs: 15 }), (error) => {
    assert.ok(error instanceof AggregateError);
    assert.match(error.cause.message, /interrupted/);
    assert.match(error.errors[1].message, /Export artifact cleanup exceeded 15ms/);
    return true;
  });
  assert.equal(f.page.listenerCount('download'), 0);
});

test('a falsy rejected reason still fails and cancels the owned download', async () => {
  const f = fixture({ failure: () => Promise.reject(undefined) });
  let rejected = false;
  try {
    await readQualificationJSONDownload({
      ...f,
      read: () => assert.fail('Must not read a rejected download.'),
    });
  } catch (error) {
    rejected = true;
    assert.equal(error, undefined);
  }
  assert.equal(rejected, true);
  assert.deepEqual(f.calls, ['cancel', 'delete']);
  assert.equal(f.page.listenerCount('download'), 0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { observePreviewReadiness } from '../studio/preview-readiness.mjs';

function fixture() {
  let clock = 0,
    current = true,
    callback,
    reads = 0,
    throws = false;
  const document = {
    URL: 'https://fixture/game/?practice=1&revision=studio-1',
    documentElement: { dataset: { bootState: 'loading' } },
  };
  const events = [],
    cancelled = [];
  const stop = observePreviewReadiness({
    expectedURL: document.URL,
    readDocument: () => {
      reads++;
      if (throws) throw new Error('inaccessible');
      return document;
    },
    isCurrent: () => current,
    notify: (state) => events.push(state),
    now: () => clock,
    schedule: (fn, ms) => {
      assert.equal(ms, 250);
      callback = fn;
      return 17;
    },
    cancel: (id) => cancelled.push(id),
  });
  return {
    document,
    events,
    cancelled,
    stop,
    tick: (ms = 250) => {
      clock += ms;
      callback();
    },
    expire: () => {
      current = false;
    },
    inaccessible: () => {
      throws = true;
    },
    reads: () => reads,
  };
}

test('Studio slow preview warns once, then accepts later exact-document readiness', () => {
  const f = fixture();
  f.tick(19999);
  assert.deepEqual(f.events, []);
  f.tick(1);
  assert.deepEqual(f.events, ['slow']);
  assert.deepEqual(f.cancelled, []);
  f.tick(20000);
  assert.deepEqual(f.events, ['slow']);
  f.document.documentElement.dataset.bootState = 'ready';
  f.tick();
  assert.deepEqual(f.events, ['slow', 'ready']);
  assert.deepEqual(f.cancelled, [17]);
  f.tick();
  f.stop();
  assert.deepEqual(f.events, ['slow', 'ready']);
  assert.deepEqual(f.cancelled, [17]);
});

test('Studio accepts ready without depending on the iframe load event', () => {
  const f = fixture();
  f.document.documentElement.dataset.bootState = 'ready';
  f.tick();
  assert.deepEqual(f.events, ['ready']);
  assert.deepEqual(f.cancelled, [17]);
});

test('Studio terminal boot failure settles even after a slow warning', () => {
  const f = fixture();
  f.tick(20000);
  f.document.documentElement.dataset.bootState = 'failed';
  f.tick();
  f.document.documentElement.dataset.bootState = 'ready';
  f.tick();
  assert.deepEqual(f.events, ['slow', 'failed']);
  assert.deepEqual(f.cancelled, [17]);
});

test('stale, blank and foreign preview documents cannot report ready', () => {
  for (const URL of [
    'about:blank',
    'https://fixture/game/?practice=1&revision=studio-0',
    'https://other.test/game/?practice=1&revision=studio-1',
  ]) {
    const f = fixture();
    f.document.URL = URL;
    f.document.documentElement.dataset.bootState = 'ready';
    f.tick();
    assert.deepEqual(f.events, []);
    f.tick(20000);
    assert.deepEqual(f.events, ['slow']);
    f.stop();
  }
});

test('replaced previews stop before reading or notifying, including queued callbacks', () => {
  const f = fixture();
  f.expire();
  f.document.documentElement.dataset.bootState = 'ready';
  f.tick();
  f.tick();
  assert.equal(f.reads(), 0);
  assert.deepEqual(f.events, []);
  assert.deepEqual(f.cancelled, [17]);
});

test('closing or leaving Studio cancels the owned monitor and late callbacks', () => {
  const f = fixture();
  f.tick(20000);
  f.stop();
  const reads = f.reads();
  f.document.documentElement.dataset.bootState = 'ready';
  f.tick();
  assert.equal(f.reads(), reads);
  assert.deepEqual(f.events, ['slow']);
  assert.deepEqual(f.cancelled, [17]);
});

test('inaccessible frame remains unknown and does not throw or claim successful boot', () => {
  const f = fixture();
  f.inaccessible();
  f.tick(20000);
  assert.deepEqual(f.events, ['slow']);
  f.stop();
});

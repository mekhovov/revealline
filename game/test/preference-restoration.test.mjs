import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { attachPreferenceRestoration } from '../ui/preference-restoration.mjs';
import { Events } from './helpers/couch-dom.mjs';

function fixture(t) {
  const host = new Events(),
    timers = new Map(),
    cancelled = [],
    painted = [];
  let serial = 0,
    snapshot = Object.freeze({ value: 'current' }),
    onRead = () => {},
    onPaint = () => {};
  host.setTimeout = function (callback, ms) {
    assert.equal(this, host);
    assert.equal(ms, 0);
    const id = ++serial;
    timers.set(id, callback);
    return id;
  };
  host.clearTimeout = function (id) {
    assert.equal(this, host);
    cancelled.push(id);
    timers.delete(id);
  };
  const owner = attachPreferenceRestoration({
    window: host,
    getSnapshot: () => {
      const captured = snapshot;
      onRead();
      return captured;
    },
    render: (state) => {
      painted.push(state);
      onPaint();
    },
  });
  t.after(() => owner.dispose());
  return {
    host,
    owner,
    timers,
    cancelled,
    painted,
    set snapshot(value) {
      snapshot = Object.freeze({ value });
    },
    set onRead(value) {
      onRead = value;
    },
    set onPaint(value) {
      onPaint = value;
    },
    flush() {
      for (const [id, callback] of [...timers]) {
        timers.delete(id);
        callback();
      }
    },
  };
}

test('restoration renders immediately and its deferred task reads newer owner intent', (t) => {
  const f = fixture(t);
  assert.equal(f.painted.length, 0, 'Existing subscription owns initial rendering.');
  f.host.emit('pageshow', { persisted: true });
  assert.deepEqual(f.painted, [{ value: 'current' }]);
  f.snapshot = 'new explicit intent';
  f.flush();
  assert.deepEqual(f.painted, [{ value: 'current' }, { value: 'new explicit intent' }]);
  assert.equal(f.timers.size, 0);
});

test('superseded pageshow work cannot repaint or erase the new deferred task', (t) => {
  const f = fixture(t);
  f.host.emit('pageshow', { persisted: false });
  const stale = [...f.timers.values()][0];
  f.snapshot = 'second return';
  f.host.emit('pageshow', { persisted: true });
  assert.equal(f.cancelled.length, 1);
  stale();
  assert.deepEqual(f.painted, [{ value: 'current' }, { value: 'second return' }]);
  assert.equal(f.timers.size, 1);
  f.flush();
  assert.deepEqual(f.painted.at(-1), { value: 'second return' });
  assert.equal(f.painted.length, 3);
});

test('frozen departure rejects already-queued callbacks and permits a later fresh return', (t) => {
  const f = fixture(t);
  f.host.emit('pageshow', { persisted: true });
  const stale = [...f.timers.values()][0];
  f.host.emit('pagehide', { persisted: true });
  f.snapshot = 'frozen owner';
  stale();
  assert.equal(f.painted.length, 1);
  assert.equal(f.timers.size, 0);
  f.host.emit('pageshow', { persisted: true });
  f.flush();
  assert.equal(f.painted.length, 3);
  assert.deepEqual(f.painted.at(-1), { value: 'frozen owner' });
});

for (const terminal of ['dispose', 'pagehide'])
  test(`${terminal} retires listeners and captured timer callbacks without reading disposed authority`, (t) => {
    const f = fixture(t);
    f.host.emit('pageshow', { persisted: true });
    const stale = [...f.timers.values()][0];
    if (terminal === 'dispose') f.owner.dispose();
    else f.host.emit('pagehide', { persisted: false });
    f.onRead = () => assert.fail('Retired view must not consult its authority.');
    stale();
    f.host.emit('pageshow', { persisted: true });
    f.flush();
    f.owner.dispose();
    assert.equal(f.painted.length, 1);
    assert.equal(f.timers.size, 0);
    assert.equal(f.host.listeners.get('pageshow')?.size ?? 0, 0);
    assert.equal(f.host.listeners.get('pagehide')?.size ?? 0, 0);
  });

test('departure while reading a snapshot prevents its paint and deferred scheduling', (t) => {
  const f = fixture(t);
  f.onRead = () => f.host.emit('pagehide', { persisted: true });
  f.host.emit('pageshow', { persisted: true });
  assert.deepEqual(f.painted, []);
  assert.equal(f.timers.size, 0);
});

test('disposal during rendering prevents a deferred callback from being created', (t) => {
  const f = fixture(t);
  f.onPaint = () => f.owner.dispose();
  f.host.emit('pageshow', { persisted: true });
  assert.equal(f.painted.length, 1);
  assert.equal(f.timers.size, 0);
});

test('a reentrant return from rendering leaves only the newer return scheduled', (t) => {
  const f = fixture(t);
  let replaced = false;
  f.onPaint = () => {
    if (replaced) return;
    replaced = true;
    f.snapshot = 'newer return';
    f.host.emit('pageshow', { persisted: true });
  };
  f.host.emit('pageshow', { persisted: true });
  assert.equal(f.timers.size, 1);
  f.flush();
  assert.deepEqual(f.painted, [
    { value: 'current' },
    { value: 'newer return' },
    { value: 'newer return' },
  ]);
});

test('a host without timer methods uses the global zero-delay task queue', async (t) => {
  const host = new Events(),
    painted = [];
  let value = 'current';
  const owner = attachPreferenceRestoration({
    window: host,
    getSnapshot: () => value,
    render: (state) => painted.push(state),
  });
  t.after(() => owner.dispose());
  host.emit('pageshow', { persisted: true });
  value = 'latest';
  await delay(0);
  assert.deepEqual(painted, ['current', 'latest']);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { attachHuntFeedbackLayout } from '../ui/hunt-feedback-layout.mjs';

function fixture({
  observer = true,
  legacyObserve = false,
  id = 'hunt-feedback',
  arena = true,
} = {}) {
  const frames = new Map(),
    listeners = new Map(),
    values = new Map(),
    writes = [];
  let serial = 0,
    reads = 0,
    height = 12,
    resize,
    mutation;
  const body = {
    style: {
      getPropertyValue: (name) => values.get(name) ?? '',
      setProperty: (name, value) => {
        values.set(name, value);
        writes.push(value);
      },
      removeProperty: (name) => values.delete(name),
    },
  };
  const container = {
    id,
    ownerDocument: { body },
    closest: () => arena,
    getBoundingClientRect() {
      reads++;
      return { height };
    },
  };
  const window = {
    requestAnimationFrame(fn) {
      const id = ++serial;
      frames.set(id, fn);
      return id;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
    addEventListener: (type, fn) => listeners.set(type, fn),
    removeEventListener: (type) => listeners.delete(type),
    MutationObserver: class {
      constructor(callback) {
        this.callback = callback;
        mutation = this;
      }
      observe() {}
      disconnect() {
        this.closed = true;
      }
    },
  };
  if (observer)
    window.ResizeObserver = class {
      constructor(callback) {
        this.callback = callback;
        resize = this;
      }
      observe(target, options) {
        if (legacyObserve && options) throw new TypeError('No options');
        this.target = target;
        this.options = options;
      }
      disconnect() {
        this.closed = true;
      }
    };
  const close = attachHuntFeedbackLayout({ container, window });
  return {
    body,
    container,
    frames,
    listeners,
    writes,
    close,
    get resize() {
      return resize;
    },
    get mutation() {
      return mutation;
    },
    get reads() {
      return reads;
    },
    set height(value) {
      height = value;
    },
    notify(size) {
      resize.callback([{ target: container, borderBoxSize: size }]);
    },
    flush() {
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach((fn) => fn());
    },
  };
}

test('native box observations reserve padded height without layout reads or mutation watching', () => {
  const f = fixture();
  assert.deepEqual(f.resize.options, { box: 'border-box' });
  assert.equal(f.frames.size, 0, 'the observer supplies the initial layout');
  assert.equal(f.mutation, undefined);
  assert.equal(f.listeners.size, 0);
  f.notify([{ blockSize: 24.2, inlineSize: 320 }]);
  f.notify([{ blockSize: 31.1, inlineSize: 320 }]);
  assert.equal(f.frames.size, 1);
  f.flush();
  assert.deepEqual(f.writes, ['32px']);
  f.notify([{ blockSize: 31.1, inlineSize: 320 }]);
  f.flush();
  assert.deepEqual(f.writes, ['32px'], 'unchanged layout does not rewrite page style');
  f.notify([{ blockSize: 0, inlineSize: 0 }]);
  f.flush();
  assert.deepEqual(f.writes, ['32px', '0px'], 'hidden feedback frees its reserved height');
  assert.equal(f.reads, 0);
  f.close();
});

test('object-shaped box sizes and older observe signatures remain supported', () => {
  const f = fixture({ legacyObserve: true });
  f.notify({ blockSize: 17.3, inlineSize: 250 });
  f.flush();
  assert.deepEqual(f.writes, ['18px']);
  assert.equal(f.reads, 0);
  f.close();
});

test('observers without border sizes measure only when notified and preserve padding', () => {
  const f = fixture();
  f.height = 28.4;
  f.notify(undefined);
  f.notify([]);
  f.flush();
  assert.deepEqual(f.writes, ['29px']);
  assert.equal(f.reads, 1);
  f.notify([{ blockSize: NaN }]);
  f.flush();
  assert.equal(f.reads, 2);
  assert.deepEqual(f.writes, ['29px']);
  f.close();
});

test('legacy fallback coalesces text, style and viewport changes and releases ownership', () => {
  const f = fixture({ observer: false });
  f.mutation.callback([]);
  f.listeners.get('resize')();
  f.height = 19.5;
  assert.equal(f.frames.size, 1);
  f.flush();
  assert.deepEqual(f.writes, ['20px']);
  assert.equal(f.reads, 1);
  f.mutation.callback([]);
  f.close();
  assert.equal(f.frames.size, 0);
  assert.equal(f.mutation.closed, true);
  assert.equal(f.listeners.size, 0);
  assert.equal(f.body.style.getPropertyValue('--hunt-feedback-height'), '');
  f.mutation.callback([]);
  assert.equal(f.frames.size, 0);
});

test('disposal and unrelated observations cannot rewrite a released rail', () => {
  const f = fixture();
  f.resize.callback([{ target: {}, borderBoxSize: [{ blockSize: 100 }] }]);
  assert.equal(f.frames.size, 0);
  f.notify([{ blockSize: 40 }]);
  f.close();
  f.notify([{ blockSize: 70 }]);
  f.flush();
  assert.equal(f.resize.closed, true);
  assert.deepEqual(f.writes, []);
  assert.equal(f.reads, 0);
});

test('shared reaction panels outside the Solo arena do not acquire layout observers', () => {
  for (const options of [{ id: 'coop-hunt-feedback' }, { arena: false }]) {
    const f = fixture(options);
    assert.equal(f.resize, undefined);
    assert.equal(f.mutation, undefined);
    assert.equal(f.frames.size, 0);
    f.close();
  }
});

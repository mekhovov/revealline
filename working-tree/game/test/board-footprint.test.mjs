import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoardFootprints, fitBoardRect } from '../couch/board-footprint.mjs';

test('the whole 4:3 or 2:1 bitmap fits independently of its element slot', () => {
  assert.deepEqual(fitBoardRect(600, 180, 768, 576), { width: 240, height: 180 });
  assert.deepEqual(fitBoardRect(600, 180, 1152, 576), { width: 360, height: 180 });
  assert.deepEqual(fitBoardRect(320, 300, 768, 576), { width: 320, height: 240 });
  assert.deepEqual(fitBoardRect(240, 180, 1152, 576), { width: 240, height: 120 });
  assert.deepEqual(fitBoardRect(601.5, 180.75, 768, 576), { width: 241, height: 180.75 });
  for (const unavailable of [0, -1, NaN, Infinity, undefined]) {
    assert.deepEqual(fitBoardRect(unavailable, 180, 768, 576), { width: 0, height: 0 });
    assert.deepEqual(fitBoardRect(600, unavailable, 768, 576), { width: 0, height: 0 });
    assert.deepEqual(fitBoardRect(600, 180, unavailable, 576), { width: 0, height: 0 });
    assert.deepEqual(fitBoardRect(600, 180, 768, unavailable), { width: 0, height: 0 });
  }
});

function fixture(observe = true) {
  const window = new EventTarget(),
    observers = [],
    canvases = [768, 1152].map((width) => ({
      width,
      height: 576,
      parentElement: { clientWidth: 600, clientHeight: 180 },
      style: {},
    }));
  class ResizeObserver {
    constructor(callback) {
      this.callback = callback;
      this.targets = [];
      this.disconnects = 0;
      observers.push(this);
    }
    observe(target) {
      this.targets.push(target);
    }
    disconnect() {
      this.disconnects++;
    }
    deliver(index, width, height) {
      this.callback([{ target: canvases[index].parentElement, contentRect: { width, height } }]);
    }
  }
  const owner = createBoardFootprints(canvases, {
    window,
    ResizeObserver: observe ? ResizeObserver : undefined,
  });
  const emit = (type, persisted = false) => {
    const event = new Event(type);
    Object.defineProperty(event, 'persisted', { value: persisted });
    window.dispatchEvent(event);
  };
  return { window, canvases, observers, owner, emit };
}

test('one seat resizing never substitutes the other seat or changes bitmap geometry', () => {
  const { canvases, observers, owner } = fixture();
  const geometry = canvases.map(({ width, height }) => ({ width, height }));
  assert.equal(owner.width(0), 240);
  assert.equal(owner.width(1), 360);
  observers[0].deliver(0, 300, 100);
  assert.ok(Math.abs(owner.width(0) - 400 / 3) < 1e-10);
  assert.equal(owner.width(1), 360);
  assert.deepEqual(
    canvases.map(({ width, height }) => ({ width, height })),
    geometry,
  );
  assert.equal(canvases[1].style.width, '360px');
  owner.dispose();
});

test('observer delivery does not read layout, duplicate writes or retain a hidden scale', () => {
  const { canvases, observers, owner } = fixture();
  let writes = 0;
  canvases[0].style = new Proxy(canvases[0].style, {
    set(target, key, value) {
      writes++;
      target[key] = value;
      return true;
    },
  });
  Object.defineProperty(canvases[0].parentElement, 'clientWidth', {
    get() {
      throw new Error('observer callback must consume its delivered content box');
    },
  });
  observers[0].deliver(0, 600, 180);
  assert.equal(writes, 0);
  observers[0].deliver(0, 0, 0);
  assert.equal(owner.width(0), undefined);
  assert.equal(canvases[0].style.width, '0px');
  observers[0].deliver(0, 600, 180);
  assert.equal(owner.width(0), 240);
  assert.equal(writes, 4);
  owner.dispose();
});

test('cached-page restoration rejects old callbacks and measures again without resuming play', () => {
  const { canvases, observers, owner, emit } = fixture();
  const previous = observers[0];
  assert.equal(owner.observesResize, true);
  emit('pagehide', true);
  assert.equal(owner.observesResize, false);
  previous.deliver(0, 900, 500);
  assert.equal(owner.width(0), 240);
  canvases[0].parentElement.clientHeight = 120;
  emit('pageshow', true);
  assert.equal(owner.observesResize, true);
  assert.equal(owner.width(0), 160);
  previous.deliver(0, 900, 500);
  assert.equal(owner.width(0), 160);
  assert.equal(observers.length, 2);
  observers[1].deliver(0, 300, 90);
  assert.equal(owner.width(0), 120);
  emit('pagehide');
  assert.equal(owner.observesResize, false);
  const styles = canvases.map((canvas) => ({ ...canvas.style }));
  observers[1].deliver(0, 900, 500);
  emit('pageshow');
  emit('resize');
  owner.refresh();
  owner.dispose();
  assert.equal(observers.length, 2);
  assert.deepEqual(
    canvases.map((canvas) => canvas.style),
    styles,
  );
});

test('fractional deliveries do not rewrite CSS values after browser serialization', () => {
  const { canvases, observers, owner } = fixture();
  let writes = 0;
  canvases[0].style = new Proxy(
    {},
    {
      set(target, key, value) {
        writes++;
        target[key] = `${Number.parseFloat(value).toFixed(3)}px`;
        return true;
      },
    },
  );
  observers[0].deliver(0, 600, 100);
  assert.equal(canvases[0].style.width, '133.333px');
  const firstWrites = writes;
  observers[0].deliver(0, 600, 100);
  assert.equal(writes, firstWrites);
  assert.equal(firstWrites, 2);
  owner.dispose();
});

test('explicit geometry and resize reconciliation work without ResizeObserver', () => {
  const { canvases, owner, emit } = fixture(false);
  assert.equal(owner.observesResize, false);
  canvases[0].width = 1152;
  owner.refresh();
  assert.equal(owner.width(0), 360);
  canvases[1].parentElement.clientWidth = 250;
  emit('resize');
  assert.equal(owner.width(1), 250);
  owner.dispose();
});

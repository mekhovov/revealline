import test from 'node:test';
import assert from 'node:assert/strict';
import { attachMissionPicker } from '../ui/mission-picker.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';

// Actual picker/navigation modules with measured geometry. This models focus
// events; native Tab, CSS snapping and painted outlines need browser review.
function fixture(t) {
  const doc = new Document(),
    view = new Events(),
    frames = new Map(),
    cancelled = [],
    observers = [];
  let frameId = 0;
  Object.assign(view, doc.defaultView, {
    requestAnimationFrame(fn) {
      frames.set(++frameId, fn);
      return frameId;
    },
    cancelAnimationFrame(id) {
      if (frames.has(id)) cancelled.push(frames.get(id));
      frames.delete(id);
    },
    ResizeObserver: class {
      constructor(fn) {
        this.fn = fn;
        this.nodes = [];
        observers.push(this);
      }
      observe(node) {
        this.nodes.push(node);
      }
      disconnect() {
        this.nodes = [];
      }
    },
  });
  doc.defaultView = view;
  const make = (tag, id, parent, className) => {
    const node = doc.createElement(tag);
    node.id = id;
    if (className) node.className = className;
    parent.append(node);
    return node;
  };
  const dialog = make('dialog', 'shell-missions', doc.body);
  dialog.open = true;
  dialog.scrollTop = 219.5;
  const deck = make('div', '', dialog, 'flight-deck'),
    pack = make('select', 'pack-select', deck),
    levels = make('select', 'level-select', deck),
    missions = make('div', 'missions', deck),
    status = make('p', 'content-select-status', deck);
  status.textContent = 'Ready';
  for (const value of ['base', 'pressure', 'signal', 'old-a', 'old-b', 'old-c']) {
    const option = make('option', '', pack);
    option.value = value;
    option.label = value;
  }
  pack.value = 'base';
  let changes = 0;
  pack.addEventListener('change', () => changes++);
  const api = attachMissionPicker({ document: doc, archivedIds: ['old-a', 'old-b', 'old-c'] });
  t.after(() => api.destroy());
  const older = doc.getElementById('mission-picker-older');
  older.open = true;
  const rails = ['mission-picker-cards', 'mission-picker-older-cards'].map((id) => {
    const rail = doc.getElementById(id);
    rail.clientLeft = 0;
    rail.clientWidth = 342;
    rail.scrollWidth = 572;
    rail.getBoundingClientRect = () => ({ left: 24, right: 366, top: 250, bottom: 420 });
    rail.children.forEach((card, index) => {
      card.offset = 8 + index * 188;
      card.width = 180;
      card.getBoundingClientRect = () => {
        const left = 24 + rail.clientLeft + card.offset - rail.scrollLeft;
        return {
          left,
          right: left + card.width,
          top: 258,
          bottom: 398,
          width: card.width,
          height: 140,
        };
      };
    });
    return rail;
  });
  const flush = () => {
    const pending = [...frames.values()];
    frames.clear();
    for (const fn of pending) fn();
  };
  flush();
  return {
    doc,
    view,
    dialog,
    pack,
    levels,
    missions,
    status,
    api,
    older,
    rails,
    frames,
    cancelled,
    flush,
    changes: () => changes,
    resize() {
      for (const observer of observers) if (observer.nodes.length) observer.fn([]);
    },
    observerCount: () => observers.filter((observer) => observer.nodes.length).length,
  };
}
function clear(rail, card) {
  const box = rail.getBoundingClientRect(),
    left = box.left + rail.clientLeft,
    rect = card.getBoundingClientRect();
  assert.ok(rect.left - 7 >= left, 'Complete left focus paint clears the inner rail');
  assert.ok(
    rect.right + 7 <= left + rail.clientWidth,
    'Complete right focus paint clears the inner rail',
  );
}
for (const railIndex of [0, 1]) {
  test(`rail ${railIndex}: first/interior/last focus in both directions retains selection and outer reading position`, (t) => {
    const f = fixture(t),
      rail = f.rails[railIndex];
    for (const index of [0, 1, 2, 1, 0]) {
      rail.children[index].focus();
      f.flush();
      clear(rail, rail.children[index]);
      assert.equal(f.doc.activeElement, rail.children[index]);
      assert.equal(f.pack.value, 'base');
      assert.equal(f.changes(), 0);
      assert.equal(f.dialog.scrollTop, 219.5);
    }
  });
}
test('recorded forward card x216…396 gets nearest clearance against the x24…366 rail', (t) => {
  const f = fixture(t),
    rail = f.rails[0],
    card = rail.children[1];
  card.offset = 192;
  card.focus();
  f.flush();
  assert.equal(rail.scrollLeft, 38);
  clear(rail, card);
});
test('rail borders use client geometry and a fully visible card does not move', (t) => {
  const f = fixture(t),
    rail = f.rails[0],
    card = rail.children[1];
  rail.clientLeft = 3;
  rail.clientWidth = 336;
  card.focus();
  f.flush();
  clear(rail, card);
  const position = rail.scrollLeft;
  f.resize();
  f.flush();
  assert.equal(rail.scrollLeft, position);
});
test('actual controller movement reveals a chapter without activating it', (t) => {
  const f = fixture(t),
    rail = f.rails[0],
    nav = attachControllerNavigation({
      document: f.doc,
      getScope: () => 'missions',
      getRoot: () => f.dialog,
    });
  t.after(() => nav.destroy());
  rail.children[0].focus();
  nav.engage();
  nav.handle({ direction: 'right' });
  f.flush();
  assert.equal(f.doc.activeElement, rail.children[1]);
  clear(rail, rail.children[1]);
  assert.equal(f.changes(), 0);
  assert.equal(f.pack.value, 'base');
});
test('resize reconciles the focused card, while later manual scroll is not continually undone', (t) => {
  const f = fixture(t),
    rail = f.rails[0],
    card = rail.children[1];
  card.focus();
  f.flush();
  rail.clientWidth = 250;
  f.view.emit('resize');
  f.flush();
  clear(rail, card);
  rail.scrollLeft += 40;
  const intentional = rail.scrollLeft;
  rail.emit('scroll');
  f.flush();
  assert.equal(rail.scrollLeft, intentional);
});
test('desktop nonoverflowing rails keep the vertical list position unchanged', (t) => {
  const f = fixture(t),
    rail = f.rails[0];
  rail.scrollWidth = rail.clientWidth;
  rail.children[2].focus();
  f.flush();
  assert.equal(rail.scrollLeft, 0);
  assert.equal(f.dialog.scrollTop, 219.5);
});
test('oversized card uses one stable leading edge instead of oscillating each resize', (t) => {
  const f = fixture(t),
    rail = f.rails[0],
    card = rail.children[1];
  rail.clientWidth = 160;
  card.focus();
  f.flush();
  assert.equal(card.getBoundingClientRect().left, 32);
  const position = rail.scrollLeft;
  f.resize();
  f.flush();
  f.resize();
  f.flush();
  assert.equal(rail.scrollLeft, position);
});
for (const cause of [
  'closed-dialog',
  'closed-older',
  'hidden',
  'inert',
  'disabled',
  'removed',
  'outside-focus',
  'hidden-page',
]) {
  test(`pending layout leaves ${cause} ownership untouched`, (t) => {
    const f = fixture(t),
      rail = f.rails[1],
      card = rail.children[1];
    card.focus();
    if (cause === 'closed-dialog') f.dialog.open = false;
    if (cause === 'closed-older') f.older.open = false;
    if (cause === 'hidden') rail.hidden = true;
    if (cause === 'inert') f.older.inert = true;
    if (cause === 'disabled') card.disabled = true;
    if (cause === 'removed') card.remove();
    if (cause === 'outside-focus') f.doc.activeElement = f.doc.body;
    if (cause === 'hidden-page') f.doc.hidden = true;
    const active = f.doc.activeElement;
    f.flush();
    assert.equal(rail.scrollLeft, 0);
    assert.equal(f.doc.activeElement, active);
  });
}
test('newer focus replaces an older queued owner without scrolling its old rail', (t) => {
  const f = fixture(t);
  f.rails[0].children[2].focus();
  f.rails[1].children[1].focus();
  f.flush();
  assert.equal(f.rails[0].scrollLeft, 0);
  clear(f.rails[1], f.rails[1].children[1]);
});
test('blur and persisted pagehide retire old callbacks without clearing a newer restored job', (t) => {
  const f = fixture(t),
    rail = f.rails[0],
    card = rail.children[1];
  card.focus();
  f.doc.focused = false;
  f.view.emit('blur');
  f.doc.focused = true;
  f.view.emit('focus');
  for (const fn of f.cancelled.splice(0)) fn();
  f.flush();
  clear(rail, card);
  rail.scrollLeft = 0;
  f.view.emit('resize');
  f.view.emit('pagehide', { persisted: true });
  f.flush();
  assert.equal(rail.scrollLeft, 0);
  f.view.emit('pageshow', { persisted: true });
  for (const fn of f.cancelled.splice(0)) fn();
  f.flush();
  clear(rail, card);
});
test('terminal pagehide and destroy remove listeners, observer and stale callbacks', (t) => {
  for (const departure of ['pagehide', 'destroy']) {
    const f = fixture(t),
      rail = f.rails[0];
    rail.children[1].focus();
    const stale = [...f.frames.values()];
    if (departure === 'pagehide') f.view.emit('pagehide', { persisted: false });
    else f.api.destroy();
    for (const fn of stale) fn();
    f.view.emit('pageshow', { persisted: true });
    f.view.emit('resize');
    f.flush();
    assert.equal(rail.scrollLeft, 0);
    assert.equal(f.observerCount(), 0);
    for (const type of ['resize', 'focus', 'blur', 'pagehide', 'pageshow'])
      assert.equal(f.view.listeners.get(type)?.size || 0, 0, `${type} listener removed`);
  }
});
test('invalid or zero client geometry does not write a fabricated scroll offset', (t) => {
  const f = fixture(t),
    rail = f.rails[0];
  for (const width of [0, NaN, Infinity]) {
    rail.clientWidth = width;
    rail.children[1].focus();
    f.flush();
    assert.equal(rail.scrollLeft, 0);
  }
});

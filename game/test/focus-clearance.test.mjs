import test from 'node:test';
import assert from 'node:assert/strict';
import { attachFocusClearance } from '../ui/focus-clearance.mjs';

// Recorded sticky-header/footer geometry with a scrolling form. No raster claim.
function fixture({
  headingBottom = 294.359,
  footerTop = 700,
  height = 844,
  includeControlLabel = false,
} = {}) {
  const queue = [],
    events = new Map();
  let resized;
  const doc = { hidden: false, hasFocus: () => true };
  const container = {
    open: true,
    style: {},
    scrollTop: 200,
    contains(node) {
      return node?.parent === this || node?.parent?.parent === this;
    },
    getBoundingClientRect: () => ({ top: 16, bottom: height - 16 }),
    addEventListener: (type, fn) => events.set(`container:${type}`, fn),
    removeEventListener: (type) => events.delete(`container:${type}`),
  };
  const region = (top, bottom) => ({
    parent: container,
    hidden: false,
    contains(node) {
      return node?.parent === this;
    },
    getClientRects() {
      return this.hidden ? [] : [{}];
    },
    getBoundingClientRect: () => ({ top, bottom }),
  });
  const heading = region(16, headingBottom),
    footer = region(footerTop, height - 16);
  const control = {
    parent: container,
    disabled: false,
    hidden: false,
    absoluteTop: 474.344,
    height: 45,
    getClientRects() {
      return this.hidden ? [] : [{}];
    },
    getBoundingClientRect() {
      const top = this.absoluteTop - container.scrollTop;
      return { top, bottom: top + this.height };
    },
    focus() {
      throw new Error('Layout must not move focus');
    },
  };
  const label = region(0, 0);
  label.getBoundingClientRect = () => {
    const box = control.getBoundingClientRect();
    return { top: box.top - 28, bottom: box.bottom };
  };
  control.closest = (selector) => (selector === 'label' ? label : null);
  doc.activeElement = control;
  doc.defaultView = {
    requestAnimationFrame: (fn) => queue.push(fn),
    addEventListener: (type, fn) => events.set(`window:${type}`, fn),
    removeEventListener: (type) => events.delete(`window:${type}`),
    ResizeObserver: class {
      constructor(fn) {
        resized = fn;
      }
      observe() {}
      disconnect() {
        resized = null;
      }
    },
  };
  const api = attachFocusClearance({
    container,
    heading,
    footer,
    includeControlLabel,
    document: doc,
  });
  return {
    doc,
    container,
    heading,
    footer,
    control,
    label,
    api,
    resize: () => resized?.(),
    emit: (type) => events.get(`container:${type}`)?.(),
    flush: () => {
      for (const fn of queue.splice(0)) fn();
    },
  };
}

test('Large portrait selector is fully below the measured expanded heading', () => {
  const f = fixture();
  f.resize();
  f.flush();
  assert.ok(f.control.getBoundingClientRect().top >= 302.358);
  assert.ok(f.control.getBoundingClientRect().bottom <= 692);
  assert.equal(f.doc.activeElement, f.control);
  assert.equal(f.container.style.scrollPaddingBlockStart, '286.359px');
});

test('Large landscape selector clears the measured bottom action bar', () => {
  const f = fixture({ headingBottom: 208, footerTop: 306, height: 390 });
  f.emit('focusin');
  f.flush();
  assert.ok(f.control.getBoundingClientRect().top >= 216);
  assert.ok(f.control.getBoundingClientRect().bottom <= 298.001);
  assert.equal(f.doc.activeElement, f.control);
});

test('queued reflow reads current focus and leaves the heading action alone', () => {
  const f = fixture();
  f.resize();
  const back = { parent: f.heading };
  f.doc.activeElement = back;
  f.flush();
  assert.equal(f.container.scrollTop, 200);
  assert.equal(f.doc.activeElement, back);
});

test('large reading region retains its beginning and manual scrolling is not undone', () => {
  const f = fixture({ headingBottom: 100, footerTop: 306, height: 390 });
  f.control.height = 300;
  f.api.refresh();
  f.flush();
  assert.ok(Math.abs(f.control.getBoundingClientRect().top - 108) < 0.001);
  f.container.scrollTop += 80;
  const intentional = f.container.scrollTop;
  f.emit('scroll');
  f.flush();
  assert.equal(f.container.scrollTop, intentional);
});

for (const reason of ['closed', 'hidden', 'blurred', 'outside', 'disposed'])
  test(`queued layout cannot alter a ${reason} owner's scroll or focus`, () => {
    const f = fixture();
    f.api.refresh();
    if (reason === 'closed') f.container.open = false;
    if (reason === 'hidden') f.doc.hidden = true;
    if (reason === 'blurred') f.doc.hasFocus = () => false;
    if (reason === 'outside') f.doc.activeElement = {};
    if (reason === 'disposed') f.api.destroy();
    const focused = f.doc.activeElement;
    f.flush();
    assert.equal(f.container.scrollTop, 200);
    assert.equal(f.doc.activeElement, focused);
  });

test('opt-in label clearance keeps the field purpose visible with its focused control', () => {
  const f = fixture({ headingBottom: 136, footerTop: 374, height: 390, includeControlLabel: true });
  f.control.absoluteTop = 344.09375;
  f.control.height = 64;
  f.emit('focusin');
  f.flush();
  assert.equal(f.label.getBoundingClientRect().top, 144);
  assert.equal(f.control.getBoundingClientRect().top, 172);
  assert.equal(f.control.getBoundingClientRect().bottom, 236);
  assert.equal(f.doc.activeElement, f.control);
});

test('other dialogs retain control-only clearance unless they opt into labels', () => {
  const f = fixture({ headingBottom: 136, footerTop: 374, height: 390 });
  f.control.absoluteTop = 344.09375;
  f.emit('focusin');
  f.flush();
  assert.equal(f.container.scrollTop, 200);
  assert.equal(f.control.getBoundingClientRect().top, 144.09375);
  assert.equal(f.doc.activeElement, f.control);
});

test('label clearance cannot target a label outside the current dialog', () => {
  const f = fixture({ includeControlLabel: true });
  f.label.parent = null;
  f.emit('focusin');
  f.flush();
  assert.ok(Math.abs(f.control.getBoundingClientRect().top - 302.359) < 0.001);
  assert.equal(f.doc.activeElement, f.control);
});

test('short landscape keeps the focused control visible when its Large label cannot fit', () => {
  const f = fixture({ headingBottom: 282, footerTop: 374, height: 390, includeControlLabel: true });
  f.control.height = 64;
  assert.equal(f.label.getBoundingClientRect().bottom - f.label.getBoundingClientRect().top, 92);
  f.emit('focusin');
  f.flush();
  assert.equal(f.control.getBoundingClientRect().top, 290);
  assert.equal(f.control.getBoundingClientRect().bottom, 354);
  assert.equal(f.doc.activeElement, f.control);
  const deliberate = f.container.scrollTop + 20;
  f.container.scrollTop = deliberate;
  f.emit('scroll');
  f.flush();
  assert.equal(f.container.scrollTop, deliberate, 'Reading the tall label stays a manual scroll.');
});

test('recorded Large portrait return keeps the entire picker outline inside a bordered scrollport', () => {
  const f = fixture({ headingBottom: 292, includeControlLabel: true });
  f.footer.hidden = true;
  f.container.clientTop = 3;
  f.container.clientHeight = 806;
  f.control.absoluteTop = 952.765625;
  f.control.height = 67;
  f.label.getBoundingClientRect = () => {
    const box = f.control.getBoundingClientRect();
    return { top: box.top - 60, bottom: box.bottom };
  };
  // Exact public return geometry: border box bottom828, client clip825,
  // field bottom819.765625, and outward focus painting3px+4px.
  assert.equal(f.control.getBoundingClientRect().bottom, 819.765625);
  const beforeFocus = f.doc.activeElement;
  f.api.refresh();
  f.flush();
  assert.ok(f.control.getBoundingClientRect().bottom + 7 <= 825);
  assert.ok(f.label.getBoundingClientRect().top >= 300);
  assert.equal(f.doc.activeElement, beforeFocus);
  assert.equal(f.container.style.scrollPaddingBlockEnd, '8px');
  const settled = f.container.scrollTop;
  f.api.refresh();
  f.flush();
  assert.equal(f.container.scrollTop, settled, 'Settled measured geometry causes no repeat drift.');
});

test('bordered scrollport clearance also protects the top edge when no sticky heading covers it', () => {
  const f = fixture();
  f.heading.hidden = true;
  f.footer.hidden = true;
  f.container.clientTop = 3;
  f.container.clientHeight = 806;
  f.control.absoluteTop = 224.5;
  f.emit('focusin');
  f.flush();
  assert.ok(f.control.getBoundingClientRect().top - 7 >= 19);
  assert.equal(f.doc.activeElement, f.control);
});

test('a legitimate zero-height client scrollport cannot scroll a focused form control', () => {
  const f = fixture();
  f.heading.hidden = true;
  f.footer.hidden = true;
  f.container.clientTop = 3;
  f.container.clientHeight = 0;
  f.control.absoluteTop = 1020;
  const scroll = f.container.scrollTop;
  f.api.refresh();
  f.flush();
  assert.equal(f.container.scrollTop, scroll);
  assert.equal(f.doc.activeElement, f.control);
});

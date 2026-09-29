import test from 'node:test';
import assert from 'node:assert/strict';
import { attachFocusClearance } from '../ui/focus-clearance.mjs';
import { prepareChapterFocus } from '../ui/chapter-focus-clearance.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';

// Actual composed helpers, finite layout boundary. A target's viewport rectangle
// depends on BOTH scrollports. These tests do not simulate native snap or paint.
function fixture(t, { hook = true } = {}) {
  const doc = new Document(),
    view = new Events(),
    frames = [],
    trace = [],
    observers = [];
  Object.assign(view, doc.defaultView, {
    requestAnimationFrame(fn) {
      frames.push(fn);
      return frames.length;
    },
    getComputedStyle(node) {
      return {
        display: node.style.display || 'block',
        visibility: node.style.visibility || 'visible',
        overflowY: node.style.overflowY || 'visible',
      };
    },
    ResizeObserver: class {
      constructor(callback) {
        this.callback = callback;
        this.targets = [];
        observers.push(this);
      }
      observe(node) {
        this.targets.push(node);
      }
      disconnect() {
        this.targets.length = 0;
      }
    },
  });
  doc.defaultView = view;
  const make = (tag, parent, className = '', id = '') => {
    const node = doc.createElement(tag);
    node.className = className;
    node.id = id;
    parent.append(node);
    return node;
  };
  const dialog = make('dialog', doc.body, 'shell-missions', 'shell-missions');
  dialog.open = true;
  dialog.clientTop = 0;
  dialog.clientHeight = 390;
  dialog.scrollHeight = 1514;
  const heading = make('div', dialog, 'shell-dialog-heading'),
    back = make('button', heading),
    section = make('section', dialog, 'mission-picker-chapter-section'),
    rail = make('div', section, 'mission-picker-cards'),
    card = make('button', rail, 'mission-picker-card'),
    older = make('details', section, 'mission-picker-older'),
    summary = make('summary', older, '', 'mission-picker-older-summary'),
    olderRail = make('div', older, 'mission-picker-cards'),
    olderCard = make('button', olderRail, 'mission-picker-card'),
    footer = make('div', dialog),
    deploy = make('button', footer),
    outside = make('button', doc.body);
  older.open = true;
  section.style.overflowY = 'auto';
  section.clientTop = 0;
  section.clientHeight = 520;
  section.scrollHeight = 1321;
  section.absoluteTop = 308.4921875;
  section.scrollLeft = 37;
  rail.scrollLeft = 123;
  heading.bottom = 183.5703125;
  footer.top = 310;
  const scroll = (node, name, initial) => {
    let value = initial;
    Object.defineProperty(node, 'scrollTop', {
      get: () => value,
      set(next) {
        trace.push({ type: 'scroll', owner: name, before: value, after: next });
        value = next;
      },
      configurable: true,
    });
  };
  scroll(dialog, 'outer', 643.5);
  scroll(section, 'inner', 45);
  dialog.getBoundingClientRect = () => {
    trace.push({ type: 'measure', owner: 'outer' });
    return { top: 0, bottom: 390, left: 0, right: 844, width: 844, height: 390 };
  };
  heading.getBoundingClientRect = () => ({ top: 0, bottom: heading.bottom });
  footer.getBoundingClientRect = () => ({ top: footer.top, bottom: 390 });
  section.getBoundingClientRect = () => {
    const top = section.absoluteTop - dialog.scrollTop;
    trace.push({ type: 'measure', owner: 'inner' });
    return { top, bottom: top + section.clientHeight + 2 * section.clientTop };
  };
  for (const node of [card, summary, olderCard]) {
    node.offset = 571.578125;
    node.height = 109.1953125;
    node.getBoundingClientRect = () => {
      const top =
        section.absoluteTop -
        dialog.scrollTop +
        section.clientTop +
        node.offset -
        section.scrollTop;
      trace.push({ type: 'measure', owner: 'target', node });
      return { top, bottom: top + node.height, left: 50, right: 230, height: node.height };
    };
  }
  const pack = make('select', dialog);
  pack.value = 'base';
  card.setAttribute('aria-pressed', 'false');
  let changes = 0,
    clicks = 0,
    hookCalls = 0,
    api;
  pack.addEventListener('change', () => changes++);
  card.addEventListener('click', () => clicks++);
  const preparation = (focused) => {
    hookCalls++;
    prepareChapterFocus(focused, { container: dialog, document: doc });
  };
  api = attachFocusClearance({
    container: dialog,
    heading,
    footer,
    document: doc,
    ...(hook ? { prepareTarget: preparation } : {}),
  });
  t.after(() => api.destroy());
  doc.activeElement = card;
  return {
    doc,
    view,
    dialog,
    heading,
    back,
    footer,
    deploy,
    section,
    rail,
    card,
    older,
    summary,
    olderCard,
    outside,
    pack,
    api,
    trace,
    frames,
    observers,
    hookCalls: () => hookCalls,
    changes: () => changes,
    clicks: () => clicks,
    flush() {
      for (const fn of frames.splice(0)) fn();
    },
    prepare(node = doc.activeElement) {
      return prepareChapterFocus(node, { container: dialog, document: doc });
    },
  };
}
function assertBothClear(f, target = f.doc.activeElement) {
  const rect = target.getBoundingClientRect(),
    inner = f.section.getBoundingClientRect(),
    innerTop = inner.top + f.section.clientTop,
    innerBottom = innerTop + f.section.clientHeight;
  assert.ok(rect.top - 7 >= innerTop, 'Focus paint clears the nested top clip');
  assert.ok(rect.bottom + 7 <= innerBottom, 'Focus paint clears the nested bottom clip');
  assert.ok(rect.top - 7 >= f.heading.bottom, 'Focus paint clears the sticky heading');
  assert.ok(rect.bottom + 7 <= f.footer.top, 'Focus paint clears the sticky footer');
}

test('inner preparation repairs the recorded hidden chapter before fresh outer sticky measurements', (t) => {
  const f = fixture(t);
  assert.equal(f.card.getBoundingClientRect().top, 191.5703125);
  assert.equal(f.card.getBoundingClientRect().bottom, 300.765625);
  assert.equal(f.section.getBoundingClientRect().bottom, 184.9921875);
  f.trace.length = 0;
  f.api.refresh();
  f.flush();
  const writes = f.trace.filter((event) => event.type === 'scroll');
  assert.deepEqual(
    writes.map((event) => event.owner),
    ['inner', 'outer'],
  );
  assert.equal(f.section.scrollTop, 168.7734375);
  assert.equal(f.dialog.scrollTop, 519.7265625);
  const innerWrite = f.trace.findIndex(
      (event) => event.type === 'scroll' && event.owner === 'inner',
    ),
    outerWrite = f.trace.findIndex((event) => event.type === 'scroll' && event.owner === 'outer');
  assert.ok(
    f.trace
      .slice(innerWrite + 1, outerWrite)
      .some((event) => event.owner === 'outer' && event.type === 'measure'),
    'Outer bounds are freshly measured after inner scroll, not cached before it',
  );
  assertBothClear(f);
  assert.equal(f.doc.activeElement, f.card);
  assert.equal(f.pack.value, 'base');
  assert.equal(f.card.getAttribute('aria-pressed'), 'false');
  assert.equal(f.changes(), 0);
  assert.equal(f.clicks(), 0);
  assert.equal(f.section.scrollLeft, 37);
  assert.equal(f.rail.scrollLeft, 123);
});

for (const [edge, sectionTop] of [
  ['top', 230],
  ['bottom', 900],
])
  test(`nested preparation composes with bordered outer ${edge} clearance`, (t) => {
    const f = fixture(t);
    f.heading.hidden = true;
    f.footer.hidden = true;
    f.dialog.clientTop = 3;
    f.dialog.clientHeight = 384;
    f.section.clientTop = 2;
    f.section.absoluteTop = sectionTop;
    f.trace.length = 0;
    f.api.refresh();
    f.flush();
    const writes = f.trace.filter((event) => event.type === 'scroll');
    assert.deepEqual(
      writes.map((event) => event.owner),
      ['inner', 'outer'],
    );
    const innerWrite = f.trace.findIndex(
        (event) => event.type === 'scroll' && event.owner === 'inner',
      ),
      outerWrite = f.trace.findIndex((event) => event.type === 'scroll' && event.owner === 'outer');
    assert.ok(
      f.trace
        .slice(innerWrite + 1, outerWrite)
        .some((event) => event.type === 'measure' && event.owner === 'outer'),
      'The corrected outer client viewport is read after the inner scroll',
    );
    const target = f.card.getBoundingClientRect(),
      inner = f.section.getBoundingClientRect(),
      innerTop = inner.top + f.section.clientTop,
      innerBottom = innerTop + f.section.clientHeight,
      outer = f.dialog.getBoundingClientRect(),
      outerTop = outer.top + f.dialog.clientTop,
      outerBottom = outerTop + f.dialog.clientHeight;
    assert.ok(target.top - 7 >= innerTop && target.bottom + 7 <= innerBottom);
    assert.ok(target.top - 7 >= outerTop && target.bottom + 7 <= outerBottom);
    assert.equal(f.dialog.style.scrollPaddingBlockStart, '8px');
    assert.equal(f.dialog.style.scrollPaddingBlockEnd, '8px');
    assert.equal(f.doc.activeElement, f.card);
    assert.equal(f.pack.value, 'base');
    assert.equal(f.card.getAttribute('aria-pressed'), 'false');
    assert.equal(f.changes(), 0);
    assert.equal(f.clicks(), 0);
    const settled = [f.section.scrollTop, f.dialog.scrollTop];
    f.trace.length = 0;
    f.api.refresh();
    f.flush();
    assert.deepEqual([f.section.scrollTop, f.dialog.scrollTop], settled);
    assert.equal(f.trace.filter((event) => event.type === 'scroll').length, 0);
  });

for (const target of ['summary', 'olderCard'])
  test(`the ${target} participates in the same composed clearance`, (t) => {
    const f = fixture(t);
    if (target === 'summary') f.older.open = false;
    f.doc.activeElement = f[target];
    f.api.refresh();
    f.flush();
    assertBothClear(f);
    assert.equal(f.doc.activeElement, f[target]);
    assert.equal(f.older.open, target !== 'summary', 'Preparation never opens a details element');
  });

test('settled refresh does not oscillate and ordinary reading scroll schedules no correction', (t) => {
  const f = fixture(t);
  f.api.refresh();
  f.flush();
  const settled = [f.section.scrollTop, f.dialog.scrollTop];
  assert.deepEqual(
    f.observers.map((observer) => observer.targets),
    [[f.heading, f.footer]],
  );
  f.trace.length = 0;
  f.api.refresh();
  f.flush();
  f.api.refresh();
  f.flush();
  assert.deepEqual([f.section.scrollTop, f.dialog.scrollTop], settled);
  assert.equal(f.trace.filter((event) => event.type === 'scroll').length, 0);
  f.section.scrollTop += 25;
  f.dialog.scrollTop += 13;
  const manual = [f.section.scrollTop, f.dialog.scrollTop];
  f.section.emit('scroll');
  f.dialog.emit('scroll');
  assert.equal(f.frames.length, 0);
  f.flush();
  assert.deepEqual([f.section.scrollTop, f.dialog.scrollTop], manual);
});

test('inner client borders are excluded and oversized targets use a stable top edge', (t) => {
  const f = fixture(t);
  f.section.clientTop = 3;
  f.section.clientHeight = 80;
  assert.equal(f.prepare(), true);
  const top = f.section.getBoundingClientRect().top + f.section.clientTop;
  assert.equal(f.card.getBoundingClientRect().top, top + 8);
  const settled = f.section.scrollTop;
  assert.equal(f.prepare(), false);
  assert.equal(f.section.scrollTop, settled);
  assert.equal(f.dialog.scrollTop, 643.5, 'Pure preparation owns no outer scroll');
});

test('inner movement clamps to its actual range when the requested clearance is impossible', (t) => {
  const f = fixture(t);
  f.section.scrollHeight = f.section.clientHeight + 30;
  f.section.scrollTop = 0;
  f.card.offset = 2000;
  f.prepare();
  assert.equal(f.section.scrollTop, 30);
  f.card.offset = -100;
  f.prepare();
  assert.equal(f.section.scrollTop, 0);
  const writes = f.trace.filter((event) => event.owner === 'inner' && event.type === 'scroll');
  assert.ok(writes.every((event) => event.after >= 0 && event.after <= 30));
});

for (const reason of ['visible-overflow', 'no-overflow', 'zero-height', 'unrelated-section'])
  test(`pure preparation does not scroll a ${reason} container`, (t) => {
    const f = fixture(t);
    if (reason === 'visible-overflow') f.section.style.overflowY = 'visible';
    if (reason === 'no-overflow') f.section.scrollHeight = f.section.clientHeight;
    if (reason === 'zero-height') f.section.clientHeight = 0;
    if (reason === 'unrelated-section')
      f.section.classList.remove('mission-picker-chapter-section');
    const before = f.section.scrollTop;
    assert.equal(f.prepare(), false);
    assert.equal(f.section.scrollTop, before);
    assert.equal(f.dialog.scrollTop, 643.5);
  });

for (const reason of [
  'closed-dialog',
  'closed-older',
  'hidden',
  'inert',
  'disabled',
  'disconnected',
  'stale-focus',
])
  test(`pure nested preparation rejects ${reason} ownership`, (t) => {
    const f = fixture(t);
    f.doc.activeElement = f.olderCard;
    if (reason === 'closed-dialog') f.dialog.open = false;
    if (reason === 'closed-older') f.older.open = false;
    if (reason === 'hidden') f.section.hidden = true;
    if (reason === 'inert') f.older.inert = true;
    if (reason === 'disabled') f.olderCard.disabled = true;
    if (reason === 'disconnected') f.olderCard.remove();
    if (reason === 'stale-focus') f.doc.activeElement = f.outside;
    assert.equal(f.prepare(f.olderCard), false);
    assert.equal(f.section.scrollTop, 45);
    assert.equal(f.dialog.scrollTop, 643.5);
  });

for (const focused of ['absent', 'outside', 'disabled', 'back', 'deploy'])
  test(`without the optional hook, ${focused} focus still updates ordinary sticky padding`, (t) => {
    const f = fixture(t, { hook: false });
    if (focused === 'absent') f.doc.activeElement = null;
    else if (focused === 'disabled') f.card.disabled = true;
    else f.doc.activeElement = f[focused];
    f.heading.bottom = 200;
    f.footer.top = 330;
    f.api.refresh();
    f.flush();
    assert.equal(f.dialog.style.scrollPaddingBlockStart, '208px');
    assert.equal(f.dialog.style.scrollPaddingBlockEnd, '68px');
    assert.equal(f.section.scrollTop, 45);
    assert.equal(f.dialog.scrollTop, 643.5);
    assert.equal(f.hookCalls(), 0);
  });

test('queued opt-in work uses the current focus and cannot prepare a retired owner', (t) => {
  const f = fixture(t);
  f.api.refresh();
  f.doc.activeElement = f.back;
  f.flush();
  assert.equal(f.hookCalls(), 0);
  assert.equal(f.section.scrollTop, 45);
  assert.equal(f.dialog.scrollTop, 643.5);
  f.doc.activeElement = f.card;
  f.api.refresh();
  f.api.destroy();
  f.flush();
  assert.equal(f.hookCalls(), 0);
  assert.equal(f.section.scrollTop, 45);
  assert.equal(f.dialog.scrollTop, 643.5);
  assert.equal(f.dialog.style.scrollPaddingBlockStart, '0px');
  assert.equal(f.dialog.style.scrollPaddingBlockEnd, '0px');
});

test('a hook that changes focus cannot make outer scrolling follow its stale target', (t) => {
  const f = fixture(t, { hook: false });
  f.api.destroy();
  let calls = 0;
  const api = attachFocusClearance({
    container: f.dialog,
    heading: f.heading,
    footer: f.footer,
    document: f.doc,
    prepareTarget(focused) {
      assert.equal(focused, f.card);
      calls++;
      f.doc.activeElement = f.outside;
    },
  });
  t.after(() => api.destroy());
  api.refresh();
  f.flush();
  assert.equal(calls, 1);
  assert.equal(f.doc.activeElement, f.outside);
  assert.equal(f.section.scrollTop, 45);
  assert.equal(f.dialog.scrollTop, 643.5);
  assert.equal(f.dialog.style.scrollPaddingBlockStart, '191.5703125px');
  assert.equal(f.dialog.style.scrollPaddingBlockEnd, '88px');
});

test('synchronous disposal from preparation cannot revive cleared padding or scroll owners', (t) => {
  const f = fixture(t, { hook: false });
  f.api.destroy();
  let api;
  api = attachFocusClearance({
    container: f.dialog,
    heading: f.heading,
    footer: f.footer,
    document: f.doc,
    prepareTarget() {
      api.destroy();
    },
  });
  t.after(() => api.destroy());
  api.refresh();
  f.flush();
  assert.equal(f.dialog.style.scrollPaddingBlockStart, '0px');
  assert.equal(f.dialog.style.scrollPaddingBlockEnd, '0px');
  assert.equal(f.section.scrollTop, 45);
  assert.equal(f.dialog.scrollTop, 643.5);
});

// Native CSS must provide this real trailing space. A scroll algorithm cannot
// reveal paint beyond scrollHeight by writing an out-of-range scrollTop.
test('closed Older summary at the content endpoint needs genuine trailing focus space', (t) => {
  const f = fixture(t);
  f.doc.activeElement = f.summary;
  f.older.open = false;
  f.section.clientHeight = 200;
  f.section.scrollHeight = 1000;
  f.section.scrollTop = 0;
  f.summary.offset = 940;
  f.summary.height = 60;
  f.prepare(f.summary);
  assert.equal(f.section.scrollTop, 800, 'Without trailing space, native maximum is respected');
  const edge = () =>
    f.section.getBoundingClientRect().top + f.section.clientTop + f.section.clientHeight;
  assert.equal(f.summary.getBoundingClientRect().bottom, edge());
  assert.ok(
    f.summary.getBoundingClientRect().bottom + 7 > edge(),
    'The endpoint is honestly still paint-clipped',
  );
  f.section.scrollHeight += 8;
  f.prepare(f.summary);
  assert.equal(f.section.scrollTop, 808);
  assert.equal(edge() - f.summary.getBoundingClientRect().bottom, 8);
  assert.ok(f.summary.getBoundingClientRect().bottom + 7 <= edge());
  assert.equal(f.dialog.scrollTop, 643.5);
  assert.equal(f.doc.activeElement, f.summary);
  assert.equal(f.older.open, false);
});

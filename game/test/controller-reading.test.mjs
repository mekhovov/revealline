import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { attachControllerReading } from '../ui/controller-reading.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';
import { readingInputPrompt } from '../ui/reading-input-prompt.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';
import { createRun, stepRun, releaseInputs, FIXED_DT, getSummary } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

class Element {
  constructor(id) {
    this.id = id;
    this.listeners = new Map();
    this.attributes = new Map();
    this.disabled = false;
    this.hidden = false;
    this.open = true;
    this.textContent = '';
    this.scrolled = [];
  }
  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
  }
  removeEventListener(type, handler) {
    this.listeners.get(type)?.delete(handler);
  }
  emit(type) {
    for (const listener of [...(this.listeners.get(type) || [])]) listener({ target: this });
  }
  click() {
    if (!this.disabled) this.emit('click');
  }
  setAttribute(name, value) {
    this.attributes.set(name, value);
  }
  scrollIntoView(options) {
    this.scrolled.push(options);
  }
  set innerHTML(_value) {
    throw new Error('Reading hints must be safe DOM text.');
  }
}
function fixture(t, initialScope = 'paused', overrides = {}) {
  const ids = [
    'overlay-reading',
    'overlay-read',
    'overlay-reading-done',
    'overlay-reading-hint',
    'overlay-reading-unit',
    'mission-brief-reading',
    'mission-brief-read',
    'mission-brief-reading-done',
    'mission-brief-reading-hint',
    'mission-brief-unit',
    'mission-brief',
  ];
  const elements = new Map(ids.map((id) => [id, new Element(id)])),
    calls = [];
  const doc = { getElementById: (id) => elements.get(id) };
  // Accepted navigation owns a connected region inside its presentation unit.
  // The real adapter also focuses that region before publishing reading state.
  for (const [unitId, regionId] of [
    ['overlay-reading-unit', 'overlay-reading'],
    ['mission-brief-unit', 'mission-brief-reading'],
  ]) {
    const unit = elements.get(unitId),
      region = elements.get(regionId);
    unit.isConnected = true;
    unit.contains = (element) => element === region;
    region.closest = () => null;
  }
  let state = null,
    scope = initialScope,
    rejectEntry = false,
    transition = () => {};
  let labels = { confirm: 'Right bumper', back: 'West' };
  let reading;
  const navigation = {
    beginReading(value) {
      assert.equal(value.exit, elements.get(`${value.region.id}-done`));
      calls.push(['begin', value.region.id, value.origin.id, value.label]);
      if (rejectEntry) return false;
      state = { regionId: value.region.id, label: value.label };
      doc.activeElement = value.region;
      reading.changed(state);
      return true;
    },
    readingState: () => state && { ...state },
    endReading(options) {
      calls.push(['end', options]);
      const wasActive = !!state;
      if (state) {
        state = null;
        reading.changed(null);
      }
      return wasActive;
    },
  };
  reading = attachControllerReading({
    document: doc,
    getNavigation: () => navigation,
    getControlLabels: () => labels,
    getScope: () => scope,
    pause: (force) => {
      calls.push(['pause', force]);
      scope = 'paused';
    },
    onTransition: () => {
      calls.push(['transition', state?.regionId || null]);
      transition();
    },
    ...overrides,
  });
  t.after(() => reading.destroy());
  return {
    reading,
    navigation,
    calls,
    elements,
    $: (id) => elements.get(id),
    setScope: (value) => {
      scope = value;
    },
    rejectEntry: () => {
      rejectEntry = true;
    },
    setLabels: (value) => {
      labels = value;
    },
    onTransition: (callback) => {
      transition = callback;
    },
  };
}

test('two finite toolbars keep Done stable, show mapped labels and retain the return origin', (t) => {
  const f = fixture(t);
  assert.equal(f.$('overlay-reading-done').disabled, true);
  assert.equal(f.$('mission-brief-reading-done').disabled, true);
  f.$('overlay-read').click();
  assert.deepEqual(f.calls[0], ['begin', 'overlay-reading', 'overlay-read', 'Mission details']);
  assert.equal(f.$('overlay-read').disabled, false);
  assert.equal(f.$('overlay-reading-done').disabled, false);
  assert.equal(f.$('overlay-reading-done').hidden, false);
  assert.equal(f.$('mission-brief-reading-done').disabled, true);
  assert.match(f.$('overlay-reading-hint').textContent, /Right bumper or West returns/);
  f.setLabels({ confirm: 'Triangle', back: 'Circle' });
  f.reading.refresh();
  assert.match(f.$('overlay-reading-hint').textContent, /Triangle or Circle returns/);
  assert.deepEqual(f.$('overlay-reading-unit').scrolled, [
    { block: 'nearest', inline: 'nearest', behavior: 'instant' },
  ]);
});

test('optional reading prompt uses the same measured scrollability without replacing Done or transitions', (t) => {
  const f = fixture(t, 'paused', {
    getReadingPrompt: ({ scrollable }) =>
      `${scrollable ? 'Scroll to read' : 'All text is visible'} · Done reading returns`,
  });
  const region = f.$('overlay-reading'),
    done = f.$('overlay-reading-done');
  region.clientHeight = 100;
  region.scrollHeight = 100;
  f.$('overlay-read').click();
  assert.match(
    f.$('overlay-reading-hint').textContent,
    /All text is visible · Done reading returns/,
  );
  const calls = [...f.calls];
  region.scrollHeight = 400;
  f.reading.refresh();
  assert.match(f.$('overlay-reading-hint').textContent, /Scroll to read · Done reading returns/);
  assert.equal(f.$('overlay-reading-done'), done);
  assert.equal(done.disabled, false);
  assert.deepEqual(f.calls, calls);
});

test('running full-brief entry pauses before beginning; overlay entry cannot start or pause flight', (t) => {
  const f = fixture(t, 'flight');
  f.$('overlay-read').click();
  assert.deepEqual(f.calls, []);
  f.$('mission-brief-read').click();
  assert.deepEqual(f.calls, [
    ['pause', true],
    ['begin', 'mission-brief-reading', 'mission-brief-read', 'Mission brief'],
    ['transition', 'mission-brief-reading'],
  ]);
  f.$('mission-brief-reading-done').click();
  assert.deepEqual(f.calls.slice(-2), [
    ['end', { restoreFocus: true }],
    ['transition', null],
  ]);
  assert.equal(f.calls.filter((call) => call[0] === 'pause').length, 1);
});

test('ready, paused, won, lost and complete entries never invoke a flight action', (t) => {
  const f = fixture(t);
  for (const scope of [
    'ready:first-signal:first',
    'paused',
    'won',
    'lost',
    'overview:first-signal',
  ]) {
    f.setScope(scope);
    for (const prefix of ['overlay', 'mission-brief']) {
      f.$(`${prefix}-read`).click();
      f.$(`${prefix}-reading-done`).click();
    }
  }
  assert.equal(f.calls.filter((call) => call[0] === 'pause').length, 0);
  assert.equal(f.calls.filter((call) => call[0] === 'begin').length, 10);
});

test('a rejected or repeated entry does not scroll the host unit or recreate reading', (t) => {
  const f = fixture(t);
  f.$('overlay-read').click();
  f.$('overlay-read').click();
  assert.equal(f.calls.filter((call) => call[0] === 'begin').length, 1);
  assert.equal(f.$('overlay-reading-unit').scrolled.length, 1);
  f.navigation.endReading({ restoreFocus: false });
  f.rejectEntry();
  f.$('overlay-read').click();
  assert.equal(f.$('overlay-reading-unit').scrolled.length, 1);
  assert.equal(f.$('overlay-reading-done').disabled, true);
});

test('late Done click after cancellation cannot re-enter or invoke another action', (t) => {
  const f = fixture(t);
  f.$('overlay-read').click();
  const done = f.$('overlay-reading-done');
  // A different native gesture may cancel reading before a queued activation.
  f.navigation.endReading({ restoreFocus: false });
  assert.equal(f.$('overlay-reading-done'), done);
  assert.equal(done.hidden, false);
  assert.equal(done.disabled, true);
  done.click();
  // A late queued activation remains harmless even if dispatched directly.
  done.emit('click');
  assert.equal(f.navigation.readingState(), null);
  assert.equal(f.calls.filter((call) => call[0] === 'begin').length, 1);
  assert.equal(f.calls.filter((call) => call[0] === 'pause').length, 0);
});

test('closing the full brief ends only its own active reader without restoring hidden focus', (t) => {
  const f = fixture(t);
  f.$('overlay-read').click();
  f.$('mission-brief').open = false;
  f.$('mission-brief').emit('toggle');
  assert.equal(f.navigation.readingState().regionId, 'overlay-reading');
  f.$('mission-brief').open = true;
  f.$('mission-brief-read').click();
  f.$('mission-brief').open = false;
  f.$('mission-brief').emit('toggle');
  assert.equal(f.navigation.readingState(), null);
  assert.deepEqual(f.calls.slice(-2), [
    ['end', { restoreFocus: false }],
    ['transition', null],
  ]);
});

test('local hints use text, do not duplicate mapped prompts, and ignore later unrelated navigation', (t) => {
  const f = fixture(t);
  f.$('overlay-read').click();
  const message = 'End of details. <img src=x> · Right bumper or West returns';
  f.reading.hint(message);
  assert.equal(f.$('overlay-reading-hint').textContent, message);
  f.$('overlay-reading-done').click();
  f.reading.hint('Choice applied.');
  assert.equal(
    f.$('overlay-reading-hint').textContent,
    'Reading ended. Choose an action when ready.',
  );
  assert.equal(f.$('mission-brief-reading-hint').textContent, 'Read without starting or resuming.');
});

test('destruction ends once and removes both finite toolbars and details event handlers', (t) => {
  const f = fixture(t);
  f.$('mission-brief-read').click();
  f.reading.destroy();
  const count = f.calls.length;
  f.$('mission-brief-read').click();
  f.$('overlay-read').click();
  f.$('mission-brief-reading-done').emit('click');
  f.$('mission-brief').emit('toggle');
  f.reading.destroy();
  assert.equal(f.calls.length, count);
  assert.equal(f.navigation.readingState(), null);
});

function couchReading(t, { revealOnResize = false } = {}) {
  const doc = new Document(),
    win = Object.assign(new Events(), doc.defaultView, { innerWidth: 844, innerHeight: 390 });
  doc.defaultView = win;
  doc.parentNode = win;
  doc.documentElement.clientWidth = 844;
  doc.documentElement.clientHeight = 390;
  const make = (tag, id, text) => {
    const element = doc.createElement(tag);
    element.id = id;
    element.textContent = text;
    return element;
  };
  const unit = make('div', 'couch-help-unit', ''),
    entry = make('button', 'couch-help-read', 'Read controls'),
    done = make('button', 'couch-help-reading-done', 'Done reading'),
    region = make('div', 'couch-help-reading', 'Keep both players on safe ground.'),
    hint = make('p', 'couch-help-reading-hint', ''),
    other = make('button', 'couch-help-back', 'Back');
  region.tabIndex = 0;
  region.clientHeight = 100;
  region.scrollHeight = 300;
  region.setAttribute('data-game-reading', '');
  region.setAttribute('role', 'region');
  region.setAttribute('aria-label', 'Couch controls');
  unit.append(entry, done, hint, region);
  doc.body.append(unit, other);
  const definitions = Object.freeze([
    Object.freeze(['couch-help-reading', 'couch-help-read', 'Couch controls', 'couch-help-unit']),
  ]);
  let reading,
    scope = 'couch-help',
    root = doc.body,
    onHint = () => {},
    onPrompt = () => {},
    transitions = 0,
    back = 0;
  const prompt = ({ scrollable }) => {
    onPrompt();
    return readingInputPrompt({ modality: 'keyboard', scrollable });
  };
  const navigation = attachControllerNavigation({
    document: doc,
    getScope: () => scope,
    getRoot: () => root,
    getDefaultFocus: () => entry,
    getReadingPrompt: prompt,
    keyboard: true,
    onBack: () => back++,
    onReadingChange: (state) => reading?.changed(state),
    onHint: (message) => {
      reading?.hint(message);
      onHint();
    },
  });
  let currentNavigation = navigation;
  reading = attachControllerReading({
    document: doc,
    getNavigation: () => currentNavigation,
    getReadingPrompt: prompt,
    getScope: () => scope,
    surfaceDefinitions: definitions,
    revealOnResize,
    // An explicit list replaces both defaults and extensions; these unrelated
    // elements deliberately do not exist in the Couch document.
    additionalSurfaces: [['unowned', 'unowned-read', 'Unowned', 'unowned-unit']],
    pause: () => assert.fail('The custom Help toolbar cannot pause or resume a flight.'),
    onTransition: () => transitions++,
  });
  t.after(() => {
    reading.destroy();
    navigation.destroy();
  });
  return {
    doc,
    win,
    unit,
    entry,
    done,
    region,
    hint,
    other,
    reading,
    navigation,
    setScope: (value) => (scope = value),
    setRoot: (value) => (root = value),
    setNavigation: (value) => (currentNavigation = value),
    onHint: (value) => (onHint = value),
    onPrompt: (value) => (onPrompt = value),
    counts: () => ({ transitions, back }),
  };
}

test('one custom Couch toolbar owns real navigation focus and a stable pointer Done action', (t) => {
  const h = couchReading(t);
  assert.equal(h.doc.getElementById('overlay-reading'), null);
  assert.equal(h.done.disabled, true);
  h.entry.focus();
  h.entry.click();
  assert.equal(h.doc.activeElement, h.region);
  assert.equal(h.entry.getAttribute('aria-pressed'), 'true');
  assert.equal(h.done.disabled, false);
  assert.match(h.hint.textContent, /Up\/Down scroll · Enter, Space or Escape returns/);
  h.done.emit('pointerdown', { pointerType: 'touch' });
  assert.equal(h.navigation.readingState()?.regionId, h.region.id);
  h.done.click();
  assert.equal(h.doc.activeElement, h.entry);
  assert.equal(h.navigation.readingState(), null);
  assert.equal(h.done.disabled, true);
  assert.equal(h.entry.getAttribute('aria-pressed'), 'false');
  assert.deepEqual(h.counts(), { transitions: 2, back: 0 });
});

test('custom toolbar Escape returns only to its opener and late Done preserves later focus', (t) => {
  const h = couchReading(t);
  h.entry.click();
  h.region.emit('keydown', { key: 'Escape' });
  assert.equal(h.doc.activeElement, h.entry);
  assert.equal(h.navigation.readingState(), null);
  assert.equal(h.counts().back, 0, 'The same Escape cannot also leave Help.');
  h.entry.click();
  h.other.focus();
  assert.equal(h.navigation.readingState(), null);
  const before = h.counts();
  h.done.emit('click');
  assert.equal(h.doc.activeElement, h.other);
  assert.deepEqual(h.counts(), before);
});

test('custom toolbar refuses flight entry and releases its own listeners on destruction', (t) => {
  const h = couchReading(t);
  h.setScope('flight');
  h.entry.click();
  assert.equal(h.navigation.readingState(), null);
  assert.deepEqual(h.counts(), { transitions: 0, back: 0 });
  h.setScope('couch-help');
  h.entry.click();
  h.reading.destroy();
  const before = h.counts();
  h.other.focus();
  h.entry.click();
  h.done.emit('click');
  h.reading.destroy();
  assert.equal(h.navigation.readingState(), null);
  assert.equal(h.doc.activeElement, h.other);
  assert.deepEqual(h.counts(), before);
});

const resizedOutside = { x: 20, y: 510, width: 360, height: 190 };
const resizedInside = { x: 20, y: 180, width: 360, height: 190 };
const resizeNearest = { block: 'nearest', inline: 'nearest', behavior: 'instant' };
function resizeReading(t, options = {}) {
  const h = couchReading(t, { revealOnResize: true, ...options });
  h.entry.click();
  h.unit._rect = resizedOutside;
  const scrolls = [];
  t.mock.method(h.unit, 'scrollIntoView', (value) => scrolls.push(value));
  t.mock.method(h.region, 'focus', () => assert.fail('Resize cannot focus the reader again.'));
  t.mock.method(h.navigation, 'sync', () => assert.fail('Resize cannot sync navigation.'));
  t.mock.method(h.navigation, 'engage', () => assert.fail('Resize cannot engage navigation.'));
  return { ...h, scrolls };
}

test('resize opt-in reveals the current reading unit, updates measured hints and preserves focus and Done', (t) => {
  const h = resizeReading(t),
    before = h.counts(),
    state = h.navigation.readingState();
  h.region.scrollHeight = h.region.clientHeight;
  h.win.emit('resize');
  assert.deepEqual(h.scrolls, [resizeNearest]);
  assert.match(h.hint.textContent, /All text is visible · Enter, Space or Escape returns/);
  assert.equal(h.doc.activeElement, h.region);
  assert.equal(h.done.disabled, false);
  assert.deepEqual(h.navigation.readingState(), state);
  assert.deepEqual(h.counts(), before);
  h.unit._rect = resizedInside;
  h.win.emit('resize');
  assert.equal(h.scrolls.length, 1, 'A visible reading unit needs no further scroll.');
});

test('resize leaves existing default reader behavior unchanged', (t) => {
  const h = resizeReading(t, { revealOnResize: false });
  assert.equal(h.win.listeners.get('resize')?.size ?? 0, 0);
  h.win.emit('resize');
  assert.deepEqual(h.scrolls, []);
  assert.equal(h.doc.activeElement, h.region);
  assert.equal(h.done.disabled, false);
});

function clippedReading(t, { overflowX = 'auto', overflowY = 'auto' } = {}) {
  const h = resizeReading(t),
    panel = h.doc.createElement('section'),
    style = h.win.getComputedStyle.bind(h.win);
  panel._rect = { x: 0, y: 12, width: 844, height: 366 };
  Object.assign(panel, { clientLeft: 2, clientTop: 2, clientWidth: 840, clientHeight: 362 });
  Object.assign(panel.style, { overflowX, overflowY });
  h.doc.body.append(panel);
  panel.append(h.unit);
  // Match the observed Large/Plain Team reader: it fits the 390px window,
  // while its final 7.78px lies below the pause panel's inner bottom at 376.
  h.unit._rect = { x: 20, y: 146.49, width: 360, height: 237.29 };
  t.mock.method(h.win, 'getComputedStyle', (element) => ({
    ...style(element),
    overflowX: element.style.overflowX || 'visible',
    overflowY: element.style.overflowY || 'visible',
  }));
  return { ...h, panel };
}

for (const overflow of ['auto', 'scroll', 'hidden', 'clip', 'overlay'])
  test(`resize reveals a viewport-fitting reader clipped by an ${overflow} ancestor's client box`, (t) => {
    const h = clippedReading(t, { overflowY: overflow }),
      before = h.counts(),
      state = h.navigation.readingState();
    h.win.emit('resize');
    assert.deepEqual(h.scrolls, [resizeNearest]);
    assert.equal(h.doc.activeElement, h.region);
    assert.equal(h.done.disabled, false);
    assert.deepEqual(h.navigation.readingState(), state);
    assert.deepEqual(h.counts(), before);
  });

test('resize skips a reader inside both viewport and ancestor client box', (t) => {
  const h = clippedReading(t);
  h.unit._rect = resizedInside;
  h.win.emit('resize');
  assert.deepEqual(h.scrolls, []);
  assert.equal(h.doc.activeElement, h.region);
  assert.equal(h.done.disabled, false);
});

test('resize intersects horizontal and vertical overflow independently', (t) => {
  const h = clippedReading(t, { overflowX: 'hidden', overflowY: 'visible' });
  h.panel._rect = { x: 30, y: 12, width: 400, height: 50 };
  h.panel.clientWidth = 390;
  h.panel.clientHeight = 46;
  h.unit._rect = { x: 32, y: 146, width: 360, height: 230 };
  h.win.emit('resize');
  assert.deepEqual(h.scrolls, [], 'Visible vertical overflow does not clip the reader.');
  h.unit._rect = { ...h.unit._rect, x: 31 };
  h.win.emit('resize');
  assert.deepEqual(h.scrolls, [resizeNearest], 'The left border is outside the client box.');
  h.unit._rect = { ...h.unit._rect, x: 70 };
  h.win.emit('resize');
  assert.equal(h.scrolls.length, 2, 'The horizontal client extent excludes the scrollbar.');
});

test('resize intersects nested clipping panels and does not clip the toolbar to its text region', (t) => {
  const h = clippedReading(t),
    outer = h.doc.createElement('section');
  outer._rect = { x: 0, y: 0, width: 844, height: 365 };
  Object.assign(outer, { clientLeft: 0, clientTop: 0, clientWidth: 844, clientHeight: 365 });
  outer.style.overflowY = 'auto';
  h.doc.body.append(outer);
  outer.append(h.panel);
  h.unit._rect = resizedInside;
  h.region.style.overflowY = 'auto';
  h.win.emit('resize');
  assert.deepEqual(h.scrolls, [resizeNearest], 'The outer panel clips the otherwise fitting unit.');
  outer.clientHeight = 380;
  outer._rect.height = 380;
  h.win.emit('resize');
  assert.equal(h.scrolls.length, 1, 'The inner scrollable text is not an ancestor of its toolbar.');
});

test('resize reveals through a valid ancestor that is itself outside the viewport', (t) => {
  const h = clippedReading(t);
  h.panel._rect = { ...h.panel._rect, y: 500 };
  h.unit._rect = resizedOutside;
  h.win.emit('resize');
  assert.deepEqual(h.scrolls, [resizeNearest], 'An empty intersection still needs reveal.');
});

test('resize repeat suppression includes the effective ancestor clip bounds', (t) => {
  const h = clippedReading(t);
  h.win.emit('resize');
  h.win.emit('resize');
  assert.equal(h.scrolls.length, 1);
  h.panel.clientHeight -= 8;
  h.win.emit('resize');
  assert.equal(
    h.scrolls.length,
    2,
    'A changed panel clip gets a fresh reveal with unchanged unit geometry.',
  );
  h.win.emit('resize');
  assert.equal(h.scrolls.length, 2);
});

for (const invalid of [
  'nonfinite-position',
  'zero-width',
  'zero-height',
  'negative-border',
  'missing-client-size',
])
  test(`resize ignores a clipping ancestor with ${invalid}`, (t) => {
    const h = clippedReading(t),
      before = h.counts();
    if (invalid === 'nonfinite-position') h.panel._rect.y = Number.NaN;
    if (invalid === 'zero-width') h.panel._rect.width = 0;
    if (invalid === 'zero-height') h.panel.clientHeight = 0;
    if (invalid === 'negative-border') h.panel.clientTop = -1;
    if (invalid === 'missing-client-size') h.panel.clientWidth = undefined;
    h.win.emit('resize');
    assert.deepEqual(h.scrolls, []);
    assert.equal(h.doc.activeElement, h.region);
    assert.deepEqual(h.counts(), before);
  });

for (const read of ['ancestor-style', 'ancestor-rectangle', 'ancestor-client-size'])
  test(`${read} cannot reveal a retired reading owner`, (t) => {
    const h = clippedReading(t),
      unitRect = h.unit.getBoundingClientRect.bind(h.unit),
      panelRect = h.panel.getBoundingClientRect.bind(h.panel),
      style = h.win.getComputedStyle.bind(h.win),
      clientHeight = h.panel.clientHeight;
    let measured = false,
      retired = false;
    const retire = () => {
      retired = true;
      h.setScope('flight');
    };
    t.mock.method(h.unit, 'getBoundingClientRect', () => {
      measured = true;
      return unitRect();
    });
    if (read === 'ancestor-style')
      t.mock.method(h.win, 'getComputedStyle', (element) => {
        const value = style(element);
        if (element === h.panel && measured) retire();
        return value;
      });
    if (read === 'ancestor-rectangle')
      t.mock.method(h.panel, 'getBoundingClientRect', () => {
        retire();
        return panelRect();
      });
    if (read === 'ancestor-client-size')
      Object.defineProperty(h.panel, 'clientHeight', {
        configurable: true,
        get() {
          retire();
          return clientHeight;
        },
      });
    h.win.emit('resize');
    assert.equal(retired, true);
    assert.deepEqual(h.scrolls, []);
    assert.equal(h.doc.activeElement, h.region);
  });

for (const condition of [
  'ended',
  'background',
  'hidden-document',
  'changed-scope',
  'changed-root',
  'changed-text',
  'hidden-unit',
  'inert-unit',
  'invisible-unit',
  'closed-disclosure',
  'closed-dialog',
  'disabled-done',
  'detached-unit',
])
  test(`resize cannot reveal the active unit after ${condition}`, (t) => {
    const h = resizeReading(t);
    if (condition === 'ended') h.navigation.endReading({ restoreFocus: false });
    if (condition === 'background') h.doc.focused = false;
    if (condition === 'hidden-document') h.doc.hidden = true;
    if (condition === 'changed-scope') h.setScope('flight');
    if (condition === 'changed-root') h.setRoot(h.other);
    if (condition === 'changed-text') h.region.textContent = 'Replacement instructions';
    if (condition === 'hidden-unit') h.unit.hidden = true;
    if (condition === 'inert-unit') h.unit.inert = true;
    if (condition === 'invisible-unit') h.unit.style.visibility = 'hidden';
    if (condition === 'closed-disclosure' || condition === 'closed-dialog') {
      const closed = h.doc.createElement(condition === 'closed-disclosure' ? 'details' : 'dialog');
      h.doc.body.append(closed);
      closed.append(h.unit);
    }
    if (condition === 'disabled-done') h.done.disabled = true;
    if (condition === 'detached-unit') h.unit.remove();
    const before = h.counts(),
      focus = h.doc.activeElement;
    h.win.emit('resize');
    assert.deepEqual(h.scrolls, []);
    assert.equal(h.doc.activeElement, focus);
    assert.deepEqual(h.counts(), before);
  });

for (const callback of ['prompt', 'hint'])
  test(`resize retires when the ${callback} callback replaces its same-ID reading owner`, (t) => {
    const h = resizeReading(t),
      before = h.counts();
    // A deliberate host replacement may focus its newly accepted reader. It
    // ends with the same region, focus and public state as the retired reader.
    t.mock.method(h.region, 'focus', Object.getPrototypeOf(h.region).focus);
    const retire = () => {
      h.onPrompt(() => {});
      h.onHint(() => {});
      h.navigation.endReading({ restoreFocus: false });
      h.navigation.beginReading({
        region: h.region,
        origin: h.entry,
        exit: h.done,
        label: 'Couch controls',
      });
    };
    if (callback === 'prompt') h.onPrompt(retire);
    else h.onHint(retire);
    h.win.emit('resize');
    assert.deepEqual(h.scrolls, []);
    assert.equal(h.doc.activeElement, h.region);
    assert.equal(h.navigation.readingState().regionId, h.region.id);
    assert.equal(h.counts().transitions, before.transitions + 2);
  });

for (const interruption of [
  'other-focus',
  'new-navigation',
  'changed-scope',
  'closed',
  'background',
  'destroyed',
])
  test(`resize hint publication cannot reveal its old unit after ${interruption}`, (t) => {
    const h = resizeReading(t);
    h.onHint(() => {
      h.onHint(() => {});
      if (interruption === 'other-focus') h.other.focus();
      if (interruption === 'new-navigation') h.setNavigation({ ...h.navigation });
      if (interruption === 'changed-scope') h.setScope('flight');
      if (interruption === 'closed') h.unit.hidden = true;
      if (interruption === 'background') h.doc.focused = false;
      if (interruption === 'destroyed') h.reading.destroy();
    });
    h.win.emit('resize');
    assert.deepEqual(h.scrolls, []);
    assert.equal(h.doc.activeElement, interruption === 'other-focus' ? h.other : h.region);
  });

for (const read of ['geometry', 'final-style'])
  test(`${read} publication cannot reveal a retired resize owner`, (t) => {
    const h = resizeReading(t),
      rect = h.unit.getBoundingClientRect.bind(h.unit),
      style = h.win.getComputedStyle.bind(h.win);
    let measured = false;
    t.mock.method(h.unit, 'getBoundingClientRect', () => {
      measured = true;
      if (read === 'geometry') h.setScope('flight');
      return rect();
    });
    t.mock.method(h.win, 'getComputedStyle', (element) => {
      const value = style(element);
      if (read === 'final-style' && measured) h.doc.focused = false;
      return value;
    });
    h.win.emit('resize');
    assert.equal(measured, true);
    assert.deepEqual(h.scrolls, []);
    assert.equal(h.doc.activeElement, h.region);
  });

test('resize ignores descendant delivery and invalid viewport or unit geometry', (t) => {
  const h = resizeReading(t);
  h.region.emit('resize');
  assert.deepEqual(h.scrolls, []);
  for (const invalid of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    h.doc.documentElement.clientWidth = h.win.innerWidth = invalid;
    h.win.emit('resize');
  }
  h.doc.documentElement.clientWidth = h.win.innerWidth = 844;
  for (const invalid of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    h.unit._rect = { ...resizedOutside, height: invalid };
    h.win.emit('resize');
  }
  assert.deepEqual(h.scrolls, []);
  assert.equal(h.doc.activeElement, h.region);
});

test('reentrant and identical resize deliveries cannot repeatedly scroll an oversized reading unit', (t) => {
  const h = resizeReading(t),
    rect = h.unit.getBoundingClientRect.bind(h.unit);
  h.unit._rect = { ...resizedOutside, height: 600 };
  h.onHint(() => h.win.emit('resize'));
  t.mock.method(h.unit, 'getBoundingClientRect', () => {
    h.win.emit('resize');
    return rect();
  });
  t.mock.method(h.unit, 'scrollIntoView', (value) => {
    h.scrolls.push(value);
    h.win.emit('resize');
  });
  h.win.emit('resize');
  h.win.emit('resize');
  assert.deepEqual(h.scrolls, [resizeNearest]);
  h.unit._rect = { ...resizedOutside, x: -10, height: 600 };
  h.win.emit('resize');
  assert.deepEqual(
    h.scrolls,
    [resizeNearest, resizeNearest],
    'New geometry receives a fresh reveal.',
  );
  assert.equal(h.doc.activeElement, h.region);
});

test('resize stores no delayed restoration and removes its listener on teardown', async (t) => {
  const h = resizeReading(t);
  assert.equal(h.win.listeners.get('resize').size, 1);
  h.doc.focused = false;
  h.win.emit('resize');
  h.doc.focused = true;
  await Promise.resolve();
  assert.deepEqual(h.scrolls, []);
  h.win.emit('resize');
  assert.deepEqual(h.scrolls, [resizeNearest]);
  h.reading.destroy();
  assert.equal(h.win.listeners.get('resize').size, 0);
  h.win.emit('resize');
  assert.equal(h.scrolls.length, 1);
  assert.equal(h.done.disabled, true);
  assert.equal(h.doc.activeElement, h.region);
});

const pack = JSON.parse(
  await readFile(new URL('../content/packs/sentinel-relay.json', import.meta.url)),
);
const proof = JSON.parse(
  await readFile(new URL('../replays/sentinel-routes.json', import.meta.url)),
);
for (const policy of ['immediate', 'grid-center'])
  test(`reading entry/exit preserves a legal Sentinel live cut and terminal outcome: ${policy}`, (t) => {
    const f = fixture(t, 'flight'),
      route = proof.routes.find(
        (value) =>
          value.variant === 'ordinary' && value.classId === 'scout' && value.turnPolicy === policy,
      ),
      run = createRun(pack.campaigns[0].levels[0], {
        classRecipes: pack.classRecipes,
        classId: route.classId,
        turnPolicy: policy,
        seed: route.seed,
      });
    const commands = route.segments.flatMap((segment) =>
      Array.from({ length: segment.ticks }, () => segment.input),
    );
    for (const input of commands.slice(0, 610)) stepRun(run, input, FIXED_DT);
    assert.ok(run.trail.length > 0);
    const before = getSummary(run),
      expected = structuredClone(run);
    releaseInputs(expected);
    f.onTransition(() => releaseInputs(run));
    f.$('mission-brief-read').click();
    f.$('mission-brief-reading-done').click();
    assert.deepEqual(getSummary(run), before);
    assert.deepEqual(authoritativeCheckpoint(run), authoritativeCheckpoint(expected));
    for (const input of commands.slice(610)) stepRun(run, input, FIXED_DT);
    assert.deepEqual(getSummary(run), route.expected);
    const terminal = authoritativeCheckpoint(run);
    f.setScope('won');
    f.$('overlay-read').click();
    f.$('overlay-reading-done').click();
    assert.deepEqual(authoritativeCheckpoint(run), terminal);
    assert.equal(run.events.filter((event) => event.type === 'run.completed').length, 1);
  });

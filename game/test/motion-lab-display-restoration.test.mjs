import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Events } from './helpers/couch-dom.mjs';
import { getMotionDisplay } from '../../authoring/motion-lab/display.mjs';
import { DISPLAY_PREFERENCES_KEY } from '../display-preferences.mjs';

// The real preference/display owners run here. Browser history form restoration
// and task scheduling are explicit model inputs, not a native BFCache claim.
// Canvas identity/focus is only a sentinel here; real study state is covered by
// the complete Motion application host file.
function fixture(t) {
  const doc = new Document(),
    host = new Events(),
    control = doc.createElement('select'),
    notice = doc.createElement('p'),
    frame = doc.createElement('canvas'),
    media = Object.assign(new Events(), { matches: false }),
    timers = new Map(),
    writes = [];
  control.setAttribute('data-motion-text-size', '');
  notice.id = 'motion-display-notice';
  frame.setAttribute('data-study-state', 'paused-original');
  doc.body.append(control, notice, frame);
  doc.activeElement = frame;
  let raw = JSON.stringify({ textFace: 'plain', textSize: 'standard', reducedEffects: true }),
    failedSave = false,
    serial = 0;
  const storage = {
    getItem(key) {
      assert.equal(key, DISPLAY_PREFERENCES_KEY);
      return raw;
    },
    setItem(key, value) {
      assert.equal(key, DISPLAY_PREFERENCES_KEY);
      writes.push(value);
      if (failedSave) throw new Error('Saving denied');
      raw = value;
    },
  };
  host.matchMedia = () => media;
  host.setTimeout = (fn, ms) => {
    assert.equal(ms, 0);
    const id = ++serial;
    timers.set(id, fn);
    return id;
  };
  host.clearTimeout = (id) => timers.delete(id);
  host.localStorage = storage;
  const owner = getMotionDisplay(doc, host);
  assert.equal(
    getMotionDisplay(doc, host),
    owner,
    'Independent entry and app share one authority.',
  );
  t.after(() => owner.dispose());
  return {
    doc,
    host,
    control,
    notice,
    frame,
    timers,
    writes,
    owner,
    set failedSave(value) {
      failedSave = value;
    },
    external(values) {
      raw = JSON.stringify(values);
    },
    choose(value) {
      control.value = value;
      control.emit('change', { currentTarget: control });
    },
    flush() {
      for (const [id, fn] of [...timers]) {
        timers.delete(id);
        fn();
      }
    },
    assertFocusAndCanvasSentinel() {
      assert.equal(frame.getAttribute('data-study-state'), 'paused-original');
      assert.ok(frame.parentNode === doc.body && doc.activeElement === frame);
    },
  };
}

for (const persisted of [false, true]) {
  test(`Motion history-restored selector follows current owner after pageshow (persisted=${persisted})`, (t) => {
    const f = fixture(t);
    assert.equal(f.control.value, 'standard');
    // No change event: history restoration must not become preference intent.
    f.control.value = 'large';
    f.host.emit('pageshow', { persisted });
    assert.equal(f.control.value, 'standard');
    // Traversal can restore its form state after pageshow dispatch, too.
    f.control.value = 'large';
    f.flush();
    assert.equal(f.control.value, 'standard');
    assert.equal(f.doc.body.dataset.textFace, 'plain');
    assert.equal(f.doc.body.dataset.textSize, 'standard');
    assert.equal(f.doc.body.dataset.effects, 'reduced');
    assert.equal(f.writes.length, 0);
    f.assertFocusAndCanvasSentinel();
  });
}

test('Motion persisted return first refreshes shared authority, then corrects late stale form state', (t) => {
  const f = fixture(t);
  f.host.emit('pagehide', { persisted: true });
  assert.equal(f.owner.away, true);
  f.external({ textFace: 'pixel', textSize: 'large', reducedEffects: false });
  f.host.emit('pageshow', { persisted: true });
  f.control.value = 'standard';
  f.flush();
  assert.equal(f.control.value, 'large');
  assert.equal(f.doc.body.dataset.textFace, 'pixel');
  assert.equal(f.doc.body.dataset.textSize, 'large');
  assert.equal(f.doc.body.dataset.effects, 'full');
  assert.equal(f.writes.length, 0);
  assert.equal(f.owner.away, false);
  assert.equal(f.owner.interrupted, true, 'History return cannot grant Play intent.');
  f.assertFocusAndCanvasSentinel();
});

test('Motion history repair retains unsaved local intent and its persistence warning', (t) => {
  const f = fixture(t);
  f.failedSave = true;
  f.choose('large');
  const warning = f.notice.textContent;
  assert.match(warning, /could not be saved/);
  f.host.emit('pagehide', { persisted: true });
  assert.equal(f.owner.away, true);
  f.external({ textFace: 'pixel', textSize: 'standard', reducedEffects: false });
  f.host.emit('pageshow', { persisted: true });
  f.control.value = 'standard';
  f.flush();
  assert.equal(f.control.value, 'large');
  assert.equal(f.doc.body.dataset.textFace, 'plain');
  assert.equal(f.doc.body.dataset.textSize, 'large');
  assert.equal(f.doc.body.dataset.effects, 'reduced');
  assert.equal(f.notice.textContent, warning);
  assert.equal(f.writes.length, 1, 'Only the explicit failed save was attempted.');
  f.assertFocusAndCanvasSentinel();
});

test('Motion deferred repair reads newer explicit intent instead of replaying the earlier snapshot', (t) => {
  const f = fixture(t);
  f.host.emit('pageshow', { persisted: false });
  f.choose('large');
  f.flush();
  assert.equal(f.control.value, 'large');
  assert.equal(f.doc.body.dataset.textSize, 'large');
  assert.equal(f.writes.length, 1);
  assert.equal(JSON.parse(f.writes[0]).textSize, 'large');
  f.assertFocusAndCanvasSentinel();
});

test('Motion a second pageshow replaces its pending task and a frozen departure cancels it', (t) => {
  const f = fixture(t);
  f.host.emit('pageshow', { persisted: false });
  f.host.emit('pageshow', { persisted: true });
  assert.equal(f.timers.size, 1);
  const stale = [...f.timers.values()];
  f.host.emit('pagehide', { persisted: true });
  assert.equal(f.timers.size, 0);
  f.control.value = 'large';
  for (const callback of stale) callback();
  f.flush();
  assert.equal(f.control.value, 'large');
  f.host.emit('pageshow', { persisted: true });
  f.flush();
  assert.equal(f.control.value, 'standard');
  assert.equal(f.writes.length, 0);
});

test('Motion terminal disposal cancels deferred repair and stale callbacks cannot rewrite controls', (t) => {
  const f = fixture(t);
  f.host.emit('pageshow', { persisted: false });
  const callbacks = [...f.timers.values()];
  assert.equal(callbacks.length, 1);
  f.host.emit('pagehide', { persisted: false });
  assert.equal(f.timers.size, 0);
  assert.equal(f.host.listeners.get('pageshow')?.size ?? 0, 0);
  f.control.value = 'large';
  for (const callback of callbacks) callback();
  f.host.emit('pageshow', { persisted: false });
  assert.equal(f.control.value, 'large');
  assert.equal(f.writes.length, 0);
  f.assertFocusAndCanvasSentinel();
});

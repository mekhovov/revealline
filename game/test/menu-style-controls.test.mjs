import test from 'node:test';
import assert from 'node:assert/strict';
import { attachMenuStyleControls } from '../ui/menu-style-controls.mjs';
import { MENU_STYLE_PREFERENCES_KEY } from '../menu-style-preferences.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';

// Actual menu preference and view owners; stale browser form values and the
// deferred task boundary are modeled inputs, not native BFCache qualification.
function fixture(t, { writable = () => true } = {}) {
  const doc = new Document(),
    host = new Events(),
    nodes = {},
    timers = new Map(),
    writes = [],
    values = new Map([
      [MENU_STYLE_PREFERENCES_KEY, JSON.stringify({ palette: 'auto', ornaments: 'subtle' })],
      ['player-profile', 'unchanged earned artwork and progress'],
    ]);
  for (const [id, tag] of [
    ['menu-palette', 'select'],
    ['menu-ornaments', 'select'],
    ['menu-style-status', 'p'],
    ['keep-focus', 'button'],
  ]) {
    const node = doc.createElement(tag);
    node.id = id;
    doc.body.append(node);
    nodes[id] = node;
  }
  nodes['keep-focus'].focus();
  let serial = 0,
    failedSave = false;
  const storage = {
    getItem(key) {
      assert.equal(key, MENU_STYLE_PREFERENCES_KEY);
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      assert.equal(key, MENU_STYLE_PREFERENCES_KEY);
      writes.push([key, value]);
      if (failedSave) throw new Error('Saving unavailable');
      values.set(key, value);
    },
  };
  host.setTimeout = (callback, delay) => {
    assert.equal(delay, 0);
    const id = ++serial;
    timers.set(id, callback);
    return id;
  };
  host.clearTimeout = (id) => timers.delete(id);
  const owner = attachMenuStyleControls({
    document: doc,
    window: host,
    getStorage: () => storage,
    writable,
  });
  t.after(() => owner.dispose());
  return {
    doc,
    host,
    nodes,
    owner,
    timers,
    writes,
    values,
    set failedSave(value) {
      failedSave = value;
    },
    external(value) {
      values.set(MENU_STYLE_PREFERENCES_KEY, JSON.stringify(value));
    },
    choose(id, value) {
      nodes[id].value = value;
      nodes[id].emit('change');
    },
    stale() {
      nodes['menu-palette'].value = 'ukrainian';
      nodes['menu-ornaments'].value = 'rich';
    },
    flush() {
      for (const [id, callback] of [...timers]) {
        timers.delete(id);
        callback();
      }
    },
    assertView(palette = 'auto', ornaments = 'subtle') {
      assert.equal(nodes['menu-palette'].value, palette);
      assert.equal(nodes['menu-ornaments'].value, ornaments);
      assert.equal(doc.body.dataset.menuOrnaments, ornaments);
      assert.equal(doc.activeElement, nodes['keep-focus']);
      assert.equal(values.get('player-profile'), 'unchanged earned artwork and progress');
    },
  };
}

for (const persisted of [false, true]) {
  test(`unchanged menu authority repairs stale form values immediately (persisted=${persisted})`, (t) => {
    const f = fixture(t),
      before = new Map(f.values);
    f.stale();
    f.host.emit('pageshow', { persisted });
    f.assertView();
    assert.deepEqual(f.values, before);
    assert.deepEqual(f.writes, []);
  });

  test(`unchanged menu authority repairs late history form values (persisted=${persisted})`, (t) => {
    const f = fixture(t),
      before = new Map(f.values);
    f.host.emit('pageshow', { persisted });
    f.stale();
    f.flush();
    f.assertView();
    assert.deepEqual(f.values, before);
    assert.deepEqual(f.writes, []);
  });
}

test('restored menu form follows newly saved authority and retains later explicit intent', (t) => {
  const f = fixture(t);
  assert.deepEqual(f.owner.snapshot(), { palette: 'auto', ornaments: 'subtle', revision: 0 });
  f.host.emit('pagehide', { persisted: true });
  f.external({ palette: 'ukrainian', ornaments: 'off' });
  f.host.emit('pageshow', { persisted: true });
  f.assertView('ukrainian', 'off');
  assert.deepEqual(f.owner.snapshot(), { palette: 'ukrainian', ornaments: 'off', revision: 1 });
  f.choose('menu-ornaments', 'subtle');
  f.stale();
  f.flush();
  f.assertView('ukrainian', 'subtle');
  assert.deepEqual(f.owner.snapshot(), {
    palette: 'ukrainian',
    ornaments: 'subtle',
    revision: 2,
  });
  assert.deepEqual(f.writes, [
    [MENU_STYLE_PREFERENCES_KEY, JSON.stringify({ palette: 'ukrainian', ornaments: 'subtle' })],
  ]);
});

for (const readOnly of [false, true])
  test(`restored menu controls preserve ${readOnly ? 'read-only' : 'failed-save'} intent and warning`, (t) => {
    const f = fixture(t, { writable: () => !readOnly });
    f.failedSave = !readOnly;
    f.choose('menu-ornaments', 'off');
    const warning = f.nodes['menu-style-status'].textContent,
      attempted = [...f.writes];
    assert.match(warning, /session/);
    f.host.emit('pagehide', { persisted: true });
    f.external({ palette: 'ukrainian', ornaments: 'rich' });
    f.stale();
    f.host.emit('pageshow', { persisted: true });
    f.assertView('auto', 'off');
    f.stale();
    f.flush();
    f.assertView('auto', 'off');
    assert.equal(f.nodes['menu-style-status'].textContent, warning);
    assert.deepEqual(f.writes, attempted);
  });

test('disposed menu controls cannot repaint from captured deferred or future lifecycle events', (t) => {
  const f = fixture(t);
  f.host.emit('pageshow', { persisted: true });
  assert.equal(f.timers.size, 1);
  const deferred = [...f.timers.values()][0];
  f.owner.dispose();
  f.stale();
  deferred();
  f.host.emit('pageshow', { persisted: true });
  f.flush();
  assert.equal(f.timers.size, 0);
  assert.equal(f.nodes['menu-ornaments'].value, 'rich');
  assert.equal(f.doc.body.dataset.menuOrnaments, undefined);
  assert.deepEqual(f.writes, []);
});

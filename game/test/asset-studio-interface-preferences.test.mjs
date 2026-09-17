import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Events } from './helpers/couch-dom.mjs';
import { DISPLAY_PREFERENCES_KEY } from '../display-preferences.mjs';
import { mountInterfacePreferences } from '../../authoring/asset-studio/interface-preferences.mjs';

function fixture(t, { raw = null, system = false, denied = false, writeFailure = false } = {}) {
  const document = new Document(),
    window = new Events(),
    media = new Events();
  media.matches = system;
  window.matchMedia = () => media;
  const controls = {};
  for (const [name, tag] of [
    ['font', 'select'],
    ['size', 'select'],
    ['reduced', 'input'],
    ['cap', 'p'],
    ['status', 'p'],
  ]) {
    const element = document.createElement(tag);
    element.id = `studio-interface-${name}`;
    document.body.append(element);
    controls[name] = element;
  }
  const draft = document.createElement('textarea');
  draft.value = 'Unsaved provenance · Ґґ Єє Іі Її';
  document.body.append(draft);
  draft.focus();
  const before = [...document.body.children],
    writes = [];
  const records = new Map(raw === null ? [] : [[DISPLAY_PREFERENCES_KEY, raw]]);
  const storage = {
    getItem: (key) => records.get(key) ?? null,
    setItem(key, value) {
      writes.push([key, value]);
      if (writeFailure) throw new Error('Quota denied');
      records.set(key, value);
    },
  };
  const view = mountInterfacePreferences({
    document,
    window,
    getStorage: () => {
      if (denied) throw new Error('Storage denied');
      return storage;
    },
  });
  t.after(() => view.dispose());
  const change = (name, value) => {
    if (name === 'reduced') controls[name].checked = value;
    else controls[name].value = value;
    controls[name].emit('change');
  };
  const external = (value, eventValue = value) => {
    const stored = typeof value === 'string' ? value : JSON.stringify(value);
    records.set(DISPLAY_PREFERENCES_KEY, stored);
    window.emit('storage', {
      key: DISPLAY_PREFERENCES_KEY,
      storageArea: storage,
      newValue: typeof eventValue === 'string' ? eventValue : JSON.stringify(eventValue),
    });
  };
  const preserved = () => {
    assert.deepEqual(document.body.children, before);
    assert.equal(document.activeElement, draft);
    assert.equal(draft.value, 'Unsaved provenance · Ґґ Єє Іі Її');
  };
  return { document, window, media, controls, writes, records, view, change, external, preserved };
}
const plainLarge = { textFace: 'plain', textSize: 'large', reducedEffects: false };

test('mount applies stored preferences without writing or replacing the existing interface', (t) => {
  const f = fixture(t, { raw: JSON.stringify(plainLarge), system: true });
  assert.deepEqual(f.document.body.dataset, {
    textFace: 'plain',
    textSize: 'large',
    effects: 'reduced',
  });
  assert.equal(f.controls.font.value, 'plain');
  assert.equal(f.controls.size.value, 'large');
  assert.equal(f.controls.reduced.checked, false);
  assert.equal(f.controls.cap.hidden, false);
  assert.match(f.controls.cap.textContent, /system requests reduced motion/);
  assert.equal(f.writes.length, 0);
  assert.equal(
    'set' in f.view.motion,
    false,
    'Preview consumers cannot mutate the shared authority.',
  );
  f.preserved();
});

test('three explicit controls use the shared record and preserve unrelated authoring state', (t) => {
  const f = fixture(t);
  f.change('font', 'plain');
  f.change('size', 'large');
  f.change('reduced', true);
  assert.equal(f.writes.length, 3);
  assert.ok(f.writes.every(([key]) => key === DISPLAY_PREFERENCES_KEY));
  assert.deepEqual(JSON.parse(f.records.get(DISPLAY_PREFERENCES_KEY)), {
    ...plainLarge,
    reducedEffects: true,
  });
  assert.equal(f.document.body.dataset.effects, 'reduced');
  assert.equal(f.controls.cap.hidden, true);
  assert.equal(f.controls.status.hidden, true);
  f.preserved();
});

test('valid external preferences update in place while stale and malformed events cannot replace them', (t) => {
  const f = fixture(t);
  f.external(plainLarge);
  assert.equal(f.document.body.dataset.textFace, 'plain');
  const newest = { textFace: 'pixel', textSize: 'standard', reducedEffects: true };
  f.external(newest, plainLarge);
  assert.equal(f.document.body.dataset.textFace, 'plain', 'A stale event is ignored.');
  f.external(newest);
  assert.equal(f.document.body.dataset.textFace, 'pixel');
  assert.equal(f.document.body.dataset.effects, 'reduced');
  f.external('{malformed');
  assert.equal(f.document.body.dataset.effects, 'reduced');
  assert.equal(f.writes.length, 0);
  f.preserved();
});

test('malformed initial storage keeps readable defaults without a read-time repair write', (t) => {
  const f = fixture(t, { raw: '{malformed' });
  assert.deepEqual(f.document.body.dataset, {
    textFace: 'pixel',
    textSize: 'standard',
    effects: 'full',
  });
  assert.equal(f.writes.length, 0);
  f.change('size', 'large');
  assert.equal(JSON.parse(f.records.get(DISPLAY_PREFERENCES_KEY)).textSize, 'large');
  f.preserved();
});

test('denied storage leaves explicit session preferences usable with a visible save warning', (t) => {
  const f = fixture(t, { denied: true });
  f.change('font', 'plain');
  assert.equal(f.document.body.dataset.textFace, 'plain');
  assert.equal(f.controls.status.hidden, false);
  assert.match(f.controls.status.textContent, /could not be saved/);
  assert.equal(f.writes.length, 0);
  f.preserved();
});

test('a failed preference write preserves unsaved local intent against later remote changes', (t) => {
  const f = fixture(t, { writeFailure: true });
  f.change('size', 'large');
  f.external({ textFace: 'pixel', textSize: 'standard', reducedEffects: false });
  assert.equal(f.document.body.dataset.textSize, 'large');
  assert.equal(f.controls.size.value, 'large');
  assert.equal(f.controls.status.hidden, false);
  assert.equal(f.writes.length, 1);
  f.preserved();
});

test('live system reduction changes effective preview policy without changing player intent or writing', (t) => {
  const f = fixture(t),
    observations = [];
  const stop = f.view.motion.subscribe((state) => observations.push(state.effectiveReducedEffects));
  f.media.matches = true;
  f.media.emit('change');
  assert.equal(f.document.body.dataset.effects, 'reduced');
  assert.equal(f.controls.reduced.checked, false);
  assert.equal(f.controls.cap.hidden, false);
  f.media.matches = false;
  f.media.emit('change');
  assert.deepEqual(observations, [false, true, false]);
  assert.equal(f.controls.cap.hidden, true);
  assert.equal(f.writes.length, 0);
  stop();
  f.preserved();
});

test('disposal removes control and authority observers and makes late changes inert', (t) => {
  const f = fixture(t);
  f.view.dispose();
  f.view.dispose();
  f.change('size', 'large');
  f.external(plainLarge);
  f.media.matches = true;
  f.media.emit('change');
  assert.equal(f.document.body.dataset.textSize, 'standard');
  assert.equal(f.document.body.dataset.effects, 'full');
  assert.equal(f.writes.length, 0);
  assert.equal(f.window.listeners.get('storage').size, 0);
  assert.equal(f.media.listeners.get('change').size, 0);
  assert.throws(() => f.view.motion.subscribe(() => {}), /disposed/);
});

test('an invalid control value gives recovery feedback and restores the current choice without a write', (t) => {
  const f = fixture(t);
  f.change('font', 'unsupported');
  assert.equal(f.controls.font.value, 'pixel');
  assert.equal(f.document.body.dataset.textFace, 'pixel');
  assert.equal(f.controls.status.hidden, false);
  assert.match(f.controls.status.textContent, /could not be applied/);
  assert.equal(f.writes.length, 0);
  f.preserved();
});

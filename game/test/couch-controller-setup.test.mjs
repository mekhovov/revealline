import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Events } from './helpers/couch-dom.mjs';
import { mountControllerSetup } from '../couch/controller-setup.mjs';
import { createControllerSession } from '../couch/controller-session.mjs';
import { PROFILE_KEY } from '../couch/controller-profiles.mjs';
function setup(t) {
  const doc = new Document(),
    win = new Events(),
    root = doc.createElement('section');
  root.id = 'controls';
  doc.body.append(root);
  const values = new Map();
  win.localStorage = { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) };
  const session = createControllerSession({ eventTarget: win });
  const pad = {
    index: 0,
    id: 'EdgeTX',
    mapping: '',
    connected: true,
    axes: [0, 0, -1, 0, 0, 0, 0, 0],
    buttons: Array.from({ length: 24 }, () => ({ value: 0 })),
  };
  session.sample([pad]);
  const ui = mountControllerSetup({ root, session, document: doc, window: win });
  t.after(() => {
    ui.dispose();
    session.dispose();
  });
  const click = (action) => root.querySelector(`[data-controller-action="${action}"]`).click();
  return { doc, win, root, values, session, pad, ui, click };
}
test('guided radio mapping persists only multiplayer recipes and requires explicit verification', (t) => {
  const f = setup(t);
  f.click('configure');
  const selects = f.root.querySelectorAll('select');
  const action = selects[2],
    kind = selects[3];
  action.value = 'flight:right';
  kind.value = 'axis';
  f.click('released');
  f.pad.axes[6] = 0.8;
  f.click('capture');
  f.click('apply');
  assert.equal(f.values.has(PROFILE_KEY), false);
  f.root.querySelector('input[type="checkbox"]').checked = true;
  f.click('apply');
  assert.equal(JSON.parse(f.values.get(PROFILE_KEY)).profiles[0].flight.right[0].index, 6);
  f.pad.axes[6] = 0;
  f.session.sample([f.pad]);
  f.click('join2');
  assert.deepEqual(f.session.state().seats, [null, 0]);
  assert.equal(f.values.size, 1);
  assert.equal(JSON.parse(f.values.get(PROFILE_KEY)).profiles[0].device.mapping, '');
});
test('capture freezes controller navigation and focus loss discards the draft', (t) => {
  const f = setup(t);
  f.click('configure');
  f.click('released');
  f.pad.axes[0] = 1;
  f.session.sample([f.pad]);
  assert.equal(f.session.frame().menuPads.filter(Boolean).length, 0);
  f.win.dispatchEvent({ type: 'blur' });
  assert.equal(f.root.querySelector('fieldset').hidden, true);
  assert.equal(f.values.size, 0);
});
test('profile export/import does not silently join a device and malformed input is atomic', (t) => {
  const f = setup(t);
  f.click('configure');
  f.root.querySelector('input[type="checkbox"]').checked = true;
  f.click('apply');
  f.click('export');
  const text = f.root.querySelector('textarea');
  assert.match(text.value, /CouchControllerProfiles/);
  const before = f.values.get(PROFILE_KEY);
  text.value = '{"format":"future"}';
  f.click('import');
  assert.equal(f.values.get(PROFILE_KEY), before);
  assert.deepEqual(f.session.state().seats, [null, null]);
});

test('TX15 setup offers explicit Solo-style and shared-stick assignments', (t) => {
  const f = setup(t);
  f.pad.id = 'TX15 Joystick (Vendor: 1209 Product: 4f54)';
  f.session.sample([f.pad]);
  f.ui.refresh();
  f.click('tx15Right');
  assert.equal(f.session.state().devices[0].profile.flight.up[0].index, 1);
  f.click('tx15Shared');
  assert.deepEqual(f.session.state().seats, [1024, 1025]);
  assert.equal(f.session.completeFlight(1), false, 'partial profiles preserve touch actions');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { couchPage } from './helpers/couch-host.mjs';

const press = (page, key, extra = {}) =>
  page.doc.activeElement.emit('keydown', { key, code: key, ...extra });
const pad = (index) => ({
  index,
  id: `Settings pad ${index}`,
  connected: true,
  mapping: 'standard',
  axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 16 }, () => ({ value: 0, pressed: false })),
});

test('Versus Settings uses native categories, consumes tab keys once and returns to its opener', async (t) => {
  const f = await couchPage(t),
    before = f.checkpoint();
  f.$('race-options').click();
  assert.equal(f.doc.activeElement.id, 'race-settings-tab-display');
  press(f, 'Tab');
  assert.equal(f.doc.activeElement.id, 'race-text-face');
  press(f, 'Tab', { shiftKey: true });
  assert.equal(f.doc.activeElement.id, 'race-settings-tab-display');
  assert.equal(f.$('race-settings-tab-display').getAttribute('aria-selected'), 'true');
  // Arrow navigation may focus an inactive category without selecting it.
  // Subsequent sequential keys continue from that actual DOM position.
  press(f, 'ArrowDown');
  assert.equal(f.doc.activeElement.id, 'race-settings-tab-data');
  assert.equal(f.doc.activeElement.tabIndex, -1);
  press(f, 'Tab');
  assert.equal(f.doc.activeElement.id, 'race-text-face');
  press(f, 'Tab', { shiftKey: true });
  press(f, 'ArrowUp');
  assert.equal(f.doc.activeElement.id, 'race-settings-tab-audio');
  assert.equal(f.doc.activeElement.tabIndex, -1);
  press(f, 'Tab', { shiftKey: true });
  assert.equal(f.doc.activeElement.id, 'race-options-back');
  assert.equal(f.$('race-journey-reactions-retry').hidden, false);
  // Storage recovery and the visible reaction preference belong to the same
  // native Tab cycle as the other Display controls, in both directions.
  for (const id of [
    'race-journey-reactions-retry',
    'race-journey-reactions-enabled',
    'race-reduced',
  ]) {
    press(f, 'Tab', { shiftKey: true });
    assert.equal(f.doc.activeElement.id, id);
  }
  for (const id of [
    'race-journey-reactions-enabled',
    'race-journey-reactions-retry',
    'race-options-back',
  ]) {
    press(f, 'Tab');
    assert.equal(f.doc.activeElement.id, id);
  }
  press(f, 'Tab');
  assert.equal(f.doc.activeElement.id, 'race-settings-tab-display');
  press(f, 'ArrowLeft');
  assert.equal(f.doc.activeElement.id, 'race-settings-tab-audio');
  assert.equal(f.$('race-settings-panel-audio').hidden, false);
  assert.equal(f.$('race-settings-panel-display').inert, true);
  press(f, 'Home');
  assert.equal(f.doc.activeElement.id, 'race-settings-tab-controls');
  press(f, 'End');
  assert.equal(f.doc.activeElement.id, 'race-settings-tab-data');
  press(f, 'Escape');
  assert.equal(f.doc.activeElement.id, 'race-options');
  assert.equal(f.$('race-options-panel').inert, true);
  f.$('race-options').click();
  assert.equal(f.doc.activeElement.id, 'race-settings-tab-data');
  assert.equal(f.state(), 'ready');
  assert.deepEqual(f.checkpoint(), before);
});

test('paused Versus keeps both runs and requires explicit Resume after appearance changes', async (t) => {
  const f = await couchPage(t);
  f.$('race-start').click();
  f.frame();
  f.key('KeyD');
  f.frames(4);
  f.$('race-pause').click();
  f.frame(0);
  const paused = f.checkpoint();
  f.$('race-options').click();
  f.$('race-text-size').value = 'large';
  f.$('race-text-size').emit('change');
  f.$('race-settings-tab-controls').click();
  f.$('race-options-back').click();
  f.frames(4);
  assert.equal(f.state(), 'paused');
  assert.equal(f.doc.body.dataset.textSize, 'large');
  assert.equal(f.doc.activeElement.id, 'race-options');
  assert.deepEqual(f.checkpoint(), paused);
  f.$('race-start').click();
  f.frame();
  assert.equal(f.state(), 'running');
});

test('Versus quick sound shares the Settings master without starting or replacing a match', async (t) => {
  const f = await couchPage(t),
    before = f.checkpoint();
  assert.equal(f.$('race-quick-sound').textContent, 'Sound: off');
  f.$('race-quick-sound').click();
  assert.equal(f.$('race-quick-sound').textContent, 'Sound: on');
  assert.equal(f.$('race-quick-sound').getAttribute('aria-pressed'), 'true');
  f.$('race-options').click();
  f.$('race-settings-tab-audio').click();
  assert.equal(f.$('race-audio').textContent, 'Mute sound');
  f.$('race-audio').click();
  f.$('race-options-back').click();
  assert.equal(f.$('race-quick-sound').textContent, 'Sound: off');
  assert.equal(f.$('race-quick-sound').getAttribute('aria-pressed'), 'false');
  assert.equal(f.state(), 'ready');
  assert.deepEqual(f.checkpoint(), before);
});

test('modeled controller selects Settings categories and Back preserves its Ready match', async (t) => {
  const f = await couchPage(t, { pads: [pad(0), pad(1)] }),
    before = f.checkpoint();
  f.join(0);
  f.focus('race-options');
  f.pulse(0, 0);
  assert.equal(f.$('race-options-panel').hidden, false);
  assert.equal(f.doc.activeElement.id, 'race-settings-tab-display');
  f.pulse(0, 12);
  assert.equal(f.doc.activeElement.id, 'race-settings-tab-audio');
  assert.equal(f.doc.activeElement.tabIndex, -1, 'Spatial navigation still reaches inactive tabs.');
  f.pulse(0, 0);
  assert.equal(f.$('race-settings-tab-audio').getAttribute('aria-selected'), 'true');
  assert.equal(f.$('race-settings-panel-audio').inert, false);
  f.pulse(0, 1);
  assert.equal(f.$('race-options-panel').hidden, true);
  assert.equal(f.doc.activeElement.id, 'race-options');
  assert.equal(f.state(), 'ready');
  assert.deepEqual(f.checkpoint(), before);
});

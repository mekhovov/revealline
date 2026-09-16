// Actual Solo app, reading adapters and controller router; finite browser boundaries.
import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, memoryStorage } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { emptyLibrary, exportLibrary, updatePreferences } from '../library.mjs';
import { resolveControllerBindings, controllerBindingLabels } from '../controller-bindings.mjs';

const keyboardPrompt = /Up\/Down scroll · Enter, Space or Escape returns/;
const key = (element, value) => {
  const event = element.emit('keydown', {
    key: value,
    code: value === ' ' ? 'Space' : value,
    repeat: false,
  });
  // The adapter deliberately leaves native button activation to the browser.
  const nativeButton = !event.defaultPrevented && element.tagName === 'BUTTON';
  if (nativeButton && value === 'Enter') element.click();
  element.emit('keyup', { key: value, code: value === ' ' ? 'Space' : value });
  if (nativeButton && value === ' ') element.click();
  return event;
};
async function help(t, options = {}) {
  const h = await soloPage(t, options);
  h.$('help-button').click();
  h.$('help-reading').clientHeight = 100;
  h.$('help-reading').scrollHeight = 480;
  h.frame(0);
  const checkpoint = authoritativeCheckpoint(h.rendered.run),
    stored = [...h.storage.map],
    writes = h.storage.writes.length;
  return {
    h,
    entry: h.$('help-read'),
    region: h.$('help-reading'),
    done: h.$('help-reading-done'),
    assertUnchanged() {
      h.frame(0);
      assert.deepEqual(authoritativeCheckpoint(h.rendered.run), checkpoint);
      assert.deepEqual([...h.storage.map], stored);
      assert.equal(h.storage.writes.length, writes);
      assert.equal(h.$('help-dialog').open, true);
      assert.deepEqual(h.errors, []);
    },
  };
}
function controller(h, t) {
  const prior = Object.getOwnPropertyDescriptor(performance, 'now');
  let now = 1000;
  Object.defineProperty(performance, 'now', { configurable: true, value: () => now });
  t.after(() =>
    prior ? Object.defineProperty(performance, 'now', prior) : delete performance.now,
  );
  const pad = {
    index: 0,
    id: 'Reading prompt controller',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  navigator.getGamepads = () => [pad];
  const frame = () => {
    now += 16;
    h.frame(16);
  };
  frame();
  frame();
  return {
    frame,
    pulse(index) {
      pad.buttons[index] = { pressed: true, value: 1 };
      frame();
      pad.buttons[index] = { pressed: false, value: 0 };
      frame();
    },
  };
}
function assertKeyboard(f) {
  assert.equal(f.h.doc.body.dataset.inputMode, 'keyboard');
  assert.equal(f.h.doc.activeElement.id, f.region.id);
  assert.equal(f.done.disabled, false);
  assert.match(f.h.$('help-reading-hint').textContent, keyboardPrompt);
  assert.match(f.h.$('controller-ui-hint').textContent, keyboardPrompt);
}

for (const exit of ['Enter', ' ', 'Escape'])
  test(`actual keyboard reader advertises keys and ${JSON.stringify(exit)} returns once`, async (t) => {
    const f = await help(t);
    f.entry.focus();
    assert.equal(key(f.entry, 'Enter').defaultPrevented, false);
    assertKeyboard(f);
    assert.equal(key(f.region, exit).defaultPrevented, true);
    assert.equal(f.h.doc.activeElement.id, f.entry.id);
    assert.equal(f.done.disabled, true);
    f.assertUnchanged();
  });

test('first keyboard Enter after controller navigation publishes keyboard copy synchronously', async (t) => {
  const f = await help(t),
    pad = controller(f.h, t);
  pad.pulse(13);
  assert.equal(f.h.doc.body.dataset.inputMode, 'controller');
  f.entry.focus();
  key(f.entry, 'Enter');
  assertKeyboard(f);
  f.assertUnchanged();
});

test('first keyboard scroll inside controller reading changes only its prompt and scroll', async (t) => {
  const f = await help(t),
    pad = controller(f.h, t);
  f.entry.focus();
  pad.pulse(0);
  assert.equal(f.h.doc.body.dataset.inputMode, 'controller');
  assert.match(f.h.$('help-reading-hint').textContent, /South or East returns/);
  const before = f.region.scrollTop;
  key(f.region, 'ArrowDown');
  assertKeyboard(f);
  assert.ok(f.region.scrollTop > before);
  f.assertUnchanged();
});

test('keyboard to controller reading uses the actual remapped labels and consumes mapped Back', async (t) => {
  const bindings = resolveControllerBindings();
  bindings.menu.buttons.confirm = 5;
  bindings.menu.buttons.back = 2;
  bindings.glyphFamily = 'playstation';
  const labels = controllerBindingLabels(bindings).menu,
    storage = memoryStorage({
      'revealline.library.dev.v1': exportLibrary(
        updatePreferences(emptyLibrary(), { controllerBindings: bindings }),
      ),
    }),
    f = await help(t, { storage }),
    pad = controller(f.h, t);
  f.entry.focus();
  key(f.entry, 'Enter');
  assertKeyboard(f);
  pad.frame();
  pad.pulse(13);
  assert.equal(f.h.doc.body.dataset.inputMode, 'controller');
  assert.equal(f.h.doc.activeElement.id, f.region.id);
  for (const id of ['help-reading-hint', 'controller-ui-hint'])
    assert.ok(f.h.$(id).textContent.includes(`${labels.confirm} or ${labels.back} returns`));
  pad.pulse(2);
  assert.equal(f.h.doc.activeElement.id, f.entry.id);
  assert.equal(f.done.disabled, true);
  f.assertUnchanged();
});

test('touch entry advertises the actual Done action and its native click returns without starting', async (t) => {
  const f = await help(t);
  f.entry.emit('pointerdown', { pointerType: 'touch', button: 0, isPrimary: true });
  f.entry.focus();
  f.entry.click();
  assert.equal(f.h.doc.body.dataset.inputMode, 'touch');
  assert.equal(f.h.doc.activeElement.id, f.region.id);
  for (const id of ['help-reading-hint', 'controller-ui-hint'])
    assert.match(f.h.$(id).textContent, /Scroll to read · Done reading returns/);
  f.done.emit('pointerdown', { pointerType: 'touch', button: 0, isPrimary: true });
  f.done.click();
  assert.equal(f.h.doc.activeElement.id, f.entry.id);
  assert.equal(f.done.disabled, true);
  f.assertUnchanged();
});

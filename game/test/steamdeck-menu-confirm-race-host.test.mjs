import test from 'node:test';
import assert from 'node:assert/strict';
import { settle, soloPage } from './helpers/solo-dom.mjs';

const keyboardClick = (target) =>
  target.emit('click', {
    isTrusted: true,
    detail: 0,
    button: -1,
    pointerId: -1,
    pointerType: '',
  });

// Model the browser's default activation as well as the DOM event. Calling
// HTMLElement.click() here would incorrectly make the native winner untrusted.
function nativeKeyDown(target, key = 'Enter') {
  const event = target.emit('keydown', {
    key,
    code: key === ' ' ? 'Space' : key,
    repeat: false,
    isTrusted: true,
  });
  if (!event.defaultPrevented && key === 'Enter') keyboardClick(target);
  return event;
}

function nativeKeyUp(target, key = 'Enter', down) {
  const event = target.emit('keyup', {
    key,
    code: key === ' ' ? 'Space' : key,
    isTrusted: true,
  });
  if (!down?.defaultPrevented && !event.defaultPrevented && key === ' ') keyboardClick(target);
  return event;
}

function pointer(pointerType, pointerId = 71) {
  return {
    button: 0,
    buttons: 1,
    pointerId,
    pointerType,
    isPrimary: true,
    isTrusted: true,
    detail: 1,
    ...(pointerType === 'touch' ? { sourceCapabilities: { firesTouchEvents: true } } : {}),
  };
}

async function deckPage(t, options = {}) {
  let time = 1000;
  t.mock.method(performance, 'now', () => time);
  const pad = {
      index: 0,
      id: 'Steam Deck',
      connected: true,
      mapping: 'standard',
      timestamp: time,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    },
    page = await soloPage(t, {
      readPads: () => (pad.connected ? [pad] : []),
      initialReadyTimeoutMs: 30000,
      ...options,
    }),
    elapse = (milliseconds) => {
      time += milliseconds;
      pad.timestamp = time;
    },
    frame = (milliseconds = 20) => {
      elapse(milliseconds);
      page.frame(milliseconds);
    },
    hold = (pressed) => {
      pad.buttons[0] = { pressed, value: pressed ? 1 : 0 };
      pad.timestamp = time;
    };
  frame();
  frame();
  return { page, pad, elapse, frame, hold };
}

test('Steam Deck native events before RAF capture short Confirm taps without press-time activation', async (t) => {
  const { page, frame, hold, elapse } = await deckPage(t, { titleScreen: true });

  for (const key of ['Enter', ' ']) {
    frame(1500);
    const target = page.$('shell-sound'),
      before = target.getAttribute('aria-pressed');
    target.focus();
    hold(true);
    const down = nativeKeyDown(target, key);
    assert.equal(down.defaultPrevented, true, `${key} sees raw A before the next RAF`);
    assert.equal(target.getAttribute('aria-pressed'), before, `${key} cannot activate on A-down`);
    elapse(60);
    hold(false);
    nativeKeyUp(target, key, down);
    frame();
    const after = target.getAttribute('aria-pressed');
    assert.notEqual(after, before, `${key} tap between RAF frames commits on release`);
    keyboardClick(target);
    frame();
    assert.equal(
      target.getAttribute('aria-pressed'),
      after,
      `${key} release echo cannot toggle back`,
    );
  }

  for (const pointerType of ['mouse', 'touch', 'pen']) {
    frame(1500);
    const target = page.$('shell-sound'),
      before = target.getAttribute('aria-pressed'),
      event = pointer(pointerType);
    target.focus();
    hold(true);
    assert.equal(
      target.emit('pointerdown', event).defaultPrevented,
      true,
      `${pointerType} sees raw A before the next RAF`,
    );
    target.emit('mousedown', event);
    assert.equal(
      target.getAttribute('aria-pressed'),
      before,
      `${pointerType} cannot activate on down`,
    );
    elapse(60);
    hold(false);
    target.emit('pointerup', { ...event, buttons: 0 });
    target.emit('mouseup', { ...event, buttons: 0 });
    // Steam Input can deliver a separate click even when the pointer default
    // was cancelled. It must not be the first/second uncontrolled activation.
    target.emit('click', { ...event, buttons: 0, isPrimary: false });
    frame();
    const after = target.getAttribute('aria-pressed');
    assert.notEqual(after, before, `${pointerType} tap between frames commits once`);
    target.emit('click', { ...event, buttons: 0, isPrimary: false });
    frame();
    assert.equal(
      target.getAttribute('aria-pressed'),
      after,
      `${pointerType} click tail is consumed`,
    );
  }
  assert.deepEqual(page.errors, []);
});

test('a native-first activation keeps ownership after changing the Solo menu scope', async (t) => {
  const cases = [
    {
      name: 'Settings',
      options: { titleScreen: true },
      targetId: 'shell-options',
      applied: (page) => page.$('settings-dialog').open,
      focusAfterNative: (page) =>
        page.doc.querySelector('button[data-close="settings-dialog"]').focus(),
    },
    {
      name: 'Start mission',
      options: {},
      targetId: 'start-button',
      applied: (page) => page.doc.body.dataset.flightState === 'running',
    },
  ];
  for (const entry of cases)
    await t.test(entry.name, async (t) => {
      const { page, frame, hold, elapse } = await deckPage(t, entry.options),
        target = page.$(entry.targetId),
        originalHandler = target.onclick;
      let activations = 0;
      target.onclick = function (...args) {
        activations++;
        return originalHandler.apply(this, args);
      };
      target.focus();
      const down = nativeKeyDown(target);
      assert.equal(
        down.defaultPrevented,
        false,
        'native activation can win before raw A is visible',
      );
      await settle(() => entry.applied(page));
      assert.equal(activations, 1);
      // Native showModal() transfers focus. The minimal host DOM does not do
      // that automatically, so reproduce the browser's newly focused scope.
      entry.focusAfterNative?.(page);

      // Gamepad state appears after the native click and after its handler has
      // replaced the scope. The entire later hold still belongs to that click.
      elapse(40);
      hold(true);
      frame();
      assert.equal(entry.applied(page), true);
      elapse(5000);
      frame();
      hold(false);
      nativeKeyUp(target, 'Enter', down);
      frame();
      assert.equal(
        activations,
        1,
        `${entry.name} native winner remains final after a five-second hold`,
      );
      assert.equal(
        entry.applied(page),
        true,
        `${entry.name} remains applied after the later A release`,
      );
      assert.deepEqual(page.errors, []);
    });
});

test('native-only keyboard and touchscreen recover after a cancelled long controller hold', async (t) => {
  const { page, pad, frame, hold } = await deckPage(t, { titleScreen: true }),
    target = page.$('shell-sound'),
    before = target.getAttribute('aria-pressed');
  target.focus();
  hold(true);
  frame();
  frame(5000);
  assert.equal(target.getAttribute('aria-pressed'), before);
  page.win.emit('blur');
  pad.connected = false;
  hold(false);
  frame();
  assert.equal(
    target.getAttribute('aria-pressed'),
    before,
    'blur/disconnect cancels without activation',
  );

  frame(1500);
  target.focus();
  const down = nativeKeyDown(target);
  nativeKeyUp(target, 'Enter', down);
  assert.equal(down.defaultPrevented, false, 'keyboard works when no Gamepad transaction owns it');
  assert.notEqual(target.getAttribute('aria-pressed'), before);
  frame(1500);
  const touch = pointer('touch', 89);
  assert.equal(target.emit('pointerdown', touch).defaultPrevented, false);
  target.emit('pointerup', { ...touch, buttons: 0 });
  assert.equal(target.emit('click', { ...touch, buttons: 0 }).defaultPrevented, false);
  assert.equal(
    target.getAttribute('aria-pressed'),
    before,
    'touchscreen remains an independent gesture',
  );
  assert.deepEqual(page.errors, []);
});

test('a scope change cancels a five-second Confirm hold but still owns its native release', async (t) => {
  const { page, frame, hold, elapse } = await deckPage(t, { titleScreen: true }),
    sound = page.$('shell-sound'),
    before = sound.getAttribute('aria-pressed'),
    settings = page.$('settings-dialog'),
    close = page.doc.querySelector('button[data-close="settings-dialog"]');
  sound.focus();
  hold(true);
  frame();
  settings.showModal();
  close.focus();
  frame();
  elapse(5000);
  const down = nativeKeyDown(close);
  assert.equal(down.defaultPrevented, true, 'cancelled hold keeps ownership beyond the echo timer');
  assert.equal(settings.open, true, 'native Enter cannot close the new scope');
  const touch = pointer('touch', 97);
  assert.equal(close.emit('pointerdown', touch).defaultPrevented, true);
  hold(false);
  nativeKeyUp(close, 'Enter', down);
  close.emit('pointerup', { ...touch, buttons: 0 });
  assert.equal(close.emit('click', { ...touch, buttons: 0 }).defaultPrevented, true);
  frame();
  assert.equal(sound.getAttribute('aria-pressed'), before, 'cancelled target never activates');
  assert.equal(settings.open, true, 'cancelled release never activates the new target');
  frame(1500);
  assert.equal(keyboardClick(close).defaultPrevented, false);
  assert.equal(settings.open, false, 'new native activation works after the gesture ends');
  assert.deepEqual(page.errors, []);
});

test('an unrelated native activation cannot steal a later Confirm on another control', async (t) => {
  const { page, pad, frame, hold } = await deckPage(t, { titleScreen: true }),
    sound = page.$('shell-sound'),
    before = sound.getAttribute('aria-pressed'),
    settings = page.$('shell-options');
  sound.focus();
  const touch = pointer('touch', 101);
  sound.emit('pointerdown', touch);
  sound.emit('pointerup', { ...touch, buttons: 0 });
  assert.equal(sound.emit('click', { ...touch, buttons: 0 }).defaultPrevented, false);
  const after = sound.getAttribute('aria-pressed');
  assert.notEqual(after, before);

  // Explicit controller navigation establishes a new intended target while
  // the earlier independent touch is still inside the native lead window.
  pad.buttons[12] = { pressed: true, value: 1 };
  frame();
  pad.buttons[12] = { pressed: false, value: 0 };
  frame();
  settings.focus();
  hold(true);
  frame();
  assert.equal(page.$('settings-dialog').open, false);
  hold(false);
  frame();
  assert.equal(page.$('settings-dialog').open, true, 'the new Confirm opens its own target');
  assert.equal(sound.getAttribute('aria-pressed'), after, 'the prior touch remains exactly once');
  assert.deepEqual(page.errors, []);
});

test('disconnect after a committed Confirm immediately restores genuine touchscreen input', async (t) => {
  const { page, pad, frame, hold } = await deckPage(t, { titleScreen: true }),
    sound = page.$('shell-sound'),
    before = sound.getAttribute('aria-pressed');
  sound.focus();
  hold(true);
  frame();
  hold(false);
  frame();
  assert.notEqual(sound.getAttribute('aria-pressed'), before, 'controller release commits once');

  // Disconnect occurs while the just-committed gesture still has a release
  // tail, rather than during an active hold. No echo timer is advanced here.
  pad.connected = false;
  frame();
  const touch = pointer('touch', 109);
  assert.equal(sound.emit('pointerdown', touch).defaultPrevented, false);
  assert.equal(sound.emit('pointerup', { ...touch, buttons: 0 }).defaultPrevented, false);
  assert.equal(sound.emit('click', { ...touch, buttons: 0 }).defaultPrevented, false);
  assert.equal(
    sound.getAttribute('aria-pressed'),
    before,
    'touch works immediately after disconnect',
  );
  assert.deepEqual(page.errors, []);
});

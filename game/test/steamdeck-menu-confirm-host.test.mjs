import test from 'node:test';
import assert from 'node:assert/strict';
import { settle, soloPage } from './helpers/solo-dom.mjs';

function nativeConfirm(page) {
  const target = page.doc.activeElement,
    down = target.emit('keydown', { key: 'Enter', code: 'Enter', repeat: false });
  if (!down.defaultPrevented && target.tagName === 'BUTTON') target.click();
  target.emit('keyup', { key: 'Enter', code: 'Enter' });
  return down;
}

test('Steam Deck A owns its delayed Chrome activation across quick actions and dialogs', async (t) => {
  let time = 1000;
  const pad = {
      index: 0,
      id: 'Steam Deck',
      connected: true,
      mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    },
    page = await soloPage(t, {
      titleScreen: true,
      readPads: () => [pad],
      initialReadyTimeoutMs: 30000,
    });
  t.mock.method(performance, 'now', () => time);
  const frame = (milliseconds = 20) => {
      time += milliseconds;
      page.frame(milliseconds);
    },
    pulse = (index) => {
      pad.buttons[index] = { pressed: true, value: 1 };
      frame();
      pad.buttons[index] = { pressed: false, value: 0 };
      frame();
    },
    reach = (id, limit = 80) => {
      for (let step = 0; step < limit && page.doc.activeElement.id !== id; step++) pulse(13);
      assert.equal(page.doc.activeElement.id, id, `${id} must be controller reachable`);
    },
    echo = () => {
      time += 120;
      const event = nativeConfirm(page);
      assert.equal(event.defaultPrevented, true, 'Chrome Enter echo must be consumed');
      const click = page.doc.activeElement.emit('click', {
        button: 0,
        detail: 0,
        isTrusted: true,
      });
      assert.equal(click.defaultPrevented, true, 'Chrome trusted click echo must be consumed');
      frame();
    };

  frame();
  frame();

  reach('shell-sound');
  const beforeSound = page.$('shell-sound').textContent;
  pulse(0);
  const afterSound = page.$('shell-sound').textContent;
  assert.notEqual(afterSound, beforeSound);
  echo();
  assert.equal(page.$('shell-sound').textContent, afterSound, 'Sound changes exactly once');

  reach('shell-options');
  pulse(0);
  assert.equal(page.$('settings-dialog').open, true);
  echo();
  assert.equal(page.$('settings-dialog').open, true, 'Settings stays open after the native echo');
  page.doc.querySelector('button[data-close="settings-dialog"]').click();
  frame();
  assert.equal(page.$('settings-dialog').open, false);

  reach('shell-workshop');
  pulse(0);
  assert.equal(page.$('shell-workshop-dialog').open, true);
  echo();
  assert.equal(page.$('shell-workshop-dialog').open, true, 'More stays on its intended menu');
  page.doc.querySelector('button[data-close="shell-workshop-dialog"]').click();
  frame();
  assert.equal(page.$('shell-workshop-dialog').open, false);

  reach('shell-sound');
  time += 1300;
  frame();
  const beforeNativeFirst = page.$('shell-sound').textContent;
  const nativeFirst = page.doc.activeElement.emit('click', {
    button: -1,
    pointerId: -1,
    pointerType: '',
    detail: 0,
    isTrusted: true,
  });
  assert.equal(nativeFirst.defaultPrevented, false, 'the leading native activation remains usable');
  const afterNativeFirst = page.$('shell-sound').textContent;
  assert.notEqual(afterNativeFirst, beforeNativeFirst);
  pulse(0);
  assert.equal(
    page.$('shell-sound').textContent,
    afterNativeFirst,
    'a later Gamepad frame cannot apply the same press twice',
  );
});

test('Steam Deck trusted click tails cannot undo Start or paused-menu actions', async (t) => {
  let time = 4000;
  const pad = {
      index: 0,
      id: 'Steam Deck',
      connected: true,
      mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    },
    page = await soloPage(t, { readPads: () => [pad] });
  t.mock.method(performance, 'now', () => time);
  const frame = (milliseconds = 20) => {
      time += milliseconds;
      page.frame(milliseconds);
    },
    pulse = (index) => {
      pad.buttons[index] = { pressed: true, value: 1 };
      frame();
      pad.buttons[index] = { pressed: false, value: 0 };
      frame();
    },
    trustedClickEcho = () => {
      time += 1000;
      const event = page.doc.activeElement.emit('click', {
        button: 0,
        detail: 0,
        isTrusted: true,
      });
      assert.equal(event.defaultPrevented, true, 'release-delayed trusted click is consumed');
      frame();
    };

  frame();
  frame();
  page.$('start-button').focus();
  pulse(0);
  await settle(() => page.doc.body.dataset.flightState === 'running');
  trustedClickEcho();
  assert.equal(page.doc.body.dataset.flightState, 'running', 'Start mission applies exactly once');

  page.$('pause-button').click();
  assert.equal(page.$('game-overlay').dataset.kind, 'pause');
  frame();
  frame();
  page.$('overlay-sound').focus();
  const beforeSound = page.$('overlay-sound').textContent;
  pad.buttons[0] = { pressed: true, value: 1 };
  frame();
  const afterSound = page.$('overlay-sound').textContent;
  assert.notEqual(afterSound, beforeSound);
  time += 5000;
  pad.buttons[0] = { pressed: false, value: 0 };
  frame();
  const heldRelease = page.doc.activeElement.emit('click', {
    button: -1,
    pointerId: -1,
    pointerType: '',
    detail: 0,
    isTrusted: true,
  });
  assert.equal(heldRelease.defaultPrevented, true, 'long-held A release is consumed');
  assert.equal(page.$('overlay-sound').textContent, afterSound, 'paused Sound changes once');

  page.$('overlay-settings').focus();
  pulse(0);
  assert.equal(page.$('settings-dialog').open, true);
  trustedClickEcho();
  assert.equal(page.$('settings-dialog').open, true, 'paused Settings stays open');
});

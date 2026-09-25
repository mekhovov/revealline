import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage } from './helpers/solo-dom.mjs';

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
});

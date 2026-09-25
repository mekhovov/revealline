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
      const target = page.doc.activeElement,
        pointer = {
          button: 0,
          pointerId: 7,
          pointerType: 'touch',
          isPrimary: true,
          detail: 1,
          isTrusted: true,
        };
      assert.equal(target.emit('pointerdown', pointer).defaultPrevented, true);
      assert.equal(target.emit('pointerup', pointer).defaultPrevented, true);
      const event = nativeConfirm(page);
      assert.equal(event.defaultPrevented, true, 'Chrome Enter echo must be consumed');
      assert.equal(
        target.emit('click', pointer).defaultPrevented,
        true,
        'Chrome trusted touch click echo must be consumed',
      );
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
  assert.equal(
    page.$('controller-navigation-help').closest('details').open,
    false,
    'controller navigation help stays collapsed',
  );
  echo();
  assert.equal(page.$('settings-dialog').open, true, 'Settings stays open after the native echo');
  time += 1300;
  page.doc.querySelector('button[data-close="settings-dialog"]').click();
  frame();
  assert.equal(page.$('settings-dialog').open, false);

  reach('shell-workshop');
  pulse(0);
  assert.equal(page.$('shell-workshop-dialog').open, true);
  echo();
  assert.equal(page.$('shell-workshop-dialog').open, true, 'More stays on its intended menu');
  time += 1300;
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
      const target = page.doc.activeElement,
        pointer = {
          button: 0,
          pointerId: 13,
          pointerType: 'touch',
          isPrimary: true,
          detail: 1,
          isTrusted: true,
          sourceCapabilities: { firesTouchEvents: true },
        };
      assert.equal(target.emit('pointerdown', pointer).defaultPrevented, true);
      assert.equal(target.emit('pointerup', pointer).defaultPrevented, true);
      const event = target.emit('click', {
        button: 0,
        pointerType: 'touch',
        detail: 1,
        isTrusted: true,
        sourceCapabilities: { firesTouchEvents: true },
      });
      assert.equal(event.defaultPrevented, true, 'release-delayed touch-derived click is consumed');
      frame();
    };

  frame();
  frame();
  page.$('start-button').focus();
  pulse(0);
  await settle(() => page.doc.body.dataset.flightState === 'running');
  assert.equal(
    page.$('controller-navigation-help').closest('details').open,
    false,
    'controller navigation help stays collapsed during gameplay',
  );
  trustedClickEcho();
  assert.equal(page.doc.body.dataset.flightState, 'running', 'Start mission applies exactly once');

  time += 1300;
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
    button: 0,
    pointerId: 17,
    pointerType: 'touch',
    detail: 1,
    isTrusted: true,
    sourceCapabilities: { firesTouchEvents: true },
  });
  assert.equal(heldRelease.defaultPrevented, true, 'long-held A release is consumed');
  assert.equal(page.$('overlay-sound').textContent, afterSound, 'paused Sound changes once');

  page.$('overlay-settings').focus();
  pulse(0);
  assert.equal(page.$('settings-dialog').open, true);
  trustedClickEcho();
  assert.equal(page.$('settings-dialog').open, true, 'paused Settings stays open');
  time += 1300;
  page.doc.querySelector('button[data-close="settings-dialog"]').click();
  frame();

  page.$('overlay-menu').focus();
  pulse(0);
  assert.equal(page.$('shell-home').open, true, 'paused Home opens the main menu');
  trustedClickEcho();
  assert.equal(page.$('shell-home').open, true, 'paused Home remains open after A release');
});

test('every primary Pause action ignores a touch-derived A release echo', async (t) => {
  const cases = [
    {
      name: 'Resume',
      id: 'start-button',
      applied: (page) => page.doc.body.dataset.flightState === 'running',
    },
    {
      name: 'Restart mission',
      id: 'overlay-restart',
      applied: (page) => page.$('restart-dialog').open,
    },
    {
      name: 'Missions',
      id: 'overlay-missions',
      applied: (page) => page.$('journey-chooser')?.open === true || page.$('shell-missions').open,
    },
    {
      name: 'How to play',
      id: 'overlay-help',
      applied: (page) => page.$('help-dialog').open,
    },
    {
      name: 'Settings',
      id: 'overlay-settings',
      applied: (page) => page.$('settings-dialog').open,
    },
    {
      name: 'Mission info',
      id: 'pause-mission-info-toggle',
      applied: (page) => page.$('pause-mission-info').open,
    },
    {
      name: 'Home',
      id: 'overlay-menu',
      applied: (page) => page.$('shell-home').open,
    },
  ];

  for (const entry of cases)
    await t.test(entry.name, async (t) => {
      const pad = {
          index: 0,
          id: 'Steam Deck',
          connected: true,
          mapping: 'standard',
          axes: [0, 0, 0, 0],
          buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
        },
        page = await soloPage(t, { readPads: () => [pad] });
      page.frame();
      page.frame();
      page.$('start-button').click();
      await settle(() => page.doc.body.dataset.flightState === 'running');
      page.$('pause-button').click();
      page.frame();
      page.frame();
      assert.equal(page.$('game-overlay').dataset.kind, 'pause');

      const target = page.$(entry.id),
        originalHandler = target.onclick;
      let pending;
      if (entry.id === 'overlay-missions')
        target.onclick = (...args) => (pending = originalHandler.apply(target, args));
      target.focus();
      pad.buttons[0] = { pressed: true, value: 1 };
      page.frame();
      pad.buttons[0] = { pressed: false, value: 0 };
      page.frame();
      const pointer = {
        button: 0,
        pointerId: 31,
        pointerType: 'touch',
        isPrimary: true,
        detail: 1,
        isTrusted: true,
        sourceCapabilities: { firesTouchEvents: true },
      };
      assert.equal(target.emit('pointerdown', pointer).defaultPrevented, true);
      assert.equal(target.emit('pointerup', pointer).defaultPrevented, true);
      assert.equal(target.emit('click', pointer).defaultPrevented, true);
      if (entry.id === 'overlay-missions') {
        target.onclick = originalHandler;
        assert(pending instanceof Promise, 'Missions exposes its owned opening operation');
        await pending;
      }
      await settle(() => entry.applied(page), `${entry.name} applies on A press`);
      assert.equal(entry.applied(page), true, `${entry.name} remains applied after A release`);
      assert.deepEqual(page.errors, []);
    });

  await t.test('Sound', async (t) => {
    const pad = {
        index: 0,
        id: 'Steam Deck',
        connected: true,
        mapping: 'standard',
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
      },
      page = await soloPage(t, { readPads: () => [pad] });
    page.frame();
    page.frame();
    page.$('start-button').click();
    await settle(() => page.doc.body.dataset.flightState === 'running');
    page.$('pause-button').click();
    page.frame();
    page.frame();
    const target = page.$('overlay-sound'),
      before = target.getAttribute('aria-pressed');
    target.focus();
    pad.buttons[0] = { pressed: true, value: 1 };
    page.frame();
    pad.buttons[0] = { pressed: false, value: 0 };
    page.frame();
    const applied = target.getAttribute('aria-pressed');
    assert.notEqual(applied, before);
    const pointer = {
      button: 0,
      pointerId: 37,
      pointerType: 'touch',
      isPrimary: true,
      detail: 1,
      isTrusted: true,
      sourceCapabilities: { firesTouchEvents: true },
    };
    target.emit('pointerdown', pointer);
    target.emit('pointerup', pointer);
    assert.equal(target.emit('click', pointer).defaultPrevented, true);
    assert.equal(target.getAttribute('aria-pressed'), applied, 'Sound changes exactly once');
    assert.deepEqual(page.errors, []);
  });
});

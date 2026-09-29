import test from 'node:test';
import assert from 'node:assert/strict';
import { demoPage, demoKey } from './helpers/demo-host-fixture.mjs';
import { settle } from './helpers/solo-dom.mjs';

const nativeKey = (target, type, key, extra = {}) =>
  target.emit(type, {
    key,
    code: key === ' ' ? 'Space' : key,
    repeat: false,
    isTrusted: true,
    ...extra,
  });
const nativeClick = (target) =>
  target.emit('click', { isTrusted: true, detail: 0, button: -1, isPrimary: false });

// Actual Solo app, Demo window-capture listener, document guard, coordinator,
// router and navigation. Only the physical pad/browser default-event boundary
// is modeled; no direct calls into a replacement Confirm implementation.
async function deckDemo(t, phase = 'watching') {
  let time = 1000;
  t.mock.method(performance, 'now', () => time);
  const pad = {
      index: 0,
      id: 'Steam Deck Demo',
      connected: true,
      mapping: 'standard',
      timestamp: time,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    },
    page = await demoPage(t, {
      readPads: () => [pad],
      initialReadyTimeoutMs: 30000,
      search: '?journey=legacy&controllerTrace=1',
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
  let exits = 0;
  page.$('demo-dialog').addEventListener('close', () => exits++);
  async function open() {
    frame(1500);
    page.$('shell-demo').focus();
    await page.open();
    if (phase === 'practice') {
      page.$('demo-interrupt').click();
      page.$('demo-takeover').click();
      await settle(() => !page.$('demo-practice-controls').hidden);
      const before = page.demoFrame.run.tick;
      demoKey(page, 'ArrowDown', true, { isTrusted: true });
      demoKey(page, 'ArrowDown', false, { isTrusted: true });
      frame();
      assert.equal(page.$('demo-dialog').classList.contains('is-practice'), true);
      assert.ok(page.demoFrame.run.tick > before, 'Back is tested after actual practice advances.');
    }
    page.$('demo-back').focus();
    frame();
    frame();
    assert.equal(page.doc.activeElement, page.$('demo-back'));
  }
  return { page, pad, elapse, frame, hold, open, exits: () => exits };
}

for (const phase of ['watching', 'practice'])
  for (const order of ['gamepad-first', 'native-before-RAF'])
    test(`${phase} Demo Back uses one release commit for ${order} Enter/Space echoes`, async (t) => {
      const h = await deckDemo(t, phase),
        { page, frame, hold, elapse } = h;
      for (const key of ['Enter', ' '])
        for (const duration of [40, 5000]) {
          await h.open();
          const back = page.$('demo-back'),
            before = h.exits();
          hold(true);
          if (order === 'gamepad-first') frame();
          assert.equal(nativeKey(back, 'keydown', key).defaultPrevented, true);
          assert.equal(page.$('demo-dialog').open, true, 'Back cannot run at A-down');
          assert.equal(h.exits(), before);
          elapse(duration);
          if (order === 'gamepad-first' || duration === 5000) frame();
          if (duration === 5000)
            assert.equal(nativeKey(back, 'keydown', key, { repeat: true }).defaultPrevented, true);
          assert.equal(page.$('demo-dialog').open, true, 'a hold keeps the captured Back pending');
          hold(false);
          assert.equal(nativeKey(back, 'keyup', key).defaultPrevented, true);
          frame();
          assert.equal(page.$('demo-dialog').open, false);
          assert.equal(h.exits(), before + 1);
          const home = page.doc.activeElement;
          assert.equal(page.$('shell-home').contains(home), true, 'focus returns inside Home');
          assert.equal(nativeClick(home).defaultPrevented, true);
          frame();
          assert.equal(page.$('demo-dialog').open, false, 'release click cannot reopen Demo');
          assert.equal(page.$('settings-dialog').open, false, 'release click cannot open Settings');
          assert.equal(h.exits(), before + 1);
        }
      assert.deepEqual(page.errors, []);
    });

for (const phase of ['watching', 'practice'])
  test(`native-first ${phase} Demo Back stays the winner after Home restores and A is held for five seconds`, async (t) => {
    const h = await deckDemo(t, phase),
      { page, hold, elapse, frame } = h;
    for (const key of ['Enter', ' ']) {
      await h.open();
      const before = h.exits(),
        back = page.$('demo-back');
      assert.equal(nativeKey(back, 'keydown', key).defaultPrevented, true);
      assert.equal(page.$('demo-dialog').open, false, 'genuine native Back remains immediate');
      assert.equal(h.exits(), before + 1);
      elapse(40);
      hold(true);
      frame();
      assert.match(
        page.$('controller-confirm-trace').querySelector('pre').textContent,
        /native start.*target:demo-back.*winner:native/,
        'the manual native Back is associated before its menu transition',
      );
      elapse(5000);
      frame();
      hold(false);
      const home = page.$('shell-demo');
      assert.equal(nativeKey(home, 'keydown', key, { repeat: true }).defaultPrevented, true);
      assert.equal(nativeKey(home, 'keyup', key).defaultPrevented, true);
      assert.equal(nativeClick(home).defaultPrevented, true);
      await Promise.resolve();
      frame();
      assert.equal(
        page.$('demo-dialog').open,
        false,
        'later controller release cannot reopen Home',
      );
      assert.equal(h.exits(), before + 1);
      frame(1500);
      const sound = page.$('shell-sound'),
        original = sound.getAttribute('aria-pressed');
      sound.focus();
      assert.equal(nativeClick(sound).defaultPrevented, false);
      assert.notEqual(sound.getAttribute('aria-pressed'), original, 'a later native gesture works');
    }
    assert.deepEqual(page.errors, []);
  });

test('touch-derived Demo Back uses the same Confirm owner and native-only touch still exits', async (t) => {
  const h = await deckDemo(t),
    { page, hold, frame, elapse } = h,
    touch = {
      isTrusted: true,
      pointerType: 'touch',
      pointerId: 91,
      isPrimary: true,
      button: 0,
      buttons: 1,
      detail: 1,
      sourceCapabilities: { firesTouchEvents: true },
    };
  await h.open();
  const back = page.$('demo-back');
  hold(true);
  assert.equal(back.emit('pointerdown', touch).defaultPrevented, true);
  assert.equal(page.$('demo-dialog').open, true);
  elapse(40);
  hold(false);
  assert.equal(back.emit('pointerup', { ...touch, buttons: 0 }).defaultPrevented, true);
  assert.equal(h.exits(), 1);
  assert.equal(
    page.doc.activeElement.emit('click', { ...touch, buttons: 0, isPrimary: false })
      .defaultPrevented,
    true,
  );
  frame();
  assert.equal(page.$('demo-dialog').open, false);
  await h.open();
  assert.equal(back.emit('pointerdown', touch).defaultPrevented, true, 'native touch Back exits');
  assert.equal(h.exits(), 2);
  elapse(40);
  hold(true);
  frame();
  assert.match(
    page.$('controller-confirm-trace').querySelector('pre').textContent,
    /native start.*target:demo-back.*winner:native/,
  );
  elapse(5000);
  frame();
  hold(false);
  page.doc.activeElement.emit('pointerup', { ...touch, buttons: 0 });
  page.doc.activeElement.emit('click', { ...touch, buttons: 0, isPrimary: false });
  frame();
  assert.equal(h.exits(), 2);
  assert.equal(page.$('demo-dialog').open, false);
  assert.equal(page.$('settings-dialog').open, false);
  assert.deepEqual(page.errors, []);
});

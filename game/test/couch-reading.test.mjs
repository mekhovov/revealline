import test from 'node:test';
import assert from 'node:assert/strict';
import { couchPage } from './helpers/couch-host.mjs';
import { page as teamPage } from './helpers/coop-host.mjs';

const pad = () => ({
  index: 0,
  id: 'Reading controller',
  connected: true,
  mapping: 'standard',
  axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
});

// Real entry markup, event registrations, navigation and simulations. Finite
// DOM/clock/controller boundaries are modeled; these are not device tests.
async function host(t, mode, { resizeWindow = false } = {}) {
  const team = mode === 'Team';
  const beforeImport = (context) => {
    if (!resizeWindow) return;
    const doc = context.doc || context.document,
      win = context.win || context.window;
    Object.assign(win, doc.defaultView);
    doc.defaultView = win;
    win.innerWidth = doc.documentElement.clientWidth = 844;
    win.innerHeight = doc.documentElement.clientHeight = 390;
  };
  const f = team
    ? await teamPage(t, { touch: true, capturePaint: true, nativeFocus: true, beforeImport })
    : await couchPage(t, { coarse: true, pads: [pad()], beforeImport });
  if (team) f.pads.push(pad());
  const prefix = team ? 'coop' : 'race';
  const tick = (n = 1) => (team ? f.tick(n) : f.frames(n));
  const control = (suffix) => f.$(`${prefix}-${suffix}`);
  const press = (key) => {
    if (team) return f.press(key);
    const target = f.doc.activeElement;
    const event = target.emit('keydown', { key, code: key === ' ' ? 'Space' : key, repeat: false });
    // Model the browser's default activation only after the production handler.
    if (!event.defaultPrevented && key === 'Enter' && target.tagName === 'BUTTON') target.click();
    return event;
  };
  const release = (key) =>
    f.doc.activeElement.emit('keyup', { key, code: key === ' ' ? 'Space' : key });
  const pulse = (index) => {
    const device = team ? f.pads[0] : f.pads()[0];
    device.buttons[index] = { pressed: true, value: 1 };
    tick();
    device.buttons[index] = { pressed: false, value: 0 };
    tick();
  };
  const state = () =>
    team
      ? {
          hud: ['clock', 'coverage', 'reserves', 'objective', 'state-0', 'state-1'].map(
            (suffix) => [suffix, control(suffix).textContent],
          ),
          progress: control('progress').value,
          paint: f.lastPaint,
          paused: !control('overlay').hidden,
          lobby: !control('menu').hidden,
        }
      : { state: f.state(), checkpoints: f.checkpoint() };
  return {
    ...f,
    control,
    tick,
    press,
    release,
    pulse,
    state,
    join() {
      tick(3);
      pulse(0);
      tick(2);
    },
    openHelp() {
      if (team) f.disclose('coop-help');
      else control('help').click();
      tick();
      control('help-read').focus();
    },
    pause() {
      control('start').click();
      tick(30);
      control('pause').click();
      tick(2);
    },
    back() {
      if (team) {
        control('help').open = false;
        control('help').querySelector('summary').focus();
        control('help').emit('toggle', { bubbles: false });
      } else control('help-back').click();
      tick();
    },
  };
}

for (const mode of ['Versus', 'Team']) {
  for (const key of ['Enter', ' ', 'Escape']) {
    test(`${mode} keyboard ${key === ' ' ? 'Space' : key} ends paused Help once without resuming`, async (t) => {
      const f = await host(t, mode);
      f.pause();
      const before = f.state();
      f.openHelp();
      f.press('Enter');
      f.release('Enter');
      const region = f.control('help-reading');
      assert.equal(f.doc.activeElement, region);
      assert.equal(f.control('help-reading-done').disabled, false);
      assert.equal(region.getAttribute('aria-describedby'), f.control('help-reading-hint').id);
      assert.match(f.control('help-reading-hint').textContent, /Enter, Space or Escape returns/);
      assert.doesNotMatch(f.control('help-reading-hint').textContent, /South|East/);
      assert.doesNotMatch(
        f.control(mode === 'Team' ? 'pads' : 'menu-status').textContent,
        /Enter, Space or Escape returns/,
        'Reading hints have one visible status owner, rather than a duplicate in another panel.',
      );
      assert.equal(f.press(key).defaultPrevented, true);
      f.release(key);
      assert.equal(f.doc.activeElement, f.control('help-read'));
      assert.equal(f.control('help-reading-done').disabled, true);
      assert.equal(region.hasAttribute('data-controller-reading'), false);
      assert.doesNotMatch(
        f.control(mode === 'Team' ? 'pads' : 'menu-status').textContent,
        /Reading ended/,
      );
      f.tick(90);
      assert.deepEqual(f.state(), before);
    });
  }

  test(`${mode} pointer and touch Done are stable end-only controls in lobby and pause`, async (t) => {
    const f = await host(t, mode);
    for (const pointerType of ['mouse', 'touch']) {
      if (pointerType === 'touch') {
        f.back();
        f.pause();
      }
      const before = f.state();
      f.openHelp();
      const entry = f.control('help-read'),
        done = f.control('help-reading-done'),
        region = f.control('help-reading');
      region.scrollHeight = 500;
      entry.emit('pointerdown', { pointerType, pointerId: 1, button: 0 });
      entry.click();
      assert.match(
        f.control('help-reading-hint').textContent,
        /Scroll to read.*Done reading returns/,
      );
      assert.equal(done.disabled, false);
      // A cancelled press is not activation and may not turn Done into Start.
      const down = done.emit('pointerdown', { pointerType, pointerId: 2, button: 0 });
      assert.equal(down.defaultPrevented, true);
      done.emit('pointercancel', { pointerType, pointerId: 2 });
      assert.equal(f.doc.activeElement, region);
      assert.equal(done.disabled, true);
      assert.deepEqual(f.state(), before);
      entry.emit('pointerdown', { pointerType, pointerId: 3, button: 0 });
      entry.click();
      assert.equal(done.disabled, false);
      done.emit('pointerdown', { pointerType, pointerId: 3, button: 0 });
      done.emit('pointerup', { pointerType, pointerId: 3, button: 0 });
      done.click();
      assert.equal(f.doc.activeElement, entry);
      assert.equal(done.disabled, true);
      done.click();
      f.tick(30);
      assert.deepEqual(f.state(), before);
    }
  });

  test(`${mode} native content scrolling retains Done and the same paused attempt`, async (t) => {
    const f = await host(t, mode);
    f.pause();
    const before = f.state();
    f.openHelp();
    const entry = f.control('help-read'),
      region = f.control('help-reading'),
      done = f.control('help-reading-done');
    region.scrollHeight = 600;
    entry.emit('pointerdown', { pointerType: 'touch', pointerId: 4, button: 0 });
    entry.click();
    const down = region.emit('pointerdown', {
      pointerType: 'touch',
      pointerId: 5,
      button: 0,
      isPrimary: true,
    });
    assert.equal(down.defaultPrevented, false, 'The browser owns native content scrolling.');
    // Model the browser's scroll and pointer cancellation when it adopts a pan.
    // This checks event lifecycle, not a physical touch gesture or layout.
    region.scrollTop = 80;
    region.emit('pointercancel', { pointerType: 'touch', pointerId: 5, isPrimary: true });
    f.tick(4);
    assert.equal(f.doc.activeElement, region);
    assert.equal(done.disabled, false);
    assert.equal(region.hasAttribute('data-controller-reading'), true);
    assert.match(f.control('help-reading-hint').textContent, /Done reading returns/);
    done.emit('pointerdown', { pointerType: 'touch', pointerId: 6, button: 0 });
    done.click();
    assert.equal(f.doc.activeElement, entry);
    assert.equal(done.disabled, true);
    f.tick(30);
    assert.deepEqual(f.state(), before);
  });

  test(`${mode} opted-in resize reveals the current reading unit without moving focus or resuming`, async (t) => {
    const f = await host(t, mode, { resizeWindow: true });
    f.pause();
    const before = f.state();
    f.openHelp();
    f.press('Enter');
    f.release('Enter');
    const region = f.control('help-reading'),
      unit = f.control('help-unit');
    region.clientHeight = 148;
    region.scrollHeight = 656;
    unit._rect = { x: 40, y: 480, width: 300, height: 248 };
    const prior = unit.scrolled;
    f.win.emit('resize');
    assert.equal(unit.scrolled, prior + 1);
    assert.equal(f.doc.activeElement, region);
    assert.equal(f.control('help-reading-done').disabled, false);
    f.tick(30);
    assert.deepEqual(f.state(), before);
    f.press('Escape');
    f.release('Escape');
    f.win.emit('resize');
    assert.equal(unit.scrolled, prior + 1, 'Inactive reading cannot reclaim scroll or focus.');
    assert.equal(f.doc.activeElement, f.control('help-read'));
  });

  test(`${mode} fresh input changes reading copy while an idle pad preserves keyboard ownership`, async (t) => {
    const f = await host(t, mode);
    f.join();
    f.openHelp();
    f.control('help-reading').scrollHeight = 500;
    f.pulse(0);
    assert.equal(f.doc.activeElement, f.control('help-reading'));
    assert.match(f.control('help-reading-hint').textContent, /South or East returns/);
    const before = f.state();
    assert.equal(f.press('ArrowDown').defaultPrevented, true);
    f.release('ArrowDown');
    assert.ok(f.control('help-reading').scrollTop > 0);
    assert.match(
      f.control('help-reading-hint').textContent,
      /Up\/Down scroll.*Enter, Space or Escape/,
    );
    f.tick(60);
    assert.match(f.control('help-reading-hint').textContent, /Enter, Space or Escape/);
    f.pulse(13);
    assert.match(f.control('help-reading-hint').textContent, /South or East returns/);
    f.pulse(1);
    assert.equal(f.doc.activeElement, f.control('help-read'));
    assert.equal(f.control('help-reading-done').disabled, true);
    assert.deepEqual(f.state(), before);
  });

  test(`${mode} Help closure invalidates Done and terminal teardown removes reader listeners`, async (t) => {
    const f = await host(t, mode);
    f.openHelp();
    f.press('Enter');
    f.release('Enter');
    const before = f.state();
    f.back();
    const returnFocus = f.doc.activeElement;
    assert.equal(f.control('help-reading-done').disabled, true);
    assert.equal(f.control('help-reading').hasAttribute('data-controller-reading'), false);
    f.control('help-reading-done').click();
    assert.equal(f.doc.activeElement, returnFocus);
    assert.deepEqual(f.state(), before);
    f.openHelp();
    f.press('Enter');
    f.release('Enter');
    f.win.emit('pagehide', { persisted: false });
    assert.equal(f.control('help-reading-done').disabled, true);
    assert.equal(f.control('help-read').listeners.get('click').size, 0);
    assert.equal(f.control('help-reading-done').listeners.get('click').size, 0);
    f.doc.body.focus();
    f.control('help-read').click();
    f.control('help-reading-done').click();
    assert.equal(f.doc.activeElement, f.doc.body);
  });
}

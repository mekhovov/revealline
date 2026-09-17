import test from 'node:test';
import assert from 'node:assert/strict';
import { couchPage } from './helpers/couch-host.mjs';
import { page as teamPage } from './helpers/coop-host.mjs';

const pad = () => ({
  index: 0,
  id: 'Game data reader controller',
  connected: true,
  mapping: 'standard',
  axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
});

// Real hosts, readers, input routing and attempts; finite DOM, scrolling and pad
// boundaries. Browser layout and physical touch/controller checks are separate.
async function host(t, mode) {
  const team = mode === 'Team',
    values = new Map([['preserved-solo-profile', 'unchanged']]),
    writes = [],
    storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem(key, value) {
        writes.push(key);
        values.set(key, value);
      },
    },
    f = team
      ? await teamPage(t, {
          nativeFocus: true,
          nativeVisibility: true,
          capturePaint: true,
          beforeImport: ({ install }) => install('localStorage', { value: storage }),
        })
      : await couchPage(t, { storage, pads: [pad()] });
  if (team) f.pads.push(pad());
  const prefix = team ? 'coop' : 'race',
    control = (suffix) => f.$(`${prefix}-${suffix}`),
    tick = (count = 1) => (team ? f.tick(count) : f.frames(count));
  const press = (key) => {
    let event;
    if (team) event = f.press(key);
    else {
      const target = f.doc.activeElement;
      event = target.emit('keydown', { key, code: key, repeat: false });
      if (!event.defaultPrevented && key === 'Enter' && target.tagName === 'BUTTON') target.click();
    }
    f.doc.activeElement.emit('keyup', { key, code: key });
    return event;
  };
  const pulse = (index) => {
    const device = team ? f.pads[0] : f.pads()[0];
    device.buttons[index] = { pressed: true, value: 1 };
    tick();
    device.buttons[index] = { pressed: false, value: 0 };
    tick(2);
  };
  const snapshot = () =>
    team
      ? {
          hud: ['clock', 'coverage', 'reserves', 'objective', 'state-0', 'state-1'].map(
            (id) => control(id).textContent,
          ),
          paint: f.lastPaint,
          picture: f.drawImages.at(-1),
          paused: !control('overlay').hidden,
          stored: [...values],
        }
      : { status: f.state(), checkpoints: f.checkpoint(), stored: [...values] };
  control('start').click();
  tick(30);
  control('pause').click();
  tick(2);
  const before = snapshot();
  assert.equal(team ? before.paused : before.status === 'paused', true);
  const region = control('data-reading');
  region.clientHeight = 120;
  region.scrollHeight = 540;
  const opener = control(team ? 'settings-open' : 'options'),
    back = control(team ? 'settings-close' : 'options-back');
  return {
    ...f,
    control,
    tick,
    press,
    pulse,
    region,
    opener,
    back,
    join() {
      tick(3);
      pulse(0);
      tick(2);
    },
    open(data = true) {
      opener.focus();
      opener.click();
      if (data) {
        control('settings-tab-data').focus();
        control('settings-tab-data').click();
      }
    },
    unchanged({ advance = true } = {}) {
      if (advance) tick(30);
      assert.deepEqual(snapshot(), before);
      assert.deepEqual(writes, []);
    },
  };
}

for (const mode of ['Versus', 'Team']) {
  test(`${mode} Game data reveals its final hint layout after entry`, async (t) => {
    const f = await host(t, mode);
    f.open();
    const hintsAtReveal = [];
    t.mock.method(f.control('data-unit'), 'scrollIntoView', () => {
      hintsAtReveal.push(f.control('data-reading-hint').textContent);
    });
    f.control('data-read').focus();
    f.press('Enter');
    assert.deepEqual(hintsAtReveal, [f.control('data-reading-hint').textContent]);
    assert.equal(f.doc.activeElement, f.region);
    f.unchanged();
  });

  for (const interruption of ['Back', 'disposal'])
    test(`${mode} ${interruption} during the final reading hint cannot reveal or refocus the retired reader`, async (t) => {
      const f = await host(t, mode);
      f.open();
      const hint = f.control('data-reading-hint'),
        property = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(hint), 'textContent'),
        reveals = [];
      let activeHints = 0,
        retiredFocus;
      Object.defineProperty(hint, 'textContent', {
        configurable: true,
        get() {
          return property.get.call(this);
        },
        set(value) {
          property.set.call(this, value);
          // The accepted state refresh precedes the navigation hint; its final
          // presentation refresh is the second active copy assignment.
          if (value.startsWith(`Reading ${mode} game data.`) && ++activeHints === 2) {
            if (interruption === 'Back') f.back.click();
            else f.win.emit('pagehide', { persisted: false });
            retiredFocus = f.doc.activeElement;
          }
        },
      });
      t.mock.method(f.control('data-unit'), 'scrollIntoView', (options) => reveals.push(options));
      f.control('data-read').click();
      assert.equal(activeHints, 2);
      assert.deepEqual(reveals, []);
      assert.equal(f.doc.activeElement, retiredFocus);
      if (interruption === 'Back') assert.equal(retiredFocus, f.opener);
      assert.equal(f.control('data-reading-done').disabled, true);
      assert.equal(f.region.hasAttribute('data-controller-reading'), false);
      f.unchanged({ advance: interruption !== 'disposal' });
    });

  test(`${mode} Game data is keyboard reachable and PageDown/Home/End read complete copy before Back`, async (t) => {
    const f = await host(t, mode);
    f.open();
    f.press('Tab');
    assert.equal(f.doc.activeElement, f.control('data-read'));
    f.press('Enter');
    assert.equal(f.doc.activeElement, f.region);
    assert.equal(f.region.tabIndex, 0);
    assert.match(f.region.getAttribute('aria-label'), /game data/);
    assert.match(f.region.textContent, /Solo/);
    assert.equal(f.press('PageDown').defaultPrevented, true);
    assert.equal(f.region.scrollTop, 120);
    f.press('End');
    assert.equal(f.region.scrollTop, 420);
    f.press('Home');
    assert.equal(f.region.scrollTop, 0);
    assert.match(f.control('data-reading-hint').textContent, /Enter, Space or Escape returns/);
    f.press('Escape');
    assert.equal(f.doc.activeElement, f.control('data-read'));
    assert.equal(f.control('data-reading-done').disabled, true);
    assert.equal(f.control('settings-panel-data').hidden, false);
    f.press('Escape');
    assert.equal(f.doc.activeElement, f.opener);
    f.unchanged();
  });

  test(`${mode} controller enters Game data, scrolls and exits without resuming`, async (t) => {
    const f = await host(t, mode);
    f.join();
    f.open(false);
    const reach = (target) => {
      for (let i = 0; i < 24 && f.doc.activeElement !== target; i++) f.pulse(13);
      assert.equal(f.doc.activeElement, target);
    };
    reach(f.control('settings-tab-data'));
    f.pulse(0);
    reach(f.control('data-read'));
    f.pulse(0);
    assert.equal(f.doc.activeElement, f.region);
    f.pulse(13);
    assert.ok(f.region.scrollTop > 0);
    assert.match(f.control('data-reading-hint').textContent, /South or East returns/);
    assert.doesNotMatch(
      f.control(mode === 'Team' ? 'pads' : 'menu-status').textContent,
      /Versus game data|Team game data|Reading ended/,
      'The reading region owns its status instead of duplicating it in a hidden panel.',
    );
    f.pulse(1);
    assert.equal(f.doc.activeElement, f.control('data-read'));
    assert.equal(f.region.hasAttribute('data-controller-reading'), false);
    f.pulse(1);
    assert.equal(f.doc.activeElement, f.opener);
    f.unchanged();
  });

  test(`${mode} category changes and Settings Back retire the reader and its Done action`, async (t) => {
    const f = await host(t, mode);
    f.open();
    f.control('data-read').click();
    assert.equal(f.doc.activeElement, f.region);
    const audio = f.control('settings-tab-audio');
    audio.focus();
    audio.click();
    f.tick(2);
    assert.equal(f.control('data-reading-done').disabled, true);
    assert.equal(f.region.hasAttribute('data-controller-reading'), false);
    f.control('data-reading-done').click();
    assert.equal(f.doc.activeElement, audio);
    f.control('settings-tab-data').click();
    f.control('data-read').click();
    f.back.click();
    assert.equal(f.control('data-reading-done').disabled, true);
    assert.equal(f.region.hasAttribute('data-controller-reading'), false);
    f.control('data-reading-done').click();
    assert.equal(f.doc.activeElement, f.opener);
    f.unchanged();
  });

  test(`${mode} touch scrolling and Done keep the complete copy and paused attempt`, async (t) => {
    const f = await host(t, mode);
    f.open();
    const entry = f.control('data-read'),
      done = f.control('data-reading-done'),
      text = f.region.textContent;
    entry.emit('pointerdown', { pointerType: 'touch', pointerId: 1, button: 0 });
    entry.click();
    const down = f.region.emit('pointerdown', {
      pointerType: 'touch',
      pointerId: 2,
      button: 0,
      isPrimary: true,
    });
    assert.equal(down.defaultPrevented, false);
    f.region.scrollTop = 100;
    f.region.emit('pointercancel', { pointerType: 'touch', pointerId: 2, isPrimary: true });
    f.tick(2);
    assert.equal(done.disabled, false);
    assert.equal(f.region.textContent, text);
    assert.match(
      f.control('data-reading-hint').textContent,
      /Scroll to read.*Done reading returns/,
    );
    done.emit('pointerdown', { pointerType: 'touch', pointerId: 3, button: 0 });
    done.click();
    assert.equal(f.doc.activeElement, entry);
    assert.equal(done.disabled, true);
    f.unchanged();
  });
}

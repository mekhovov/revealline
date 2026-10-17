import test from 'node:test';
import assert from 'node:assert/strict';
// Preserve strict identity without recursively formatting the fixture DOM.
function boundedIdentity(actual, expected, message) {
  if (Object.is(actual, expected)) return;
  const label = (value) => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value !== 'object' && typeof value !== 'function') return String(value).slice(0, 80);
    return (
      [value.tagName, value.id]
        .filter((part) => typeof part === 'string')
        .map((part) => part.slice(0, 80))
        .join('#') || typeof value
    );
  };
  assert.ok(
    false,
    (message ?? 'Strict identity mismatch.') +
      ' Actual: ' +
      label(actual) +
      '; expected: ' +
      label(expected) +
      '.',
  );
}
import { couchPage } from './helpers/couch-host.mjs';
import { page as teamPage } from './helpers/coop-host.mjs';
import { validateEnemyStatsSession } from '../enemy-stats.mjs';

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
  const before = snapshot(),
    writesBefore = [...writes];
  assert.deepEqual(writesBefore.slice(0, 1), ['revealline-enemy-stats.v1:writer']);
  const sessionKey = `revealline-enemy-stats-session.v1:host:${team ? 'team' : 'versus'}`;
  assert.deepEqual(
    writesBefore.slice(1).sort(),
    (team ? [sessionKey, 'revealline.team-contextual-teaching.v1'] : [sessionKey]).sort(),
  );
  const sessionRaw = values.get(sessionKey),
    cursors = JSON.parse(sessionRaw);
  assert.equal(Object.keys(cursors).length, 1);
  assert.equal(
    validateEnemyStatsSession(Object.values(cursors)[0]).gameType,
    team ? 'team' : 'versus',
  );
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
      const joined = snapshot();
      const radioKey = 'revealline.couch-radio-setup.v1';
      const expectedWrites = [...writesBefore, radioKey];
      assert.deepEqual(writes, expectedWrites);
      {
        assert.equal(
          values.get(radioKey),
          JSON.stringify({ entries: [], format: 'RadioSetup.v1' }),
        );
        assert.deepEqual(joined, {
          ...before,
          stored: [...before.stored, [radioKey, values.get(radioKey)]],
        });
        before.stored = joined.stored;
        writesBefore.push(radioKey);
      }
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
      const terminalWrites = !advance && writes.length === writesBefore.length + 1;
      assert.deepEqual(writes, terminalWrites ? [...writesBefore, sessionKey] : writesBefore);
      assert.equal(values.get(sessionKey), sessionRaw);
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
    boundedIdentity(f.doc.activeElement, f.region);
    f.unchanged();
  });

  for (const interruption of ['Back', 'disposal'])
    test(`${mode} ${interruption} during active reading hint publication cannot reveal or refocus the retired reader`, async (t) => {
      const f = await host(t, mode);
      f.open();
      const hint = f.control('data-reading-hint'),
        reveals = [],
        append = hint.append.bind(hint);
      let activeHints = 0,
        retiredFocus;
      // Localization publishes an owned text node, not a duplicate nonempty
      // parent textContent assignment. Interrupt that actual publication.
      t.mock.method(hint, 'append', (...nodes) => {
        append(...nodes);
        if (hint.textContent.startsWith(`Reading ${mode} game data.`) && ++activeHints === 1) {
          if (interruption === 'Back') f.back.click();
          else f.win.emit('pagehide', { persisted: false });
          retiredFocus = f.doc.activeElement;
        }
      });
      t.mock.method(f.control('data-unit'), 'scrollIntoView', (options) => reveals.push(options));
      f.control('data-read').click();
      assert.equal(activeHints, 1);
      assert.deepEqual(reveals, []);
      boundedIdentity(f.doc.activeElement, retiredFocus);
      if (interruption === 'Back') boundedIdentity(retiredFocus, f.opener);
      assert.equal(f.control('data-reading-done').disabled, true);
      assert.equal(f.region.hasAttribute('data-controller-reading'), false);
      f.unchanged({ advance: interruption !== 'disposal' });
    });

  test(`${mode} Game data is keyboard reachable and PageDown/Home/End read complete copy before Back`, async (t) => {
    const f = await host(t, mode);
    f.open();
    f.press('Tab');
    boundedIdentity(f.doc.activeElement, f.doc.getElementById('profile-recovery-open'));
    f.press('Tab');
    boundedIdentity(f.doc.activeElement, f.control('data-read'));
    f.press('Enter');
    boundedIdentity(f.doc.activeElement, f.region);
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
    boundedIdentity(f.doc.activeElement, f.control('data-read'));
    assert.equal(f.control('data-reading-done').disabled, true);
    assert.equal(f.control('settings-panel-data').hidden, false);
    f.press('Escape');
    boundedIdentity(f.doc.activeElement, f.opener);
    f.unchanged();
  });

  test(`${mode} controller enters Game data, scrolls and exits without resuming`, async (t) => {
    const f = await host(t, mode);
    f.join();
    const reach = (target) => {
      for (let i = 0; i < 24 && f.doc.activeElement !== target; i++) f.pulse(13);
      boundedIdentity(f.doc.activeElement, target);
    };
    reach(f.opener);
    boundedIdentity(f.opener.closest('[hidden],[inert]'), null);
    f.pulse(0);
    reach(f.control('settings-tab-data'));
    f.pulse(0);
    // Native categories are a vertical group; Right enters the selected panel.
    f.pulse(15);
    reach(f.control('data-read'));
    f.pulse(0);
    boundedIdentity(f.doc.activeElement, f.region);
    f.pulse(13);
    assert.ok(f.region.scrollTop > 0);
    assert.match(f.control('data-reading-hint').textContent, /South or East returns/);
    assert.doesNotMatch(
      f.control(mode === 'Team' ? 'pads' : 'menu-status').textContent,
      /Versus game data|Team game data|Reading ended/,
      'The reading region owns its status instead of duplicating it in a hidden panel.',
    );
    f.pulse(1);
    boundedIdentity(f.doc.activeElement, f.control('data-read'));
    assert.equal(f.region.hasAttribute('data-controller-reading'), false);
    f.pulse(1);
    boundedIdentity(f.doc.activeElement, f.opener);
    f.unchanged();
  });

  test(`${mode} category changes and Settings Back retire the reader and its Done action`, async (t) => {
    const f = await host(t, mode);
    f.open();
    f.control('data-read').click();
    boundedIdentity(f.doc.activeElement, f.region);
    const audio = f.control('settings-tab-audio');
    audio.focus();
    audio.click();
    f.tick(2);
    assert.equal(f.control('data-reading-done').disabled, true);
    assert.equal(f.region.hasAttribute('data-controller-reading'), false);
    f.control('data-reading-done').click();
    boundedIdentity(f.doc.activeElement, audio);
    f.control('settings-tab-data').click();
    f.control('data-read').click();
    f.back.click();
    assert.equal(f.control('data-reading-done').disabled, true);
    assert.equal(f.region.hasAttribute('data-controller-reading'), false);
    f.control('data-reading-done').click();
    boundedIdentity(f.doc.activeElement, f.opener);
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
    boundedIdentity(f.doc.activeElement, entry);
    assert.equal(done.disabled, true);
    f.unchanged();
  });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';
import { deferred, waitFor } from './helpers/coop-presentation-fixture.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import { AUDIO_PREFERENCES_KEY } from '../audio-preferences.mjs';

const ids = ['controls', 'audio', 'display', 'data'];
const tab = (f, id) => f.$(`coop-settings-tab-${id}`);
const open = (f) => {
  f.$('coop-settings-open').focus();
  f.tap('Enter');
  assert.equal(f.$('coop-options').open, true);
};
async function fixture(t, options = {}) {
  const values = new Map([
    ['revealline.library.test.v1', 'preserved solo profile'],
    ['revealline.suspended.test.v1', 'preserved solo flight'],
  ]);
  const writes = [];
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      writes.push([key, value]);
      values.set(key, value);
    },
  };
  const f = await page(t, {
    nativeFocus: true,
    nativeVisibility: true,
    capturePaint: true,
    ...options,
    beforeImport(args) {
      args.install('localStorage', { value: storage });
      options.beforeImport?.(args);
    },
  });
  return Object.assign(f, { values, writes, storage });
}
const state = (f) => ({
  hud: [
    'coop-clock',
    'coop-coverage',
    'coop-reserves',
    'coop-objective',
    'coop-state-0',
    'coop-state-1',
  ].map((id) => f.$(id).textContent),
  picture: f.drawImages.at(-1),
  paint: f.lastPaint,
  reads: f.artwork.calls.reads.length,
  releases: [...f.artwork.calls.releases],
  stored: [...f.values],
});
const pause = (f) => {
  f.$('coop-start').click();
  f.tap('KeyD');
  f.tap('ArrowLeft');
  f.tick(45);
  f.$('coop-pause').click();
  f.tick();
};

test('Team Settings has the same four categories, original controls, and exact lobby return without preparing or saving', async (t) => {
  const f = await fixture(t);
  const controls = ['coop-touch', 'coop-audio', 'coop-text-face', 'coop-menu-palette'].map(f.$);
  const before = state(f);
  open(f);
  assert.equal(f.doc.activeElement, tab(f, 'display'));
  assert.equal(f.$('coop-options').closest('#coop-tools'), null);
  for (const id of ids) {
    tab(f, id).focus();
    f.tap('Enter');
    assert.equal(tab(f, id).getAttribute('aria-selected'), 'true');
    assert.equal(f.$(`coop-settings-panel-${id}`).hidden, false);
    assert.equal(f.$(`coop-settings-panel-${id}`).inert, false);
    assert.equal(ids.filter((key) => !f.$(`coop-settings-panel-${key}`).hidden).length, 1);
  }
  for (const node of controls) assert.equal(f.$(node.id), node);
  assert.match(f.$('coop-settings-panel-data').textContent, /does not write Solo saves/);
  f.$('coop-settings-close').click();
  assert.equal(f.doc.activeElement.id, 'coop-settings-open');
  assert.deepEqual(state(f), before);
  assert.deepEqual(f.writes, []);
  assert.equal(f.drawImages.length, 0, 'Settings does not paint or start the lobby arena');
});

test('Settings stays above a retained paused Team attempt and reopens its selected category', async (t) => {
  const f = await fixture(t);
  pause(f);
  const before = state(f);
  assert.equal(f.$('coop-tools').parentNode.id, 'coop-pause-tools');
  open(f);
  tab(f, 'audio').focus();
  f.tap('Enter');
  f.$('coop-resume').click();
  f.$('coop-retry').click();
  f.tick(120);
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(f.$('coop-discard-dialog').open, false);
  assert.deepEqual(state(f), before);
  f.tap('Escape');
  assert.equal(f.doc.activeElement.id, 'coop-settings-open');
  open(f);
  assert.equal(f.doc.activeElement, tab(f, 'audio'));
  f.$('coop-settings-close').click();
  f.tick(60);
  assert.deepEqual(state(f), before);
  f.$('coop-resume').click();
  f.tick(120);
  assert.notEqual(f.$('coop-clock').textContent, before.hud[0]);
});

test('Settings tab keys stay in the categories and Tab cannot reach inactive content or the arena', async (t) => {
  const f = await fixture(t);
  open(f);
  for (const [key, expected] of [
    ['ArrowLeft', 'audio'],
    ['Home', 'controls'],
    ['End', 'data'],
    ['ArrowRight', 'controls'],
  ]) {
    const event = f.press(key);
    assert.equal(event.defaultPrevented, true);
    assert.equal(f.doc.activeElement, tab(f, expected));
  }
  for (let i = 0; i < 12; i++) {
    f.tap('Tab');
    assert.equal(f.$('coop-options').contains(f.doc.activeElement), true);
    assert.equal(f.doc.activeElement.closest('[hidden],[inert]'), null);
  }
  assert.equal(f.drawImages.length, 0);
  assert.deepEqual(f.writes, []);
});

test('a controller selects Team Settings and paused quick sound without resuming', async (t) => {
  const f = await fixture(t);
  pause(f);
  const before = state(f);
  const pad = {
    index: 0,
    id: 'Settings controller',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  f.pads.push(pad);
  const button = (index) => {
    pad.buttons[index] = { pressed: true, value: 1 };
    f.tick();
    pad.buttons[index] = { pressed: false, value: 0 };
    f.tick(2);
  };
  f.tick(2);
  button(0);
  for (let i = 0; i < 30 && f.doc.activeElement.id !== 'coop-settings-open'; i++) button(13);
  assert.equal(f.doc.activeElement.id, 'coop-settings-open');
  button(0);
  assert.equal(f.$('coop-options').open, true);
  for (const id of ['audio', 'data', 'controls', 'display']) {
    for (let i = 0; i < 24 && f.doc.activeElement !== tab(f, id); i++) button(13);
    assert.equal(f.doc.activeElement, tab(f, id));
    button(0);
    assert.equal(tab(f, id).getAttribute('aria-selected'), 'true');
  }
  button(1);
  assert.equal(f.$('coop-options').open, false);
  assert.equal(f.doc.activeElement.id, 'coop-settings-open');
  assert.deepEqual(state(f), before);
  for (let i = 0; i < 30 && f.doc.activeElement.id !== 'coop-quick-sound'; i++) button(13);
  assert.equal(f.doc.activeElement.id, 'coop-quick-sound');
  assert.equal(f.$('coop-overlay').contains(f.doc.activeElement), true);
  button(0);
  f.tick(120);
  assert.equal(f.$('coop-quick-sound').textContent, 'Sound: on');
  assert.equal(JSON.parse(f.values.get(AUDIO_PREFERENCES_KEY)).muted, false);
  assert.deepEqual([...new Set(f.writes.map(([key]) => key))], [AUDIO_PREFERENCES_KEY]);
  assert.deepEqual(state(f), { ...before, stored: [...f.values] });
});

test('closing Settings does not cancel a pending Team picture and late readiness does not steal focus', async (t) => {
  const gate = deferred();
  t.after(() => gate.resolve());
  const f = await fixture(t, { waitPicture: false, presentation: { read: () => gate.promise } });
  await waitFor(() => f.artwork.calls.reads.length === 1);
  open(f);
  assert.equal(f.$('coop-picture-status').dataset.state, 'preparing');
  f.tap('Escape');
  assert.equal(f.$('coop-options').open, false);
  assert.equal(f.$('coop-picture-status').dataset.state, 'preparing');
  assert.equal(f.doc.activeElement.id, 'coop-settings-open');
  gate.resolve();
  await waitFor(() => f.$('coop-picture-status').dataset.state === 'ready');
  assert.equal(f.doc.activeElement.id, 'coop-settings-open');
  assert.equal(f.drawImages.length, 0);
  assert.deepEqual(f.writes, []);
});

test('Settings Back leaves a pending Team import under its existing operation owner', async (t) => {
  const gate = deferred();
  const f = await fixture(t);
  const pack = structuredClone(COOP_STARTER_PACK);
  pack.id = 'settings-import';
  pack.name = 'Settings import';
  const source = JSON.stringify(pack);
  f.$('coop-pack-file').focus();
  const pending = f.selectFile(source, () => gate.promise);
  open(f);
  f.tap('Escape');
  assert.equal(f.$('coop-pack-status').dataset.state, 'busy');
  assert.equal(f.$('coop-pack-cancel').hidden, false);
  gate.resolve(source);
  await pending;
  assert.match(f.$('coop-pack-status').textContent, /Settings import/);
  assert.equal(f.doc.activeElement.id, 'coop-settings-open');
  assert.deepEqual(f.writes, []);
});

for (const interruption of ['blur', 'hidden', 'pagehide'])
  test(`a ${interruption} Settings close cannot focus or resume in the background`, async (t) => {
    const f = await fixture(t);
    pause(f);
    open(f);
    const before = state(f);
    if (interruption === 'hidden') {
      f.doc.hidden = true;
      f.doc.emit('visibilitychange');
    } else {
      f.doc.focused = false;
      f.win.emit(interruption, { persisted: true });
    }
    f.$('coop-options').close();
    assert.notEqual(f.doc.activeElement.id, 'coop-settings-open');
    f.doc.hidden = false;
    f.doc.focused = true;
    f.win.emit('focus');
    f.tick(10);
    assert.deepEqual(state(f), before);
    assert.notEqual(f.doc.activeElement.id, 'coop-settings-open');
  });

test('queued old close and newer focus cannot replace the current Settings visit', async (t) => {
  const f = await fixture(t);
  open(f);
  f.$('coop-settings-close').click();
  open(f);
  tab(f, 'audio').focus();
  f.tap('Enter');
  f.$('coop-options').emit('close', { bubbles: false });
  assert.equal(f.$('coop-options').open, true);
  assert.equal(f.doc.activeElement, tab(f, 'audio'));
  f.$('coop-race').focus();
  f.$('coop-options').close();
  assert.equal(
    f.doc.activeElement.id,
    'coop-race',
    'A newer external focus intent is not replaced',
  );
});

test('paused keyboard quick Sound and Settings mute share one owner without resuming', async (t) => {
  const f = await fixture(t);
  pause(f);
  const before = state(f);
  const note = f.$('coop-audio-note').textContent;
  for (let i = 0; i < 30 && f.doc.activeElement.id !== 'coop-quick-sound'; i++) f.tap('Tab');
  assert.equal(f.doc.activeElement.id, 'coop-quick-sound');
  assert.equal(f.$('coop-overlay').contains(f.doc.activeElement), true);
  f.tap('Enter');
  f.tick(120);
  assert.equal(f.$('coop-quick-sound').textContent, 'Sound: on');
  assert.equal(f.$('coop-quick-sound').getAttribute('aria-pressed'), 'true');
  assert.equal(f.$('coop-audio').textContent, 'Mute sound');
  open(f);
  tab(f, 'audio').click();
  f.$('coop-audio').click();
  assert.equal(f.$('coop-quick-sound').textContent, 'Sound: off');
  assert.equal(f.$('coop-quick-sound').getAttribute('aria-pressed'), 'false');
  assert.equal(f.$('coop-audio-note').textContent, note);
  assert.equal(JSON.parse(f.values.get(AUDIO_PREFERENCES_KEY)).muted, true);
  assert.deepEqual([...new Set(f.writes.map(([key]) => key))], [AUDIO_PREFERENCES_KEY]);
  assert.equal(f.values.get('revealline.library.test.v1'), 'preserved solo profile');
  assert.equal(f.values.get('revealline.suspended.test.v1'), 'preserved solo flight');
  f.$('coop-settings-close').click();
  f.tick(120);
  assert.deepEqual(state(f), { ...before, stored: [...f.values] });
});

test('terminal disposal retires Settings controls without reopening, refocusing, saving or retaining pictures', async (t) => {
  const f = await fixture(t);
  pause(f);
  open(f);
  const reads = f.artwork.calls.reads.length;
  // Native close observers can synchronously repeat terminal page disposal.
  f.$('coop-options').addEventListener('close', () => f.win.emit('pagehide'));
  f.win.emit('pagehide');
  const focus = f.doc.activeElement;
  f.$('coop-settings-open').click();
  f.$('coop-quick-sound').click();
  tab(f, 'audio').click();
  f.$('coop-options').emit('close', { bubbles: false });
  assert.equal(f.$('coop-options').open, false);
  assert.equal(f.doc.activeElement, focus);
  assert.deepEqual(f.writes, []);
  assert.equal(f.artwork.calls.reads.length, reads);
  assert.equal(f.artwork.calls.closes, 1);
  assert.deepEqual(f.artwork.calls.releases, f.artwork.calls.urls);
});

test('a newer focus choice during native Settings opening wins over the default category focus', async (t) => {
  const f = await fixture(t, {
    beforeImport({ $ }) {
      const dialog = $('coop-options'),
        show = dialog.showModal;
      dialog.showModal = () => {
        show();
        $('coop-text-face').focus();
      };
    },
  });
  open(f);
  assert.equal(f.doc.activeElement.id, 'coop-text-face');
});

for (const change of ['reopen', 'background'])
  test(`a ${change} during return visibility checking retires the old Settings close`, async (t) => {
    const f = await fixture(t);
    open(f);
    const opener = f.$('coop-settings-open'),
      rects = opener.getClientRects.bind(opener);
    let changed = false;
    t.mock.method(opener, 'getClientRects', () => {
      if (!changed) {
        changed = true;
        if (change === 'reopen') opener.click();
        else f.doc.focused = false;
      }
      return rects();
    });
    f.$('coop-settings-close').click();
    assert.equal(changed, true);
    assert.notEqual(f.doc.activeElement, opener);
    assert.equal(f.$('coop-options').open, change === 'reopen');
    if (change === 'reopen') assert.equal(f.doc.activeElement, tab(f, 'display'));
    assert.deepEqual(f.writes, []);
  });

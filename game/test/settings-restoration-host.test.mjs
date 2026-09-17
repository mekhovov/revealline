import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as nextTask } from 'node:timers/promises';
import { AUDIO_PREFERENCES_KEY } from '../audio-preferences.mjs';
import { DISPLAY_PREFERENCES_KEY } from '../display-preferences.mjs';
import { MENU_STYLE_PREFERENCES_KEY } from '../menu-style-preferences.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { soloPage, memoryStorage } from './helpers/solo-dom.mjs';
import { couchPage } from './helpers/couch-host.mjs';
import { page as teamPage } from './helpers/coop-host.mjs';

const saved = {
  volume: 0.37,
  face: 'plain',
  size: 'large',
  reduced: true,
  palette: 'ukrainian',
  ornaments: 'rich',
};
const stale = {
  volume: 0.91,
  face: 'pixel',
  size: 'standard',
  reduced: false,
  palette: 'auto',
  ornaments: 'off',
};

// Real preference authorities and page handlers. The DOM/history lifecycle is
// modeled; this does not claim that a browser admitted the page to BFCache.
async function host(t, mode) {
  const solo = mode === 'Solo',
    team = mode === 'Team',
    storage = memoryStorage({
      [AUDIO_PREFERENCES_KEY]: JSON.stringify({ muted: true, volume: saved.volume }),
      [DISPLAY_PREFERENCES_KEY]: JSON.stringify({
        textFace: saved.face,
        textSize: saved.size,
        reducedEffects: saved.reduced,
      }),
      [MENU_STYLE_PREFERENCES_KEY]: JSON.stringify({
        palette: saved.palette,
        ornaments: saved.ornaments,
      }),
    }),
    f = solo
      ? await soloPage(t, { storage })
      : team
        ? await teamPage(t, {
            nativeFocus: true,
            nativeVisibility: true,
            capturePaint: true,
            beforeImport: ({ install }) => install('localStorage', { value: storage }),
          })
        : await couchPage(t, { storage }),
    prefix = solo ? '' : team ? 'coop-' : 'race-',
    controls = {
      volume: f.$(`${prefix}master-volume`),
      face: f.$(`${prefix}text-face`),
      size: f.$(`${prefix}text-size`),
      reduced: f.$(solo ? 'settings-reduced-effects' : `${prefix}reduced`),
      palette: f.$(`${prefix}menu-palette`),
      ornaments: f.$(`${prefix}menu-ornaments`),
    },
    advance = () => (solo ? f.frame(80) : team ? f.tick(6) : f.frames(6));
  f.$(solo ? 'start-button' : `${prefix}start`).click();
  if (solo) {
    f.key('ArrowDown');
    f.key('ArrowDown', false);
  }
  advance();
  if (!solo) f.$(`${prefix}pause`).click();
  f.$(solo ? 'settings-button' : team ? 'coop-settings-open' : 'race-options').click();
  f.$(`${prefix}settings-tab-display`).click();
  advance();
  controls.face.focus();
  assert.equal(f.doc.activeElement, controls.face);
  // A retained history page first suspends its writer and gameplay owner.
  // Keep that boundary real so a later view repair cannot inherit a live writer.
  f.win.emit('pagehide', { persisted: true });
  const run = solo ? f.rendered.run : null;
  const state = (includePresentation = true) =>
    solo
      ? { paused: f.rendered.paused, checkpoint: authoritativeCheckpoint(f.rendered.run) }
      : team
        ? {
            paused: !f.$('coop-overlay').hidden,
            hud: ['clock', 'coverage', 'reserves', 'objective', 'state-0', 'state-1'].map(
              (id) => f.$(`coop-${id}`).textContent,
            ),
            ...(includePresentation ? { paint: f.lastPaint } : {}),
          }
        : { paused: f.state() === 'paused', checkpoint: f.checkpoint() };
  const before = state(),
    gameplayBefore = state(false),
    focus = f.doc.activeElement;
  assert.equal(before.paused, true);
  const read = () =>
    Object.fromEntries(
      Object.entries(controls).map(([key, control]) => [
        key,
        key === 'reduced'
          ? control.checked
          : key === 'volume'
            ? Number(control.value)
            : control.value,
      ]),
    );
  assert.deepEqual(read(), saved);
  const focusEvents = [],
    scrollEvents = [];
  f.doc.addEventListener('focusin', (event) => focusEvents.push(event.target.id));
  for (const [key, control] of Object.entries(controls))
    t.mock.method(control, 'scrollIntoView', () => scrollEvents.push(key));
  return {
    ...f,
    storage,
    controls,
    read,
    effects: () => ({ focus: [...focusEvents], scroll: [...scrollEvents] }),
    corrupt(record = stale) {
      for (const [key, value] of Object.entries(record))
        controls[key][key === 'reduced' ? 'checked' : 'value'] = value;
    },
    change(key, value) {
      const control = controls[key],
        tab = f.$(`${prefix}settings-tab-${key === 'volume' ? 'audio' : 'display'}`);
      tab.click();
      assert.equal(tab.getAttribute('aria-selected'), 'true');
      assert.equal(control.closest('[hidden],[inert]'), null);
      assert.ok(control.getClientRects().length);
      assert.equal(control.disabled, false);
      control.focus();
      assert.equal(f.doc.activeElement, control);
      control[key === 'reduced' ? 'checked' : 'value'] = value;
      control.emit('change');
    },
    unchanged({ advanceFrame = true, expectedFocus = focus, presentationChanged = false } = {}) {
      if (advanceFrame) advance();
      if (solo) assert.strictEqual(f.rendered.run, run);
      assert.deepEqual(state(!presentationChanged), presentationChanged ? gameplayBefore : before);
      assert.equal(f.doc.activeElement, expectedFocus);
    },
  };
}

for (const mode of ['Solo', 'Versus', 'Team']) {
  test(`${mode} pageshow synchronously repairs stale form values even when saved preferences are unchanged`, async (t) => {
    const f = await host(t, mode),
      writes = [...f.storage.writes],
      records = [...f.storage.map];
    f.corrupt();
    f.win.emit('pageshow', { persisted: true });
    assert.deepEqual(f.read(), saved);
    await nextTask(0);
    assert.deepEqual(f.storage.writes, writes);
    assert.deepEqual([...f.storage.map], records);
    f.unchanged();
    assert.deepEqual(f.effects(), { focus: [], scroll: [] });
  });

  test(`${mode} the deferred pageshow task repairs form values restored after the event without writes`, async (t) => {
    const f = await host(t, mode),
      writes = [...f.storage.writes],
      records = [...f.storage.map];
    f.win.emit('pageshow', { persisted: true });
    f.corrupt(); // Model browser form-state restoration after pageshow listeners.
    assert.deepEqual(f.read(), stale);
    await nextTask(0);
    assert.deepEqual(f.read(), saved);
    assert.deepEqual(f.storage.writes, writes);
    assert.deepEqual([...f.storage.map], records);
    f.unchanged();
    assert.deepEqual(f.effects(), { focus: [], scroll: [] });
  });

  test(`${mode} a newer explicit setting before deferred restoration keeps its current authority`, async (t) => {
    const f = await host(t, mode),
      latest = { ...stale, volume: 0.22, ornaments: 'subtle' };
    f.win.emit('pageshow', { persisted: true });
    for (const [key, value] of Object.entries(latest)) f.change(key, value);
    const writes = [...f.storage.writes],
      records = [...f.storage.map],
      focus = f.doc.activeElement,
      effects = f.effects();
    assert.deepEqual(f.read(), latest);
    await nextTask(0);
    assert.deepEqual(f.read(), latest);
    assert.deepEqual(
      f.storage.writes,
      writes,
      'A repaint cannot persist preferences or a profile.',
    );
    assert.deepEqual([...f.storage.map], records);
    f.unchanged({ presentationChanged: true, expectedFocus: focus });
    assert.deepEqual(f.effects(), effects);
  });

  test(`${mode} terminal pagehide prevents a queued restoration or late pageshow from repainting`, async (t) => {
    const f = await host(t, mode);
    f.win.emit('pageshow', { persisted: true });
    f.win.emit('pagehide', { persisted: false });
    const writes = [...f.storage.writes],
      records = [...f.storage.map],
      focus = f.doc.activeElement,
      effects = f.effects();
    f.corrupt();
    await nextTask(0);
    assert.deepEqual(f.read(), stale);
    f.win.emit('pageshow', { persisted: true });
    await nextTask(0);
    assert.deepEqual(f.read(), stale);
    assert.deepEqual(f.storage.writes, writes);
    assert.deepEqual([...f.storage.map], records);
    f.unchanged({ advanceFrame: false, expectedFocus: focus });
    assert.deepEqual(f.effects(), effects);
  });
}

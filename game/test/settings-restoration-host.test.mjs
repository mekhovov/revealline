import test from 'node:test';
import assert from 'node:assert/strict';
// Preserve strict identity without recursively formatting the fixture DOM.
function boundedIdentity(actual, expected, message) {
  const same = Object.is(actual, expected);
  if (same) return;
  const label = (value) => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value !== 'object' && typeof value !== 'function') return String(value).slice(0, 80);
    return (
      [value.tagName, value.id]
        .filter((x) => typeof x === 'string')
        .map((x) => x.slice(0, 80))
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
  f.$(`${prefix}settings-tab-accessibility`).click();
  advance();
  controls.face.focus();
  boundedIdentity(f.doc.activeElement, controls.face);
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
    neutralInput: () => {
      if (team) f.tick();
    },
    effects: () => ({ focus: [...focusEvents], scroll: [...scrollEvents] }),
    corrupt(record = stale) {
      for (const [key, value] of Object.entries(record))
        controls[key][key === 'reduced' ? 'checked' : 'value'] = value;
    },
    change(key, value) {
      const control = controls[key],
        category =
          key === 'volume'
            ? 'audio'
            : ['face', 'size', 'reduced'].includes(key)
              ? 'accessibility'
              : 'display',
        tab = f.$(`${prefix}settings-tab-${category}`);
      tab.click();
      assert.equal(tab.getAttribute('aria-selected'), 'true');
      boundedIdentity(control.closest('[hidden],[inert]'), null);
      assert.ok(control.getClientRects().length);
      assert.equal(control.disabled, false);
      control.focus();
      boundedIdentity(f.doc.activeElement, control);
      control[key === 'reduced' ? 'checked' : 'value'] = value;
      control.emit('change');
    },
    unchanged({ advanceFrame = true, expectedFocus = focus, presentationChanged = false } = {}) {
      if (advanceFrame) advance();
      if (solo) assert.strictEqual(f.rendered.run, run);
      assert.deepEqual(state(!presentationChanged), presentationChanged ? gameplayBefore : before);
      boundedIdentity(f.doc.activeElement, expectedFocus);
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
      latest = {
        ...saved,
        volume: 0.22,
        face: stale.face,
        size: stale.size,
        reduced: stale.reduced,
      };
    f.win.emit('pageshow', { persisted: true });
    // Team's lifecycle guard first samples released controls. A synchronous
    // frame does not run the deferred pageshow task that this action supersedes.
    f.neutralInput();
    // Palette/ornament aliases remain restoration witnesses, but the current
    // theme UI deliberately hides them. Exercise only visible public settings.
    for (const key of ['volume', 'face', 'size', 'reduced']) f.change(key, latest[key]);
    for (const key of ['palette', 'ornaments'])
      assert.equal(f.controls[key].closest('label').hidden, true);
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
    // Terminal Team/Versus disposal flushes its existing enemy-session receipt
    // asynchronously. It may repeat that exact value, never alter preferences
    // or publish new session data after retirement.
    assert.deepEqual(f.storage.writes.slice(0, writes.length), writes);
    const extra = f.storage.writes.slice(writes.length);
    assert.ok(extra.length <= (mode === 'Solo' ? 0 : 1));
    for (const [key, value] of extra) {
      assert.equal(
        key,
        `revealline-enemy-stats-session.v1:host:${mode === 'Team' ? 'team' : 'versus'}`,
      );
      assert.equal(value, new Map(records).get(key));
    }
    assert.deepEqual([...f.storage.map], records);
    f.unchanged({ advanceFrame: false, expectedFocus: focus });
    assert.deepEqual(f.effects(), effects);
  });
}

import { memoryStorage } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { attachCouchMusicHost } from '../couch/couch-music-host.mjs';
import { modelTeamDialogs } from './helpers/coop-host.mjs';
import {
  installCoopPresentation,
  waitFor as waitForTeamPicture,
} from './helpers/coop-presentation-fixture.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { couchPage, mountCouch } from './helpers/couch-host.mjs';
import { Document, Element, Events } from './helpers/couch-dom.mjs';
import { audioHarness, settleUntil } from './helpers/soundtrack-audio.mjs';
import { Soundscape } from '../ui/audio.mjs';
import { AUDIO_PREFERENCES_KEY } from '../audio-preferences.mjs';
import { FIXED_DT } from '../coop/core.mjs';
import { memoryIndexedDB, fixture, structuralProbe } from './helpers/soundtrack-fixtures.mjs';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { prepareSoundtrackLibrary } from '../soundtrack-bundle.mjs';

const teamHTML = await readFile(new URL('../couch/relay-rescue.html', import.meta.url), 'utf8');
let sequence = 0;
function storage(initial) {
  const entries = new Map([['existing-player-profile', 'unchanged-earned-progress']]);
  if (initial) entries.set(AUDIO_PREFERENCES_KEY, JSON.stringify(initial));
  const writes = [];
  return {
    entries,
    writes,
    getItem: (key) => entries.get(key) ?? null,
    setItem(key, value) {
      assert.equal(
        key,
        AUDIO_PREFERENCES_KEY,
        'Master controls must not write player/profile data.',
      );
      writes.push([key, value]);
      entries.set(key, value);
    },
    removeItem() {
      throw new Error('Master settings must not delete storage.');
    },
  };
}
const record = (store) => JSON.parse(store.getItem(AUDIO_PREFERENCES_KEY));

/** Only native key defaults absent from the finite DOM are modeled here. The
 * real bubbling navigation handler can prevent them; all clicks/changes then
 * reach the actual host handlers attached to the actual HTML controls. */
function key(page, value) {
  const target = page.doc.activeElement;
  const event = target.emit('keydown', { key: value, code: value, repeat: false });
  let rangeChanged = false;
  if (!event.defaultPrevented) {
    const dialog = target.closest('dialog[open]');
    if (value === 'Escape' && dialog) {
      const cancel = dialog.emit('cancel', { bubbles: false, cancelable: true });
      if (!cancel.defaultPrevented) dialog.close();
    }
    if (value === 'Tab' && dialog) {
      const choices = [...dialog.querySelectorAll('button,a,input,select,textarea,summary')].filter(
        (node) =>
          !node.disabled &&
          node.tabIndex >= 0 &&
          !node.closest('[hidden],[inert],[aria-hidden="true"]') &&
          node.getClientRects().length,
      );
      choices[(choices.indexOf(target) + 1) % choices.length]?.focus();
    }
    if (value === 'Enter' && target.tagName === 'BUTTON') target.click();
    if (value === 'Enter' && target.tagName === 'SUMMARY' && page.doc.activeElement === target) {
      // The finite DOM does not implement the browser's summary activation.
      const click = target.emit('click');
      if (!click.defaultPrevented) {
        const details = target.closest('details');
        details.open = !details.open;
        details.emit('toggle', { bubbles: false });
      }
    }
    if (target.tagName === 'INPUT' && target.type === 'range' && /^Arrow/.test(value)) {
      const delta = ['ArrowRight', 'ArrowUp'].includes(value) ? 1 : -1;
      target.value = String(
        Number(
          Math.min(
            Number(target.max),
            Math.max(Number(target.min), Number(target.value) + delta * Number(target.step)),
          ).toFixed(8),
        ),
      );
      target.emit('input');
      rangeChanged = true;
    }
  }
  target.emit('keyup', { key: value, code: value });
  if (rangeChanged) target.emit('change');
  return event;
}
function enter(page, id) {
  page.$(id).focus();
  assert.equal(page.doc.activeElement, page.$(id));
  key(page, 'Enter');
}
function reaches(page, id, limit = 24) {
  for (let count = 0; count < limit; count++) {
    key(page, 'Tab');
    if (page.doc.activeElement === page.$(id)) return;
  }
  assert.fail(`Keyboard Tab must reach ${id}.`);
}
function audio(t) {
  const h = audioHarness();
  let contexts = 0,
    elements = 0,
    output = null;
  const original = Soundscape.prototype.enable;
  Soundscape.prototype.enable = function (...args) {
    output = this;
    return original.apply(this, args);
  };
  t.after(() => {
    Soundscape.prototype.enable = original;
  });
  return {
    ...h,
    createElement(doc) {
      const media = elements++ === 0 ? h.media : audioHarness().media;
      const element = new Element(doc, 'audio');
      for (const [key, value] of Object.entries(element))
        if (!Object.hasOwn(media, key)) media[key] = value;
      Object.setPrototypeOf(media, Object.getPrototypeOf(element));
      return media;
    },
    Context: class {
      constructor() {
        contexts++;
        return h.context;
      }
    },
    contexts: () => contexts,
    elements: () => elements,
    output: () => output,
  };
}

async function teamPage(t, store, { audio = null, assetDatabase, pads = [] } = {}) {
  const doc = new Document(),
    win = new Events();
  doc.parentNode = win;
  mountCouch(doc, teamHTML);
  modelTeamDialogs(doc);
  const $ = (id) => doc.getElementById(id);
  let mediaElements = 0,
    contexts = 0;
  const create = doc.createElement.bind(doc);
  doc.createElement = (tag) => {
    if (tag === 'audio' || tag === 'video') mediaElements++;
    return tag === 'audio' && audio ? audio.createElement(doc) : create(tag);
  };
  $('coop-canvas').width = 1152;
  $('coop-canvas').height = 576;
  $('coop-canvas').getContext = () =>
    new Proxy({}, { get: (target, key) => (Object.hasOwn(target, key) ? target[key] : () => {}) });
  const frames = new Map(),
    originals = new Map();
  let next = 0,
    now = 0;
  const globals = {
    document: doc,
    window: win,
    localStorage: store,
    navigator: { getGamepads: () => pads },
    location: { href: 'http://localhost/game/couch/relay-rescue.html' },
    matchMedia: () => ({ matches: false }),
    indexedDB: assetDatabase,
    AudioContext:
      audio?.Context ||
      class {
        constructor() {
          contexts++;
          throw new Error('This finite Team fixture has no media adapter.');
        }
      },
    requestAnimationFrame(fn) {
      frames.set(++next, fn);
      return next;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
  };
  for (const [name, value] of Object.entries(globals)) {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  t.after(() => {
    win.emit('pagehide', { persisted: false });
    frames.clear();
    for (const [name, descriptor] of originals)
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
  });
  installCoopPresentation({
    doc,
    win,
    install(key, descriptor) {
      originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
      Object.defineProperty(globalThis, key, { configurable: true, ...descriptor });
    },
  });
  await import(`../couch/relay-rescue.mjs?audio-host=${++sequence}`);
  await waitForTeamPicture(
    () => $('coop-picture-status').dataset.state === 'ready',
    () => $('coop-picture-status').textContent,
  );
  assert.equal(doc.documentElement.dataset.toolState, 'ready');
  const tick = (count = 1) => {
    for (let index = 0; index < count; index++) {
      const [id, fn] = frames.entries().next().value;
      frames.delete(id);
      fn((now += FIXED_DT * 1000));
    }
  };
  return { $, doc, win, tick, contexts: () => contexts, mediaElements: () => mediaElements };
}

test('Versus keyboard master controls persist only the shared record; Team and another Versus restore without autoplay', async (t) => {
  const saved = storage();
  await t.test('actual Versus controls', async (t) => {
    const a = audio(t),
      page = await couchPage(t, { storage: saved, audio: a });
    const before = page.checkpoint();
    enter(page, 'race-options');
    enter(page, 'race-settings-tab-audio');
    reaches(page, 'race-audio');
    assert.equal(page.$('race-audio').textContent, 'Unmute sound');
    assert.equal(page.$('race-audio').getAttribute('aria-pressed'), null);
    key(page, 'Enter');
    assert.equal(page.$('race-audio').textContent, 'Mute sound');
    assert.equal(page.$('race-audio').getAttribute('aria-pressed'), null);
    reaches(page, 'race-master-volume');
    key(page, 'ArrowRight');
    assert.deepEqual(record(saved), { muted: false, volume: 0.66 });
    assert.equal(saved.getItem(AUDIO_PREFERENCES_KEY), '{"muted":false,"volume":0.66}');
    assert.equal(a.contexts(), 0);
    assert.equal(a.media.plays, 0);
    assert.deepEqual(page.checkpoint(), before);
    assert.equal(page.state(), 'ready');
  });
  await t.test('fresh Team receives settings, not music or progress', async (t) => {
    const before = saved.writes.length,
      page = await teamPage(t, saved);
    assert.equal(page.$('coop-audio').textContent, 'Mute sound');
    assert.equal(page.$('coop-audio').getAttribute('aria-pressed'), null);
    assert.equal(Number(page.$('coop-master-volume').value), 0.66);
    assert.equal(saved.writes.length, before);
    assert.equal(page.$('coop-menu').hidden, false);
    assert.equal(page.contexts(), 0);
    assert.equal(page.mediaElements(), 1);
  });
  await t.test('fresh Versus restores without context creation or playing', async (t) => {
    const before = saved.writes.length,
      a = audio(t);
    const page = await couchPage(t, { storage: saved, audio: a });
    assert.equal(page.$('race-audio').textContent, 'Mute sound');
    assert.equal(page.$('race-audio').getAttribute('aria-pressed'), null);
    assert.equal(Number(page.$('race-master-volume').value), 0.66);
    assert.equal(page.state(), 'ready');
    assert.equal(page.tick(), 0);
    assert.equal(a.contexts(), 0);
    assert.equal(a.media.plays, 0);
    assert.equal(saved.writes.length, before);
  });
  assert.equal(saved.getItem('existing-player-profile'), 'unchanged-earned-progress');
});

test('Versus starts muted, then master edits preserve active music intent and a paused duel checkpoint', async (t) => {
  const saved = storage({ muted: true, volume: 0.4 }),
    a = audio(t);
  const page = await couchPage(t, { storage: saved, audio: a });
  enter(page, 'race-start');
  await settleUntil(() => a.output()?.enabled && !a.output().musicTransportPaused);
  page.frame(); // The host renders its changed duel state on the next animation frame.
  assert.equal(page.state(), 'running');
  const sound = a.output();
  assert.equal(sound.master.gain.value, 0);
  assert.equal(a.media.muted, true);
  page.frames(4);
  enter(page, 'race-pause');
  const before = page.checkpoint(),
    music = sound.musicState(),
    cursor = sound.cursor;
  enter(page, 'race-options');
  enter(page, 'race-settings-tab-audio');
  reaches(page, 'race-audio');
  key(page, 'Enter');
  assert.equal(page.$('race-audio').textContent, 'Mute sound');
  assert.equal(page.$('race-audio').getAttribute('aria-pressed'), null);
  key(page, 'Enter');
  assert.equal(page.$('race-audio').textContent, 'Unmute sound');
  assert.equal(page.$('race-audio').getAttribute('aria-pressed'), null);
  key(page, 'Enter');
  assert.equal(sound.master.gain.value, 0.4);
  assert.equal(a.media.muted, false);
  assert.equal(sound.musicTransportPaused, false);
  assert.equal(sound.cursor, cursor);
  assert.deepEqual(sound.musicState(), music);
  reaches(page, 'race-master-volume');
  key(page, 'ArrowLeft');
  assert.deepEqual(record(saved), { muted: false, volume: 0.39 });
  page.frames(30);
  assert.equal(page.state(), 'paused');
  assert.deepEqual(page.checkpoint(), before);
});

test('Versus controller edits the actual master slider without starting either board', async (t) => {
  const saved = storage({ muted: true, volume: 0.5 });
  const pad = {
    index: 0,
    id: 'Master controls test pad',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
  };
  const page = await couchPage(t, { storage: saved, pads: [pad] });
  page.join(0);
  enter(page, 'race-options');
  enter(page, 'race-settings-tab-audio');
  page.frame();
  const before = page.checkpoint();
  page.focus('race-master-volume');
  page.pulse(0, 0);
  assert.equal(page.editors().length, 1, 'Master slider participates in actual menu ownership.');
  page.pulse(0, 15);
  page.pulse(0, 0);
  assert.equal(page.editors().length, 0);
  assert.deepEqual(record(saved), { muted: true, volume: 0.51 });
  assert.equal(page.doc.activeElement.id, 'race-master-volume');
  assert.equal(page.state(), 'ready');
  assert.deepEqual(page.checkpoint(), before);
});

test('Team keyboard master edits remain accessible while paused and preserve its live board and unrelated feedback', async (t) => {
  const saved = storage({ muted: true, volume: 0.25 }),
    page = await teamPage(t, saved);
  enter(page, 'coop-start');
  page.tick(8);
  enter(page, 'coop-pause');
  const ids = ['coop-clock', 'coop-coverage', 'coop-message', 'coop-state-0', 'coop-state-1'];
  const before = ids.map((id) => page.$(id).textContent);
  page.$('coop-settings-open').click();
  page.$('coop-settings-tab-audio').click();
  page.$('coop-settings-tab-audio').focus();
  reaches(page, 'coop-audio');
  assert.equal(page.$('coop-audio').textContent, 'Unmute sound');
  assert.equal(page.$('coop-audio').getAttribute('aria-pressed'), null);
  key(page, 'Enter');
  assert.equal(page.$('coop-audio').textContent, 'Mute sound');
  assert.equal(page.$('coop-audio').getAttribute('aria-pressed'), null);
  key(page, 'Enter');
  assert.equal(page.$('coop-audio').textContent, 'Unmute sound');
  assert.equal(page.$('coop-audio').getAttribute('aria-pressed'), null);
  key(page, 'Enter');
  reaches(page, 'coop-master-volume');
  key(page, 'ArrowRight');
  assert.deepEqual(record(saved), { muted: false, volume: 0.26 });
  page.tick(120);
  assert.equal(page.$('coop-overlay').hidden, false);
  assert.equal(page.$('coop-overlay-title').textContent, 'Both players paused');
  assert.deepEqual(
    ids.map((id) => page.$(id).textContent),
    before,
  );
  assert.equal(page.contexts(), 0);
  assert.equal(page.mediaElements(), 1);
  assert.equal(saved.getItem('existing-player-profile'), 'unchanged-earned-progress');
});

test('Team keeps its sound explanation through saved edits, storage failure and recovery without starting play', async (t) => {
  const saved = storage({ muted: true, volume: 0.25 }),
    persist = saved.setItem.bind(saved),
    attempts = [];
  let failWrite = false;
  saved.setItem = (key, value) => {
    assert.equal(key, AUDIO_PREFERENCES_KEY);
    attempts.push([key, value]);
    if (failWrite) throw new Error('Storage temporarily unavailable.');
    persist(key, value);
  };
  const page = await teamPage(t, saved),
    options = page.$('coop-options'),
    status = page.$('coop-audio-status');
  page.$('coop-settings-open').click();
  page.$('coop-settings-tab-audio').click();
  page.tick(2);
  const ids = ['coop-clock', 'coop-coverage', 'coop-message', 'coop-state-0', 'coop-state-1'],
    before = ids.map((id) => page.$(id).textContent);
  function expectExplanation() {
    const explanation = options
      .querySelectorAll('p')
      .find((node) => /Team gameplay cues\s+remain visual\./.test(node.textContent));
    assert.ok(explanation, 'Changing sound settings must retain the Team sound explanation.');
    for (let node = explanation; node && node !== page.doc; node = node.parentNode) {
      assert.equal(node.hidden, false);
      if (node.tagName === 'DETAILS') assert.equal(node.open, true);
    }
    page.tick(120);
    assert.equal(page.$('coop-menu').hidden, false);
    assert.deepEqual(
      ids.map((id) => page.$(id).textContent),
      before,
    );
    assert.equal(page.contexts(), 0);
    assert.equal(page.mediaElements(), 1);
    assert.equal(saved.getItem('existing-player-profile'), 'unchanged-earned-progress');
  }
  expectExplanation();
  assert.equal(status.getAttribute('role'), 'status');

  enter(page, 'coop-audio');
  assert.deepEqual(record(saved), { muted: false, volume: 0.25 });
  expectExplanation();
  assert.equal(status.textContent, '');

  failWrite = true;
  page.$('coop-master-volume').focus();
  key(page, 'ArrowRight');
  assert.equal(Number(page.$('coop-master-volume').value), 0.26);
  assert.deepEqual(record(saved), { muted: false, volume: 0.25 });
  assert.equal(
    status.textContent,
    'Sound changed for this session, but could not be saved for another page.',
  );
  expectExplanation();

  failWrite = false;
  key(page, 'ArrowRight');
  assert.deepEqual(record(saved), { muted: false, volume: 0.27 });
  assert.equal(status.textContent, '');
  expectExplanation();
  assert.equal(attempts.length, 3);
  assert.equal(saved.writes.length, 2);
});

for (const mode of ['Versus', 'Team'])
  test(`${mode} sound edits survive paused Help pan and keyboard return without replacing audio feedback`, async (t) => {
    const team = mode === 'Team',
      saved = storage({ muted: false, volume: 0.4 }),
      persist = saved.setItem.bind(saved);
    let refuse = false;
    saved.setItem = (name, value) => {
      if (refuse) throw new Error('Shared sound preferences temporarily unavailable.');
      persist(name, value);
    };
    const a = team ? null : audio(t),
      page = team ? await teamPage(t, saved) : await couchPage(t, { storage: saved, audio: a }),
      prefix = team ? 'coop' : 'race',
      control = (suffix) => page.$(`${prefix}-${suffix}`),
      frames = (count) => (team ? page.tick(count) : page.frames(count)),
      state = () =>
        team
          ? {
              hud: ['clock', 'coverage', 'message', 'state-0', 'state-1'].map(
                (id) => control(id).textContent,
              ),
              progress: control('progress').value,
              paused: !control('overlay').hidden,
              lobby: !control('menu').hidden,
            }
          : { status: page.state(), checkpoints: page.checkpoint() };
    enter(page, `${prefix}-start`);
    if (!team) await settleUntil(() => a.output()?.enabled && !a.output().musicTransportPaused);
    frames(8);
    enter(page, `${prefix}-pause`);
    frames(2);
    const attempt = state();
    assert.equal(team ? attempt.paused && !attempt.lobby : attempt.status === 'paused', true);
    const sound = a?.output(),
      music = sound?.musicState(),
      cursor = sound?.cursor,
      plays = a?.media.plays;
    enter(page, `${prefix}-${team ? 'settings-open' : 'options'}`);
    enter(page, `${prefix}-settings-tab-audio`);
    reaches(page, `${prefix}-audio`);
    key(page, 'Enter');
    assert.deepEqual(record(saved), { muted: true, volume: 0.4 });
    refuse = team;
    reaches(page, `${prefix}-master-volume`);
    key(page, 'ArrowRight');
    assert.equal(Number(control('master-volume').value), 0.41);
    const preferenceBytes = saved.getItem(AUDIO_PREFERENCES_KEY),
      writes = saved.writes.length,
      warning = control('audio-status').textContent,
      explanation = team ? control('audio-note').textContent : null;
    if (team) {
      assert.match(warning, /could not be saved/);
      assert.match(explanation, /Team gameplay cues\s+remain visual/);
      assert.deepEqual(record(saved), { muted: true, volume: 0.4 });
    } else assert.equal(warning, '');

    enter(page, `${prefix}-${team ? 'settings-close' : 'options-back'}`);
    enter(page, `${prefix}-${team ? 'help-toggle' : 'help'}`);
    const entry = control('help-read'),
      region = control('help-reading'),
      done = control('help-reading-done');
    region.clientHeight = 100;
    region.scrollHeight = 600;
    enter(page, entry.id);
    assert.equal(page.doc.activeElement, region);
    assert.equal(done.disabled, false);
    const pan = region.emit('pointerdown', {
      pointerType: 'touch',
      pointerId: 51,
      button: 0,
      isPrimary: true,
    });
    assert.equal(pan.defaultPrevented, false);
    // Native scrolling and pan adoption are boundary inputs, not device evidence.
    region.scrollTop = 80;
    region.emit('pointercancel', { pointerType: 'touch', pointerId: 51, isPrimary: true });
    frames(4);
    assert.equal(page.doc.activeElement, region);
    assert.equal(done.disabled, false);
    assert.match(control('help-reading-hint').textContent, /Done reading returns/);
    assert.equal(control('audio-status').textContent, warning);
    assert.equal(key(page, 'Escape').defaultPrevented, true);
    assert.equal(page.doc.activeElement, entry);
    assert.equal(done.disabled, true);
    assert.equal(region.scrollTop, 80);
    enter(page, `${prefix}-${team ? 'help-toggle' : 'help-back'}`);
    enter(page, `${prefix}-${team ? 'settings-open' : 'options'}`);
    frames(30);
    assert.deepEqual(state(), attempt);
    assert.equal(saved.getItem(AUDIO_PREFERENCES_KEY), preferenceBytes);
    assert.equal(saved.writes.length, writes);
    assert.equal(control('audio-status').textContent, warning);
    assert.equal(control('audio').textContent, 'Unmute sound');
    assert.equal(control('audio').getAttribute('aria-pressed'), null);
    assert.equal(Number(control('master-volume').value), 0.41);
    assert.equal(saved.getItem('existing-player-profile'), 'unchanged-earned-progress');
    if (team) {
      assert.equal(control('options').open, true);
      assert.equal(control('audio-note').textContent, explanation);
      assert.equal(control('audio-note').hidden, false);
      assert.equal(page.contexts(), 0);
      assert.equal(page.mediaElements(), 1);
      refuse = false;
      reaches(page, 'coop-master-volume');
      key(page, 'ArrowRight');
      assert.deepEqual(record(saved), { muted: true, volume: 0.42 });
      assert.equal(control('audio-status').textContent, '');
      assert.equal(control('audio-note').textContent, explanation);
      frames(30);
      assert.deepEqual(state(), attempt);
      assert.equal(page.contexts(), 0);
    } else {
      assert.equal(sound.master.gain.value, 0);
      assert.equal(a.media.muted, true);
      assert.equal(sound.musicTransportPaused, false);
      assert.equal(sound.cursor, cursor);
      assert.deepEqual(sound.musicState(), music);
      assert.equal(a.media.plays, plays);
    }
  });

for (const mode of ['Team', 'Versus']) {
  test(`${mode}: actual music library returns through Audio Settings and Pause survives first Start`, async (t) => {
    const saved = storage({ muted: true, volume: 0.13 }),
      a = audio(t),
      db = memoryIndexedDB();
    const page =
      mode === 'Team'
        ? await teamPage(t, saved, { audio: a, assetDatabase: db.indexedDB })
        : await couchPage(t, { storage: saved, audio: a, assetDatabase: db.indexedDB });
    const prefix = mode === 'Team' ? 'coop' : 'race';
    const settings = mode === 'Team' ? 'coop-settings-open' : 'race-options';
    const closeSettings = mode === 'Team' ? 'coop-settings-close' : 'race-options-back';
    await settleUntil(() => page.$(`${prefix}-music-status`)?.dataset.state === 'ready');
    enter(page, settings);
    enter(page, `${prefix}-settings-tab-audio`);
    enter(page, `${prefix}-music-pause`);
    enter(page, `${prefix}-music-library`);
    await settleUntil(
      () => page.$('soundtrack-dialog')?.open && !page.$('soundtrack-close').disabled,
    );
    assert.equal(page.doc.activeElement.id, 'soundtrack-close');
    key(page, 'Escape');
    assert.equal(page.$('soundtrack-dialog').open, false);
    assert.equal(page.doc.activeElement.id, `${prefix}-music-library`);
    enter(page, closeSettings);
    assert.equal(page.doc.activeElement.id, settings);
    enter(page, `${prefix}-start`);
    await new Promise((resolve) => setImmediate(resolve));
    if (mode === 'Versus') await settleUntil(() => a.output()?.enabled);
    assert.equal(
      a.contexts(),
      mode === 'Team' ? 0 : 1,
      'Versus effects stay available independently of paused music.',
    );
    if (mode === 'Versus') assert.equal(a.output().musicTransportPaused, true);
    assert.equal(a.media.plays, 0);
    assert.equal(saved.getItem('existing-player-profile'), 'unchanged-earned-progress');
    assert.deepEqual(record(saved), { muted: true, volume: 0.13 });
  });

  test(`${mode}: actual Music Play stays muted and session volume does not rewrite master or Solo profile`, async (t) => {
    const saved = storage({ muted: true, volume: 0.13 }),
      a = audio(t),
      db = memoryIndexedDB();
    const page =
      mode === 'Team'
        ? await teamPage(t, saved, { audio: a, assetDatabase: db.indexedDB })
        : await couchPage(t, { storage: saved, audio: a, assetDatabase: db.indexedDB });
    const prefix = mode === 'Team' ? 'coop' : 'race';
    await settleUntil(() => page.$(`${prefix}-music-status`)?.dataset.state === 'ready');
    enter(page, mode === 'Team' ? 'coop-settings-open' : 'race-options');
    enter(page, `${prefix}-settings-tab-audio`);
    enter(page, `${prefix}-music-play`);
    await settleUntil(() => a.output()?.enabled && !a.output().musicTransportPaused);
    assert.equal(a.output().master.gain.value, 0);
    const before = saved.writes.length;
    page.$(`${prefix}-music-volume`).value = '0.31';
    page.$(`${prefix}-music-volume`).emit('input');
    assert.equal(a.output().getSettings().music, 0.31);
    assert.equal(saved.writes.length, before);
    assert.deepEqual(record(saved), { muted: true, volume: 0.13 });
    assert.equal(saved.getItem('existing-player-profile'), 'unchanged-earned-progress');
    enter(page, `${prefix}-music-pause`);
    assert.equal(a.output().musicTransportPaused, true);
  });
}

for (const mode of ['Team', 'Versus']) {
  test(`${mode}: saved shared MP3 loads silently and foreground restoration retains explicit Pause`, async (t) => {
    const saved = storage({ muted: true, volume: 0.13 }),
      a = audio(t),
      db = memoryIndexedDB();
    const imported = await fixture();
    const library = structuredClone(imported.library);
    library.playlists[0].trackIds = [imported.track.id];
    library.assignments = [{ scope: 'global', key: null, playlistId: library.playlists[0].id }];
    const prepared = await prepareSoundtrackLibrary(library, imported.assets, {
      probeMedia: structuralProbe,
    });
    const solo = createManagedMediaStore({ indexedDB: db.indexedDB, storyMedia: true });
    await solo.commitDomain('audio', prepared, { expectedGeneration: 0 });
    solo.close();
    db.allPuts.length = 0;
    const page =
      mode === 'Team'
        ? await teamPage(t, saved, { audio: a, assetDatabase: db.indexedDB })
        : await couchPage(t, { storage: saved, audio: a, assetDatabase: db.indexedDB });
    const prefix = mode === 'Team' ? 'coop' : 'race';
    await settleUntil(() => page.$(`${prefix}-music-status`)?.dataset.state === 'ready');
    assert.match(page.$(`${prefix}-music-status`).textContent, /Synthetic coded silence/);
    assert.equal(a.media.plays, 0);
    assert.equal(a.contexts(), 0);
    page.$(mode === 'Team' ? 'coop-settings-open' : 'race-options').click();
    page.$(`${prefix}-settings-tab-audio`).click();
    page.$(`${prefix}-music-play`).click();
    await settleUntil(() => a.media.plays === 1 && !a.media.paused);
    assert.equal(a.media.muted, true);
    const hide = () => {
      page.doc.hidden = true;
      page.doc.emit('visibilitychange');
    };
    const show = () => {
      page.doc.hidden = false;
      page.doc.emit('visibilitychange');
      if (mode === 'Versus') page.frame();
    };
    hide();
    assert.equal(a.media.paused, true);
    show();
    await settleUntil(() => a.media.plays === 2 && !a.media.paused);
    page.$(`${prefix}-music-pause`).click();
    hide();
    show();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(a.media.plays, 2);
    assert.equal(a.media.paused, true);
    assert.deepEqual(
      db.allPuts,
      [],
      'Couch loading and transport never rewrite the shared library.',
    );
    assert.equal(saved.getItem('existing-player-profile'), 'unchanged-earned-progress');
    page.win.emit('pagehide', { persisted: false });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(
      a.context.state,
      'closed',
      'Terminal page departure closes the owned audio engine.',
    );
  });

  test(`${mode}: modeled controller owns the nested music library and Back returns to its opener`, async (t) => {
    const saved = storage(),
      a = audio(t),
      db = memoryIndexedDB();
    const pad = {
      index: 0,
      id: 'Music menu controller',
      connected: true,
      mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    };
    const page =
      mode === 'Team'
        ? await teamPage(t, saved, { audio: a, assetDatabase: db.indexedDB, pads: [pad] })
        : await couchPage(t, {
            storage: saved,
            audio: a,
            assetDatabase: db.indexedDB,
            pads: [pad],
          });
    const prefix = mode === 'Team' ? 'coop' : 'race';
    const frame = () => (mode === 'Team' ? page.tick() : page.frame());
    const button = (index) => {
      pad.buttons[index] = { pressed: true, value: 1 };
      frame();
      pad.buttons[index] = { pressed: false, value: 0 };
      frame();
      frame();
    };
    const reach = (id) => {
      for (let n = 0; n < 45 && page.doc.activeElement.id !== id; n++) button(13);
      assert.equal(page.doc.activeElement.id, id);
    };
    await settleUntil(() => page.$(`${prefix}-music-status`)?.dataset.state === 'ready');
    frame();
    frame();
    button(0);
    reach(mode === 'Team' ? 'coop-settings-open' : 'race-options');
    button(0);
    reach(`${prefix}-settings-tab-audio`);
    button(0);
    reach(`${prefix}-music-library`);
    button(0);
    await settleUntil(
      () => page.$('soundtrack-dialog')?.open && !page.$('soundtrack-close').disabled,
    );
    frame();
    assert.equal(page.$('soundtrack-dialog').contains(page.doc.activeElement), true);
    button(1);
    assert.equal(page.$('soundtrack-dialog').open, false);
    assert.equal(page.doc.activeElement.id, `${prefix}-music-library`);
    assert.equal(a.contexts(), 0);
    assert.equal(a.media.plays, 0);
  });
}

test('Versus: Pause music before Start preserves actual cut sound effects without starting music', async (t) => {
  const saved = storage({ muted: false, volume: 0.65 }),
    a = audio(t),
    db = memoryIndexedDB();
  const page = await couchPage(t, { storage: saved, audio: a, assetDatabase: db.indexedDB });
  await settleUntil(() => page.$('race-music-status')?.dataset.state === 'ready');
  enter(page, 'race-options');
  enter(page, 'race-settings-tab-audio');
  enter(page, 'race-music-pause');
  enter(page, 'race-options-back');
  enter(page, 'race-start');
  await settleUntil(() => a.output()?.enabled);
  const run = page.renders[0],
    { spawn, width, height } = run.level;
  const direction =
    spawn.y < 1 ? 'KeyS' : spawn.y > height - 1 ? 'KeyW' : spawn.x < width / 2 ? 'KeyD' : 'KeyA';
  page.key(direction);
  page.frames(40);
  page.key(direction, false);
  assert.equal(a.output().musicTransportPaused, true);
  assert.equal(a.media.plays, 0);
  assert.ok(
    a.sources.length > 0,
    'A real cut through the host produces effects while music is paused.',
  );
  assert.equal(a.output().master.gain.value, 0.65);
  assert.equal(saved.getItem('existing-player-profile'), 'unchanged-earned-progress');
});

test('a failed music assignment replaces pending status with its actionable error', async (t) => {
  const doc = new Document(),
    a = audio(t),
    db = memoryIndexedDB();
  const original = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: db.indexedDB });
  const create = doc.createElement.bind(doc);
  doc.createElement = (tag) => (tag === 'audio' ? a.createElement(doc) : create(tag));
  const host = attachCouchMusicHost({
    document: doc,
    root: doc.body,
    prefix: 'test',
    soundscape: a.soundscape,
  });
  t.after(async () => {
    host.dispose();
    await a.soundscape.dispose();
    if (original) Object.defineProperty(globalThis, 'indexedDB', original);
    else delete globalThis.indexedDB;
  });
  const status = doc.getElementById('test-music-status');
  await settleUntil(() => status.dataset.state === 'ready');
  host.contextPending('fpv');
  assert.match(status.textContent, /Preparing exact mission/);
  const message =
    'Mission music assignment is unavailable until this content identity is resolved.';
  host.report(new Error(message));
  assert.equal(status.textContent, message);
  assert.equal(status.dataset.state, 'error');
  assert.equal(a.media.plays, 0);
  assert.equal(a.contexts(), 0);
});

test('Journey music library keeps keyboard Back, paused boards and chooser ownership', async (t) => {
  const a = audio(t),
    database = managedIndexedDB();
  const p = await couchPage(t, {
    href: 'http://localhost/game/couch/?journey=opening',
    initialLevel: null,
    nativeKeyboard: true,
    audio: a,
    assetDatabase: database.indexedDB,
    storage: memoryStorage(),
    fetchResponse: async (url) => {
      if (String(url).includes('/content-design/assets/')) return new Response(await readFile(url));
    },
  });
  await settleUntil(() => p.$('race-music-status').dataset.state === 'ready');
  const before = p.renders.map(authoritativeCheckpoint);
  const enter = (id) => {
    const target = p.$(id);
    target.focus();
    p.key('Enter', true, target);
    p.key('Enter', false, target);
    p.frame(0);
  };
  enter('race-options');
  enter('race-settings-tab-audio');
  enter('race-music-library');
  await settleUntil(() => p.$('soundtrack-dialog')?.open && !p.$('soundtrack-close').disabled);
  assert.equal(p.doc.activeElement.id, 'soundtrack-close');
  p.key('Escape', true, p.doc.activeElement);
  p.key('Escape', false, p.doc.activeElement);
  assert.equal(p.$('soundtrack-dialog').open, false);
  assert.equal(p.doc.activeElement.id, 'race-music-library');
  enter('race-options-back');
  assert.equal(p.doc.activeElement.id, 'race-options');
  enter('race-journey-find');
  assert.equal(p.$('journey-chooser').open, true);
  p.key('Escape', true, p.doc.activeElement);
  p.key('Escape', false, p.doc.activeElement);
  assert.equal(p.$('journey-chooser').open, false);
  assert.equal(p.doc.activeElement.id, 'race-journey-find');
  assert.deepEqual(p.renders.map(authoritativeCheckpoint), before);
  assert.doesNotMatch(p.$('race-music-status').textContent, /assignment is unavailable/);
  assert.equal(a.media.plays, 0);
  assert.equal(a.contexts(), 0);
});

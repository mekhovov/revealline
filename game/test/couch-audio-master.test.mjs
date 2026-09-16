import {
  installCoopPresentation,
  waitFor as waitForTeamPicture,
} from './helpers/coop-presentation-fixture.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { couchPage, mountCouch } from './helpers/couch-host.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';
import { audioHarness, settleUntil } from './helpers/soundtrack-audio.mjs';
import { Soundscape } from '../ui/audio.mjs';
import { AUDIO_PREFERENCES_KEY } from '../audio-preferences.mjs';
import { FIXED_DT } from '../coop/core.mjs';

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
    if (value === 'Enter' && target.tagName === 'BUTTON') target.click();
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
    createElement() {
      elements++;
      return h.media;
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

async function teamPage(t, store) {
  const doc = new Document(),
    win = new Events();
  doc.parentNode = win;
  mountCouch(doc, teamHTML);
  const $ = (id) => doc.getElementById(id);
  let mediaElements = 0,
    contexts = 0;
  const create = doc.createElement.bind(doc);
  doc.createElement = (tag) => {
    if (tag === 'audio' || tag === 'video') mediaElements++;
    return create(tag);
  };
  $('coop-canvas').width = 1152;
  $('coop-canvas').height = 576;
  $('coop-canvas').getContext = () => new Proxy({}, { get: () => () => {} });
  const frames = new Map(),
    originals = new Map();
  let next = 0,
    now = 0;
  const globals = {
    document: doc,
    window: win,
    localStorage: store,
    navigator: { getGamepads: () => [] },
    location: { href: 'http://localhost/game/couch/relay-rescue.html' },
    matchMedia: () => ({ matches: false }),
    AudioContext: class {
      constructor() {
        contexts++;
        throw new Error('Team has no audio output.');
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
    reaches(page, 'race-audio');
    key(page, 'Enter');
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
    assert.equal(Number(page.$('coop-master-volume').value), 0.66);
    assert.equal(saved.writes.length, before);
    assert.equal(page.$('coop-menu').hidden, false);
    assert.equal(page.contexts(), 0);
    assert.equal(page.mediaElements(), 0);
  });
  await t.test('fresh Versus restores without context creation or playing', async (t) => {
    const before = saved.writes.length,
      a = audio(t);
    const page = await couchPage(t, { storage: saved, audio: a });
    assert.equal(page.$('race-audio').textContent, 'Mute sound');
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
  reaches(page, 'race-audio');
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
  page.$('coop-options').open = true;
  page.$('coop-options-toggle').focus();
  reaches(page, 'coop-audio');
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
  assert.equal(page.mediaElements(), 0);
  assert.equal(saved.getItem('existing-player-profile'), 'unchanged-earned-progress');
});

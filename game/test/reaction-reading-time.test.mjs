import test from 'node:test';
import assert from 'node:assert/strict';
import { attachContextualReactions } from '../ui/contextual-reactions.mjs';
import { createReactionOptions, REACTION_OPTIONS_KEY } from '../journey/reaction-options.mjs';
import { reactionLine } from '../journey/reactions.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { memoryStorage } from './helpers/solo-dom.mjs';
import { pcmWave } from './helpers/pcm-wave.mjs';
import { waitFor } from './helpers/wait-for.mjs';

const legacy = {
  format: 'ReactionPresentationV1',
  sounds: false,
  speech: true,
  subtitles: true,
  volume: 0.4,
  scale: 1.5,
  background: false,
};
let attempt = 0;
function clock(t) {
  let now = 10_000_000 + ++attempt * 1_000_000,
    next = 0;
  const tasks = new Map(),
    callbacks = [];
  t.mock.method(Date, 'now', () => now);
  t.mock.method(globalThis, 'setTimeout', (fn, delay) => {
    const id = ++next;
    tasks.set(id, { fn, at: now + delay });
    callbacks.push(fn);
    return id;
  });
  t.mock.method(globalThis, 'clearTimeout', (id) => tasks.delete(id));
  return {
    callbacks,
    advance(ms) {
      const end = now + ms;
      for (;;) {
        const next = [...tasks].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        now = next[1].at;
        tasks.delete(next[0]);
        next[1].fn();
      }
      now = end;
    },
  };
}
function mounted(
  t,
  { storage = memoryStorage(), document: doc = new Document(), sound, voiceLibrary } = {},
) {
  const time = clock(t),
    previous = getLocale();
  setLocale('en', { persist: false });
  const container = doc.createElement('section'),
    result = doc.createElement('section'),
    settings = doc.createElement('section'),
    voices = [];
  doc.body.append(container, result, settings);
  const host = attachContextualReactions({
    document: doc,
    window: doc.defaultView,
    container,
    resultContainer: result,
    settingsContainer: settings,
    getStorage: () => storage,
    getReduced: () => true,
    sound: sound ?? {
      configureDialogue() {},
      playDialogue: (...args) => voices.push(args),
    },
    voiceLibrary: voiceLibrary ?? {
      originals: [],
      subscribe: () => () => {},
      resolve: async () => null,
      available: async () => [],
    },
  });
  const id = `reading-time-${attempt}`;
  host.reset(id);
  t.after(() => {
    host.dispose();
    setLocale(previous, { persist: false });
  });
  let tick = 0;
  return {
    ...time,
    host,
    doc,
    settings,
    result,
    storage,
    voices,
    panel: container.querySelector('[data-character-reaction]'),
    event(type = 'cells.claimed', context = {}) {
      return host.events([{ type, tick: ++tick }], {
        mode: 'solo',
        attemptId: id,
        ...context,
      });
    },
    choose(value) {
      const control = settings.querySelector('[data-reaction-option="readingTime"]');
      assert.ok(control, 'the existing reaction settings own the reading-time control');
      control.focus();
      control.value = String(value);
      control.emit('change');
      assert.equal(doc.activeElement, control);
      return control;
    },
  };
}

test('legacy reaction choices load without a write and gain Standard timing only on explicit save', () => {
  const raw = JSON.stringify(legacy),
    storage = memoryStorage({ [REACTION_OPTIONS_KEY]: raw }),
    prefs = createReactionOptions({ getStorage: () => storage });
  assert.equal(prefs.snapshot().readingTime, 1);
  for (const [key, value] of Object.entries(legacy))
    if (key !== 'format') assert.equal(prefs.snapshot()[key], value);
  assert.deepEqual(storage.writes, []);
  prefs.choose({ readingTime: 2 });
  assert.equal(prefs.snapshot().durable, true);
  assert.equal(JSON.parse(storage.getItem(REACTION_OPTIONS_KEY)).readingTime, 2);
  for (const [key, value] of Object.entries(legacy))
    if (key !== 'format') assert.equal(prefs.snapshot()[key], value);
  prefs.dispose();
  const restored = createReactionOptions({ getStorage: () => storage });
  assert.equal(restored.snapshot().readingTime, 2);
  assert.equal(storage.writes.length, 1);
  restored.dispose();
});

test('future preference bytes are retained and unavailable timing remains an explicit session choice', () => {
  const raw = JSON.stringify({ ...legacy, format: 'ReactionPresentationV99' }),
    storage = memoryStorage({ [REACTION_OPTIONS_KEY]: raw }),
    prefs = createReactionOptions({ getStorage: () => storage });
  prefs.choose({ readingTime: 2 });
  assert.equal(prefs.snapshot().readingTime, 2);
  assert.equal(prefs.snapshot().durable, false);
  assert.equal(storage.getItem(REACTION_OPTIONS_KEY), raw);
  assert.deepEqual(storage.writes, []);
  prefs.dispose();
});

test('Standard preserves the short-caption deadline; Extended doubles it without replaying audio', (t) => {
  const h = mounted(t);
  h.choose(1);
  assert.ok(h.event());
  h.advance(2999);
  assert.equal(h.panel.hidden, false);
  h.advance(1);
  assert.equal(h.panel.hidden, true);
  h.advance(12000);
  h.choose(2);
  assert.ok(h.event('actor.caught'));
  h.advance(5999);
  assert.equal(h.panel.hidden, false);
  h.advance(1);
  assert.equal(h.panel.hidden, true);
  assert.deepEqual(h.voices, []);
});

test('Extended scales longer text once and retains the existing three-incident budget', (t) => {
  const h = mounted(t);
  const control = h.choose(2),
    help = h.settings.querySelector('[data-reaction-reading-help]');
  assert.equal(control.getAttribute('aria-describedby'), help.id);
  const line = h.event('overflight.evolved', { speaker: 'engineer' });
  assert.equal(line.text.split(/\s+/u).length, 10);
  h.advance(7999);
  assert.equal(h.panel.hidden, false);
  h.advance(1);
  assert.equal(h.panel.hidden, true);
  h.advance(12000);
  assert.ok(h.event('cells.claimed'));
  h.advance(20000);
  assert.ok(h.event('player.respawned'));
  h.advance(20000);
  assert.equal(h.event('actor.caught'), null);
  assert.equal(h.host.diagnostics().incidents, 3);
});

test('a timing change affects new captions, while locale changes give accepted text a full reading interval', (t) => {
  const h = mounted(t);
  h.choose(2);
  const line = h.event();
  assert.ok(line);
  h.advance(5000);
  h.choose(1);
  assert.equal(h.panel.hidden, false);
  setLocale('uk', { persist: false });
  const localized = reactionLine(line.id, 'uk');
  assert.ok(h.panel.textContent.includes(localized.text));
  assert.equal(h.settings.querySelector('[data-reaction-option="readingTime"]').value, '1');
  h.advance(5999);
  assert.equal(h.panel.hidden, false, 'the accepted Extended caption retains its timing policy');
  h.advance(1);
  assert.equal(h.panel.hidden, true);
  h.advance(11999);
  assert.equal(h.event('actor.caught'), null, 'extended text also retains the quiet interval');
  h.advance(1);
  assert.ok(h.event('player.respawned'));
});

test('danger retains readable text; stale expiry, pause, reset and disposal cannot revive captions', (t) => {
  const h = mounted(t);
  h.choose(2);
  assert.ok(h.event());
  const stale = h.callbacks.at(-1);
  h.advance(1000);
  assert.equal(h.event('combat.locked'), null);
  assert.equal(h.panel.hidden, false);
  setLocale('uk', { persist: false });
  stale();
  assert.equal(h.panel.hidden, false, 'a replaced timer cannot hide the current translation');
  h.host.suspend();
  assert.equal(h.panel.hidden, true);
  h.advance(60000);
  h.host.resume();
  assert.equal(h.panel.hidden, true);
  h.host.reset('next');
  assert.ok(
    h.host.events([{ type: 'actor.caught', tick: 1 }], { mode: 'solo', attemptId: 'next' }),
  );
  h.host.dispose();
  for (const callback of h.callbacks) callback();
  assert.equal(h.panel.hidden, true);
  assert.deepEqual(h.voices, []);
});

test('the existing preview demonstrates duration without focus, audio or result-caption expiry', (t) => {
  const h = mounted(t);
  h.choose(2);
  const preview = h.settings.querySelector('[data-reaction-preview]'),
    sample = h.settings.querySelector('[data-reaction-settings-preview]');
  preview.focus();
  preview.click();
  assert.equal(sample.hidden, false);
  h.advance(5999);
  assert.equal(sample.hidden, false);
  h.advance(1);
  assert.equal(sample.hidden, true);
  assert.equal(h.doc.activeElement, preview);
  h.host.result({ owned: true, mode: 'solo', missionId: 'one', outcome: 'won' });
  const text = h.result.textContent;
  assert.ok(text);
  h.advance(60000);
  assert.equal(h.result.textContent, text);
  assert.equal(h.result.hidden, false);
  assert.deepEqual(h.voices, []);
});

test('a failed save keeps the selected duration and focus; peer changes cannot discard pending intent before Retry', (t) => {
  const storage = memoryStorage(),
    write = storage.setItem;
  let silent = true;
  storage.setItem = (...args) => {
    if (!silent) write(...args);
  };
  const h = mounted(t, { storage }),
    control = h.choose(2);
  assert.equal(h.host.options.snapshot().durable, false);
  assert.ok(
    h.settings.querySelectorAll('[role="status"]').some((node) => /session/.test(node.textContent)),
  );
  assert.equal(storage.getItem(REACTION_OPTIONS_KEY), null);
  assert.ok(h.event());
  h.advance(3000);
  assert.equal(h.panel.hidden, false, 'session-only duration is already effective');
  silent = false;
  const peer = createReactionOptions({ getStorage: () => storage, window: h.doc.defaultView });
  peer.choose({ readingTime: 1 });
  assert.equal(h.host.options.snapshot().readingTime, 2);
  assert.equal(control.value, '2');
  h.settings.querySelector('[data-reaction-retry]').click();
  assert.equal(h.host.options.snapshot().durable, true);
  assert.equal(peer.snapshot().readingTime, 2);
  assert.equal(JSON.parse(storage.getItem(REACTION_OPTIONS_KEY)).readingTime, 2);
  assert.equal(h.doc.activeElement, control, 'rendering preserves the current settings control');
  peer.dispose();
});

test('preview locale and cancellation use the selected policy without stale timers or revival on re-enable', (t) => {
  const h = mounted(t),
    preview = h.settings.querySelector('[data-reaction-preview]'),
    sample = h.settings.querySelector('[data-reaction-settings-preview]');
  h.choose(2);
  preview.click();
  const stale = h.callbacks.at(-1);
  h.advance(5000);
  h.choose(1);
  setLocale('uk', { persist: false });
  stale();
  assert.equal(sample.hidden, false);
  assert.match(sample.textContent, /Ще трохи картини відкрито/);
  h.advance(5999);
  assert.equal(sample.hidden, false);
  h.advance(1);
  assert.equal(sample.hidden, true);
  preview.click();
  h.advance(2999);
  assert.equal(sample.hidden, false);
  h.advance(1);
  assert.equal(sample.hidden, true, 'the new preview now uses Standard');
  preview.click();
  h.host.options.choose({ subtitles: false });
  assert.equal(sample.hidden, true);
  assert.equal(preview.disabled, true);
  h.host.options.choose({ subtitles: true });
  assert.equal(sample.hidden, true);
  preview.click();
  h.host.reset('new-attempt');
  assert.equal(sample.hidden, true);
  preview.click();
  h.doc.hidden = true;
  h.doc.emit('visibilitychange');
  assert.equal(sample.hidden, true);
  h.doc.hidden = false;
  h.doc.emit('visibilitychange');
  assert.equal(sample.hidden, true);
  assert.deepEqual(h.voices, []);
});

test('an accepted decoded voice remains the minimum dwell even when its text budget is shorter', async (t) => {
  const doc = new Document(),
    create = doc.createElement.bind(doc),
    priorDocument = globalThis.document,
    id = 'journey-incidental.v1/guide/capture/0',
    bytes = pcmWave({ seconds: 8 }).buffer;
  doc.createElement = (tag) => {
    const node = create(tag);
    if (tag === 'audio') {
      node.duration = 8;
      node.pause = () => {};
      node.load = () => node.emit('loadedmetadata');
    }
    return node;
  };
  globalThis.document = doc;
  t.after(() => {
    globalThis.document = priorDocument;
  });
  let played = 0;
  const h = mounted(t, {
    document: doc,
    sound: {
      context: {
        sampleRate: 8000,
        decodeAudioData: async () => ({ duration: 8, length: 64000, numberOfChannels: 1 }),
      },
      configureDialogue() {},
      playDialogue() {
        played++;
        return { stop() {} };
      },
    },
    voiceLibrary: {
      originals: [],
      subscribe: () => () => {},
      available: async () => [id],
      resolve: async (line) => (line === id ? { bytes, mime: 'audio/wav' } : null),
    },
  });
  h.host.options.choose({ speech: true, readingTime: 2 });
  h.host.prepare();
  await waitFor(() => h.host.diagnostics().cache.buffers === 1);
  assert.equal(h.event().id, id);
  assert.equal(played, 1);
  h.advance(8349);
  assert.equal(h.panel.hidden, false);
  h.advance(1);
  assert.equal(h.panel.hidden, true);
  assert.equal(played, 1);
  h.advance(11999);
  assert.equal(h.event('actor.caught'), null);
  h.advance(1);
  assert.ok(h.event('player.respawned'));
});

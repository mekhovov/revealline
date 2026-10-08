import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createOverflightCommentator } from '../overflight/commentator.mjs';
import { OVERFLIGHT_REACTION_LINES } from '../overflight/reactions.mjs';
import { REACTION_LINES, reactionLine, journeyResultReaction } from '../journey/reactions.mjs';
import { REACTION_VOICE_PILOT } from '../audio/reactions/pilot.mjs';
import { ContextualReactionDirector } from '../ui/contextual-reactions.mjs';
import { REACTION_OPTIONS_KEY } from '../journey/reaction-options.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { memoryStorage } from './helpers/solo-dom.mjs';
import { audioHarness } from './helpers/soundtrack-audio.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { inspectRecordingContainer } from '../journey/reaction-recording-format.mjs';

const run = () => ({
  tick: 0,
  time: 0,
  phase: 'playing',
  events: [],
  player: { hull: 100, maxHull: 100 },
  stats: { kills: 0 },
  compiled: { id: 'overflight/dense' },
  progression: { choices: 0, rerolls: 2 },
});
function fixture() {
  const events = [],
    results = [],
    resets = [],
    cancellations = [];
  const adapter = createOverflightCommentator({
    reactions: {
      prepare() {},
      resume() {},
      suspend: () => cancellations.push('suspend'),
      reset: (id) => resets.push(id),
      events: (value, context) => events.push({ value, context }),
      result: (value) => results.push(value),
    },
  });
  return { adapter, events, results, resets, cancellations };
}
const advance = (state, ticks, events = []) => {
  state.tick += ticks;
  state.time = state.tick / 60;
  state.events = events.map((type) => ({ type }));
};

test('Overflight copy is registered in shared Voice Studio with exact EN/UK text and truthful recording reuse', () => {
  for (const line of OVERFLIGHT_REACTION_LINES) {
    assert.equal(
      REACTION_LINES.find((entry) => entry.id === line.id),
      line,
    );
    for (const locale of ['en', 'uk'])
      assert.equal(reactionLine(line.id, locale).text, line.text[locale]);
    assert.ok(
      !REACTION_VOICE_PILOT.some((entry) => entry.lineId === line.id),
      'new captions do not pretend to have recordings',
    );
  }
  const result = {
    owned: true,
    mode: 'solo',
    presentation: 'overflight',
    missionId: 'dense',
    outcome: 'won',
  };
  assert.equal(journeyResultReaction(result).id, 'journey-reaction.v1/engineer/0');
  assert.ok(
    REACTION_VOICE_PILOT.some((entry) => entry.lineId === journeyResultReaction(result).id),
  );
  assert.equal(
    journeyResultReaction({ ...result, outcome: 'lost' }, 'uk').id,
    'overflight-reaction.v1/lost',
  );
  assert.equal(
    journeyResultReaction({ ...result, outcome: 'lost', presentation: undefined }),
    null,
  );
  assert.equal(journeyResultReaction({ ...result, owned: false }), null);
});

test('accepted milestones are bounded once per run, use same-step danger, and never replay paused facts', () => {
  const f = fixture(),
    state = run();
  f.adapter.reset(state);
  advance(state, 1, ['upgrade']);
  state.progression.choices++;
  f.adapter.update(state);
  f.adapter.update(state);
  assert.deepEqual(
    f.events[0].value.map((entry) => entry.type),
    ['overflight.upgraded'],
  );
  advance(state, 1, ['upgrade']);
  state.progression.choices++;
  f.adapter.update(state);
  assert.equal(f.events.length, 1);
  advance(state, 1, ['evolution', 'warning']);
  f.adapter.update(state);
  assert.equal(f.events.at(-1).context.danger, true);
  advance(state, 1);
  f.adapter.update(state);
  assert.equal(f.events.length, 2, 'danger-consumed evolution is never delayed until safety');
  state.stats.kills += 10;
  advance(state, 1);
  f.adapter.update(state);
  state.stats.kills += 8;
  advance(state, 1);
  f.adapter.update(state);
  assert.equal(f.events.at(-1).value[0].type, 'overflight.cleared');
  state.stats.kills += 100;
  advance(state, 1);
  f.adapter.update(state);
  assert.equal(f.events.length, 3, 'a large mass clear does not produce per-death speech');
  f.adapter.suspend();
  advance(state, 1, ['handoff']);
  f.adapter.update(state);
  f.adapter.resume();
  f.adapter.update(state);
  advance(state, 1);
  f.adapter.update(state);
  assert.equal(f.events.length, 3, 'pause has no stale speech backlog');
  state.phase = 'won';
  advance(state, 1, ['won']);
  f.adapter.update(state);
  f.adapter.update(state);
  assert.equal(f.results.length, 1);
  assert.equal(f.results[0].presentation, 'overflight');
  const next = run();
  f.adapter.reset(next);
  advance(next, 1, ['upgrade']);
  f.adapter.update(next);
  assert.equal(f.events.length, 4);
  assert.notEqual(f.resets[0], f.resets.at(-1));
  next.fixture = 'reference';
  advance(next, 1, ['evolution']);
  f.adapter.update(next);
  assert.equal(f.events.length, 4);
  f.adapter.dispose();
  advance(next, 1, ['upgrade']);
  f.adapter.update(next);
  f.adapter.reset(next);
  assert.equal(f.events.length, 4);
});

test('shared director enforces its existing incident budget and cooldown for Overflight families', () => {
  let now = 5_000_000;
  const presented = [];
  const director = new ContextualReactionDirector({
    now: () => now,
    getLocale: () => 'en',
    present: (line) => presented.push(line),
  });
  const adapter = createOverflightCommentator({
    reactions: {
      reset: (id) => director.reset(id),
      events: (events, context) => director.events(events, context),
      result: (context) => director.result(context),
      suspend: () => director.suspend(),
      resume: () => director.resume(),
    },
  });
  const state = run();
  adapter.reset(state);
  advance(state, 1, ['upgrade']);
  adapter.update(state);
  now += 20_000;
  advance(state, 1, ['evolution']);
  adapter.update(state);
  now += 20_000;
  state.stats.kills += 18;
  advance(state, 1);
  adapter.update(state);
  now += 20_000;
  advance(state, 1, ['handoff']);
  adapter.update(state);
  assert.equal(director.count, 3);
  assert.deepEqual(
    presented.map((line) => line.family),
    ['overflight-upgrade', 'overflight-evolution', 'overflight-clear'],
  );
  state.phase = 'lost';
  advance(state, 1, ['lost']);
  adapter.update(state);
  assert.equal(
    presented.at(-1).id,
    'overflight-reaction.v1/lost',
    'accepted results are separate from incidental budget',
  );
  adapter.dispose();
});

test('visible settings govern the very same shared commentary instance, with no autoplay or late missing voice', async (t) => {
  const doc = new Document(),
    storage = memoryStorage();
  const container = doc.createElement('section'),
    resultContainer = doc.createElement('section'),
    settings = doc.createElement('section');
  doc.body.append(container, resultContainer, settings);
  const configurations = [],
    voices = [];
  const sound = {
    configureDialogue: (value) => configurations.push(value),
    playDialogue: (...args) => voices.push(args),
  };
  const adapter = createOverflightCommentator({
    sound,
    document: doc,
    window: doc.defaultView,
    container,
    resultContainer,
    settingsContainer: settings,
    getStorage: () => storage,
    getLocale: () => 'en',
    getReduced: () => true,
    voiceLibrary: {
      originals: [],
      subscribe: () => () => {},
      resolve: async () => null,
      available: async () => [],
    },
  });
  t.after(() => adapter.dispose());
  const state = run();
  adapter.reset(state);
  adapter.prepare();
  assert.equal(voices.length, 0);
  assert.equal(sound.context, undefined);
  const speech = settings.querySelector('[data-reaction-option="speech"]');
  assert.equal(speech.checked, false, 'reuse the saved/default speech opt-in');
  speech.checked = true;
  speech.emit('change');
  assert.equal(adapter.options.snapshot().speech, true);
  assert.equal(configurations.at(-1).enabled, true);
  assert.equal(JSON.parse(storage.getItem(REACTION_OPTIONS_KEY)).speech, true);
  const volume = settings.querySelector('[data-reaction-option="volume"]');
  volume.value = '0.4';
  volume.emit('change');
  assert.equal(configurations.at(-1).volume, 0.4);
  state.phase = 'won';
  advance(state, 1, ['won']);
  adapter.update(state);
  assert.match(resultContainer.textContent, /A fine route through a complicated place/);
  assert.equal(resultContainer.hidden, false);
  assert.equal(voices.length, 0, 'a missing decoded recording stays caption-only');
  const subtitles = settings.querySelector('[data-reaction-option="subtitles"]');
  subtitles.checked = false;
  subtitles.emit('change');
  assert.equal(resultContainer.hidden, true);
  subtitles.checked = true;
  subtitles.emit('change');
  assert.equal(resultContainer.hidden, false);
  const enabled = settings.querySelector('[data-overflight-commentator-enabled]');
  enabled.checked = false;
  enabled.emit('change');
  assert.equal(adapter.preferences.snapshot().enabled, false);
  assert.equal(configurations.at(-1).enabled, false);
  assert.equal(resultContainer.hidden, true);
  enabled.checked = true;
  enabled.emit('change');
  assert.equal(resultContainer.hidden, false);
  adapter.suspend();
  adapter.resume();
  adapter.update(state);
  await Promise.resolve();
  assert.equal(voices.length, 0, 'resume or asset readiness never replays an expired result voice');
});

test('a ready result recording uses the shared paused-result dialogue path and releases its music duck on hide', async (t) => {
  const doc = new Document(),
    memory = memoryStorage(),
    previousDocument = globalThis.document;
  const later = Date.now() + 600000;
  t.mock.method(Date, 'now', () => later);
  globalThis.document = doc;
  t.after(() => {
    globalThis.document = previousDocument;
  });
  // A small existing PCM asset is a decoder-boundary fixture, not a replacement
  // voice recording. Catalogue tests above verify the actual Engineer voice ID.
  const source = await readFile(new URL('../audio/effects/confirm.wav', import.meta.url));
  const bytes = source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
  const metadata = inspectRecordingContainer(bytes);
  const create = doc.createElement.bind(doc);
  doc.createElement = (tag) => {
    const element = create(tag);
    if (tag === 'audio') {
      element.duration = metadata.maxDecodedSeconds;
      element.pause = () => {};
      element.load = () => element.emit('loadedmetadata');
    }
    return element;
  };
  const h = audioHarness(),
    sound = h.soundscape;
  const buffer = {
    duration: metadata.maxDecodedSeconds,
    numberOfChannels: metadata.channels,
    length: Math.ceil(metadata.maxDecodedSeconds * h.context.sampleRate),
  };
  h.context.decodeAudioData = async () => buffer;
  await sound.enable();
  const container = doc.createElement('section'),
    resultContainer = doc.createElement('section');
  doc.body.append(container, resultContainer);
  let ducks = 0,
    releases = 0;
  const id = 'journey-reaction.v1/engineer/0';
  const adapter = createOverflightCommentator({
    sound,
    document: doc,
    window: doc.defaultView,
    container,
    resultContainer,
    getStorage: () => memory,
    getLocale: () => 'en',
    getReduced: () => true,
    acquireGain: () => {
      ducks++;
      return () => releases++;
    },
    voiceLibrary: {
      originals: [{ lineId: id, locale: 'en' }],
      subscribe: () => () => {},
      available: async () => [id],
      resolve: async () => ({ bytes, mime: 'audio/wav' }),
    },
  });
  t.after(() => {
    adapter.dispose();
    sound.dispose();
  });
  adapter.options.choose({ speech: true });
  adapter.prepare();
  await waitFor(() => adapter.diagnostics().cache.buffers === 1);
  const state = run();
  adapter.reset(state);
  sound.pause();
  state.phase = 'won';
  advance(state, 1, ['won']);
  adapter.update(state);
  assert.equal(adapter.diagnostics().speaking, true);
  assert.equal(ducks, 1);
  assert.ok([...sound.voices].some((voice) => voice.dialogue));
  doc.hidden = true;
  doc.emit('visibilitychange');
  sound.suspend();
  assert.equal(adapter.diagnostics().speaking, false);
  assert.equal(releases, 1);
  doc.hidden = false;
  doc.emit('visibilitychange');
  await sound.resume();
  adapter.update(state);
  assert.equal(
    adapter.diagnostics().speaking,
    false,
    'visibility return never replays terminal speech',
  );
  assert.equal(ducks, 1);
});

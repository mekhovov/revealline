import assert from 'node:assert/strict';
import test from 'node:test';
import { attachCouchMusicHost } from '../couch/couch-music-host.mjs';
import { BUILTIN_SOUNDTRACK_TRACKS } from '../soundtrack.mjs';
import { createAudioMaster } from '../ui/audio-master.mjs';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { prepareSoundtrackLibrary } from '../soundtrack-bundle.mjs';
import { Document, Element } from './helpers/couch-dom.mjs';
import { audioHarness, settleUntil } from './helpers/soundtrack-audio.mjs';
import { fixture, structuralProbe, memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';

const recording = await fixture('menu-gesture');
async function setup(
  t,
  { prefix = 'coop', muted = false, volume = 0.65, ready = true, twoTracks = false } = {},
) {
  const doc = new Document(),
    audio = audioHarness(),
    memory = memoryIndexedDB(),
    master = createAudioMaster({ muted, volume });
  const manager = createManagedMediaStore({
    indexedDB: memory.indexedDB,
    soundtrackCatalogue: true,
  });
  const library = {
    ...recording.library,
    playlists: [
      {
        id: 'menu.test',
        title: 'Menu recording',
        trackIds: [recording.track.id, ...(twoTracks ? [BUILTIN_SOUNDTRACK_TRACKS[0].id] : [])],
        order: 'ordered',
        repeat: 'all',
      },
    ],
    selection: { playlistId: 'menu.test' },
  };
  await manager.commitDomain(
    'audio',
    await prepareSoundtrackLibrary(library, recording.assets, { probeMedia: structuralProbe }),
    { expectedGeneration: 0 },
  );
  manager.close();
  const original = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: memory.indexedDB });
  const create = doc.createElement.bind(doc);
  let decks = 0;
  doc.createElement = (tag) => {
    if (tag !== 'audio') return create(tag);
    const media = decks++ === 0 ? audio.media : audioHarness().media,
      element = new Element(doc, 'audio');
    for (const [key, value] of Object.entries(element))
      if (!Object.hasOwn(media, key)) media[key] = value;
    Object.setPrototypeOf(media, Object.getPrototypeOf(element));
    return media;
  };
  const pause = doc.createElement('button');
  pause.id = `${prefix}-pause`;
  pause.textContent = 'Pause';
  const start = doc.createElement('button'),
    resume = doc.createElement('button');
  start.id = `${prefix}-start`;
  resume.id = `${prefix}-resume`;
  doc.body.append(start, resume, pause);
  const host = attachCouchMusicHost({
    document: doc,
    root: doc.body,
    prefix,
    quickAfter: [`${prefix}-start`, `${prefix}-resume`],
    soundscape: audio.soundscape,
    audioMaster: master,
  });
  t.after(async () => {
    host.dispose();
    await audio.soundscape.dispose();
    master.dispose();
    if (original) Object.defineProperty(globalThis, 'indexedDB', original);
    else delete globalThis.indexedDB;
  });
  const waitReady = () => settleUntil(() => host.session.snapshot().readyForStart);
  if (ready) await waitReady();
  return {
    doc,
    audio,
    memory,
    master,
    host,
    waitReady,
    gesture: (type = 'pointerdown', extra = {}) =>
      doc.body.emit(type, { isTrusted: true, ...extra }),
  };
}

for (const prefix of ['race', 'coop'])
  test(`${prefix}: first trusted menu gesture plays remembered unmuted music without rewriting master or storage`, async (t) => {
    const f = await setup(t, { prefix }),
      before = f.master.snapshot(),
      writes = f.memory.allPuts.length;
    assert.equal(f.audio.media.plays, 0);
    f.doc.body.emit('pointerdown');
    f.gesture('keydown', { key: 'Escape' });
    assert.equal(f.audio.media.plays, 0);
    f.gesture('keydown', { key: 'Enter' });
    assert.equal(
      f.audio.media.plays,
      1,
      'The media play request stays inside the activation task.',
    );
    await settleUntil(() => f.host.player.snapshot().playing);
    f.gesture();
    f.gesture('click');
    assert.equal(f.audio.media.plays, 1);
    assert.deepEqual(f.master.snapshot(), before);
    assert.equal(f.memory.allPuts.length, writes);
  });

test('menu activation respects mute, zero volume, hidden pages, music controls and intentional Pause', async (t) => {
  const f = await setup(t, { muted: true });
  f.gesture();
  assert.equal(f.audio.media.plays, 0);
  f.master.setMuted(false);
  f.master.setVolume(0);
  f.gesture();
  assert.equal(f.audio.media.plays, 0);
  f.master.setVolume(0.65);
  f.doc.hidden = true;
  f.gesture();
  assert.equal(f.audio.media.plays, 0);
  f.doc.hidden = false;
  f.doc.getElementById('coop-music-pause').emit('pointerdown', { isTrusted: true });
  assert.equal(f.audio.media.plays, 0);
  f.host.session.pause();
  f.gesture();
  f.gesture('click');
  assert.equal(f.audio.media.plays, 0);
  assert.equal(f.host.session.snapshot().transportChoice, 'pause');
  assert.equal(await f.host.session.start(), false);
  assert.equal(await f.host.session.play(), true);
});

test('denied menu permission retries only on another trusted gesture and cannot change master intent', async (t) => {
  const f = await setup(t),
    before = f.master.snapshot();
  f.audio.media.rejectPlay = new DOMException('Gesture refused', 'NotAllowedError');
  f.gesture();
  await settleUntil(() => f.host.session.snapshot().needsPlayGesture);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.audio.media.plays, 1);
  assert.equal(f.host.player.snapshot().playing, false);
  assert.deepEqual(f.master.snapshot(), before);
  f.audio.media.rejectPlay = null;
  f.doc.body.emit('click');
  assert.equal(f.audio.media.plays, 1);
  f.gesture();
  await settleUntil(() => f.host.player.snapshot().playing);
  assert.equal(f.audio.media.plays, 2);
  assert.deepEqual(f.master.snapshot(), before);
});

test('gesture during library loading schedules no late autoplay; disposal removes menu activation', async (t) => {
  const f = await setup(t, { ready: false });
  assert.equal(f.host.session.snapshot().readyForStart, false);
  f.gesture();
  await f.waitReady();
  assert.equal(f.audio.media.plays, 0);
  f.host.dispose();
  assert.equal(f.doc.captureListeners.get('pointerdown')?.size ?? 0, 0);
  assert.equal(f.doc.captureListeners.get('keydown')?.size ?? 0, 0);
  assert.equal(f.doc.listeners.get('click')?.size ?? 0, 0);
  f.gesture();
  assert.equal(f.audio.media.plays, 0);
});

for (const prefix of ['race', 'coop'])
  test(`${prefix}: compact caption and Audio credits follow actual playback without changing transport intent`, async (t) => {
    const f = await setup(t, { prefix });
    const pause = f.doc.getElementById(`${prefix}-pause`),
      details = f.doc.getElementById(`${prefix}-music-details`);
    pause.focus();
    f.gesture('keydown', { key: 'Enter' });
    await settleUntil(() => f.host.player.snapshot().playing);
    assert.equal(pause.getAttribute('data-track-caption'), `♪ ${recording.track.title}`);
    assert.match(details.textContent, /RevealLine tests/);
    assert.match(details.textContent, /File:/);
    const plays = f.audio.media.plays,
      state = f.host.session.snapshot().transportChoice;
    f.master.setMuted(true);
    assert.equal(pause.getAttribute('data-track-caption'), `Muted: ${recording.track.title}`);
    assert.equal(f.host.session.snapshot().transportChoice, state);
    assert.equal(f.audio.media.plays, plays);
    assert.equal(f.doc.activeElement, pause);
    f.master.setMuted(false);
    await f.doc.getElementById(`${prefix}-music-pause`).onclick();
    assert.equal(pause.getAttribute('data-track-caption'), `Paused: ${recording.track.title}`);
    assert.equal(f.doc.activeElement, pause);
  });

for (const prefix of ['race', 'coop']) {
  test(`${prefix}: quick buttons and B/N preserve music-only Pause through session Start and focus`, async (t) => {
    const f = await setup(t, { prefix, twoTracks: true });
    const toggle = f.doc.getElementById(`${prefix}-quick-music-0-toggle`);
    const pausedToggle = f.doc.getElementById(`${prefix}-quick-music-1-toggle`);
    const master = f.master.snapshot(),
      writes = f.memory.allPuts.length;
    const resume = f.doc.getElementById(`${prefix}-resume`);
    resume.focus();
    assert(f.host.contains(toggle), 'Versus controller acceptance includes the quick row');
    toggle.emit('pointerdown', { isTrusted: true });
    assert.equal(f.audio.media.plays, 0, 'Pointer capture must not autoplay before the control');
    toggle.click();
    assert.equal(f.audio.media.plays, 1, 'Direct activation reaches media before awaiting');
    await settleUntil(() => f.host.player.snapshot().playing);
    pausedToggle.click();
    assert.equal(f.host.session.snapshot().transportChoice, 'pause');
    assert.equal(await f.host.session.start(), false);
    const plays = f.audio.media.plays;
    f.doc.body.emit('keydown', { code: 'KeyN', key: 'n' });
    await settleUntil(() => f.host.player.snapshot().track?.id === BUILTIN_SOUNDTRACK_TRACKS[0].id);
    assert.equal(f.host.player.snapshot().desired, false);
    assert.equal(f.host.player.snapshot().playing, false);
    assert.equal(f.audio.media.plays, plays);
    f.host.suspend();
    await f.host.resume();
    assert.equal(f.host.player.snapshot().desired, false);
    assert.equal(f.doc.activeElement, resume);
    assert.deepEqual(f.master.snapshot(), master);
    assert.equal(f.memory.allPuts.length, writes);
    f.doc.body.emit('keydown', { code: 'KeyB', key: 'b' });
    await settleUntil(() => f.host.player.snapshot().playing);
    assert.equal(f.host.session.snapshot().transportChoice, 'play');
  });
}

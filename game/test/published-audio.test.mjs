import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as tick } from 'node:timers/promises';
import { createPresentationHost } from '../presentation/host.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { hashPresentationBytes } from '../presentation/bundle.mjs';
import { compilePresentation } from '../../scripts/compile-presentation.mjs';
import { createSoundtrackPlayer } from '../ui/soundtrack-player.mjs';
import { attachPublishedAudio, createPublishedCues } from '../ui/published-audio.mjs';
import { emptySoundtrackLibrary, BUILTIN_SOUNDTRACK_TRACKS } from '../soundtrack.mjs';
import { audioHarness, settleUntil } from './helpers/soundtrack-audio.mjs';
import { pcmWave, pcmWaveBlob } from './helpers/pcm-wave.mjs';
import { Events } from './helpers/couch-dom.mjs';
const audioDocument = () => Object.assign(new Events(), { getElementById: () => null });
import {
  validateCampaignFeedback,
  CAMPAIGN_FEEDBACK_FORMAT,
} from '../journey/campaign-feedback.mjs';

const bytes = pcmWave();
const blob = new Blob([bytes], { type: 'audio/wav' });
const hash = await hashPresentationBytes(bytes);
const published = (readBlob = async () => blob, allowed = () => true) => ({
  id: `published.${hash}`,
  title: 'Published FPV music',
  readBlob,
  allowed,
});
function playerFixture() {
  const h = audioHarness();
  const player = createSoundtrackPlayer({
    soundscape: h.soundscape,
    audioElement: h.media,
    URLImpl: h.URLImpl,
    readAsset: async () => {
      throw new Error('No database reads permitted.');
    },
    fadeMs: 0,
  });
  return { ...h, player };
}

function cueReadTimers(t) {
  const timers = new Set(),
    start = globalThis.setTimeout,
    clear = globalThis.clearTimeout;
  t.mock.method(globalThis, 'setTimeout', (callback, ms, ...args) => {
    if (ms !== 10000) return start(callback, ms, ...args);
    const timer = { callback: () => callback(...args) };
    timers.add(timer);
    return timer;
  });
  t.mock.method(globalThis, 'clearTimeout', (timer) => {
    if (!timers.delete(timer)) clear(timer);
  });
  return {
    size: () => timers.size,
    expire() {
      assert.ok(timers.size, 'An admitted optional read has a deadline.');
      for (const timer of [...timers]) {
        timers.delete(timer);
        timer.callback();
      }
    },
  };
}

test('published cue read deadlines abort real host fetches and release required music admission', async (t) => {
  const timers = cueReadTimers(t),
    h = playerFixture(),
    compiled = await compilePresentation(createDefaultThemeBundle(), new Map()),
    manifest = JSON.parse(new TextDecoder().decode(compiled.files.get('runtime.json'))),
    reads = [];
  for (const name of ['focus', 'confirm']) {
    const asset = manifest.resolved.assets[`audio.${name}`];
    Object.assign(asset, {
      id: `published.test.${name}`,
      kind: 'audio',
      recipe: null,
      file: { sha256: hash, bytes: bytes.length, mime: 'audio/wav', width: null, height: null },
    });
    manifest.resolved.bindings[`audio.${name}`] = { id: asset.id, revision: 1 };
  }
  manifest.urls[hash] = `./assets/${hash}.wav`;
  const host = createPresentationHost({
    baseURL: 'https://game.test/compiled/',
    fetch: async (url, { signal }) => {
      if (url.endsWith('runtime.json')) return new Response(JSON.stringify(manifest));
      reads.push(signal);
      return new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    },
  });
  const cues = createPublishedCues({ sound: h.soundscape, readAudio: host.readAudio });
  t.after(async () => {
    cues.close();
    host.close();
    h.player.dispose();
    await h.soundscape.dispose();
  });
  await host.load();
  await h.soundscape.enable();
  h.context.decodeAudioData = () => assert.fail('Stalled originals never reach PCM decoding.');
  cues.play('focus', { ui: true });
  cues.play('confirm', { ui: true });
  await tick();
  assert.equal(reads.length, 2);
  let musicReads = 0;
  h.player.setPublishedTrack(
    published(async () => {
      musicReads++;
      return blob;
    }),
  );
  const playing = h.player.play();
  await tick();
  assert.equal(musicReads, 0);
  assert.equal(h.soundscape.mediaPreparation.snapshot().active.fetch, 2);
  assert.equal(h.soundscape.mediaPreparation.snapshot().queued, 1);
  timers.expire();
  assert(reads.every((signal) => signal.aborted));
  assert.equal(await playing, true);
  assert.equal(musicReads, 1);
  await tick();
  assert.equal(cues.resourceSnapshot().loading, 0);
  assert.equal(timers.size(), 0);
  for (let i = 0; i < 20; i++) {
    assert.equal(cues.play('focus', { ui: true }), false);
    await cues.prepare(['focus', 'confirm']);
  }
  assert.equal(reads.length, 2, 'Timed-out optional cues retain their procedural fallback.');
});

test('cue timeout discards late bytes but retains a noncooperative fetch until actual settlement', async (t) => {
  const timers = cueReadTimers(t),
    h = audioHarness(),
    reads = [];
  await h.soundscape.enable();
  h.context.decodeAudioData = () => assert.fail('Timed-out bytes cannot decode.');
  const cues = createPublishedCues({
    sound: h.soundscape,
    readAudio: (name, { signal }) =>
      new Promise((resolve) => reads.push({ name, signal, resolve })),
  });
  t.after(async () => {
    cues.close();
    reads.forEach((read) => read.resolve({ blob }));
    await h.soundscape.dispose();
  });
  cues.play('focus', { ui: true });
  cues.play('confirm', { ui: true });
  await tick();
  let requiredStarted = false;
  const required = h.soundscape.mediaPreparation.run(
    'fetch',
    () => {
      requiredStarted = true;
    },
    { priority: 'required' },
  );
  timers.expire();
  await tick();
  assert.equal(requiredStarted, false);
  assert.equal(h.soundscape.mediaPreparation.snapshot().active.fetch, 2);
  assert.equal(cues.resourceSnapshot().loading, 2, 'Actual reads still have physical ownership.');
  await cues.prepare(['focus', 'confirm']);
  assert.equal(reads.length, 2, 'Unavailable sentinels do not join or restart expired reads.');
  reads[0].resolve({ blob });
  await required;
  reads[1].resolve({ blob });
  await tick();
  assert.equal(cues.resourceSnapshot().loading, 0);
  assert.equal(h.soundscape.mediaPreparation.snapshot().active.fetch, 0);
  assert.equal(cues.has('focus'), false);
  assert.equal(cues.has('confirm'), false);
});

test('cue read deadline starts after admission and cancellation cannot delete a newer same-name load', async (t) => {
  const timers = cueReadTimers(t),
    h = audioHarness(),
    blockers = [],
    reads = [];
  await h.soundscape.enable();
  h.context.decodeAudioData = async () => ({ duration: 0.1, length: 800, numberOfChannels: 1 });
  const held = [0, 1].map(() =>
    h.soundscape.mediaPreparation.run(
      'fetch',
      () => new Promise((resolve) => blockers.push(resolve)),
    ),
  );
  await tick();
  const cues = createPublishedCues({
    sound: h.soundscape,
    readAudio: (name, { signal }) =>
      new Promise((resolve) => reads.push({ name, signal, resolve })),
  });
  t.after(async () => {
    cues.close();
    blockers.forEach((done) => done());
    reads.forEach((read) => read.resolve({ blob }));
    await h.soundscape.dispose();
  });
  const old = cues.prepare(['focus']);
  await tick();
  assert.equal(reads.length, 0);
  assert.equal(timers.size(), 0, 'Queue wait consumes no network-read deadline.');
  blockers.forEach((done) => done());
  await Promise.all(held);
  await tick();
  assert.equal(reads.length, 1);
  assert.equal(timers.size(), 1);
  cues.cancelPending();
  assert.equal(timers.size(), 0, 'Owner cancellation clears its deadline immediately.');
  const current = cues.prepare(['focus']);
  await tick();
  assert.equal(reads.length, 2);
  reads[0].resolve({ blob });
  await old;
  assert.equal(cues.resourceSnapshot().loading, 1);
  assert.equal(timers.size(), 1, 'Old completion cannot clear the replacement timer.');
  reads[1].resolve({ blob });
  await current;
  assert.equal(cues.has('focus'), true);
  assert.equal(cues.resourceSnapshot().loading, 0);
  assert.equal(timers.size(), 0);
});

test('a completed cue read has no decode deadline and abandoned PCM retains its reservation', async (t) => {
  const timers = cueReadTimers(t),
    h = audioHarness();
  await h.soundscape.enable();
  let finish;
  h.context.decodeAudioData = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  const cues = createPublishedCues({ sound: h.soundscape, readAudio: async () => ({ blob }) });
  t.after(async () => {
    cues.close();
    finish?.({ duration: 0.1, length: 800, numberOfChannels: 1 });
    await h.soundscape.dispose();
  });
  const pending = cues.prepare(['focus']);
  await tick();
  assert.equal(typeof finish, 'function');
  assert.equal(timers.size(), 0);
  const reserved = h.soundscape.mediaPreparation.snapshot().reservedDecodeBytes;
  assert(reserved > 0);
  cues.close();
  let nextStarted = false;
  const next = h.soundscape.mediaPreparation.run(
    'decode',
    () => {
      nextStarted = true;
    },
    { bytes: 4 },
  );
  await tick();
  assert.equal(nextStarted, false);
  assert.equal(h.soundscape.mediaPreparation.snapshot().reservedDecodeBytes, reserved);
  finish({ duration: 0.1, length: 800, numberOfChannels: 1 });
  await Promise.all([pending, next]);
  await tick();
  assert.equal(cues.resourceSnapshot().decodedBytes, 0);
  assert.equal(h.soundscape.mediaPreparation.snapshot().reservedDecodeBytes, 0);
});

test('published theme music is lazy and wins over automatic FPV recipes without overriding manual assignments', async () => {
  const h = playerFixture();
  let reads = 0;
  h.player.setAuthoredTrack(BUILTIN_SOUNDTRACK_TRACKS[0].recipe);
  h.player.setPublishedTrack(
    published(async () => {
      reads++;
      return blob;
    }),
  );
  assert.equal(h.player.snapshot().source, 'published');
  assert.equal(h.soundscape.context, null);
  assert.equal(h.media.plays, 0);
  assert.equal(reads, 0);
  await h.player.play();
  assert.equal(reads, 1);
  assert.equal(h.player.snapshot().track.kind, 'published');
  h.media.duration = 42;
  h.media.readyState = 1;
  h.player.seek(17);
  assert.equal(h.player.snapshot().positionSeconds, 17);
  h.player.pause();
  assert.equal(h.media.paused, true);
  await h.player.selectPlaylist('builtin.all');
  assert.equal(h.player.snapshot().source, 'explicit');
  assert.equal(h.player.snapshot().track.kind, 'synth');
  assert.equal(h.revoked.length, 1);
  h.player.dispose();

  for (const scope of ['map', 'campaign', 'theme', 'global']) {
    const f = playerFixture(),
      library = structuredClone(emptySoundtrackLibrary());
    library.assignments.push({
      scope,
      key: scope === 'global' ? null : 'selected',
      playlistId: 'builtin.all',
    });
    f.player.setLibrary(library);
    f.player.setContext({ mapKey: 'selected', campaignKey: 'selected', themeId: 'selected' });
    f.player.setPublishedTrack(published());
    assert.equal(f.player.snapshot().source, scope);
    assert.equal(f.media.plays, 0);
    f.player.dispose();
  }
  const f = playerFixture();
  f.player.setAuthoredTrack(BUILTIN_SOUNDTRACK_TRACKS[0].recipe);
  f.player.setPublishedTrack(published(undefined, () => false));
  assert.equal(
    f.player.snapshot().source,
    'authored',
    'An explicit scenario keeps its soundtrack contract.',
  );
  f.player.dispose();
});

test('Pause and disposal reject a late published download without URLs or media playback', async () => {
  for (const action of ['pause', 'dispose']) {
    const h = playerFixture();
    let finish, signal;
    h.player.setPublishedTrack(
      published((options) => {
        signal = options.signal;
        return new Promise((resolve) => {
          finish = resolve;
        });
      }),
    );
    const playing = h.player.play();
    await settleUntil(() => !!finish);
    h.player[action]();
    assert.equal(signal.aborted, true);
    finish(blob);
    assert.equal(await playing, false);
    assert.equal(h.created.length, 0);
    assert.equal(h.media.plays, 0);
    assert.equal(h.soundscape.context, null);
    h.player.dispose();
  }
});

test('published cue loading never enables audio, replays a stale cue, or survives a muted decode', async () => {
  const h = audioHarness();
  let reads = 0,
    decodes = 0,
    finish;
  h.context.decodeAudioData = () => {
    decodes++;
    return new Promise((resolve) => {
      finish = resolve;
    });
  };
  h.soundscape.setPublishedAudio(async () => {
    reads++;
    return { blob };
  });
  h.soundscape.publishedCue('confirm');
  assert.equal(reads, 0);
  assert.equal(h.soundscape.context, null);
  await h.soundscape.enable();
  h.soundscape.publishedCue('confirm');
  await settleUntil(() => decodes === 1);
  const before = h.sources.length;
  finish({ duration: 0.1, length: 800, numberOfChannels: 1 });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(h.sources.length, before, 'Decode completion cannot replay the original event.');
  assert.equal(h.soundscape.publishedCue('confirm'), true);
  assert.equal(h.sources.length, before + 1);
  h.context.currentTime = 1;
  h.soundscape.publishedCue('focus');
  await settleUntil(() => decodes === 2);
  h.soundscape.disable();
  finish({ duration: 0.1, length: 800, numberOfChannels: 1 });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(h.soundscape.voices.size, 0);
  assert.equal(h.soundscape.publishedCue('focus'), false);
  await h.soundscape.dispose();
});

test('published victory owns an authored campaign win; only an unavailable cue uses its motif and existing gates still win', async (t) => {
  const h = audioHarness(),
    defaultCue = audioHarness(),
    context = {
      owned: true,
      mode: 'solo',
      outcome: 'won',
      missionId: 'fixture-mission',
      feedback: validateCampaignFeedback({
        format: CAMPAIGN_FEEDBACK_FORMAT,
        revision: 'r1',
        lines: { en: ['Fixture connection.'], uk: ['Навчальне з’єднання.'] },
        victoryMotif: 'shared-spark-v1',
      }),
    };
  t.after(async () => {
    await h.soundscape.dispose();
    await defaultCue.soundscape.dispose();
  });
  let finishDecode,
    reads = 0;
  const decoded = { duration: 0.1, length: 800, numberOfChannels: 1 };
  h.context.decodeAudioData = () => new Promise((resolve) => (finishDecode = resolve));
  h.soundscape.setPublishedAudio(async (slot) => {
    assert.equal(slot, 'audio.victory');
    reads++;
    return { blob };
  });
  const win = (tick) => ({ type: 'run.completed', won: true, tick, levelId: 'fixture-level' });
  h.soundscape.event(win(1), {}, context);
  assert.equal(reads, 0);
  assert.equal(h.soundscape.context, null, 'A result never unlocks audio.');
  await h.soundscape.enable();
  await defaultCue.soundscape.enable();
  h.soundscape.event(win(2), {}, context);
  defaultCue.soundscape.event(win(2));
  assert(h.sources.length > 0);
  assert.equal(h.sources.length, defaultCue.sources.length);
  assert.notDeepEqual(
    h.sources.map((source) => source.frequency.value),
    defaultCue.sources.map((source) => source.frequency.value),
    'An unavailable published cue falls back to the accepted authored melody.',
  );
  await settleUntil(() => !!finishDecode);
  const fallbackCount = h.sources.length;
  finishDecode(decoded);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(h.sources.length, fallbackCount, 'Late decoding never replays the prior result.');
  h.context.currentTime = 1;
  h.soundscape.event(win(3), {}, context);
  assert.equal(h.sources.length, fallbackCount + 1);
  assert.equal(h.sources.at(-1).buffer, decoded, 'Only the exact published buffer is scheduled.');
  h.soundscape.event(win(3), {}, context);
  assert.equal(h.sources.length, fallbackCount + 1, 'One accepted result remains one cue.');
  for (const [index, setting] of ['master', 'sfx'].entries()) {
    h.soundscape.configure({ [setting]: 0 });
    h.soundscape.event(win(10 + index), {}, context);
    assert.equal(
      h.sources.length,
      fallbackCount + 1,
      `${setting} gates both published and synth audio.`,
    );
    h.soundscape.configure({ [setting]: 0.5 });
  }
  h.soundscape.pause();
  h.soundscape.event(win(4), {}, context);
  assert.equal(h.sources.length, fallbackCount + 1);
  await h.soundscape.resume();
  h.soundscape.disable();
  h.soundscape.event(win(5), {}, context);
  assert.equal(h.sources.length, fallbackCount + 1);
  assert.equal(reads, 1, 'Gated or repeated results do not request another original.');
});

test('page cue listeners use native actions only and cleanup leaves no active audio adapter', async () => {
  const h = audioHarness(),
    document = audioDocument();
  const calls = [];
  h.soundscape.publishedCue = (name) => calls.push(name);
  const owner = attachPublishedAudio({
    sound: h.soundscape,
    document,
    ready: Promise.resolve(null),
    getHost: () => null,
  });
  await owner.ready;
  const control = {
    disabled: false,
    getAttribute: () => null,
    matches: () => false,
    closest() {
      return this;
    },
  };
  document.emit('focusin', { target: control });
  assert.deepEqual(calls, [], 'programmatic focus is quiet');
  document.emit('keydown', { key: 'Tab' });
  document.emit('focusin', { target: control });
  document.emit('click', { target: control });
  control.matches = () => true;
  document.emit('click', { target: control });
  assert.deepEqual(calls, ['focus', 'confirm', 'cancel']);
  assert.equal(h.soundscape.context, null);
  owner.close();
  document.emit('click', { target: control });
  assert.equal(calls.length, 3);
  assert.equal(h.soundscape.publishedAudio, null);
});

test('release audio is fetched only on demand and rejects bad bytes and cancellation', async () => {
  const compiled = await compilePresentation(createDefaultThemeBundle(), new Map());
  const manifest = JSON.parse(new TextDecoder().decode(compiled.files.get('runtime.json')));
  const asset = manifest.resolved.assets['audio.music'];
  Object.assign(asset, {
    id: 'published.test.audio',
    kind: 'audio',
    recipe: null,
    file: { sha256: hash, bytes: bytes.length, mime: 'audio/wav', width: null, height: null },
  });
  manifest.resolved.bindings['audio.music'] = { id: asset.id, revision: 1 };
  manifest.urls[hash] = `./assets/${hash}.wav`;
  let requests = 0,
    corrupt = false,
    blocked = false,
    finish,
    signal;
  const host = createPresentationHost({
    baseURL: 'https://game.test/compiled/',
    fetch: async (url, options) => {
      requests++;
      if (url.endsWith('runtime.json')) return new Response(JSON.stringify(manifest));
      signal = options.signal;
      if (blocked)
        return new Promise((resolve) => {
          finish = resolve;
        });
      const body = bytes.slice();
      if (corrupt) body[0] ^= 1;
      return new Response(body);
    },
  });
  await host.load();
  assert.equal(requests, 1);
  assert.deepEqual(
    new Uint8Array(await (await host.readAudio('audio.music')).blob.arrayBuffer()),
    bytes,
  );
  corrupt = true;
  await host.load();
  await assert.rejects(host.readAudio('audio.music'), /hash mismatch/);
  blocked = true;
  const late = host.readAudio('audio.music');
  await settleUntil(() => !!finish);
  host.close();
  assert.equal(signal.aborted, true);
  finish(new Response(bytes));
  await assert.rejects(late, { name: 'AbortError' });
});

test('music-only Team binding leaves cue ownership untouched while retaining verified music', async () => {
  const document = audioDocument(),
    calls = [],
    tracks = [];
  const snapshot = {
    resolved: {
      assets: {
        'audio.music': { kind: 'audio', file: { sha256: hash }, description: 'Team soundtrack' },
      },
    },
  };
  const owner = attachPublishedAudio({
    sound: {
      setPublishedAudio: (value) => calls.push(value),
      publishedCue: (value) => calls.push(value),
    },
    document,
    ready: Promise.resolve(snapshot),
    cues: false,
    getHost: () => ({
      readAudio: async (slot, options) => {
        assert.equal(slot, 'audio.music');
        assert.equal(options.snapshot, snapshot);
        return { blob };
      },
    }),
  });
  owner.setPlayer({ setPublishedTrack: (value) => tracks.push(value) });
  await owner.ready;
  assert.equal(await tracks.at(-1).readBlob(), blob);
  const target = {
    closest() {
      return this;
    },
    getAttribute() {
      return null;
    },
  };
  document.emit('focusin', { target });
  document.emit('click', { target });
  owner.close();
  assert.equal(tracks.at(-1), null);
  assert.deepEqual(calls, []);
});

test('music-only disposal cannot replace an existing cue owner or attach after late readiness', async () => {
  for (const rejectReady of [false, true]) {
    const document = audioDocument(),
      calls = [],
      tracks = [];
    let resolve, reject;
    const ready = new Promise((yes, no) => {
      resolve = yes;
      reject = no;
    });
    const owner = attachPublishedAudio({
      sound: {
        setPublishedAudio: (value) => calls.push(value),
        publishedCue: (value) => calls.push(value),
      },
      document,
      ready,
      cues: false,
      getHost: () => {
        throw new Error('Disposed adapter must not read a host.');
      },
    });
    owner.setPlayer({ setPublishedTrack: (value) => tracks.push(value) });
    assert.equal(document.listeners.size, 0, 'Music-only adapter installs no cue listeners.');
    owner.close();
    owner.close();
    if (rejectReady) reject(new Error('Unavailable presentation'));
    else
      resolve({
        resolved: {
          assets: {
            'audio.music': { kind: 'audio', file: { sha256: hash }, description: 'Late music' },
          },
        },
      });
    await owner.ready;
    document.emit('focusin');
    document.emit('click');
    assert.deepEqual(calls, [], 'No attachment or null cleanup can replace another cue owner.');
    assert.ok(tracks.length > 0);
    assert.ok(
      tracks.every((track) => track === null),
      'Late readiness cannot restore music.',
    );
  }
});

test('explicit retained audio adoption defeats late page readiness and invalidates stale readers', async () => {
  let finish;
  const pageReady = new Promise((resolve) => {
    finish = resolve;
  });
  const old = {
    resolved: {
      assets: {
        'audio.music': { kind: 'audio', file: { sha256: 'a'.repeat(64) }, description: 'Retained' },
      },
    },
  };
  const current = {
    resolved: {
      assets: {
        'audio.music': { kind: 'audio', file: { sha256: 'b'.repeat(64) }, description: 'Current' },
      },
    },
  };
  const tracks = [],
    cues = [],
    reads = [];
  let host = {
    readAudio: async (slot, options) => {
      reads.push({ slot, options });
      return { blob };
    },
  };
  const owner = attachPublishedAudio({
    sound: { setPublishedAudio: (read) => cues.push(read), publishedCue() {} },
    ready: pageReady,
    getHost: () => host,
    document: audioDocument(),
  });
  owner.setPlayer({ setPublishedTrack: (track) => tracks.push(track) });
  owner.setPresentation(old);
  const retained = tracks.at(-1);
  finish(current);
  await owner.ready;
  assert.equal(tracks.at(-1), retained);
  assert.equal(await retained.readBlob({}), blob);
  assert.equal(reads[0].options.snapshot, old);
  const count = cues.length;
  owner.setPresentation(old);
  assert.equal(cues.length, count, 'Identical adoption must not discard cue cache.');
  host = {
    readAudio: async () => {
      throw Error('Stale reader cannot access replacement host');
    },
  };
  owner.setPresentation(current);
  await assert.rejects(retained.readBlob({}), { name: 'AbortError' });
  owner.close();
  owner.setPresentation(old);
  assert.equal(tracks.at(-1), null);
  assert.equal(cues.at(-1), null);
});

test('switching presentation rejects an in-flight music read before the real player adopts old bytes', async () => {
  const h = playerFixture(),
    reads = [],
    tracks = [];
  const presentation = (sha, title) => ({
    resolved: {
      assets: {
        'audio.music': { kind: 'audio', file: { sha256: sha }, description: title },
      },
    },
  });
  const old = presentation('a'.repeat(64), 'Retained music'),
    current = presentation('b'.repeat(64), 'Current music'),
    currentBlob = new Blob(['new accepted music'], { type: 'audio/wav' });
  let host = {
    readAudio: (slot, options) => new Promise((resolve) => reads.push({ slot, options, resolve })),
  };
  const owner = attachPublishedAudio({
    sound: h.soundscape,
    ready: Promise.resolve(old),
    getHost: () => host,
    document: audioDocument(),
  });
  try {
    await owner.ready;
    owner.setPlayer({
      setPublishedTrack(track) {
        tracks.push(track);
        h.player.setPublishedTrack(track);
      },
    });
    const oldPlaying = h.player.play();
    await settleUntil(() => reads.length === 1);
    const oldReader = tracks.at(-1).readBlob({});
    const rejected = assert.rejects(oldReader, { name: 'AbortError' });
    await settleUntil(() => reads.length === 2);
    assert(reads.every((read) => read.options.snapshot === old));
    let currentReads = 0;
    host = {
      async readAudio(slot, options) {
        currentReads++;
        assert.equal(slot, 'audio.music');
        assert.equal(options.snapshot, current);
        return { blob: currentBlob };
      },
    };
    owner.setPresentation(current);
    for (const read of reads) read.resolve({ blob });
    await rejected;
    assert.equal(await oldPlaying, false);
    assert.equal(h.created.length, 0, 'Obsolete bytes must never receive an object URL.');
    assert.equal(h.media.plays, 0, 'An obsolete read must never start media playback.');
    assert.equal(currentReads, 0, 'Changing the accepted owner is not a Play gesture.');
    await h.player.play();
    assert.equal(currentReads, 1);
    assert.equal(h.created.length, 1);
    assert.equal(h.created[0].blob, currentBlob);
    assert.equal(h.media.plays, 1);
    assert.equal(h.player.snapshot().track.id, `published.${'b'.repeat(64)}`);
  } finally {
    owner.close();
    h.player.dispose();
    await h.soundscape.dispose();
  }
});

test('switching presentation during cue decoding discards the old cache and uses the new Soundscape owner', async () => {
  const h = audioHarness(),
    decodes = [],
    reads = [];
  h.context.decodeAudioData = () => new Promise((resolve) => decodes.push(resolve));
  const presentation = (sha) => ({
    resolved: {
      assets: { 'audio.confirm': { kind: 'audio', file: { sha256: sha } } },
    },
  });
  const old = presentation('a'.repeat(64)),
    current = presentation('b'.repeat(64)),
    oldBuffer = { duration: 0.1, length: 800, numberOfChannels: 1 },
    currentBuffer = { duration: 0.2, length: 1600, numberOfChannels: 1 };
  let host = {
    async readAudio(slot, options) {
      reads.push({ slot, options, owner: old });
      return { blob };
    },
  };
  const owner = attachPublishedAudio({
    sound: h.soundscape,
    ready: Promise.resolve(old),
    getHost: () => host,
    document: audioDocument(),
  });
  try {
    await owner.ready;
    await h.soundscape.enable();
    assert.equal(h.soundscape.publishedCue('confirm'), false);
    await settleUntil(() => decodes.length === 1);
    const before = h.sources.length;
    host = {
      async readAudio(slot, options) {
        reads.push({ slot, options, owner: current });
        return { blob: pcmWaveBlob({ seconds: 0.2 }) };
      },
    };
    owner.setPresentation(current);
    assert.equal(reads[0].options.signal.aborted, true);
    decodes[0](oldBuffer);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(h.sources.length, before, 'Old decode completion cannot play a voice.');
    assert.equal(h.soundscape.publishedCue('confirm'), false, 'The old buffer is not cached.');
    await settleUntil(() => decodes.length === 2);
    assert.equal(reads.length, 2);
    assert.equal(reads[1].owner, current);
    assert.equal(reads[1].options.snapshot, current);
    decodes[1](currentBuffer);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(h.sources.length, before, 'Decode completion must not replay the event.');
    assert.equal(h.soundscape.publishedCue('confirm'), true);
    assert.equal(h.sources.length, before + 1);
    assert.equal(h.sources.at(-1).buffer, currentBuffer);
    assert.equal(h.soundscape.voices.size, 1);
    owner.close();
    assert.equal(h.soundscape.voices.size, 0);
  } finally {
    owner.close();
    await h.soundscape.dispose();
  }
});

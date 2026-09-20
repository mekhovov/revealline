import test from 'node:test';
import assert from 'node:assert/strict';
import { createPresentationHost } from '../presentation/host.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { hashPresentationBytes } from '../presentation/bundle.mjs';
import { compilePresentation } from '../../scripts/compile-presentation.mjs';
import { createSoundtrackPlayer } from '../ui/soundtrack-player.mjs';
import { attachPublishedAudio } from '../ui/published-audio.mjs';
import { emptySoundtrackLibrary, BUILTIN_SOUNDTRACK_TRACKS } from '../soundtrack.mjs';
import { audioHarness, settleUntil } from './helpers/soundtrack-audio.mjs';
import { Events } from './helpers/couch-dom.mjs';

const bytes = new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 65, 86, 69]);
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

test('page cue listeners use native actions only and cleanup leaves no active audio adapter', async () => {
  const h = audioHarness(),
    document = new Events();
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
  const document = new Events(),
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

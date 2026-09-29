import assert from 'node:assert/strict';
import test from 'node:test';
import { demoPage } from './helpers/demo-host-fixture.mjs';
import { memoryStorage, settle } from './helpers/solo-dom.mjs';
import { audioHarness } from './helpers/soundtrack-audio.mjs';
import { fixture, memoryIndexedDB, structuralProbe } from './helpers/soundtrack-fixtures.mjs';
import { createSoundtrackStore } from '../soundtrack-store.mjs';
import { prepareSoundtrackLibrary } from '../soundtrack-bundle.mjs';
import { BUILTIN_SOUNDTRACK_TRACKS, upgradeSoundtrackLibrary } from '../soundtrack.mjs';
import { AUDIO_PREFERENCES_KEY } from '../audio-preferences.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { t } from '../i18n/index.mjs';

async function setup(context) {
  const original = await fixture(),
    db = memoryIndexedDB(),
    store = createSoundtrackStore({ indexedDB: db.indexedDB, soundtrackCatalogue: true }),
    library = structuredClone(
      upgradeSoundtrackLibrary({
        ...original.library,
        playlists: [
          {
            ...original.library.playlists[0],
            trackIds: [original.track.id, BUILTIN_SOUNDTRACK_TRACKS[0].id],
          },
        ],
        selection: { playlistId: 'qa.mix' },
      }),
    );
  library.listening.installedOnly = true;
  library.listening.recordingMode = false;
  await store.commit(
    await prepareSoundtrackLibrary(library, original.assets, {
      probeMedia: structuralProbe,
    }),
    { expectedGeneration: 0 },
  );
  store.close();
  const audio = {
      ...audioHarness(),
      // PNGImage uses Node's real blob registry; media elements remain modeled.
      URLImpl: undefined,
      durationSeconds: original.track.asset.durationSeconds,
    },
    storage = memoryStorage();
  storage.setItem(AUDIO_PREFERENCES_KEY, JSON.stringify({ muted: true, volume: 0.65 }));
  const page = await demoPage(context, { audio, storage, soundtrackIndexedDB: db.indexedDB });
  await settle(() => !page.$('soundtrack-open').disabled, 'Shared music player becomes ready');
  await page.open();
  await settle(
    () => page.$('demo-audio-title').textContent === original.track.title,
    'Existing playlist is prepared without playback',
  );
  return { page, audio, db, original, library };
}

const playing = (page) => page.$('demo-audio-toggle').textContent === t('demo:audio.pause');
const paused = (page) => page.$('demo-audio-toggle').textContent === t('demo:audio.play');
const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

test('actual demo shares mute, volume and transport while demo Pause and credits preserve gameplay', async (context) => {
  const { page } = await setup(context),
    ordinary = page.rendered.run,
    checkpoint = authoritativeCheckpoint(ordinary);
  assert.equal(page.$('demo-audio-mute').getAttribute('aria-pressed'), 'true');
  assert.equal(
    page.audioElements.some((element) => element.plays > 0),
    false,
  );
  page.$('demo-audio-mute').click();
  assert.equal(JSON.parse(page.storage.getItem(AUDIO_PREFERENCES_KEY)).muted, false);
  assert.equal(
    page.audioElements.some((element) => element.plays > 0),
    false,
    'Sound on must preserve explicit music Pause',
  );
  page.$('demo-audio-volume').value = '0.31';
  page.$('demo-audio-volume').emit('input');
  assert.equal(JSON.parse(page.storage.getItem(AUDIO_PREFERENCES_KEY)).volume, 0.31);
  page.$('demo-audio-toggle').click();
  await settle(() => playing(page) && page.audioElements.some((element) => !element.paused));
  const song = page.$('demo-audio-title').textContent;
  page.$('demo-interrupt').click();
  assert.equal(page.$('demo-actions').hidden, false);
  assert.equal(playing(page), true, 'Pause demo does not pause music');
  page.$('demo-audio-toggle').click();
  assert.equal(paused(page), true);
  assert.equal(
    page.audioElements.every((element) => element.paused),
    true,
  );
  page.$('demo-audio-next').click();
  await settle(() => page.$('demo-audio-title').textContent !== song);
  assert.equal(paused(page), true, 'Next changes song without undoing explicit music Pause');
  assert.deepEqual(authoritativeCheckpoint(ordinary), checkpoint);
  page.$('demo-back').click();
  assert.equal(page.$('demo-dialog').open, false);
  assert.equal(page.$('shell-home').open, true);
  assert.deepEqual(authoritativeCheckpoint(ordinary), checkpoint);
});

test('actual Play style starts paused music, preserves listening restrictions, and yields to newer close or Pause', async (context) => {
  const { page, db, library } = await setup(context);
  page.$('demo-audio-mute').click();
  page.$('demo-audio-style').value = 'synth90s';
  page.$('demo-audio-style').emit('change');
  page.$('demo-audio-play-style').click();
  await settle(() => playing(page), 'Play style must start the selected style from paused music');
  const reader = createSoundtrackStore({ indexedDB: db.indexedDB, soundtrackCatalogue: true });
  context.after(() => reader.close());
  let saved = await reader.read();
  assert.equal(saved.library.listening.mode, 'synth90s');
  assert.equal(saved.library.listening.installedOnly, true);
  assert.equal(saved.library.listening.recordingMode, library.listening.recordingMode);
  assert.deepEqual(saved.library.listening.genres, library.listening.genres);
  let cancelled = false;
  db.afterCommit = () => {
    if (cancelled) return;
    cancelled = true;
    // A global shortcut is the same transport intent as the demo Pause button.
    page.doc.body.emit('keydown', { code: 'KeyB', key: 'b' });
  };
  page.$('demo-audio-style').value = 'metal';
  page.$('demo-audio-style').emit('change');
  page.$('demo-audio-play-style').click();
  await settle(() => cancelled, 'Style save reaches the committed boundary');
  await flush();
  assert.equal(paused(page), true, 'Global Pause supersedes the asynchronous style action');
  db.afterCommit = null;
  saved = await reader.read();
  assert.equal(
    saved.library.listening.mode,
    'metal',
    'Completed atomic save remains authoritative',
  );
  page.$('demo-audio-style').value = 'synth90s';
  page.$('demo-audio-style').emit('change');
  page.$('demo-audio-play-style').click();
  page.$('demo-back').click();
  await flush();
  await page.open();
  assert.equal(paused(page), true, 'Close/reopen cannot resurrect the old style command');
  page.$('demo-audio-style').value = 'synth90s';
  page.$('demo-audio-style').emit('change');
  page.$('demo-audio-play-style').click();
  page.doc.body.emit('keydown', { code: 'KeyN', key: 'n' });
  await flush();
  assert.equal(paused(page), true, 'Global Next supersedes style playback while retaining Pause');
});

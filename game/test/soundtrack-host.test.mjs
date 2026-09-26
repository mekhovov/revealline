import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { audioHarness } from './helpers/soundtrack-audio.mjs';
import { fixture, memoryIndexedDB, structuralProbe } from './helpers/soundtrack-fixtures.mjs';
import { createSoundtrackStore } from '../soundtrack-store.mjs';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { prepareSoundtrackLibrary } from '../soundtrack-bundle.mjs';
import { BUILTIN_SOUNDTRACK_TRACKS } from '../soundtrack.mjs';
import { SOUNDTRACK_CATALOGUE } from '../content/soundtrack-catalogue.mjs';
import {
  ONLINE_SOUNDTRACK_CATALOGUE_URL,
  ONLINE_SOUNDTRACK_DIRECTORY_URL,
} from '../online-soundtrack-catalogue.mjs';
import { AUDIO_PREFERENCES_KEY } from '../audio-preferences.mjs';
import { emptyLibrary, updatePreferences, saveLibrary, loadLibrary } from '../library.mjs';
import { retryFixture } from './fixtures/retry-scenarios.mjs';

const classes = JSON.parse(readFileSync(new URL('../content/classes.json', import.meta.url)));
const base = retryFixture('self-contact').level;
const campaign = {
  version: 'xonix-campaign.v1',
  id: 'soundtrack-host',
  revision: '1',
  title: 'Music host journey',
  classRecipes: classes,
  levels: [1, 2].map((number) => ({
    ...base,
    id: `music-map-${number}`,
    name: `Music map ${number}`,
    goal: { coverage: 0.1 },
    rules: { lives: 3 },
  })),
};
const profileKey = 'revealline.library.dev.v1';
const preferences = (page) =>
  loadLibrary(page.storage, profileKey, { campaigns: [campaign] }).library.preferences;
const ticks = (page, count) => {
  for (let i = 0; i < count; i++) page.frame();
};
async function startFlight(page) {
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
}
async function waitFor(predicate, label, { attempts = 100 } = {}) {
  for (let i = 0; i < attempts; i++) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.ok(predicate(), label);
}
async function setup(
  t,
  { filePlayback = true, audioPreferences = {}, emptyMusic = false, fetchResponse } = {},
) {
  const original = await fixture(),
    db = memoryIndexedDB(),
    store = createSoundtrackStore({ indexedDB: db.indexedDB });
  const library = {
    ...original.library,
    playlists: [
      {
        ...original.library.playlists[0],
        trackIds: [original.track.id, BUILTIN_SOUNDTRACK_TRACKS[0].id],
      },
    ],
    selection: { playlistId: 'qa.mix' },
  };
  const prepared = await prepareSoundtrackLibrary(library, original.assets, {
    probeMedia: structuralProbe,
  });
  if (!emptyMusic) await store.commit(prepared, { expectedGeneration: 0 });
  store.close();
  const audio = {
    ...audioHarness(),
    durationSeconds: original.track.asset.durationSeconds,
    filePlayback,
  };
  const storage = memoryStorage();
  saveLibrary(
    storage,
    profileKey,
    updatePreferences(emptyLibrary(), { musicEnabled: false, ...audioPreferences }),
  );
  const page = await soloPage(t, {
    campaign,
    storage,
    audio,
    soundtrackIndexedDB: db.indexedDB,
    fetchResponse,
  });
  if (filePlayback)
    await settle(() => !page.$('soundtrack-open').disabled, 'Real soundtrack host initialized');
  return { page, audio, db, original };
}

test('muted fresh Solo menu and Studio do not acquire admitted hosted recordings before Play', async (t) => {
  assert(
    SOUNDTRACK_CATALOGUE.tracks.some((track) => track.archiveId),
    'This edition has admitted online music.',
  );
  const requests = [];
  const { page } = await setup(t, {
    emptyMusic: true,
    fetchResponse: async (url) => {
      if (String(url).includes('revealline-soundtracks-')) requests.push(String(url));
    },
  });
  await waitFor(
    () => !page.$('soundtrack-summary').textContent.includes('Loading music library'),
    'Silent library preparation settles',
  );
  await openStudio(page);
  assert.deepEqual(requests, [ONLINE_SOUNDTRACK_DIRECTORY_URL, ONLINE_SOUNDTRACK_CATALOGUE_URL]);
  assert.equal(
    requests.some((url) => /\.mp3(?:$|[?#])/.test(url)),
    false,
    'Silent catalogue discovery must not acquire recording bytes.',
  );
  assert(page.audioElements.every((media) => media.plays === 0));
  assert.deepEqual(page.errors, []);
});
async function openStudio(page) {
  page.$('settings-button').click();
  assert.equal(page.$('settings-dialog').open, true);
  page.$('settings-tab-audio').click();
  assert.equal(page.$('settings-panel-audio').hidden, false);
  page.$('soundtrack-open').click();
  await waitFor(
    () =>
      page.$('soundtrack-dialog')?.open &&
      /Saved library loaded|Music library ready|unsaved draft/.test(
        page.$('soundtrack-status')?.textContent,
      ),
    'Actual studio opens and reads local library',
  );
  assert.equal(page.$('settings-dialog').open, false);
}
const musicMedia = (page) => page.audioElements[0];
async function playStudio(page) {
  const play = page.$('soundtrack-play');
  assert.equal(play.disabled, false);
  // Prepared media starts before the Studio action finishes its host notification.
  await play.onclick();
  await waitFor(() => musicMedia(page).paused === false, page.$('soundtrack-now').textContent);
}
function leaveStudio(page) {
  page.$('soundtrack-close').click();
  assert.equal(page.$('settings-dialog').open, true);
  page.doc.querySelector('[data-close="settings-dialog"]').click();
  page.frame(0);
}

test('Settings music text follows master immediately and remains coherent after transport notifications', async (t) => {
  const { page } = await setup(t);
  page.$('settings-button').click();
  page.$('settings-tab-audio').click();
  await page.$('music-preview').onclick();
  const media = musicMedia(page);
  assert.equal(media.paused, false);
  assert.equal(media.muted, true);
  assert.equal(page.$('music-preview').textContent, 'Playlist playing · master sound muted');
  media.currentTime = 0.015;
  const before = { src: media.src, time: media.currentTime, plays: media.plays };
  for (const muted of [false, true]) {
    page.$('settings-master-mute').click();
    const label = muted ? 'Playlist playing · master sound muted' : 'Soundtrack playing ♫';
    assert.equal(page.$('music-preview').textContent, label, 'No frame or media event has run');
    assert.equal(media.muted, muted);
    media.emit('timeupdate');
    assert.equal(page.$('music-preview').textContent, label);
    assert.deepEqual({ src: media.src, time: media.currentTime, plays: media.plays }, before);
    assert.equal(media.paused, false);
  }
  assert.deepEqual(page.errors, []);
});

test('late Settings Play cancellation cannot replace a newer Library Pause label', async (t) => {
  const { page } = await setup(t);
  const media = musicMedia(page);
  await waitFor(() => !!media.src, 'Actual selected original is prepared');
  const originalPlay = media.play.bind(media);
  let release;
  const completion = new Promise((resolve) => (release = resolve));
  t.after(() => release());
  media.play = async () => {
    await originalPlay();
    await completion;
  };
  page.$('settings-button').click();
  page.$('settings-tab-audio').click();
  const playing = page.$('music-preview').onclick();
  await waitFor(() => !media.paused, 'Actual Settings Play reaches the media element');
  await openStudio(page);
  await page.$('soundtrack-pause').onclick();
  assert.equal(media.paused, true);
  assert.equal(page.$('music-preview').textContent, 'Play selected playlist ♫');
  const plays = media.plays;
  release();
  await playing;
  assert.equal(page.$('music-preview').textContent, 'Play selected playlist ♫');
  assert.equal(media.paused, true);
  assert.equal(media.plays, plays);
  assert.deepEqual(page.errors, []);
});

test('blocked Settings Play feedback survives master edits until a real transport retry', async (t) => {
  const { page } = await setup(t);
  const media = musicMedia(page);
  await waitFor(() => !!media.src, 'Actual selected original is prepared');
  const originalPlay = media.play.bind(media);
  media.play = async () => {
    throw Object.assign(new Error('Gesture refused'), { name: 'NotAllowedError' });
  };
  page.$('settings-button').click();
  page.$('settings-tab-audio').click();
  await page.$('music-preview').onclick();
  assert.equal(page.$('music-preview').textContent, 'Audio is unavailable');
  page.$('settings-master-mute').click();
  assert.equal(page.$('music-preview').textContent, 'Audio is unavailable');
  assert.equal(media.paused, true);
  media.play = originalPlay;
  await page.$('music-preview').onclick();
  assert.equal(page.$('music-preview').textContent, 'Soundtrack playing ♫');
  assert.equal(media.paused, false);
  assert.deepEqual(page.errors, []);
});

test('actual Settings → Studio uses stored MP3 selection, Next/Pause/Play and returns to a paused flight', async (t) => {
  const { page, audio } = await setup(t);
  assert.equal(audio.sources.length, 0, 'construction does not create audible sources');
  await startFlight(page);
  ticks(page, 5);
  await openStudio(page);
  page.frame(0);
  const flightTick = page.rendered.run.tick;
  assert.equal(
    page.$('soundtrack-selection').value,
    'qa.mix',
    'stored playlist loaded through real store',
  );
  await playStudio(page);
  assert.match(page.$('soundtrack-now').textContent, /Synthetic coded silence.*playing/);
  assert.equal(preferences(page).musicEnabled, false, 'Play does not unmute the master');
  assert.equal(musicMedia(page).muted, true);
  page.$('soundtrack-master-mute').click();
  assert.equal(preferences(page).musicEnabled, true, 'The explicit master control persists intent');
  assert.equal(musicMedia(page).muted, false);
  assert.equal(musicMedia(page).plays, 1);
  await page.$('soundtrack-next').onclick();
  await waitFor(
    () =>
      page.$('soundtrack-now').textContent.includes(BUILTIN_SOUNDTRACK_TRACKS[0].title) &&
      page.$('soundtrack-now').textContent.includes('playing'),
    'Next crosses actual streamed MP3 to synth transport',
  );
  page.frame(0);
  assert.ok(audio.sources.length > 0, 'real Soundscape scheduled synth notes');
  page.$('soundtrack-pause').click();
  await waitFor(() => page.$('soundtrack-now').textContent.includes('paused'), 'Music-only pause');
  leaveStudio(page);
  assert.equal(page.rendered.paused, true);
  assert.equal(page.rendered.run.tick, flightTick);
  await startFlight(page);
  ticks(page, 2);
  assert.equal(page.rendered.paused, false);
  assert.equal(page.rendered.run.tick, flightTick + 2);
  assert.match(
    page.$('soundtrack-summary').textContent,
    /paused/,
    'explicit game Resume does not override music-only Pause',
  );
  assert.deepEqual(page.errors, []);
});

test('actual MP3 keeps its stream and position through menus, a real victory, results, next level and collection', async (t) => {
  const { page, audio } = await setup(t);
  await openStudio(page);
  await playStudio(page);
  const media = musicMedia(page),
    url = media.src,
    plays = media.plays;
  media.currentTime = 0.01;
  media.emit('timeupdate');
  leaveStudio(page);
  await startFlight(page);
  page.key('ArrowDown');
  page.key('ArrowDown', false);
  for (let count = 0; count < 800 && page.rendered.run.status === 'running'; count++) page.frame();
  assert.equal(page.rendered.run.status, 'won', 'the host records a real cut and win');
  assert.equal(media.src, url);
  assert.equal(media.plays, plays);
  assert.equal(media.currentTime, 0.01);
  page.$('next-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.frame(0);
  assert.equal(page.rendered.run.levelId, 'music-map-2');
  assert.equal(media.src, url);
  assert.equal(media.plays, plays);
  assert.equal(media.currentTime, 0.01);
  page.$('collection-button').click();
  page.frame(0);
  assert.equal(page.$('collection-dialog').open, true);
  assert.equal(media.src, url);
  assert.equal(media.plays, plays);
  const streams = audio.created.filter(({ blob }) => blob.type.startsWith('audio/'));
  assert.equal(streams.length, 1, 'picture URLs must not count as replacement music streams');
  assert.equal(streams[0].url, url);
  assert.equal(audio.revoked.includes(url), false, 'the playing music stream remains retained');
  assert.deepEqual(page.errors, []);
});

test('actual master, music and SFX controls remain independent and the studio fader persists to game settings', async (t) => {
  const { page } = await setup(t);
  await openStudio(page);
  await playStudio(page);
  const media = musicMedia(page);
  page.$('soundtrack-volume').value = '.25';
  page.$('soundtrack-volume').emit('input');
  await waitFor(() => preferences(page).musicVolume === 0.25, 'Studio music preference persisted');
  assert.equal(Number(page.$('music-volume').value), 0.25);
  leaveStudio(page);
  page.$('settings-button').click();
  page.change('master-volume', '.4');
  page.change('sfx-volume', '0');
  page.frame(0);
  assert.equal(media.volume, 0.1, 'MP3 gain is master × music, independent of zero SFX');
  assert.equal(preferences(page).masterVolume, 0.4);
  assert.equal(preferences(page).sfxVolume, 0);
  page.change('music-volume', '.5');
  page.frame(0);
  assert.equal(media.volume, 0.2);
  assert.equal(preferences(page).sfxVolume, 0);
  assert.deepEqual(page.errors, []);
});

test('Studio master controls preserve a paused MP3 and persist the shared setting without advancing flight', async (t) => {
  const { page } = await setup(t, { audioPreferences: { musicEnabled: true } });
  await openStudio(page);
  await playStudio(page);
  const media = musicMedia(page);
  media.currentTime = 0.012;
  await page.$('soundtrack-pause').onclick();
  page.frame(0);
  const tick = page.rendered.run.tick,
    plays = media.plays,
    url = media.src;
  page.$('soundtrack-master-mute').click();
  assert.equal(media.muted, true);
  page.$('soundtrack-master-volume').value = '0.4';
  page.$('soundtrack-master-volume').emit('input');
  assert.deepEqual(JSON.parse(page.storage.getItem(AUDIO_PREFERENCES_KEY)), {
    muted: true,
    volume: 0.4,
  });
  page.$('soundtrack-master-mute').click();
  assert.equal(media.muted, false);
  assert.equal(media.paused, true, 'Unmute does not undo music Pause');
  assert.equal(media.plays, plays, 'Unmute does not issue another Play');
  assert.equal(media.currentTime, 0.012);
  assert.equal(media.src, url);
  assert.equal(Number(page.$('master-volume').value), 0.4);
  page.frame(0);
  assert.equal(page.rendered.run.tick, tick);
  assert.equal(page.rendered.paused, true);
  assert.deepEqual(page.errors, []);
});

test('actual hide/focus restores listening on the same stream while flight stays paused until explicit Resume', async (t) => {
  const { page } = await setup(t);
  await openStudio(page);
  await playStudio(page);
  leaveStudio(page);
  await startFlight(page);
  page.key('ArrowDown');
  page.key('ArrowDown', false);
  ticks(page, 10);
  const media = musicMedia(page),
    url = media.src;
  media.currentTime = 0.015;
  page.doc.hidden = true;
  page.doc.emit('visibilitychange');
  page.win.emit('blur');
  page.frame(0);
  const before = page.rendered.run.tick;
  assert.equal(media.paused, true);
  assert.equal(page.rendered.paused, true);
  page.doc.hidden = false;
  page.doc.emit('visibilitychange');
  page.win.emit('focus');
  await waitFor(() => !media.paused, 'Prior audio desire resumes on visible focus');
  ticks(page, 12);
  assert.equal(page.rendered.paused, true);
  assert.equal(page.rendered.run.tick, before);
  assert.equal(media.src, url);
  assert.equal(media.currentTime, 0.015);
  await startFlight(page);
  ticks(page, 2);
  assert.equal(page.rendered.run.tick, before + 2);
  assert.deepEqual(page.errors, []);
});

test('missing file-audio API disables Studio and leaves the original synth fallback usable', async (t) => {
  const { page, audio } = await setup(t, { filePlayback: false });
  await waitFor(
    () => page.$('soundtrack-summary').textContent.includes('does not provide file-audio'),
    'Observable file playback fallback',
  );
  assert.equal(page.$('soundtrack-open').disabled, true);
  assert.equal(page.$('soundtrack-dialog'), null);
  page.$('sound-button').click();
  await waitFor(() => preferences(page).musicEnabled === true, 'Legacy sound fallback enabled');
  assert.equal(audio.sources.length, 0, 'Unmuting alone does not start a soundtrack');
  await page.$('music-preview').onclick();
  page.frame(0);
  assert.ok(audio.sources.length > 0);
  assert.deepEqual(page.errors, []);
});

test('actual audition hide/focus releases the preview and restores prior MP3 listening without resuming flight', async (t) => {
  const { page, audio, original } = await setup(t);
  await openStudio(page);
  await playStudio(page);
  const media = musicMedia(page),
    url = media.src;
  page.change('soundtrack-tracks', original.track.id);
  page.$('soundtrack-audition-track').click();
  const preview = page.$('soundtrack-audition');
  await waitFor(
    () => preview.paused === false,
    'The actual panel starts a separate audition stream',
  );
  assert.equal(media.paused, true);
  page.doc.hidden = true;
  page.doc.emit('visibilitychange');
  page.win.emit('blur');
  await settle(
    () => preview.paused && page.$('soundtrack-audition').hidden,
    'Hidden audition resources released',
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(media.paused, true, 'No background audio starts while the document is hidden');
  page.doc.hidden = false;
  page.doc.emit('visibilitychange');
  page.win.emit('focus');
  await waitFor(() => media.paused === false, 'Remembered pre-audition listening resumes');
  page.frame(0);
  assert.equal(page.rendered.paused, true);
  assert.equal(page.rendered.run.tick, 0);
  assert.equal(media.src, url);
  assert.ok(audio.revoked.length >= 1);
  assert.deepEqual(page.errors, []);
});

test('a visible back/forward-cache pageshow restores music without requiring an extra focus event or resuming flight', async (t) => {
  const { page } = await setup(t);
  await openStudio(page);
  await playStudio(page);
  leaveStudio(page);
  await startFlight(page);
  ticks(page, 5);
  const media = musicMedia(page),
    url = media.src,
    position = 0.01;
  media.currentTime = position;
  page.win.emit('pagehide', { persisted: true });
  page.frame(0);
  const tick = page.rendered.run.tick;
  assert.equal(media.paused, true);
  assert.equal(page.rendered.paused, true);
  // The restored page is already visible. This browser event order has no
  // additional window focus or document visibilitychange notification.
  page.win.emit('pageshow', { persisted: true });
  await waitFor(() => !media.paused, 'Visible cached page must recover prior listening intent');
  ticks(page, 3);
  assert.equal(media.src, url);
  assert.equal(media.currentTime, position);
  assert.equal(page.rendered.run.tick, tick);
  assert.equal(page.rendered.paused, true);
  assert.match(page.$('save-warning').textContent, /session-only mode/);
});

test('actual Studio prepares without downloading; controller, keyboard and touch request its retained link without resuming flight', async (t) => {
  const { page, audio, original, db } = await setup(t);
  let time = performance.now();
  t.mock.method(performance, 'now', () => time);
  await startFlight(page);
  ticks(page, 5);
  await openStudio(page);
  page.frame(0);
  const { authoritativeCheckpoint } = await import('../replay.mjs');
  const checkpoint = authoritativeCheckpoint(page.rendered.run);
  const link = page.$('soundtrack-download-prepared');
  let requested = 0;
  link.addEventListener('click', () => requested++);
  let held = [];
  globalThis.navigator.getGamepads = () => [
    {
      id: 'owned-soundtrack-pad',
      index: 0,
      connected: true,
      mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, (_, i) => ({
        pressed: held.includes(i),
        value: held.includes(i) ? 1 : 0,
      })),
    },
  ];
  const sample = (buttons, ms = 0) => {
    held = buttons;
    time += ms;
    page.frame(ms);
  };
  sample([]);
  // A neutral sample connects automatically; Confirm is now a real menu action.
  sample([]);
  for (
    let i = 0;
    page.doc.activeElement !== page.$('soundtrack-advanced-backup-toggle') && i < 100;
    i++
  ) {
    sample([13]);
    sample([]);
  }
  assert.equal(
    page.doc.activeElement,
    page.$('soundtrack-advanced-backup-toggle'),
    'Controller reaches the collapsed backup tools.',
  );
  sample([0]);
  sample([]);
  assert.equal(page.$('soundtrack-advanced-backup-body').hidden, false);
  for (let i = 0; page.doc.activeElement !== page.$('soundtrack-export-bundle') && i < 100; i++) {
    sample([13]);
    sample([]);
  }
  assert.equal(
    page.doc.activeElement,
    page.$('soundtrack-export-bundle'),
    'Controller reaches Prepare through the actual dialog focus scope.',
  );
  sample([0]);
  await waitFor(
    () => !page.$('soundtrack-backup-ready').hidden,
    'Actual binary preparation finishes',
    { attempts: 400 },
  );
  assert.equal(page.doc.activeElement, link);
  assert.equal(requested, 0, 'Preparation focuses but never activates the download.');
  const url = link.getAttribute('href');
  const prepared = audio.created.find((item) => item.url === url);
  assert.ok(prepared?.blob instanceof Blob);
  const { importSoundtrackBundle } = await import('../soundtrack-bundle.mjs');
  const recovered = await importSoundtrackBundle(prepared.blob, { probeMedia: structuralProbe });
  assert.deepEqual(
    Buffer.from(await recovered.assets[0].blob.arrayBuffer()),
    Buffer.from(await original.blob.arrayBuffer()),
  );
  sample([0], 1200);
  assert.equal(requested, 0, 'Held Confirm cannot activate the newly focused action.');
  sample([]);
  sample([0]);
  assert.equal(requested, 1);
  sample([0], 1200);
  assert.equal(requested, 1, 'Held Confirm does not request duplicate downloads.');
  sample([]);
  const echoed = link.emit('keydown', { code: 'Enter', key: 'Enter', repeat: false });
  assert.equal(
    echoed.defaultPrevented,
    true,
    'The v0.110.1 controller guard consumes the delayed native Enter echo.',
  );
  link.emit('keyup', { code: 'Enter', key: 'Enter' });
  assert.equal(requested, 1, 'The controller-owned native echo cannot request a duplicate.');
  time += 1251;
  const enter = link.emit('keydown', { code: 'Enter', key: 'Enter', repeat: false });
  assert.equal(
    enter.defaultPrevented,
    false,
    'The shared keyboard handler retains native link activation.',
  );
  link.click(); // Model the browser's unprevented Enter default; the DOM adapter does not implement it.
  link.emit('keyup', { code: 'Enter', key: 'Enter' });
  assert.equal(requested, 2);
  const repeated = link.emit('keydown', { code: 'Enter', key: 'Enter', repeat: true });
  assert.equal(
    repeated.defaultPrevented,
    true,
    'Held Enter cannot repeatedly activate the new link.',
  );
  link.emit('pointerdown', { pointerType: 'touch', pointerId: 7, button: 0, isPrimary: true });
  link.emit('pointerup', { pointerType: 'touch', pointerId: 7, button: 0, isPrimary: true });
  link.click(); // Browser default navigation/download itself is outside this DOM model.
  assert.equal(requested, 3);
  assert.equal(link.getAttribute('href'), url);
  assert.equal(
    audio.created.filter((item) => item.blob.type === 'application/vnd.revealline.soundtrack')
      .length,
    1,
  );
  assert.equal(audio.revoked.includes(url), false);
  const shared = createManagedMediaStore({
    indexedDB: db.indexedDB,
    storyMedia: true,
    soundtrackCatalogue: true,
  });
  const reader = createSoundtrackStore({ managedStore: shared });
  assert.equal(
    (await reader.read()).generation,
    1,
    'Preparing and requesting files never saves a music draft.',
  );
  reader.close();
  shared.close();
  assert.equal(page.rendered.paused, true);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.match(page.$('soundtrack-status').textContent, /Download requested/);
  leaveStudio(page);
  assert.equal(page.rendered.paused, true);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.deepEqual(page.errors, []);
});

for (const [intent, initiallyEnabled] of [
  ['play', false],
  ['pause', false],
  ['pause', true],
  ['mute', true],
])
  test(`closing Studio during pending Play respects ${intent} with saved audio ${initiallyEnabled ? 'enabled' : 'disabled'} when flight starts`, async (t) => {
    const { page } = await setup(t, { audioPreferences: { musicEnabled: initiallyEnabled } });
    await openStudio(page);
    if (initiallyEnabled) {
      await playStudio(page);
      await page.$('soundtrack-pause').onclick();
    }
    const media = musicMedia(page);
    await waitFor(() => !!media.src, 'Selected MP3 is prepared before the play gesture');
    const originalPlay = media.play.bind(media);
    let release;
    const completion = new Promise((resolve) => {
      release = resolve;
    });
    t.after(() => release());
    media.play = async () => {
      await originalPlay();
      await completion;
    };
    const playing = page.$('soundtrack-play').onclick();
    await waitFor(() => !media.paused, 'The real media element received Play');
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(
      preferences(page).musicEnabled,
      initiallyEnabled,
      'Play leaves the master preference unchanged',
    );
    assert.equal(page.$('soundtrack-close').disabled, false);
    const url = media.src;
    if (intent === 'pause') await page.$('soundtrack-pause').onclick();
    leaveStudio(page);
    if (intent === 'mute') await page.$('sound-button').onclick();
    await startFlight(page);
    ticks(page, 3);
    assert.equal(page.rendered.paused, false, 'Flight remains available while media completes');
    assert.equal(
      media.paused,
      intent === 'pause',
      'Only music Pause stops transport; master Mute preserves transport intent',
    );
    release();
    await playing;
    assert.equal(preferences(page).musicEnabled, intent === 'mute' ? false : initiallyEnabled);
    assert.equal(
      media.muted,
      intent === 'mute' || !initiallyEnabled,
      'Late Play completion cannot defeat the latest master mute',
    );
    assert.equal(media.src, url);
    assert.deepEqual(page.errors, []);
  });

test('Solo Audio exposes full current credits while compact Pause remains an ordinary Pause owner', async (t) => {
  const { page, original } = await setup(t);
  await openStudio(page);
  await playStudio(page);
  leaveStudio(page);
  page.$('settings-button').click();
  page.$('settings-tab-audio').click();
  const details = page.$('solo-music-details');
  assert.match(details.textContent, /RevealLine tests/);
  assert.match(details.textContent, /File:/);
  assert.ok(
    page.$('pause-button').getAttribute('data-track-caption').includes(original.track.title),
  );
  assert.equal(page.rendered.paused, true);
  assert.deepEqual(page.errors, []);
});

test('quick Solo controls play from the menu, pause independently and skip without resuming music', async (t) => {
  const { page } = await setup(t);
  await waitFor(() => !!musicMedia(page).src, 'Original prepared for first menu gesture');
  const menu = page.$('solo-quick-music-0-toggle'),
    pause = page.$('solo-quick-music-1-toggle'),
    master = page.storage.getItem(AUDIO_PREFERENCES_KEY);
  assert(menu && pause, 'Main and pause surfaces share the transport');
  menu.click();
  assert.equal(musicMedia(page).paused, false, 'Play begins in the click task');
  await waitFor(() => pause.textContent === 'Pause music', 'Both controls show playing');
  await startFlight(page);
  page.key('ArrowDown');
  page.key('ArrowDown', false);
  ticks(page, 2);
  const tick = page.rendered.run.tick;
  pause.click();
  assert.equal(musicMedia(page).paused, true);
  ticks(page, 2);
  assert.equal(page.rendered.paused, false, 'Music Pause leaves gameplay running');
  assert(page.rendered.run.tick > tick);
  page.doc.body.emit('keydown', { code: 'KeyN', key: 'n' });
  await waitFor(
    () => page.$('solo-quick-music-0').textContent.includes(BUILTIN_SOUNDTRACK_TRACKS[0].title),
    'Paused Next selects the next recording',
  );
  assert.equal(pause.textContent, 'Play music');
  assert.equal(musicMedia(page).paused, true);
  assert.equal(page.storage.getItem(AUDIO_PREFERENCES_KEY), master);
  assert.deepEqual(page.errors, []);
});

for (const gesture of ['keyboard', 'pointer']) {
  test(`quick Solo ${gesture} retry owns its blocked playback gesture exactly once`, async (t) => {
    const { page } = await setup(t, { audioPreferences: { musicEnabled: true } });
    const media = musicMedia(page),
      originalPlay = media.play.bind(media);
    await waitFor(() => !!media.src, 'Original is ready');
    assert.equal(media.muted, false, 'Unmuted master permits lifecycle capture retry');
    media.play = async () => {
      throw Object.assign(new Error('Gesture refused'), { name: 'NotAllowedError' });
    };
    const button = page.$('solo-quick-music-0-toggle');
    button.click();
    await waitFor(
      () => page.$('solo-quick-music-0').textContent.includes('Choose Play music to retry'),
      'Rejected playback is visible',
    );
    media.play = originalPlay;
    const plays = media.plays;
    if (gesture === 'keyboard')
      page.doc.body.emit('keydown', { code: 'KeyB', key: 'b', isTrusted: true });
    else {
      button.emit('pointerdown', { isTrusted: true });
      assert.equal(media.plays, plays, 'Capture must not start playback ahead of the button');
      button.click();
    }
    await waitFor(() => button.textContent === 'Pause music', 'Explicit retry settles playing');
    assert.equal(media.plays, plays + 1);
    assert.equal(media.paused, false);
    assert.deepEqual(page.errors, []);
  });
}

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
async function waitFor(predicate, label) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.ok(predicate(), label);
}
async function setup(t, { filePlayback = true, audioPreferences = {} } = {}) {
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
  await store.commit(prepared, { expectedGeneration: 0 });
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
  const page = await soloPage(t, { campaign, storage, audio, soundtrackIndexedDB: db.indexedDB });
  if (filePlayback)
    await settle(() => !page.$('soundtrack-open').disabled, 'Real soundtrack host initialized');
  return { page, audio, db, original };
}
async function openStudio(page) {
  page.$('settings-button').click();
  assert.equal(page.$('settings-dialog').open, true);
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

test('actual Settings → Studio uses stored MP3 selection, Next/Pause/Play and returns to a paused flight', async (t) => {
  const { page, audio } = await setup(t);
  assert.equal(audio.sources.length, 0, 'construction does not create audible sources');
  page.$('start-button').click();
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
  assert.equal(preferences(page).musicEnabled, true);
  assert.equal(musicMedia(page).plays, 1);
  page.$('soundtrack-next').click();
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
  page.$('start-button').click();
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
  page.$('start-button').click();
  page.key('ArrowDown');
  page.key('ArrowDown', false);
  for (let count = 0; count < 800 && page.rendered.run.status === 'running'; count++) page.frame();
  assert.equal(page.rendered.run.status, 'won', 'the host records a real cut and win');
  assert.equal(media.src, url);
  assert.equal(media.plays, plays);
  assert.equal(media.currentTime, 0.01);
  page.$('next-button').click();
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
  assert.equal(audio.created.length, 1);
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

test('actual hide/focus restores listening on the same stream while flight stays paused until explicit Resume', async (t) => {
  const { page } = await setup(t);
  await openStudio(page);
  await playStudio(page);
  leaveStudio(page);
  page.$('start-button').click();
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
  page.$('start-button').click();
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
  const preview = page.audioElements[1];
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
  page.$('start-button').click();
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
  page.$('start-button').click();
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
    page.frame(ms);
  };
  sample([]);
  // A neutral sample connects automatically; Confirm is now a real menu action.
  sample([]);
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
  const shared = createManagedMediaStore({ indexedDB: db.indexedDB, storyMedia: true });
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
    const { page } = await setup(t);
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
      'Successful playback notification is still pending',
    );
    assert.equal(page.$('soundtrack-close').disabled, false);
    const url = media.src;
    if (intent === 'pause') await page.$('soundtrack-pause').onclick();
    leaveStudio(page);
    if (intent === 'mute') await page.$('sound-button').onclick();
    page.$('start-button').click();
    ticks(page, 3);
    assert.equal(page.rendered.paused, false, 'Flight remains available while media completes');
    assert.equal(
      media.paused,
      intent !== 'play',
      'Starting flight preserves the latest explicit listening intent',
    );
    release();
    await playing;
    assert.equal(
      preferences(page).musicEnabled,
      intent === 'mute' ? false : initiallyEnabled || intent === 'play',
    );
    assert.equal(media.src, url);
    assert.deepEqual(page.errors, []);
  });

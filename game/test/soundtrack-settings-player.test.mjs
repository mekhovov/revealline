import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ONLINE_SOUNDTRACK_STYLE_CHOICES,
  onlineSoundtrackMatchesStyle,
  soundtrackGenresForOnlineStyles,
} from '../online-soundtrack-styles.mjs';
import {
  attachSoundtrackSettingsPlayer,
  SOUNDTRACK_SETTINGS_KEY,
} from '../ui/soundtrack-settings-player.mjs';
import { Document } from './helpers/couch-dom.mjs';

const track = (id, tags) => ({
  id: `online.${id.padEnd(64, '0')}`,
  title: id,
  artist: 'Artist',
  tags,
  websites: [{ url: `https://artist.example/${id}` }],
  recordingModeEligible: true,
  contentId: false,
});

function setup({ stored = null, catalogueTracks = [] } = {}) {
  const doc = new Document(),
    root = doc.createElement('div'),
    calls = [],
    values = new Map();
  doc.body.append(root);
  if (stored !== null) values.set(SOUNDTRACK_SETTINGS_KEY, stored);
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  let state = {
      desired: false,
      playing: false,
      status: 'paused',
      volume: 0.6,
      queue: ['one', 'two'],
      track: { title: 'Current', artist: 'Creator', websites: [{ url: 'https://source.test' }] },
    },
    fetches = 0;
  const player = {
    snapshot: () => state,
    previous: () => calls.push('previous'),
    play: () => {
      calls.push('play');
      state = { ...state, desired: true, playing: true, status: 'playing' };
      return true;
    },
    pause: () => {
      calls.push('pause');
      state = { ...state, desired: false, playing: false, status: 'paused' };
    },
    next: () => calls.push('next'),
    wake: () => calls.push('wake'),
    selectListening: async (listening) => calls.push(['listening', listening]),
    playRemotePlaylist: async (tracks, options) => calls.push(['remote', tracks, options]),
  };
  const view = attachSoundtrackSettingsPlayer({
    document: doc,
    root,
    player,
    getLibrary: () => ({
      listening: { installedOnly: false, recordingMode: false },
    }),
    getMaster: () => ({ muted: false, volume: 1 }),
    getStorage: () => storage,
    activate: () => player.play(),
    beforeSelection: () => calls.push('unlock'),
    openLibrary: () => calls.push('advanced'),
    fetchCatalogue: async () => {
      fetches++;
      return { tracks: catalogueTracks };
    },
  });
  return {
    doc,
    root,
    player,
    view,
    values,
    calls,
    fetches: () => fetches,
    setState(value) {
      state = value;
      view.update();
    },
  };
}

test('archive style families are shared and map to local soundtrack genres', () => {
  assert.deepEqual(
    ONLINE_SOUNDTRACK_STYLE_CHOICES.map(([id]) => id),
    ['fpv', 'ua', 'synth', 'metal', 'ukrainian', 'chiptune', 'rock', 'ambient', 'fusion', 'other'],
  );
  assert.equal(onlineSoundtrackMatchesStyle(track('fpv', ['ФПВ', 'UA']), 'fpv'), true);
  assert.equal(onlineSoundtrackMatchesStyle(track('race', ['synthwave', 'racing']), 'synth'), true);
  assert.equal(
    onlineSoundtrackMatchesStyle(track('doom', ['metal', 'industrial']), 'ambient'),
    false,
  );
  assert.deepEqual(soundtrackGenresForOnlineStyles(new Set(['synth', 'rock'])), [
    'synth90s',
    'electronic',
    'rock',
  ]);
});

test('main Audio player exposes compact transport, source and every archive style choice', () => {
  const f = setup();
  assert.equal(f.doc.getElementById('settings-music-player-heading').textContent, 'Music player');
  assert.match(f.doc.getElementById('settings-music-now').textContent, /Current · Creator/);
  assert.equal(
    f.doc.getElementById('settings-music-source').getAttribute('href'),
    'https://source.test/',
  );
  assert.equal(
    f.doc
      .getElementById('settings-music-style-fpv')
      .closest('fieldset')
      .children.filter((child) => child.tagName === 'LABEL').length,
    10,
  );
  assert.equal(f.doc.getElementById('settings-music-local').checked, true);
  assert.equal(f.doc.getElementById('settings-music-archive').checked, false);
  f.doc.getElementById('settings-music-previous').onclick();
  f.doc.getElementById('settings-music-toggle').onclick();
  f.doc.getElementById('settings-music-next').onclick();
  f.doc.getElementById('settings-music-advanced').onclick();
  assert.deepEqual(f.calls, ['previous', 'play', 'next', 'advanced']);
  f.view.dispose();
  assert.equal(f.doc.contains(f.view.element), false);
});

test('selected archive styles stream in the requested order and can mix with local music', async () => {
  const fpv = track('fpv', ['ФПВ', 'UA']),
    synth = track('synth', ['synthwave', 'electronic']),
    metal = track('metal', ['metal']);
  const f = setup({ catalogueTracks: [fpv, synth, metal] });
  const archive = f.doc.getElementById('settings-music-archive');
  archive.checked = true;
  archive.onchange();
  await Promise.resolve();
  await Promise.resolve();
  for (const [, input] of ONLINE_SOUNDTRACK_STYLE_CHOICES.map(([id]) => [
    id,
    f.doc.getElementById(`settings-music-style-${id}`),
  ]))
    input.checked = false;
  f.doc.getElementById('settings-music-style-fpv').checked = true;
  f.doc.getElementById('settings-music-style-ua').checked = true;
  f.doc.getElementById('settings-music-order').value = 'ordered';
  await f.doc.getElementById('settings-music-play-selection').onclick();
  assert.equal(f.fetches(), 1);
  assert.equal(f.calls[0], 'unlock');
  const listening = f.calls.find((call) => Array.isArray(call) && call[0] === 'listening');
  assert.deepEqual(listening[1].genres, ['ukrainian']);
  const remote = f.calls.find((call) => Array.isArray(call) && call[0] === 'remote');
  assert.deepEqual(remote[1], [fpv]);
  assert.deepEqual(remote[2], {
    order: 'ordered',
    repeat: 'all',
    mixWithLibrary: true,
  });
  assert.deepEqual(JSON.parse(f.values.get(SOUNDTRACK_SETTINGS_KEY)), {
    local: true,
    archive: true,
    styles: ONLINE_SOUNDTRACK_STYLE_CHOICES.map(([id]) => id),
    order: 'shuffle',
  });
  f.view.dispose();
});

test('archive-only playback and an archive failure do not replace the local transport', async () => {
  const synth = track('synth', ['synthwave']);
  const f = setup({ catalogueTracks: [synth] });
  f.doc.getElementById('settings-music-local').checked = false;
  f.doc.getElementById('settings-music-local').onchange();
  f.doc.getElementById('settings-music-archive').checked = true;
  f.doc.getElementById('settings-music-archive').onchange();
  await Promise.resolve();
  await Promise.resolve();
  await f.doc.getElementById('settings-music-play-selection').onclick();
  assert.equal(
    f.calls.some((call) => Array.isArray(call) && call[0] === 'listening'),
    false,
  );
  assert.equal(
    f.calls.find((call) => Array.isArray(call) && call[0] === 'remote')[2].mixWithLibrary,
    false,
  );
  f.view.dispose();

  const broken = setup();
  broken.doc.getElementById('settings-music-archive').checked = true;
  broken.doc.getElementById('settings-music-archive').onchange();
  await Promise.resolve();
  await broken.doc.getElementById('settings-music-play-selection').onclick();
  assert.ok(
    broken.calls.some((call) => Array.isArray(call) && call[0] === 'listening'),
    'local selection remains usable when the archive has no matching recordings',
  );
  broken.doc.getElementById('settings-music-toggle').onclick();
  assert.ok(broken.calls.includes('play'));
  broken.view.dispose();
});

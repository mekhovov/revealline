import assert from 'node:assert/strict';
import test from 'node:test';
import { attachDemoAudio } from '../ui/demo-audio.mjs';
import { SOUNDTRACK_MODES } from '../soundtrack.mjs';
import { t } from '../i18n/index.mjs';
import { Document } from './helpers/couch-dom.mjs';

const flush = async () => {
  for (let index = 0; index < 6; index++) await Promise.resolve();
};
function setup(overrides = {}) {
  const doc = new Document(),
    root = doc.createElement('section'),
    calls = [],
    listeners = new Set(),
    errors = [];
  root.id = 'demo-audio';
  doc.body.append(root);
  let state = {
      muted: false,
      volume: 0.65,
      style: 'auto',
      desired: true,
      playing: true,
      status: 'playing',
      queue: ['one', 'two'],
      track: { id: 'one', title: 'First song', artist: 'Composer' },
    },
    gameSounds = false,
    active = true;
  const emit = (update) => {
    state = { ...state, ...update };
    for (const listener of listeners) listener();
  };
  const audio = {
    snapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    wake: () => calls.push('wake'),
    setMuted: (muted) => {
      calls.push(['muted', muted]);
      emit({ muted });
    },
    setVolume: (volume) => {
      calls.push(['volume', volume]);
      emit({ volume });
    },
    play: () => {
      calls.push('play');
      emit({ desired: true, playing: true, status: 'playing' });
    },
    pause: () => {
      calls.push('pause');
      emit({ desired: false, playing: false, status: 'paused' });
    },
    next: () => {
      calls.push('next');
      emit({ track: { id: 'two', title: 'Second song', artist: 'Another composer' } });
    },
    selectStyle: (style) => {
      calls.push(['style', style]);
      emit({ style });
    },
    ...overrides,
  };
  const view = attachDemoAudio({
    root,
    document: doc,
    audio,
    getGameSounds: () => gameSounds,
    onGameSoundsChange: (value) => {
      calls.push(['gameSounds', value]);
      gameSounds = value;
    },
    active: () => active,
    onError: (error) => errors.push(error),
  });
  return {
    doc,
    root,
    calls,
    errors,
    audio,
    view,
    emit,
    listeners,
    state: () => state,
    setActive: (value) => {
      active = value;
    },
    $: (name) => doc.getElementById(`demo-audio-${name}`),
  };
}

test('demo audio controls share transport and never own a global keyboard shortcut', async (context) => {
  const f = setup();
  context.after(() => f.view.dispose());
  f.$('toggle').focus();
  f.$('toggle').click();
  assert.deepEqual(f.calls, ['pause']);
  f.$('toggle').click();
  assert.deepEqual(
    f.calls,
    ['pause', 'wake', 'play'],
    'wake and play happen in the activation task',
  );
  f.$('next').click();
  assert.deepEqual(f.calls.slice(-2), ['wake', 'next']);
  assert.equal(f.$('title').textContent, 'Second song');
  assert.equal(f.doc.activeElement, f.$('toggle'));
  f.doc.body.emit('keydown', { code: 'KeyB', key: 'b' });
  assert.equal(f.calls.length, 5);
  assert.equal(f.root.getAttribute('data-demo-ui'), '');
  assert.equal(f.view.contains(f.$('next')), true);
  assert.equal(f.view.contains(f.doc.body), false);
  await flush();
});

test('sound toggle and volume preserve the independent paused music intent', (context) => {
  const f = setup();
  context.after(() => f.view.dispose());
  f.emit({ desired: false, playing: false, status: 'paused' });
  f.$('mute').click();
  assert.deepEqual(f.calls, [['muted', true]]);
  assert.equal(f.$('mute').getAttribute('aria-pressed'), 'true');
  f.$('mute').click();
  assert.deepEqual(f.calls.slice(-2), [['muted', false], 'wake']);
  assert.equal(f.state().desired, false);
  f.$('volume').value = '0.28';
  f.$('volume').emit('input');
  assert.deepEqual(f.calls.at(-1), ['volume', 0.28]);
  assert.equal(f.$('volume').getAttribute('aria-valuetext'), '28%');
  assert.equal(f.state().desired, false);
});

test('style selection stays a draft until explicit Play style and preserves every supported mode', async (context) => {
  const f = setup();
  context.after(() => f.view.dispose());
  assert.deepEqual(
    f.$('style').options.map((option) => option.value),
    SOUNDTRACK_MODES,
  );
  f.$('style').value = 'ambient';
  f.$('style').emit('change');
  f.emit({ volume: 0.5 });
  assert.equal(f.$('style').value, 'ambient', 'unrelated audio renders retain the draft');
  assert.deepEqual(f.calls, []);
  f.$('play-style').click();
  assert.deepEqual(f.calls, ['wake', ['style', 'ambient']]);
  await flush();
  assert.equal(f.calls.includes('play'), false, 'adapter owns style playback and cancellation');
  f.emit({ style: 'metal' });
  assert.equal(f.$('style').value, 'metal', 'external persisted changes replace the draft');
});

test('game sounds choice changes only the demo mode, with no transport or mute mutation', (context) => {
  const f = setup();
  context.after(() => f.view.dispose());
  const before = structuredClone(f.state());
  f.$('sounds').value = 'game';
  f.$('sounds').emit('change');
  assert.deepEqual(f.calls, [['gameSounds', true]]);
  assert.equal(f.$('sounds').value, 'game');
  assert.deepEqual(f.state(), before);
});

test('credits are text-only and source links reject unsafe schemes and credentials', (context) => {
  const f = setup();
  context.after(() => f.view.dispose());
  f.emit({
    track: {
      title: '<img src=x onerror=bad()>',
      artist: '<b>Composer</b>',
      websites: [{ url: 'javascript:bad()' }, { url: 'https://user:secret@music.example/' }],
      rights: { source: 'https://artist.example/song' },
    },
  });
  assert.equal(f.$('title').textContent, '<img src=x onerror=bad()>');
  assert.equal(f.root.querySelectorAll('img').length, 0);
  assert.equal(
    f.$('source').querySelector('a').getAttribute('href'),
    'https://artist.example/song',
  );
  assert.equal(f.$('source').querySelector('a').getAttribute('target'), '_blank');
  assert.equal(f.$('source').querySelector('a').getAttribute('rel'), 'noopener noreferrer');
  f.emit({ track: { title: 'Offline composition', rights: { source: 'plain credit text' } } });
  assert.equal(f.$('source').hidden, true);
  assert.equal(f.$('source').querySelector('a'), null);
});

test('blocked audio retries inside activation and unavailable audio remains usable UI', (context) => {
  const f = setup();
  context.after(() => f.view.dispose());
  f.emit({ desired: true, playing: false, status: 'blocked' });
  f.$('toggle').click();
  assert.deepEqual(f.calls, ['wake', 'play']);
  const emptyRoot = f.doc.createElement('section');
  emptyRoot.id = 'absent';
  f.doc.body.append(emptyRoot);
  const empty = attachDemoAudio({ root: emptyRoot, document: f.doc });
  context.after(() => empty.dispose());
  for (const name of ['mute', 'toggle', 'next', 'volume', 'style', 'play-style'])
    assert.equal(f.doc.getElementById(`absent-${name}`).disabled, true);
  assert.equal(f.doc.getElementById('absent-status').textContent, t('demo:audio.unavailable'));
  assert.doesNotThrow(() => attachDemoAudio().dispose());
});

test('new commands and close/reset suppress stale asynchronous errors', async (context) => {
  let rejectStyle;
  const f = setup({
    selectStyle: () =>
      new Promise((_resolve, reject) => {
        rejectStyle = reject;
      }),
  });
  context.after(() => f.view.dispose());
  f.$('play-style').click();
  f.$('toggle').click();
  rejectStyle(new Error('late style failure'));
  await flush();
  assert.deepEqual(f.errors, []);
  assert.notEqual(f.$('status').textContent, t('demo:audio.failed'));
  f.$('play-style').click();
  f.view.reset();
  f.setActive(false);
  f.setActive(true);
  rejectStyle(new Error('old session failure'));
  await flush();
  assert.deepEqual(f.errors, []);
});

test('current command errors surface once and disposal removes subscriptions and handlers', async () => {
  const failure = new Error('play failed'),
    f = setup({ next: () => Promise.reject(failure) });
  const next = f.$('next');
  next.click();
  await flush();
  assert.deepEqual(f.errors, [failure]);
  assert.equal(f.$('status').textContent, t('demo:audio.failed'));
  assert.equal(f.listeners.size, 1);
  f.view.dispose();
  assert.equal(f.listeners.size, 0);
  assert.equal(f.root.children.length, 0);
  assert.equal(f.view.contains(next), false);
  const count = f.calls.length;
  next.click();
  assert.equal(f.calls.length, count);
  assert.doesNotThrow(() => f.view.dispose());
});

test('inactive view cannot change shared listening state', (context) => {
  const f = setup();
  context.after(() => f.view.dispose());
  f.setActive(false);
  for (const name of ['mute', 'toggle', 'next', 'play-style']) f.$(name).click();
  f.$('volume').value = '0.2';
  f.$('volume').emit('input');
  assert.deepEqual(f.calls, []);
});

test('missing playback capability retains master sound controls without offering inert music actions', (context) => {
  const f = setup();
  context.after(() => f.view.dispose());
  f.emit({ playbackAvailable: false, status: 'unavailable' });
  for (const name of ['toggle', 'next', 'style', 'play-style'])
    assert.equal(f.$(name).disabled, true);
  for (const name of ['mute', 'volume']) assert.equal(f.$(name).disabled, false);
  assert.equal(f.$('status').textContent, t('demo:audio.unavailable'));
  f.$('mute').click();
  assert.deepEqual(f.calls, [['muted', true]]);
});

test('demo credits select creator resources rather than licence or provenance and retain their link node', (context) => {
  const f = setup();
  context.after(() => f.view.dispose());
  const track = {
    title: 'Creator recording',
    artist: 'Composer',
    websites: [
      { label: 'CC BY 4.0 International', url: 'https://creativecommons.org/licenses/by/4.0/' },
      { label: 'Recording provenance', url: 'https://history.example/recording' },
      { label: 'Creator source and recording license', url: 'https://composer.example/song' },
    ],
    rights: { source: 'https://composer.example/song' },
  };
  f.emit({ track });
  const link = f.$('source').querySelector('a');
  assert.equal(link.getAttribute('href'), 'https://composer.example/song');
  assert.equal(link.getAttribute('target'), '_blank');
  assert.equal(link.getAttribute('rel'), 'noopener noreferrer');
  assert.equal(f.$('source').querySelectorAll('a').length, 1);
  link.focus();
  f.emit({ track: { ...track, title: 'Another title' }, positionSeconds: 15 });
  assert.equal(f.$('source').querySelector('a'), link);
  assert.equal(f.doc.activeElement, link);
  assert.deepEqual(f.calls, []);
  f.emit({ track: { title: 'Licence only', websites: [track.websites[0], track.websites[1]] } });
  assert.equal(f.$('source').hidden, true);
  assert.equal(f.$('source').querySelector('a'), null);
});

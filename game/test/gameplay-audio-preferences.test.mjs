import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGameplayAudioPreferences,
  GAMEPLAY_AUDIO_KEY,
} from '../gameplay-audio-preferences.mjs';
import { createGameplayAudioOutput } from '../ui/gameplay-audio-output.mjs';
import { createGameAudioOutput } from '../ui/audio-output.mjs';
import { mountGameplayAudioControls } from '../ui/gameplay-audio-controls.mjs';
import { attachMenuAudioSettings } from '../ui/menu-audio.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';

const encode = (monoEffects) => JSON.stringify({ format: 'GameplayAudioOutputV1', monoEffects });
function fixture(raw = null) {
  const values = new Map(raw === null ? [] : [[GAMEPLAY_AUDIO_KEY, raw]]),
    writes = [],
    window = new Events();
  let mode = 'working',
    hook = null;
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      writes.push({ key, value });
      if (mode === 'blocked') throw Object.assign(new Error(), { name: 'SecurityError' });
      if (mode === 'full') throw Object.assign(new Error(), { name: 'QuotaExceededError' });
      if (mode === 'silent') return;
      const current = hook;
      hook = null;
      current?.();
      values.set(key, value);
    },
  };
  const options = { window, getStorage: () => storage };
  return {
    values,
    writes,
    window,
    storage,
    options,
    mode: (value) => {
      mode = value;
    },
    hook: (fn) => {
      hook = fn;
    },
  };
}

test('a separate bounded choice loads without writes and leaves legacy audio/profile bytes untouched', (t) => {
  const f = fixture(encode(true)),
    p = createGameplayAudioPreferences(f.options);
  t.after(() => p.dispose());
  f.values.set('revealline.audio-master.v1', '{"muted":true,"volume":0.3}');
  f.values.set('profile', 'original');
  assert.deepEqual(p.snapshot(), { monoEffects: true, durable: true, reason: '', pending: false });
  assert.equal(f.writes.length, 0);
  p.choose(false);
  assert.equal(f.values.get(GAMEPLAY_AUDIO_KEY), encode(false));
  assert.equal(f.values.get('revealline.audio-master.v1'), '{"muted":true,"volume":0.3}');
  assert.equal(f.values.get('profile'), 'original');
  assert.deepEqual(
    f.writes.map(({ key }) => key),
    [GAMEPLAY_AUDIO_KEY],
  );
});

for (const raw of [
  'broken',
  'null',
  '[]',
  '{"format":"GameplayAudioOutputV2","monoEffects":true}',
  '{"format":"GameplayAudioOutputV1","monoEffects":true,"extra":1}',
  ' '.repeat(257),
])
  test(`unreadable/future records stay byte-identical through choice and Retry: ${raw.slice(0, 35)}`, (t) => {
    const f = fixture(raw),
      p = createGameplayAudioPreferences(f.options);
    t.after(() => p.dispose());
    p.choose(true);
    p.retry();
    assert.equal(p.snapshot().monoEffects, true);
    assert.equal(p.snapshot().reason, 'preserved');
    assert.equal(p.snapshot().durable, false);
    assert.equal(f.values.get(GAMEPLAY_AUDIO_KEY), raw);
    assert.equal(f.writes.length, 0);
  });

for (const [mode, reason] of [
  ['blocked', 'blocked'],
  ['full', 'full'],
  ['silent', 'unconfirmed'],
])
  test(`${mode} writes preserve session intent across peer/restore events until verified Retry`, (t) => {
    const f = fixture(),
      p = createGameplayAudioPreferences(f.options);
    t.after(() => p.dispose());
    f.mode(mode);
    p.choose(true);
    assert.deepEqual(p.snapshot(), { monoEffects: true, durable: false, reason, pending: true });
    f.values.set(GAMEPLAY_AUDIO_KEY, encode(false));
    f.window.emit('storage', {
      key: GAMEPLAY_AUDIO_KEY,
      storageArea: f.storage,
      newValue: encode(false),
    });
    f.window.emit('pageshow', { persisted: true });
    assert.equal(p.snapshot().monoEffects, true);
    f.mode('working');
    p.retry();
    assert.deepEqual(p.snapshot(), {
      monoEffects: true,
      durable: true,
      reason: '',
      pending: false,
    });
    assert.equal(f.values.get(GAMEPLAY_AUDIO_KEY), encode(true));
  });

test('same-page peers and accepted current storage events refresh without writes; disposed owners are inert', () => {
  const f = fixture(),
    a = createGameplayAudioPreferences(f.options),
    b = createGameplayAudioPreferences(f.options);
  a.choose(true);
  assert.equal(b.snapshot().monoEffects, true);
  assert.equal(f.writes.length, 1);
  f.window.emit('storage', {
    key: GAMEPLAY_AUDIO_KEY,
    storageArea: f.storage,
    newValue: encode(false),
  });
  assert.equal(b.snapshot().monoEffects, true, 'Reject a stale event whose bytes are not current.');
  f.values.set(GAMEPLAY_AUDIO_KEY, encode(false));
  f.window.emit('storage', { key: GAMEPLAY_AUDIO_KEY, storageArea: {}, newValue: encode(false) });
  assert.equal(b.snapshot().monoEffects, true, 'Reject another storage area.');
  f.window.emit('storage', {
    key: GAMEPLAY_AUDIO_KEY,
    storageArea: f.storage,
    newValue: encode(false),
  });
  assert.equal(a.snapshot().monoEffects, false);
  assert.equal(b.snapshot().monoEffects, false);
  a.dispose();
  b.dispose();
  f.values.set(GAMEPLAY_AUDIO_KEY, encode(true));
  f.window.emit('pageshow', { persisted: true });
  b.choose(true);
  b.retry();
  assert.equal(b.snapshot().monoEffects, false);
  assert.equal(f.writes.length, 1);
});

test('a reentrant newer intent cannot inherit an older write success', () => {
  const f = fixture(),
    p = createGameplayAudioPreferences(f.options);
  f.hook(() => p.choose(false));
  p.choose(true);
  assert.equal(p.snapshot().monoEffects, false);
  assert.equal(p.snapshot().durable, false);
  assert.equal(p.snapshot().reason, 'unconfirmed');
  assert.equal(f.values.get(GAMEPLAY_AUDIO_KEY), encode(true));
  p.retry();
  assert.equal(f.values.get(GAMEPLAY_AUDIO_KEY), encode(false));
  assert.equal(p.snapshot().durable, true);
  p.dispose();
});

test('controls expose scope, live locale, storage recovery and capability independently without starting audio', (t) => {
  const f = fixture(),
    output = createGameplayAudioOutput(f.options),
    doc = new Document();
  const oldLocale = getLocale();
  setLocale('en', { persist: false });
  t.after(() => {
    output.dispose();
    setLocale(oldLocale, { persist: false });
  });
  const panel = doc.createElement('section');
  doc.body.append(panel);
  const stop = attachMenuAudioSettings({ gameplayOutput: output }, doc, { target: panel });
  t.after(stop);
  const duplicate = mountGameplayAudioControls({ output, container: panel, document: doc });
  t.after(duplicate);
  assert.equal(panel.querySelectorAll('input').length, 1);
  const checkbox = panel.querySelector('input'),
    retry = panel.querySelector('button'),
    status = panel.querySelector('[role="status"]');
  assert.equal(status.textContent, '');
  assert.equal(f.writes.length, 0);
  checkbox.focus();
  checkbox.checked = true;
  f.mode('silent');
  checkbox.emit('change');
  assert.equal(output.snapshot().status, 'inactive');
  assert.match(status.textContent, /Applies when game sound starts/);
  assert.match(status.textContent, /Session only/);
  assert.equal(retry.hidden, false);
  setLocale('uk', { persist: false });
  assert.match(panel.textContent, /Моно для ефектів і голосів/);
  assert.match(panel.textContent, /Музика й відео зберігають/);
  assert.equal(doc.activeElement, checkbox);
  assert.equal(f.writes.length, 1);
  f.mode('working');
  retry.focus();
  retry.emit('click');
  assert.equal(doc.activeElement, checkbox);
  assert.equal(retry.hidden, true);
  assert.match(status.textContent, /Збережено/);
  const node = { channelCount: 2, channelCountMode: 'max', channelInterpretation: 'speakers' };
  Object.defineProperty(node, 'channelCountMode', { get: () => 'max', set() {} });
  output.attach({ gameplayBus: node });
  assert.match(status.textContent, /не підтвердив вибране налаштування каналів/);
  assert.equal(
    output.snapshot().durable,
    true,
    'Persistence is not proof of applied channel configuration.',
  );
  const writes = f.writes.length;
  stop();
  duplicate();
  output.dispose();
  checkbox.checked = false;
  checkbox.emit('change');
  assert.equal(f.writes.length, writes);
  assert.equal(panel.querySelectorAll('input').length, 0);
});

test('output choice applies only to attached graphs and survives explicit reattachment without creating contexts', () => {
  const f = fixture(encode(true)),
    owner = createGameplayAudioOutput(f.options);
  assert.equal(owner.snapshot().status, 'inactive');
  const context = {
    destination: {},
    createGain: () => ({ gain: { value: 1 }, connect() {}, disconnect() {} }),
  };
  const first = createGameAudioOutput(context);
  owner.attach(first);
  assert.equal(owner.snapshot().status, 'mono');
  owner.attach(null);
  owner.choose(false);
  assert.equal(owner.snapshot().status, 'inactive');
  const second = createGameAudioOutput(context);
  owner.attach(second);
  assert.equal(owner.snapshot().status, 'original');
  assert.equal(second.gameplayBus.channelCountMode, 'max');
  assert.equal(first.gameplayBus.channelCountMode, 'explicit');
  owner.dispose();
  owner.choose(true);
  assert.equal(second.gameplayBus.channelCountMode, 'max');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioMaster, bindAudioMasterMedia } from '../ui/audio-master.mjs';
import { AUDIO_PREFERENCES_KEY, createAudioPreferences } from '../audio-preferences.mjs';
import { Soundscape } from '../ui/audio.mjs';
import { audioHarness } from './helpers/soundtrack-audio.mjs';

const encode = (muted, volume) => JSON.stringify({ muted, volume });
function fixture({ raw = null, fallback, writable, getStorage, onWarning } = {}) {
  const data = new Map(raw === null ? [] : [[AUDIO_PREFERENCES_KEY, raw]]),
    writes = [],
    warnings = [],
    window = new EventTarget(),
    master = createAudioMaster(),
    storage = {
      getItem(key) {
        assert.equal(this, storage);
        return data.get(key) ?? null;
      },
      setItem(key, value) {
        assert.equal(this, storage);
        writes.push({ key, value, current: master.snapshot() });
        data.set(key, value);
      },
    },
    preferences = createAudioPreferences({
      audioMaster: master,
      getStorage: getStorage ?? (() => storage),
      window,
      fallback,
      writable,
      onWarning: onWarning ?? ((message) => warnings.push(message)),
    });
  return {
    data,
    writes,
    warnings,
    master,
    storage,
    preferences,
    restore(persisted = true) {
      window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted }));
    },
    event(raw, { key = AUDIO_PREFERENCES_KEY, area = storage } = {}) {
      const event = new Event('storage');
      Object.assign(event, { key, storageArea: area, newValue: raw });
      window.dispatchEvent(event);
    },
  };
}
const state = (master) => {
  const { muted, volume } = master.snapshot();
  return { muted, volume };
};

test('valid global preferences override legacy fallback synchronously without writing', () => {
  const f = fixture({ raw: encode(false, 0.3), fallback: { muted: true, volume: 0.9 } });
  assert.deepEqual(state(f.master), { muted: false, volume: 0.3 });
  assert.equal(f.preferences.seed({ muted: true, volume: 1 }), false);
  assert.deepEqual(f.writes, []);
});

for (const raw of [
  'not json',
  'null',
  '[]',
  '{"muted":false}',
  '{"muted":0,"volume":0.5}',
  '{"muted":false,"volume":2}',
  '{"muted":false,"volume":1e999}',
  '{"muted":false,"volume":0.5,"version":2}',
  ' '.repeat(257) + encode(false, 0.3),
])
  test(`invalid stored record retains fallback and original bytes: ${raw.slice(0, 50)}`, () => {
    const f = fixture({ raw });
    assert.deepEqual(state(f.master), { muted: true, volume: 0.65 });
    assert.equal(f.data.get(AUDIO_PREFERENCES_KEY), raw);
    assert.deepEqual(f.writes, []);
  });

test('profile seed stays in memory; an explicit action saves only the two global scalars', () => {
  const f = fixture();
  f.data.set('xonix-player-profile', 'untouched original profile');
  assert.equal(f.preferences.seed({ muted: false, volume: 0.4 }), true);
  assert.deepEqual(f.writes, []);
  f.preferences.setVolume(0.25);
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0].key, 'revealline.audio-master.v1');
  assert.equal(f.writes[0].value, encode(false, 0.25));
  assert.equal(f.writes[0].current.volume, 0.25, 'Authority changes before storage.');
  assert.equal(f.data.get('xonix-player-profile'), 'untouched original profile');
});

test('same-value explicit intent and direct newer authority revisions reject late profile seeds', () => {
  for (const direct of [false, true]) {
    const f = fixture();
    if (direct) f.master.setMuted(true);
    else f.preferences.setMuted(true);
    assert.equal(f.preferences.seed({ muted: false, volume: 1 }), false);
    assert.deepEqual(state(f.master), { muted: true, volume: 0.65 });
  }
});

test('a global record arriving before the profile seed wins even before its storage event', () => {
  const f = fixture();
  f.data.set(AUDIO_PREFERENCES_KEY, encode(false, 0.2));
  assert.equal(f.preferences.seed({ muted: true, volume: 0.8 }), false);
  assert.deepEqual(state(f.master), { muted: false, volume: 0.2 });
  assert.deepEqual(f.writes, []);
});

test('navigation reads saved intent and does not save fallback again', () => {
  const f = fixture();
  f.preferences.setMuted(false);
  f.preferences.setVolume(0.1);
  f.preferences.dispose();
  const next = createAudioMaster();
  createAudioPreferences({ audioMaster: next, getStorage: () => f.storage });
  assert.deepEqual(state(next), { muted: false, volume: 0.1 });
  assert.equal(f.writes.length, 2);
});

test('practice can change session audio without writing, and cannot lose it to a remote event', () => {
  const f = fixture({ raw: encode(true, 0.3), writable: () => false });
  f.preferences.setMuted(false);
  f.preferences.setVolume(0.8);
  f.data.set(AUDIO_PREFERENCES_KEY, encode(true, 0.1));
  f.event(encode(true, 0.1));
  assert.deepEqual(state(f.master), { muted: false, volume: 0.8 });
  assert.deepEqual(f.writes, []);
  assert.match(f.preferences.getWarning(), /only to this session/);
});

test('unavailable storage and a throwing notice leave sound working in memory', () => {
  const f = fixture({
    getStorage: () => {
      throw new Error('Access denied');
    },
    onWarning: () => {
      throw new Error('Notice failed');
    },
  });
  f.preferences.setMuted(false);
  f.preferences.setVolume(0.5);
  assert.deepEqual(state(f.master), { muted: false, volume: 0.5 });
  assert.match(f.preferences.getWarning(), /could not be saved/);
});

test('quota failure protects unsaved intent; a later successful action resumes sharing', () => {
  const f = fixture({ raw: encode(true, 0.3) }),
    save = f.storage.setItem;
  f.storage.setItem = () => {
    throw new Error('Quota exceeded');
  };
  f.preferences.setMuted(false);
  f.event(encode(true, 0.3));
  assert.equal(f.master.snapshot().muted, false);
  assert.match(f.preferences.getWarning(), /could not be saved/);
  f.storage.setItem = save;
  f.preferences.setVolume(0.6);
  assert.equal(f.preferences.getWarning(), '');
  f.data.set(AUDIO_PREFERENCES_KEY, encode(true, 0.2));
  f.event(encode(true, 0.2));
  assert.deepEqual(state(f.master), { muted: true, volume: 0.2 });
});

test('storage events require the exact key, storage area and still-current raw value', () => {
  const f = fixture(),
    old = encode(false, 0.4),
    current = encode(false, 0.2);
  f.data.set(AUDIO_PREFERENCES_KEY, current);
  f.event(current, { key: 'other.audio' });
  f.event(current, { area: {} });
  f.event(old);
  assert.deepEqual(state(f.master), { muted: true, volume: 0.65 });
  f.event(current);
  assert.deepEqual(state(f.master), { muted: false, volume: 0.2 });
  assert.equal(f.preferences.seed({ muted: true, volume: 1 }), false);
  assert.deepEqual(f.writes, []);
});

test('deleted and malformed remote values do not reset live sound or get rewritten', () => {
  const f = fixture({ raw: encode(false, 0.3) });
  f.data.delete(AUDIO_PREFERENCES_KEY);
  f.event(null);
  f.data.set(AUDIO_PREFERENCES_KEY, '{"muted":true,"volume":-1}');
  f.event(f.data.get(AUDIO_PREFERENCES_KEY));
  assert.deepEqual(state(f.master), { muted: false, volume: 0.3 });
  assert.deepEqual(f.writes, []);
});

test('a remote unmute changes the media gate without calling play or changing transport', () => {
  const f = fixture(),
    media = Object.assign(new EventTarget(), {
      muted: false,
      volume: 1,
      paused: true,
      currentTime: 18,
      play() {
        throw new Error('Preferences must not autoplay.');
      },
    }),
    binding = bindAudioMasterMedia({ audioMaster: f.master, element: media, volume: 0.5 });
  f.data.set(AUDIO_PREFERENCES_KEY, encode(false, 0.4));
  f.event(encode(false, 0.4));
  assert.equal(media.muted, false);
  assert.equal(media.volume, 0.2);
  assert.equal(media.paused, true);
  assert.equal(media.currentTime, 18);
  binding.dispose();
});

test('reentrant newer intent during a seed cannot be overwritten by its remaining fields', () => {
  const f = fixture();
  let changed = false;
  const off = f.master.subscribe((snapshot) => {
    if (!changed && snapshot.volume === 0.4) {
      changed = true;
      f.master.setMuted(true);
    }
  });
  assert.equal(f.preferences.seed({ muted: false, volume: 0.4 }), false);
  assert.equal(f.master.snapshot().muted, true);
  assert.deepEqual(f.writes, []);
  off();
});

test('invalid explicit scalars change neither authority nor stored intent', () => {
  const f = fixture(),
    before = f.master.snapshot();
  for (const value of [-1, 2, NaN, Infinity, '0.4'])
    assert.throws(() => f.preferences.setVolume(value), TypeError);
  assert.throws(() => f.preferences.setMuted(1), TypeError);
  assert.equal(f.master.snapshot(), before);
  assert.deepEqual(f.writes, []);
  assert.equal(f.preferences.seed({ muted: false, volume: 0.4 }), true);
});

test('accepted intent still persists if an output subscriber throws after the state change', () => {
  const f = fixture();
  f.master.subscribe((snapshot) => {
    if (!snapshot.muted) throw new Error('Output unavailable');
  });
  assert.throws(() => f.preferences.setMuted(false), AggregateError);
  assert.equal(f.data.get(AUDIO_PREFERENCES_KEY), encode(false, 0.65));
  assert.equal(f.preferences.seed({ muted: true, volume: 1 }), false);
});

test('disposal stops persistence and remote adoption without disposing the shared authority', () => {
  const f = fixture(),
    before = f.master.snapshot();
  f.preferences.dispose();
  f.preferences.dispose();
  f.data.set(AUDIO_PREFERENCES_KEY, encode(false, 0.4));
  f.event(encode(false, 0.4));
  assert.equal(f.master.snapshot(), before);
  assert.equal(f.preferences.seed({ muted: false, volume: 0.4 }), false);
  assert.throws(() => f.preferences.setMuted(false), /disposed/);
  f.master.setMuted(false);
  assert.equal(f.master.snapshot().muted, false);
  assert.deepEqual(f.writes, []);
});

test('persisted pageshow adopts missed audio settings without saving or changing media transport', () => {
  const f = fixture({ fallback: { muted: true, volume: 0.3 } }),
    media = Object.assign(new EventTarget(), {
      muted: true,
      volume: 1,
      paused: true,
      currentTime: 18,
      play() {
        assert.fail('Restoring output preferences must not start playback.');
      },
    }),
    binding = bindAudioMasterMedia({ audioMaster: f.master, element: media, volume: 0.5 }),
    before = f.master.snapshot();
  f.data.set('xonix-player-profile', 'unchanged profile');
  f.data.set(AUDIO_PREFERENCES_KEY, encode(false, 0.4));
  f.restore(false);
  assert.strictEqual(f.master.snapshot(), before);
  f.restore();
  assert.deepEqual(state(f.master), { muted: false, volume: 0.4 });
  assert.equal(media.muted, false);
  assert.equal(media.volume, 0.2);
  assert.equal(media.paused, true);
  assert.equal(media.currentTime, 18);
  const restored = f.master.snapshot();
  f.restore();
  assert.strictEqual(f.master.snapshot(), restored);
  assert.equal(f.preferences.seed({ muted: true, volume: 1 }), false);
  assert.equal(f.data.get('xonix-player-profile'), 'unchanged profile');
  assert.deepEqual(f.writes, []);
  binding.dispose();
});

test('restored audio uses the current storage object and rejects an old queued unmute', () => {
  let current = { getItem: () => encode(false, 0.3) };
  const f = fixture({ getStorage: () => current });
  current = { getItem: () => encode(true, 0.2) };
  f.restore();
  f.event(encode(false, 0.3));
  assert.deepEqual(state(f.master), { muted: true, volume: 0.2 });
  assert.deepEqual(f.writes, []);
});

test('missing, malformed and unavailable latest audio storage do not reset or unmute restored output', () => {
  const f = fixture({ raw: encode(true, 0.3) }),
    before = f.master.snapshot();
  for (const raw of [null, '{}', encode(false, -1), 'x'.repeat(257)]) {
    if (raw === null) f.data.delete(AUDIO_PREFERENCES_KEY);
    else f.data.set(AUDIO_PREFERENCES_KEY, raw);
    f.restore();
    assert.strictEqual(f.master.snapshot(), before);
    assert.equal(f.data.get(AUDIO_PREFERENCES_KEY), raw ?? undefined);
  }
  f.storage.getItem = () => {
    throw new Error('Storage unavailable after restoration');
  };
  f.restore();
  assert.strictEqual(f.master.snapshot(), before);
  assert.deepEqual(f.writes, []);
});

test('restoration protects failed and read-only audio intent until an explicit successful save', () => {
  for (const readOnly of [false, true]) {
    let allowed = !readOnly;
    const f = fixture({ raw: encode(false, 0.3), writable: () => allowed }),
      save = f.storage.setItem;
    if (!readOnly)
      f.storage.setItem = () => {
        throw new Error('Quota exceeded');
      };
    f.preferences.setMuted(true);
    const before = f.master.snapshot(),
      warning = f.preferences.getWarning();
    f.data.set(AUDIO_PREFERENCES_KEY, encode(false, 0.9));
    f.restore();
    assert.strictEqual(f.master.snapshot(), before);
    assert.equal(f.preferences.getWarning(), warning);
    assert.deepEqual(f.writes, []);
    allowed = true;
    f.storage.setItem = save;
    f.preferences.setVolume(0.2);
    f.data.set(AUDIO_PREFERENCES_KEY, encode(false, 0.4));
    f.restore();
    assert.deepEqual(state(f.master), { muted: false, volume: 0.4 });
    assert.equal(f.writes.length, 1);
  }
});

test('a disposed audio owner ignores persisted pageshow without reading storage', () => {
  const f = fixture(),
    before = f.master.snapshot();
  f.preferences.dispose();
  f.storage.getItem = () => assert.fail('Disposed owners must not read storage.');
  f.restore();
  assert.strictEqual(f.master.snapshot(), before);
  assert.deepEqual(f.writes, []);
});

test('new audio intent or disposal during a restoration read rejects its captured unmute', () => {
  for (const dispose of [false, true]) {
    const f = fixture({ raw: encode(true, 0.3) });
    f.storage.getItem = () => {
      if (dispose) f.preferences.dispose();
      else f.preferences.setVolume(0.1);
      return encode(false, 0.8);
    };
    f.restore();
    assert.deepEqual(state(f.master), { muted: true, volume: dispose ? 0.3 : 0.1 });
    assert.equal(f.writes.length, dispose ? 0 : 1);
  }
});

test('new mute intent or disposal while restoring the fader prevents the later unmute', () => {
  for (const dispose of [false, true]) {
    const f = fixture({ raw: encode(true, 0.3) });
    let changed = false;
    f.master.subscribe(({ volume }) => {
      if (changed || volume !== 0.8) return;
      changed = true;
      if (dispose) f.preferences.dispose();
      else f.preferences.setMuted(true);
    });
    f.data.set(AUDIO_PREFERENCES_KEY, encode(false, 0.8));
    f.restore();
    assert.equal(f.master.snapshot().muted, true);
    assert.equal(f.writes.length, dispose ? 0 : 1);
  }
});

test('disposal during an explicit audio notification or permission check prevents late persistence', () => {
  for (const duringPermission of [false, true]) {
    let owner;
    const f = fixture({
      writable() {
        if (duringPermission) owner.dispose();
        return true;
      },
    });
    owner = f.preferences;
    if (!duringPermission)
      f.master.subscribe(({ muted }) => {
        if (!muted) owner.dispose();
      });
    owner.setMuted(false);
    assert.deepEqual(f.writes, []);
  }
});

test('a mute recovered on persisted pageshow wins over late audio activation', async (t) => {
  const f = fixture({ raw: encode(false, 0.5) }),
    h = audioHarness(),
    output = new Soundscape({
      persistentMusic: true,
      audioMaster: f.master,
      contextFactory: () => h.context,
    });
  t.after(() => output.dispose());
  let finishResume;
  const opening = new Promise((resolve) => {
    finishResume = resolve;
  });
  h.context.resume = async () => {
    await opening;
    h.context.state = 'running';
  };
  const enabling = output.enable();
  f.data.set(AUDIO_PREFERENCES_KEY, encode(true, 0.7));
  f.restore();
  finishResume();
  assert.equal(await enabling, true);
  assert.equal(output.enabled, true, 'Playback intent stays independent of the mute gate.');
  assert.equal(output.master.gain.value, 0);
  assert.deepEqual(state(f.master), { muted: true, volume: 0.7 });
  assert.deepEqual(f.writes, []);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  demoSettingsKey,
  loadDemoSettingsKey,
  readDemoSettings,
  readDemoPreferences,
  LEGACY_DEMO_SETTINGS_KEY,
} from '../demo-settings.mjs';
import { attachDemoHost } from '../ui/demo-host.mjs';
import { installDemoEntry } from '../ui/demo-entry.mjs';
import { DEMO_SHELL } from '../ui/demo-shell.mjs';
import {
  DEFAULT_PREFERENCES,
  emptyLibrary,
  updatePreferences,
  LIBRARY_STORAGE_VERSION,
} from '../library.mjs';
import { replaceKeyBinding } from '../key-bindings.mjs';
import { resolveControllerBindings } from '../controller-bindings.mjs';
import { readStoredTouchControls, TOUCH_PREFERENCES_KEY } from '../touch-preferences.mjs';
import { DEFAULT_TOUCH_CONTROLS } from '../touch-controls.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { SoloElement, mount, memoryStorage, settle } from './helpers/solo-dom.mjs';

const saved = { version: 1, auto: false, collect: true, gameSounds: true, hidePictures: true };
const response = (value, ok = true) => ({ ok, text: async () => JSON.stringify(value) });

async function entry(
  t,
  { native = false, storage, channel = 'dev', sharedInput = false, controllerHint } = {},
) {
  const doc = new Document();
  doc.createElement = (tag) => new SoloElement(doc, tag);
  mount(doc, `<body>${DEMO_SHELL}</body>`);
  for (const id of [
    'demo-auto',
    'demo-collect',
    'demo-hide-pictures',
    'demo-clear',
    'demo-settings-status',
    'demo-availability',
  ]) {
    const input = doc.createElement('input');
    input.id = id;
    doc.body.append(input);
  }
  let frameId = 0;
  doc.defaultView.requestAnimationFrame = () => ++frameId;
  doc.defaultView.cancelAnimationFrame = () => {};
  const intents = [];
  const makePlayback = () => {
    let phase = 'paused';
    return {
      state: { status: 'running', tick: 0 },
      get phase() {
        return phase;
      },
      play() {
        phase = 'playing';
      },
      start(intent) {
        intents.push(intent);
        phase = 'playing';
      },
      pause() {
        phase = 'paused';
      },
      advance() {},
      forkForPractice() {
        return {};
      },
      dispose() {
        phase = 'disposed';
      },
    };
  };
  let practiceCount = 0,
    inputContext = null;
  const adapter = {
    modeId: 'snake',
    label: 'Snake Solo',
    enumerateSources: () => [
      {
        id: 'settings-check',
        modeId: 'snake',
        levelId: 'settings-check',
        kind: 'replay',
        create: makePlayback,
      },
    ],
    presentation: () => ({ title: 'Settings check', goal: 'Collect the goal', status: 'Watching' }),
    semanticEvents: () => [],
    createPractice() {
      practiceCount++;
      return makePlayback();
    },
    attachInput: ({ getContext }) => {
      inputContext = getContext;
      return {
        clear() {},
        dispose() {},
        ...(controllerHint ? { controllerHint } : {}),
      };
    },
    mountScene({ parent, document }) {
      const canvas = document.createElement('canvas');
      parent.append(canvas);
      return {
        canvas,
        paint() {},
        dispose() {
          canvas.remove();
        },
      };
    },
  };
  const options = {
    document: doc,
    modeId: native ? 'snake' : 'solo',
    adapters: { snake: adapter },
    storage,
    getContext: () => ({
      ...(!native ? { preferences: DEFAULT_PREFERENCES } : {}),
      library: {},
      entries: [],
      reduced: true,
    }),
    canAutoStart: () => false,
    canOpen: () => true,
    onEnter() {},
    onExit() {},
    clearInput() {},
    menu() {},
    onFreshStart: async () => false,
    readMedia: async () => null,
    canWrite: () => true,
  };
  if (sharedInput) delete adapter.attachInput;
  const host = native
    ? await installDemoEntry(options)
    : attachDemoHost({ ...options, settingsKey: demoSettingsKey({ channel }) });
  t.after(async () => {
    await host.close();
    host.destroy();
  });
  return {
    host,
    doc,
    intents,
    inputContext: () => inputContext?.(),
    get practiceCount() {
      return practiceCount;
    },
    get: (id) => doc.getElementById(id),
  };
}

test('native demo entry reads canonical touch choices and refreshes its read-only snapshot on reopen', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => response(null, false));
  const legacy = { ...DEFAULT_TOUCH_CONTROLS, mode: 'stick' },
    current = { mode: 'dpad', side: 'left', size: 'large', opacity: 0.7 },
    storage = memoryStorage({
      'revealline.library.dev.v1': JSON.stringify(
        updatePreferences(emptyLibrary(), { touchControls: legacy }),
      ),
      [TOUCH_PREFERENCES_KEY]: JSON.stringify(current),
    });
  const page = await entry(t, { native: true, storage });
  await page.host.open();
  assert.deepEqual(page.inputContext().touchSettings, current);
  assert.deepEqual(
    page.inputContext().preferences.touchControls,
    legacy,
    'the library is not migrated',
  );
  await page.host.close();
  storage.map.set(TOUCH_PREFERENCES_KEY, '{invalid}');
  await page.host.open();
  assert.deepEqual(
    page.inputContext().touchSettings,
    legacy,
    'invalid shared state retains the validated legacy fallback',
  );
  assert.deepEqual(storage.writes, []);
});

test('read-only touch admission rejects malformed, oversized and unavailable values without changing caller defaults', () => {
  for (const value of [
    '{bad',
    JSON.stringify({ ...DEFAULT_TOUCH_CONTROLS, mode: 'other' }),
    ' '.repeat(513),
  ]) {
    const storage = memoryStorage({ [TOUCH_PREFERENCES_KEY]: value });
    assert.equal(readStoredTouchControls(storage), null);
    assert.equal(storage.getItem(TOUCH_PREFERENCES_KEY), value);
    assert.deepEqual(storage.writes, []);
  }
  assert.equal(
    readStoredTouchControls({
      getItem() {
        throw Error('denied');
      },
    }),
    null,
  );
});

for (const wrapped of [false, true]) {
  test(`native mixed entry reads saved shared controls without writes (${wrapped ? 'generation' : 'legacy'} profile)`, async (t) => {
    t.mock.method(globalThis, 'fetch', async () => response({ version: '0.151.1' }));
    const bindings = replaceKeyBinding(null, 'up', 'KeyI');
    const pad = resolveControllerBindings();
    pad.flight.buttons.boost = 7;
    const library = updatePreferences(emptyLibrary(), {
      keyboardBindings: bindings,
      controllerBindings: pad,
    });
    const profileKey = 'revealline.library.release-0.151.1.v1';
    const stored = (value) =>
      JSON.stringify(
        wrapped
          ? { format: LIBRARY_STORAGE_VERSION, generation: 'generation-controls', library: value }
          : value,
      );
    const storage = memoryStorage({
      [profileKey]: stored(library),
      'revealline.library.dev.v1': JSON.stringify(emptyLibrary()),
    });
    const page = await entry(t, { native: true, sharedInput: true, storage });
    assert.equal(await page.host.open(), true);
    assert.match(page.get('demo-bound-controls').textContent, /I/);
    assert.equal(
      readDemoPreferences(storage, demoSettingsKey({ channel: 'release-0.151.1' }))
        .controllerBindings.flight.buttons.boost,
      7,
    );
    const canvas = page.doc.activeElement;
    const key = (type, code) =>
      page.doc.defaultView.emit(type, { target: canvas, code, key: code, repeat: false });
    key('keydown', 'ArrowUp');
    key('keyup', 'ArrowUp');
    assert.equal(page.practiceCount, 0, 'replaced default key cannot take over');
    key('keydown', 'KeyI');
    await settle(() => page.practiceCount === 1);
    assert.deepEqual(
      page.intents,
      [{ direction: 'up' }],
      'fresh mapped initiating input is delivered once',
    );
    key('keyup', 'KeyI');
    await page.host.close();
    const changed = updatePreferences(library, {
      keyboardBindings: replaceKeyBinding(bindings, 'up', 'KeyK'),
    });
    storage.map.set(profileKey, stored(changed));
    assert.equal(await page.host.open(), true);
    assert.match(page.get('demo-bound-controls').textContent, /K/);
    assert.deepEqual(
      storage.writes,
      [],
      'watch, takeover and reopen do not migrate or save preferences',
    );
  });
}

test('shared demo control snapshots reject malformed or inaccessible profiles without writes', () => {
  const key = demoSettingsKey();
  for (const raw of ['{bad', JSON.stringify({ preferences: { keyboardBindings: {} } })]) {
    const storage = memoryStorage({ 'revealline.library.dev.v1': raw });
    assert.deepEqual(readDemoPreferences(storage, key), DEFAULT_PREFERENCES);
    assert.deepEqual(storage.writes, []);
  }
  assert.deepEqual(
    readDemoPreferences(
      {
        getItem() {
          throw Error('denied');
        },
      },
      key,
    ),
    DEFAULT_PREFERENCES,
  );
});

test('native device guidance replaces generic pad mappings and updates while paused', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => response(null, false));
  let hint = 'Native controller throttle';
  const page = await entry(t, {
    native: true,
    storage: memoryStorage(),
    controllerHint: () => hint,
  });
  assert.equal(await page.host.open(), true);
  page.host.interrupt();
  page.host.controller({ assigned: { id: 'Controller' } });
  assert.equal(page.get('demo-pad-controls').textContent, hint);
  assert.equal(page.get('demo-pad-controls').hidden, false);
  hint = 'Verified radio channel 3';
  page.host.controller({ assigned: { id: 'Controller' } });
  assert.equal(page.get('demo-pad-controls').textContent, hint);
  hint = null;
  page.host.controller({ assigned: { id: 'Controller' } });
  assert.equal(
    page.get('demo-pad-controls').hidden,
    true,
    'native unavailable mapping never falls back to unrelated Solo bindings',
  );
});

for (const [info, channel] of [
  [null, 'dev'],
  [{ version: '0.145.0' }, 'release-0.145.0'],
]) {
  test(`Solo and native entries share ${channel} settings without writes until an explicit change`, async (t) => {
    const fetched = [];
    t.mock.method(globalThis, 'fetch', async (url) => {
      fetched.push(url.pathname);
      return response(info, info !== null);
    });
    const key = demoSettingsKey({ channel });
    const storage = memoryStorage({
      [key]: JSON.stringify(saved),
      [LEGACY_DEMO_SETTINGS_KEY]: JSON.stringify({ ...saved, auto: true, collect: false }),
    });
    const solo = await entry(t, { storage, channel });
    const native = await entry(t, { native: true, storage });
    for (const page of [solo, native]) {
      assert.equal(page.get('demo-auto').checked, false);
      assert.equal(page.get('demo-collect').checked, true);
      assert.equal(page.get('demo-hide-pictures').checked, true);
    }
    assert.equal(fetched.length, 1);
    assert.ok(fetched[0].endsWith('/game/build-info.json'), 'no manifest or content request');
    assert.equal(await native.host.open(), true);
    native.get('demo-takeover').click();
    await settle(() => native.practiceCount === 1);
    await native.host.close();
    assert.deepEqual(storage.writes, [], 'watching, practice and return never migrate settings');
    native.get('demo-auto-live').checked = true;
    native.get('demo-auto-live').emit('change');
    assert.deepEqual(
      storage.writes.map(([name]) => name),
      [key],
    );
    assert.equal(
      JSON.parse(storage.getItem(key)).collect,
      true,
      'native hidden controls preserve the Solo collection opt-in',
    );
    assert.equal(JSON.parse(storage.getItem(key)).gameSounds, true);
    const reopenedSolo = await entry(t, { storage, channel });
    assert.equal(reopenedSolo.get('demo-auto').checked, true);
    assert.equal(reopenedSolo.get('demo-collect').checked, true);
    assert.equal(
      storage.writes.length,
      1,
      'opening Solo reads the native change without migration',
    );
  });
}

test('native small metadata agrees with Solo edition and release channel isolation', async () => {
  for (const [buildInfo, editionId, channel] of [
    [{ version: '0.145.0' }, undefined, 'release-0.145.0'],
    [{ version: '0.146.0' }, undefined, 'release-0.146.0'],
    [undefined],
    [null],
    ['droneaid',
'edition-droneaid-nl-community.release-0.145.0'],
  ]) {
    assert.equal(
      await loadDemoSettingsKey({
        document: { documentElement: { dataset: { editionId } } },
        fetcher: async () => response(buildInfo, buildInfo !== null),
      }),
      demoSettingsKey({ channel }),
    );
  }
});

test('legacy shared preferences are a read-only fallback, with canonical and malformed documents authoritative', () => {
  const key = demoSettingsKey();
  const legacy = JSON.stringify(saved);
  const storage = memoryStorage({ [LEGACY_DEMO_SETTINGS_KEY]: legacy });
  assert.equal(readDemoSettings(storage, key).collect, true);
  assert.equal(readDemoSettings(storage, key).auto, false);
  assert.deepEqual(storage.writes, []);
  storage.setItem(key, JSON.stringify({ ...saved, auto: true, collect: false }));
  assert.equal(readDemoSettings(storage, key).collect, false);
  assert.equal(readDemoSettings(storage, key).auto, true);
  storage.setItem(key, '{malformed');
  assert.equal(readDemoSettings(storage, key, true).collect, false);
  assert.equal(readDemoSettings(storage, key, true).auto, false);
  assert.equal(storage.getItem(LEGACY_DEMO_SETTINGS_KEY), legacy);
});

test('denied storage uses reduced-motion defaults and explicit changes stay session-only', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => response(null, false));
  let writes = 0;
  const storage = {
    getItem() {
      throw new Error('Storage denied');
    },
    setItem() {
      writes++;
      throw new Error('Storage denied');
    },
  };
  const page = await entry(t, { native: true, storage });
  assert.equal(page.get('demo-auto').checked, false);
  assert.equal(page.get('demo-collect').checked, false);
  assert.equal(writes, 0);
  page.get('demo-auto-live').checked = true;
  page.get('demo-auto-live').emit('change');
  assert.equal(writes, 1);
  assert.equal(page.get('demo-auto').checked, true);
  assert.ok(page.get('demo-settings-status').textContent);
});

test('stalled and oversized metadata cannot hold startup or change the settings channel', async () => {
  let signal;
  assert.equal(
    await loadDemoSettingsKey({
      timeoutMs: 5,
      fetcher: (_url, options) => {
        signal = options.signal;
        return new Promise(() => {});
      },
    }),
    demoSettingsKey(),
  );
  assert.equal(signal.aborted, true);
  assert.equal(
    await loadDemoSettingsKey({
      fetcher: async () => ({
        ok: true,
        headers: { get: () => '16385' },
        text() {
          throw new Error('Must not read oversized body');
        },
      }),
    }),
    demoSettingsKey(),
  );
});

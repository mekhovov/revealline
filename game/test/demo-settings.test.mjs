import test from 'node:test';
import assert from 'node:assert/strict';
import {
  demoSettingsKey,
  loadDemoSettingsKey,
  readDemoSettings,
  LEGACY_DEMO_SETTINGS_KEY,
} from '../demo-settings.mjs';
import { attachDemoHost } from '../ui/demo-host.mjs';
import { installDemoEntry } from '../ui/demo-entry.mjs';
import { DEMO_SHELL } from '../ui/demo-shell.mjs';
import { DEFAULT_PREFERENCES } from '../library.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { SoloElement, mount, memoryStorage, settle } from './helpers/solo-dom.mjs';

const saved = { version: 1, auto: false, collect: true, gameSounds: true, hidePictures: true };
const response = (value, ok = true) => ({ ok, text: async () => JSON.stringify(value) });

async function entry(t, { native = false, storage, channel = 'dev' } = {}) {
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
      start() {
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
  let practiceCount = 0;
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
    attachInput: () => ({ clear() {}, dispose() {} }),
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
      preferences: DEFAULT_PREFERENCES,
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
    get practiceCount() {
      return practiceCount;
    },
    get: (id) => doc.getElementById(id),
  };
}

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

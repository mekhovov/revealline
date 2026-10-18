import test from 'node:test';
import assert from 'node:assert/strict';
import { attachDemoHost } from '../ui/demo-host.mjs';
import { DEMO_SHELL } from '../ui/demo-shell.mjs';
import { DEFAULT_PREFERENCES } from '../library.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { SoloElement, mount, memoryStorage, settle } from './helpers/solo-dom.mjs';

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const flush = async () => {
  for (let n = 0; n < 30; n++) await Promise.resolve();
};

function fixture(t, options = {}) {
  const doc = new Document(),
    storage = memoryStorage(),
    frames = new Map(),
    players = [],
    practices = [],
    surfaces = [];
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
    const node = doc.createElement('input');
    node.id = id;
    doc.body.append(node);
  }
  let now = 0,
    serial = 0,
    audioUpdates = 0,
    inputOptions;
  Object.assign(doc.defaultView, {
    performance: { now: () => now },
    requestAnimationFrame: (callback) => {
      frames.set(++serial, callback);
      return serial;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
  });
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: doc.defaultView });
  const adapter = {
    modeId: 'snake',
    label: 'Native test',
    enumerateSources: () => [
      {
        id: 'native-a',
        modeId: 'snake',
        levelId: 'a',
        variantId: 'standard',
        kind: 'replay',
        create() {
          let phase = 'paused';
          const state = { status: 'running', tick: 0 };
          const player = {
            state,
            get phase() {
              return phase;
            },
            maxAdvanceSeconds: 0.25,
            play() {
              phase = 'playing';
            },
            pause() {
              phase = 'paused';
            },
            advance(dt) {
              if (phase === 'playing') state.tick += dt;
              return { events: [] };
            },
            forkForPractice: () => options.fork?.() ?? { flight: { dispose() {} } },
            dispose() {
              player.disposed = true;
              phase = 'disposed';
            },
          };
          players.push(player);
          return player;
        },
      },
    ],
    presentation: () => ({ title: 'Native level', goal: 'Complete the goal', status: 'Watching' }),
    semanticEvents: () => [],
    attachInput(args) {
      inputOptions = args;
      if (options.genericInput) return undefined;
      return { clear() {}, dispose() {} };
    },
    createPractice(fork) {
      let phase = 'paused';
      const practice = {
        state: { status: 'running', tick: 0 },
        get phase() {
          return phase;
        },
        start(intent) {
          practice.intent = intent;
          phase = 'playing';
        },
        play() {
          phase = 'playing';
        },
        pause() {
          phase = 'paused';
        },
        steer(direction) {
          practice.direction = direction;
        },
        advance(dt) {
          if (phase === 'playing') practice.state.tick += dt;
        },
        dispose() {
          phase = 'disposed';
          return fork.flight?.dispose?.();
        },
      };
      practices.push(practice);
      return practice;
    },
    async mountScene({ parent, document }) {
      const canvas = document.createElement('canvas');
      parent.append(canvas);
      const scene = {
        canvas,
        paint() {
          options.paint?.();
        },
        async dispose() {
          scene.disposed = true;
          await options.disposeScene?.();
          canvas.remove();
        },
      };
      surfaces.push(scene);
      return scene;
    },
  };
  const host = attachDemoHost({
    document: doc,
    modeId: 'snake',
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
    audio: {
      update() {
        audioUpdates++;
        throw new Error('Solo audio must not see native state');
      },
    },
  });
  t.after(async () => {
    await host.close();
    host.destroy();
    if (windowDescriptor) Object.defineProperty(globalThis, 'window', windowDescriptor);
    else delete globalThis.window;
  });
  return {
    host,
    doc,
    players,
    practices,
    surfaces,
    storage,
    get inputs() {
      return inputOptions;
    },
    get audioUpdates() {
      return audioUpdates;
    },
    $(id) {
      return doc.getElementById(id);
    },
    frame(ms = 100) {
      now += ms;
      for (const [id, callback] of [...frames]) {
        if (frames.delete(id)) callback(now);
      }
    },
  };
}

test('native watching advances without Solo effects and practice resumes on its visible surface', async (t) => {
  const page = fixture(t);
  assert.equal(await page.host.open(), true);
  page.frame();
  page.frame();
  page.frame();
  assert.ok(page.players[0].state.tick > 0, 'the shared spectator clock advances native gameplay');
  assert.equal(page.audioUpdates, 0);
  assert.equal(page.doc.activeElement, page.surfaces[0].canvas);
  page.$('demo-takeover').focus();
  page.$('demo-takeover').click();
  await settle(() => page.practices.length === 1);
  assert.equal(page.doc.activeElement, page.surfaces[0].canvas);
  assert.equal(page.doc.activeElement.tabIndex, 0);
  page.$('demo-resume').click();
  page.host.update(0.1);
  assert.equal(page.practices[0].state.tick, 0.1);
  page.host.suspend();
  page.host.update(0.1);
  assert.equal(page.practices[0].state.tick, 0.1);
  page.inputs.onResume({ device: 'keyboard', input: { yaw: 1 } });
  page.host.update(0.1);
  assert.equal(page.practices[0].state.tick, 0.2);
  assert.equal(page.host.practiceArmed, true);
  assert.deepEqual(page.storage.writes, []);
});

test('native readouts use shared playback time when the engine exposes no time field', async (t) => {
  const page = fixture(t);
  await page.host.open();
  assert.equal(page.players[0].state.time, undefined);
  const dialog = page.$('demo-dialog');
  const before = dialog.dataset.demoTick;
  for (let frame = 0; frame < 15; frame++) page.frame(100);
  assert.ok(page.players[0].state.tick > 1);
  assert.notEqual(
    dialog.dataset.demoTick,
    before,
    'Progress is published within the readout cadence.',
  );
  page.host.interrupt();
  const paused = dialog.dataset.demoTick;
  for (let frame = 0; frame < 15; frame++) page.frame(100);
  assert.equal(dialog.dataset.demoTick, paused);
  assert.equal(dialog.dataset.demoPhase, 'paused');
  assert.deepEqual(page.storage.writes, []);
});

test('raw SIM-origin controller samples reach Snake practice through the mounted shared host', async (t) => {
  const page = fixture(t, { genericInput: true });
  assert.equal(await page.host.open(), true);
  const pad = {
    index: 0,
    id: 'Captured standard controller',
    mapping: 'standard',
    connected: true,
    axes: [0.9, 0, 0, 0],
    buttons: Array.from({ length: 24 }, () => ({ pressed: false, value: 0 })),
  };
  const sample = () => page.host.controller({ gamepads: [pad], now: 1000 });
  sample();
  assert.equal(page.practices.length, 0);
  pad.axes[0] = 0.13;
  sample();
  assert.equal(page.practices.length, 0);
  pad.axes[0] = 0.9;
  sample();
  await settle(() => page.practices.length === 1);
  assert.equal(page.practices[0].intent.direction, 'right');
  page.host.update(0.1);
  assert.ok(page.practices[0].state.tick > 0);
  page.host.controller({ gamepads: [], now: 1100 });
  assert.equal(page.host.practiceArmed, false);
  assert.equal(page.practices[0].phase, 'paused');
  assert.deepEqual(page.storage.writes, []);
});

test('a quick close and reopen awaits asynchronous scene disposal', async (t) => {
  const cleanup = deferred();
  let block = true;
  const page = fixture(t, { disposeScene: () => (block ? cleanup.promise : undefined) });
  await page.host.open();
  const closed = page.host.close(),
    reopened = page.host.open();
  await flush();
  assert.equal(page.surfaces.length, 1, 'a second renderer cannot mount before old cleanup');
  block = false;
  cleanup.resolve();
  assert.equal(await closed, undefined, 'The completed barrier retains no prior result history.');
  assert.equal(await reopened, true);
  assert.equal(page.surfaces.length, 2);
  assert.equal(page.players[0].disposed, true);
  assert.equal(page.doc.querySelectorAll('.demo-native-surface').length, 1);
});

test('renderer disposal failure still retires physics and removes the owned surface', async (t) => {
  const page = fixture(t, {
    disposeScene: () => {
      throw new Error('graphics cleanup failure');
    },
  });
  for (let cycle = 0; cycle < 6; cycle++) {
    await page.host.open();
    assert.equal(
      await page.host.close(),
      undefined,
      'Repeated cleanup keeps only completion, not nested success or failure histories.',
    );
    assert.equal(page.players[cycle].disposed, true);
    assert.equal(page.doc.querySelectorAll('.demo-native-surface').length, 0);
  }
});

test('a practice world returned after cancellation is disposed exactly once', async (t) => {
  const fork = deferred();
  let disposed = 0;
  const page = fixture(t, { fork: () => fork.promise });
  await page.host.open();
  page.$('demo-takeover').click();
  await flush();
  const closing = page.host.close();
  fork.resolve({
    flight: {
      dispose() {
        disposed++;
      },
    },
  });
  await closing;
  await flush();
  assert.equal(disposed, 1);
  assert.equal(page.practices.length, 0);
  assert.equal(page.doc.querySelectorAll('.demo-native-surface').length, 0);
});

test('graphics loss retires the native engine and publishes its bounded diagnostic', async (t) => {
  const page = fixture(t, {
    paint() {
      throw Object.assign(new Error('Graphics context lost'), { code: 'demo-mode-unavailable' });
    },
  });
  await page.host.open();
  assert.doesNotThrow(() => page.frame());
  await settle(() => page.$('demo-dialog').dataset.demoPhase === 'unavailable');
  assert.match(
    page.$('demo-dialog').dataset.demoFailure,
    /demo-mode-unavailable: Graphics context lost/,
  );
  assert.equal(page.players[0].disposed, true);
  assert.equal(page.doc.querySelectorAll('.demo-native-surface').length, 0);
  assert.ok(page.host.diagnostics.some((item) => item.event === 'playback-failed'));
  assert.ok(page.host.diagnostics.length <= 128);
});

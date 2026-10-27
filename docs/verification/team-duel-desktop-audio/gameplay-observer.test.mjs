import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto, createHash } from 'node:crypto';
import { installGameplayAudioObserver } from './gameplay-observer.mjs';

const settle = async (check) => {
  const deadline = Date.now() + 5000;
  while (!check()) {
    assert.ok(Date.now() < deadline, 'Owned observer work did not settle.');
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
};
class Events {
  listeners = new Map();
  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
  }
  removeEventListener(type, handler) {
    this.listeners.get(type)?.delete(handler);
  }
  emit(type, event = {}) {
    for (const handler of this.listeners.get(type) ?? []) handler(event);
  }
}
function harness(t, options = {}) {
  const doc = new Events(),
    win = new Events(),
    nodes = [],
    messages = [],
    timers = new Map();
  doc.body = { append: (node) => nodes.push(node) };
  doc.createElement = () => ({ textContent: '' });
  doc.getElementById = (value) => nodes.find((node) => node.id === value);
  win.document = doc;
  win.parent = { postMessage: (...args) => messages.push(args) };
  win.location = { origin: 'http://localhost:9001' };
  win.performance = { now: () => 1234 };
  win.crypto = options.crypto ?? webcrypto;
  let timerId = 0;
  win.setTimeout = (callback) => {
    timers.set(++timerId, callback);
    return timerId;
  };
  win.clearTimeout = (id) => timers.delete(id);
  const decodedInputs = [],
    startCalls = [],
    configureCalls = [],
    deliveries = [];
  class Context {
    state = 'running';
    currentTime = 2;
    decodeAudioData(...args) {
      decodedInputs.push({ receiver: this, args });
      if (options.decode) return options.decode.apply(this, args);
      return Promise.resolve({
        duration: 0.2,
        length: 9600,
        numberOfChannels: 1,
        sampleRate: 48000,
      });
    }
  }
  class Source {
    constructor(context, buffer) {
      this.context = context;
      this.buffer = buffer;
    }
    start(...args) {
      startCalls.push({ receiver: this, args });
      if (options.start) return options.start.apply(this, args);
      return 'native-start-result';
    }
  }
  class Sound {
    context = new Context();
    voices = new Set();
    feedbackDirector = { buffers: new Map() };
    audioMaster = { muted: false, volume: 0.5 };
    enabled = true;
    configure(...args) {
      configureCalls.push({ receiver: this, args });
      return options.configReturn;
    }
    events(...args) {
      deliveries.push({ receiver: this, args });
      return options.events?.apply(this, args);
    }
    dispose(...args) {
      this.disposed = true;
      return options.dispose?.apply(this, args);
    }
  }
  const originals = {
    configure: Sound.prototype.configure,
    events: Sound.prototype.events,
    dispose: Sound.prototype.dispose,
    decode: Context.prototype.decodeAudioData,
    start: Source.prototype.start,
  };
  const api = installGameplayAudioObserver({
    Soundscape: Sound,
    AudioContext: Context,
    AudioBufferSourceNode: Source,
    window: win,
    document: doc,
    metadata: { sourceRevision: 'a'.repeat(40), slots: { failure: { sha256: 'b'.repeat(64) } } },
  });
  t.after(() => api.dispose());
  return {
    api,
    Sound,
    Context,
    Source,
    doc,
    win,
    originals,
    messages,
    timers,
    decodedInputs,
    startCalls,
    configureCalls,
    deliveries,
  };
}

test('installation, snapshots and observer disposal never drive audio, input or game state', (t) => {
  const h = harness(t);
  h.api.snapshot();
  h.win.emit('message', {
    source: h.win.parent,
    origin: h.win.location.origin,
    data: { channel: 'revealline-gameplay-audio-observation.v1', action: 'snapshot' },
  });
  h.api.dispose();
  assert.equal(h.decodedInputs.length, 0);
  assert.equal(h.startCalls.length, 0);
  assert.equal(h.configureCalls.length, 0);
  assert.equal(h.deliveries.length, 0);
  assert.equal(h.Sound.prototype.events, h.originals.events);
  assert.equal(h.Context.prototype.decodeAudioData, h.originals.decode);
  assert.equal(h.Source.prototype.start, h.originals.start);
  assert.equal(h.api.snapshot().lifecycle, 'observer-stopped');
});

test('wrappers preserve exact receivers, argument objects, return values and thrown errors', (t) => {
  const marker = {},
    error = new Error('production failure');
  const h = harness(t, {
    configReturn: marker,
    events() {
      throw error;
    },
    start() {
      throw error;
    },
  });
  const sound = new h.Sound(),
    option = {},
    inputs = [],
    run = {},
    theme = {},
    board = { board: 1 };
  assert.equal(sound.configure(option), marker);
  assert.equal(h.configureCalls[0].receiver, sound);
  assert.equal(h.configureCalls[0].args[0], option);
  assert.throws(
    () => sound.events(inputs, run, theme, board),
    (thrown) => thrown === error,
  );
  assert.equal(h.deliveries[0].receiver, sound);
  assert.deepEqual(h.deliveries[0].args, [inputs, run, theme, board]);
  h.deliveries[0].args.forEach((arg, i) => assert.equal(arg, [inputs, run, theme, board][i]));
  const source = new h.Source(sound.context, {});
  assert.throws(
    () => source.start(4, 2, 1),
    (thrown) => thrown === error,
  );
  assert.equal(h.startCalls[0].receiver, source);
  assert.deepEqual(h.startCalls[0].args, [4, 2, 1]);
  assert.equal(
    h.api.snapshot().starts.length,
    0,
    'A rejected native start is never reported as playback.',
  );
});

test('same-byte custom and fallback playback retain distinct native buffer and board identities', async (t) => {
  let next;
  const h = harness(t, {
    events() {
      const source = new h.Source(this.context, next.buffer);
      this.voices.add({
        name: next.name,
        board: next.board,
        bus: 'sfx',
        feedback: true,
        cueFamily: 'failure',
        source,
      });
      source.start(this.context.currentTime);
    },
  });
  const sound = new h.Sound();
  sound.configure();
  const bytes = Uint8Array.of(1, 2, 3, 4);
  const fallback = await sound.context.decodeAudioData(bytes.buffer.slice(0));
  const custom = await sound.context.decodeAudioData(bytes.buffer.slice(0));
  sound.feedbackDirector.buffers.set('loss', fallback);
  next = { buffer: fallback, name: 'loss', board: 0 };
  sound.events(
    [{ type: 'player.failed', player: 0 }],
    { tick: 40, status: 'running', level: { id: 'actual-level' } },
    {},
    { board: 0, mode: 'versus' },
  );
  next = { buffer: custom, name: 'failure', board: 1 };
  sound.events(
    [{ type: 'player.failed', player: 0 }],
    { tick: 41, status: 'running', level: { id: 'actual-level' } },
    {},
    { board: 1, mode: 'versus' },
  );
  await settle(() => h.api.snapshot().decodes.length === 2);
  const report = h.api.snapshot(),
    first = report.events[0].voices[0],
    second = report.events[1].voices[0];
  assert.equal(first.name, 'loss');
  assert.equal(second.name, 'failure');
  assert.deepEqual(first.fallbackBufferNames, ['loss']);
  assert.deepEqual(second.fallbackBufferNames, []);
  assert.notEqual(first.buffer.id, second.buffer.id);
  assert.deepEqual(
    report.events.map((row) => row.board),
    [0, 1],
  );
  const expected = createHash('sha256').update(bytes).digest('hex');
  assert.equal(report.decodes.find((row) => row.id === first.buffer.id).sha256, expected);
  assert.equal(report.decodes.find((row) => row.id === second.buffer.id).sha256, expected);
  assert.equal(report.starts.length, 2);
  assert.equal(report.starts[1].source, second.source);
  assert.equal(report.starts[1].delivery, report.events[1].id);
});

test('native decode Promise and callbacks pass through unchanged; late readiness starts nothing', async (t) => {
  let resolve;
  const promise = new Promise((yes) => {
    resolve = yes;
  });
  const h = harness(t, {
    decode() {
      return promise;
    },
  });
  const sound = new h.Sound(),
    success = () => {},
    failure = () => {},
    bytes = Uint8Array.of(7, 8).buffer;
  sound.configure();
  assert.equal(sound.context.decodeAudioData(bytes, success, failure), promise);
  assert.equal(h.decodedInputs[0].args[0], bytes);
  assert.equal(h.decodedInputs[0].args[1], success);
  assert.equal(h.decodedInputs[0].args[2], failure);
  assert.equal(h.api.snapshot().decodes.length, 0);
  resolve({ duration: 0.1, length: 4800, numberOfChannels: 1, sampleRate: 48000 });
  await settle(() => h.api.snapshot().decodes.length === 1);
  assert.equal(h.api.snapshot().decodes.length, 1);
  assert.equal(h.startCalls.length, 0);
  assert.equal(h.deliveries.length, 0);
});

test('observer hash failure cannot be mistaken for a native decoder rejection', async (t) => {
  const h = harness(t, {
    crypto: {
      subtle: {
        digest() {
          throw new Error('observer hashing unavailable');
        },
      },
    },
  });
  const context = new h.Context(),
    result = await context.decodeAudioData(Uint8Array.of(9).buffer);
  assert.equal(result.length, 9600);
  await settle(() => h.api.snapshot().events.length === 1);
  assert.deepEqual(
    h.api.snapshot().events.map((row) => row.kind),
    ['observer-hash-error'],
  );
  assert.equal(h.api.snapshot().decodes.length, 0);
});

test('native decoder rejection remains the caller error and never supplies a buffer identity', async (t) => {
  const failure = new Error('native codec rejected');
  const h = harness(t, {
    decode() {
      return Promise.reject(failure);
    },
  });
  await assert.rejects(
    new h.Context().decodeAudioData(Uint8Array.of(9).buffer),
    (error) => error === failure,
  );
  await settle(() => h.api.snapshot().events.length === 1);
  assert.deepEqual(
    h.api.snapshot().events.map((row) => row.kind),
    ['native-decode-rejected'],
  );
  assert.equal(h.api.snapshot().decodes.length, 0);
  assert.equal(h.api.snapshot().starts.length, 0);
});

test('records stay bounded and page lifecycle, pause, mute and disposal are observations only', async (t) => {
  const originalPromise = Promise.resolve('closed');
  const h = harness(t, {
    dispose() {
      this.context.state = 'closed';
      return originalPromise;
    },
  });
  const sound = new h.Sound();
  sound.configure();
  for (let i = 0; i < 260; i++)
    sound.events([{ type: 'cells.claimed' }], { tick: i }, {}, { board: 'team' });
  sound.gameplayPaused = true;
  sound.audioMaster.muted = true;
  h.win.emit('pagehide', { persisted: false });
  let report = h.api.snapshot();
  assert.equal(report.events.length, 240);
  assert.equal(report.dropped.events, 20);
  assert.equal(report.lifecycle, 'pagehide');
  assert.equal(report.owners[0].gameplayPaused, true);
  assert.equal(report.owners[0].master.muted, true);
  assert.equal(sound.context.state, 'running', 'The observer never suspends or closes a context.');
  assert.equal(sound.dispose(), originalPromise);
  await settle(() =>
    h.messages.some(([message]) => message.report.owners[0]?.context?.state === 'closed'),
  );
  report = h.api.snapshot();
  assert.equal(report.owners[0].disposed, true);
  assert.equal(report.owners[0].context.state, 'closed');
  assert.equal(h.startCalls.length, 0);
});

test('foreign messages cannot stop the hook; disposal restores inherited native methods', (t) => {
  const h = harness(t);
  h.win.emit('message', {
    source: {},
    origin: h.win.location.origin,
    data: { channel: 'revealline-gameplay-audio-observation.v1', action: 'stop' },
  });
  h.win.emit('message', {
    source: h.win.parent,
    origin: 'https://elsewhere.test',
    data: { channel: 'revealline-gameplay-audio-observation.v1', action: 'stop' },
  });
  assert.equal(h.api.snapshot().live, true);
  h.api.dispose();
  const inherited = class extends h.Context {};
  const second = installGameplayAudioObserver({
    Soundscape: h.Sound,
    AudioContext: inherited,
    AudioBufferSourceNode: h.Source,
    window: h.win,
    document: h.doc,
  });
  assert.equal(Object.hasOwn(inherited.prototype, 'decodeAudioData'), true);
  second.dispose();
  assert.equal(Object.hasOwn(inherited.prototype, 'decodeAudioData'), false);
  assert.equal(inherited.prototype.decodeAudioData, h.originals.decode);
});

test('pagehide publishes without timers, follows normal handlers, and waits for actual async closure', async (t) => {
  let finish;
  const closing = new Promise((resolve) => {
    finish = resolve;
  });
  const h = harness(t, {
    dispose() {
      this.context.state = 'suspended';
      return closing;
    },
  });
  const sound = new h.Sound();
  sound.configure();
  assert.equal(h.timers.size, 1);
  h.win.emit('message', {
    source: h.win.parent,
    origin: h.win.location.origin,
    data: { channel: 'revealline-gameplay-audio-observation.v1', action: 'snapshot' },
  });
  assert.equal(h.timers.size, 0, 'Explicit publication retires its pending timer.');
  h.win.addEventListener('pagehide', () => sound.dispose());
  h.win.emit('pagehide', { persisted: false });
  let report = h.messages.at(-1)[0].report;
  assert.equal(report.lifecycle, 'pagehide');
  assert.equal(
    report.owners[0].disposed,
    false,
    'Immediate report precedes the ordinary host handler.',
  );
  await Promise.resolve();
  report = h.messages.at(-1)[0].report;
  assert.equal(report.owners[0].disposed, true);
  assert.equal(
    report.owners[0].context.state,
    'suspended',
    'Microtask observation cannot invent async closure.',
  );
  assert.equal(h.timers.size, 0);
  sound.context.state = 'closed';
  finish();
  await settle(() => h.messages.at(-1)[0].report.owners[0].context.state === 'closed');
  assert.equal(h.startCalls.length, 0);
  assert.equal(h.decodedInputs.length, 0);
});

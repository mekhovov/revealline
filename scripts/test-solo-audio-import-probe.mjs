import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import test from 'node:test';
import vm from 'node:vm';
import {
  audioProofOptions,
  installAudioProof,
  readAudioFailureContext,
} from './solo-qualification-audio.mjs';

function harness(options = { importEvents: true }) {
  const calls = [],
    windowListeners = new Map();
  class Media {
    constructor() {
      this.listeners = [];
      this.duration = NaN;
      this.readyState = 0;
      this.networkState = 0;
      this.error = null;
      this.src = '';
      this.currentSrc = '';
    }
    addEventListener(name, listener, capture = false) {
      this.listeners.push({ name, listener, capture });
    }
    removeEventListener(name, listener, capture = false) {
      this.listeners = this.listeners.filter(
        (row) => row.name !== name || row.listener !== listener || row.capture !== capture,
      );
    }
    emit(name) {
      for (const row of [...this.listeners]
        .filter((row) => row.name === name)
        .sort((a, b) => Number(b.capture) - Number(a.capture)))
        row.listener();
    }
    load(...args) {
      calls.push({ owner: this, args });
      this.onLoad?.();
      if (this.failure) throw this.failure;
      return this.result;
    }
    play() {
      throw new Error('The metadata diagnostic must never play media');
    }
  }
  const native = Media.prototype.load;
  const sandbox = {
    window: {
      addEventListener: (name, listener) => windowListeners.set(name, listener),
      removeEventListener: (name, listener) => {
        if (windowListeners.get(name) === listener) windowListeners.delete(name);
      },
    },
    document: { body: { dataset: { flightState: 'briefing' } } },
    HTMLMediaElement: Media,
    URL: { createObjectURL: () => 'blob:import-probe' },
    crypto: webcrypto,
    performance: { now: () => 42 },
    Uint8Array,
  };
  vm.runInNewContext(`(${installAudioProof.toString()})(${JSON.stringify(options)})`, sandbox);
  return { Media, native, calls, sandbox, proof: sandbox.window.soloAudioProof, windowListeners };
}
const json = (value) => JSON.parse(JSON.stringify(value));

test('metadata instrumentation is explicit and limited to an audio proof with streamed-only requirements', () => {
  const flags = ['--audio-proof-import-events'];
  assert.equal(audioProofOptions([], {}, false).importEvents, undefined);
  assert.equal(audioProofOptions(flags, { streamedHashes: ['a'] }, true).importEvents, true);
  for (const [requirements, enabled] of [
    [{}, true],
    [{ streamedHashes: ['a'] }, false],
    [{ recordedHashes: ['a'], streamedHashes: ['b'] }, true],
  ])
    assert.throws(() => audioProofOptions(flags, requirements, enabled));
  const h = harness({});
  assert.equal(h.Media.prototype.load, h.native);
  assert.equal(h.proof.export().importProbe, undefined);
  assert.equal(h.proof.disposeImportProbe, undefined);
  assert.equal(h.windowListeners.size, 0);
  assert.throws(() => harness({ importEvents: 'yes' }));
});

test('native load receiver, arguments, return value, thrown object and normal application listeners survive instrumentation', () => {
  const h = harness(),
    media = new h.Media(),
    result = {};
  const first = {},
    second = {};
  media.result = result;
  assert.equal(media.load(first, second), result);
  assert.equal(h.calls[0].owner, media);
  assert.deepEqual(h.calls[0].args, [first, second]);
  media.failure = new Error('native failure');
  assert.throws(
    () => media.load(second),
    (error) => error === media.failure,
  );
  assert.deepEqual(
    h.proof
      .export()
      .importProbe.records.map((row) => row.event)
      .join(','),
    'load-before,load-after,load-before,load-throw',
  );
  assert.equal(h.calls.length, 2);
  // Even instrumentation-only getter failures cannot hide native behavior.
  Object.defineProperty(media, 'duration', {
    get() {
      throw new Error('observer read');
    },
  });
  assert.throws(
    () => media.load(),
    (error) => error === media.failure,
  );
  assert.equal(h.calls.length, 3);
  assert.equal(h.proof.export().importProbe.observerErrors, 2);
});

test('capture observes original finite and non-finite durations before application cleanup and links the exact blob identity', async () => {
  const h = harness(),
    media = new h.Media();
  media.src = h.sandbox.URL.createObjectURL({
    type: 'audio/mpeg',
    size: 3,
    arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
  });
  let applicationCalls = 0;
  media.addEventListener('loadeddata', () => {
    applicationCalls++;
    media.duration = NaN;
    media.readyState = 0;
  });
  media.onLoad = () => {
    media.currentSrc = media.src;
    media.duration = Infinity;
    media.readyState = 2;
    media.networkState = 1;
    media.emit('loadeddata');
  };
  media.load();
  assert.equal(applicationCalls, 1);
  for (const value of [-Infinity, 0, 60, 721, NaN]) {
    media.duration = value;
    media.emit('durationchange');
  }
  media.error = { code: 4 };
  media.emit('error');
  const records = json(h.proof.export().importProbe.records);
  assert.deepEqual(records[1].duration, { kind: '+Infinity' });
  assert.equal(records[1].readyState, 2);
  assert.equal(records[1].networkState, 1);
  assert.equal(records[1].sourceId, 0);
  assert.deepEqual(records[2].duration, { kind: 'NaN' });
  assert.deepEqual(
    records.slice(3, 8).map((row) => row.duration),
    [
      { kind: '-Infinity' },
      { kind: 'finite', value: 0 },
      { kind: 'finite', value: 60 },
      { kind: 'finite', value: 721 },
      { kind: 'NaN' },
    ],
  );
  assert.equal(records.at(-1).mediaErrorCode, 4);
  for (let i = 0; i < 100 && h.proof.export().sources[0].status !== 'resolved'; i++)
    await new Promise((yes) => setTimeout(yes, 1));
  assert.equal(
    h.proof.export().sources[0].sha256,
    '039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81',
  );
  assert.equal(
    h.proof.export().mediaEvents.length,
    0,
    'Import evidence cannot substitute for playback evidence',
  );
  const boundary = vm.runInNewContext(`(${readAudioFailureContext.toString()})()`, {
    window: h.sandbox.window,
    document: { getElementById: () => null },
  });
  assert.equal(boundary.importProbe.records[1].duration.kind, '+Infinity');
  assert.equal(boundary.importProbe.sources[0].sha256, h.proof.export().sources[0].sha256);
  h.proof.disposeImportProbe();
  assert.equal(
    boundary.importProbe.retainedElements,
    1,
    'The boundary evidence survives later owner cleanup or navigation',
  );
});

test('eight elements and sixty-four records stay bounded without suppressing native loads', () => {
  const h = harness(),
    elements = Array.from({ length: 10 }, () => new h.Media());
  for (const media of elements) media.load();
  for (let i = 0; i < 100; i++) elements[0].emit('durationchange');
  let probe = h.proof.export().importProbe;
  assert.equal(h.calls.length, 10);
  assert.equal(probe.observedElements, 8);
  assert.equal(probe.retainedElements, 8);
  assert.equal(probe.droppedElements, 2);
  assert.equal(probe.records.length, 64);
  assert.equal(probe.droppedRecords, 52);
  elements[0].load();
  assert.equal(h.calls.length, 11);
  probe.records[0].duration.kind = 'altered export';
  assert.equal(h.proof.export().importProbe.records[0].duration.kind, 'NaN');
  assert.equal(h.proof.export().importProbe.droppedRecords, 54);
});

test('page lifetime cleanup releases only owned listeners and preserves later wrappers', () => {
  const h = harness(),
    media = new h.Media();
  let appCalls = 0;
  const application = () => appCalls++;
  media.addEventListener('loadeddata', application);
  media.load();
  const laterWrapper = function () {};
  h.Media.prototype.load = laterWrapper;
  h.windowListeners.get('pagehide')();
  h.proof.disposeImportProbe();
  assert.equal(h.Media.prototype.load, laterWrapper);
  assert.equal(h.windowListeners.size, 0);
  assert.equal(media.listeners.length, 1);
  media.emit('loadeddata');
  assert.equal(appCalls, 1);
  assert.equal(h.proof.export().importProbe.retainedElements, 0);
  assert.equal(h.proof.export().importProbe.disposed, true);
  assert.equal(h.proof.export().importProbe.records.length, 2);
  const owned = harness();
  new owned.Media().load();
  owned.proof.disposeImportProbe();
  assert.equal(owned.Media.prototype.load, owned.native);
});

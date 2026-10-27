import test from 'node:test';
import assert from 'node:assert/strict';
import {
  captureCDPListeners,
  diffCDPListeners,
  installPausedOriginProbe,
} from './shared-demo-listener-probe.mjs';
const event = (extra = {}) => ({
  type: 'keydown',
  useCapture: false,
  passive: false,
  once: false,
  scriptId: '7',
  lineNumber: 20,
  columnNumber: 4,
  ...extra,
});

test('CDP inspection keeps direct owners separate and releases handler/root handles', async () => {
  const calls = [];
  const protocol = {
    async send(method, params) {
      calls.push({ method, params });
      if (method === 'Runtime.evaluate') return { result: { objectId: params.expression } };
      if (method === 'DOM.describeNode') return { node: { backendNodeId: 10 } };
      if (method === 'DOMDebugger.getEventListeners')
        return {
          listeners: [
            event({
              backendNodeId: 10,
              handler: { objectId: 'h1' },
              originalHandler: { objectId: 'h1' },
            }),
            event({ backendNodeId: 11, handler: { objectId: 'h2' } }),
          ],
        };
      return {};
    },
  };
  const result = await captureCDPListeners(protocol, [
    { label: 'document', expression: 'document', node: true },
  ]);
  assert.deepEqual(result, [
    { target: 'document', count: 1, types: { keydown: 1 }, listeners: [event()] },
  ]);
  assert.deepEqual(
    calls
      .filter((call) => call.method === 'Runtime.releaseObject')
      .map((call) => call.params.objectId)
      .sort(),
    ['h1', 'h2'],
  );
  assert.equal(calls.filter((call) => call.method === 'Runtime.releaseObjectGroup').length, 1);
});

test('CDP failure still releases captured handles and does not invent a zero count', async () => {
  const released = [];
  const protocol = {
    async send(method, params) {
      if (method === 'Runtime.evaluate') return { result: { objectId: params.expression } };
      if (method === 'DOMDebugger.getEventListeners') {
        if (params.objectId === 'document') throw new Error('disconnected');
        return { listeners: [event({ handler: { objectId: 'h1' } })] };
      }
      released.push(method);
      return {};
    },
  };
  await assert.rejects(
    captureCDPListeners(protocol, [
      { label: 'window', expression: 'window' },
      { label: 'document', expression: 'document' },
    ]),
    /disconnected/,
  );
  assert.deepEqual(released.sort(), ['Runtime.releaseObject', 'Runtime.releaseObjectGroup']);
});

test('Listener differences preserve multiplicity, options and exact target ownership', () => {
  const first = [{ target: 'window', listeners: [event(), event()] }];
  const reordered = [{ target: 'window', listeners: [event(), event()] }];
  assert.deepEqual(diffCDPListeners(first, reordered), []);
  assert.deepEqual(diffCDPListeners(first, [{ target: 'window', listeners: [event()] }]), [
    { target: 'window', ...event(), count: 1, beforeCount: 2, afterCount: 1, delta: -1 },
  ]);
  const moved = diffCDPListeners(first, [
    { target: 'document', listeners: [event({ useCapture: true }), event()] },
  ]);
  assert.equal(moved.length, 3);
  assert.equal(
    moved.reduce((sum, item) => sum + item.delta, 0),
    0,
  );
});

test('The paused-origin observer keeps the first game across native renderer creation', () => {
  const environment = { document: { body: { dataset: { flightState: 'paused' } } } };
  installPausedOriginProbe(environment);
  class Game {
    constructor(run) {
      this.scene = { scenes: [{ lastPaint: { run } }] };
    }
  }
  environment.Phaser = { Game };
  const run = { tick: 12, status: 'playing', classId: 'fiber', level: { id: 'first' } };
  const first = new environment.Phaser.Game(run);
  environment.sharedDemoPausedOriginProbe.install((value) => ({ hash: String(value.tick) }));
  const before = environment.sharedDemoPausedOriginProbe.read();
  const native = new environment.Phaser.Game({ ...run, tick: 900 });
  assert.ok(first && native);
  assert.deepEqual(environment.sharedDemoPausedOriginProbe.read(), before);
  first.scene.scenes[0].lastPaint.run = { ...run };
  assert.notEqual(environment.sharedDemoPausedOriginProbe.read().id, before.id);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeGeckoContact } from './analyze-fpv-gecko-contact.mjs';
import {
  recordContactBaseline,
  closeContactCapture,
} from '../game/test/helpers/fpv-gecko-profile-lifecycle.mjs';

function fixture() {
  const thread = {
    name: 'GeckoMain',
    stringTable: [
      'step (http://127.0.0.1:8/optional-practice/civilian-fpv/vendor/rapier/rapier.mjs:1:10)[1]',
      'wasm-function[30] (http://127.0.0.1:8/optional-practice/civilian-fpv/vendor/rapier/rapier.mjs line 1 > WebAssembly.instantiate:83077)',
      'serialize',
    ],
    frameTable: { schema: { location: 0 }, data: [[0], [1], [2]] },
    stackTable: {
      schema: { prefix: 0, frame: 1 },
      data: [
        [null, 0],
        [0, 1],
        [null, 2],
      ],
    },
    samples: {
      schema: { time: 0, stack: 1 },
      data: [
        [0, 1],
        [2, 1],
        [3, 2],
        [12, 1],
        [22, 1],
        [25, 1],
      ],
    },
    markers: {
      schema: { startTime: 0, endTime: 1, data: 2 },
      data: [0, 1, 2].map((repeat) => [
        1 + repeat * 10,
        5 + repeat * 10,
        { type: 'UserTiming', entryType: 'measure', name: `contact-replay-${repeat}` },
      ]),
    },
  };
  return {
    meta: { version: 34 },
    processes: [{ pages: [{ url: 'http://127.0.0.1:8/contact.html' }], threads: [thread] }],
  };
}
test('counts only physics stacks inside the three replay windows', () => {
  const result = summarizeGeckoContact(fixture());
  assert.deepEqual(
    result.results.map(({ replaySamples, stepSamples }) => [replaySamples, stepSamples]),
    [
      [2, 1],
      [1, 1],
      [1, 1],
    ],
  );
  assert.deepEqual(result.results[0].topSelf, [
    { functionLocation: 'wasm-function[30]@83077', samples: 1 },
  ]);
});
test('rejects duplicate or foreign content processes', () => {
  const data = fixture();
  data.processes.push(structuredClone(data.processes[0]));
  assert.throws(() => summarizeGeckoContact(data), /one local/);
  data.processes = [data.processes[0]];
  data.processes[0].pages[0].url = 'https://example.com/contact.html';
  assert.throws(() => summarizeGeckoContact(data), /one local/);
});
test('rejects missing, overlapping or repeated replay windows', () => {
  for (const change of [
    (rows) => rows.pop(),
    (rows) => {
      rows[1][0] = 2;
    },
    (rows) => {
      rows[2][2].name = 'contact-replay-1';
    },
  ]) {
    const data = fixture();
    change(data.processes[0].threads[0].markers.data);
    assert.throws(() => summarizeGeckoContact(data), /three disjoint/);
  }
});
test('rejects cycles and invalid frame references rather than hanging or misattributing', () => {
  const data = fixture();
  data.processes[0].threads[0].stackTable.data[0][0] = 1;
  assert.throws(() => summarizeGeckoContact(data), /cyclic/);
  data.processes[0].threads[0].stackTable.data[0] = [null, 99];
  assert.throws(() => summarizeGeckoContact(data), /frame index/);
});
test('does not count unrelated wasm under serialization as physics', () => {
  const data = fixture(),
    thread = data.processes[0].threads[0];
  thread.stringTable[0] = 'serialize';
  assert.throws(() => summarizeGeckoContact(data), /No sampled physics/);
});

test('retains both thrown and mismatched Node baseline failures before browser capture', async () => {
  for (const replay of [
    async () => {
      throw new Error('broken checkpoint');
    },
    async () => ({ matched: false, completedSteps: 1 }),
  ]) {
    const report = {},
      saved = [];
    assert.equal(
      await recordContactBaseline(report, replay, async () => saved.push(structuredClone(report))),
      false,
    );
    assert.equal(saved.length, 1);
    assert.match(saved[0].error, /broken checkpoint|Node replay mismatch/);
    assert.ok(saved[0].completedAt);
  }
});

test('server cleanup continues after browser failure and each outcome is honest', async () => {
  const report = {};
  let serverClosed = false;
  await closeContactCapture(
    report,
    async () => {
      throw new Error('browser close failed');
    },
    async () => {
      serverClosed = true;
    },
  );
  assert.equal(serverClosed, true);
  assert.equal(report.ownedBrowserAndServerClosed, false);
  assert.equal(report.cleanup.browser.closed, false);
  assert.match(report.cleanup.browser.error, /browser close failed/);
  assert.equal(report.cleanup.server.closed, true);
  assert.ok(report.cleanupError);
});

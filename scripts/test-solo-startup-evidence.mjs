import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  analyzeStartupTrace,
  retainStartupTrace,
  startupDeadline,
  summarizeStartupResources,
} from './solo-startup-evidence.mjs';

const resource = (name, transferSize, encodedBodySize, decodedBodySize) => ({
  name,
  transferSize,
  encodedBodySize,
  decodedBodySize,
});
test('startup resource totals preserve transfer versus encoded/decoded bytes and disclose unknown cache hits', () => {
  const value = summarizeStartupResources({
    resources: [
      resource('https://local.test/game/app.mjs?v=1', 400, 100, 200),
      resource('https://local.test/game/lazy.js', 0, 50, 80),
      resource('https://local.test/picture.png', 999, 900, 900),
    ],
  });
  assert.equal(value.scriptResourceCount, 2);
  assert.equal(value.scriptTransferBytes, 400);
  assert.equal(value.scriptEncodedBodyBytes, 150);
  assert.equal(value.scriptDecodedBodyBytes, 280);
  assert.equal(value.zeroTransferScriptResources, 1);
  assert.match(value.scope, /does not independently prove a cache hit/);
  assert.equal(value.status, 'observed');
  assert.equal(
    summarizeStartupResources({ resources: [], resourceBufferFull: 1 }).status,
    'incomplete',
  );
  assert.equal(
    summarizeStartupResources({ resources: [{ name: 'https://local.test/app.mjs' }] }).status,
    'incomplete',
  );
});

test('evaluation attribution keeps inclusive nesting separate from main-thread union and preserves unassigned URLs', () => {
  const trace = {
    traceEvents: [
      { name: 'solo-startup:document', ts: 0, pid: 1, tid: 2 },
      {
        name: 'EvaluateScript',
        ph: 'X',
        ts: 1000,
        dur: 10000,
        pid: 1,
        tid: 2,
        args: { data: { url: 'app.mjs' } },
      },
      { name: 'v8.evaluateModule', ph: 'X', ts: 6000, dur: 10000, pid: 1, tid: 2 },
      { name: 'v8.compile', ph: 'X', ts: 18000, dur: 1000, pid: 1, tid: 9 },
      { name: 'ParseHTML', ph: 'X', ts: 16000, dur: 1000, pid: 1, tid: 2 },
      { name: 'solo-startup:paused-after-start', ts: 20000, pid: 1, tid: 2 },
    ],
  };
  const result = analyzeStartupTrace(trace);
  assert.equal(result.status, 'observed');
  assert.equal(result.documents[0].unionMs, 15);
  assert.equal(
    result.documents[0].rows.reduce((sum, row) => sum + row.inclusiveMs, 0),
    20,
  );
  assert(result.documents[0].rows.some((row) => row.url === null));
  assert.equal(result.documents[0].rows.length, 2);
  assert.equal(
    analyzeStartupTrace({
      traceEvents: trace.traceEvents.filter((entry) => entry.name.startsWith('solo-startup:')),
    }).status,
    'unobserved',
  );
  const compileOnly = trace.traceEvents.map((event) => ({
    ...event,
    name:
      event.name === 'EvaluateScript' || event.name === 'v8.evaluateModule'
        ? 'v8.compileModule'
        : event.name,
  }));
  assert.equal(analyzeStartupTrace({ traceEvents: compileOnly }).status, 'unobserved');
  assert.throws(() => analyzeStartupTrace({ traceEvents: [] }), /anchor/);
});

test('trace stream keeps exact complete bytes, hashes and close ownership', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'solo-startup-'));
  try {
    const bytes = Buffer.from('{"traceEvents":[]}'),
      file = join(directory, 'trace.json'),
      calls = [];
    const cdp = {
      send: async (method) => {
        calls.push(method);
        return { data: bytes.toString('base64'), base64Encoded: true, eof: true };
      },
    };
    const result = await retainStartupTrace(cdp, 'stream', file);
    assert.equal(result.status, 'complete');
    assert.deepEqual(await readFile(file), bytes);
    assert.equal(result.sha256, createHash('sha256').update(bytes).digest('hex'));
    assert.deepEqual(calls, ['IO.read', 'IO.close']);
    const retry = await retainStartupTrace(cdp, 'other', file);
    assert.equal(retry.status, 'partial');
    assert.match(retry.failure, /EEXIST/);
    assert.deepEqual(await readFile(file), bytes);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('capped and failed traces retain partial bytes and can never become complete evidence', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'solo-startup-partial-'));
  try {
    let reads = 0;
    const cdp = {
      send: async (method) => {
        if (method === 'IO.close') return {};
        if (reads++ === 0) return { data: 'abc', eof: false };
        throw new Error('connection closed');
      },
    };
    const failed = await retainStartupTrace(cdp, 'failed', join(directory, 'failed.json'));
    assert.equal(failed.status, 'partial');
    assert.equal(failed.bytes, 3);
    assert.match(failed.failure, /connection closed/);
    const capped = await retainStartupTrace(
      { send: async () => ({ data: 'abcdef', eof: true }) },
      'capped',
      join(directory, 'capped.json'),
      4,
    );
    assert.equal(capped.status, 'partial');
    assert.equal(capped.capped, true);
    assert.equal(capped.bytes, 4);
    assert.equal(await readFile(capped.file, 'utf8'), 'abcd');
    const file = join(directory, 'existing.json');
    await writeFile(file, 'prior');
    await retainStartupTrace(cdp, 'existing', file);
    assert.equal(await readFile(file, 'utf8'), 'prior');
    await assert.rejects(startupDeadline(new Promise(() => {}), 'stuck', 5), /stuck exceeded/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

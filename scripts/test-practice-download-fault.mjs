import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, get, request } from 'node:http';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import {
  attachPracticeDownloadFault,
  validatePracticeDownloadFault,
  PRACTICE_DOWNLOAD_FAULT_MODES,
} from './practice-download-fault.mjs';

const body = Buffer.from('Original unchanged admitted dependency. '.repeat(20));
const pathname =
  '/revealline/practice/civilian-fpv/releases/v0.151.1/site/optional-practice/civilian-fpv/README.md';
const dependency = () => ({
  pathname,
  bytes: body.length,
  sha256: createHash('sha256').update(body).digest('hex'),
});
const plan = (origin = 'http://127.0.0.1:8765', mode = 'idle') => ({
  origin,
  dependency: dependency(),
  body,
  mode,
});
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function fixture(mode, run) {
  const calls = [];
  const delegate = (req, res) => {
    calls.push(req.url);
    res.writeHead(200, { 'Content-Length': body.length });
    res.end(req.method === 'HEAD' ? undefined : body);
  };
  const server = createServer(delegate);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const fault = attachPracticeDownloadFault({ server, ...plan(origin, mode) });
  try {
    await run({ server, origin, fault, calls, delegate });
  } finally {
    fault.close();
    server.closeAllConnections();
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}
async function complete(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = request(url, options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('error', reject);
      res.on('end', () => resolve({ bytes: Buffer.concat(chunks), headers: res.headers }));
    });
    req.on('error', reject);
    req.end();
  });
}
async function firstByte(url) {
  return new Promise((resolve, reject) => {
    const req = get(url, (res) => {
      res.on('error', () => {}); // Deliberate incomplete-response aborts are expected.
      res.once('data', (chunk) => resolve({ req, res, chunk }));
    });
    req.on('error', reject);
  });
}

test('fault validation binds exact bytes, canonical release path, fixed modes and loopback origin', () => {
  for (const mode of Object.keys(PRACTICE_DOWNLOAD_FAULT_MODES))
    assert.equal(validatePracticeDownloadFault(plan(undefined, mode)).mode, mode);
  for (const patch of [
    { mode: 'other' },
    { mode: '__proto__' },
    { origin: 'https://127.0.0.1:8765' },
    { origin: 'http://localhost:8765' },
    { origin: 'http://127.0.0.1:8765/' },
    { origin: 'http://127.0.0.1:8765/?x=1' },
    { origin: 'http://user@127.0.0.1:8765' },
    { body: Buffer.from('different') },
    { body: body.toString() },
    { deadlineMs: 1 },
    { chunkIntervalMs: 1 },
  ])
    assert.throws(() => validatePracticeDownloadFault({ ...plan(), ...patch }));
  for (const patch of [
    { bytes: 0 },
    { bytes: 127 },
    { bytes: 64 * 1024 * 1024 + 1 },
    { bytes: body.length - 1 },
    { sha256: 'a'.repeat(64) },
    { sha256: 'LATEST' },
    { extra: 'no' },
    { pathname: '/outside/README.md' },
    { pathname: pathname.replace('civilian-fpv', 'other') },
    { pathname: pathname + '?x=1' },
    { pathname: pathname + '#hash' },
    { pathname: pathname.replace('README.md', '../README.md') },
    { pathname: pathname.replace('README.md', '%52EADME.md') },
    { pathname: pathname.replace('README.md', '.secret') },
  ])
    assert.throws(() =>
      validatePracticeDownloadFault({ ...plan(), dependency: { ...dependency(), ...patch } }),
    );
  assert.equal(PRACTICE_DOWNLOAD_FAULT_MODES.idle.deadlineMs, 45000);
  assert.equal(PRACTICE_DOWNLOAD_FAULT_MODES['overall-trickle'].chunkIntervalMs, 5000);
  assert.equal(PRACTICE_DOWNLOAD_FAULT_MODES['overall-trickle'].deadlineMs, 325000);
});

test('unarmed, wrong path/method/host and repeat requests delegate; exactly one fault owns a response', async () => {
  await fixture('idle', async ({ origin, fault, calls }) => {
    assert.deepEqual((await complete(origin + pathname)).bytes, body);
    fault.arm();
    assert.throws(() => fault.arm());
    for (const suffix of ['?other=1', '/other'])
      assert.deepEqual((await complete(origin + pathname + suffix)).bytes, body);
    await complete(origin + pathname, { method: 'HEAD' });
    assert.deepEqual(
      (await complete(origin + pathname, { headers: { Host: 'outside.invalid' } })).bytes,
      body,
    );
    const held = await firstByte(origin + pathname);
    assert.deepEqual(held.chunk, body.subarray(0, 1));
    assert.equal(held.res.headers['content-length'], String(body.length));
    assert.equal(held.res.headers['cache-control'], 'no-store');
    assert.deepEqual((await complete(origin + pathname)).bytes, body);
    assert.equal(calls.length, 6);
    assert.equal(fault.snapshot().events.filter((e) => e.kind === 'request-matched').length, 1);
    held.req.destroy();
    await sleep(30);
    const state = fault.snapshot();
    assert(['client-disconnect', 'request-aborted'].includes(state.outcome));
    assert.equal(state.bytesSent, 1);
    assert.equal(state.activeTimers, 0);
    assert.equal(state.delegatedTargetRequests, 2);
    assert(state.events.every((e, i) => i === 0 || e.elapsedMs >= state.events[i - 1].elapsedMs));
  });
});

test('cancel hold cleanup restores only owned listener, closes response and prevents late writes', async () => {
  await fixture('cancel-hold', async ({ origin, fault, server, delegate }) => {
    fault.arm();
    const held = await firstByte(origin + pathname);
    const closed = new Promise((resolve) => held.res.once('close', resolve));
    const receipt = fault.close();
    await closed;
    assert.equal(receipt.outcome, 'observer-cleanup');
    assert.equal(receipt.activeTimers, 0);
    assert.deepEqual(receipt.cleanupErrors, []);
    assert.deepEqual(server.listeners('request'), [delegate]);
    assert.throws(() => fault.arm());
    await sleep(30);
    assert.deepEqual(fault.snapshot(), receipt);
    assert.deepEqual(fault.close(), receipt);
    assert.deepEqual((await complete(origin + pathname)).bytes, body);
  });
});

test(
  'real trickle sends only successive original bytes then cleans its timers',
  { timeout: 8000 },
  async () => {
    await fixture('overall-trickle', async ({ origin, fault }) => {
      fault.arm();
      const held = await firstByte(origin + pathname);
      const second = await new Promise((resolve) => held.res.once('data', resolve));
      assert.deepEqual(Buffer.concat([held.chunk, second]), body.subarray(0, 2));
      const writes = fault.snapshot().events.filter((e) => e.kind === 'body-byte-written');
      assert.equal(writes.length, 2);
      assert(
        writes[1].elapsedMs - writes[0].elapsedMs >= 4900,
        'Uses real timers, no accelerated clock.',
      );
      fault.close();
      assert.equal(fault.snapshot().activeTimers, 0);
    });
  },
);

test('caller mutation cannot change copied pin/body; transport failures remain bounded and recorded', () => {
  const server = new EventEmitter();
  server.address = () => ({ address: '127.0.0.1', port: 8765 });
  const delegate = () => assert.fail('Fault should own this exact request');
  server.on('request', delegate);
  const input = plan();
  input.body = Buffer.from(body);
  const fault = attachPracticeDownloadFault({ server, ...input });
  input.body.fill(0);
  input.dependency.pathname = '/mutated';
  fault.arm();
  const req = Object.assign(new EventEmitter(), {
    method: 'GET',
    url: pathname,
    headers: { host: '127.0.0.1:8765' },
    socket: { localAddress: '127.0.0.1', remoteAddress: '127.0.0.1' },
  });
  const res = Object.assign(new EventEmitter(), {
    writeHead() {},
    flushHeaders() {},
    write(chunk) {
      assert.deepEqual(chunk, body.subarray(0, 1));
      throw new Error('Transport failed');
    },
    destroy() {
      throw new Error('Cleanup failed');
    },
  });
  server.emit('request', req, res);
  assert.equal(fault.snapshot().outcome, 'server-write-failed');
  assert.equal(fault.snapshot().activeTimers, 0);
  assert.deepEqual(fault.snapshot().cleanupErrors, ['Owned response destruction failed.']);
  const foreign = () => {};
  server.on('request', foreign);
  const receipt = fault.close();
  assert(receipt.cleanupErrors.includes('Request handler ownership changed before cleanup.'));
  assert.deepEqual(server.listeners('request'), [foreign, delegate]);
  res.emit('close');
  req.emit('aborted');
  assert.deepEqual(fault.snapshot(), receipt);
});

test('server ownership mismatch or multiple handlers cannot be wrapped', () => {
  const server = new EventEmitter();
  server.address = () => ({ address: '0.0.0.0', port: 8765 });
  server.on('request', () => {});
  assert.throws(() => attachPracticeDownloadFault({ server, ...plan() }));
  server.address = () => ({ address: '127.0.0.1', port: 9999 });
  assert.throws(() => attachPracticeDownloadFault({ server, ...plan() }));
  server.address = () => ({ address: '127.0.0.1', port: 8765 });
  server.on('request', () => {});
  assert.throws(() => attachPracticeDownloadFault({ server, ...plan() }));
});

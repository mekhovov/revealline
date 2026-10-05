// Authored regressions; automated suites remain waived and unrun.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { parse } from 'acorn';
import { prepareRoomBoardPainters } from '../online/room-client-lifecycle.mjs';

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => (resolve = done));
  return { promise, resolve };
};
const settle = async () => {
  for (let turn = 0; turn < 8; turn++) await Promise.resolve();
};
const painter = () => ({
  retired: 0,
  dispose() {
    this.retired++;
  },
});

test('suspension retires both preparing boards without waiting for an image decode', async () => {
  const controller = new AbortController(),
    decoding = deferred(),
    first = painter(),
    second = painter();
  let artworkSignal;
  const pending = prepareRoomBoardPainters(
    async ({ signal, retain }) => {
      artworkSignal = signal;
      retain(first);
      retain(second);
      await decoding.promise;
    },
    { signal: controller.signal },
  );
  await settle();
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(artworkSignal.aborted, true, 'native fetches receive cancellation');
  assert.deepEqual([first.retired, second.retired], [1, 1]);
  decoding.resolve();
  await settle();
  assert.deepEqual([first.retired, second.retired], [1, 1], 'late decode cannot regain ownership');
});

test('preparation deadline retires assets and rejects late construction while a new room succeeds', async () => {
  const oldWait = deferred(),
    old = painter(),
    late = painter(),
    next = painter();
  const previous = prepareRoomBoardPainters(
    async ({ retain }) => {
      retain(old);
      await oldWait.promise;
      retain(late);
    },
    { timeoutMs: 1 },
  );
  await assert.rejects(previous, { code: 'ROOM_ARTWORK_TIMEOUT' });
  const accepted = await prepareRoomBoardPainters(({ retain }) => retain(next));
  assert.deepEqual(accepted, [next]);
  oldWait.resolve();
  await settle();
  assert.deepEqual([old.retired, late.retired, next.retired], [1, 1, 0]);
  accepted.forEach((entry) => entry.dispose());
});

test('partial construction failure aborts sibling work and disposes every owned painter', async () => {
  const first = painter(),
    second = painter();
  let signal;
  await assert.rejects(
    prepareRoomBoardPainters((preparation) => {
      signal = preparation.signal;
      preparation.retain(first);
      preparation.retain(second);
      throw new Error('Invalid native artwork');
    }),
    /Invalid native artwork/,
  );
  assert.equal(signal.aborted, true);
  assert.deepEqual([first.retired, second.retired], [1, 1]);
  let started = false;
  await assert.rejects(
    prepareRoomBoardPainters(
      () => {
        started = true;
      },
      {
        signal: AbortSignal.abort(),
      },
    ),
    { name: 'AbortError' },
  );
  assert.equal(started, false, 'an already retired poll cannot start new asset work');
});

async function roomFunction(name, context) {
  const source = await readFile(new URL('../online/rooms.mjs', import.meta.url), 'utf8'),
    declaration = parse(source, { ecmaVersion: 'latest', sourceType: 'module' }).body.find(
      (node) => node.type === 'FunctionDeclaration' && node.id.name === name,
    );
  assert.ok(declaration);
  return runInNewContext(`(${source.slice(declaration.start, declaration.end)})`, context);
}

test('native room board preparation cancels raw artwork fetches and never mounts stale boards', async () => {
  const owner = {},
    controller = new AbortController(),
    requestSignals = [],
    mounts = [],
    old = painter();
  const context = {
    credentials: owner,
    stopped: false,
    document: {
      hidden: false,
      createElement: () => ({ setAttribute() {} }),
    },
    say: (en) => en,
    prepareRoomBoardPainters,
    lifecycle: { snapshot: () => ({ epoch: 0 }) },
    painters: [old],
    fetch: (url, { signal }) => {
      requestSignals.push(signal);
      return new Promise(() => {});
    },
    roomUI: { boards: (...args) => mounts.push(args) },
  };
  const allocate = await roomFunction('allocateBoards', context);
  const pending = allocate(
    { engine: { kind: 'capture', runs: [{}, {}] } },
    owner,
    0,
    controller.signal,
  );
  await settle();
  assert.equal(requestSignals.length, 2);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.ok(requestSignals.every((signal) => signal.aborted));
  assert.equal(old.retired, 0, 'previous accepted presentation remains owned until replacement');
  assert.equal(mounts.length, 0);
});

test('suspending a room releases the poll slot before the retired request settles', async () => {
  const controller = new AbortController();
  const context = {
    roomUI: { suspend() {} },
    teamPresentation: { reset() {} },
    lifecycle: { suspend() {} },
    polling: { controller },
    previousFrame: 100,
    syncControls() {},
  };
  const suspend = await roomFunction('suspendLocal', context);
  suspend();
  assert.equal(controller.signal.aborted, true);
  assert.equal(context.polling, null, 'foreground recovery can start a fresh poll immediately');
  assert.equal(context.previousFrame, null);
});

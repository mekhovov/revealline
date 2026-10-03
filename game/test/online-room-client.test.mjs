import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { parse } from 'acorn';
import {
  createRoomClientLifecycle,
  roomServiceEndpoint,
  terminalRoomError,
} from '../online/room-client-lifecycle.mjs';

const owner = { seat: 0, token: 'first' };
const input = (direction) => ({ direction, boost: false, support: false });
const snapshot = (status = 'playing', activation = 'a', acknowledged = 0, generation = 1) => ({
  status,
  controlActivation: activation,
  generation,
  seats: [{ acknowledged }, { acknowledged: 0 }],
});
const accept = (client, value) => client.accept(value, client.snapshot().epoch);
const settle = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

test('late action failures preserve the terminal unavailable notice until a new seat is owned', async () => {
  // Execute the real page handler; only its DOM notice boundary is substituted.
  const source = await readFile(new URL('../online/rooms.mjs', import.meta.url), 'utf8');
  const handler = parse(source, { ecmaVersion: 'latest', sourceType: 'module' }).body.find(
    (node) => node.type === 'FunctionDeclaration' && node.id.name === 'connectionError',
  );
  assert.ok(handler);
  const lifecycle = createRoomClientLifecycle({ sendInput() {} });
  lifecycle.own(owner);
  accept(lifecycle, snapshot());
  let notice = '',
    suspensions = 0;
  const context = {
    credentials: owner,
    lifecycle,
    terminalRoomError,
    abandonLocal() {
      lifecycle.abandon();
      notice = 'Room unavailable. Choose another room.';
    },
    suspendLocal() {
      lifecycle.suspend();
      suspensions++;
    },
    notice(value) {
      notice = value;
    },
    say: (en) => en,
  };
  const fail = runInNewContext(`(${source.slice(handler.start, handler.end)})`, context);
  fail({ code: 'SEAT_UNAVAILABLE', message: 'Expired seat.' }, owner);
  const finalNotice = notice;
  fail(new Error('Late Ready request timed out.'), owner);
  fail(new Error('Late rematch request failed.'), owner);
  assert.equal(notice, finalNotice);
  assert.equal(suspensions, 0);
  const next = { seat: 1, token: 'new-seat' };
  context.credentials = next;
  lifecycle.own(next);
  accept(lifecycle, snapshot());
  fail(new Error('Old room response.'), owner);
  assert.equal(notice, finalNotice);
  fail(new Error('Current connection interrupted.'), next);
  assert.equal(suspensions, 1);
  assert.match(notice, /Reconnecting/);
});

test('native localhost and unapproved origins never acquire a development room endpoint', () => {
  assert.equal(roomServiceEndpoint(new URL('capacitor://localhost/game/online/')), null);
  assert.equal(
    roomServiceEndpoint(new URL('revealline://app/game/online/'), 'https://rooms.example'),
    null,
  );
  assert.equal(
    roomServiceEndpoint(new URL('http://localhost:8779/game/online/')),
    'http://127.0.0.1:8783',
  );
  const hosted = new URL('https://game.example/game/online/');
  assert.equal(roomServiceEndpoint(hosted), null);
  assert.equal(roomServiceEndpoint(hosted, 'http://127.0.0.1:8783'), null);
  assert.equal(roomServiceEndpoint(hosted, 'https://user:password@rooms.example'), null);
  assert.equal(roomServiceEndpoint(hosted, 'https://rooms.example/path'), null);
  assert.equal(roomServiceEndpoint(hosted, 'https://rooms.example'), 'https://rooms.example');
});

test('restored seats and connection recovery need shared Pause then fresh readiness', () => {
  const client = createRoomClientLifecycle({ sendInput() {} });
  client.own(owner, { restoring: true });
  assert.equal(accept(client, snapshot()), false);
  assert.equal(client.submit(input('up')), false);
  const token = client.snapshot().epoch;
  client.suspend();
  assert.equal(client.pauseAcknowledged(token), false);
  assert.equal(client.pauseAcknowledged(client.snapshot().epoch), true);
  assert.equal(accept(client, snapshot('paused', 'b')), true);
  assert.equal(client.canPlay(), false);
  assert.equal(client.submit(input('up')), false);
  assert.equal(accept(client, snapshot('playing', 'c')), true);
  assert.equal(client.canPlay(), true);
});

test('pause retires queued turns and aborts in-flight input without leaking into a new activation', async () => {
  const calls = [],
    first = deferred();
  const client = createRoomClientLifecycle({
    sendInput: (body, seat, signal) => {
      calls.push({ body, seat, signal });
      return calls.length === 1 ? first.promise : Promise.resolve();
    },
  });
  client.own(owner);
  accept(client, snapshot());
  client.submit(input('up'));
  client.submit(input('left'));
  await settle();
  assert.equal(calls.length, 1);
  client.suspend();
  assert.equal(calls[0].signal.aborted, true);
  assert.equal(client.snapshot().pending, 0);
  first.resolve();
  await settle();
  assert.equal(calls.length, 1);
  client.pauseAcknowledged(client.snapshot().epoch);
  accept(client, snapshot('paused', 'b', 1));
  accept(client, snapshot('playing', 'c', 1));
  client.submit(input('right'));
  await settle();
  assert.deepEqual(
    calls.map(({ body }) => [body.sequence, body.activation, body.direction]),
    [
      [1, 'a', 'up'],
      [2, 'c', 'right'],
    ],
  );
});

test('queue pressure has a hard bound and pauses rather than dropping a held-button release', async () => {
  const first = deferred(),
    errors = [];
  const client = createRoomClientLifecycle({
    sendInput: () => first.promise,
    onError: (error) => errors.push(error),
  });
  client.own(owner);
  accept(client, snapshot());
  assert.equal(client.submit({ direction: 'up', boost: true, support: true }), true);
  await settle();
  for (let i = 0; i < 7; i++) assert.equal(client.submit(input('up')), true);
  assert.equal(client.snapshot().pending, 8);
  assert.equal(client.submit({ direction: null, boost: false, support: false }), false);
  assert.equal(client.snapshot().pending, 0);
  assert.equal(client.canPlay(), false);
  assert.equal(errors[0].code, 'INPUT_BACKLOG');
  first.resolve();
  await settle();
});

test('timed-out accepted controls preserve server acknowledgement while obsolete responses cannot affect a new seat', async () => {
  const first = deferred(),
    calls = [],
    errors = [];
  const client = createRoomClientLifecycle({
    sendInput: (body, seat) => {
      calls.push({ body, seat });
      return calls.length === 1 ? first.promise : Promise.resolve();
    },
    onError: (error) => errors.push(error),
  });
  client.own(owner);
  accept(client, snapshot());
  client.submit(input('up'));
  await settle();
  first.reject(new Error('lost response'));
  await settle();
  assert.equal(client.snapshot().phase, 'recovering');
  client.pauseAcknowledged(client.snapshot().epoch);
  accept(client, snapshot('paused', 'b', 1));
  accept(client, snapshot('playing', 'c', 1));
  client.submit(input('left'));
  await settle();
  assert.equal(calls[1].body.sequence, 2);
  const oldEpoch = client.snapshot().epoch;
  client.release();
  const second = { seat: 1, token: 'second' };
  client.own(second);
  assert.equal(client.accept(snapshot('playing', 'c'), oldEpoch), false);
  accept(client, snapshot('playing', 'd'));
  client.submit(input('right'));
  await settle();
  assert.equal(calls[2].seat, second);
  assert.equal(calls[2].body.sequence, 1);
  assert.equal(errors.length, 1);
});

test('abandoned seats cannot reconnect implicitly and finished snapshots never enable input', () => {
  const client = createRoomClientLifecycle({ sendInput() {} });
  client.own(owner);
  accept(client, snapshot());
  client.abandon();
  assert.equal(accept(client, snapshot()), false);
  assert.equal(client.submit(input('up')), false);
  assert.equal(terminalRoomError({ code: 'SEAT_UNAVAILABLE' }), true);
  assert.equal(terminalRoomError({ code: 'STALE_ACTIVATION' }), false);
  client.release();
  client.own(owner);
  accept(client, snapshot('finished'));
  assert.equal(client.canPlay(), false);
  assert.equal(client.snapshot().phase, 'connected');
});

test('an old seat response cannot suspend or submit controls for a newly joined seat', async () => {
  const old = deferred(),
    calls = [],
    errors = [];
  const client = createRoomClientLifecycle({
    sendInput(body, seat) {
      calls.push({ body, seat });
      return calls.length === 1 ? old.promise : Promise.resolve();
    },
    onError: (error) => errors.push(error),
  });
  client.own(owner);
  accept(client, snapshot());
  client.submit(input('up'));
  client.submit(input('left'));
  await settle();
  client.release();
  const second = { seat: 1, token: 'second' };
  client.own(second);
  accept(client, snapshot('playing', 'new-room'));
  client.submit(input('right'));
  await settle();
  old.reject(new Error('Old seat request failed after leaving.'));
  await settle();
  assert.equal(client.canPlay(), true);
  assert.deepEqual(errors, []);
  assert.deepEqual(
    calls.map(({ body, seat }) => [seat.token, body.direction]),
    [
      ['first', 'up'],
      ['second', 'right'],
    ],
  );
});

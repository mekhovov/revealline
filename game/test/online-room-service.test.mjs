import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { ROOM_CONTROL_PROTOCOL } from '../online/room-client-lifecycle.mjs';
import { restoreTrustedRoomSnapshot } from '../online/room-core.mjs';

import { fixture, origin } from './helpers/room-service-http-fixture.mjs';

test('delayed HTTP input and Ready bodies cannot cross pause/resume activation boundaries', async (t) => {
  const h = await fixture(t);
  const live = await h.start();
  assert.equal(live.controlProtocol, ROOM_CONTROL_PROTOCOL);
  assert.equal(restoreTrustedRoomSnapshot(live).controlActivation, live.controlActivation);
  const input = JSON.stringify({
    sequence: 1,
    generation: live.generation,
    activation: live.controlActivation,
    direction: 'up',
    boost: false,
    support: false,
  });
  let complete;
  const response = new Promise((resolve, reject) => {
    const pending = request(
      `${h.url}/input`,
      {
        method: 'POST',
        headers: {
          Origin: origin,
          Authorization: `Bearer ${h.host.token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(input),
        },
      },
      (result) => {
        let data = '';
        result.on('data', (chunk) => {
          data += chunk;
        });
        result.on('end', () => resolve({ status: result.statusCode, body: JSON.parse(data) }));
      },
    );
    pending.on('error', reject);
    pending.write(input.slice(0, -1));
    complete = () => pending.end(input.slice(-1));
  });
  assert.equal((await h.api('/pause', h.host, { activation: live.controlActivation })).status, 200);
  const paused = await h.snap();
  assert.notEqual(paused.controlActivation, live.controlActivation);
  assert.equal(
    (await h.api('/ready', h.host, { activation: live.controlActivation })).body.code,
    'STALE_ACTIVATION',
  );
  const resumed = await h.start();
  assert.notEqual(resumed.controlActivation, paused.controlActivation);
  complete();
  assert.deepEqual(await response, {
    status: 409,
    body: {
      code: 'STALE_ACTIVATION',
      error: 'Refresh the room before sending new controls.',
    },
  });
  const current = await h.snap();
  assert.equal(current.seats[0].acknowledged, 0);
  assert.deepEqual(current.queue, []);
});

test('restoring a waiting room cancels prior Ready and requires both seats again', async (t) => {
  const h = await fixture(t);
  const waiting = await h.snap();
  await h.api('/ready', h.host, { activation: waiting.controlActivation });
  await h.api('/pause', h.host, { activation: waiting.controlActivation });
  const recovered = await h.snap();
  assert.equal(recovered.status, 'waiting');
  assert.deepEqual(
    recovered.seats.map((seat) => seat.ready),
    [false, false],
  );
  await h.api('/ready', h.guest, { activation: recovered.controlActivation });
  assert.equal((await h.snap()).status, 'waiting');
  await h.api('/ready', h.host, { activation: recovered.controlActivation });
  assert.equal((await h.snap()).status, 'playing');
});

test('missing seat credentials have a terminal code instead of an ambiguous reconnect response', async (t) => {
  const h = await fixture(t);
  const result = await h.api('/snapshot', { token: 'f'.repeat(64) });
  assert.equal(result.status, 401);
  assert.equal(result.body.code, 'SEAT_UNAVAILABLE');
  assert.equal(typeof result.body.error, 'string');
});

test('service-stall pause rotates input ownership before readiness can resume', async (t) => {
  const h = await fixture(t);
  const playing = await h.start();
  h.advance(300);
  // The service timer is the transport owner; wait for its observed pause.
  let paused;
  for (let attempt = 0; attempt < 100; attempt++) {
    paused = await h.snap();
    if (paused.status === 'paused') break;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.equal(paused.status, 'paused');
  assert.notEqual(paused.controlActivation, playing.controlActivation);
  assert.equal(
    (await h.api('/ready', h.host, { activation: playing.controlActivation })).body.code,
    'STALE_ACTIVATION',
  );
});

test('a heartbeat after the reconnect deadline cannot revive a room during a service stall', async (t) => {
  const h = await fixture(t);
  await h.start();
  h.advance(60001, { runTimer: false });
  const expired = await h.api('/snapshot', h.host);
  assert.equal(expired.status, 410);
  assert.equal(expired.body.code, 'ROOM_UNAVAILABLE');
  const otherSeat = await h.api('/snapshot', h.guest);
  assert.equal(otherSeat.status, 410);
  assert.equal(otherSeat.body.code, 'ROOM_UNAVAILABLE');
});

test('a disconnected waiting seat loses earlier Ready even without a simulation step', async (t) => {
  const h = await fixture(t);
  const waiting = await h.snap();
  await h.api('/ready', h.host, { activation: waiting.controlActivation });
  h.advance(5001);
  const recovered = await h.snap();
  assert.equal(recovered.status, 'waiting');
  assert.notEqual(recovered.controlActivation, waiting.controlActivation);
  assert.deepEqual(
    recovered.seats.map((seat) => seat.ready),
    [false, false],
  );
  await h.api('/snapshot', h.guest);
  assert.equal(
    (await h.api('/ready', h.guest, { activation: recovered.controlActivation })).status,
    200,
  );
  assert.equal((await h.snap()).status, 'waiting');
  await h.api('/ready', h.host, { activation: recovered.controlActivation });
  assert.equal((await h.snap()).status, 'playing');
});

test('a slow action body cannot act on a room after its reconnect deadline', async (t) => {
  const h = await fixture(t);
  const playing = await h.start();
  const pending = await h.hold('/pause', h.host, { activation: playing.controlActivation });
  h.advance(60001, { runTimer: false });
  pending.finish();
  const expired = await pending.response;
  assert.equal(expired.status, 410);
  assert.equal(expired.body.code, 'ROOM_UNAVAILABLE');
  assert.equal((await h.api('/snapshot', h.guest)).body.code, 'ROOM_UNAVAILABLE');
});

test('recovery within sixty seconds needs both Ready choices without advancing the paused match', async (t) => {
  const h = await fixture(t);
  const playing = await h.start();
  h.advance(59000);
  const recovered = await h.snap();
  assert.equal(recovered.status, 'paused');
  assert.equal(recovered.tick, playing.tick);
  assert.equal(recovered.activeMs, playing.activeMs);
  assert.deepEqual(recovered.queue, []);
  assert.deepEqual(
    recovered.seats.map((seat) => seat.ready),
    [false, false],
  );
  await h.api('/snapshot', h.guest);
  assert.equal(
    (await h.api('/ready', h.host, { activation: recovered.controlActivation })).status,
    200,
  );
  assert.equal((await h.snap()).status, 'paused');
  assert.equal(
    (await h.api('/ready', h.guest, { activation: recovered.controlActivation })).status,
    200,
  );
  const resumed = await h.snap();
  assert.equal(resumed.status, 'playing');
  assert.notEqual(resumed.controlActivation, recovered.controlActivation);
  assert.equal(resumed.activeMs, playing.activeMs);
  assert.equal(
    (
      await h.api('/input', h.host, {
        sequence: 1,
        generation: playing.generation,
        activation: playing.controlActivation,
        direction: 'up',
        boost: false,
        support: false,
      })
    ).body.code,
    'STALE_ACTIVATION',
  );
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { once } from 'node:events';
import { createRoomService } from '../../services/rooms/server.mjs';
import { CLASSIC_SNAKE_LEVELS } from '../snake/classic-catalogue.mjs';
import { ROOM_CONTROL_PROTOCOL } from '../online/room-client-lifecycle.mjs';
import { restoreTrustedRoomSnapshot } from '../online/room-core.mjs';

const origin = 'http://127.0.0.1:8779';
async function fixture(t) {
  let clock = 0;
  const server = await createRoomService({
    now: () => clock,
    catalogue: [
      {
        ...CLASSIC_SNAKE_LEVELS[0],
        family: 'snake',
        mode: 'versus',
        id: 'test-snake',
      },
    ],
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}`;
  t.after(
    () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  );
  const api = async (path, seat = null, body = undefined) => {
    const response = await fetch(`${url}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Origin: origin,
        ...(seat ? { Authorization: `Bearer ${seat.token}` } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  };
  const host = (await api('/rooms', null, { id: 'test-snake' })).body;
  const guest = (await api('/join', null, { invite: host.invite })).body;
  const snap = async () => (await api('/snapshot', host)).body;
  const start = async () => {
    const activation = (await snap()).controlActivation;
    assert.equal((await api('/ready', host, { activation })).status, 200);
    assert.equal((await api('/ready', guest, { activation })).status, 200);
    return snap();
  };
  return {
    api,
    host,
    guest,
    snap,
    start,
    url,
    advance: (ms) => {
      clock += ms;
    },
  };
}

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

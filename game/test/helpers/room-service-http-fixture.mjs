import { request, createServer } from 'node:http';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { createRoomService } from '../../../services/rooms/server.mjs';
import { CLASSIC_SNAKE_LEVELS } from '../../snake/classic-catalogue.mjs';

/** Real loopback relay. Faults change HTTP delivery only; they never access a
 * room, accepted recipe, native engine or result. The test controls when a
 * held response is released, not its contents. */
async function faultProxy(upstream) {
  const pending = [],
    held = new Set();
  const server = createServer(async (incoming, outgoing) => {
    try {
      const chunks = [];
      for await (const chunk of incoming) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      const index = pending.findIndex((fault) => fault.path === incoming.url);
      const fault = index < 0 ? null : pending.splice(index, 1)[0];
      const forward = async () => {
        const response = await fetch(`${upstream}${incoming.url}`, {
          method: incoming.method,
          headers: {
            Origin: incoming.headers.origin,
            ...(incoming.headers.authorization
              ? { Authorization: incoming.headers.authorization }
              : {}),
            ...(body.length ? { 'Content-Type': 'application/json' } : {}),
          },
          ...(body.length ? { body } : {}),
        });
        return { status: response.status, body: await response.json() };
      };
      const first = await forward();
      if (fault?.mode === 'duplicate') {
        const duplicate = await forward();
        fault.observe({ first, duplicate });
      } else if (fault?.mode === 'drop-response') {
        fault.observe(first);
        outgoing.destroy();
        return;
      } else if (fault?.mode === 'hold-response') {
        fault.observe(first);
        await fault.released;
      }
      outgoing.writeHead(first.status, { 'Content-Type': 'application/json' });
      outgoing.end(JSON.stringify(first.body));
    } catch (error) {
      outgoing.destroy(error);
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return {
    server,
    url: `http://127.0.0.1:${server.address().port}`,
    next(path, mode) {
      assert.ok(['duplicate', 'drop-response', 'hold-response'].includes(mode));
      let observe, release;
      const observed = new Promise((resolve) => {
        observe = resolve;
      });
      const released = new Promise((resolve) => {
        release = resolve;
      });
      held.add(release);
      pending.push({ path, mode, observe, released });
      return { observed, release };
    },
    releaseAll() {
      for (const release of held) release();
      held.clear();
    },
  };
}

export const origin = 'http://127.0.0.1:8779';
export async function fixture(t, { entry = null, selection = {}, proxy = false } = {}) {
  let clock = 0;
  // Keep real HTTP delivery while choosing precisely when the service's timer
  // wakes. This covers requests that beat maintenance after a clock jump.
  t.mock.timers.enable({ apis: ['setInterval'] });
  const server = await createRoomService({
    now: () => clock,
    catalogue: [
      entry ?? {
        ...CLASSIC_SNAKE_LEVELS[0],
        family: 'snake',
        mode: 'versus',
        id: 'test-snake',
      },
    ],
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const nativeUrl = `http://127.0.0.1:${server.address().port}`;
  const transport = proxy ? await faultProxy(nativeUrl) : null;
  const url = transport?.url ?? nativeUrl;
  t.after(() =>
    Promise.all(
      [server, transport?.server].filter(Boolean).map(
        (owned) =>
          new Promise((resolve) => {
            transport?.releaseAll();
            owned.closeAllConnections();
            owned.close(resolve);
          }),
      ),
    ),
  );
  const api = async (path, seat = null, body = undefined, { signal } = {}) => {
    const response = await fetch(`${url}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Origin: origin,
        ...(seat ? { Authorization: `Bearer ${seat.token}` } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal,
    });
    return { status: response.status, body: await response.json() };
  };
  const host = (await api('/rooms', null, { id: entry?.id ?? 'test-snake', ...selection })).body;
  const guest = (await api('/join', null, { invite: host.invite })).body;
  const snap = async () => (await api('/snapshot', host)).body;
  const start = async () => {
    const activation = (await snap()).controlActivation;
    assert.equal((await api('/ready', host, { activation })).status, 200);
    assert.equal((await api('/ready', guest, { activation })).status, 200);
    return snap();
  };
  const hold = async (path, seat, body) => {
    const text = JSON.stringify(body);
    const received = once(server, 'request');
    let pending;
    const response = new Promise((resolve, reject) => {
      pending = request(
        `${nativeUrl}${path}`,
        {
          method: 'POST',
          headers: {
            Origin: origin,
            Authorization: `Bearer ${seat.token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(text),
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
      pending.write(text.slice(0, -1));
    });
    // Keep cleanup failures handled if an earlier assertion retires the socket
    // before the caller reaches its awaited response.
    void response.catch(() => {});
    t.after(() => pending.destroy());
    await received;
    return { response, finish: () => pending.end(text.slice(-1)) };
  };
  return {
    api,
    faults: transport,
    host,
    guest,
    snap,
    start,
    hold,
    url,
    advance: (ms, { runTimer = true } = {}) => {
      clock += ms;
      if (runTimer) t.mock.timers.tick(4);
    },
  };
}

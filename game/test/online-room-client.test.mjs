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
import {
  readRoomInvitation,
  roomInvitationLink,
  roomRecipeSHA256,
  assertRoomRecipeBinding,
} from '../online/room-content.mjs';
import { ROOM_CONTROL_PROTOCOL } from '../online/room-client-lifecycle.mjs';
import {
  ROOM_PROTOCOL,
  createAuthoritativeRoom,
  snapshotAuthoritativeRoom,
  restoreTrustedRoomSnapshot,
} from '../online/room-core.mjs';
import { canonicalJSON } from '../data-json.mjs';
import { CLASSIC_SNAKE_LEVELS } from '../snake/classic-catalogue.mjs';
import { reconcileRoomPresentationRuns } from '../online/room-events.mjs';

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

async function roomPageFunctions(names, context) {
  const source = await readFile(new URL('../online/rooms.mjs', import.meta.url), 'utf8'),
    ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const functions = names.map((name) => {
    const node = ast.body.find(
      (entry) => entry.type === 'FunctionDeclaration' && entry.id.name === name,
    );
    assert.ok(node, `Actual room page function ${name} exists.`);
    return source.slice(node.start, node.end);
  });
  return runInNewContext(
    `(function(){${functions.join('\n')}\nreturn {${names.join(',')}};})()`,
    context,
  );
}

async function acceptedRoomFixture() {
  const accepted = {
      family: 'snake',
      mode: 'versus',
      seed: 17,
      level: structuredClone(CLASSIC_SNAKE_LEVELS[0].level),
    },
    contentHash = await roomRecipeSHA256(accepted),
    seat = {
      roomId: 'a'.repeat(32),
      token: 'b'.repeat(64),
      seat: 0,
      invite: 'c'.repeat(64),
      contentHash,
      engineVersion: 'e'.repeat(64),
      protocol: ROOM_PROTOCOL,
      controlProtocol: ROOM_CONTROL_PROTOCOL,
    },
    room = createAuthoritativeRoom(accepted, {
      id: seat.roomId,
      contentHash,
      engineVersion: seat.engineVersion,
    });
  return { accepted, seat, wire: snapshotAuthoritativeRoom(room) };
}

test('actual snapshot owner publishes sharing only after full recipe acceptance and no extra transport', async () => {
  const { seat, wire } = await acceptedRoomFixture(),
    response = deferred(),
    binding = deferred(),
    bound = deferred(),
    nodes = new Map(),
    updates = [],
    requests = [],
    notices = [],
    errors = [],
    lifecycle = createRoomClientLifecycle({
      sendInput() {
        assert.fail('Invitation presentation cannot submit gameplay.');
      },
    });
  lifecycle.own(seat);
  const context = {
    credentials: seat,
    polling: null,
    pauseRequest: null,
    stopped: false,
    document: { hidden: false },
    lifecycle,
    AbortController,
    ROOM_CONTROL_PROTOCOL,
    canonicalJSON,
    restoreTrustedRoomSnapshot,
    roomError: (message, code) => Object.assign(new Error(message), { code }),
    acceptedRecipeJSON: null,
    state: null,
    teamPresentation: { reset() {} },
    eventIds: new Set(),
    async assertRoomRecipeBinding(...args) {
      await assertRoomRecipeBinding(...args);
      bound.resolve();
      await binding.promise;
    },
    async api(path, body, owner) {
      requests.push({ path, body, owner });
      return response.promise;
    },
    requestPause() {
      assert.fail('A waiting room does not acquire a pause request.');
    },
    allocateBoards: async () => {},
    reconcileRoomPresentationRuns,
    syncControls() {},
    showAcceptedMission() {},
    location: {
      href: 'https://game.example/game/online/?lang=uk&endpoint=https://private.example',
    },
    roomInvitationLink,
    invitationActions: { update: (value) => updates.push(value) },
    $: (id) => {
      if (!nodes.has(id)) nodes.set(id, { value: '', textContent: '', hidden: true });
      return nodes.get(id);
    },
    say: (en) => en,
    notice: (value) => notices.push(value),
    roomUI: { update() {} },
    abandonLocal() {
      assert.fail('An accepted waiting room is not abandoned.');
    },
    connectionError: (error) => errors.push(error),
  };
  const { poll } = await roomPageFunctions(['poll'], context),
    pending = poll();
  assert.equal(updates.length, 0);
  assert.equal(requests.length, 1);
  response.resolve(wire);
  await bound.promise;
  assert.equal(updates.length, 0, 'A wire response alone is not an accepted recipe.');
  binding.resolve();
  await pending;
  assert.equal(errors.length, 0);
  assert.equal(updates.length, 1);
  const shared = new URL(updates[0]);
  assert.equal(shared.search, '?lang=uk');
  assert.equal(readRoomInvitation(shared.href).invite, seat.invite);
  assert.equal(readRoomInvitation(shared.href).expectedHash, seat.contentHash);
  assert.equal(updates[0].includes(seat.token), false);
  assert.equal(context.$('invitation').hidden, false);
  assert.equal(context.$('invite').value, updates[0]);
  assert.equal(context.state.status, 'waiting');
  assert.equal(lifecycle.canPlay(), false);
  assert.deepEqual(
    requests.map(({ path }) => path),
    ['/snapshot'],
  );
  await poll();
  assert.deepEqual(
    updates,
    [shared.href, shared.href],
    'Normal polls refresh the same accepted address without replacing its owner.',
  );
  assert.deepEqual(
    requests.map(({ path }) => path),
    ['/snapshot', '/snapshot'],
  );
  assert.equal(notices.length, 2);
});

for (const retirement of ['replace', 'hidden', 'stopped', 'identity', 'recipe'])
  test(`actual snapshot ${retirement} cannot publish a shareable invitation`, async () => {
    const { seat, wire } = await acceptedRoomFixture(),
      response = deferred(),
      updates = [],
      errors = [],
      lifecycle = createRoomClientLifecycle({
        sendInput() {
          assert.fail('No gameplay input.');
        },
      });
    lifecycle.own(seat);
    if (retirement === 'identity') wire.roomId = 'f'.repeat(32);
    if (retirement === 'recipe') wire.recipe.seed++;
    const context = {
      credentials: seat,
      polling: null,
      pauseRequest: null,
      stopped: false,
      document: { hidden: false },
      lifecycle,
      AbortController,
      ROOM_CONTROL_PROTOCOL,
      canonicalJSON,
      restoreTrustedRoomSnapshot,
      assertRoomRecipeBinding,
      roomError: (message, code) => Object.assign(new Error(message), { code }),
      acceptedRecipeJSON: null,
      api: () => response.promise,
      invitationActions: { update: (value) => updates.push(value) },
      connectionError: (error) => errors.push(error),
    };
    const { poll } = await roomPageFunctions(['poll'], context),
      pending = poll();
    if (retirement === 'replace') context.credentials = { ...seat, token: 'd'.repeat(64) };
    if (retirement === 'hidden') context.document.hidden = true;
    if (retirement === 'stopped') context.stopped = true;
    response.resolve(wire);
    await pending;
    assert.deepEqual(updates, []);
    assert.equal(errors.length, ['identity', 'recipe'].includes(retirement) ? 1 : 0);
    if (errors.length) assert.equal(errors[0].code, 'ROOM_IDENTITY_MISMATCH');
  });

test('actual seat validation preserves a current invitation on invalid input and retires it before owning valid replacement', async () => {
  const { seat } = await acceptedRoomFixture(),
    updates = [],
    writes = [],
    pollOwner = deferred(),
    nodes = new Map(),
    context = {
      credentials: null,
      state: null,
      acceptedRecipeJSON: null,
      ROOM_PROTOCOL,
      ROOM_CONTROL_PROTOCOL,
      roomError: (message, code) => Object.assign(new Error(message), { code }),
      invitationActions: { update: (value) => updates.push(value) },
      teamPresentation: { reset() {} },
      lifecycle: createRoomClientLifecycle({
        sendInput() {
          assert.fail('No automatic Ready/input.');
        },
      }),
      saveSeat: (value) => writes.push(value),
      syncControls() {},
      say: (en) => en,
      roomUI: { shell: { open: (name) => assert.equal(name, 'missions') } },
      poll: () => pollOwner.promise,
      $: (id) => {
        if (!nodes.has(id)) nodes.set(id, {});
        return nodes.get(id);
      },
    };
  const { own } = await roomPageFunctions(['own'], context);
  await assert.rejects(own({ ...seat, token: 'invalid' }));
  await assert.rejects(own(seat, { expectedHash: 'f'.repeat(64) }));
  assert.deepEqual(updates, []);
  assert.deepEqual(writes, []);
  const pending = own(seat);
  assert.deepEqual(updates, [null]);
  assert.equal(context.$('invitation').hidden, true);
  assert.equal(context.$('invite').value, '');
  assert.equal(context.credentials === seat, true);
  assert.deepEqual(writes, [seat]);
  pollOwner.resolve();
  await pending;
  assert.deepEqual(
    updates,
    [null],
    'Owning credentials never creates a new invitation before a full accepted snapshot.',
  );
});

for (const kind of ['leave', 'abandonLocal'])
  test(`actual ${kind} retires invitation actions while preserving existing transport/storage ownership`, async () => {
    const { seat } = await acceptedRoomFixture(),
      events = [],
      nodes = new Map(),
      context = {
        credentials: seat,
        state: {},
        polling: null,
        pauseRequest: null,
        acceptedRecipeJSON: 'accepted',
        invitationActions: {
          update(value) {
            events.push(['invitation', value]);
          },
        },
        lifecycle: {
          snapshot: () => ({ phase: 'connected' }),
          abandon() {
            events.push(['abandon']);
          },
          release() {
            events.push(['release']);
          },
        },
        api(path, body, owner) {
          events.push([path, Boolean(owner === seat)]);
          return Promise.resolve();
        },
        roomUI: { suspend() {}, update() {}, shell: { open() {}, update() {} } },
        teamPresentation: { reset() {} },
        saveSeat: (value) => events.push(['seat', value]),
        sessionStorage: { removeItem: (key) => events.push(['remove', key]) },
        ROOM_APPEARANCE_KEY: 'appearance',
        painters: [],
        effects: [],
        canvases: [],
        flights: [],
        eventIds: new Set(),
        acceptedRoomAppearance: null,
        presentation: { setAttemptAppearance() {} },
        reconnect: {},
        syncControls() {},
        notice() {},
        say: (en) => en,
        $: (id) => {
          if (!nodes.has(id)) nodes.set(id, { replaceChildren() {} });
          return nodes.get(id);
        },
      };
    const fn = (await roomPageFunctions([kind], context))[kind];
    fn();
    assert.deepEqual(events[0], ['invitation', null]);
    assert.equal(context.$('invitation').hidden ?? context.$('lobby').hidden, true);
    assert.equal(events.filter(([name]) => name.startsWith('/')).length, kind === 'leave' ? 1 : 0);
    if (kind === 'leave')
      assert.deepEqual(
        events.find(([name]) => name === '/leave'),
        ['/leave', true],
      );
    assert.equal(events.filter(([name]) => name === 'seat').length, 1);
  });

for (const persisted of [true, false])
  test(`actual page lifecycle retires invitation work before bfcache=${persisted} and refreshes only the returning owner`, async () => {
    const source = await readFile(new URL('../online/rooms.mjs', import.meta.url), 'utf8'),
      ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' }),
      handlers = {};
    for (const statement of ast.body) {
      const call = statement.expression;
      if (
        call?.callee?.object?.name === 'window' &&
        call.callee.property.name === 'addEventListener' &&
        ['pagehide', 'pageshow'].includes(call.arguments[0]?.value)
      )
        handlers[call.arguments[0].value] = source.slice(
          call.arguments[1].start,
          call.arguments[1].end,
        );
    }
    const events = [],
      context = {
        stopped: false,
        previousFrame: 17,
        suspend: () => events.push('suspend'),
        invitationActions: {
          invalidate: () => events.push('invalidate'),
          dispose: () => events.push('dispose'),
          refresh: () => events.push('refresh'),
        },
        roomUI: { dispose: () => events.push('ui-dispose') },
        effects: [],
        removeNativeInactive: null,
        poll: () => events.push('poll'),
      };
    runInNewContext(`(${handlers.pagehide})`, context)({ persisted });
    assert.deepEqual(
      events,
      persisted ? ['suspend', 'invalidate'] : ['suspend', 'invalidate', 'dispose', 'ui-dispose'],
    );
    assert.equal(context.stopped, true);
    if (persisted) {
      runInNewContext(`(${handlers.pageshow})`, context)();
      assert.deepEqual(events.slice(-2), ['refresh', 'poll']);
      assert.equal(context.stopped, false);
    }
  });

test('same-page invitation navigation retires the previous room before normal pinned boot', async () => {
  const source = await readFile(new URL('../online/rooms.mjs', import.meta.url), 'utf8');
  const handler = parse(source, { ecmaVersion: 'latest', sourceType: 'module' }).body.find(
    (node) => node.type === 'FunctionDeclaration' && node.id.name === 'followInvitation',
  );
  assert.ok(handler);
  const calls = [],
    invite = 'f'.repeat(64),
    content = 'b'.repeat(64),
    base = 'http://localhost:8787/game/online/?lang=en';
  const context = {
    location: {
      href: `${base}#invite=${invite}&recipe=snake:versus:review&content=${content}`,
      pathname: '/game/online/',
      search: '?lang=en',
      reload: () => calls.push('reload'),
    },
    credentials: { invite: 'a'.repeat(64) },
    lifecycle: { snapshot: () => ({ phase: 'abandoned' }) },
    history: { replaceState: (...args) => calls.push(args[2]) },
    readRoomInvitation,
    leave: () => calls.push('leave'),
    notice: (value) => calls.push(value),
  };
  const navigate = runInNewContext(`(${source.slice(handler.start, handler.end)})`, context);
  navigate();
  assert.deepEqual(calls, ['leave', 'reload']);
  assert.equal(readRoomInvitation(context.location.href).expectedHash, content);
  calls.length = 0;
  context.location.href = `${base}#invite=invalid`;
  navigate();
  assert.equal(calls.length, 1);
  assert.match(calls[0], /Invalid room invitation/);
  calls.length = 0;
  context.location.href = `${base}#settings`;
  navigate();
  assert.deepEqual(calls, []);
  context.location.href = `${base}#invite=${invite}`;
  context.credentials.invite = invite;
  context.lifecycle.snapshot = () => ({ phase: 'connected' });
  navigate();
  assert.deepEqual(calls, ['/game/online/?lang=en']);
});

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

test('late poll and action failures from a retired epoch cannot suspend accepted readiness', async () => {
  const source = await readFile(new URL('../online/rooms.mjs', import.meta.url), 'utf8'),
    handler = parse(source, { ecmaVersion: 'latest', sourceType: 'module' }).body.find(
      (node) => node.type === 'FunctionDeclaration' && node.id.name === 'connectionError',
    ),
    lifecycle = createRoomClientLifecycle({ sendInput() {} });
  lifecycle.own(owner);
  accept(lifecycle, snapshot());
  const beforePause = lifecycle.snapshot().epoch;
  lifecycle.suspend();
  lifecycle.pauseAcknowledged(lifecycle.snapshot().epoch);
  accept(lifecycle, snapshot('paused', 'b'));
  const readyEpoch = lifecycle.snapshot().epoch;
  accept(lifecycle, snapshot('playing', 'c'));
  let suspensions = 0,
    notice = 'Room playing';
  const fail = runInNewContext(`(${source.slice(handler.start, handler.end)})`, {
    credentials: owner,
    lifecycle,
    terminalRoomError,
    abandonLocal() {
      lifecycle.abandon();
    },
    suspendLocal() {
      lifecycle.suspend();
      suspensions++;
    },
    notice(value) {
      notice = value;
    },
    say: (en) => en,
  });
  fail(new Error('Late snapshot timeout'), owner, beforePause);
  fail(new Error('Ready response lost after the playing snapshot arrived'), owner, readyEpoch);
  assert.equal(lifecycle.canPlay(), true);
  assert.equal(suspensions, 0);
  assert.equal(notice, 'Room playing');
  fail(new Error('Current activation failed'), owner, lifecycle.snapshot().epoch);
  assert.equal(lifecycle.canPlay(), false);
  assert.equal(suspensions, 1);
  assert.match(notice, /Reconnecting/);
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

import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers/room-service-http-fixture.mjs';
import { CLASSIC_SNAKE_LEVELS } from '../snake/classic-catalogue.mjs';
import { createRoomClientLifecycle } from '../online/room-client-lifecycle.mjs';
import { createRoomEventCursor } from '../online/room-events.mjs';
import { restoreTrustedRoomSnapshot, verifyAuthoritativeRoomResult } from '../online/room-core.mjs';
import { pursuitPilotCases } from '../../scripts/qualify-pursuit-pilots.mjs';

// The same legal seed-17 routes qualified by classic-snake-pilot-completion.
// Every move below travels through real HTTP and the authoritative native
// service. No simulation object, target, clock budget or objective is patched.
const routes = {
  versus: [
    'DDLLLDRRRDDDDDDRRRRRDRRRURUUUUURRRRRRDDDDDDDDLLLLLUUULLLLLLLLLLUUUUUULLULDDRRDRDDDDRRRRRRRRRRDDDRDLLULLUUURRUUUUUUULLUUURUR',
    'DDLLLDRRRDDDDDDRRRRRDRRRURUUUUURRRRRRDDDDDDDDLLLLLUUULLLLLLLLLLUUUUUULLULDDRRDRDDDDRRRRRRRRRRDDDRDLLULLUUURRUUUUUUULLUUURUR',
  ],
  team: [
    'DDLLLDRRRDDDDDDRRRDRRRRRRDDDRRRRDLLLUUUUULLLLLLLLLLUUUUUULLLLDRRRRUUURRRRRRRRRRRRRRDLLLLUUUUL',
    'ULLLUUUUUULLLLLLDDDRRRRRRDDDRRRRRDDDLUULDLUULLUULLLLLLLLULLULDDRURRRRRRRRRRDDDRDLLULLUUURRUUU',
  ],
};
const directions = { U: 'up', R: 'right', D: 'down', L: 'left' };
const control = (direction) => ({ direction, steer: true, boost: false, support: false });
async function until(predicate, label) {
  const deadline = Date.now() + 5000;
  while (!predicate()) {
    assert.ok(Date.now() < deadline, label);
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
}

function seats(h) {
  const errors = [];
  const clients = [h.host, h.guest].map((owner) => {
    const client = createRoomClientLifecycle({
      async sendInput(body, seat, signal) {
        const result = await h.api('/input', seat, body, { signal });
        if (result.status !== 200)
          throw Object.assign(new Error(result.body.error), { code: result.body.code });
        return result.body;
      },
      onError: (error, seat) => errors.push({ error, seat }),
    });
    client.own(owner);
    return client;
  });
  return { clients, errors };
}
const accept = (clients, snapshot) => {
  restoreTrustedRoomSnapshot(snapshot);
  for (const client of clients)
    assert.equal(client.accept(snapshot, client.snapshot().epoch), true);
};

async function interruptAndRecover(h, clients, cursor, before, errors) {
  const oldEpoch = clients[0].snapshot().epoch;
  const heldSnapshot = h.faults.next('/snapshot', 'hold-response');
  const oldPoll = h.api('/snapshot', h.host);
  void oldPoll.catch(() => {});
  assert.equal((await heldSnapshot.observed).status, 200);
  const lostAcknowledgement = h.faults.next('/input', 'drop-response');
  assert.equal(clients[0].submit(control('up')), true);
  const admitted = await lostAcknowledgement.observed;
  assert.equal(admitted.status, 200);
  await until(
    () => clients[0].snapshot().phase === 'recovering',
    'Lost response must suspend input',
  );
  assert.equal(errors.length, 1);
  assert.equal(clients[0].canPlay(), false);
  const queued = await h.snap();
  assert.equal(queued.seats[0].acknowledged, admitted.body.acknowledged);
  assert.equal(queued.queue.filter((row) => row.seat === 0).length, 1);

  const staleInput = await h.hold('/input', h.guest, {
    ...control('left'),
    sequence: queued.seats[1].acknowledged + 1,
    generation: before.generation,
    activation: before.controlActivation,
  });
  h.advance(59000);
  const paused = await h.snap();
  assert.equal(paused.status, 'paused');
  assert.equal(paused.tick, before.tick);
  assert.equal(paused.activeMs, before.activeMs);
  assert.deepEqual(
    paused.engine,
    before.engine,
    'A disconnected interval cannot advance native play',
  );
  assert.deepEqual(paused.queue, []);
  assert.deepEqual(
    paused.seats.map((seat) => seat.ready),
    [false, false],
  );
  assert.equal(clients[0].accept(paused, clients[0].snapshot().epoch), false);
  assert.equal((await h.api('/snapshot', h.guest)).status, 200);
  assert.equal(
    (await h.api('/pause', h.host, { activation: paused.controlActivation })).status,
    200,
  );
  assert.equal(clients[0].pauseAcknowledged(clients[0].snapshot().epoch), true);
  const prepared = await h.snap();
  accept(clients, prepared);
  assert.ok(clients.every((client) => !client.canPlay()));
  assert.equal(
    (await h.api('/ready', h.host, { activation: prepared.controlActivation })).status,
    200,
  );
  assert.equal((await h.snap()).status, 'paused', 'One Ready cannot resume the match');
  assert.equal(
    (await h.api('/ready', h.guest, { activation: prepared.controlActivation })).status,
    200,
  );
  const resumed = await h.snap();
  accept(clients, resumed);
  assert.equal(resumed.status, 'playing');
  assert.notEqual(resumed.controlActivation, before.controlActivation);
  assert.deepEqual(resumed.engine, before.engine);
  assert.equal(clients[0].snapshot().sequence, admitted.body.acknowledged);
  cursor.reset();
  assert.deepEqual(cursor.accept(resumed, { silent: true }).events, []);

  staleInput.finish();
  assert.equal((await staleInput.response).body.code, 'STALE_ACTIVATION');
  heldSnapshot.release();
  const late = await oldPoll;
  assert.equal(late.status, 200);
  assert.equal(clients[0].accept(late.body, oldEpoch), false);
  assert.equal(clients[0].canPlay(), true, 'A late old snapshot cannot suspend the new activation');
  assert.equal((await h.snap()).queue.length, 0);
  return resumed;
}

for (const mode of ['versus', 'team']) {
  test(
    `real HTTP ${mode}: duplicate/lost/late delivery preserves native completion and once-only catch events`,
    { timeout: 30000 },
    async (t) => {
      const entry = CLASSIC_SNAKE_LEVELS.find(
        (level) => level.id === 'classic-living-cable-cutoff',
      );
      assert.ok(entry);
      const h = await fixture(t, {
        entry: { ...entry, family: 'snake', mode },
        selection: { seed: 17, pace: 'normal', targets: 'authored' },
        proxy: true,
      });
      const { clients, errors } = seats(h);
      t.after(() => clients.forEach((client) => client.release()));
      let snapshot = await h.start();
      accept(clients, snapshot);
      const accepted = structuredClone(snapshot.recipe);
      const initialEngine = structuredClone(snapshot.engine);
      assert.equal(accepted.level.id, entry.id);
      assert.equal(accepted.level.goal, 12);
      assert.equal(accepted.level.stepMs, 200);
      assert.equal(accepted.seed, 17);
      assert.equal(snapshot.engine.runs[0].levelIdentity, '98540ea87137165a');
      const cursor = createRoomEventCursor(),
        emitted = [];
      assert.deepEqual(cursor.accept(snapshot).events, []);
      let interrupted = false,
        duplicateSequence = null;
      for (let step = 0; step < routes[mode][0].length; step++) {
        assert.equal(
          snapshot.status,
          'playing',
          JSON.stringify({
            step,
            tick: snapshot.tick,
            result: snapshot.result,
            runs: snapshot.engine.runs.map((run) => ({
              tick: run.tick,
              catches: run.catches,
              failure: run.failure,
              heads: run.snakes.map((snake) => snake.body[0]),
            })),
          }),
        );
        const duplicate = step === 4 ? h.faults.next('/input', 'duplicate') : null;
        for (let seat = 0; seat < 2; seat++) {
          assert.equal(clients[seat].submit(control(directions[routes[mode][seat][step]])), true);
          await until(
            () => clients[seat].snapshot().pending === 0,
            'Native control response must settle',
          );
        }
        if (duplicate) {
          const responses = await duplicate.observed;
          assert.equal(responses.first.status, 200);
          assert.deepEqual(responses.duplicate, responses.first);
          duplicateSequence = responses.first.body.acknowledged;
          const queued = await h.snap();
          assert.equal(
            queued.queue.filter((row) => row.seat === 0 && row.sequence === duplicateSequence)
              .length,
            1,
          );
          const older = await h.api('/input', h.host, {
            ...control(directions[routes[mode][0][step - 1]]),
            sequence: duplicateSequence - 1,
            generation: snapshot.generation,
            activation: snapshot.controlActivation,
          });
          assert.equal(older.status, 200);
          assert.equal(older.body.acknowledged, duplicateSequence);
          assert.deepEqual(
            (await h.snap()).queue,
            queued.queue,
            'Late superseded controls cannot replace the queued direction',
          );
        }
        h.advance(200);
        snapshot = await h.snap();
        if (snapshot.engine.runs[0].tick === step) {
          // The service clock is 120 Hz; an exact 200 ms decimal can land just
          // before the grid event. Observe the native move before the next turn.
          h.advance(1000 / 120);
          snapshot = await h.snap();
        }
        assert.equal(snapshot.engine.runs[0].tick, step + 1);
        assert.equal((await h.api('/snapshot', h.guest)).status, 200);
        accept(clients, snapshot);
        emitted.push(...cursor.accept(snapshot).events);
        assert.deepEqual(
          cursor.accept(snapshot).events,
          [],
          'A repeated HTTP snapshot emits no duplicate effects',
        );
        if (!interrupted && snapshot.engine.runs[0].catches > 0) {
          snapshot = await interruptAndRecover(h, clients, cursor, snapshot, errors);
          interrupted = true;
        }
      }
      assert.equal(interrupted, true);
      assert.equal(errors.length, 1, 'Only the deliberately lost response failed');
      assert.equal(snapshot.status, 'finished');
      assert.equal(snapshot.result, mode === 'versus' ? 'draw' : 'won');
      assert.deepEqual(snapshot.recipe, accepted);
      assert.ok(snapshot.engine.runs.every((run) => run.status === 'won' && run.catches === 12));
      assert.equal(
        emitted.filter((row) => row.event.type === 'target.caught').length,
        mode === 'versus' ? 24 : 12,
      );
      assert.equal(new Set(emitted.map((row) => row.id)).size, emitted.length);
      const terminal = await h.api('/result', h.host);
      assert.equal(terminal.status, 200);
      assert.deepEqual((await h.api('/result', h.guest)).body, terminal.body);
      const acceptedInputs = terminal.body.inputs.filter((row) => !row.release);
      assert.equal(
        new Set(acceptedInputs.map((row) => `${row.seat}:${row.sequence}`)).size,
        acceptedInputs.length,
      );
      assert.equal(
        acceptedInputs.filter((row) => row.seat === 0 && row.sequence === duplicateSequence).length,
        1,
      );
      assert.ok(terminal.body.inputs.some((row) => row.release && row.acknowledged));
      assert.deepEqual(
        verifyAuthoritativeRoomResult(terminal.body, {
          acceptedRecipe: accepted,
          contentHash: snapshot.contentHash,
          engineVersion: snapshot.engineVersion,
        }),
        snapshot.result,
      );
      assert.equal(
        (await h.api('/rematch', h.host, { activation: snapshot.controlActivation })).status,
        200,
      );
      assert.equal((await h.snap()).status, 'finished', 'One rematch vote cannot replace a result');
      assert.equal(
        (await h.api('/rematch', h.guest, { activation: snapshot.controlActivation })).status,
        200,
      );
      const rematch = await h.snap();
      assert.equal(rematch.generation, 2);
      assert.equal(rematch.status, 'waiting');
      assert.equal(rematch.tick, 0);
      assert.equal(rematch.activeMs, 0);
      assert.deepEqual(rematch.recipe, accepted);
      assert.deepEqual(rematch.engine, initialEngine);
      assert.deepEqual(
        rematch.seats.map((seat) => seat.acknowledged),
        [0, 0],
      );
      accept(clients, rematch);
      assert.deepEqual(cursor.accept(rematch).events, []);
      assert.ok(clients.every((client) => !client.canPlay() && client.snapshot().sequence === 0));
      assert.equal(
        (await h.api('/ready', h.host, { activation: snapshot.controlActivation })).body.code,
        'STALE_ACTIVATION',
      );
      const restarted = await h.start();
      accept(clients, restarted);
      assert.ok(clients.every((client) => client.canPlay()));
    },
  );
}

// Contact witnesses from capture-pilot-contact-completion: native default
// Scout controls and authored recipes, with no simulation-position writes.
const captureRoutes = {
  versus: [
    [82, 'right'],
    [326, 'down'],
    [110, 'right'],
    [82, 'down'],
    [214, 'right'],
    [90, 'up'],
    [105, 'right'],
    [75, 'up'],
    [1, null],
    [237, 'up'],
  ],
  team: [
    [122, 'right', 'up'],
    [89, 'right', 'left'],
    [1, null, 'left'],
    [102, 'right', 'left'],
    [228, 'down', 'left'],
    [22, 'down', null],
    [1, null, null],
    [122, 'up', 'down'],
    [225, 'up', 'left'],
    [1, 'up', null],
    [117, 'up', 'left'],
    [1, null, 'up'],
    [230, null, 'up'],
    [1, null, null],
    [95, null, 'down'],
    [304, null, 'left'],
  ],
};
for (const mode of ['versus', 'team']) {
  test(
    `real HTTP Capture ${mode}: duplicated controls preserve native interceptions, cooperation and verified results`,
    { timeout: 30000 },
    async (t) => {
      const pilot = pursuitPilotCases().find(
        (row) =>
          row.mode === mode &&
          row.pace === 'standard' &&
          row.pilot === (mode === 'team' ? 'pincer-yard' : 'crossing-post'),
      );
      assert.ok(pilot);
      const h = await fixture(t, {
        entry: {
          id: pilot.pilot,
          family: 'capture',
          mode,
          title: { en: pilot.pilot, uk: pilot.pilot },
          level: pilot.level,
        },
        selection: { seed: pilot.seed },
        proxy: true,
      });
      const { clients, errors } = seats(h);
      t.after(() => clients.forEach((client) => client.release()));
      let snapshot = await h.start();
      accept(clients, snapshot);
      const accepted = structuredClone(snapshot.recipe),
        cursor = createRoomEventCursor(),
        emitted = [];
      assert.deepEqual(accepted.level, pilot.level);
      assert.equal(accepted.seed, pilot.seed);
      cursor.accept(snapshot);
      let targetTick = 0;
      for (const [ticks, first, second] of captureRoutes[mode]) {
        const duplicate = h.faults.next('/input', 'duplicate');
        const input = [first, mode === 'versus' ? first : second];
        for (let seat = 0; seat < 2; seat++) {
          assert.equal(clients[seat].submit({ ...control(input[seat]), steer: false }), true);
          await until(
            () => clients[seat].snapshot().pending === 0,
            'Capture control response must settle',
          );
        }
        const delivered = await duplicate.observed;
        assert.equal(delivered.first.status, 200);
        assert.deepEqual(delivered.duplicate, delivered.first);
        targetTick += ticks;
        while (snapshot.tick < targetTick) {
          assert.equal(snapshot.status, 'playing');
          h.advance(Math.min(24, targetTick - snapshot.tick) * (1000 / 120));
          snapshot = await h.snap();
          assert.equal((await h.api('/snapshot', h.guest)).status, 200);
          accept(clients, snapshot);
          const cues = cursor.accept(snapshot);
          assert.equal(cues.gap, false);
          emitted.push(...cues.events);
          assert.deepEqual(cursor.accept(snapshot).events, []);
        }
        assert.equal(snapshot.tick, targetTick);
      }
      assert.deepEqual(errors, []);
      assert.equal(snapshot.status, 'finished');
      assert.equal(snapshot.tick, mode === 'versus' ? 1322 : 1661);
      assert.ok(snapshot.engine.runs.every((run) => run.status === 'won'));
      const catches = emitted.filter((row) => row.event.type === 'combat.eliminated');
      assert.equal(catches.length, mode === 'versus' ? 4 : 2);
      assert.ok(catches.every((row) => row.event.cause === 'ram'));
      assert.equal(new Set(emitted.map((row) => row.id)).size, emitted.length);
      if (mode === 'team') {
        assert.deepEqual(
          catches.map((row) => row.event.players),
          [[0], [1]],
        );
        assert.equal(snapshot.engine.runs[0].team.rescues, 1);
      } else assert.deepEqual(snapshot.engine.runs[0], snapshot.engine.runs[1]);
      const terminal = await h.api('/result', h.host);
      assert.equal(terminal.status, 200);
      assert.deepEqual((await h.api('/result', h.guest)).body, terminal.body);
      assert.equal(terminal.body.inputs.length, captureRoutes[mode].length * 2);
      assert.deepEqual(
        verifyAuthoritativeRoomResult(terminal.body, {
          acceptedRecipe: accepted,
          contentHash: snapshot.contentHash,
          engineVersion: snapshot.engineVersion,
        }),
        snapshot.result,
      );
    },
  );
}

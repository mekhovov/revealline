import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoop, startCoop, stepCoop, FIXED_DT } from '../coop/core.mjs';
import { RELAY_YARD } from '../coop/relay-yard.mjs';

const command = (direction = null, support = false) => ({ direction, boost: true, support });

for (const downedSeat of [0, 1]) {
  test(`live Relay Yard: P${downedSeat + 1} can be rescued on earned ground without a reserve or charge`, () => {
    const levelBefore = structuredClone(RELAY_YARD);
    const run = startCoop(createCoop(RELAY_YARD, { difficulty: 'standard', seed: 17 }));
    const reservesBefore = run.team.reserves;
    const rescuerSeat = 1 - downedSeat;
    const events = [];
    let phase = 'inward';
    let recoveryBaseline;

    // Every state change comes from public inputs against the real authored
    // enemies. Bank the anchors, then let one craft attempt the guarded upper
    // cut while its partner remains on their newly earned safe row.
    for (let tick = 0; tick < 1200 && run.status === 'running'; tick++) {
      const [left, right] = run.players;
      const downed = run.players[downedSeat];
      const rescuer = run.players[rescuerSeat];
      if (phase === 'inward' && left.x >= 14.45 && right.x <= 57.55) phase = 'above-pillars';
      if (phase === 'above-pillars' && left.y <= 11.51 && right.y <= 11.51) phase = 'anchors';
      if (phase === 'anchors' && run.strongholds[0].anchors.every((anchor) => anchor.captured))
        phase = 'one-outward';
      if (phase === 'one-outward' && (downedSeat === 0 ? downed.x <= 33.51 : downed.x >= 38.49))
        phase = 'one-up';
      if (phase === 'one-up' && downed.status === 'downed') {
        phase = 'rescue';
        recoveryBaseline = {
          charges: run.players.map((player) => player.support.readyAt),
          claimedCount: run.claimedCount,
        };
      }

      let inputs;
      if (phase === 'inward' || phase === 'anchors') inputs = [command('right'), command('left')];
      else if (phase === 'above-pillars') inputs = [command('up'), command('up')];
      else {
        inputs = [command(), command()];
        if (phase === 'one-outward')
          inputs[downedSeat] = command(downedSeat === 0 ? 'left' : 'right');
        else if (phase === 'one-up') inputs[downedSeat] = command('up');
        else
          inputs[rescuerSeat] =
            Math.hypot(rescuer.x - downed.x, rescuer.y - downed.y) > 1
              ? command(rescuer.x > downed.x ? 'left' : 'right')
              : command(null, true);
      }
      stepCoop(run, inputs, FIXED_DT);
      events.push(...structuredClone(run.events));
      if (phase === 'rescue' && downed.status === 'active') break;
    }

    const knockdowns = events.filter((event) => event.type === 'player.downed');
    assert.equal(knockdowns.length, 1, 'The real patrol must down exactly the exposed craft.');
    assert.equal(knockdowns[0].player, downedSeat);
    assert.equal(knockdowns[0].cause, 'enemy-trail');
    assert.ok(recoveryBaseline, 'The route must reach the actual rescue decision.');
    const channels = events.filter((event) => event.type === 'rescue.started');
    const revivals = events.filter((event) => event.type === 'player.revived');
    assert.equal(channels.length, 1);
    assert.equal(channels[0].player, rescuerSeat);
    assert.equal(channels[0].target, downedSeat);
    assert.equal(revivals.length, 1);
    assert.equal(revivals[0].player, downedSeat);
    assert.equal(revivals[0].reason, 'contact');
    assert.ok(Math.abs(revivals[0].time - channels[0].time - 1) < 1e-8);
    assert.equal(run.team.reserves, reservesBefore);
    assert.equal(run.claimedCount, recoveryBaseline.claimedCount);
    assert.ok(run.claimedCount > 0, 'The rescue route must use earned territory.');
    assert.deepEqual(
      run.players.map((player) => player.support.readyAt),
      recoveryBaseline.charges,
    );
    assert.ok(run.players.every((player) => player.support.uses === 0));
    assert.ok(run.players.every((player) => player.status === 'active' && !player.cutting));
    assert.ok(run.players.every((player) => player.direction === null));
    assert.ok(run.strongholds[0].anchors.every((anchor) => anchor.captured));
    assert.equal(run.strongholds[0].defeated, false);
    assert.equal(run.status, 'running');
    assert.deepEqual(RELAY_YARD, levelBefore);
  });
}

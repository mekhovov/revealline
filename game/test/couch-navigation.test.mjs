import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { authoritativeCheckpoint } from '../replay.mjs';
import { createRun, stepRun, releaseInputs, FIXED_DT } from '../core/index.mjs';
import { retryFixture } from './fixtures/retry-scenarios.mjs';
import { couchPage as page } from './helpers/couch-host.mjs';

const read = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const base = await read('../content/campaign.json');
const sentinel = await read('../content/packs/sentinel-relay.json');
const sentinelRoutes = await read('../replays/sentinel-routes.json');
const pad = (index) => ({
  index,
  id: `Standard pad ${index}`,
  connected: true,
  mapping: 'standard',
  axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
});

test('two sparse pads deliberately claim one menu; join/held Confirm cannot start or leak flight actions', async (t) => {
  const pads = [null, pad(1), null, pad(3)],
    f = await page(t, { pads });
  f.frame();
  f.button(1, 0, true);
  f.button(3, 0, true);
  f.frame();
  assert.match(f.$('race-menu-status').textContent, /Player 1 controller has the menu/);
  assert.equal(f.doc.activeElement.id, 'race-start');
  f.frames(70);
  assert.equal(f.state(), 'ready');
  assert.equal(f.tick(), 0);
  f.button(1, 0, false);
  f.button(3, 0, false);
  f.frame();
  f.pulse(3, 0);
  assert.equal(f.state(), 'ready');
  f.button(1, 0, true);
  f.frame();
  assert.equal(f.state(), 'running');
  assert.equal(f.tick(), 0);
  f.frames(40);
  assert.equal(f.tick(), 40);
  for (const run of f.renders) {
    assert.equal(run.player.x, run.level.spawn.x);
    assert.equal(run.player.y, run.level.spawn.y);
    assert.equal(run.score, 0);
  }
  // Inspect every stepped event, not just the final tick's transient array.
  assert.equal(
    f.observedEvents.some((event) => /ability|pickup|boost/.test(event.type)),
    false,
  );
  assert.equal(f.$('race-menu-release').hidden, true);
});

test('actual select previews cancel without replacing the duel and commit once through onchange', async (t) => {
  const f = await page(t, { pads: [pad(0), pad(1)] });
  f.join(0);
  const run = f.renders[0],
    original = f.$('race-level').value;
  f.$('race-focus').click();
  f.frame();
  f.focus('race-level');
  f.pulse(0, 0);
  f.pulse(0, 13);
  assert.equal(f.$('race-level').value, original);
  assert.equal(f.editors().length, 1);
  f.pulse(0, 1);
  assert.equal(f.editors().length, 0);
  assert.equal(f.renders[0], run);
  f.pulse(0, 0);
  f.pulse(0, 13);
  f.pulse(0, 0);
  assert.notEqual(f.$('race-level').value, original);
  assert.notEqual(f.renders[0], run);
  const newRun = f.renders[0];
  f.frames(30);
  assert.equal(f.renders[0], newRun);
  assert.equal(f.tick(), 0);
  assert.equal(f.doc.activeElement.id, 'race-level');
});

test('Back and Menu cancel previews or focus the primary action without starting or resetting', async (t) => {
  const f = await page(t, { pads: [pad(0)] });
  f.join(0);
  for (const button of [1, 9]) {
    f.$('race-focus').click();
    f.frame();
    f.focus('race-turn');
    f.pulse(0, 0);
    f.pulse(0, 13);
    f.pulse(0, button);
    assert.equal(f.$('race-turn').value, 'immediate');
    assert.equal(f.tick(), 0);
    f.pulse(0, button);
    assert.equal(f.doc.activeElement.id, 'race-focus');
    assert.equal(f.state(), 'ready');
  }
  f.focus('race-start');
  f.pulse(0, 0);
  f.frame();
  f.key('KeyD');
  f.frames(8);
  f.key('KeyD', false);
  f.pulse(0, 9);
  assert.equal(f.state(), 'paused');
  const checkpoint = f.checkpoint();
  for (const button of [1, 9]) {
    f.pulse(0, button);
    assert.equal(f.state(), 'paused');
    assert.deepEqual(f.checkpoint(), checkpoint);
  }
  f.pulse(0, 0);
  assert.equal(f.state(), 'running');
});

test('native menu focus cancels a held D-pad repeat until neutral without clearing either flight keyboard', async (t) => {
  const f = await page(t, { pads: [pad(0), pad(1)] });
  f.join(0);
  f.$('race-focus').click();
  f.frame();
  f.button(0, 13, true);
  f.frame();
  f.focus('race-class');
  f.$('race-class').emit('pointerdown', { button: 0 });
  f.frames(8, 120);
  assert.equal(f.doc.activeElement.id, 'race-class');
  f.button(0, 13, false);
  f.frame();
  f.pulse(0, 1);
  f.focus('race-start');
  f.pulse(0, 0);
  f.frame();
  f.key('KeyD');
  f.key('ArrowRight');
  f.frames(20);
  assert.ok(f.renders.every((run) => run.player.x > run.level.spawn.x));
  f.key('KeyD', false);
  f.key('ArrowRight', false);
});

test('Ready slot loss consumes another pad Confirm; the surviving player keeps its slot', async (t) => {
  const f = await page(t, { pads: [pad(0), pad(1)] });
  f.join(1);
  f.setPads([null, f.pads()[1]]);
  f.button(1, 0, true);
  f.frame();
  assert.equal(f.state(), 'ready');
  assert.equal(f.tick(), 0);
  assert.match(
    f.$('race-pad-status').textContent,
    /Player 1: keyboard\/touch · Player 2: pad slot 1/,
  );
  f.frames(10);
  assert.equal(f.state(), 'ready');
  f.button(1, 0, false);
  f.frame();
  f.pulse(1, 0);
  assert.equal(f.state(), 'running');
});

for (const eventLoss of [false, true]) {
  test(`${eventLoss ? 'disconnect event' : 'descriptor change'} at the same index pauses flight and requires neutral plus a new menu join`, async (t) => {
    const f = await page(t, { pads: [pad(0), pad(1)] });
    f.join(0);
    f.pulse(0, 0);
    f.frame();
    f.pads()[0].axes[0] = 1;
    f.frames(6);
    const before = f.checkpoint();
    if (eventLoss) f.win.emit('gamepaddisconnected', { gamepad: f.pads()[0] });
    const replacement = pad(0);
    if (!eventLoss) replacement.id = 'Replacement';
    replacement.axes[0] = 1;
    replacement.buttons[0].pressed = true;
    f.setPads([replacement, f.pads()[1]]);
    f.frame();
    f.frames(15);
    assert.equal(f.state(), 'paused');
    assert.deepEqual(f.checkpoint(), before);
    assert.match(f.$('race-pad-status').textContent, /Player 2: pad slot 1/);
    replacement.axes[0] = 0;
    replacement.buttons[0].pressed = false;
    f.frame();
    f.pulse(0, 0);
    assert.equal(f.state(), 'paused');
    f.pulse(0, 0);
    assert.equal(f.state(), 'running');
  });
}

test('explicit menu release permits the other player to join, never transfers a held edge', async (t) => {
  const f = await page(t, { pads: [pad(0), pad(1)] });
  f.join(0);
  f.$('race-options').click();
  f.frame();
  f.focus('race-menu-release');
  f.pulse(0, 0);
  assert.equal(f.$('race-menu-release').hidden, true);
  assert.equal(f.state(), 'ready');
  f.$('race-options-back').click();
  f.frame();
  f.join(1);
  assert.match(f.$('race-menu-status').textContent, /Player 2 controller has the menu/);
  f.pulse(0, 0);
  assert.equal(f.state(), 'ready');
  f.pulse(1, 0);
  assert.equal(f.state(), 'running');
});

test('one hardware read per visible frame and no reads or ticks while unfocused, hidden or disposed', async (t) => {
  const f = await page(t, { pads: [pad(0)] });
  f.join(0);
  f.pulse(0, 0);
  f.frame();
  const reads = f.readCount(),
    ticks = f.tick();
  f.frame(100);
  assert.equal(f.readCount(), reads + 1);
  assert.equal(f.tick(), ticks + 12);
  f.doc.focused = false;
  f.win.emit('blur');
  const stopped = f.checkpoint(),
    count = f.readCount();
  f.frames(8, 500);
  assert.equal(f.readCount(), count);
  assert.deepEqual(f.checkpoint(), stopped);
  f.doc.focused = true;
  f.frame(5000);
  assert.equal(f.state(), 'paused');
  assert.deepEqual(f.checkpoint(), stopped);
  f.doc.hidden = true;
  f.doc.emit('visibilitychange');
  const hiddenCount = f.readCount();
  f.frames(8, 500);
  assert.equal(f.readCount(), hiddenCount);
  assert.deepEqual(f.checkpoint(), stopped);
  f.doc.hidden = false;
  f.frame();
  f.win.emit('pagehide', { persisted: false });
  const disposedCount = f.readCount();
  f.frames(10);
  f.pulse(0, 0);
  assert.equal(f.readCount(), disposedCount);
  assert.deepEqual(f.checkpoint(), stopped);
});

test('persisted return and Ready Escape preserve the true state and cancel a pending edit', async (t) => {
  const f = await page(t, { pads: [pad(0)] });
  f.join(0);
  f.key('Escape');
  f.frame();
  assert.equal(f.state(), 'ready');
  assert.match(f.$('race-start').textContent, /Start round/);
  f.$('race-focus').click();
  f.frame();
  f.focus('race-level');
  f.pulse(0, 0);
  assert.equal(f.editors().length, 1);
  f.win.emit('pagehide', { persisted: true });
  assert.equal(f.editors().length, 0);
  f.frame(2000);
  assert.equal(f.state(), 'ready');
  assert.equal(f.tick(), 0);
  f.pulse(0, 1);
  f.focus('race-start');
  f.pulse(0, 0);
  f.frame();
  assert.equal(f.state(), 'running');
  f.win.emit('pagehide', { persisted: true });
  const checkpoint = f.checkpoint();
  f.frame(2000);
  assert.equal(f.state(), 'paused');
  assert.deepEqual(f.checkpoint(), checkpoint);
});

test('API errors and unsupported pads remain usable with keyboard and truthful Ready status', async (t) => {
  const unsupported = pad(0);
  unsupported.mapping = '';
  const f = await page(t, { pads: [unsupported] });
  assert.match(f.$('race-menu-status').textContent, /no standard mapping/);
  f.setError(new DOMException('Denied', 'SecurityError'));
  f.frame();
  assert.match(f.$('race-menu-status').textContent, /unavailable/);
  f.$('race-start').click();
  f.frame();
  f.key('KeyD');
  f.frames(10);
  assert.ok(f.renders[0].player.x > f.renders[0].level.spawn.x);
});

for (const turnPolicy of ['immediate', 'grid-center']) {
  test(`${turnPolicy}: actual Sentinel round win and best-of-three rematch retain legal core route results`, async (t) => {
    const f = await page(t, { campaign: sentinel.campaigns[0], turnPolicy, pads: [pad(0)] });
    f.join(0);
    const route = sentinelRoutes.routes.find(
      (r) => r.variant === 'ordinary' && r.classId === 'scout' && r.turnPolicy === turnPolicy,
    );
    for (let round = 1; round <= 2; round++) {
      f.button(0, 0, true);
      f.frame();
      f.button(0, 0, false);
      assert.equal(f.tick(), 0);
      const oracle = createRun(sentinel.campaigns[0].levels[0], {
        seed: 2026,
        classId: 'scout',
        turnPolicy,
        classRecipes: await read('../content/classes.json'),
      });
      let direction = null;
      for (const [index, segment] of route.segments.entries()) {
        if (direction)
          f.key({ up: 'KeyW', right: 'KeyD', down: 'KeyS', left: 'KeyA' }[direction], false);
        // The archived hold-input proof waits for attack clocks at the outer
        // boundary. Continuous flight deliberately points into that boundary;
        // Pause would freeze the clocks and cannot substitute for these waits.
        direction = segment.input.direction ?? (index === 2 ? 'up' : 'down');
        if (direction) f.key({ up: 'KeyW', right: 'KeyD', down: 'KeyS', left: 'KeyA' }[direction]);
        f.frames(segment.ticks);
        for (let i = 0; i < segment.ticks; i++)
          stepRun(oracle, { ...segment.input, direction }, FIXED_DT);
      }
      if (direction)
        f.key({ up: 'KeyW', right: 'KeyD', down: 'KeyS', left: 'KeyA' }[direction], false);
      assert.equal(f.renders[0].status, 'won');
      assert.equal(f.state(), 'finished');
      assert.equal(f.renders[0].lives, 3);
      assert.equal(f.renders[0].score, route.expected.score);
      assert.equal(f.renders[0].tick, route.expected.tick);
      releaseInputs(oracle);
      assert.deepEqual(authoritativeCheckpoint(f.renders[0]), authoritativeCheckpoint(oracle));
      f.frame();
      f.pulse(0, 1);
      assert.equal(f.state(), 'finished');
    }
    assert.match(f.$('race-start').textContent, /Play another match/);
    f.pulse(0, 0);
    assert.equal(f.state(), 'running');
    assert.equal(f.$('series-score').textContent, '0 : 0');
  });
}

test('one lost craft does not expose shared menu; both ended draws retain explicit Next', async (t) => {
  const { level } = retryFixture('self-contact');
  const f = await page(t, { campaign: { ...base, levels: [level] }, pads: [pad(0), pad(1)] });
  f.join(0);
  f.pulse(0, 0);
  f.frame();
  f.key('KeyS');
  f.frames(30);
  f.key('KeyS', false);
  f.key('KeyW');
  f.frame();
  f.key('KeyW', false);
  assert.equal(f.renders[0].status, 'lost');
  assert.equal(f.state(), 'lost');
  assert.equal(f.$('race-start').disabled, true);
  f.pulse(1, 0);
  assert.equal(f.$('race-start').disabled, true);
  f.key('ArrowDown');
  f.frames(30);
  f.key('ArrowDown', false);
  f.key('ArrowUp');
  f.frame();
  f.key('ArrowUp', false);
  assert.equal(f.renders[1].status, 'lost');
  assert.equal(f.state(), 'finished');
  assert.match(f.$('race-message').textContent, /Draw/);
  assert.equal(f.$('series-score').textContent, '0 : 0');
  f.frame();
  f.pulse(0, 9);
  assert.equal(f.state(), 'finished');
  f.pulse(0, 0);
  assert.equal(f.state(), 'running');
});

test('native checkboxes and both held touch pads stay independent after leaving controller navigation', async (t) => {
  const f = await page(t, { pads: [pad(0), pad(1)] });
  f.join(0);
  f.$('race-options').click();
  f.frame();
  for (const i of [0, 1]) {
    f.$(`race-touch-${i}`).value = 'always';
    f.$(`race-touch-${i}`).emit('change');
  }
  f.frame();
  f.focus('race-reduced');
  f.pulse(0, 0);
  assert.equal(f.$('race-reduced').checked, true);
  f.pulse(0, 1);
  f.focus('race-start');
  f.pulse(0, 0);
  f.frame();
  const pads = f.doc.querySelectorAll('.race-pad');
  const right = pads[0].querySelector('[data-direction="right"]');
  const left = pads[1].querySelector('[data-direction="left"]');
  right.emit('pointerdown', { pointerId: 41, button: 0 });
  left.emit('pointerdown', { pointerId: 42, button: 0 });
  f.frames(20);
  assert.ok(f.renders[0].player.x > f.renders[0].level.spawn.x);
  assert.ok(f.renders[1].player.x < f.renders[1].level.spawn.x);
  right.emit('pointerup', { pointerId: 41 });
  left.emit('pointerup', { pointerId: 42 });
  const positions = f.renders.map((run) => run.player.x);
  f.frames(8);
  assert.ok(f.renders[0].player.x > positions[0]);
  assert.ok(f.renders[1].player.x < positions[1]);
  right.emit('pointerdown', { pointerId: 43, button: 0 });
  right.emit('pointercancel', { pointerId: 43 });
  f.frame();
  assert.equal(f.state(), 'paused');
});

for (const turnPolicy of ['immediate', 'grid-center']) {
  test(`${turnPolicy}: actual Pause retains two different requested turns and explicit Resume continues both`, async (t) => {
    const f = await page(t, { turnPolicy });
    f.$('race-start').click();
    f.frame();
    f.key('KeyD');
    f.key('ArrowLeft');
    f.frames(5);
    f.key('KeyD', false);
    f.key('ArrowLeft', false);
    f.key('KeyS');
    f.key('ArrowRight');
    f.frame();
    f.key('KeyS', false);
    f.key('ArrowRight', false);
    const before = f.checkpoint();
    const expected = f.renders.map((run) => structuredClone(run));
    if (turnPolicy === 'grid-center')
      assert.deepEqual(
        expected.map((run) => run.player.queuedDirection),
        ['down', 'right'],
      );
    f.$('race-pause').click();
    f.key('KeyW');
    f.key('ArrowUp');
    f.frames(20, 100);
    assert.equal(f.state(), 'paused');
    assert.deepEqual(f.checkpoint(), before);
    f.key('KeyW', false);
    f.key('ArrowUp', false);
    f.$('race-start').click();
    f.frame(100);
    for (let tick = 0; tick < 12; tick++) {
      stepRun(expected[0], { direction: 'down' }, FIXED_DT);
      stepRun(expected[1], { direction: 'right' }, FIXED_DT);
    }
    assert.equal(f.state(), 'running');
    assert.deepEqual(f.checkpoint(), expected.map(authoritativeCheckpoint));
  });

  test(`${turnPolicy}: real recovery clears only that player's continuous intent before later substeps`, async (t) => {
    const { level } = retryFixture('enemy-player');
    level.rules = { ...level.rules, lives: 3, respawnSeconds: 0.1, graceSeconds: 0 };
    const f = await page(t, { campaign: { ...base, levels: [level] }, turnPolicy });
    f.$('race-start').click();
    f.frame();
    f.key('KeyD');
    f.key('ArrowLeft');
    f.frames(48);
    assert.equal(f.renders[0].lives, 3);
    const beforeTicks = f.renders.map((run) => run.tick);
    const otherX = f.renders[1].player.x;
    const reads = f.readCount();
    f.frame(200);
    assert.deepEqual(
      f.renders.map((run, i) => run.tick - beforeTicks[i]),
      [24, 24],
    );
    assert.equal(f.readCount(), reads + 1, 'one physical sample despite recovery within the frame');
    assert.equal(f.renders[0].status, 'running');
    assert.equal(f.renders[0].lives, 2);
    assert.equal(f.renders[0].player.x, level.spawn.x);
    assert.equal(f.renders[0].player.y, level.spawn.y);
    assert.equal(f.renders[0].player.speed, 0);
    assert.equal(f.renders[1].lives, 3);
    assert.ok(f.renders[1].player.x < otherX);
    assert.ok(f.observedEvents.some((event) => event.type === 'player.failed'));
    assert.ok(f.observedEvents.some((event) => event.type === 'player.respawned'));
    f.key('KeyD');
    f.frames(3);
    assert.equal(f.renders[0].player.x, level.spawn.x, 'old held key cannot restart movement');
    f.key('KeyD', false);
    f.key('KeyS');
    f.key('KeyS', false);
    f.frames(3);
    assert.ok(f.renders[0].player.y > level.spawn.y);
  });
}

test('timeout draw keeps series at zero and needs a fresh explicit Next gesture', async (t) => {
  const f = await page(t, { pads: [pad(0), pad(1), pad(2)] });
  f.frame();
  f.pulse(2, 0);
  assert.equal(f.$('race-menu-release').hidden, true);
  f.join(0);
  f.button(0, 0, true);
  f.frame();
  f.button(0, 0, false);
  f.frames(150, 200);
  assert.equal(f.state(), 'finished');
  assert.match(f.$('race-message').textContent, /Draw.*Time/);
  assert.equal(f.$('series-score').textContent, '0 : 0');
  assert.equal(f.tick(), 3600);
  f.frame();
  f.pulse(0, 1);
  const run = f.renders[0];
  f.button(0, 0, true);
  f.frame();
  assert.notEqual(f.renders[0], run);
  assert.equal(f.tick(), 0);
  f.frames(30);
  assert.equal(f.tick(), 30);
});

for (const turnPolicy of ['immediate', 'grid-center']) {
  for (const adapter of ['keyboard', 'controller']) {
    test(`${turnPolicy}, ${adapter}: real cut closure stops only its player across substeps and held input`, async (t) => {
      const level = {
        version: 'xonix-level.v4',
        id: 'couch-capture-stop',
        revision: '1',
        name: 'Independent capture stop',
        width: 72,
        height: 36,
        encounter: null,
        classic: { version: 'classic.v1', terrain: [], powerups: [] },
        spawn: { x: 36.5, y: 0.5 },
        goal: { coverage: 0.99 },
        enemies: [{ id: 'seed', type: 'bouncer', x: 60.5, y: 18.5, vx: 1, vy: 0 }],
        rules: {
          moveSpeed: 13,
          lives: 3,
          graceSeconds: 0,
          respawnSeconds: 0.1,
          stopOnCapture: true,
        },
      };
      const f = await page(t, {
        campaign: { ...base, levels: [level] },
        turnPolicy,
        pads: adapter === 'controller' ? [pad(0)] : [],
      });
      f.$('race-start').click();
      f.frames(2);
      if (adapter === 'controller') f.pads()[0].axes[1] = 1;
      else f.key('KeyS');
      f.frames(100);
      f.key('ArrowDown');
      f.key('ArrowDown', false);
      // The second player is still mid-cut when the first reaches safe ground.
      // Observe actual host motion instead of assuming when the menu hands off.
      for (let i = 0; i < 500 && f.renders[0].player.y < 34.9; i++) f.frame();
      assert.equal(f.state(), 'running');
      assert.ok(f.renders[0].player.y >= 34.9 && f.renders[0].player.y < 35);
      if (turnPolicy === 'grid-center') {
        // This off-center request cannot turn before the swept closure. It must
        // be discarded there, even though the physical input remains held.
        if (adapter === 'controller') f.pads()[0].axes = [1, 0, 0, 0];
        else f.key('KeyD');
      }
      const beforeTicks = f.renders.map((run) => run.tick);
      const otherY = f.renders[1].player.y;
      const reads = f.readCount();
      f.frame(200);
      assert.deepEqual(
        f.renders.map((run, i) => run.tick - beforeTicks[i]),
        [24, 24],
      );
      assert.equal(f.readCount(), reads + 1, 'one physical sample for all 24 simulation substeps');
      const first = f.renders[0];
      assert.equal(f.state(), 'running');
      assert.equal(first.player.x, level.spawn.x);
      assert.equal(first.player.y, 35);
      assert.equal(first.player.speed, 0);
      assert.equal(first.player.queuedDirection, null);
      assert.equal(first.player.cutting, false);
      assert.ok(first.claimedCount > 0);
      assert.equal(f.renders[1].claimedCount, 0);
      assert.ok(Math.abs(f.renders[1].player.y - otherY - 24 * 13 * FIXED_DT) < 1e-8);
      const stops = f.observedEvents.filter((event) => event.type === 'capture.stopped');
      assert.equal(stops.length, 1);
      assert.equal(
        stops[0].time,
        f.observedEvents.find((event) => event.type === 'cut.closed').time,
      );
      assert.ok(first.time - stops[0].time > 20 * FIXED_DT, 'closure happened early in the frame');
      const stoppedAt = { x: first.player.x, y: first.player.y };
      const otherAfterCut = f.renders[1].player.y;
      f.frames(6);
      if (adapter === 'controller') {
        // Changing a non-neutral held stick cannot bypass the post-cut gate.
        f.pads()[0].axes = [-1, 0, 0, 0];
      } else {
        // Even a repeat:false duplicate keydown is an old physical hold.
        f.key(turnPolicy === 'grid-center' ? 'KeyD' : 'KeyS');
      }
      f.frames(3);
      assert.deepEqual({ x: first.player.x, y: first.player.y }, stoppedAt);
      assert.equal(first.player.speed, 0);
      assert.ok(f.renders[1].player.y > otherAfterCut, 'the other selected direction stays active');
      if (adapter === 'controller') {
        f.pads()[0].axes = [0, 0, 0, 0];
        f.frame();
        assert.deepEqual({ x: first.player.x, y: first.player.y }, stoppedAt);
        f.pads()[0].axes[0] = 1;
        f.frame();
        f.pads()[0].axes[0] = 0;
      } else {
        f.key('KeyS', false);
        if (turnPolicy === 'grid-center') f.key('KeyD', false);
        f.key('KeyD');
        f.key('KeyD', false);
      }
      f.frames(12);
      assert.ok(
        first.player.x > stoppedAt.x,
        'a fresh direction resumes and persists after release',
      );
      assert.equal(first.status, 'running');
      assert.equal(f.renders[1].status, 'running');
      assert.equal(f.observedEvents.filter((event) => event.type === 'capture.stopped').length, 1);
      assert.equal(
        f.observedEvents.some((event) => event.type === 'player.failed'),
        false,
      );
    });
  }
}

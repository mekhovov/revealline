import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { buildCountercurrent, IDS } from './build.mjs';
import { drive } from './controls.mjs';
import { classicEffectActive } from '../../../game/core/classic-state.mjs';
import { FIXED_DT } from '../../../game/core/index.mjs';
import { verifyReplay } from '../../../game/replay.mjs';
import { digest, ordinaryFile } from '../sentinel-circuit/files.mjs';

const PROOF = new URL('./mechanics.json', import.meta.url);

/** Twelve finite probes of the actual authored Standard maps, plus one explicitly
 * named pressure-off sandbox among those twelve. No run state is patched. */
export async function verifyCountercurrentMechanics({ record = false } = {}) {
  assert.equal(typeof record, 'boolean');
  const source = await buildCountercurrent();
  const routeBytes = await ordinaryFile(new URL('./routes.json', import.meta.url), 8 * 1024 * 1024);
  const routes = JSON.parse(routeBytes);
  assert.deepEqual(routes.inputPins, source.inputPins);
  assert.equal(routes.packSha256, digest(source.pack));
  for (const name of ['build.mjs', 'layouts.json', 'controls.mjs'])
    assert.equal(routes.content[name], digest(await readFile(new URL(name, import.meta.url))));
  const north = routes.routes.find(
    (r) => r.id === 'standard/immediate/countercurrent-sandbar-braid/scout/north',
  );
  assert.ok(north);
  // Retain the exact ordinary prefix up to the second actual warning, then take
  // a different return to the right border while its warning is still active.
  const prefix = [];
  let remaining = 1602;
  for (const segment of north.segments) {
    if (!remaining) break;
    assert.equal(segment.input.action, false);
    assert.equal(segment.input.boost, false);
    assert.equal(segment.input.pickup, false);
    assert.equal(segment.input.switchClass, null);
    const ticks = Math.min(remaining, segment.ticks);
    prefix.push({ ticks, direction: segment.input.direction });
    remaining -= ticks;
  }
  assert.equal(remaining, 0);
  const plans = [
    {
      id: 'wall-return',
      map: 0,
      commands: [
        { to: ['right', 20.5] },
        { to: ['up', 12.5] },
        { ticks: 120, direction: 'up' },
        { ticks: 120, direction: null },
      ],
    },
    {
      id: 'slow-bonus',
      map: 0,
      commands: [
        { to: ['right', 9.5] },
        { to: ['down', 28.5] },
        { to: ['left', 0.5] },
        { ticks: 900, direction: null },
      ],
    },
    {
      id: 'speed-bonus',
      map: 1,
      commands: [
        { to: ['left', 8.5] },
        { to: ['up', 5.5] },
        { to: ['left', 0.5] },
        { ticks: 900, direction: null },
      ],
    },
    {
      id: 'freeze-bonus',
      map: 2,
      commands: [
        { to: ['right', 8.5] },
        { to: ['down', 27.5] },
        { to: ['left', 0.5] },
        { ticks: 600, direction: null },
      ],
    },
    ...IDS.map((id, map) => ({
      id: 'inward-idle-' + id,
      map,
      commands: [
        { ticks: 32, direction: map === 1 ? 'up' : 'right' },
        { ticks: 2400, direction: null },
      ],
    })),
    {
      id: 'warning-return',
      map: 1,
      commands: [...prefix, { to: ['right', 71.5] }, { ticks: 240, direction: null }],
    },
    {
      id: 'pressure-off-contrast',
      map: 1,
      sandbox: true,
      commands: [...prefix, { to: ['right', 71.5] }, { ticks: 240, direction: null }],
    },
    { id: 'lane-overlap', map: 2, commands: [{ ticks: 600, direction: null }] },
    { id: 'horizontal-contact', map: 2, commands: [{ untilLoss: true, direction: 'right' }] },
    {
      id: 'vertical-contact',
      map: 2,
      commands: [
        { to: ['right', 12.5] },
        { to: ['down', 35.5] },
        { to: ['right', 13.5] },
        { ticks: 264, direction: null },
        { untilLoss: true, direction: 'up' },
      ],
    },
  ];
  assert.equal(plans.length, 12);
  const results = [];
  for (const plan of plans) {
    let level = source.pack.campaigns[0].levels[plan.map];
    if (plan.sandbox) {
      level = structuredClone(level);
      level.id += '-pressure-off';
      level.revision = 'sandbox1';
      delete level.classic.enemyPressure;
    }
    const observed = {
      effectTicks: {},
      overlapTicks: 0,
      firstActive: {},
      maxPlayerSpeed: 0,
      warningReturnCue: null,
      freezeUnchanged: 0,
      freezeMoved: 0,
      postFreezeMoves: 0,
      halfSpeedComparisons: 0,
      last: null,
    };
    let previous = null;
    const driven = drive(level, source.pack.classRecipes, 'immediate', plan.commands, {
      onTick({ run }) {
        for (const kind of ['enemy-slow', 'player-speed', 'enemy-freeze'])
          if (classicEffectActive(run, kind))
            observed.effectTicks[kind] = (observed.effectTicks[kind] ?? 0) + 1;
        observed.maxPlayerSpeed = Math.max(observed.maxPlayerSpeed, run.player.speed);
        const lanes = run.enemies.filter((e) => e.type === 'lane-boss');
        if (lanes.length === 2 && lanes.every((e) => e.bossPhase === 'active'))
          observed.overlapTicks++;
        for (const actor of lanes)
          if (actor.bossPhase === 'active' && !observed.firstActive[actor.id])
            observed.firstActive[actor.id] = { tick: run.tick, lane: actor.lane };
        if (run.tick === 1602)
          observed.warningReturnCue = {
            player: { x: run.player.x, y: run.player.y },
            events: structuredClone(run.events),
            pressure: structuredClone(
              run.enemies.find((e) => e.id === 'braid-interceptor')?.classic?.pressure ?? null,
            ),
          };
        const positions = run.enemies.map((e) => ({ id: e.id, x: e.x, y: e.y }));
        if (previous) {
          const changed = JSON.stringify(positions) !== JSON.stringify(previous.positions);
          if (
            classicEffectActive(run, 'enemy-freeze') &&
            previous.freeze &&
            !run.events.some((e) => e.type === 'cells.claimed')
          )
            observed[changed ? 'freezeMoved' : 'freezeUnchanged']++;
          if (
            run.classic.effects['enemy-freeze'].until > 0 &&
            run.tick > run.classic.effects['enemy-freeze'].until &&
            changed
          )
            observed.postFreezeMoves++;
          if (
            classicEffectActive(run, 'enemy-slow') &&
            previous.slow &&
            !run.events.some((e) => e.type === 'cells.claimed')
          )
            for (const enemy of run.enemies.filter((e) => e.type === 'bouncer')) {
              const before = previous.positions.find((e) => e.id === enemy.id);
              const ratio =
                Math.hypot(enemy.x - before.x, enemy.y - before.y) /
                (Math.hypot(enemy.vx, enemy.vy) * FIXED_DT);
              if (Math.abs(ratio - 0.5) < 1e-7) observed.halfSpeedComparisons++;
            }
        }
        previous = {
          positions,
          freeze: classicEffectActive(run, 'enemy-freeze'),
          slow: classicEffectActive(run, 'enemy-slow'),
        };
        observed.last = {
          tick: run.tick,
          player: structuredClone(run.player),
          trailCells: run.trail.length,
          effects: structuredClone(run.classic.effects),
          actors: positions,
        };
      },
    });
    assert.equal(verifyReplay(driven.replay).match, true, plan.id);
    const events = driven.metrics.notable.filter((e) => e.type !== 'cells.claimed');
    results.push({
      id: plan.id,
      levelId: level.id,
      sandbox: plan.sandbox === true,
      commands: plan.commands,
      expected: driven.expected,
      observed,
      events,
      captures: driven.metrics.captures,
      replay: driven.replay,
    });
  }
  const get = (id) => results.find((row) => row.id === id);
  const wall = get('wall-return');
  assert.equal(wall.expected.livesLost, 0);
  assert.equal(wall.observed.last.player.cutting, true);
  assert.equal(wall.observed.last.player.speed, 0);
  assert.equal(wall.observed.last.player.x, 20.5);
  assert.ok(wall.observed.last.player.y >= 10 && wall.observed.last.player.y <= 10.2);
  assert.ok(wall.observed.last.trailCells > 0);
  assert.equal(wall.captures.length, 0, 'A solid wall is not captured safe ground.');
  for (const [id, kind, ticks] of [
    ['slow-bonus', 'enemy-slow', 720],
    ['speed-bonus', 'player-speed', 600],
    ['freeze-bonus', 'enemy-freeze', 360],
  ]) {
    const row = get(id),
      collected = row.events.filter((e) => e.type === 'powerup.collected');
    assert.equal(collected.length, 1);
    assert.equal(collected[0].kind, kind);
    assert.equal(collected[0].activationTick, collected[0].tick + 1);
    assert.equal(collected[0].untilTick - collected[0].activationTick, ticks);
    assert.equal(row.observed.effectTicks[kind], ticks);
    assert.ok(row.observed.last.tick > row.observed.last.effects[kind].until);
    assert.equal(row.expected.livesLost, 0);
    assert.equal(row.observed.last.player.cutting, false);
  }
  assert.ok(get('slow-bonus').observed.halfSpeedComparisons > 100);
  assert.equal(get('speed-bonus').observed.maxPlayerSpeed, 18.75);
  assert.ok(get('freeze-bonus').observed.freezeUnchanged > 300);
  assert.equal(get('freeze-bonus').observed.freezeMoved, 0);
  assert.ok(get('freeze-bonus').observed.postFreezeMoves > 0);
  for (const [map, cause, actorId] of [
    [0, null, null],
    [1, 'enemy-trail', 'braid-interceptor'],
    [2, 'boss-lane', 'watch-horizontal'],
  ]) {
    const row = get('inward-idle-' + IDS[map]);
    assert.equal(row.events.filter((e) => e.type === 'cut.started').length, 1);
    assert.equal(row.expected.coverage, 0);
    assert.equal(row.expected.status, 'running');
    assert.equal(row.expected.tick, 2432);
    const failures = row.events.filter((e) => e.type === 'player.failed');
    assert.equal(failures.length, map === 0 ? 0 : 1);
    if (map !== 0) {
      assert.equal(failures[0].cause, cause);
      assert.equal(failures[0].actorId, actorId);
    } else assert.equal(row.observed.last.player.cutting, true);
  }
  const retreat = get('warning-return'),
    cue = retreat.observed.warningReturnCue;
  assert.equal(cue.pressure.phase, 'warning');
  assert.equal(cue.pressure.warningUntil, 1722);
  const cancel = retreat.events.find((e) => e.type === 'pressure.cancelled' && e.tick > 1602);
  assert.equal(cancel.reason, 'trail-closed');
  assert.ok(cancel.tick < cue.pressure.warningUntil);
  assert.equal(retreat.expected.livesLost, 0);
  assert.equal(retreat.observed.last.player.cutting, false);
  assert.equal(retreat.observed.last.player.x, 71.5);
  const contrast = get('pressure-off-contrast');
  assert.notEqual(contrast.levelId, retreat.levelId);
  assert.ok(!contrast.events.some((e) => e.type.startsWith('pressure.')));
  assert.deepEqual(contrast.commands, retreat.commands);
  assert.notDeepEqual(contrast.observed.last.actors, retreat.observed.last.actors);
  const overlap = get('lane-overlap');
  assert.equal(overlap.observed.overlapTicks, 42);
  assert.equal(overlap.expected.livesLost, 0);
  assert.deepEqual(
    Object.values(overlap.observed.firstActive).map((v) => v.tick),
    [421, 457],
  );
  for (const [id, actorId, cause] of [
    ['horizontal-contact', 'watch-horizontal', 'boss-lane'],
    ['vertical-contact', 'watch-vertical', 'enemy-trail'],
  ]) {
    const row = get(id),
      failure = row.events.find((e) => e.type === 'player.failed');
    assert.equal(row.expected.status, 'respawning');
    assert.equal(row.expected.livesLost, 1);
    assert.equal(failure.actorId, actorId);
    assert.equal(failure.cause, cause);
    assert.ok(
      row.events.find((e) => e.type === 'boss.warning' && e.id === actorId).tick < failure.tick,
    );
    if (id === 'vertical-contact')
      assert.ok(row.events.some((e) => e.type === 'lineImpact.arrived' && e.actorId === actorId));
  }
  const result = {
    format: 'revealline-countercurrent-mechanics.v1',
    source: {
      packSha256: digest(source.pack),
      routesSha256: digest(routeBytes),
      verifierSha256: digest(await readFile(new URL('./mechanics.mjs', import.meta.url))),
    },
    probes: results,
    limits:
      'Twelve Standard/immediate/Scout source probes, including one distinct pressure-off sandbox. No native play, balance, artwork, production approval or other difficulty/roster mechanic claim.',
  };
  if (record) await writeFile(PROOF, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  else assert.deepEqual(result, JSON.parse(await ordinaryFile(PROOF, 2 * 1024 * 1024)));
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  assert.ok(args.length === 0 || (args.length === 1 && args[0] === '--record'));
  const result = await verifyCountercurrentMechanics({ record: args[0] === '--record' });
  console.log(
    JSON.stringify({ probes: result.probes.length, ids: result.probes.map((p) => p.id) }),
  );
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { getCoopSummary } from '../coop/core.mjs';
import { FIRST_CONNECTION } from '../coop/first-connection.mjs';
import { RELAY_YARD } from '../coop/relay-yard.mjs';
import {
  coverageClear,
  yardOpening,
  cornerOpening,
  oldYardShortcut,
  replayRoute,
} from './helpers/coop-route-search.mjs';

const difficulties = ['gentle', 'standard', 'expert'];
const downs = (events) => events.filter((event) => event.type === 'player.downed');
const rounded = (value) =>
  JSON.parse(
    JSON.stringify(value, (_key, item) =>
      typeof item === 'number' && Number.isFinite(item) ? Math.round(item * 1e8) / 1e8 : item,
    ),
  );

function physicalState(run, swapped = false) {
  const seat = (id) => (swapped && Number.isInteger(id) ? 1 - id : id);
  const summary = getCoopSummary(run);
  summary.players = summary.players
    .map((player) => ({
      ...player,
      id: seat(player.id),
      rescue: player.rescue ? { ...player.rescue, target: seat(player.rescue.target) } : null,
    }))
    .sort((a, b) => a.id - b.id);
  return rounded({
    summary,
    enemies: run.enemies.map((enemy) => ({ ...enemy, target: seat(enemy.target) })),
    supports: run.players
      .map((player) => ({ id: seat(player.id), ...player.support }))
      .sort((a, b) => a.id - b.id),
    impacts: run.impacts.map((impact) => ({ ...impact, player: seat(impact.player) })),
  });
}

// These are rehearsed, simulation-informed route proofs. They establish legal
// wins and counterplay, not normal completion times, enjoyment, or first-attempt success.
for (const difficulty of difficulties) {
  for (const [level, route] of [
    [FIRST_CONNECTION, coverageClear],
    [RELAY_YARD, yardOpening],
  ]) {
    test(`${level.name} ${difficulty}: public-command teamwork route wins and replays after exchanging seats`, (t) => {
      const original = structuredClone(level);
      const result = route(difficulty, { boost: true, cover: true });
      const { run, log, events } = result;
      assert.equal(run.status, 'won', JSON.stringify(result.stages));
      assert.equal(downs(events).length, 0);
      assert.ok(events.some((event) => event.type === 'cut.joint'));
      assert.ok(events.some((event) => event.type === 'enemy.warning'));
      assert.ok(events.some((event) => event.type === 'enemy.commit'));
      assert.ok(run.players.every((player) => player.status === 'active' && !player.cutting));
      assert.equal(events.filter((event) => event.type === 'run.completed').length, 1);
      assert.deepEqual(level, original, 'route search must not rewrite the authored arena');
      if (level.goal.cores) {
        const shield = events.find((event) => event.type === 'shield.disabled');
        const core = events.find((event) => event.type === 'core.defeated');
        assert.ok(core && shield && core.time > shield.time);
        assert.ok(run.strongholds.every((hold) => hold.defeated));
        assert.ok(
          events.some(
            (event) =>
              event.type === 'support.pulse' &&
              event.slowedEnemies.some((id) => id.includes('drifter')),
          ),
        );
      } else assert.ok(run.coverage >= level.goal.coverage);

      const replay = replayRoute(level, difficulty, log);
      assert.deepEqual(physicalState(replay.run), physicalState(run));
      assert.deepEqual(replay.events, events);
      assert.deepEqual(replay.run.cells, run.cells);
      const swapped = replayRoute(level, difficulty, log, { swapped: true });
      assert.deepEqual(physicalState(swapped.run, true), physicalState(run));
      assert.deepEqual(swapped.run.cells, run.cells);
      assert.equal(downs(swapped.events).length, 0);

      // Exact same direction/Boost/release stream; remove only Support bits.
      const without = replayRoute(level, difficulty, log, { withoutSupport: true });
      const needsCover =
        difficulty === 'expert' || (level.id === FIRST_CONNECTION.id && difficulty === 'standard');
      if (needsCover) {
        assert.ok(downs(without.events).length > 0);
        assert.notEqual(without.run.status, 'won');
      } else assert.equal(without.run.status, 'won');
      t.diagnostic(
        JSON.stringify({
          rehearsedSeconds: run.time,
          coverage: run.coverage,
          withoutSupport: {
            status: without.run.status,
            downs: downs(without.events).length,
            coverage: without.run.coverage,
          },
          actualSlowEvents: events.filter(
            (event) => event.type === 'support.pulse' && event.slowedEnemies.length,
          ).length,
        }),
      );
    });
  }

  test(`Relay Yard ${difficulty}: walking, a safe waiting window, and local cover can win without Boost`, (t) => {
    const result = yardOpening(difficulty, { boost: false, cover: true, waitAfterOpening: 300 });
    assert.equal(result.run.status, 'won', JSON.stringify(result.stages));
    assert.ok(result.log.every((commands) => commands.every((command) => !command.boost)));
    assert.equal(downs(result.events).length, 0);
    const waiting = result.stages.findIndex(
      (stage) => stage.label === 'wait on newly banked safe ground',
    );
    assert.equal(result.stages[waiting].tick - result.stages[waiting - 1].tick, 300);
    assert.ok(result.stages[waiting].players.every((player) => !player.cutting));
    const slowed = result.events
      .filter((event) => event.type === 'support.pulse')
      .flatMap((event) => event.slowedEnemies);
    assert.ok(slowed.includes('yard-drifter-left'));
    assert.ok(slowed.includes('yard-drifter-right'));
    const swapped = replayRoute(RELAY_YARD, difficulty, result.log, { swapped: true });
    assert.deepEqual(physicalState(swapped.run, true), physicalState(result.run));
    assert.deepEqual(swapped.run.cells, result.run.cells);
    t.diagnostic(`Rehearsed walking clear: ${result.run.time.toFixed(2)} seconds, no knockdowns.`);
  });

  for (const level of [FIRST_CONNECTION, RELAY_YARD]) {
    test(`${level.name} ${difficulty}: short unboosted corner cuts provide a lower-risk opening`, () => {
      const result = cornerOpening(level, difficulty);
      assert.equal(downs(result.events).length, 0);
      assert.ok(result.run.coverage >= 0.04 && result.run.coverage < 0.05);
      assert.ok(result.run.players.every((player) => !player.cutting));
      assert.ok(
        result.log.every((commands) =>
          commands.every((command) => !command.boost && !command.support),
        ),
      );
    });
  }

  test(`Relay Yard ${difficulty}: upper patrol guards stop the former unopposed core shortcut`, () => {
    const result = oldYardShortcut(difficulty);
    assert.ok(result.events.some((event) => event.type === 'shield.disabled'));
    assert.equal(result.run.strongholds[0].defeated, false);
    assert.deepEqual(
      downs(result.events)
        .map((event) => event.player)
        .sort(),
      [0, 1],
    );
    assert.ok(downs(result.events).every((event) => event.cause === 'enemy-trail'));
    assert.equal(result.events.filter((event) => event.type === 'team.recovery').length, 1);
    assert.equal(result.events.filter((event) => event.type === 'support.pulse').length, 0);
  });
}

test('Expert walking guard window supports a real spark interception before the core is secured', () => {
  const result = yardOpening('expert', { boost: false, cover: true, waitAfterOpening: 180 });
  assert.equal(result.run.status, 'won');
  assert.equal(downs(result.events).length, 0);
  assert.ok(result.events.some((event) => event.type === 'impact.launched'));
  const intercepted = result.events.find((event) => event.type === 'impact.intercepted');
  assert.ok(intercepted);
  assert.ok(
    result.events.some(
      (event) =>
        event.type === 'support.pulse' && event.interceptedImpacts.includes(intercepted.impact),
    ),
  );
  assert.ok(result.events.find((event) => event.type === 'core.defeated').time > intercepted.time);
});

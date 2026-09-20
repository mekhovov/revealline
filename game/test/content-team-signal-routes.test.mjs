import test from 'node:test';
import assert from 'node:assert/strict';
import { createTeamSignalCandidates } from '../content-design/team-signal-candidates.mjs';
import { resolveContentJourney } from '../content-design/journey.mjs';
import { createCoop, startCoop, stepCoop, FIXED_DT, SAFE } from '../coop/core.mjs';

// Fixed public-input route. Long segments include stopped time; this proves
// feasibility, not ordinary player pacing, enjoyment or optimal cooperation.
const route = [
  ['up', 'down', 240],
  ['right', 'left', 180],
  ['down', 'up', 700],
  ['up', 'down', 460],
  ['left', 'right', 120],
  ['down', 'up', 700],
  ['up', 'down', 460],
  ['left', 'right', 120],
  ['down', 'up', 700],
];
const command = (direction) => ({ direction, boost: false, support: false });
function play(level, jointCuts, delay = 0) {
  const run = createCoop(level, { seed: 1, jointCuts }),
    events = [];
  startCoop(run);
  for (let tick = 0; tick < Math.round(delay / FIXED_DT); tick++)
    stepCoop(run, [command(null), command(null)], FIXED_DT);
  for (const [a, b, count] of route) {
    stepCoop(run, [command(null), command(null)], FIXED_DT);
    for (let tick = 0; tick < count && run.status === 'running'; tick++) {
      stepCoop(run, [command(a), command(b)], FIXED_DT);
      events.push(...structuredClone(run.events));
    }
  }
  return { run, events };
}
for (const difficulty of ['gentle', 'standard', 'expert'])
  for (const jointCuts of [true, false])
    for (const delay of [0, 0.25, 0.5])
      test(`Shared detour legal two-seat material route: ${difficulty}, joint cuts ${jointCuts}, delay ${delay}s`, () => {
        const source = createTeamSignalCandidates(),
          before = structuredClone(source);
        const journey = resolveContentJourney(source, { mode: 'team', difficulty });
        const level = journey.campaigns[0].runtime.levels[0];
        const first = play(level, jointCuts, delay),
          second = play(level, jointCuts, delay);
        assert.equal(first.run.status, 'won');
        assert(first.run.coverage >= 0.7);
        assert.equal(first.run.totalClaimable, 70 * 34 - 135);
        assert.equal(
          first.events.some((event) => event.type === 'player.downed'),
          false,
        );
        assert.deepEqual(
          [
            ...new Set(
              first.events
                .filter((event) => event.type === 'cut.closed')
                .map((event) => event.player),
            ),
          ].sort(),
          [0, 1],
        );
        for (const area of level.terrain)
          for (let y = area.y; y < area.y + area.h; y++)
            for (let x = area.x; x < area.x + area.w; x++)
              assert.equal(first.run.cells[y * 72 + x], SAFE, `${area.id}: ${x},${y}`);
        assert.deepEqual(first, second);
        assert.deepEqual(source, before);
        assert.equal(journey.campaigns[0].manifests[0].background, null);
        assert.equal(
          journey.campaigns[0].manifests[0].validation,
          'compiled-candidate-not-playtested',
        );
      });

test('waiting for the later departure window still permits all preset clears; clear is not terrain mastery', () => {
  for (const difficulty of ['gentle', 'standard', 'expert'])
    for (const jointCuts of [true, false]) {
      const level = resolveContentJourney(createTeamSignalCandidates(), {
        mode: 'team',
        difficulty,
      }).campaigns[0].runtime.levels[0];
      const first = play(level, jointCuts, 5);
      assert.equal(first.run.status, 'won');
      assert(first.run.coverage >= level.goal.coverage);
      assert.equal(
        first.events.some((event) => event.type === 'player.downed'),
        false,
      );
      const materialRemaining = level.terrain.some((area) => {
        for (let y = area.y; y < area.y + area.h; y++)
          for (let x = area.x; x < area.x + area.w; x++)
            if (first.run.cells[y * 72 + x] !== SAFE) return true;
        return false;
      });
      assert.equal(materialRemaining, difficulty !== 'gentle');
      assert.deepEqual(first, play(level, jointCuts, 5));
    }
});

test('an occupied-region closure does not silently award an incomplete delayed Expert attempt', () => {
  const level = resolveContentJourney(createTeamSignalCandidates(), {
    mode: 'team',
    difficulty: 'expert',
  }).campaigns[0].runtime.levels[0];
  for (const delay of [1, 2]) {
    const result = play(level, true, delay);
    assert.equal(result.run.status, 'running');
    assert(result.run.coverage < 0.7);
    assert(result.events.some((event) => event.type === 'player.downed'));
    assert(result.events.some((event) => event.type === 'cut.closed'));
    assert.deepEqual(result, play(level, true, delay));
  }
});

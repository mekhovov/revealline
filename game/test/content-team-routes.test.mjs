import test from 'node:test';
import assert from 'node:assert/strict';
import { createTeamOpeningCandidates } from '../content-design/team-candidates.mjs';
import { resolveContentJourney } from '../content-design/journey.mjs';
import { createCoop, startCoop, stepCoop, FIXED_DT, SAFE } from '../coop/core.mjs';

// Authored public-input feasibility route, not a pacing/enjoyment measurement.
const route = [
  ['up', 'down', 220],
  ['right', 'left', 180],
  ['down', 'up', 460],
  ['up', 'down', 210],
  ['left', 'right', 460],
  ['up', 'down', 210],
  ['right', 'left', 460],
  ['down', 'up', 210],
  ['left', 'right', 460],
];
const command = (direction) => ({ direction, boost: false, support: false });
function play(level, jointCuts) {
  const run = createCoop(level, { seed: 1, jointCuts });
  const events = [];
  startCoop(run);
  const tick = (a, b) => {
    stepCoop(run, [command(a), command(b)], FIXED_DT);
    events.push(...structuredClone(run.events));
  };
  for (const [a, b, frames] of route) {
    tick(null, null);
    for (let frame = 0; frame < frames && run.status === 'running'; frame++) tick(a, b);
  }
  return { run, events };
}

for (const difficulty of ['gentle', 'standard', 'expert']) {
  for (const jointCuts of [true, false]) {
    test(`Twin landings has a complete two-seat route: ${difficulty}, joint cuts ${jointCuts}`, () => {
      const source = createTeamOpeningCandidates();
      const before = structuredClone(source);
      const level = resolveContentJourney(source, { mode: 'team', difficulty }).campaigns[0].runtime
        .levels[0];
      const first = play(level, jointCuts);
      const second = play(level, jointCuts);
      assert.equal(first.run.status, 'won');
      assert(first.run.coverage >= level.goal.coverage);
      assert.equal(first.run.totalClaimable, 70 * 34 - 50);
      assert(first.run.time < 30, 'omniscient reference route only, not a human duration claim');
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
      for (const rectangle of level.safeRects)
        for (let y = rectangle.y; y < rectangle.y + rectangle.h; y++)
          for (let x = rectangle.x; x < rectangle.x + rectangle.w; x++)
            assert.equal(first.run.cells[y * 72 + x], SAFE);
      assert.deepEqual(first, second, 'same commands reproduce exact two-player state and events');
      assert.deepEqual(source, before);
    });
  }
}

test('Twin landings explicitly needs Team; it cannot silently become a Solo or paired race mission', () => {
  const source = createTeamOpeningCandidates();
  for (const mode of ['solo', 'versus'])
    assert.throws(() => resolveContentJourney(source, { mode }), /no missions/);
  const journey = resolveContentJourney(source, { mode: 'team' });
  assert.equal(journey.missions.length, 1);
  assert.equal(journey.campaigns[0].manifests[0].background, null);
  assert.equal(journey.campaigns[0].manifests[0].validation, 'compiled-candidate-not-playtested');
});

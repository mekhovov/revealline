import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTeamTimedCandidates } from '../content-design/team-timed-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { assessTeamTimedRoute } from './helpers/team-timed-route.mjs';

const project = compileContentProject(createTeamTimedCandidates());
const evidence = JSON.parse(
  await readFile(new URL('./fixtures/team-relocation-routes.json', import.meta.url)),
);
const summary = (r) => ({
  status: r.status,
  tick: r.tick,
  coverage: r.coverage,
  returns: r.returns,
  firstDown: r.firstDown,
  collected: r.collected,
  bonusEvents: r.bonusEvents,
  bothIdleTicks: r.bothIdleTicks,
  checkpoint: r.checkpoint,
});

test('relocation evidence distinguishes four Expert clears from two failed fixed-route probes', () => {
  assert.equal(evidence.format, 'TeamRelocationRouteEvidenceV1');
  assert.equal(evidence.missionId, 'depot-dash');
  assert.deepEqual(
    evidence.runs.map((r) => ({ difficulty: r.difficulty, ...r.options })),
    [
      ...[false, true].flatMap((swapped) =>
        [false, true].map((jointCuts) => ({
          difficulty: 'expert',
          seed: 1,
          delayTicks: 0,
          swapped,
          jointCuts,
        })),
      ),
      ...['gentle', 'standard'].map((difficulty) => ({
        difficulty,
        seed: 1,
        delayTicks: 0,
        swapped: false,
        jointCuts: true,
      })),
    ],
  );
});

for (const check of evidence.runs)
  test(`${check.difficulty}/swap${check.options.swapped}/joint${check.options.jointCuts}: ${check.result.status}`, () => {
    const manifest = resolveMission(project, evidence.missionId, {
      mode: 'team',
      difficulty: check.difficulty,
    });
    assert.equal(manifest.simulationIdentity, check.simulationIdentity);
    const r = assessTeamTimedRoute(manifest.level, evidence.log, check.options);
    assert.deepEqual(summary(r), check.result);
    assert.deepEqual(
      summary(assessTeamTimedRoute(manifest.level, evidence.log, check.options)),
      check.result,
    );
    if (check.difficulty !== 'expert') {
      assert.equal(r.status, 'first-knockdown');
      assert(r.firstDown);
      assert.equal(r.collected.length, 0);
      assert.equal(r.tick, { gentle: 2076, standard: 2169 }[check.difficulty]);
      return;
    }
    assert.equal(r.status, 'shared-no-loss-clear');
    assert.equal(r.firstDown, null);
    assert(r.returns.every((n) => n >= 3));
    assert.equal(
      r.bothIdleTicks,
      18,
      'Retain incidental stop ticks rather than calling this zero-idle.',
    );
    const timeline = r.bonusEvents.filter((e) => e.id === 'depot-speed');
    assert.deepEqual(
      timeline.map((e) => [e.type, e.tick, e.x, e.y]),
      [
        ['bonus.announced', 239, 19.5, 6.5],
        ['bonus.appeared', 359, 19.5, 6.5],
        ['bonus.expired', 1559, 19.5, 6.5],
        ['bonus.announced', 2519, 52.5, 29.5],
        ['bonus.appeared', 2639, 52.5, 29.5],
      ],
    );
    assert.equal(timeline[2].tick - timeline[1].tick, 1200);
    assert.equal(timeline[3].tick - timeline[2].tick, 960);
    assert.equal(timeline[4].tick - timeline[3].tick, 120);
    const before = assessTeamTimedRoute(manifest.level, evidence.log.slice(0, 20), check.options);
    assert.equal(before.tick, 2676);
    assert.equal(before.collected.length, 0);
    assert(
      before.coverage > 0.7,
      'The missed window includes real captures, not a parked waiting period.',
    );
    assert(before.returns.every((n) => n >= 2));
    const live = before.remainingBonuses.find((b) => b.id === 'depot-speed');
    assert(live);
    assert.deepEqual([live.x, live.y, live.reclaimed], [52.5, 29.5, false]);
    assert.equal(r.collected.length, 1);
    const item = r.collected[0];
    assert.equal(item.id, 'depot-speed');
    assert.equal(item.kind, 'player-speed');
    assert.deepEqual(item.players, [check.options.swapped ? 1 : 0]);
    assert.deepEqual([item.x, item.y], [52.5, 29.5]);
    assert.equal(item.tick, 2836);
    assert(item.tick > timeline[4].tick && item.tick < timeline[4].tick + 1200);
    assert.equal(item.reclaimedBeforeContactStep, false);
    assert.equal(
      item.partnerCutting,
      false,
      'This is relocation feasibility, not concurrent collection/cooperation mastery.',
    );
    assert(
      r.closures.some(
        (c) =>
          c.player === item.players[0] && c.reason === 'return' && c.tick > item.tick && c.speed,
      ),
    );
    assert.equal(r.tick, 2857);
  });

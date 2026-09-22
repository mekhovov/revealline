import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTeamTimedCandidates } from '../content-design/team-timed-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { assessTeamTimedRoute } from './helpers/team-timed-route.mjs';
const project = compileContentProject(createTeamTimedCandidates());
const evidence = JSON.parse(
  await readFile(new URL('./fixtures/team-reserve-routes.json', import.meta.url)),
);
const summary = (r) => ({
  status: r.status,
  tick: r.tick,
  coverage: r.coverage,
  returns: r.returns,
  collected: r.collected,
  bonusEvents: r.bonusEvents,
  initialReserves: r.initialReserves,
  finalReserves: r.finalReserves,
  bothIdleTicks: r.bothIdleTicks,
  checkpoint: r.checkpoint,
});
test('reserve evidence pins all three presets and both seat/joint configurations', () => {
  assert.equal(evidence.format, 'TeamReserveRouteEvidenceV1');
  assert.deepEqual(evidence.rows.map((r) => r.difficulty).sort(), ['expert', 'gentle', 'standard']);
  for (const row of evidence.rows) {
    assert.equal(row.missionId, 'depot-dash');
    assert.deepEqual(
      row.checks.map((c) => JSON.stringify(c.options)),
      [false, true].flatMap((swapped) =>
        [false, true].map((jointCuts) =>
          JSON.stringify({ seed: 1, delayTicks: 0, swapped, jointCuts }),
        ),
      ),
    );
  }
});
for (const row of evidence.rows)
  for (const check of row.checks)
    test(`${row.difficulty}/swap${check.options.swapped}/joint${check.options.jointCuts}: contact grants one shared reserve and both pilots clear`, () => {
      const manifest = resolveMission(project, row.missionId, {
        mode: 'team',
        difficulty: row.difficulty,
      });
      assert.equal(manifest.simulationIdentity, row.simulationIdentity);
      const r = assessTeamTimedRoute(manifest.level, row.log, check.options);
      assert.deepEqual(summary(r), check.result);
      assert.deepEqual(
        summary(assessTeamTimedRoute(manifest.level, row.log, check.options)),
        check.result,
      );
      assert.equal(r.status, 'shared-no-loss-clear');
      assert.equal(r.firstDown, null);
      assert(r.returns.every((n) => n >= 2));
      assert.equal(r.initialReserves, { gentle: 4, standard: 2, expert: 1 }[row.difficulty]);
      assert.equal(r.finalReserves, r.initialReserves + 1);
      const lives = r.collected.filter((e) => e.kind === 'extra-life');
      assert.equal(lives.length, 1);
      const item = lives[0];
      assert.equal(item.gain, 1);
      assert.equal(item.partnerCutting, true);
      assert.deepEqual([item.x, item.y], [52.5, 7.5]);
      assert.deepEqual(item.players, [check.options.swapped ? 1 : 0]);
      const timeline = r.bonusEvents.filter((e) => e.id === 'depot-reserve');
      assert.deepEqual(
        timeline.map((e) => e.type),
        ['bonus.announced', 'bonus.appeared'],
      );
      assert.equal(timeline[1].tick - timeline[0].tick, 120);
      assert(item.tick > timeline[1].tick && item.tick < timeline[1].tick + 1200);
      assert(
        r.closures.some(
          (c) => c.reason === 'return' && c.player === 1 - item.players[0] && c.tick > item.tick,
        ),
      );
      assert.deepEqual(
        r.collected.map((e) => e.kind),
        row.difficulty === 'standard' ? ['extra-life'] : ['player-speed', 'extra-life'],
      );
      // Recorded incidental stop/boundary ticks are not erased or called continuous motion.
      assert.equal(r.bothIdleTicks, { gentle: 0, standard: 17, expert: 6 }[row.difficulty]);
      if (row.difficulty === 'standard') {
        assert.equal(
          timeline[1].tick,
          1919,
          'The first eligible reserve window is later, not an expiry/relocation claim.',
        );
        const before = assessTeamTimedRoute(manifest.level, row.log.slice(0, 17), check.options);
        assert.equal(before.tick, 2856);
        assert.equal(before.collected.length, 0);
        assert.equal(before.initialReserves, before.finalReserves);
        assert.equal(
          before.remainingBonuses.find((b) => b.id === 'depot-reserve')?.reclaimed,
          true,
        );
        assert.equal(
          item.reclaimedBeforeContactStep,
          true,
          'Enclosing a materialized pickup must leave it for later contact.',
        );
      } else {
        assert.equal(timeline[1].tick, 959);
        assert.equal(item.reclaimedBeforeContactStep, false);
      }
    });

import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createRun, stepRun, FIXED_DT } from '../game/core/index.mjs';
import { commitCapture } from '../game/core/capture.mjs';
import { analyzeRouteCoverage } from '../game/core/coverage.mjs';
import { validatePack } from '../game/packs.mjs';

// Content audit, not an enemy-avoidance bot: replay constructive capture routes
// through the actual capture engine with enemy seeds held at their spawn cells.
// Timing, moving threats and player skill remain gameplay challenges.
const levels = [];
for (const id of ['neon-reference-pack', 'neon-mosaic-pack']) {
  const pack = JSON.parse(
    await readFile(new URL(`../game/content/packs/${id}.json`, import.meta.url)),
  );
  const validation = validatePack(pack);
  assert.ok(validation.valid, validation.errors.join('; '));
  for (const level of pack.campaigns.flatMap((c) => c.levels)) {
    const run = createRun(level);
    assert.ok(run.classic.coverageEligible, `${level.id}: coverage policy missing`);
    const analysis = analyzeRouteCoverage(level, run.cells, { includeCuts: true });
    let cutsToGoal = null,
      captures = 0,
      longestCut = 0;
    for (const path of analysis.cuts) {
      // The initial anchor must be reachable on committed safe ground.
      const seen = new Set([Math.floor(level.spawn.y) * run.width + Math.floor(level.spawn.x)]),
        queue = [...seen];
      const adjacent = (i) =>
        [i - run.width, i + 1, i + run.width, i - 1].filter(
          (n) =>
            n >= 0 &&
            n < run.cells.length &&
            Math.abs((n % run.width) - (i % run.width)) +
              Math.abs(Math.floor(n / run.width) - Math.floor(i / run.width)) ===
              1,
        );
      for (let p = 0; p < queue.length && !seen.has(path[0]); p++)
        for (const n of adjacent(queue[p]))
          if (!seen.has(n) && run.cells[n] === 1) {
            seen.add(n);
            queue.push(n);
          }
      assert.ok(seen.has(path[0]), `${level.id}: unreachable cut start`);
      assert.equal(run.cells[path.at(-1)], 1);
      let trail = [];
      for (let i = 1; i < path.length; i++) {
        const cell = path[i];
        assert.ok(adjacent(path[i - 1]).includes(cell));
        assert.notEqual(run.cells[cell], 2);
        assert.ok(run.cells[cell] === 1 || run.classic.terrain[cell] !== 2);
        if (run.cells[cell] === 0) trail.push({ index: cell });
        else if (trail.length) {
          assert.equal(new Set(trail.map((c) => c.index)).size, trail.length);
          longestCut = Math.max(longestCut, trail.length);
          run.trail = trail;
          run.player.cutting = true;
          commitCapture(run);
          trail = [];
          captures++;
          const earned = run.cells.reduce(
            (n, kind, index) => n + Number(kind === 1 && analysis.eligible[index]),
            0,
          );
          assert.equal(run.claimedCount, earned);
          assert.equal(run.coverage, earned / analysis.total);
          assert.ok(run.coverage <= 1);
          if (cutsToGoal === null && run.coverage >= level.goal.coverage) cutsToGoal = captures;
          run.events.length = 0;
        }
      }
    }
    assert.equal(run.coverage, 1, `${level.id}: not all budgeted cells could be captured`);
    assert.notEqual(cutsToGoal, null, `${level.id}: goal unreachable`);
    stepRun(run, {}, FIXED_DT);
    assert.equal(run.status, 'won', `${level.id}: terminal win was not awarded`);
    levels.push({
      id: level.id,
      reachableCells: analysis.total,
      bonusCells: analysis.excluded,
      cutsToGoal,
      longestCut,
      geometryGoalReached: true,
    });
  }
}
const report = {
  policy: 'reachable-routes.v1',
  scope:
    'Geometry and capture accounting; enemy seeds fixed. This is not a moving-enemy playthrough or a timing/balance guarantee.',
  levels,
};
await writeFile(
  new URL('../authoring/library/neon-artwork/coverage-audit.json', import.meta.url),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(
  `All ${levels.length} Neon layouts reach their goal and 100% of their route budget through legal geometry-only cuts.`,
);

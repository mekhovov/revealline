/** Verify that the named default revision reproduces the isolated pacing parameters. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as core from '../../../../game/overflight/core.mjs';
import * as project from '../../../../game/overflight/project.mjs';
import { pilot, selectCard } from '../../../../game/overflight/review-pilot.mjs';
import { createOverflightReviewPlayback } from '../../../../game/overflight/host-loop.mjs';
const output = process.argv.find((arg) => arg.startsWith('--output='))?.slice(9);
assert.ok(output && !existsSync(output));
const params = {
  rulesVersion: 4,
  seed: 202604,
  difficulty: 'standard',
  layout: 'relay-ruins-receiver-gardens',
};
const compiled = project.compileOverflightProject(project.createOverflightProject(params));
assert.equal(compiled.balanceRevision, 'overflight-balance.v4.late-choice-1');
const run = core.createOverflightRun(compiled, {
  seed: params.seed,
  airframes: 3,
  slowResume: true,
});
const review = createOverflightReviewPlayback({
  build: 'echo',
  route: 'figure-eight',
  pilot,
  selectCard,
});
core.startOverflight(run);
let wall = 0;
while (['playing', 'upgrade'].includes(run.phase) && run.time < 720) {
  if (run.phase === 'upgrade') {
    review.upgrade(run, wall, true);
    wall += 1500;
    const choice = review.upgrade(run, wall, true);
    assert.ok(choice && core.chooseOverflightUpgrade(run, choice.choiceId));
    continue;
  }
  core.stepOverflight(run, review.input(run, {}));
  wall += 1000 / 60;
}
const study = JSON.parse(
  gunzipSync(readFileSync(new URL('./original-crowd.json.gz', import.meta.url))),
);
const expected = study.results.find(
  (row) => row.index === 0 && row.pacing === 'late-1250-1550',
).active;
assert.equal(run.phase, expected.phase);
assert.equal(run.time, expected.time);
assert.deepEqual(run.stats, expected.stats);
assert.deepEqual(run.progression.history, expected.drafts);
writeFileSync(
  output,
  gzipSync(
    JSON.stringify({
      head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      sourceProjectSha256: createHash('sha256')
        .update(readFileSync(new URL('../../../../game/overflight/project.mjs', import.meta.url)))
        .digest('hex'),
      compiledIdentity: compiled.projectIdentity,
      balanceRevision: compiled.balanceRevision,
      phase: run.phase,
      time: run.time,
      stats: run.stats,
      drafts: run.progression.history,
      comparison:
        'Matches the isolated case 0 proposed pacing outcome, stats and draft history exactly; metadata revision changes no combat.',
    }),
  ),
);
console.log(
  JSON.stringify({ phase: run.phase, time: run.time, identity: compiled.projectIdentity }),
);

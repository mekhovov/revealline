/** Compare native review boundaries without granting power or mutating gameplay. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as core from '../../../../game/overflight/core.mjs';
import * as project from '../../../../game/overflight/project.mjs';
import { createOverflightRiyMode } from '../../../../game/overflight/riy-mode.mjs';
import { pilot, selectCard } from '../../../../game/overflight/review-pilot.mjs';
import { createOverflightReviewPlayback } from '../../../../game/overflight/host-loop.mjs';

const root = new URL('../../../../', import.meta.url);
const sources = new Set();
function visit(url) {
  if (sources.has(url.href)) return;
  sources.add(url.href);
  const text = readFileSync(url, 'utf8');
  for (const match of text.matchAll(/(?:from\s*|import\s*)['"](\.{1,2}\/[^'"]+)['"]/g))
    visit(new URL(match[1], url));
}
visit(new URL(import.meta.url));
const hashes = () =>
  Object.fromEntries(
    [...sources].sort().map((href) => [
      fileURLToPath(href).slice(fileURLToPath(root).length),
      createHash('sha256')
        .update(readFileSync(new URL(href)))
        .digest('hex'),
    ]),
  );
const output = process.argv.find((arg) => arg.startsWith('--output='))?.slice(9);
assert.ok(output?.endsWith('.json.gz') && !existsSync(output), 'Choose a fresh gzip output.');
const seconds = Number(process.argv.find((arg) => arg.startsWith('--seconds='))?.slice(10) ?? 540);
assert.ok(Number.isFinite(seconds) && seconds > 0 && seconds <= 720);
const parkAt = Number(
  process.argv.find((arg) => arg.startsWith('--park-at='))?.slice(10) ?? Infinity,
);
assert.ok(parkAt === Infinity || (Number.isFinite(parkAt) && parkAt >= 120 && parkAt <= 240));
const sourceHashes = hashes();
const crowdSeparation = process.argv.includes('--local-crowd') ? 'local-v1' : null;
const mode = createOverflightRiyMode({
  createRun: core.createOverflightRun,
  step: core.stepOverflight,
  createProject: project.createOverflightProject,
  compileProject: project.compileOverflightProject,
  pilot,
  selectCard,
});
const compiled = mode.compileProject(
  mode.createProject({
    rulesVersion: 4,
    crowdSeparation,
    seed: 202604,
    difficulty: 'standard',
    layout: 'relay-ruins-receiver-gardens',
  }),
);
const run = mode.createRun(compiled, { seed: 202604, airframes: 3, slowResume: true });
const review = createOverflightReviewPlayback({
  build: 'echo',
  route: 'lure-and-return',
  trace: true,
  detailTick: Number(process.argv.find((arg) => arg.startsWith('--detail-tick='))?.slice(14) ?? -1),
  pilot: mode.pilot,
  selectCard: mode.selectCard,
});
core.startOverflight(run);
let wall = 0;
while (['playing', 'upgrade'].includes(run.phase) && run.time < seconds) {
  if (run.phase === 'upgrade') {
    review.upgrade(run, wall, true);
    wall += 1500;
    const choice = review.upgrade(run, wall, true);
    assert.ok(choice?.choiceId && core.chooseOverflightUpgrade(run, choice.choiceId));
    continue;
  }
  mode.step(run, run.time >= parkAt ? {} : review.input(run, {}));
  wall += 1000 / 60;
}
const report = {
  format: 'OverflightReviewBoundaryComparisonV1',
  head: execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: fileURLToPath(root),
    encoding: 'utf8',
  }).trim(),
  sourceHashes,
  runtime: { node: process.version, v8: process.versions.v8, arch: process.arch },
  crowdSeparation,
  inputPolicy:
    parkAt === Infinity ? { kind: 'active' } : { kind: 'park-after-earned-prefix', parkAt },
  endHashes: hashes(),
  projectIdentity: compiled.projectIdentity,
  seed: run.seed,
  route: 'lure-and-return',
  seconds,
  phase: run.phase,
  time: run.time,
  stats: run.stats,
  choices: run.progression.history,
  build: run.build,
  goals: run.goals,
  reviewTrace: review.traceSnapshot(),
};
report.sourceStable = JSON.stringify(report.sourceHashes) === JSON.stringify(report.endHashes);
writeFileSync(output, gzipSync(JSON.stringify(report)));
assert.ok(report.sourceStable);
console.log(
  JSON.stringify({
    phase: report.phase,
    time: report.time,
    choices: report.choices.length,
    sourceStable: report.sourceStable,
  }),
);

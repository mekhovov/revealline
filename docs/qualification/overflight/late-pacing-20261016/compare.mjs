/** Predetermined paired earned-run pacing comparisons. No runtime power grants. */
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
const root = new URL('../../../../', import.meta.url),
  files = new Set();
function visit(url) {
  if (files.has(url.href)) return;
  files.add(url.href);
  for (const m of readFileSync(url, 'utf8').matchAll(
    /(?:from\s*|import\s*)['"](\.{1,2}\/[^'"]+)['"]/g,
  ))
    visit(new URL(m[1], url));
}
visit(new URL(import.meta.url));
const hashes = () =>
  Object.fromEntries(
    [...files].sort().map((url) => [
      fileURLToPath(url).slice(fileURLToPath(root).length),
      createHash('sha256')
        .update(readFileSync(new URL(url)))
        .digest('hex'),
    ]),
  );
const base = {
  createRun: core.createOverflightRun,
  step: core.stepOverflight,
  createProject: project.createOverflightProject,
  compileProject: project.compileOverflightProject,
  pilot,
  selectCard,
  defaultProject: null,
};
const modes = { survivor: base, riy: createOverflightRiyMode(base) };
const cases = [
  ['survivor', 'echo', 'relay-ruins-receiver-gardens', 202604, 'standard', 3, 'figure-eight', 240],
  ['riy', 'echo', 'relay-ruins-receiver-gardens', 202604, 'standard', 3, 'lure-and-return', 240],
  [
    'survivor',
    'fan',
    'field-crossing-broken-crossroads',
    17031991,
    'standard',
    3,
    'figure-eight',
    180,
  ],
  ['riy', 'fan', 'freight-depot-shunting-yard', 19910404, 'veteran', 3, 'figure-eight', 180],
  ['survivor', 'systems', 'freight-depot-dispatch-junction', 26022022, 'veteran', 1, 'tight', 240],
  ['riy', 'systems', 'field-crossing-shelterbelt-gaps', 19910404, 'standard', 1, 'tight', 180],
].map(([mode, build, layout, seed, difficulty, airframes, route, checkpoint], index) => ({
  index,
  mode,
  build,
  layout,
  seed,
  difficulty,
  airframes,
  route,
  checkpoint,
}));
const arg = (name) =>
  process.argv.find((v) => v.startsWith('--' + name + '='))?.slice(name.length + 3);
const output = arg('output'),
  requested = arg('cases')?.split(',').map(Number),
  crowd = arg('crowd') ?? 'original';
assert.ok(['original', 'local'].includes(crowd));
if (!output) {
  console.log(
    JSON.stringify(
      {
        cases,
        crowd,
        limit: 720,
        claim:
          'Six sampled configurations, three build directions per mode; not a fully crossed balance matrix.',
      },
      null,
      2,
    ),
  );
  process.exit(0);
}
assert.ok(output.endsWith('.json.gz') && !existsSync(output));
assert.ok(!requested || requested.every((id) => cases.some((c) => c.index === id)));
const selected = cases.filter((c) => !requested || requested.includes(c.index));
assert.ok(selected.length);
function clone(value, seen = new Map()) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value);
  if (ArrayBuffer.isView(value)) {
    const copy = new value.constructor(value);
    seen.set(value, copy);
    return copy;
  }
  if (value instanceof ArrayBuffer) {
    const copy = value.slice(0);
    seen.set(value, copy);
    return copy;
  }
  const copy = Array.isArray(value)
    ? []
    : value instanceof Map
      ? new Map()
      : value instanceof Set
        ? new Set()
        : Object.create(Object.getPrototypeOf(value));
  seen.set(value, copy);
  if (value instanceof Map) for (const [k, v] of value) copy.set(clone(k, seen), clone(v, seen));
  else if (value instanceof Set) for (const v of value) copy.add(clone(v, seen));
  else for (const key of Object.keys(value)) copy[key] = clone(value[key], seen);
  return copy;
}
const report = {
  format: 'OverflightLatePacingComparisonV1',
  head: execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: fileURLToPath(root),
    encoding: 'utf8',
  }).trim(),
  sourceHashes: hashes(),
  runtime: process.version,
  crowd,
  selected,
  results: [],
  complete: false,
};
const started = performance.now();
const persist = () => writeFileSync(output, gzipSync(JSON.stringify(report)));
function drive(mode, run, row, policy, onCheckpoint) {
  const review = createOverflightReviewPlayback({
    build: row.build,
    route: row.route,
    pilot: mode.pilot,
    selectCard: mode.selectCard,
  });
  let wall = 0,
    lastSample = -1;
  const samples = [];
  while (['playing', 'upgrade'].includes(run.phase) && run.time < 720) {
    assert.ok(
      performance.now() - started < 900000,
      'Wall budget exceeded; partial receipt retained.',
    );
    onCheckpoint?.(run);
    if (run.phase === 'upgrade') {
      review.upgrade(run, wall, true);
      wall += 1500;
      const choice = review.upgrade(run, wall, true);
      assert.ok(choice && core.chooseOverflightUpgrade(run, choice.choiceId));
      continue;
    }
    mode.step(run, policy === 'park' ? {} : review.input(run, {}));
    wall += 1000 / 60;
    const bucket = Math.floor(run.time / 15);
    if (bucket !== lastSample) {
      lastSample = bucket;
      samples.push({
        time: run.time,
        x: run.player.x,
        y: run.player.y,
        earned: run.stats.xpEarned,
        collected: run.stats.xpCollected,
        onGround: run.stats.xpOnGround,
        choices: run.progression.choices,
        damage: run.stats.damageTaken,
        airframesLost: run.stats.airframesLost,
      });
    }
  }
  const drafts = run.progression.history,
    times = drafts.map((d) => d.time),
    last = times.at(-1) ?? 0;
  return {
    phase: run.phase,
    time: run.time,
    stats: run.stats,
    goals: run.goals,
    drafts,
    build: run.build,
    riy: run.riy ? { commands: run.riy.commands, engagements: run.riy.engagements } : null,
    longestCompletedGap: Math.max(0, ...times.map((t, i) => t - (times[i - 1] ?? 0))),
    unfinishedGap: run.progression.choices < 10 ? run.time - last : 0,
    samples,
  };
}
try {
  for (const row of selected)
    for (const pacing of ['current', 'late-1250-1550']) {
      const mode = modes[row.mode],
        authored = mode.createProject({
          ...row,
          rulesVersion: 4,
          crowdSeparation: crowd === 'local' ? 'local-v1' : null,
        });
      const before = [...authored.upgrades.thresholds];
      if (pacing !== 'current') authored.upgrades.thresholds = [...before.slice(0, 8), 1250, 1550];
      assert.deepEqual(authored.upgrades.thresholds.slice(0, 8), before.slice(0, 8));
      const compiled = mode.compileProject(authored),
        run = mode.createRun(compiled, row);
      core.startOverflight(run);
      let checkpoint = null;
      const result = {
        ...row,
        pacing,
        projectIdentity: compiled.projectIdentity,
        thresholds: compiled.upgrades.thresholds,
      };
      report.results.push(result);
      result.active = drive(mode, run, row, 'active', (current) => {
        if (!checkpoint && current.time >= row.checkpoint) checkpoint = clone(current);
      });
      if (checkpoint) {
        result.checkpoint = {
          time: checkpoint.time,
          phase: checkpoint.phase,
          stats: clone(checkpoint.stats),
          build: clone(checkpoint.build),
          choices: checkpoint.progression.choices,
        };
        result.park = drive(mode, checkpoint, row, 'park');
      } else result.prefixFailedBeforeCheckpoint = true;
      persist();
      console.log(
        JSON.stringify({
          index: row.index,
          pacing,
          active: result.active.phase,
          time: result.active.time,
          gap: result.active.longestCompletedGap,
          park: result.park?.phase,
        }),
      );
    }
  report.complete = true;
} finally {
  report.endHashes = hashes();
  report.sourceStable = JSON.stringify(report.sourceHashes) === JSON.stringify(report.endHashes);
  report.wallSeconds = (performance.now() - started) / 1000;
  persist();
}
assert.ok(report.sourceStable);

/** Fixed earned-build diagnostics. No grants, seed search or gameplay mutation.
 * Run with --output=<fresh.json.gz>; without it only the predetermined cases print. */
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

const root = new URL('../../../../', import.meta.url);
const files = new Map();
function visit(url) {
  if (files.has(url.href)) return;
  const source = readFileSync(url, 'utf8');
  files.set(url.href, source);
  for (const match of source.matchAll(/(?:from\s*|import\s*)['"](\.{1,2}\/[^'"]+)['"]/g))
    visit(new URL(match[1], url));
}
visit(new URL(import.meta.url));
const hashes = () =>
  Object.fromEntries(
    [...files.keys()].sort().map((href) => [
      fileURLToPath(href).slice(fileURLToPath(root).length),
      createHash('sha256')
        .update(readFileSync(new URL(href)))
        .digest('hex'),
    ]),
  );
const cases = ['riy'].flatMap((mode) =>
  ['fan', 'echo', 'systems'].map((build) => ({
    mode,
    build,
    seed: 202604,
    difficulty: 'standard',
    airframes: 3,
    layout: 'relay-ruins-receiver-gardens',
    route: 'figure-eight',
  })),
);
const output = process.argv.find((arg) => arg.startsWith('--output='))?.slice(9);
if (!output) {
  console.log(JSON.stringify(cases, null, 2));
  process.exit(0);
}
assert.ok(output.endsWith('.json.gz') && !existsSync(output), 'Use a fresh gzip output.');
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
const report = {
  schema: 'OverflightFixedBuildComparisonV1',
  head: execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: fileURLToPath(root),
    encoding: 'utf8',
  }).trim(),
  startedAt: new Date().toISOString(),
  sourceHashes: hashes(),
  cases: [],
  complete: false,
  limitation:
    'Fixed automated routes diagnose collection and approach failures; they are not player difficulty or enjoyment evidence.',
};
const started = performance.now();
const persist = () => writeFileSync(output, gzipSync(JSON.stringify(report, null, 2)));
for (const row of cases) {
  const mode = modes[row.mode];
  const compiled = mode.compileProject(mode.createProject({ ...row, rulesVersion: 4 }));
  const run = mode.createRun(compiled, row);
  core.startOverflight(run);
  const result = {
    ...row,
    projectIdentity: compiled.projectIdentity,
    balanceRevision: compiled.balanceRevision,
    drafts: [],
    trace: [],
  };
  report.cases.push(result);
  let input,
    sampled = -1;
  while (['playing', 'upgrade'].includes(run.phase) && run.time < 540) {
    if (performance.now() - started > 900000) {
      result.wallBudgetReached = true;
      break;
    }
    if (run.phase === 'upgrade') {
      const card = mode.selectCard(run, row.build);
      assert.ok(card && core.chooseOverflightUpgrade(run, card.id));
      result.drafts.push({ time: run.time, id: card.id, xp: run.progression.xp });
      continue;
    }
    if (!input || run.tick % 6 === 0) input = mode.pilot(run, row.route);
    mode.step(run, input);
    if (Math.floor(run.time / 15) !== sampled) {
      sampled = Math.floor(run.time / 15);
      const target = run.enemies.find((e) => e.active && e.role === 'final');
      result.trace.push({
        time: run.time,
        x: run.player.x,
        y: run.player.y,
        hull: run.player.hull,
        choices: run.progression.choices,
        xp: run.progression.xp,
        groundSalvage: run.pickups.reduce((sum, p) => sum + (p.active ? p.value : 0), 0),
        boss: target
          ? {
              distance: Math.hypot(target.x - run.player.x, target.y - run.player.y),
              armor: target.armor,
              hull: target.hull ?? target.health,
            }
          : null,
      });
    }
  }
  Object.assign(result, {
    phase: run.phase,
    time: run.time,
    stats: run.stats,
    goals: run.goals,
    build: run.build,
    choices: run.progression.choices,
    longestDraftGap: Math.max(
      0,
      ...result.drafts.map((d, i) => d.time - (result.drafts[i - 1]?.time ?? 0)),
    ),
  });
  persist();
  console.log(
    JSON.stringify({
      mode: row.mode,
      build: row.build,
      phase: result.phase,
      time: result.time,
      choices: result.choices,
      longestDraftGap: result.longestDraftGap,
    }),
  );
}
report.endHashes = hashes();
report.sourceStable = JSON.stringify(report.sourceHashes) === JSON.stringify(report.endHashes);
report.wallSeconds = (performance.now() - started) / 1000;
report.complete =
  report.cases.length === cases.length &&
  report.cases.every((c) => ['won', 'lost'].includes(c.phase));
persist();
assert.ok(report.sourceStable);

/** Inspect the completed sampled matrix; never mutate or retune its runtime. */
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const sourceCommit = '14649912ba3f94d335b5bbc94ce6ce92d522a1a8';
const here = (name) => new URL(name, import.meta.url);
const readGzip = (name) => JSON.parse(gunzipSync(readFileSync(here(name))));
const matrix = readGzip('balance-matrix.json.gz');
assert.ok(matrix.completedAt, 'The matrix must finish before analysis.');
assert.deepEqual(matrix.source, matrix.sourceAtFinish, 'All runtime hashes must remain stable.');
for (const { path, sha256 } of matrix.source) {
  const actual = createHash('sha256')
    .update(readFileSync(new URL(`../../../../${path}`, import.meta.url)))
    .digest('hex');
  assert.equal(actual, sha256, `Current source differs: ${path}`);
  const committed = createHash('sha256')
    .update(execFileSync('git', ['show', `${sourceCommit}:${path}`]))
    .digest('hex');
  assert.equal(committed, sha256, `Committed source differs: ${path}`);
}
const prefix = readGzip('balance-matrix-interrupted-prefix.json.gz');
assert.deepEqual(
  matrix.results.slice(0, prefix.results.length),
  prefix.results,
  'Saved pre-interruption results must remain byte-equivalent data.',
);
const key = (c) =>
  JSON.stringify(
    ['mode', 'build', 'encounterSet', 'difficulty', 'airframes', 'seed'].map((name) => c[name]),
  );
const configs = new Map();
for (const result of matrix.results) {
  const id = key(result.config);
  if (!configs.has(id)) configs.set(id, []);
  configs.get(id).push(result);
}
assert.equal(configs.size, 48);
const routes = ['active', 'none', 'tiny', 'wall', 'orbit'];
for (const results of configs.values()) {
  const early = results.find((result) => result.route === 'checkpoint');
  if (early) {
    assert.equal(results.length, 1);
    assert.equal(early.summary.outcome, 'lost');
    assert.ok(early.summary.time < early.stop);
  } else assert.deepEqual(results.map((result) => result.route).sort(), [...routes].sort());
}
const rounded = (number) => Math.round(number * 100) / 100;
const stats = (values) => {
  const items = values.filter((x) => x !== null && Number.isFinite(x)).sort((a, b) => a - b);
  return !items.length
    ? null
    : {
        min: rounded(items[0]),
        median: rounded(
          (items[Math.floor((items.length - 1) / 2)] + items[Math.floor(items.length / 2)]) / 2,
        ),
        max: rounded(items.at(-1)),
      };
};
const rows = [...configs.values()].map((results) => {
  const result = results.find((r) => r.route === 'active') ?? results[0];
  let gap = { seconds: 0, from: null, to: null };
  for (let i = 1; i < result.choices.length; i++) {
    const previous = result.choices[i - 1],
      next = result.choices[i];
    if (next.time - previous.time > gap.seconds)
      gap = { seconds: next.time - previous.time, from: previous, to: next };
  }
  const first = result.choices[0]?.time ?? null;
  const evolution = result.choices.find((choice) => /^primary:.*:4$/.test(choice.id))?.time ?? null;
  const s = result.summary.stats;
  return {
    ...result.config,
    earlyFailure: result.route === 'checkpoint',
    outcome: result.summary.outcome,
    time: rounded(result.summary.time),
    checkpoint: result.stop,
    firstChoice: first === null ? null : rounded(first),
    evolution: evolution === null ? null : rounded(evolution),
    choices: result.choices.length,
    tenthChoice: result.choices[9]?.time ?? null,
    lastChoice: result.choices.at(-1)?.time ?? null,
    largestChoiceGap: { ...gap, seconds: rounded(gap.seconds) },
    peakVisible: s.peakVisible,
    peakAlive: s.peakAlive,
    damageTaken: s.damageTaken,
    damageCauses: s.damageCauses,
    shieldBlocks: s.shieldBlocks,
    boosts: s.boostsUsed,
    kills: s.kills,
    armorSegmentsBroken: s.armorSegmentsBroken,
    finalBuild: result.build,
    runEndWithoutAnotherChoice: rounded(result.summary.time - (result.choices.at(-1)?.time ?? 0)),
  };
});
const groups = [];
for (const mode of ['survivor', 'riy'])
  for (const build of ['fan-shield', 'echo', 'echo-shield', 'systems']) {
    const group = rows.filter((row) => row.mode === mode && row.build === build);
    const active = group.filter((row) => !row.earlyFailure);
    const worst = [...group].sort(
      (a, b) => b.largestChoiceGap.seconds - a.largestChoiceGap.seconds,
    )[0];
    const damages = { contact: 0, lane: 0, fan: 0, ground: 0 };
    for (const row of group)
      for (const cause of Object.keys(damages)) damages[cause] += row.damageCauses[cause] ?? 0;
    groups.push({
      mode,
      build,
      configurations: group.length,
      reachedCheckpoint: active.length,
      earlyFailures: group.length - active.length,
      activeWins: active.filter((row) => row.outcome === 'won').length,
      standardWins: group.filter((row) => row.difficulty === 'standard' && row.outcome === 'won')
        .length,
      veteranWins: group.filter((row) => row.difficulty === 'veteran' && row.outcome === 'won')
        .length,
      firstChoice: stats(group.map((r) => r.firstChoice)),
      evolution: stats(group.map((r) => r.evolution)),
      missingEvolution: group.filter((r) => r.evolution === null).length,
      lastChoice: stats(group.map((r) => r.lastChoice)),
      completeDrafts: group.filter((r) => r.choices === 10).length,
      tenthChoice: stats(group.map((r) => r.tenthChoice)),
      largestChoiceGap: {
        ...worst.largestChoiceGap,
        config: {
          encounterSet: worst.encounterSet,
          difficulty: worst.difficulty,
          airframes: worst.airframes,
          seed: worst.seed,
        },
      },
      peakVisible: stats(group.map((r) => r.peakVisible)),
      peakAlive: stats(group.map((r) => r.peakAlive)),
      damageCauses: damages,
      damageTaken: stats(group.map((r) => r.damageTaken)),
      shieldBlocks: stats(group.map((r) => r.shieldBlocks)),
      boosts: stats(group.map((r) => r.boosts)),
      armorSegmentsBroken: stats(group.map((r) => r.armorSegmentsBroken)),
      wonTime: stats(group.filter((r) => r.outcome === 'won').map((r) => r.time)),
    });
  }
const outcomes = {};
for (const result of matrix.results) {
  const k = `${result.config.mode}/${result.route}/${result.summary.outcome}`;
  outcomes[k] = (outcomes[k] ?? 0) + 1;
}
const analysis = {
  format: 'OverflightBalanceMatrixAnalysisV1',
  sourceReceipt: 'balance-matrix.json.gz',
  sourceCommit,
  completedAt: matrix.completedAt,
  configurations: configs.size,
  results: matrix.results.length,
  preservedPrefixResults: prefix.results.length,
  hashesStable: true,
  unattendedWins: matrix.results.filter(
    (r) => routes.slice(1).includes(r.route) && r.summary.outcome === 'won',
  ).length,
  outcomes,
  groups,
  rows,
  limitations: [
    'Three encounter/seed combinations per difficulty; seeds and airframe counts are coupled to configurations, not independently crossed.',
    'Checkpoints 120/180/240 rotate across configurations. Named no-Focus Riy regressions separately cover default mature builds at 210 and 240.',
    'Reported build names are card-selection policies. Final earned builds are included for inspection; the same label is not proof of identical cards.',
    'Riy echo and echo-shield resolve to the same trail/burst/Shield policy and extend airframe coverage; the matrix represents three distinct squad directions, not four. Survivor echo-shield excludes Pulse while echo permits it.',
    'Active outcome includes losses before checkpoints in the per-build configuration denominator; those early losses have no mature unattended counterparts.',
    'First/evolution timing and choice-gap ranges include all 48 original active prefixes, never duplicate cloned branches.',
    'Damage totals and skill outcomes describe this predictive automated pilot, not human difficulty or enjoyment.',
    'The pilot does not measure screen readability, frame rate, host pause/slow-resume UX, or human build preference.',
  ],
};
writeFileSync(here('balance-matrix-analysis.json'), JSON.stringify(analysis, null, 2) + '\n');
const range = (v) => (v ? `${v.min}–${v.max}` : '—');
const lines = [
  '# Sampled Survivor / Riy balance qualification',
  '',
  `Runtime source: ${sourceCommit}. Each recorded runtime hash was checked against this committed version.`,
  '',
  `Completed ${configs.size} configurations and ${matrix.results.length} outcome records. All ${prefix.results.length} pre-interruption records are unchanged. Runtime hashes match throughout recovery.`,
  '',
  '| Mode / policy | Active wins / 6 configs | Standard / Veteran wins (3 each) | First choice (s) | Evolution (s) | Largest inter-choice gap (s) | Peak visible | Shield blocks |',
  '|---|---:|---:|---:|---:|---:|---:|---:|',
  ...groups.map(
    (g) =>
      `| ${g.mode} / ${g.build} | ${g.activeWins}/6${g.earlyFailures ? ` (${g.earlyFailures} early losses)` : ''} | ${g.standardWins}/3 · ${g.veteranWins}/3 | ${range(g.firstChoice)} | ${range(g.evolution)} | ${g.largestChoiceGap.seconds} | ${range(g.peakVisible)} | ${range(g.shieldBlocks)} |`,
  ),
  '',
  'Active means the ordinary-input review pilot keeps steering and using available boost/Focus. No-input, wall, tiny-circle and repeating-orbit branches continue resolving earned upgrade menus but issue no Focus commands. Automatic replacement may move the drone.',
  '',
  `Unattended/repetitive-route wins: ${analysis.unattendedWins}. Early active losses are reported separately, not treated as completed mature-build probes.`,
  '',
  '## Findings for the next tuning review',
  '',
  '- The sampled anti-idle check passes: 46 no-input continuations and 138 simple repetitive routes all lose, while active flight wins in 31 of the 48 configurations. This establishes available active routes and rejects these sampled exploits; it does not prove all stationary builds are impossible.',
  '- The first choice is consistently earned within 15.45–19.88 seconds. Primary-first Survivor policies evolve in 39.85–82 seconds, including earlier than the intended 70–100-second window. Riy evolves in 64.5–106.4 seconds. Survivor systems deliberately spends its ten-choice budget on Pulse, Side Burst and Scanner, leaving primary at rank 2; the absent evolution is a policy tradeoff rather than a blocked draft.',
  '- Late progression still needs review. Maximum gaps between earned choices range from 56.48 to 125.43 seconds across policies, and some final choices occur after 300 seconds. Therefore the intended frequent-reward cadence and final-choice window of 240–270 seconds are not uniformly demonstrated. Any further XP tuning needs a new paired matrix, because earlier power also changes idle survival.',
  '- Fan + Shield won all six sampled configurations in each mode. Its broad clearing leaves fewer enemies and produces faster clears on this pilot. Echo rewards rearward placement and return passes, but its weaker immediate coverage leaves larger crowds; the trail/burst Riy variant exchanges crowd damage for local slowing and concentrated priority-target attacks. Systems gives up Shield for Scanner and additional combat/chain coverage, demanding more movement. These are observable mechanics and route outcomes, not human preference rankings.',
  '- Active-route damage totals are 4,380 contact, 160 lane, 40 fan and 80 ground: approximately 94% is contact. The pilot predicts warnings, so low ranged damage does not establish that human players find them obvious or easy. Shield blocks range from zero to seven per sampled active run, with none on Scanner policies.',
  '- Peak visible populations reach 995 in Survivor and 959 in Riy, above the planned 600–800 surge envelope; one Riy route reaches the 2,500-alive pool cap. These runs need native density/performance review before claiming the full envelope is qualified. Reducing cosmetic work must preserve enemies and outcomes.',
  '',
  '## Interpretation and limits',
  '',
  ...analysis.limitations.map((v) => `- ${v}`),
  '',
  'The JSON companion contains each earned build, first/evolution timings, exact largest-gap cards and configuration, density peaks, boosts, armor breaks and damage by cause. Numerical differences are observations from these routes, not causal proof that one build is stronger.',
  '',
  'Recovery used compact gzip, temporary-file writes, flush and atomic rename. The original interrupted receipt, original log, three failed-resume logs and exact original harness remain preserved separately. Repeated disk exhaustion required the final six configurations to send a complete checksum-protected gzip receipt through the tool output pipe with a 256 MiB Node heap cap; that exact receipt was then saved atomically once space was available. No result was reconstructed from a log summary. See balance-matrix-recovery.json for receipt, harness and runtime hashes.',
];
writeFileSync(here('BALANCE-MATRIX-REVIEW.md'), lines.join('\n') + '\n');
console.log(
  JSON.stringify(
    {
      configurations: analysis.configurations,
      results: analysis.results,
      unattendedWins: analysis.unattendedWins,
      outcomes,
      groups,
    },
    null,
    2,
  ),
);

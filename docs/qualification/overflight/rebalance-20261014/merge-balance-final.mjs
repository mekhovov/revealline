/** Verify two disjoint executions and produce the final source-bound matrix. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, renameSync, openSync, closeSync, fsyncSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';

const sourceCommit = 'ca03d7d7d84dcf50bbab6d2734a6d09097e27ed6';
const here = (name) => new URL(name, import.meta.url);
const digest = (value) => createHash('sha256').update(value).digest('hex');
const readReceipt = (name) => JSON.parse(gunzipSync(readFileSync(here(name))));
const inputs = ['balance-matrix-final-survivor.json.gz', 'balance-matrix-final-riy.json.gz'];
const halves = inputs.map(readReceipt);
const expected = [];
for (const mode of ['survivor', 'riy'])
  for (const build of ['fan-shield', 'echo', 'echo-shield', 'systems'])
    for (const encounterSet of ['front', 'crossing', 'mixed'])
      for (const difficulty of ['standard', 'veteran']) {
        const index = expected.length;
        expected.push({
          mode,
          build,
          encounterSet,
          difficulty,
          airframes: Math.floor(index / 2) % 2 ? 1 : 3,
          seed: [17031991, 42, 7][Math.floor(index / 2) % 3],
        });
      }
const key = (config) =>
  JSON.stringify(
    ['mode', 'build', 'encounterSet', 'difficulty', 'airframes', 'seed'].map((k) => config[k]),
  );
const source = halves[0].source;
const routes = ['active', 'none', 'tiny', 'wall', 'orbit'];
for (const [index, half] of halves.entries()) {
  assert.equal(half.format, 'OverflightRebalanceReviewV1');
  assert.ok(half.completedAt, `Incomplete half: ${inputs[index]}`);
  assert.deepEqual(half.source, source);
  assert.deepEqual(half.sourceAtFinish, source);
  assert.equal(half.harnessSha256, halves[0].harnessSha256);
  assert.deepEqual(half.environment, {
    rulesVersion: 3,
    focus: true,
    matrix: true,
    mode: null,
    build: null,
    stop: null,
    configIndices: Array.from({ length: 24 }, (_, i) => i + index * 24).join(','),
  });
}
for (const entry of source) {
  const current = readFileSync(new URL(`../../../../${entry.path}`, import.meta.url));
  const committed = execFileSync('git', ['show', `${sourceCommit}:${entry.path}`]);
  assert.equal(digest(current), entry.sha256, `Current runtime differs: ${entry.path}`);
  assert.equal(digest(committed), entry.sha256, `Committed runtime differs: ${entry.path}`);
}
const results = halves.flatMap((half) => half.results);
const configs = new Map();
for (const result of results) {
  const configKey = key(result.config);
  const index = expected.findIndex((config) => key(config) === configKey);
  assert.ok(index >= 0, 'Unexpected configuration');
  assert.deepEqual(result.config, expected[index]);
  assert.equal(result.stop, [120, 180, 240][index % 3]);
  if (!configs.has(configKey)) configs.set(configKey, []);
  configs.get(configKey).push(result);
}
assert.equal(configs.size, 48);
for (const config of expected) {
  const outcomes = configs.get(key(config));
  const early = outcomes.find((r) => r.route === 'checkpoint');
  if (early) {
    assert.equal(outcomes.length, 1);
    assert.equal(early.summary.outcome, 'lost');
    assert.ok(early.summary.time < early.stop);
  } else {
    assert.deepEqual(outcomes.map((r) => r.route).sort(), [...routes].sort());
    for (const outcome of outcomes) assert.deepEqual(outcome.checkpoint, outcomes[0].checkpoint);
  }
}
const priorEight = readReceipt('balance-matrix-after-boundary.json.gz');
assert.deepEqual(priorEight.source, source);
for (const prior of priorEight.results) {
  const repeated = configs.get(key(prior.config)).find((r) => r.route === prior.route);
  assert.deepEqual(repeated, prior, 'The independently rerun eight-config subset changed.');
}
const receipt = {
  format: 'OverflightRebalanceReviewV1',
  date: halves.map((h) => h.date).sort()[0],
  completedAt: halves
    .map((h) => h.completedAt)
    .sort()
    .at(-1),
  sourceCommit,
  source,
  sourceAtFinish: source,
  harnessSha256: halves[0].harnessSha256,
  environment: { ...halves[0].environment, configIndices: null },
  scope: halves[0].scope,
  mergedFrom: inputs.map((path, i) => ({
    path,
    sha256: digest(readFileSync(here(path))),
    environment: halves[i].environment,
    coverage: halves[i].coverage,
  })),
  repeatedSubset: {
    path: 'balance-matrix-after-boundary.json.gz',
    sha256: digest(readFileSync(here('balance-matrix-after-boundary.json.gz'))),
    outcomesVerifiedUnchanged: priorEight.results.length,
  },
  coverage: {
    configurations: 48,
    configurationResults: configs.size,
    routeResults: results.length,
    earlyFailures: results.filter((r) => r.route === 'checkpoint').length,
  },
  results,
};
const round = (n) => Math.round(n * 100) / 100;
const stats = (values) => {
  const v = values.filter((n) => n !== null && Number.isFinite(n)).sort((a, b) => a - b);
  if (!v.length) return null;
  return {
    min: round(v[0]),
    median: round((v[Math.floor((v.length - 1) / 2)] + v[Math.floor(v.length / 2)]) / 2),
    max: round(v.at(-1)),
  };
};
const rows = [...configs.values()].map((outcomes) => {
  const r = outcomes.find((row) => row.route === 'active') ?? outcomes[0];
  let largestChoiceGap = { seconds: 0, from: null, to: null };
  for (let i = 1; i < r.choices.length; i++) {
    const seconds = r.choices[i].time - r.choices[i - 1].time;
    if (seconds > largestChoiceGap.seconds)
      largestChoiceGap = { seconds, from: r.choices[i - 1], to: r.choices[i] };
  }
  largestChoiceGap.seconds = round(largestChoiceGap.seconds);
  return {
    ...r.config,
    earlyFailure: r.route === 'checkpoint',
    outcome: r.summary.outcome,
    time: round(r.summary.time),
    checkpoint: r.stop,
    firstChoice: r.choices[0]?.time ?? null,
    evolution: r.choices.find((choice) => /^primary:.*:4$/.test(choice.id))?.time ?? null,
    choices: r.choices.length,
    tenthChoice: r.choices[9]?.time ?? null,
    largestChoiceGap,
    ...Object.fromEntries(
      [
        'peakVisible',
        'peakAlive',
        'spawnDeferred',
        'damageTaken',
        'damageCauses',
        'shieldBlocks',
        'xpEarned',
        'xpCollected',
        'xpOnGround',
        'armorSegmentsBroken',
        'boostsUsed',
      ].map((name) => [name, r.summary.stats[name]]),
    ),
    finalBuild: r.build,
  };
});
const groups = [];
for (const mode of ['survivor', 'riy'])
  for (const build of ['fan-shield', 'echo', 'echo-shield', 'systems']) {
    const group = rows.filter((row) => row.mode === mode && row.build === build);
    groups.push({
      mode,
      build,
      configurations: group.length,
      activeWins: group.filter((r) => r.outcome === 'won').length,
      earlyFailures: group.filter((r) => r.earlyFailure).length,
      standardWins: group.filter((r) => r.difficulty === 'standard' && r.outcome === 'won').length,
      veteranWins: group.filter((r) => r.difficulty === 'veteran' && r.outcome === 'won').length,
      firstChoice: stats(group.map((r) => r.firstChoice)),
      evolution: stats(group.map((r) => r.evolution)),
      completeDrafts: group.filter((r) => r.choices === 10).length,
      tenthChoice: stats(group.map((r) => r.tenthChoice)),
      largestChoiceGap: [...group].sort(
        (a, b) => b.largestChoiceGap.seconds - a.largestChoiceGap.seconds,
      )[0].largestChoiceGap,
      peakVisible: stats(group.map((r) => r.peakVisible)),
      peakAlive: stats(group.map((r) => r.peakAlive)),
      shieldBlocks: stats(group.map((r) => r.shieldBlocks)),
      damageCauses: group.reduce((totals, row) => {
        for (const [cause, value] of Object.entries(row.damageCauses))
          totals[cause] = (totals[cause] ?? 0) + value;
        return totals;
      }, {}),
      spawnDeferred: group.reduce((sum, row) => sum + row.spawnDeferred, 0),
    });
  }
const analysis = {
  format: 'OverflightFinalBalanceAnalysisV1',
  sourceCommit,
  coverage: receipt.coverage,
  repeatedSubsetOutcomesVerifiedUnchanged: priorEight.results.length,
  activeWins: rows.filter((r) => r.outcome === 'won').length,
  unattendedOrRepetitiveWins: results.filter(
    (r) => routes.slice(1).includes(r.route) && r.summary.outcome === 'won',
  ).length,
  unattendedOrRepetitiveOutcomes: results.filter((r) => routes.slice(1).includes(r.route)).length,
  groups,
  rows,
};
const range = (v) => (v ? `${v.min}–${v.max}` : '—');
const report = [
  '# Final Survivor / Riy balance matrix',
  '',
  `Runtime: ${sourceCommit}. All twelve runtime hashes match this commit and remained unchanged during both executions.`,
  '',
  `Completed 48 configurations and ${results.length} outcome records. ${analysis.activeWins}/48 active routes won; ${analysis.unattendedOrRepetitiveWins}/${analysis.unattendedOrRepetitiveOutcomes} unattended/repetitive branches won. ${receipt.coverage.earlyFailures} active prefixes lost before their assigned checkpoint and have no mature passive counterpart.`,
  '',
  'The halves cover disjoint original indices 0–23 and 24–47. Merge validation checks every configuration, checkpoint and route exactly once. The prior eight-configuration receipt was rerun independently; all forty outcome records match exactly. Both halves, the earlier subset and the pre-boundary matrix remain preserved.',
  '',
  '| Mode / policy | Active wins / 6 | Standard / Veteran (3 each) | First choice (s) | Evolution (s) | Tenth choice (s) | Largest gap (s) | Peak visible |',
  '|---|---:|---:|---:|---:|---:|---:|---:|',
  ...groups.map(
    (g) =>
      `| ${g.mode} / ${g.build} | ${g.activeWins}/6 | ${g.standardWins}/3 · ${g.veteranWins}/3 | ${range(g.firstChoice)} | ${range(g.evolution)} | ${range(g.tenthChoice)} | ${g.largestChoiceGap.seconds} | ${range(g.peakVisible)} |`,
  ),
  '',
  'Tenth-choice ranges include only runs earning all ten choices. The JSON companion retains the completion count, exact largest-gap cards, damage causes, shield usage, resource peaks and final earned build for each configuration.',
  '',
  '## Evidence limits',
  '',
  '- Seeds are tied to encounter sets; airframes and 120/180/240-second checkpoints rotate with configuration index. This remains sampled coverage, not an independently crossed matrix.',
  '- Riy echo and echo-shield are the same trail/burst/Shield selection policy with different airframe coverage. They are not two distinct squad directions.',
  '- Every branch continues resolving earned upgrade menus. No-input stays empty after replacements; inherited short boosts/Focus and automatic replacement can still move the drone.',
  '- The active pilot uses only ordinary inputs and earned upgrades, but predicts exact game-state geometry. These outcomes establish reproducible routes and sampled anti-idle behavior, not human enjoyment or difficulty.',
  '- Render performance, input-device feel, upgrade reorientation and visual readability need their separate native evidence.',
  '- Late collection gaps must be reviewed separately. XP is conserved on the map, and a route that leaves a large salvage trail can earn later choices slowly despite sufficient kills.',
  '',
  'Commands: run verify-balance.mjs with BALANCE_MATRIX=1, BALANCE_RULES=3, BALANCE_FOCUS=1, explicit BALANCE_CONFIG_INDICES=0,...,23 or24,...,47, each distinct BALANCE_OUTPUT, and Node --max-old-space-size=256. Then run this merge-balance-final.mjs verifier. No gameplay values change during qualification.',
];
function atomic(name, data) {
  const target = here(name),
    temporary = here(`${name}.tmp-${process.pid}`);
  const fd = openSync(temporary, 'wx');
  try {
    writeFileSync(fd, data);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(temporary, target);
}
atomic('balance-matrix-final.json.gz', gzipSync(JSON.stringify(receipt), { level: 9 }));
atomic('balance-matrix-final-analysis.json', JSON.stringify(analysis, null, 2) + '\n');
atomic('FINAL-BALANCE-MATRIX-REVIEW.md', report.join('\n') + '\n');
console.log(
  JSON.stringify(
    {
      sourceCommit,
      coverage: receipt.coverage,
      activeWins: analysis.activeWins,
      unattendedOrRepetitiveWins: analysis.unattendedOrRepetitiveWins,
      unattendedOrRepetitiveOutcomes: analysis.unattendedOrRepetitiveOutcomes,
      receiptSha256: digest(readFileSync(here('balance-matrix-final.json.gz'))),
      groups,
    },
    null,
    2,
  ),
);

import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { canonicalJSON } from '../game/data-json.mjs';
import { CLASSIC_SNAKE_LEVELS } from '../game/snake/classic-catalogue.mjs';
import { prepareClassicSnakeLevel } from '../game/snake/classic-setup.mjs';
import {
  exportClassicSnakeReplay,
  restoreClassicSnakeReplay,
} from '../game/snake/classic-core.mjs';
import {
  createClassicSnakeMatch,
  queueClassicSnakeMatchTurn,
  advanceClassicSnakeMatchTo,
  nextClassicSnakeMatchEventAt,
  exportClassicSnakeMatch,
  restoreClassicSnakeMatch,
} from '../game/snake/classic-match.mjs';
import { createSnakeTraceReview } from './lib/snake-trace-review.mjs';

const directory = new URL('../docs/verification/snake-remaster/', import.meta.url);
const outliers = process.argv.includes('--outliers');
const files = outliers
  ? ['outlier-alternative-proofs.json']
  : [
      'tactical-proofs.json',
      'tactical-proofs-hazards-73.json',
      'tactical-proofs-hazards-2026.json',
    ];
const catalogue = process.argv.includes('--catalogue');
if (outliers && catalogue) throw new Error('Choose catalogue or outlier comparison, not both.');
const candidates = [];
for (const filename of files) {
  const { proofs } = JSON.parse(await readFile(new URL(filename, directory), 'utf8'));
  candidates.push(...proofs.map((proof) => ({ ...proof, source: filename })));
}
if (catalogue) {
  // Editorial geometry revisions have their own qualification journals; retain
  // the original fixture recipes as historical evidence instead of overwriting them.
  const { proofs: editorialProofs } = JSON.parse(
    await readFile(new URL('editorial-proofs.json', directory), 'utf8'),
  );
  candidates.push(
    ...editorialProofs.map((proof) => ({ ...proof, source: 'editorial-proofs.json' })),
  );
  const fixtureRoot = new URL('../game/test/fixtures/', import.meta.url);
  for (const filename of [
    'classic-snake-operations-a-proofs.json',
    'classic-snake-operations-b-proofs.json',
    'classic-snake-variety-proofs.json',
    'classic-snake-v4-proofs.json',
  ]) {
    const { proofs } = JSON.parse(await readFile(new URL(filename, fixtureRoot), 'utf8'));
    candidates.push(
      ...proofs.map((proof) => ({ ...proof, source: `game/test/fixtures/${filename}` })),
    );
  }
  const evidence = new URL('../docs/verification/classic-snake/', import.meta.url);
  for (const filename of (await readdir(evidence, { recursive: true }))
    .filter((name) => name.endsWith('.json'))
    .sort()) {
    const replay = JSON.parse(await readFile(new URL(filename, evidence), 'utf8'));
    if (!/^classic-snake-replay\.v[1-6]$/.test(replay.version)) continue;
    candidates.push({
      levelId: replay.level.id,
      mode: replay.mode,
      pace: 'normal',
      replay,
      source: `docs/verification/classic-snake/${filename}`,
    });
  }
  try {
    const { proofs } = JSON.parse(
      await readFile(new URL('retained-foundation-proofs.json', directory), 'utf8'),
    );
    candidates.push(
      ...proofs.map((proof) => ({ ...proof, source: 'retained-foundation-proofs.json' })),
    );
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
const runs = [],
  seen = new Set();
for (const proof of candidates) {
  const entry = CLASSIC_SNAKE_LEVELS.find((e) => e.id === proof.levelId);
  if (!entry) continue;
  const level = prepareClassicSnakeLevel(entry, { pace: proof.pace });
  if (canonicalJSON(level) !== canonicalJSON(proof.replay.level)) continue;
  const identity = `${proof.levelId}/${proof.mode}/${proof.pace}/${proof.replay.seed}/${proof.replay.hazardSeed ?? 'fixed'}`;
  if (seen.has(identity)) continue;
  seen.add(identity);
  assert.equal(restoreClassicSnakeReplay(proof.replay, { level }).status, 'won');
  // Promote the verified tick journal to the ordinary match envelope. Its
  // restoration then uses the same onStep observer as the live/replay host.
  const match = createClassicSnakeMatch(level, {
    mode: proof.mode,
    policy: 'mission',
    seed: proof.replay.seed,
    ...(Number.isInteger(proof.replay.hazardSeed) ? { hazardSeed: proof.replay.hazardSeed } : {}),
  });
  let cursor = 0;
  while (match.status === 'running' && match.runs[0].tick < proof.replay.steps) {
    while (proof.replay.turns[cursor]?.tick === match.runs[0].tick) {
      const turn = proof.replay.turns[cursor++];
      assert.ok(queueClassicSnakeMatchTurn(match, turn.playerId, turn.direction));
    }
    advanceClassicSnakeMatchTo(match, nextClassicSnakeMatchEventAt(match));
  }
  assert.equal(match.result, 'won');
  assert.deepEqual(exportClassicSnakeReplay(match.runs[0]), proof.replay);
  const trace = createSnakeTraceReview();
  restoreClassicSnakeMatch(exportClassicSnakeMatch(match), {
    level,
    onStart: (m) => trace.start(m),
    onStep: (event) => trace.observe(event),
  });
  runs.push({
    levelId: proof.levelId,
    source: proof.source,
    mode: proof.mode,
    pace: proof.pace,
    hazardSeed: proof.replay.hazardSeed,
    ...trace.result()[0],
  });
}
const covered = new Set(runs.map((r) => r.levelId));
const coveredSetups = new Set(runs.map((r) => `${r.levelId}/${r.mode}/${r.pace}`));
const missingSetups = catalogue
  ? CLASSIC_SNAKE_LEVELS.flatMap((entry) =>
      ['solo', 'team'].flatMap((mode) =>
        ['normal', 'slow', 'fast'].map((pace) => `${entry.id}/${mode}/${pace}`),
      ),
    ).filter((setup) => !coveredSetups.has(setup))
  : [];
if (catalogue)
  assert.deepEqual(missingSetups, [], 'Catalogue trace requires every supported mode/pace setup.');
const comparisons = [];
if (outliers) {
  const baseline = JSON.parse(
    await readFile(new URL('catalogue-trace-review.json', directory), 'utf8'),
  );
  for (const run of runs) {
    const before = baseline.runs.find(
      (r) => r.levelId === run.levelId && r.mode === run.mode && r.pace === run.pace,
    );
    assert.ok(before, 'Comparison needs a verified retained baseline.');
    comparisons.push({
      levelId: run.levelId,
      mode: run.mode,
      pace: run.pace,
      baselineSteps: before.steps,
      alternateSteps: run.steps,
      baselineMaxNoChangeMoves: before.maxNoChangeMoves,
      alternateMaxNoChangeMoves: run.maxNoChangeMoves,
    });
  }
}
const report = {
  format: 'classic-snake-trace-review.v1',
  scope: `${runs.length} verified winning ${catalogue ? 'catalogue' : outliers ? 'outlier alternative' : 'remaster'} journals; retained evidence must match the current recipe exactly. One route per setup, not all player strategies.`,
  definitions: {
    captureConcentration:
      'Largest capture count at one cell divided by all accepted captures, including bonuses.',
    maxRepeatedSpot:
      'Largest total number of captures at one cell; longestSameSpotStreak separately counts consecutive captures.',
    noChange:
      'Moves without accepted encounter/objective/supply events or actor phase/intention/interference changes. Ordinary target movement alone does not reset the interval.',
    signals:
      'Review concentrated captures at >=3 catches and >=50% concentration; review no-change intervals at >=24 moves or >=6000ms. Heuristics only, not difficulty or enjoyment scores.',
  },
  summary: {
    runs: runs.length,
    missions: covered.size,
    setups: coveredSetups.size,
    missingSetups,
    missingMissions: catalogue
      ? CLASSIC_SNAKE_LEVELS.filter((e) => !covered.has(e.id)).map((e) => e.id)
      : [],
    flaggedRuns: runs.filter((r) => r.signals.length).length,
    flaggedMissions: [...new Set(runs.filter((r) => r.signals.length).map((r) => r.levelId))],
  },
  runs,
  ...(outliers ? { comparisons } : {}),
};
const text = JSON.stringify(report, null, 2) + '\n',
  file = new URL(
    catalogue
      ? 'catalogue-trace-review.json'
      : outliers
        ? 'outlier-trace-review.json'
        : 'trace-review.json',
    directory,
  );
if (process.argv.includes('--check')) assert.equal(await readFile(file, 'utf8'), text);
else await writeFile(file, text);
console.log(JSON.stringify(report.summary));

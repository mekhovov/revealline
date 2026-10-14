import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
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
const files = [
  'tactical-proofs.json',
  'tactical-proofs-hazards-73.json',
  'tactical-proofs-hazards-2026.json',
];
const runs = [];
for (const filename of files) {
  const { proofs } = JSON.parse(await readFile(new URL(filename, directory), 'utf8'));
  for (const proof of proofs) {
    const entry = CLASSIC_SNAKE_LEVELS.find((e) => e.id === proof.levelId);
    const level = prepareClassicSnakeLevel(entry, { pace: proof.pace });
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
      mode: proof.mode,
      pace: proof.pace,
      hazardSeed: proof.replay.hazardSeed,
      ...trace.result()[0],
    });
  }
}
const report = {
  format: 'classic-snake-trace-review.v1',
  scope:
    '60 verified winning remaster journals; one automated route per setup, not all player strategies.',
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
    flaggedRuns: runs.filter((r) => r.signals.length).length,
    flaggedMissions: [...new Set(runs.filter((r) => r.signals.length).map((r) => r.levelId))],
  },
  runs,
};
const text = JSON.stringify(report, null, 2) + '\n',
  file = new URL('trace-review.json', directory);
if (process.argv.includes('--check')) assert.equal(await readFile(file, 'utf8'), text);
else await writeFile(file, text);
console.log(JSON.stringify(report.summary));

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  CLASSIC_SNAKE_OPERATION_LEVELS_A as entries,
  CLASSIC_SNAKE_OPERATION_CHAPTERS_A as chapters,
} from '../snake/classic-catalogue-operations-a.mjs';
import { CLASSIC_SNAKE_LEVELS, CLASSIC_SNAKE_CHAPTERS } from '../snake/classic-catalogue.mjs';
import { validateClassicSnakeLevel, restoreClassicSnakeReplay } from '../snake/classic-core.mjs';
import { prepareClassicSnakeLevel } from '../snake/classic-setup.mjs';
import { createClassicSnakeRecords } from '../snake/classic-records.mjs';
import {
  createClassicSnakeMatch,
  queueClassicSnakeMatchTurn,
  advanceClassicSnakeMatchTo,
  nextClassicSnakeMatchEventAt,
  exportClassicSnakeMatch,
} from '../snake/classic-match.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { classicSnakeRatingForRecord } from '../snake/classic-ratings.mjs';
const proofs = JSON.parse(
  await readFile(
    new URL('./fixtures/classic-snake-operations-a-proofs.json', import.meta.url),
    'utf8',
  ),
).proofs;
const tacticalProofs = JSON.parse(
  await readFile(
    new URL('../../docs/verification/snake-remaster/tactical-proofs.json', import.meta.url),
    'utf8',
  ),
).proofs;

test('Release A contains six ordered chapters of eight finite, distinctly authored operations', () => {
  assert.equal(entries.length, 48);
  assert.equal(chapters.length, 6);
  assert.equal(CLASSIC_SNAKE_LEVELS.length, 240);
  assert.equal(CLASSIC_SNAKE_CHAPTERS.length, 35);
  assert.equal(new Set(entries.map((e) => e.id)).size, 48);
  assert.equal(new Set(entries.map((e) => e.description.en)).size, 48);
  for (const chapter of chapters)
    assert.equal(entries.filter((e) => e.chapterId === chapter.id).length, 8);
  for (const entry of entries) {
    assert.deepEqual(validateClassicSnakeLevel(entry.level), entry.level);
    assert.equal(entry.level.targets.maxActive <= 2, true);
    assert.equal(entry.composition.version, 1);
    assert.ok(entry.description.uk && entry.composition.landmark);
    assert.ok(entry.level.operation.stages.length <= 3);
    const fixed = new Set();
    for (let n = 0; n < entry.level.goal; n++) {
      const p = entry.level.targets.required[n % entry.level.targets.required.length];
      if (!p.at) continue;
      const key = `${p.kind}/${p.at.x}/${p.at.y}`;
      assert.ok(!fixed.has(key), `${entry.id} must not repeat a stationary post`);
      fixed.add(key);
    }
  }
  const decisions = entries.map((e) =>
    JSON.stringify({
      walls: e.level.walls,
      wrap: e.level.wrap,
      targets: e.level.targets,
      operation: e.level.operation,
    }),
  );
  assert.equal(new Set(decisions).size, 48);
});
test('all 288 Release A Solo/Team/pace winning journals verify against current recipes', () => {
  assert.equal(proofs.length, 288);
  const seen = new Set();
  for (const proof of proofs) {
    const entry = entries.find((e) => e.id === proof.levelId);
    assert.ok(entry);
    const level = prepareClassicSnakeLevel(entry, { pace: proof.pace });
    const run = restoreClassicSnakeReplay(proof.replay, { level });
    assert.equal(run.status, 'won', `${entry.id}/${proof.mode}/${proof.pace}`);
    assert.equal(run.mode, proof.mode);
    assert.equal(run.seed, 17);
    const key = `${entry.id}/${proof.mode}/${proof.pace}`;
    assert.ok(!seen.has(key));
    seen.add(key);
  }
});
function play(proof) {
  proof =
    tacticalProofs.find(
      (p) => p.levelId === proof.levelId && p.mode === proof.mode && p.pace === proof.pace,
    ) ?? proof;
  const entry = CLASSIC_SNAKE_LEVELS.find((e) => e.id === proof.levelId),
    level = prepareClassicSnakeLevel(entry, { pace: proof.pace });
  const match = createClassicSnakeMatch(level, { mode: proof.mode, policy: 'mission', seed: 17 });
  let cursor = 0;
  while (match.status === 'running' && match.runs[0].tick < proof.replay.steps) {
    while (proof.replay.turns[cursor]?.tick === match.runs[0].tick) {
      const turn = proof.replay.turns[cursor++];
      assert.ok(queueClassicSnakeMatchTurn(match, turn.playerId, turn.direction));
    }
    advanceClassicSnakeMatchTo(match, nextClassicSnakeMatchEventAt(match));
  }
  assert.equal(match.result, 'won');
  return { entry, level, match };
}
test('Release A winning records persist, reload and earn completion without borrowed gold grades', async (t) => {
  const model = managedIndexedDB(),
    records = createClassicSnakeRecords({ indexedDB: model.indexedDB });
  t.after(() => records.close());
  for (const proof of proofs.filter((p) => p.pace === 'normal')) {
    const { entry, level, match } = play(proof);
    await records.remember(match.runs[0], {
      mode: proof.mode,
      policy: 'mission',
      chapterId: entry.chapterId,
      level,
      match: exportClassicSnakeMatch(match),
    });
    assert.equal(records.get(match.runs[0], proof.mode).clear, true);
  }
  const bytes = Buffer.byteLength(JSON.stringify(records.snapshot()));
  assert.ok(bytes < 24 * 1024 * 1024);
  t.diagnostic(
    `96 operation winning records: ${bytes} bytes of the existing 24 MiB logical budget.`,
  );
  const reopened = createClassicSnakeRecords({ indexedDB: model.indexedDB });
  t.after(() => reopened.close());
  await reopened.read();
  assert.equal(Object.keys(reopened.snapshot().rows).length, 96);
  for (const evidence of reopened.ratingEvidence()) {
    const rating = classicSnakeRatingForRecord(evidence);
    assert.equal(rating.stars, 1);
    assert.equal(rating.calibrated, false);
  }
});

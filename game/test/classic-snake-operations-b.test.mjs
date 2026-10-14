import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  CLASSIC_SNAKE_OPERATION_LEVELS_B as entries,
  CLASSIC_SNAKE_OPERATION_CHAPTERS_B as chapters,
} from '../snake/classic-catalogue-operations-b.mjs';
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
    new URL('./fixtures/classic-snake-operations-b-proofs.json', import.meta.url),
    'utf8',
  ),
).proofs;
const tacticalProofs = JSON.parse(
  await readFile(
    new URL('../../docs/verification/snake-remaster/tactical-proofs.json', import.meta.url),
    'utf8',
  ),
).proofs;
const editorialProofs = JSON.parse(
  await readFile(
    new URL('../../docs/verification/snake-remaster/editorial-proofs.json', import.meta.url),
    'utf8',
  ),
).proofs;

test('Release B contains six ordered chapters of eight finite, distinctly authored operations', () => {
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
test('all 288 Release B Solo/Team/pace winning journals verify against current recipes', () => {
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
    if (level.targets.required.some((p) => p.signalProfile)) assert.equal(run.hazardSeed, 17);
    const key = `${entry.id}/${proof.mode}/${proof.pace}`;
    assert.ok(!seen.has(key));
    seen.add(key);
  }
});
function play(proof) {
  proof =
    [...tacticalProofs, ...editorialProofs].find(
      (p) => p.levelId === proof.levelId && p.mode === proof.mode && p.pace === proof.pace,
    ) ?? proof;
  const entry = CLASSIC_SNAKE_LEVELS.find((e) => e.id === proof.levelId),
    level = prepareClassicSnakeLevel(entry, { pace: proof.pace });
  const match = createClassicSnakeMatch(level, {
    mode: proof.mode,
    policy: 'mission',
    seed: 17,
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
  return { entry, level, match };
}
test('all 576 expansion records persist together, reload and earn only compatible completion grades', async (t) => {
  const model = managedIndexedDB(),
    records = createClassicSnakeRecords({ indexedDB: model.indexedDB });
  t.after(() => records.close());
  const releaseA = JSON.parse(
    await readFile(
      new URL('./fixtures/classic-snake-operations-a-proofs.json', import.meta.url),
      'utf8',
    ),
  ).proofs;
  for (const proof of [...releaseA, ...proofs]) {
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
    `576 operation winning records: ${bytes} bytes of the existing 24 MiB logical budget.`,
  );
  const reopened = createClassicSnakeRecords({ indexedDB: model.indexedDB });
  t.after(() => reopened.close());
  await reopened.read();
  assert.equal(Object.keys(reopened.snapshot().rows).length, 576);
  for (const evidence of reopened.ratingEvidence()) {
    const rating = classicSnakeRatingForRecord(evidence);
    assert.equal(rating.stars, 1);
    assert.equal(rating.calibrated, false);
  }
});

test('all 15 variable-hazard missions qualify across two additional schedules without seed substitution', async () => {
  for (const hazardSeed of [73, 2026]) {
    const samples = JSON.parse(
      await readFile(
        new URL(
          `./fixtures/classic-snake-operations-b-hazards-${hazardSeed}-proofs.json`,
          import.meta.url,
        ),
        'utf8',
      ),
    ).proofs;
    assert.equal(samples.length, 90);
    const seen = new Set();
    for (const p of samples) {
      const entry = entries.find((e) => e.id === p.levelId),
        level = prepareClassicSnakeLevel(entry, { pace: p.pace });
      assert.equal(p.replay.hazardSeed, hazardSeed);
      assert.equal(restoreClassicSnakeReplay(p.replay, { level }).status, 'won');
      assert.throws(() =>
        restoreClassicSnakeReplay({ ...p.replay, hazardSeed: hazardSeed + 1 }, { level }),
      );
      const identity = `${p.levelId}/${p.mode}/${p.pace}`;
      assert.ok(!seen.has(identity));
      seen.add(identity);
    }
  }
});

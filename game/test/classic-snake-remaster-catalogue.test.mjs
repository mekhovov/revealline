import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CLASSIC_SNAKE_LEVELS } from '../snake/classic-catalogue.mjs';
import {
  CLASSIC_REMASTER_PROTOTYPES,
  CLASSIC_REMASTER_REVISIONS,
  CLASSIC_EDITORIAL_REVISIONS,
} from '../snake/classic-catalogue-remaster.mjs';
import { CLASSIC_MISSION_COMPOSITIONS } from '../snake/classic-compositions.mjs';
import { CLASSIC_CHAPTER_COMPOSITIONS } from '../snake/classic-worlds.mjs';
import { prepareClassicSnakeLevel } from '../snake/classic-setup.mjs';
import { restoreClassicSnakeReplay, validateClassicSnakeLevel } from '../snake/classic-core.mjs';

test('the remaster keeps every official ID and the obstacle-free beginner entry', () => {
  assert.equal(CLASSIC_SNAKE_LEVELS.length, 240);
  assert.equal(new Set(CLASSIC_SNAKE_LEVELS.map((e) => e.id)).size, 240);
  assert.equal(CLASSIC_SNAKE_LEVELS[0].id, 'classic-snake-open-loop');
  assert.deepEqual(CLASSIC_SNAKE_LEVELS[0].level.walls, []);
  assert.equal(CLASSIC_REMASTER_PROTOTYPES.length, 6);
  assert.equal(new Set(CLASSIC_REMASTER_PROTOTYPES.map((e) => e.levelId)).size, 6);
  for (const prototype of CLASSIC_REMASTER_PROTOTYPES)
    assert.ok(CLASSIC_SNAKE_LEVELS.some((e) => e.id === prototype.levelId));
  assert.ok(CLASSIC_REMASTER_PROTOTYPES.some((e) => e.mode === 'team'));
});

test('all six worlds have three authored construction families and valid solid focal anchors', () => {
  const worlds = new Map();
  for (const entry of CLASSIC_SNAKE_LEVELS) {
    const { assembly } = CLASSIC_MISSION_COMPOSITIONS[entry.id];
    const world = CLASSIC_CHAPTER_COMPOSITIONS[entry.chapterId].scene;
    if (!worlds.has(world)) worlds.set(world, new Set());
    worlds.get(world).add(assembly.family);
    assert.ok(assembly.landmark && assembly.axis && assembly.focus.length === 2);
    if (!assembly.anchor) continue;
    const [x, y] = assembly.anchor,
      [left, top, width, height] = assembly.footprint;
    assert.ok(x >= left && y >= top && x + 1 < left + width && y + 1 < top + height);
    for (const [dx, dy] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ])
      assert.ok(
        entry.level.walls.some((p) => p.x === x + dx && p.y === y + dy),
        `${entry.id}: landmark cannot conceal a traversable corner`,
      );
  }
  assert.equal(worlds.size, 6);
  for (const [world, families] of worlds)
    assert.equal(families.size, 3, `${world}: complete construction vocabulary`);
});

test('240 briefs describe actual accepted missions and concrete adjacent differences', async () => {
  const report = JSON.parse(
    await readFile(
      new URL('../../docs/verification/snake-remaster/catalogue-review.json', import.meta.url),
      'utf8',
    ),
  );
  assert.equal(report.missions.length, 240);
  assert.equal(
    report.revised,
    Object.keys({ ...CLASSIC_REMASTER_REVISIONS, ...CLASSIC_EDITORIAL_REVISIONS }).length,
  );
  for (const entry of CLASSIC_SNAKE_LEVELS) {
    const brief = report.missions.find((m) => m.id === entry.id);
    assert.equal(brief.centralDecision, entry.description.en);
    assert.equal(brief.measurements.walls, entry.level.walls.length);
    assert.equal(brief.measurements.catches, entry.level.goal);
    for (const field of ['opening', 'pressure', 'recovery', 'differenceFromPrevious', 'rationale'])
      assert.ok(brief[field].length > 20, `${entry.id}/${field}`);
    assert.deepEqual(
      brief.focalArrangement.anchor,
      CLASSIC_MISSION_COMPOSITIONS[entry.id].assembly.anchor,
    );
  }
});

test('every tactical revision has accepted Solo/Team journals at all supported paces', async () => {
  const { proofs } = JSON.parse(
    await readFile(
      new URL('../../docs/verification/snake-remaster/tactical-proofs.json', import.meta.url),
      'utf8',
    ),
  );
  const revised = CLASSIC_SNAKE_LEVELS.filter((e) => CLASSIC_REMASTER_REVISIONS[e.id]);
  assert.equal(proofs.length, revised.length * 6);
  const seen = new Set();
  for (const proof of proofs) {
    const entry = revised.find((e) => e.id === proof.levelId);
    assert.ok(entry);
    assert.deepEqual(validateClassicSnakeLevel(entry.level), entry.level);
    const level = prepareClassicSnakeLevel(entry, { pace: proof.pace });
    assert.equal(
      restoreClassicSnakeReplay(proof.replay, { level }).status,
      'won',
      `${entry.id}/${proof.mode}/${proof.pace}`,
    );
    const identity = `${entry.id}/${proof.mode}/${proof.pace}`;
    assert.ok(!seen.has(identity));
    seen.add(identity);
  }
});

test('mobile-source missions retain accepted routes on additional hazard schedules', async () => {
  for (const hazardSeed of [73, 2026]) {
    const { proofs } = JSON.parse(
      await readFile(
        new URL(
          `../../docs/verification/snake-remaster/tactical-proofs-hazards-${hazardSeed}.json`,
          import.meta.url,
        ),
        'utf8',
      ),
    );
    assert.equal(proofs.length, 6);
    for (const proof of proofs) {
      const entry = CLASSIC_SNAKE_LEVELS.find((e) => e.id === proof.levelId),
        level = prepareClassicSnakeLevel(entry, { pace: proof.pace });
      assert.equal(proof.replay.hazardSeed, hazardSeed);
      assert.equal(restoreClassicSnakeReplay(proof.replay, { level }).status, 'won');
      assert.throws(() =>
        restoreClassicSnakeReplay({ ...proof.replay, hazardSeed: hazardSeed + 1 }, { level }),
      );
    }
  }
});

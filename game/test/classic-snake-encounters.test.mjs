import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CLASSIC_SNAKE_V4_LEVELS } from '../snake/classic-catalogue-v4.mjs';
import {
  CLASSIC_SNAKE_EXPEDITION_CHAPTERS,
  CLASSIC_SNAKE_EXPEDITION_LEVELS,
} from '../snake/classic-catalogue-expeditions.mjs';
import { CLASSIC_SNAKE_FIELD_V3_ARCHIVED_LEVELS } from '../snake/classic-catalogue-field-v3-archive.mjs';
import { prepareClassicSnakeLevel } from '../snake/classic-setup.mjs';
import {
  validateClassicSnakeLevel,
  restoreClassicSnakeReplay,
  exportClassicSnakeReplay,
  createClassicSnake,
  queueClassicSnakeTurn,
  stepClassicSnake,
  classicSnakeSignalView,
} from '../snake/classic-core.mjs';
import { canonicalJSON } from '../data-json.mjs';

test('all field encounters admit safe geometry and prepared paces', () => {
  assert.equal(CLASSIC_SNAKE_V4_LEVELS.length, 48);
  for (const entry of CLASSIC_SNAKE_V4_LEVELS)
    for (const pace of ['slow', 'normal', 'fast'])
      assert.doesNotThrow(
        () => validateClassicSnakeLevel(prepareClassicSnakeLevel(entry, { pace })),
        `${entry.id}/${pace}: starts, permanent bypasses, stations and relay pads must admit`,
      );
});

test('four expeditions have distinct geometry, approaches and existing tactical tools', () => {
  const levels = CLASSIC_SNAKE_EXPEDITION_LEVELS;
  assert.equal(levels.length, 24);
  for (const chapter of CLASSIC_SNAKE_EXPEDITION_CHAPTERS)
    assert.equal(levels.filter((entry) => entry.chapterId === chapter.id).length, 6);
  assert.equal(new Set(levels.map((entry) => canonicalJSON(entry.level.walls))).size, 24);
  assert.ok(new Set(levels.map((entry) => canonicalJSON(entry.level.spawns))).size >= 5);
  assert.ok(levels.some((entry) => entry.level.wrap));
  assert.ok(levels.some((entry) => entry.level.shutters.length === 2));
  assert.ok(levels.some((entry) => entry.level.pickups.some((pickup) => pickup.kind === 'pulse')));
  assert.ok(levels.some((entry) => entry.level.pickups.some((pickup) => pickup.kind === 'reel')));
  assert.ok(levels.some((entry) => entry.level.targets.bonus));
});

test('new and revised encounters do not make players recatch an exhausted specialist station', () => {
  const revisedIds = new Set(CLASSIC_SNAKE_FIELD_V3_ARCHIVED_LEVELS.map((entry) => entry.id));
  for (const { id, level } of CLASSIC_SNAKE_V4_LEVELS) {
    if (!revisedIds.has(id) && !id.startsWith('classic-expedition-')) continue;
    const stations = new Set();
    for (let index = 0; index < level.goal; index++) {
      const policy = level.targets.required[index % level.targets.required.length];
      if (!policy.at) continue;
      const station = `${policy.at.x},${policy.at.y}`;
      assert.equal(stations.has(station), false, `${id} repeats station ${station}`);
      stations.add(station);
    }
  }
});

test('tracking missions actually reserve room for moving prey alongside interference', () => {
  for (const id of [
    'classic-field-quiet-return',
    'classic-field-quiet-channel',
    'classic-field-field-links',
    'classic-expedition-edge-of-reception',
    'classic-expedition-blind-bend',
    'classic-expedition-moving-shadow',
    'classic-expedition-clear-ground',
    'classic-expedition-radio-chase',
  ]) {
    const { level } = CLASSIC_SNAKE_V4_LEVELS.find((entry) => entry.id === id);
    assert.equal(level.targets.maxActive, 2, id);
    assert.ok(
      level.targets.required.some((policy) => policy.kind === 'jammer'),
      id,
    );
    assert.ok(
      level.targets.required.some((policy) =>
        ['runner', 'refuge', 'switchback', 'sprinter', 'perimeter', 'contour'].includes(
          policy.kind,
        ),
      ),
      id,
    );
  }
});

test('retired field recipes preserve all exact Solo/Team pace recordings', async () => {
  const { proofs } = JSON.parse(
    await readFile(new URL('./fixtures/classic-snake-field-v3-proofs.json', import.meta.url)),
  );
  assert.equal(CLASSIC_SNAKE_FIELD_V3_ARCHIVED_LEVELS.length, 14);
  assert.equal(proofs.length, 84);
  for (const { replay, levelId, pace } of proofs) {
    const old = CLASSIC_SNAKE_FIELD_V3_ARCHIVED_LEVELS.find((entry) => entry.id === levelId);
    assert.equal(
      canonicalJSON(replay.level),
      canonicalJSON(prepareClassicSnakeLevel(old, { pace })),
    );
    const run = restoreClassicSnakeReplay(replay);
    assert.equal(run.status, 'won');
    assert.deepEqual(exportClassicSnakeReplay(run), replay);
  }
});

test('accepted tracking routes keep mobile prey exposed to interference', async () => {
  const { proofs } = JSON.parse(
    await readFile(new URL('./fixtures/classic-snake-v4-proofs.json', import.meta.url)),
  );
  for (const [id, mode, pace] of [
    ['classic-field-quiet-return', 'solo', 'slow'],
    ['classic-field-quiet-return', 'team', 'slow'],
    ['classic-field-field-links', 'solo', 'slow'],
    ['classic-field-quiet-channel', 'solo', 'normal'],
    ['classic-field-quiet-channel', 'team', 'slow'],
  ]) {
    const { replay } = proofs.find(
      (proof) => proof.levelId === id && proof.mode === mode && proof.pace === pace,
    );
    const run = createClassicSnake(replay.level, {
      mode,
      seed: replay.seed,
      hazardSeed: replay.hazardSeed,
    });
    let cursor = 0,
      hiddenPrey = false,
      hiddenMovement = false;
    while (run.status === 'running') {
      while (replay.turns[cursor]?.tick === run.tick) {
        const turn = replay.turns[cursor++];
        assert.ok(queueClassicSnakeTurn(run, turn.playerId, turn.direction));
      }
      stepClassicSnake(run);
      if (
        classicSnakeSignalView(run).active &&
        run.targets.some((target) =>
          ['runner', 'patroller', 'refuge', 'switchback'].includes(target.kind),
        )
      )
        hiddenPrey = true;
      if (
        classicSnakeSignalView(run).active &&
        run.events.some(
          (event) =>
            event.type === 'target.moved' &&
            ['runner', 'patroller', 'refuge', 'switchback'].includes(event.target.kind),
        )
      )
        hiddenMovement = true;
    }
    assert.equal(run.status, 'won');
    assert.ok(
      hiddenPrey,
      `${id}/${mode}/${pace}: interference must include mobile prey, not only a stationary antenna`,
    );
    if (mode === 'solo')
      assert.ok(hiddenMovement, `${id}/${pace}: the Solo route demonstrates an unseen move`);
    assert.deepEqual(exportClassicSnakeReplay(run), replay);
  }
});

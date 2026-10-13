import test from 'node:test';
import assert from 'node:assert/strict';
import { OPERATION_PROTOTYPES } from './manual/snake-operation-recipes.mjs';
import { prepareClassicSnakeLevel, classicSnakeMissionSettings } from '../snake/classic-setup.mjs';
import { prepareClassicSnakeStudioLevel } from '../snake/classic-studio-recipe.mjs';
import { classicOperationStatus } from '../snake/classic-operation-status.mjs';
import { createClassicSnake } from '../snake/classic-core.mjs';
import {
  CLASSIC_PACKAGE_FORMAT,
  exportClassicSnakePackage,
  importClassicSnakePackage,
  classicSnakePackageEntries,
} from '../snake/classic-community.mjs';

test('operation setup admits authored paces but never silently converts Score or remix recipes', () => {
  for (const entry of OPERATION_PROTOTYPES) {
    for (const pace of ['slow', 'normal', 'fast']) {
      const prepared = prepareClassicSnakeLevel(entry, { pace });
      assert.deepEqual(prepared.operation, entry.level.operation);
      assert.equal(createClassicSnake(prepared).version, 'classic-snake-core.v5');
    }
    for (const settings of [
      { format: 'endless' },
      { targetRules: 'moving' },
      { targetRules: 'varied' },
    ]) {
      assert.throws(() => prepareClassicSnakeLevel(entry, settings), /Operations require/);
      assert.doesNotThrow(() =>
        prepareClassicSnakeLevel(entry, classicSnakeMissionSettings(entry, settings)),
      );
    }
  }
});
test('Studio and portable packages preserve every operation object and rule', async () => {
  const entries = OPERATION_PROTOTYPES.map((entry) => ({
    title: entry.title,
    description: entry.hint,
    level: prepareClassicSnakeStudioLevel(entry.level),
  }));
  const pack = await importClassicSnakePackage(
    exportClassicSnakePackage({
      format: CLASSIC_PACKAGE_FORMAT,
      title: { en: 'Operations', uk: 'Операції' },
      entries,
    }),
  );
  for (const [index, installed] of classicSnakePackageEntries(pack).entries()) {
    assert.deepEqual(installed.level.operation, OPERATION_PROTOTYPES[index].level.operation);
    assert.equal(
      createClassicSnake(installed.level, { mode: 'team' }).version,
      'classic-snake-core.v5',
    );
  }
});
test('shared objective copy exposes routing, delivery and extraction readiness in either language', () => {
  const run = createClassicSnake(OPERATION_PROTOTYPES[7].level);
  assert.match(classicOperationStatus(run), /Stage 1\/2.*Delivered 0\/2.*Plate 0\/1/);
  assert.match(classicOperationStatus(run, 'uk'), /Етап 1\/2.*Доставлено 0\/2.*Плита 0\/1/);
  run.operation.stage = 1;
  run.catches = 1;
  assert.match(classicOperationStatus(run), /Reach the arrow/);
  run.operation.stage = 2;
  assert.equal(classicOperationStatus(run), 'Operation complete');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareClassicSnakeStudioLevel } from '../snake/classic-studio-recipe.mjs';
import { CLASSIC_SNAKE_V4_LEVELS } from '../snake/classic-catalogue-v4.mjs';
import { CLASSIC_SNAKE_LEVELS } from '../snake/classic-catalogue.mjs';
import { createClassicSnake } from '../snake/classic-core.mjs';
import {
  CLASSIC_PACKAGE_FORMAT,
  exportClassicSnakePackage,
  importClassicSnakePackage,
  classicSnakePackageEntries,
} from '../snake/classic-community.mjs';

test('Studio clones every v4 template without losing its version or authored policies', async () => {
  for (const source of CLASSIC_SNAKE_V4_LEVELS) {
    const before = structuredClone(source.level);
    const clone = prepareClassicSnakeStudioLevel(source.level);
    assert.deepEqual(clone, before);
    assert.notEqual(clone, source.level);
    clone.id = `studio-${source.id}`;
    clone.revision = 'studio-copy-1';
    const pack = {
      format: CLASSIC_PACKAGE_FORMAT,
      title: source.title,
      entries: [{ title: source.title, description: source.description, level: clone }],
    };
    const imported = await importClassicSnakePackage(exportClassicSnakePackage(pack));
    assert.equal(imported.entries[0].level.version, 'classic-snake-level.v4');
    assert.deepEqual(imported.entries[0].level.targets, source.level.targets);
    assert.deepEqual(imported.entries[0].level.walls, source.level.walls);
    const installed = classicSnakePackageEntries(imported)[0];
    assert.equal(
      createClassicSnake(installed.level, { mode: 'team' }).version,
      'classic-snake-core.v4',
    );
    assert.deepEqual(source.level, before);
  }
});

test('Studio retains explicit v3 upgrades for legacy templates and preserves v3 recipes', () => {
  for (const version of ['v1', 'v2', 'v3']) {
    const source = CLASSIC_SNAKE_LEVELS.find((row) => row.level.version.endsWith(version));
    const before = structuredClone(source.level);
    const clone = prepareClassicSnakeStudioLevel(source.level);
    assert.equal(clone.version, 'classic-snake-level.v3');
    if (version === 'v3') assert.deepEqual(clone, source.level);
    assert.deepEqual(source.level, before);
  }
});

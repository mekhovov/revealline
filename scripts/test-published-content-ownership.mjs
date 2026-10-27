import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertPublishedEditionAssets } from './published-content-ownership.mjs';
import { collectBuildFiles, readBuildConfig, PROJECT_ROOT } from './game-cli.mjs';

test('publication owns every community asset and rejects orphan or missing catalog media', async () => {
  const catalog = JSON.parse(await readFile(new URL('../game/editions/catalog.json', import.meta.url)));
  const files = await collectBuildFiles(PROJECT_ROOT, await readBuildConfig());
  const result = assertPublishedEditionAssets(files, catalog);
  assert.equal(result.ownedEditionAssets, catalog.assets.length);
  assert.throws(() => assertPublishedEditionAssets([...files, 'game/editions/assets/unregistered.png'], catalog), /Unowned published edition assets/);
  assert.throws(() => assertPublishedEditionAssets(files.filter(name => name !== catalog.assets[0].path), catalog), /Missing declared edition assets/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MENU_SCENES, resolveMenuScene } from '../ui/menu-scene-catalog.mjs';
import { editionPublicSlug } from '../edition-context.mjs';

const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));

test('native menu inventory covers every shipped edition and both launch routes', async () => {
  const catalog = await json('../editions/catalog.json');
  const inventory = await json('../../docs/native-menu-inventory.json');
  assert.equal(Object.keys(MENU_SCENES).length, 18);
  assert.equal(inventory.editions.length, catalog.editions.length);
  for (const edition of catalog.editions) {
    const row = inventory.editions.find(({ id }) => id === edition.id);
    assert.ok(row, `Missing edition ${edition.id}`);
    assert.equal(row.title, edition.name);
    assert.equal(row.brand, edition.brandId);
    assert.deepEqual(row.modes, edition.modes);
    const slug = editionPublicSlug(edition.id);
    assert.deepEqual(row.routes, [`/game/?edition=${slug}`, `/editions/${slug}/app/`]);
    assert.equal(resolveMenuScene({ editionId: edition.id }).id, row.scene);
    assert.ok(MENU_SCENES[row.scene]);
  }
  for (const themeId of inventory.worlds) assert.equal(resolveMenuScene({ themeId }).id, themeId);
});

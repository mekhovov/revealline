import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
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

test('every active menu destination has source or an explicit current launcher generator', async () => {
  const inventory = await json('../../docs/native-menu-inventory.json');
  const root = new URL('../../', import.meta.url);
  const generated = new Map(inventory.generatedRoutes.map((row) => [row.route, row]));
  const expectedGenerated = new Set([
    '/app/',
    ...inventory.editions.map((edition) => `/editions/${edition.publicSlug}/app/`),
    ...inventory.editions
      .filter((edition) => edition.publicSlug !== edition.id)
      .map((edition) => `/editions/${edition.id}/app/`),
  ]);
  assert.deepEqual(new Set(generated.keys()), expectedGenerated);
  const routes = [
    ...inventory.hosts.map(({ route }) => route),
    ...inventory.supportRoutes,
    ...inventory.authoringRoutes.map(({ route }) => route),
    ...inventory.referenceRoutes.map(({ route }) => route),
    ...inventory.editions.flatMap(({ routes, legacyRoutes = [] }) => [...routes, ...legacyRoutes]),
  ];
  const sourceFile = async (file) => {
    assert.equal((await stat(new URL(file, root))).isFile(), true, file);
  };
  for (const route of new Set(routes)) {
    if (generated.has(route)) {
      const declaration = generated.get(route);
      await sourceFile(declaration.generator);
      if (declaration.source) await sourceFile(declaration.source);
      continue;
    }
    const pathname = new URL(route, 'https://menu.invalid').pathname;
    await sourceFile(`${pathname.slice(1)}${pathname.endsWith('/') ? 'index.html' : ''}`);
  }
  for (const deferred of inventory.deferredRoutes) {
    assert.equal(routes.includes(deferred.route), false, `${deferred.route} is not active`);
    assert.equal(deferred.status, 'pending dependency');
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {
  compactContentRegistry,
  catalogBundle,
  readCatalogs,
  validateCatalogMessages,
} from './localization.mjs';

test('catalog validation checks Ukrainian-only plural forms and rejects orphan translations', () => {
  const resources = {
    en: { common: { lives_one: '{{count}} life', lives_other: '{{count}} lives' } },
    uk: {
      common: {
        lives_one: '{{count}} життя',
        lives_few: '{{count}} життя',
        lives_many: '{{count}} життів',
        lives_other: '{{count}} життя',
      },
    },
  };
  assert.deepEqual(validateCatalogMessages(resources), []);
  resources.uk.common.lives_few = '{{wrong}} життя';
  assert.deepEqual(validateCatalogMessages(resources), [
    'Interpolation mismatch: common:lives_few',
  ]);
  resources.uk.common.lives_few = '{{count}} життя';
  resources.uk.common.orphan = 'Підпис';
  assert.deepEqual(validateCatalogMessages(resources), ['Missing English: common:orphan']);
  delete resources.uk.common.orphan;
  delete resources.uk.common.lives_many;
  assert.deepEqual(validateCatalogMessages(resources), [
    'Missing Ukrainian plural: common:lives_many',
  ]);
});

test('compact classic catalogs reconstruct every original namespace and plural without filling missing values', async () => {
  const catalogs = await readCatalogs();
  const scope = vm.createContext({});
  const bundle = catalogBundle(catalogs);
  vm.runInContext(bundle, scope);
  assert.deepEqual(JSON.parse(JSON.stringify(scope.RevealLineTranslations)), catalogs);
  assert.ok(Buffer.byteLength(bundle) < Buffer.byteLength(JSON.stringify(catalogs)));
  const incomplete = {
    en: { common: { plain: '</script>', count_one: 'one', count_other: 'many' } },
    uk: {
      common: { count_one: 'один', count_few: 'кілька', count_many: 'багато', count_other: 'інші' },
    },
  };
  const source = catalogBundle(incomplete);
  assert.doesNotMatch(source, /<\/script>/);
  vm.runInContext(source, scope);
  assert.deepEqual(JSON.parse(JSON.stringify(scope.RevealLineTranslations)), incomplete);
});

test('compact content registry preserves identity and original-text guards while sharing repeated records', async () => {
  const fields = { name: { source: 'Original title', key: 'content:title' } };
  const registry = {
    first: { fields, source: 'source.json', pointer: '/0' },
    second: { fields, source: 'source.json', pointer: '/1' },
    different: { fields: { name: { source: 'Another title', key: 'content:anotherTitle' } } },
  };
  const source = compactContentRegistry(registry);
  const { default: result } = await import(
    `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
  );
  assert.deepEqual(Object.keys(result), Object.keys(registry));
  for (const id of Object.keys(registry)) assert.deepEqual(result[id].fields, registry[id].fields);
  assert.equal(result.first, result.second);
  assert.notEqual(result.first, result.different);
  assert.doesNotMatch(source, /source\.json/);
  assert.equal(source.split('Original title').length, 2);
});

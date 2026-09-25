import test from 'node:test';
import assert from 'node:assert/strict';
import { compactContentRegistry } from './localization.mjs';

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

import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { resolvePresentation } from '../presentation/model.mjs';
import { createStudioStore } from '../presentation/studio-store.mjs';
import {
  reviseStudioTheme,
  replaceStudioCollection,
  generateAssetPrompt,
} from '../presentation/studio-session.mjs';

test('studio revisions preserve prior theme records and apply explicit token changes', () => {
  const original = createDefaultThemeBundle();
  const revised = reviseStudioTheme(original, { tokens: { amber: '#ffcc00' } });
  assert.equal(resolvePresentation(revised).tokens.amber, '#ffcc00');
  assert.notEqual(resolvePresentation(original).tokens.amber, '#ffcc00');
  for (const theme of original.themes)
    assert.deepEqual(
      revised.themes.find((row) => row.id === theme.id && row.revision === theme.revision),
      theme,
    );
  assert.throws(
    () => reviseStudioTheme(revised, { tokens: { ink: 'url(https://example.com)' } }),
    /Invalid/,
  );
});

test('collection replacement rejects incomplete members and missing dependencies atomically', () => {
  const original = createDefaultThemeBundle();
  const bindings = resolvePresentation(original).bindings;
  const before = JSON.stringify(original);
  assert.throws(
    () =>
      replaceStudioCollection(original, {
        id: 'kit',
        name: 'Kit',
        requiredSlots: ['ui.panel', 'ui.dialog'],
        bindings: { 'ui.panel': bindings['ui.panel'] },
      }),
    /missing a required binding/,
  );
  assert.equal(JSON.stringify(original), before);
  const next = replaceStudioCollection(original, {
    id: 'kit',
    name: 'Kit',
    requiredSlots: ['ui.panel', 'ui.dialog'],
    bindings: { 'ui.panel': bindings['ui.panel'], 'ui.dialog': bindings['ui.dialog'] },
  });
  assert.equal(resolvePresentation(next).collection.id, 'kit');
  assert.equal(original.collections.length, 0);
});

test('studio database compare-and-swap rejects stale tabs and preserves data on write failure', async () => {
  const fixture = memoryIndexedDB();
  const store = createStudioStore({ indexedDB: fixture.indexedDB });
  assert.equal(await store.load(), null);
  const document = createDefaultThemeBundle();
  const first = await store.save(document, new Map());
  assert.equal(first.generation, 1);
  await assert.rejects(store.save(document, new Map()), /changed in another tab/);
  fixture.failAnyPutAt = 1;
  await assert.rejects(
    store.save(reviseStudioTheme(document, { tokens: { cyan: '#eeeeff' } }), new Map(), {
      expectedGeneration: 1,
    }),
    /write failure/,
  );
  const restored = await store.load();
  assert.equal(restored.generation, 1);
  assert.deepEqual(restored.document, document);
  await store.close();
  await assert.rejects(store.load(), /closed/);
});

test('generated prompts carry real slot, theme, states and release limitations', () => {
  const bundle = createDefaultThemeBundle();
  const slot = bundle.slots.find((row) => row.id === 'player.scout.detailed');
  const prompt = generateAssetPrompt(slot, resolvePresentation(bundle), 'edit');
  for (const fragment of [
    'Edit the attached',
    'player.scout.detailed',
    '64×64',
    'FPV Field Kit',
    'not an approved release',
    'rotorAnchors',
  ])
    assert.ok(prompt.includes(fragment), fragment);
});

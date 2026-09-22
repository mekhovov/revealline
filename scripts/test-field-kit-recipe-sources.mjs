import test from 'node:test';
import assert from 'node:assert/strict';
import { fieldKitRecipeSources } from './produce-field-kit-theme.mjs';

test('functional helper changes invalidate only their explicit recipe group', async () => {
  const inputs = new Map();
  const before = await fieldKitRecipeSources(async (name) => {
    assert(!inputs.has(name) || name === 'game/ui/field-kit-compiled.css');
    inputs.set(name, Buffer.from(name));
    return inputs.get(name);
  });
  for (const [name, group] of [
    ['game/presentation/dom-ownership.mjs', 'ui'],
    ['game/presentation/host.mjs', 'ui'],
    ['game/content-design/actor-marker.mjs', 'effects'],
    ['game/ui/lane-presentation.mjs', 'effects'],
    ['game/ui/render.mjs', 'effects'],
    ['game/ui/relay-view.mjs', 'effects'],
    ['game/ui/directional-view.mjs', 'effects'],
    ['game/enemy-catalog.mjs', 'effects'],
    ['game/presentation/journey-actor-materials.mjs', 'motion'],
    ['game/soundtrack-portable.mjs', 'audio'],
    ['game/content/soundtrack-catalogue.mjs', 'audio'],
  ]) {
    assert(inputs.has(name), `${name}: missing dependency`);
    const after = await fieldKitRecipeSources(async (file) =>
      file === name ? Buffer.from(`${file}: changed`) : inputs.get(file),
    );
    for (const key of Object.keys(before))
      assert.equal(before[key] === after[key], key !== group, `${name}/${key}`);
    assert(after[group].includes(name));
  }
  assert.deepEqual(await fieldKitRecipeSources(async (file) => inputs.get(file)), before);
});

test('missing helper bytes cannot produce a supposedly valid fingerprint', async () => {
  await assert.rejects(
    fieldKitRecipeSources(async (file) => {
      if (file === 'game/ui/lane-presentation.mjs') throw new Error('Missing required helper');
      return Buffer.from(file);
    }),
    /Missing required helper/,
  );
});

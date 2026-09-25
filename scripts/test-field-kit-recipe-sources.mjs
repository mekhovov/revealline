import test from 'node:test';
import assert from 'node:assert/strict';
import { fieldKitRecipeSources } from './produce-field-kit-theme.mjs';

test('every declared helper invalidates all sharing groups and leaves nonconsumers unchanged', async () => {
  const inputs = new Map();
  const before = await fieldKitRecipeSources(async (name) => {
    inputs.set(name, Buffer.from(name));
    return inputs.get(name);
  });
  const consumers = new Map();
  for (const [group, source] of Object.entries(before)) {
    const paths = source.split(' sha256:')[0].split('; ');
    assert.equal(new Set(paths).size, paths.length, `${group}: duplicate input`);
    for (const name of paths) {
      assert(inputs.has(name), `${group}: unread input ${name}`);
      if (!consumers.has(name)) consumers.set(name, []);
      consumers.get(name).push(group);
    }
  }
  // These independent sharing contracts guard against a missing dependency
  // being accepted just because it vanished from the declaration under test.
  for (const [name, groups] of [
    ['game/presentation/dom-ownership.mjs', ['ui']],
    ['game/presentation/host.mjs', ['ui']],
    ['game/ui/field-kit-compiled.css', ['screens', 'ui']],
    ['game/presentation/team-runtime-slots.mjs', ['team', 'ui']],
    ['game/content-design/actor-marker.mjs', ['effects', 'team']],
    ['game/ui/lane-presentation.mjs', ['effects']],
    ['game/ui/render.mjs', ['effects']],
    ['game/ui/relay-view.mjs', ['effects']],
    ['game/ui/directional-view.mjs', ['effects']],
    ['game/enemy-catalog.mjs', ['effects', 'team']],
    ['game/presentation/journey-actor-materials.mjs', ['motion', 'team']],
    ['game/ui/actor-presentation.mjs', ['motion', 'team']],
    ['authoring/motion-lab/render-character.mjs', ['motion', 'team']],
    ['game/ui/classic-view.mjs', ['effects', 'team']],
    ['game/couch/coop-view.mjs', ['team']],
    ['game/soundtrack-bundled.mjs', ['audio']],
    ['game/soundtrack-portable.mjs', ['audio']],
    ['game/content/soundtrack-catalogue.mjs', ['audio']],
    ['game/online-soundtrack-catalogue.mjs', ['audio']],
    ['game/official-downloads.mjs', ['audio']],
    ['game/soundtrack-download-volumes.mjs', ['audio']],
    ['game/installed-app.mjs', ['audio']],
    ['game/managed-media-store.mjs', ['audio']],
    ['game/media-storage-record.mjs', ['audio']],
  ])
    assert.deepEqual([...(consumers.get(name) ?? [])].sort(), groups, name);
  assert.equal(consumers.size, inputs.size, 'Every read belongs to a declared group');
  for (const [name, groups] of consumers) {
    const after = await fieldKitRecipeSources(async (file) =>
      file === name ? Buffer.from(`${file}: changed`) : inputs.get(file),
    );
    for (const group of Object.keys(before))
      assert.equal(before[group] !== after[group], groups.includes(group), `${name}/${group}`);
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

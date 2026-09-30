import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fieldKitRecipeSources } from '../../scripts/produce-field-kit-theme.mjs';

for (const dependency of [
  'game/online-soundtrack-sources.mjs',
  'game/online-soundtrack-source-store.mjs',
])
  test(`${dependency} changes the audio review fingerprint without changing other groups`, async () => {
    const cache = new Map();
    const read = (name) => {
      if (!cache.has(name)) cache.set(name, readFile(new URL(`../../${name}`, import.meta.url)));
      return cache.get(name);
    };
    const original = await fieldKitRecipeSources(read);
    const paths = original.audio.split(' sha256:')[0].split('; ');
    assert.equal(paths.filter((name) => name === dependency).length, 1);
    const changed = await fieldKitRecipeSources(async (name) => {
      const bytes = await read(name);
      return name === dependency ? Buffer.concat([bytes, Buffer.from('\n// changed\n')]) : bytes;
    });
    assert.notEqual(changed.audio, original.audio);
    for (const group of Object.keys(original).filter((group) => group !== 'audio'))
      assert.equal(changed[group], original[group], `${dependency} must not reopen ${group}`);
  });

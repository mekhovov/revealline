import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (name) => readFile(new URL(name, import.meta.url), 'utf8');

test('Pages game and launch entries require the same remembered password gate', async () => {
  const [game, site, boot, launch, gate] = await Promise.all([
    read('../index.html'),
    read('../../site/index.html'),
    read('../boot.mjs'),
    read('../../site/launch.mjs'),
    read('../access-gate.mjs'),
  ]);
  for (const source of [game, site]) {
    assert.match(source, /data-access-state="locked"/);
    assert.match(source, /name="revealline-access-id" content="revealline"/);
    assert.match(source, /fD62nYJ5uj8yGLsEBEAn2Blq8lcesFrR_gdebUswlxg/);
  }
  assert.match(boot, /await host\.RevealLineAccess\?\.ready/);
  assert.match(launch, /await host\.RevealLineAccess\?\.ready/);
  assert.match(gate, /localStorage\?\.setItem/);
});

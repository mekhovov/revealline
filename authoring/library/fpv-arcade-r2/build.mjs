#!/usr/bin/env node
/** Build only the new R2 pack; original image bytes and the prior pack are read-only inputs. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validatePack } from '../../../game/packs.mjs';
const here = new URL('./', import.meta.url);
const output = new URL('../../../game/content/packs/fpv-arcade-r2.json', here);
const source = JSON.parse(await readFile(new URL('pack-source.json', here), 'utf8'));
const prior = JSON.parse(
  await readFile(new URL('../../../game/content/packs/fpv-arcade.json', here), 'utf8'),
);
const provenance = JSON.parse(await readFile(new URL('art-provenance.json', here), 'utf8'));
assert.equal(source.id, 'fpv-arcade-r2');
assert.equal(source.campaigns[0].revision, '2');
for (const record of provenance.reusedOriginalRewards) {
  const bytes = await readFile(new URL(record.path, here));
  assert.deepEqual(bytes, await readFile(new URL(record.original, here)));
  assert.equal(bytes.length, record.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), record.sha256);
  const id = record.path.split('/').at(-1).replace('.png', '');
  const image = prior.levelVisuals.find((v) => v.levelId === id).visualOverrides.background;
  assert.deepEqual(bytes, Buffer.from(image.dataUrl.split(',')[1], 'base64'));
}
const pack = { ...source, levelVisuals: prior.levelVisuals };
const check = validatePack(pack);
assert.equal(check.valid, true, check.errors.join('; '));
if (process.argv.slice(2).length === 0) {
  assert.deepEqual(JSON.parse(await readFile(output, 'utf8')), pack);
  console.log('R2 source, three reused original images and built pack match.');
} else {
  assert.deepEqual(process.argv.slice(2), ['--write']);
  await writeFile(output, JSON.stringify(pack, null, 2) + '\n', { flag: 'wx' });
}

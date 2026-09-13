#!/usr/bin/env node
/** New edition only: retain exact R2 source and original picture bytes. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validatePack } from '../../../game/packs.mjs';
const root = new URL('../../../', import.meta.url),
  output = new URL('game/content/packs/fpv-arcade-r3.json', root);
const priorBytes = await readFile(new URL('game/content/packs/fpv-arcade-r2.json', root));
assert.equal(
  createHash('sha256').update(priorBytes).digest('hex'),
  '3235a0ae1f9f0ae9952f5d98d2001ec5022ab47fc459c3fb0093f48de620377f',
);
const pack = JSON.parse(priorBytes);
pack.id = 'fpv-arcade-r3';
pack.version = '3.0.0';
pack.name = 'FPV Front · First Light R3';
pack.description =
  'The First Light R2 boards with travelling trail impacts: enemy contact sends a pulse in both directions along an unfinished line. Close the cut before the chasing pulse arrives. Direct enemy contact remains dangerous. Reuses the three original First Light pictures.';
const campaign = pack.campaigns[0];
campaign.id = 'fpv-first-light-r3';
campaign.revision = '3';
campaign.title = pack.name;
pack.themes[0].subtitle = 'First Light R3 · Arcade';
for (const level of campaign.levels) {
  level.revision = '3';
  level.classic.lineImpact = { version: 'line-impact.v1', speed: 24 };
}
assert.deepEqual(pack.levelVisuals, JSON.parse(priorBytes).levelVisuals);
const checked = validatePack(pack);
assert.equal(checked.valid, true, checked.errors.join('; '));
if (process.argv.slice(2).length === 0) {
  assert.deepEqual(JSON.parse(await readFile(output, 'utf8')), pack);
  console.log('R3 edition and exact reused R2/original picture bindings match.');
} else {
  assert.deepEqual(process.argv.slice(2), ['--write']);
  await writeFile(output, JSON.stringify(pack, null, 2) + '\n', { flag: 'wx' });
}

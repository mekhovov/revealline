#!/usr/bin/env node
/** New Arcade edition: retain all original R3 inputs and picture bytes. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validatePack } from '../../../game/packs.mjs';

export function buildArcadeEdition(prior) {
  assert.equal(prior.id, 'fpv-arcade-r3');
  assert.equal(prior.campaigns.length, 1);
  assert.equal(prior.campaigns[0].id, 'fpv-first-light-r3');
  const pack = structuredClone(prior);
  pack.id = 'fpv-arcade-r4';
  pack.version = '4.0.0';
  pack.name = 'FPV Front · First Light Arcade R4';
  pack.themes[0].subtitle = 'First Light R4 · Arcade';
  pack.description =
    'Direction-only Arcade flight on the First Light R3 boards. Fly at the authored cruise speed, close a cut and choose a fresh direction. Contact pickups apply automatically; there are no manual Scan, supply or Boost actions. Travelling trail impacts and the three original picture rewards remain.';
  const campaign = pack.campaigns[0];
  campaign.id = 'fpv-first-light-r4';
  campaign.revision = '4';
  campaign.title = pack.name;
  for (const level of campaign.levels) {
    assert.equal(level.rules.moveSpeed, 12);
    assert.equal(level.rules.boostMultiplier, 1.25);
    for (const key of ['objectives', 'supplies', 'signalZones', 'hangars'])
      assert.deepEqual(level[key], []);
    level.revision = '4';
    level.rules.moveSpeed = 15;
    level.rules.boostMultiplier = 1;
    level.classic.arcadeActions = { version: 'arcade-actions.v1' };
    level.metadata.description =
      level.metadata.description.replace(
        'Boost with Shift; Pause remains available.',
        'Pause remains available.',
      ) +
      ' Arcade: automatic contact pickups and a 15-cell-per-second cruise; no manual Scan, supply or Boost actions.';
  }
  assert.equal(pack.classRecipes.length, 1);
  assert.equal(pack.classRecipes[0].id, 'scout');
  pack.classRecipes[0].revision = '2';
  pack.classRecipes[0].description =
    'Direction-only Arcade craft. Cruise speed belongs to each level; fly over marked pickups to receive their effects. Manual Scan, supply and Boost actions are disabled by the authored Arcade policy.';
  assert.deepEqual(pack.levelVisuals, prior.levelVisuals);
  const checked = validatePack(pack);
  assert.equal(checked.valid, true, checked.errors.join('; '));
  return pack;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = new URL('../../../', import.meta.url);
  const source = await readFile(new URL('game/content/packs/fpv-arcade-r3.json', root));
  assert.equal(
    createHash('sha256').update(source).digest('hex'),
    'af6387ab382e4f614832b1b96abaddbd23c8330a44cc96f64e50271cfe081848',
  );
  const pack = buildArcadeEdition(JSON.parse(source));
  const output = new URL('game/content/packs/fpv-arcade-r4.json', root),
    args = process.argv.slice(2);
  if (!args.length) {
    assert.deepEqual(JSON.parse(await readFile(output, 'utf8')), pack);
    console.log('R4 matches the authored policy, retained R3 boards and original pictures.');
  } else {
    assert.deepEqual(args, ['--write']);
    await writeFile(output, JSON.stringify(pack, null, 2) + '\n', { flag: 'wx' });
  }
}

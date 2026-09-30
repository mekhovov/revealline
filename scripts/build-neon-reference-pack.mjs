import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { validatePack } from '../game/packs.mjs';
import { buildNeonChannels } from './build-neon-channels.mjs';
import { buildNeonCrossroads } from './build-neon-crossroads.mjs';
import { buildNeonHearts } from './build-neon-hearts.mjs';
import { buildNeonLabyrinth } from './build-neon-labyrinth.mjs';
import { buildNeonArrows } from './build-neon-arrows.mjs';
import { buildNeonChambers } from './build-neon-chambers.mjs';
import { buildNeonPinwheels } from './build-neon-pinwheels.mjs';
import { buildNeonCrossfire } from './build-neon-crossfire.mjs';
import { buildNeonSpirals } from './build-neon-spirals.mjs';
import { buildNeonSwitchback } from './build-neon-switchback.mjs';
import { buildNeonCrossgrid } from './build-neon-crossgrid.mjs';

import { buildNeonWavebands } from './build-neon-wavebands.mjs';

import { buildNeonConduit } from './build-neon-conduit.mjs';

import { buildNeonSwitchyards } from './build-neon-switchyards.mjs';

import { buildNeonSpines } from './build-neon-spines.mjs';

import { buildNeonPrism } from './build-neon-prism.mjs';

export async function buildNeonReferencePack() {
  const sources = await Promise.all([
    buildNeonChannels(),
    buildNeonCrossroads(),
    buildNeonHearts(),
    buildNeonLabyrinth(),
    buildNeonArrows(),
    buildNeonChambers(),
    buildNeonCrossgrid(),
    buildNeonSwitchback(),
    buildNeonSpirals(),
    buildNeonCrossfire(),
    buildNeonPinwheels(),
    buildNeonWavebands(),
    buildNeonConduit(),
    buildNeonSwitchyards(),
    buildNeonSpines(),
    buildNeonPrism(),
  ]);
  // A pack uses one simulation family. The wall-only standalone studies
  // get new bundled identities and explicit empty foundations in this edition.
  const levels = sources.map(({ scenario }) => ({
    ...structuredClone(scenario.level),
    version: 'xonix-level.v5',
    id: scenario.level.id.replace('-reference', '-pack'),
    foundations: structuredClone(scenario.level.foundations ?? []),
  }));
  const pack = {
    ...sources[0].pack,
    id: 'neon-reference-pack',
    version: '1.0.0',
    name: 'Neon Reference Pack',
    description:
      'Sixteen screenshot-based Arcade levels: Channels, Crossroads, Hearts, Labyrinth, Arrows, Chambers, Crossgrid, Switchback, Spirals, Crossfire, Pinwheels, Wavebands, Conduit, Switchyards, Spines and Prism. Custom reveal images are planned; these levels currently use the existing procedural retro artwork.',
    metadata: {
      author: 'RevealLine',
      license: 'Project content',
      rightsStatus:
        'User-supplied layout references with original procedural placeholder sprites. Custom reveal images are deferred; no source screenshot artwork or music embedded.',
    },
    visualOverrides: {},
    levelVisuals: sources.map(({ scenario }, index) => ({
      levelId: levels[index].id,
      visualOverrides: scenario.visualOverrides,
    })),
    campaigns: [
      {
        version: 'xonix-campaign.v1',
        id: 'neon-reference',
        revision: '1',
        title: 'Neon Reference Pack',
        themeId: 'retro',
        classIds: ['scout'],
        levels,
      },
    ],
  };
  const checked = validatePack(pack);
  assert.equal(checked.valid, true, checked.errors.join('; '));
  return pack;
}

if (process.argv[1] && new URL(process.argv[1], 'file:').href === import.meta.url) {
  const { format, resolveConfig } = await import('prettier');
  const destination = new URL('../game/content/packs/neon-reference-pack.json', import.meta.url);
  await writeFile(
    destination,
    await format(JSON.stringify(await buildNeonReferencePack()), {
      ...(await resolveConfig(destination.pathname)),
      parser: 'json',
    }),
  );
  console.log('Neon Reference Pack: 16 valid levels; reveal images deferred.');
}

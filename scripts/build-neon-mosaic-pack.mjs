import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { validatePack } from '../game/packs.mjs';
import { buildNeonMosaic } from './build-neon-mosaic.mjs';

export async function buildNeonMosaicPack() {
  const sources = await buildNeonMosaic();
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
    id: 'neon-mosaic-pack',
    version: '1.0.0',
    name: 'Neon Words & Symbols',
    description:
      '38 neon word and symbol levels: eleven word designs and twenty-seven cultural and FPV symbols. Each arena has distinctive terrain, passages, refuges and enemies. Custom reveal images are planned; existing procedural retro artwork is used for now.',
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
        id: 'neon-mosaic',
        revision: '1',
        title: 'Neon Words & Symbols',
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
  const destination = new URL('../game/content/packs/neon-mosaic-pack.json', import.meta.url);
  await writeFile(
    destination,
    await format(JSON.stringify(await buildNeonMosaicPack()), {
      ...(await resolveConfig(destination.pathname)),
      parser: 'json',
    }),
  );
  console.log('Neon Words & Symbols: 38 valid levels; reveal images deferred.');
}

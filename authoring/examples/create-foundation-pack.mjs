import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import {
  validatePack,
  preparePack,
  emptyPackLibrary,
  installPack,
  exportPackLibrary,
  importPackLibrary,
  scenarioFromPack,
} from '../../game/packs.mjs';

// A procedural teaching example, not an accepted production campaign.
const output = process.argv[2];
if (!output || process.argv.length !== 3) {
  throw new Error('Usage: node authoring/examples/create-foundation-pack.mjs OUTPUT.json');
}
const template = JSON.parse(
  await readFile(new URL('../../game/content/packs/night-shift.json', import.meta.url), 'utf8'),
);
const pack = {
  ...template,
  format: 'xonix-pack.v6',
  engine: 'xonix-core.v6',
  id: 'workshop-foundation-example',
  version: '1.0.0',
  name: 'Workshop · Island connections',
  description:
    'A procedural authoring example: connect an island to the border, then close another route. Not a production difficulty benchmark.',
  masteries: [],
  visualOverrides: {},
  levelVisuals: [],
  campaigns: [
    {
      ...template.campaigns[0],
      id: 'workshop-island-connections',
      revision: '1',
      title: 'Island connections',
      levels: [
        {
          version: 'xonix-level.v5',
          id: 'workshop-first-bridge',
          revision: '1',
          name: 'First bridge',
          width: 72,
          height: 36,
          spawn: { x: 32.5, y: 17.5 },
          foundations: [{ x: 30, y: 15, w: 5, h: 5 }],
          goal: { coverage: 0.2 },
          walls: [],
          encounter: null,
          classic: { version: 'classic.v1', terrain: [], powerups: [] },
          enemies: [{ id: 'keeper', type: 'bouncer', x: 60.5, y: 18.5, vx: 2, vy: 2 }],
          objectives: [],
          supplies: [],
          rules: { lives: 3, moveSpeed: 10, stopOnCapture: true },
        },
      ],
    },
  ],
};
const checked = validatePack(pack);
if (!checked.valid) throw new Error(checked.errors.join('\n'));
// No image decoder is stubbed: this example has procedural art, with no embedded images.
const prepared = await preparePack(pack, { library: emptyPackLibrary() });
const installed = installPack(emptyPackLibrary(), prepared.pack);
const exported = exportPackLibrary(installed);
const restored = await importPackLibrary(exported);
if (exportPackLibrary(restored) !== exported) throw new Error('Pack-library round trip changed.');
for (const turnPolicy of ['immediate', 'grid-center']) {
  const scenario = scenarioFromPack(
    restored.packs[0],
    pack.campaigns[0].id,
    pack.campaigns[0].levels[0].id,
    { turnPolicy, seed: 1 },
  );
  if (scenario.format !== 'xonix-playground.v6') throw new Error('Scenario version changed.');
}
const bytes = Buffer.from(`${JSON.stringify(pack, null, 2)}\n`);
// Refuse replacement so repeating the example cannot silently overwrite edited work.
await writeFile(resolve(output), bytes, { flag: 'wx' });
console.log(
  JSON.stringify({
    path: resolve(output),
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    format: pack.format,
    roundTrip: 'passed',
    scenarios: ['immediate', 'grid-center'],
    scope:
      'Data preparation and transfer only; play, image decoding and device gates are separate.',
  }),
);

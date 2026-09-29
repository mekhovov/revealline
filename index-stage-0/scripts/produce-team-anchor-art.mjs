/** Reproduce the original Team relay-anchor pair; never approve it implicitly. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { format, resolveConfig } from 'prettier';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { encodeSpritePNG, inspectSprite } from './produce-field-kit-sprites.mjs';
import { teamAnchorSlotSpecs } from '../game/presentation/team-anchor-slots.mjs';
import {
  teamAnchorPixels,
  TEAM_ANCHOR_ART_VERSION,
  TEAM_ANCHOR_PALETTE,
} from '../authoring/library/team-anchor-field-kit-v1/source.mjs';

export const TEAM_ANCHOR_ART_DIRECTORY = 'authoring/library/team-anchor-field-kit-v1';
const root = fileURLToPath(new URL('../', import.meta.url));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
// Capture once alongside the imported drawing; later edits must not relabel cached code.
const importedSource = await readFile(
  new URL('../authoring/library/team-anchor-field-kit-v1/source.mjs', import.meta.url),
);

export async function buildTeamAnchorArt({ projectRoot = root } = {}) {
  const source = await readFile(join(projectRoot, TEAM_ANCHOR_ART_DIRECTORY, 'source.mjs')),
    sourceSha256 = hash(source),
    files = new Map(),
    assets = [];
  if (!source.equals(importedSource))
    throw new Error('Team anchor source does not match the loaded drawing module.');
  for (const slot of teamAnchorSlotSpecs()) {
    const state = slot.id.split('.').at(-1),
      pixels = teamAnchorPixels(state),
      image = encodeSpritePNG(pixels),
      inspection = inspectSprite(pixels),
      filename = `${state}.png`;
    if (
      pixels.width !== slot.dimensions.width ||
      pixels.height !== slot.dimensions.height ||
      image.length > slot.budget.maxBytes ||
      !inspection.transparentPixels ||
      !inspection.opaquePixels ||
      inspection.colors.some((color) => !slot.palette.includes(color))
    )
      throw new Error(`Invalid produced Team anchor: ${slot.id}.`);
    files.set(filename, image);
    assets.push({
      slot: slot.id,
      file: filename,
      bytes: image.length,
      sha256: hash(image),
      width: pixels.width,
      height: pixels.height,
      pivot: { x: 0.5, y: 0.5 },
      ...inspection,
      quality: 'produced',
      description:
        state === 'captured'
          ? 'Braced radio receiver with a closed cyan connector and joined pale centre.'
          : 'The same radio receiver with two separated amber connector jaws.',
      provenance: {
        creator: 'Reveal Line',
        license: 'Original project artwork',
        source: `${TEAM_ANCHOR_ART_DIRECTORY}/source.mjs`,
        sourceSha256,
        method: 'Original integer-pixel drawing; no AI image, reference pixels or sampled artwork.',
        prompt: `${slot.prompt}\nMATCHED FAMILY: Field Kit relay radio v${TEAM_ANCHOR_ART_VERSION}. Preserve two upright receiver ears, central mast, pale case rim and two feet. Available uses two separated connector jaws; captured uses one closed linked frame and a joined centre. Retain this non-colour distinction. Never bake anchor letters, checks, capture perimeter or progress into either image. Palette: ${Object.values(TEAM_ANCHOR_PALETTE).join(', ')}. Verify both states together at 24 CSS pixels over concealment and light/dark terrain; review in Relay Yard and an imported multi-stronghold map.`,
      },
    });
  }
  const manifest = {
    format: 'revealline-team-anchor-art.v1',
    revision: TEAM_ANCHOR_ART_VERSION,
    sourceSha256,
    assets,
    requirements: [
      'Production candidates only: full Studio and live-map visual review remains explicit.',
      'Install available/captured as one pair; preserve source and upload derivatives.',
      'Runtime owns objective letters, checks, capture geometry and timing.',
      'First Connection has no anchors; do not invent them for a preview.',
    ],
  };
  files.set(
    'manifest.json',
    Buffer.from(
      await format(JSON.stringify(manifest, null, 2), {
        ...(await resolveConfig(new URL('../package.json', import.meta.url))),
        parser: 'json',
      }),
    ),
  );
  return { manifest, files };
}

export async function produceTeamAnchorArt({ projectRoot = root, check = false } = {}) {
  const production = await buildTeamAnchorArt({ projectRoot });
  const output = join(projectRoot, TEAM_ANCHOR_ART_DIRECTORY, 'prepared');
  const pending = [];
  for (const [name, bytes] of production.files) {
    const target = join(output, name);
    let existing;
    try {
      existing = await readFile(target);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (existing) {
      if (!existing.equals(bytes))
        throw new Error(`Immutable Team anchor output differs: ${name}. Create a new revision.`);
    } else if (check) throw new Error(`Missing produced Team anchor: ${name}.`);
    else pending.push([target, bytes]);
  }
  // Refuse known mismatches before writing any member of this pair.
  // A filesystem failure can leave new files, but never an adopted runtime collection.
  if (pending.length) await mkdir(output, { recursive: true });
  for (const [target, bytes] of pending) await writeFile(target, bytes, { flag: 'wx' });
  return production.manifest;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--check')) throw new Error('Use --check or no arguments.');
  const manifest = await produceTeamAnchorArt({ check: args.includes('--check') });
  console.log(`${manifest.assets.length} Team relay-anchor icons reproduced.`);
}

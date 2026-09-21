/** Reproduce the original Team feedback family; never approve it implicitly. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { format, resolveConfig } from 'prettier';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { encodeSpritePNG, inspectSprite } from './produce-field-kit-sprites.mjs';
import { teamEffectSlotSpecs } from '../game/presentation/team-effect-slots.mjs';
import {
  teamFeedbackPixels,
  TEAM_FEEDBACK_ART_VERSION,
  TEAM_FEEDBACK_PALETTE,
  TEAM_FEEDBACK_DESCRIPTIONS,
} from '../authoring/library/team-feedback-field-kit-v1/source.mjs';

export const TEAM_FEEDBACK_ART_DIRECTORY = 'authoring/library/team-feedback-field-kit-v1';
const root = fileURLToPath(new URL('../', import.meta.url));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
// Capture once alongside the imported drawing; later edits must not relabel cached code.
const importedSource = await readFile(
  new URL('../authoring/library/team-feedback-field-kit-v1/source.mjs', import.meta.url),
);

export async function buildTeamFeedbackArt({ projectRoot = root } = {}) {
  const source = await readFile(join(projectRoot, TEAM_FEEDBACK_ART_DIRECTORY, 'source.mjs')),
    sourceSha256 = hash(source),
    files = new Map(),
    assets = [];
  if (!source.equals(importedSource))
    throw new Error('Team feedback source does not match the loaded drawing module.');
  for (const slot of teamEffectSlotSpecs()) {
    const state = slot.id.split('.').at(-1),
      pixels = teamFeedbackPixels(state),
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
      throw new Error(`Invalid produced Team feedback: ${slot.id}.`);
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
      description: TEAM_FEEDBACK_DESCRIPTIONS[state],
      provenance: {
        creator: 'Reveal Line',
        license: 'Original project artwork',
        source: `${TEAM_FEEDBACK_ART_DIRECTORY}/source.mjs`,
        sourceSha256,
        method: 'Original integer-pixel drawing; no AI image, reference pixels or sampled artwork.',
        prompt: `${slot.prompt}\nMATCHED FAMILY: Field Kit Team feedback v${TEAM_FEEDBACK_ART_VERSION}. Preserve four different silhouettes: radio pulse, hourglass, round/diamond rescue links, tapered craft-grace badge. Selected design: ${TEAM_FEEDBACK_DESCRIPTIONS[state]} Use a one-pixel dark outline for separation on light artwork. Palette: ${Object.values(TEAM_FEEDBACK_PALETTE).join(', ')}. No letters, player number, embedded countdown/progress, damage, range, Scan sweep or reward. Runtime retains exact active-state timing and can suppress decoration when crowded. Review at native 32 and runtime 24 CSS pixels, including grayscale, actual earned scenes and reduced effects. Return source and derivative with provenance.`,
      },
    });
  }
  const manifest = {
    format: 'revealline-team-feedback-art.v1',
    revision: TEAM_FEEDBACK_ART_VERSION,
    sourceSha256,
    assets,
    requirements: [
      'Production candidates only: full Studio and live-map visual review remains explicit.',
      'Install all four roles as one collection; preserve source and upload derivatives.',
      'Runtime owns effect origins, warnings, ranges, target numbers, progress and timing.',
      'Inactive states must stay inactive; use the appropriate earned Studio scene.',
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

export async function produceTeamFeedbackArt({ projectRoot = root, check = false } = {}) {
  const production = await buildTeamFeedbackArt({ projectRoot });
  const output = join(projectRoot, TEAM_FEEDBACK_ART_DIRECTORY, 'prepared');
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
        throw new Error(`Immutable Team feedback output differs: ${name}. Create a new revision.`);
    } else if (check) throw new Error(`Missing produced Team feedback: ${name}.`);
    else pending.push([target, bytes]);
  }
  // Refuse known mismatches before writing any member of this family.
  // A filesystem failure can leave new files, but never an adopted runtime collection.
  if (pending.length) await mkdir(output, { recursive: true });
  for (const [target, bytes] of pending) await writeFile(target, bytes, { flag: 'wx' });
  return production.manifest;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--check')) throw new Error('Use --check or no arguments.');
  const manifest = await produceTeamFeedbackArt({ check: args.includes('--check') });
  console.log(`${manifest.assets.length} Team feedback icons reproduced.`);
}

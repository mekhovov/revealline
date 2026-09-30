/** Source-only review cohort. Does not write production metadata or runtime defaults. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import {
  candidatePixelArtForSlot,
  FIELD_KIT_CANDIDATE_RIGS,
} from '../game/presentation/rotor-candidate-art.mjs';
import { encodeSpritePNG, inspectSprite } from './produce-field-kit-sprites.mjs';
import { FORMATS, validateAssetRevision } from '../game/presentation/model.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = 'authoring/library/fpv-proportion-candidates';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

export async function produceRotorCandidates({ check = false } = {}) {
  const assets = [];
  const outputs = new Map();
  for (const [role, rig] of Object.entries(FIELD_KIT_CANDIDATE_RIGS)) {
    for (const [treatment, size] of [
      ['compact', 32],
      ['detailed', 64],
    ]) {
      const slot = role.startsWith('enemy.') ? role : `player.${role}.${treatment}`;
      const image = candidatePixelArtForSlot(slot, { size });
      const bytes = encodeSpritePNG(image);
      const inspection = inspectSprite(image);
      const name = `${role}.${treatment}.png`;
      outputs.set(`${directory}/${name}`, bytes);
      const record = {
        id: `candidate.reference-v2.${role}.${treatment}`,
        slot,
        treatment,
        path: `${directory}/${name}`,
        bytes: bytes.length,
        sha256: hash(bytes),
        width: size,
        height: size,
        inspection,
        geometry: {
          frame: { x: 0, y: 0, width: size, height: size },
          pivot: { x: 0.5, y: 0.5 },
          occupiedBounds: inspection.occupiedBounds,
          rotorAnchors: rig,
          nineSlice: null,
        },
      };
      record.assetRevision = validateAssetRevision({
        format: FORMATS.asset,
        id: record.id,
        revision: 1,
        kind: 'image',
        description: `Original ${role} proportion candidate: large attached rotor sweeps, small motor housings and a slim equipment body.`,
        file: {
          sha256: record.sha256,
          bytes: record.bytes,
          mime: 'image/png',
          width: size,
          height: size,
        },
        geometry: record.geometry,
        recipe: null,
        provenance: {
          creator: 'Reveal Line original native pixel drawings, authored with Codex',
          source: 'game/presentation/rotor-candidate-art.mjs reference-v2',
          license:
            'Original project artwork; no reference photograph, poster or concept-image pixels incorporated.',
          prompt: `Draw an original north-facing ${role} body on a ${size} by ${size} native grid. Use binary alpha, the twelve Field Kit colours, thin carbon arms, a readable camera and equipment, and small static motors. Do not bake blades or blur. Preserve the exact candidate anchors and sweep clearance. Compare at 20/24/32 CSS pixels on bright/dark backgrounds using shared renderers. See docs/drone-reference-review.md for references and limitations.`,
          parent: null,
        },
        quality: {
          stage: 'produced',
          evidence: [
            'docs/verification/rotor-motion/proportions.html; source candidate only, pending full-board and production adoption',
          ],
        },
      });
      assets.push(record);
    }
  }
  const manifest = {
    format: 'revealline.rotor-proportion-candidates.v1',
    status: 'source-candidate-not-runtime-default',
    construction: 'reference-v2',
    originalArt: 'Native integer-grid drawings; no source-photo pixels incorporated.',
    source: 'game/presentation/rotor-candidate-art.mjs',
    sourceSha256: hash(await readFile(resolve(root, 'game/presentation/rotor-candidate-art.mjs'))),
    referenceReview: 'docs/drone-reference-review.md',
    preserves: [
      'Existing compiled sprites and metadata',
      'Colliders and simulation',
      'Manual appearances',
    ],
    assets,
  };
  outputs.set(`${directory}/manifest.json`, Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
  if (!check) await mkdir(resolve(root, directory), { recursive: true });
  for (const [relative, expected] of outputs) {
    const absolute = resolve(root, relative);
    if (check) {
      const actual = await readFile(absolute);
      if (!actual.equals(expected)) throw new Error(`Candidate does not reproduce: ${relative}`);
    } else await writeFile(absolute, expected);
  }
  return { assets: assets.length, bytes: assets.reduce((sum, a) => sum + a.bytes, 0), check };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  console.log(
    JSON.stringify(await produceRotorCandidates({ check: process.argv.includes('--check') })),
  );

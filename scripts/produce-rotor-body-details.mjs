/** Finite source-only body-detail cohort. Never writes runtime registrations. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  detailedCandidatePixelArtForSlot,
  FIELD_KIT_BODY_DETAIL_ROLES,
  FIELD_KIT_BODY_DETAIL_VERSION,
} from '../game/presentation/rotor-body-detail-art.mjs';
import { FIELD_KIT_CANDIDATE_RIGS } from '../game/presentation/rotor-candidate-art.mjs';
import { FORMATS, validateAssetRevision } from '../game/presentation/model.mjs';
import { encodeSpritePNG, inspectSprite } from './produce-field-kit-sprites.mjs';

const root = fileURLToPath(new URL('../', import.meta.url)),
  directory = 'authoring/library/fpv-body-detail-candidates',
  sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

export async function produceRotorBodyDetails({ check = false } = {}) {
  const assets = [],
    outputs = new Map();
  for (const role of FIELD_KIT_BODY_DETAIL_ROLES)
    for (const treatment of ['compact', 'detailed']) {
      const slot = `player.${role}.${treatment}`,
        image = detailedCandidatePixelArtForSlot(slot),
        bytes = encodeSpritePNG(image),
        path = `${directory}/${role}.${treatment}.png`,
        inspection = inspectSprite(image),
        geometry = {
          frame: { x: 0, y: 0, width: image.width, height: image.height },
          pivot: { x: 0.5, y: 0.5 },
          occupiedBounds: inspection.occupiedBounds,
          rotorAnchors: FIELD_KIT_CANDIDATE_RIGS[role],
          nineSlice: null,
        },
        record = {
          id: `candidate.${FIELD_KIT_BODY_DETAIL_VERSION}.${role}.${treatment}`,
          slot,
          treatment,
          path,
          bytes: bytes.length,
          sha256: sha256(bytes),
          width: image.width,
          height: image.height,
          inspection,
          geometry,
        };
      record.assetRevision = validateAssetRevision({
        format: FORMATS.asset,
        id: record.id,
        revision: 1,
        kind: 'image',
        description: `Original native ${role} body-detail candidate with a north-facing camera, equipment faces, restrained strap buckles and small static motors.`,
        file: {
          sha256: record.sha256,
          bytes: bytes.length,
          mime: 'image/png',
          width: image.width,
          height: image.height,
        },
        geometry,
        recipe: null,
        provenance: {
          creator: 'Reveal Line original native pixel drawings, authored with Codex',
          source: 'game/presentation/rotor-body-detail-art.mjs reference-v3',
          license: 'Original project artwork; no reference-image pixels incorporated.',
          prompt: `Draw an original north-facing ${role} body directly on a ${image.width} by ${image.height} pixel grid. Match the approved roster concept through slim carbon arms, a visible front camera, a rear antenna and an equipment pack with shaded faces and separate restrained straps. Use only the existing twelve Field Kit colours and binary alpha. Preserve the exact reference-v2 pivot and rotor anchors, radii, blade counts, phases and handedness. Leave blades to the shared renderer; no reticles, baked blur or lettering. Keep equipment outside the full rotor sweeps. Compare against v2 at 20/24/32 CSS pixels, both render paths, bright/dark artwork and four headings.`,
          parent: null,
        },
        quality: {
          stage: 'produced',
          evidence: [
            'Source candidate only. Native pixels, geometry and reproduction checks do not establish production adoption or full-board readability.',
          ],
        },
      });
      outputs.set(path, bytes);
      assets.push(record);
    }
  const sources = {};
  for (const path of [
    'game/presentation/rotor-body-detail-art.mjs',
    'game/presentation/rotor-candidate-art.mjs',
    'game/presentation/pixel-art.mjs',
  ])
    sources[path] = sha256(await readFile(resolve(root, path)));
  outputs.set(
    `${directory}/manifest.json`,
    Buffer.from(
      JSON.stringify(
        {
          format: 'revealline.rotor-body-detail-candidates.v1',
          status: 'source-candidate-not-runtime-default',
          construction: FIELD_KIT_BODY_DETAIL_VERSION,
          referenceConcept: 'authoring/library/fpv-proportion-candidates/roster-concept-v1.png',
          referenceReview: 'docs/drone-reference-review.md',
          referenceUse:
            'Visual construction reference only; no pixels copied, resized or quantized.',
          sources,
          preserves: [
            'Existing production sprites and registries',
            'Reference-v2 source and PNGs',
            'Exact reference-v2 rotor geometry',
            'Simulation, saves and replays',
          ],
          assets,
        },
        null,
        2,
      ) + '\n',
    ),
  );
  if (!check) await mkdir(resolve(root, directory), { recursive: true });
  for (const [path, expected] of outputs) {
    if (check) {
      if (!(await readFile(resolve(root, path))).equals(expected))
        throw new Error(`Body-detail candidate does not reproduce: ${path}`);
    } else await writeFile(resolve(root, path), expected);
  }
  return {
    assets: assets.length,
    bytes: assets.reduce((sum, asset) => sum + asset.bytes, 0),
    check,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  console.log(
    JSON.stringify(await produceRotorBodyDetails({ check: process.argv.includes('--check') })),
  );

/** Finite source-only Scout optical-body cohort. Never writes runtime registrations. */
import { format, resolveConfig } from 'prettier';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  opticalCandidatePixelArtForSlot,
  FIELD_KIT_BODY_OPTICAL_ROLES,
  FIELD_KIT_BODY_OPTICAL_VERSION,
} from '../game/presentation/rotor-body-optical-art.mjs';
import { FIELD_KIT_CANDIDATE_RIGS } from '../game/presentation/rotor-candidate-art.mjs';
import { FORMATS, validateAssetRevision } from '../game/presentation/model.mjs';
import { encodeSpritePNG, inspectSprite } from './produce-field-kit-sprites.mjs';

const root = fileURLToPath(new URL('../', import.meta.url)),
  directory = 'authoring/library/fpv-body-optical-candidates',
  sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

export async function produceRotorBodyOptical({ check = false } = {}) {
  const assets = [],
    outputs = new Map();
  for (const role of FIELD_KIT_BODY_OPTICAL_ROLES)
    for (const treatment of ['compact', 'detailed']) {
      const slot = `player.${role}.${treatment}`,
        image = opticalCandidatePixelArtForSlot(slot),
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
          id: `candidate.${FIELD_KIT_BODY_OPTICAL_VERSION}.${role}.${treatment}`,
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
        description: `Original native Scout optical candidate with a wider chamfered amber battery, dark tie-down straps and the unchanged v3 camera, carbon arms and small motors.`,
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
          source:
            'game/presentation/rotor-body-optical-art.mjs reference-v5; original native construction composed from immutable reference-v3 source',
          license: 'Original project artwork; no reference-image pixels incorporated.',
          prompt: `Draw an original north-facing ${role} body directly on a ${image.width} by ${image.height} pixel grid. Refine the immutable reference-v3 source with a six-pixel-wide central amber battery face and chamfered equipment shoulders between the rotor sweeps. Preserve the camera, antenna, carbon arms, small motors and global occupied bounds. Keep all equipment clear of the nominal rotor disks and new shoulder pixels clear of the still larger reserved sizing envelope. Draw the compact and detailed battery faces on their native grids; do not load, resize or sample PNGs. Use only the existing twelve Field Kit colours and binary alpha. Preserve the exact reference-v2 pivot and rotor anchors, radii, blade counts, phases and handedness. Leave blades to the shared renderer; no reticles, baked blur or lettering. The reserved sizing envelope is conservative framing geometry, not a claim of blade contact. Compare against retained v3 at 20/24/32 CSS pixels, both render paths, bright/dark artwork and four headings.`,
          parent: null,
        },
        quality: {
          stage: 'produced',
          evidence: [
            'Source candidate only. Source geometry and reproduction checks are not art approval. All equipment clears the nominal rotor disks and new shoulder pixels also clear the larger reserved sizing envelope. Full-board readability still requires visual review.',
          ],
        },
      });
      outputs.set(path, bytes);
      assets.push(record);
    }
  const sources = {};
  for (const path of [
    'game/presentation/rotor-body-optical-art.mjs',
    'game/presentation/rotor-body-detail-art.mjs',
    'game/presentation/rotor-candidate-art.mjs',
    'game/presentation/pixel-art.mjs',
  ])
    sources[path] = sha256(await readFile(resolve(root, path)));
  const formatting = await resolveConfig(resolve(root, '.prettierrc.json'));
  outputs.set(
    `${directory}/manifest.json`,
    Buffer.from(
      await format(
        JSON.stringify(
          {
            format: 'revealline.rotor-body-detail-candidates.v1',
            status: 'source-candidate-not-runtime-default',
            construction: FIELD_KIT_BODY_OPTICAL_VERSION,
            referenceConcept: 'authoring/library/fpv-proportion-candidates/roster-concept-v1.png',
            referenceReview: 'docs/drone-reference-review.md',
            referenceUse:
              'Visual construction reference only; no pixels copied, resized or quantized.',
            sources,
            preserves: [
              'Existing production sprites and registries',
              'Reference-v2, reference-v3 and reference-v4 source, PNGs and manifests',
              'Exact reference-v3 Scout motor, camera, antenna and arm pixels outside the central equipment region',
              'Exact reference-v3 frame size, pivot and global occupied bounds',
              'Exact reference-v2 rotor geometry',
              'Simulation, saves and replays',
            ],
            assets,
          },
          null,
          2,
        ) + '\n',
        { ...formatting, parser: 'json' },
      ),
    ),
  );
  if (!check) await mkdir(resolve(root, directory), { recursive: true });
  for (const [path, expected] of outputs) {
    if (check) {
      if (!(await readFile(resolve(root, path))).equals(expected))
        throw new Error(`Body-optical candidate does not reproduce: ${path}`);
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
    JSON.stringify(await produceRotorBodyOptical({ check: process.argv.includes('--check') })),
  );

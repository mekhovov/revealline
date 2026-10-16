/** Finite source-only Scout contrast cohort. Never writes runtime registrations. */
import { format, resolveConfig } from 'prettier';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  contrastCandidatePixelArtForSlot,
  FIELD_KIT_BODY_CONTRAST_ROLES,
  FIELD_KIT_BODY_CONTRAST_VERSION,
} from '../game/presentation/rotor-body-contrast-art.mjs';
import { FIELD_KIT_CANDIDATE_RIGS } from '../game/presentation/rotor-candidate-art.mjs';
import { FORMATS, validateAssetRevision } from '../game/presentation/model.mjs';
import { encodeSpritePNG, inspectSprite } from './produce-field-kit-sprites.mjs';

const root = fileURLToPath(new URL('../', import.meta.url)),
  directory = 'authoring/library/fpv-body-contrast-candidates',
  sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

export async function produceRotorBodyContrast({ check = false } = {}) {
  const assets = [],
    outputs = new Map();
  for (const role of FIELD_KIT_BODY_CONTRAST_ROLES)
    for (const treatment of ['compact', 'detailed']) {
      const slot = `player.${role}.${treatment}`,
        image = contrastCandidatePixelArtForSlot(slot),
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
          id: `candidate.${FIELD_KIT_BODY_CONTRAST_VERSION}.${role}.${treatment}`,
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
        description: `Original native Scout contrast candidate with a coherent amber battery face, shaded side, dark straps and the unchanged v3 camera, frame and small motors.`,
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
            'game/presentation/rotor-body-contrast-art.mjs reference-v4; original native construction composed from immutable reference-v3 source',
          license: 'Original project artwork; no reference-image pixels incorporated.',
          prompt: `Draw an original north-facing ${role} body directly on a ${image.width} by ${image.height} pixel grid. Refine the immutable reference-v3 source with a coherent amber central battery sleeve, shaded side and distinct dark straps. Preserve every silhouette pixel, camera, antenna, carbon arm and small motor. Draw the compact and detailed battery faces on their native grids; do not load, resize or sample PNGs. Use only the existing twelve Field Kit colours and binary alpha. Preserve the exact reference-v2 pivot and rotor anchors, radii, blade counts, phases and handedness. Leave blades to the shared renderer; no reticles, baked blur or lettering. Keep equipment outside the full rotor sweeps. Compare against retained v3 at 20/24/32 CSS pixels, both render paths, bright/dark artwork and four headings.`,
          parent: null,
        },
        quality: {
          stage: 'produced',
          evidence: [
            'Source candidate only. Native pixels, geometry, measured brightness and reproduction checks do not establish production adoption or full-board readability.',
          ],
        },
      });
      outputs.set(path, bytes);
      assets.push(record);
    }
  const sources = {};
  for (const path of [
    'game/presentation/rotor-body-contrast-art.mjs',
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
            construction: FIELD_KIT_BODY_CONTRAST_VERSION,
            referenceConcept: 'authoring/library/fpv-proportion-candidates/roster-concept-v1.png',
            referenceReview: 'docs/drone-reference-review.md',
            referenceUse:
              'Visual construction reference only; no pixels copied, resized or quantized.',
            sources,
            preserves: [
              'Existing production sprites and registries',
              'Reference-v2 and reference-v3 source, PNGs and manifests',
              'Exact reference-v3 Scout silhouette, motor, camera and frame pixels outside the battery face',
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
        throw new Error(`Body-contrast candidate does not reproduce: ${path}`);
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
    JSON.stringify(await produceRotorBodyContrast({ check: process.argv.includes('--check') })),
  );

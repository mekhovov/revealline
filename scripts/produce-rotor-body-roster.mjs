/** Finite source-only seven-class native FPV roster. Never writes runtime registrations. */
import { format, resolveConfig } from 'prettier';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  rosterCandidatePixelArtForSlot,
  FIELD_KIT_BODY_ROSTER_ROLES,
  FIELD_KIT_BODY_ROSTER_VERSION,
  FIELD_KIT_BODY_ROSTER_DESCRIPTIONS,
} from '../game/presentation/rotor-body-roster-art.mjs';
import { FIELD_KIT_CANDIDATE_RIGS } from '../game/presentation/rotor-candidate-art.mjs';
import { FORMATS, validateAssetRevision } from '../game/presentation/model.mjs';
import { encodeSpritePNG, inspectSprite } from './produce-field-kit-sprites.mjs';

const root = fileURLToPath(new URL('../', import.meta.url)),
  directory = 'authoring/library/fpv-body-roster-candidates',
  sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

export async function produceRotorBodyRoster({ check = false } = {}) {
  const assets = [],
    outputs = new Map();
  for (const role of FIELD_KIT_BODY_ROSTER_ROLES)
    for (const treatment of ['compact', 'detailed']) {
      const slot = `player.${role}.${treatment}`,
        image = rosterCandidatePixelArtForSlot(slot),
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
          id: `candidate.${FIELD_KIT_BODY_ROSTER_VERSION}.${role}.${treatment}`,
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
        description: FIELD_KIT_BODY_ROSTER_DESCRIPTIONS[role],
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
            'game/presentation/rotor-body-roster-art.mjs reference-v6; original native construction with retained v5 Scout and v3 heavy carrier',
          license: 'Original project artwork; no reference-image pixels incorporated.',
          prompt: `Draw an original north-facing ${role} body directly on a ${image.width} by ${image.height} pixel grid. ${FIELD_KIT_BODY_ROSTER_DESCRIPTIONS[role]} Preserve shared carbon arms, north camera, aft antenna and small motors. Equipment must clear each full nominal rotor disk. Distinguish roles by body mass and equipment geometry as well as colour, without introducing another gameplay action. Use separately authored compact and detailed clusters, binary alpha and only the twelve Field Kit colours. Do not load, resize or sample PNGs. Preserve exact reference-v2 pivot and rotor anchors, radii, blade counts, phases and handedness. Draw no blades, propeller blur, white corner reticles or lettering. Scout and heavy carrier intentionally retain their prior source constructions. Review all seven classes at 20/24/32 CSS pixels, four headings, both paint paths and bright/dark artwork before production adoption.`,
          parent: null,
        },
        quality: {
          stage: 'produced',
          evidence: [
            'Source candidate only. Source geometry, unique silhouettes and reproduction are not art approval. Full-board visual review and exact renderer integration remain separate acceptance.',
          ],
        },
      });
      outputs.set(path, bytes);
      assets.push(record);
    }
  const sources = {};
  for (const path of [
    'game/presentation/rotor-body-roster-art.mjs',
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
            construction: FIELD_KIT_BODY_ROSTER_VERSION,
            referenceConcept: 'authoring/library/fpv-proportion-candidates/roster-concept-v1.png',
            referenceReview: 'docs/drone-reference-review.md',
            referenceUse:
              'Visual construction reference only; no pixels copied, resized or quantized.',
            sources,
            preserves: [
              'Existing production sprites and registries',
              'Reference-v2 through reference-v5 source, PNGs and manifests',
              'Exact reference-v3 motor, camera, antenna and carbon-arm source pixels for the five new quad bodies',
              'Retained reference-v5 Scout and reference-v3 heavy carrier image bytes, frame sizes and pivots',
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
        throw new Error(`Body-roster candidate does not reproduce: ${path}`);
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
    JSON.stringify(await produceRotorBodyRoster({ check: process.argv.includes('--check') })),
  );

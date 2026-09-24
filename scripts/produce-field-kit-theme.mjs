/** Assemble original production assets into the existing immutable theme model. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { format, resolveConfig } from 'prettier';
import { ASSET_SLOTS, createDefaultThemeBundle } from '../game/presentation/catalog.mjs';
import { FORMATS, LIMITS, presentationCoverage } from '../game/presentation/model.mjs';
import { reviseStudioTheme } from '../game/presentation/studio-session.mjs';
import {
  iconForSlot,
  FIELD_KIT_ICON_IDS,
  FIELD_KIT_ICON_DESCRIPTIONS,
} from '../game/presentation/icons.mjs';
import {
  TEAM_EQUIPMENT_IDS,
  TEAM_EQUIPMENT_DESCRIPTIONS,
  teamEquipmentArt,
} from '../game/presentation/team-equipment-art.mjs';
import { fieldKitTeamRecipeQuality } from './team-recipe-review.mjs';
import { encodeSpritePNG, inspectSprite } from './produce-field-kit-sprites.mjs';
import { compilePresentation } from './compile-presentation.mjs';
import { writePresentation, retainedPresentationPath } from './write-presentation.mjs';
import { readFieldKitRetainedOutput } from './field-kit-retained-runtime.mjs';
import { retainFieldKitProductionHistory } from './team-production-history.mjs';
import { importThemeBundle, exportThemeBundle } from '../game/presentation/bundle.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const reference = (asset) => ({ id: asset.id, revision: asset.revision });
const sources = {
  ui: 'game/ui/field-kit-components.css; game/ui/field-kit-compiled.css; game/presentation/host.mjs; game/presentation/team-runtime-slots.mjs; game/ui/operation-status.css; game/ui/operation-status.mjs; game/presentation/dom-ownership.mjs',
  screens:
    'game/ui/field-kit-flow.css; game/ui/field-kit-surfaces.css; game/ui/field-kit-compiled.css; site/release-catalog.css',
  motion:
    'authoring/motion-lab/render-character.mjs; game/ui/actor-presentation.mjs; game/presentation/journey-actor-materials.mjs',
  effects:
    'game/ui/classic-view.mjs; game/ui/event-feedback.mjs; game/content-design/actor-marker.mjs; game/ui/lane-presentation.mjs; game/ui/render.mjs; game/ui/relay-view.mjs; game/ui/directional-view.mjs; game/ui/enemy-body-assets.mjs; game/ui/enemy-body-motion.mjs; game/enemy-catalog.mjs',
  team: 'game/couch/coop-view.mjs; game/couch/coop-actor-presentation.mjs; game/couch/coop-anchor-presentation.mjs; game/couch/coop-core-presentation.mjs; game/couch/coop-support-presentation.mjs; game/couch/coop-emitter-presentation.mjs; game/couch/coop-rescue-presentation.mjs; game/couch/coop-pilot-slots.mjs; game/couch/coop-enemy-slots.mjs; game/couch/coop-outcome-presentation.mjs; game/presentation/team-runtime-slots.mjs; game/ui/actor-presentation.mjs; game/presentation/catalog.mjs; game/couch/coop-actor-layout.mjs; game/couch/coop-terrain-trail.mjs; game/couch/coop-bonus-view.mjs; game/couch/candidate-team-pictures.mjs; game/content-design/material-markers.mjs; game/presentation/journey-actor-materials.mjs; authoring/motion-lab/render-character.mjs; game/ui/classic-view.mjs; game/ui/presentation-draw-image.mjs; game/ui/enemy-body-assets.mjs; game/ui/enemy-body-motion.mjs; authoring/motion-lab/animation.mjs; game/content-design/actor-marker.mjs; game/enemy-catalog.mjs',
  audio:
    'game/app.mjs; game/couch/couch-music-host.mjs; game/opening-soundtrack.mjs; game/ui/audio.mjs; game/ui/published-audio.mjs; game/ui/soundtrack-player.mjs; game/ui/audio-master.mjs; game/soundtrack.mjs; game/soundtrack-rights.mjs; game/soundtrack-bundle.mjs; game/soundtrack-share.mjs; game/soundtrack-source.mjs; game/soundtrack-bundled.mjs; game/ui/soundtrack-panel.mjs; game/ui/soundtrack-panel.css; game/soundtrack-albums.mjs; game/soundtrack-portable.mjs; game/content/soundtrack-catalogue.mjs; game/online-soundtrack-catalogue.mjs',
};

// Image review is independent of the 37 Team recipes. Bind original bytes and
// the complete renderer closure so a changed construction or consumer reopens it.
const equipmentSources = [
  'game/presentation/team-equipment-art.mjs',
  'game/presentation/pixel-art.mjs',
  'scripts/produce-field-kit-sprites.mjs',
  ...sources.team.split('; '),
];
const reviewedEquipmentSource = 'b9cbf2db6fe094564a15743c72c45049bf9ee776a22b2599469e0ee1bdc03037';
const reviewedEquipmentSuccessorSource =
  '162d4c737c11d34f8e7e3ed6e76ca5a34fcf06d5fb97303d53eba857feaaf530';
const reviewedTeamSuccessorRecord =
  '45e41eee3cacac251ede3f0304834a1fda311f8bd70f4d0b66aaceb493b8fc05';
const reviewedEquipmentOriginals = Object.freeze({
  'team.anchor.available': '88e541375c56d4627b80cf6921ca64ed12d5b77d43dcae256177b8577250d9b3',
  'team.anchor.captured': 'a66511c77322beea458be918f6eb35f1ca6acc9f980afa44bc4756162896f466',
  'team.core.shielded': '009d14748f943002091255caebd32e4df1c886569575f512ab0d55d7a3ff637a',
  'team.core.exposed': '6abc4a68192b4d517b22690c43126de34a1c403caf4a24ec57aa8b2ff68f079a',
  'team.core.secured': '28e58f70c759b20798fac07e6f9d1b336e936ee23beea26bb4be30fd5528311d',
});

export async function fieldKitEquipmentSource(read) {
  return hash(Buffer.concat(await Promise.all(equipmentSources.map((name) => read(name)))));
}

export function fieldKitEquipmentQuality(slotId, source, originalHash, successorReviewBytes) {
  const successor =
    successorReviewBytes && hash(successorReviewBytes) === reviewedTeamSuccessorRecord
      ? JSON.parse(successorReviewBytes)
      : null;
  const continued =
    source === reviewedEquipmentSuccessorSource &&
    successor?.priorEquipmentReview?.path ===
      'docs/verification/team-equipment-five-review/review.json' &&
    successor.priorEquipmentReview.sha256 ===
      'a5aa095805b39c8a716d5427c54ad594f9261b53adeaf9752b3260ae752024b3' &&
    successor.priorEquipmentReview.priorFingerprintSHA256 === reviewedEquipmentSource &&
    successor.priorEquipmentReview.currentFingerprintSHA256 === reviewedEquipmentSuccessorSource;
  if (
    Object.hasOwn(reviewedEquipmentOriginals, slotId) &&
    (source === reviewedEquipmentSource || continued) &&
    reviewedEquipmentOriginals[slotId] === originalHash
  )
    return {
      stage: 'reviewed',
      evidence: [
        'Five images only: docs/verification/team-equipment-five-review/review.json sha256:a5aa095805b39c8a716d5427c54ad594f9261b53adeaf9752b3260ae752024b3',
        ...(continued
          ? [
              `Unchanged five-image consumer continuation: docs/verification/team-specialist-cues-2026-09-24/review.json sha256:${reviewedTeamSuccessorRecord}`,
            ]
          : []),
      ],
    };
  return {
    stage: 'produced',
    evidence: [
      'Original authored pixel clusters; complete state and playing-scale review remains required.',
    ],
  };
}

// A recipe stays unreviewed whenever one of its source inputs changes. These
// are deliberate, source-pinned approvals for scoped renderer and loading reviews:
// changing a digest creates a new source-stage revision and re-opens the
// release readiness gate rather than silently inheriting this review.
const REVIEWED_RECIPE_INPUTS = {
  screens: {
    sha256: 'acf6426f5cd47f21a85ec5ae9da9549ed58fbe330b097c979dc85b87afe2d68a',
    evidence: [
      'Scoped compact-Home screen continuation: docs/verification/compact-home-screen-continuation-2026-09-24/review.json sha256:96ae6b8c3b05239cf16ab3801dec2b7ef057aa188ffcab466fb2fc22ea17dd1b; four ordered screen inputs sha256:acf6426f5cd47f21a85ec5ae9da9549ed58fbe330b097c979dc85b87afe2d68a. Only field-kit-flow.css changes after the prior exact review, compacting Home and adding the More-menu surface with existing Field Kit tokens.',
      'Focused flow and focus-restoration checks plus a source-native 1280 by 720 review cover the compact Home and More surfaces. Board geometry, simulation, mission content, payloads and data ownership remain unchanged.',
      'Bounded functional source continuation only. Complete navigation, forced-colour, screen-reader, every viewport, physical device, frozen/public and human acceptance remain separate. Historical reviews and payloads remain immutable.',
    ],
  },
  ui: {
    sha256: '4b7db79dd3f6931dd72c0ae702f15a5a5d8ff2b7044aca5a2e02886e8e61636a',
    evidence: [
      'Scoped actor-only UI functional continuation: docs/verification/actor-only-ui-continuation-2026-09-24/review.json sha256:dbde124fb9d24cb26dd901b51f58cf59fc7bfb4df212e47419cdb15581155b73; seven ordered UI inputs sha256:4b7db79dd3f6931dd72c0ae702f15a5a5d8ff2b7044aca5a2e02886e8e61636a. Only presentation host changes after the prior exact review; all24 UI recipe payloads, tokens and DOM ownership contracts remain unchanged.',
      'The actor-only profile uses a fixed registered image-slot set, creates no CSS URLs and refuses page apply, audio and picture operations. Full remains the default profile. Lease, cancellation, retained-runtime and exact source-binding tests cover the functional separation; fresh-origin Team screens retain the full-profile UI while FPV actors use the independent lease.',
      'UI functional continuation only. Complete navigation, forced-colour, screen-reader, every-viewport, physical-device, audio, offline, public and release acceptance remain separate. Prior UI reviews and immutable originals remain preserved; any UI input change reopens this group.',
    ],
  },
  audio: {
    sha256: '27ad86d9f0e3d84a149627ca3e95f3f2350c7dd7b79146d5cbc4da9320f12e3e',
    evidence: [
      'Scoped bundled-source continuation: docs/verification/shchedryk-opening-2026-09-24/audio-source-review-r2.json sha256:99a2bcda11f17c4ad0220daa4aa98c9b5ed8f1008773d2fce9c12b59f1ef804b. Sixteen ordered audio inputs sha256:27ad86d9f0e3d84a149627ca3e95f3f2350c7dd7b79146d5cbc4da9320f12e3e preserve the live archive player and add an inactive, exact-identity adapter for future code-owned audio.',
      'All8 selected roles remain the same procedural recipes with no new audio files. Focused tests cover local-only zero requests, owned-local reuse, explicit acquisition, Installed-only playback, exact identity/path/bytes, duplicate rejection, effective-rights intersection, corrupt bytes, cancellation and source-dependency invalidation.',
      'No recording, composition, musical suitability, Ukrainian authenticity, full-track listening, physical-device, cold-offline, frozen-build or public game approval. Archive previews remain outside trusted Automatic and built-in playlists; historical records and original payloads are immutable.',
    ],
  },
  motion: {
    sha256: 'c35fcf823a0923f27f1193afa247e2d0c93b6fc4161976a5d6a2b67a5bc143a9',
    evidence: [
      'Scoped visible-actor motion continuation: docs/verification/integrated-fpv-presentation-2026-09-24/review.json sha256:5743669fa1b230c486bf92435e2922a8a775b86a3de10fd42f84c2e51a85ca51; three ordered motion inputs sha256:c35fcf823a0923f27f1193afa247e2d0c93b6fc4161976a5d6a2b67a5bc143a9. Only actor-presentation.mjs changes to fit prepared visible bounds and rotor sweep to the requested display size.',
      'Focused actor and renderer checks cover rectangular and transparent frames, compact/desktop minima, rotor sweep, reduced motion, fallback and unchanged simulation footprints. Positions, collision radii, authoritative clocks and role identities are unchanged.',
      'Functional source/geometry continuation only, not subjective art, every-state native/device, human balance, frozen/public or release approval. Historical reviews and original payloads remain immutable; changed motion inputs reopen this group.',
    ],
  },
  effects: {
    sha256: '654fed2ce5b5e9b5e0c6bb79a6d7095093a4ed8128877b1a7f0658d830c275e7',
    evidence: [
      'Scoped enemy surface-motion continuation: docs/verification/enemy-surface-motion-continuation-2026-09-24/review.json sha256:f8dcdc60d973447bd6b482045c96f1a4059cfca899528dd7de7cacb95854684c; ten ordered effects inputs sha256:654fed2ce5b5e9b5e0c6bb79a6d7095093a4ed8128877b1a7f0658d830c275e7. Prepared enemy bodies now consume existing bounded catalog motion records without acquiring duplicate images.',
      'The active-trail, secured-contour, travelling-impact, capture, failure, victory, pickup, shield, respawn and pressure painters remain unchanged. Focused actor, asset and motion checks preserve reduced effects, collision footprints, role identities and authoritative state.',
      'Functional and bounded visual continuation only. Historical reviews and original payloads remain immutable. Team recipes remain source-stage; complete art, final-byte physical-device, human pacing, frozen/public and release acceptance remain separate. Any effects input or review-byte change reopens this group.',
    ],
  },
};

function recipeQuality(group, source) {
  const review = REVIEWED_RECIPE_INPUTS[group];
  if (review && source.endsWith(`sha256:${review.sha256}`))
    return { stage: 'reviewed', evidence: review.evidence };
  return {
    stage: 'source',
    evidence: ['Connected runtime recipe; screen and state review remains required.'],
  };
}

/** Explicit dependency fingerprints; a helper change must reopen its review group. */
export async function fieldKitRecipeSources(read) {
  return Object.fromEntries(
    await Promise.all(
      Object.entries(sources).map(async ([group, paths]) => [
        group,
        `${paths} sha256:${hash(Buffer.concat(await Promise.all(paths.split('; ').map((file) => read(file)))))}`,
      ]),
    ),
  );
}

export async function createFieldKitProduction({ projectRoot = root } = {}) {
  const read = async (relative) => fs.readFile(path.join(projectRoot, relative));
  const json = async (relative) => JSON.parse(await read(relative));
  const baseline = createDefaultThemeBundle();
  const recipeSources = await fieldKitRecipeSources(read);
  const assets = [],
    bindings = {},
    bytes = new Map();
  const add = (slotId, values, body = null) => {
    const slot = ASSET_SLOTS.find((s) => s.id === slotId);
    if (!slot) throw new Error(`Unknown production slot ${slotId}.`);
    const asset = {
      format: FORMATS.asset,
      id: `${slotId}.field-kit`,
      revision: 1,
      description: slot.label,
      file: null,
      recipe: null,
      geometry: null,
      provenance: {
        creator: 'Reveal Line',
        source: 'Original Field Kit production',
        license: 'Original project artwork and components',
        prompt: slot.prompt,
        parent: { id: `${slotId}.default`, revision: 1 },
      },
      quality: { stage: 'produced', evidence: [] },
      ...values,
    };
    if (body) {
      if (body.length !== asset.file.bytes || hash(body) !== asset.file.sha256)
        throw new Error(`Production bytes changed for ${slotId}.`);
      bytes.set(asset.file.sha256, new Blob([body], { type: asset.file.mime }));
    }
    assets.push(asset);
    bindings[slotId] = reference(asset);
  };
  for (const slot of ASSET_SLOTS) {
    // Team roles cannot inherit a Solo effects approval: their painter and
    // state recipes have a separate fingerprint and require their own review.
    const group = slot.id.startsWith('team.') ? 'team' : slot.group;
    if (!sources[group] || TEAM_EQUIPMENT_IDS.includes(slot.id)) continue;
    add(slot.id, {
      kind: 'recipe',
      recipe: { id: slot.recipes[0] },
      description: `${slot.label}: existing bounded component with Field Kit tokens and state styling.`,
      provenance: {
        creator: 'Reveal Line',
        source: recipeSources[group],
        license: 'Project-authored runtime recipe',
        prompt: slot.prompt,
        parent: { id: `${slot.id}.default`, revision: 1 },
      },
      quality: recipeQuality(group, recipeSources[group]),
    });
  }
  const sprites = await json('game/assets/field-kit/sprites/sprites.json');
  for (const sprite of sprites.assets) {
    const { path: filePath, ...file } = sprite.file;
    add(
      sprite.slotId,
      {
        kind: 'image',
        file,
        geometry: sprite.geometry,
        description: sprite.description,
        provenance: {
          ...sprite.provenance,
          parent: { id: `${sprite.slotId}.default`, revision: 1 },
        },
        quality: sprite.quality,
      },
      await read(`game/assets/field-kit/sprites/${filePath}`),
    );
  }
  const teamReviewBytes = await read('docs/verification/team37/review.json');
  const teamSuccessorReviewBytes = await read(
    'docs/verification/team-specialist-cues-2026-09-24/review.json',
  );
  const inheritedAssets = Object.fromEntries(
    assets.filter((asset) => asset.kind === 'image').map((asset) => [asset.id, asset]),
  );
  for (const asset of assets) {
    if (!asset.id.startsWith('team.') || asset.kind !== 'recipe') continue;
    const slotId = asset.id.slice(0, -'.field-kit'.length);
    const defaultAsset = baseline.assets.find(
      (entry) => entry.id === asset.provenance.parent.id && entry.revision === 1,
    );
    asset.quality = fieldKitTeamRecipeQuality({
      slotId,
      source: recipeSources.team,
      recipe: asset.recipe,
      defaultAsset,
      inheritedAssets,
      reviewBytes: teamReviewBytes,
      successorReviewBytes: teamSuccessorReviewBytes,
    });
  }
  const equipmentSource = 'game/presentation/team-equipment-art.mjs';
  const equipmentHash = hash(await read(equipmentSource));
  const equipmentReviewSource = await fieldKitEquipmentSource(read);
  for (const slotId of TEAM_EQUIPMENT_IDS) {
    const slot = ASSET_SLOTS.find((entry) => entry.id === slotId);
    const image = teamEquipmentArt(slotId),
      body = encodeSpritePNG(image),
      measured = inspectSprite(image);
    add(
      slotId,
      {
        kind: 'image',
        file: {
          sha256: hash(body),
          bytes: body.length,
          mime: 'image/png',
          width: image.width,
          height: image.height,
        },
        geometry: { ...structuredClone(slot.geometry), occupiedBounds: measured.occupiedBounds },
        description: TEAM_EQUIPMENT_DESCRIPTIONS[slotId],
        provenance: {
          creator: 'Reveal Line',
          source: `${equipmentSource} sha256:${equipmentHash}`,
          license: 'Original project integer-pixel equipment artwork',
          prompt: slot.prompt,
          parent: { id: `${slotId}.default`, revision: 1 },
        },
        quality: fieldKitEquipmentQuality(
          slotId,
          equipmentReviewSource,
          hash(body),
          teamSuccessorReviewBytes,
        ),
      },
      body,
    );
  }
  const iconHash = hash(await read('game/presentation/icons.mjs'));
  for (const slotId of FIELD_KIT_ICON_IDS) {
    const slot = ASSET_SLOTS.find((s) => s.id === slotId);
    const image = iconForSlot(slotId),
      body = encodeSpritePNG(image),
      measured = inspectSprite(image);
    add(
      slotId,
      {
        kind: 'image',
        file: {
          sha256: hash(body),
          bytes: body.length,
          mime: 'image/png',
          width: image.width,
          height: image.height,
        },
        geometry: { ...structuredClone(slot.geometry), occupiedBounds: measured.occupiedBounds },
        description: FIELD_KIT_ICON_DESCRIPTIONS[slotId],
        provenance: {
          creator: 'Reveal Line',
          source: `game/presentation/icons.mjs sha256:${iconHash}`,
          license: 'Original project pixel glyph recipe',
          prompt: slot.prompt,
          parent: { id: `${slotId}.default`, revision: 1 },
        },
      },
      body,
    );
  }
  const fonts = await json('game/ui/fonts/field-kit/provenance.json');
  for (const font of fonts.fonts)
    add(
      `font.${font.role}`,
      {
        kind: 'font',
        file: {
          sha256: font.sha256,
          bytes: font.bytes,
          mime: 'font/woff2',
          width: null,
          height: null,
        },
        description: `${font.family}: self-hosted English/Ukrainian font.`,
        provenance: {
          creator: font.family + ' upstream authors',
          source: font.sourceUrl,
          license: `${font.license}; game/ui/fonts/field-kit/${font.licenseFile}`,
          prompt: ASSET_SLOTS.find((s) => s.id === `font.${font.role}`).prompt,
          parent: { id: `font.${font.role}.default`, revision: 1 },
        },
        quality: {
          stage: 'reviewed',
          evidence: [
            'scripts/verify-field-kit-fonts.py: 178 required codepoints in actual shipped WOFF2; bilingual specimens and 60 typography compatibility checks passed.',
          ],
        },
      },
      await read(`game/ui/fonts/field-kit/${font.file}`),
    );
  const scenes = await json('authoring/library/fpv-field-kit/prepared-scenes-v2.json');
  const portraitPrompt = (await json('authoring/library/fpv-field-kit/title-portrait-source.json'))
    .effectivePrompt;
  const landscapePrompt = (await read('authoring/library/fpv-field-kit/README.md'))
    .toString('utf8')
    .split('## Resolved generation prompt\n\n')[1]
    .split('\n\nPrepared v1 scenes')[0]
    .trim();
  for (const scene of scenes.records) {
    const slotId = scene.id.includes('portrait')
      ? 'screen.title.portrait'
      : 'screen.title.background';
    const slot = ASSET_SLOTS.find((s) => s.id === slotId);
    const { path: filePath, pixelsSha256: _pixels, ...file } = scene.output;
    // Replace the prepared recipe binding while keeping both immutable records.
    add(
      slotId,
      {
        id: `${slotId}.field-kit-scene`,
        kind: 'image',
        file: { ...file, mime: 'image/png' },
        geometry: {
          ...structuredClone(slot.geometry),
          occupiedBounds: { x: 0, y: 0, width: 1, height: 1 },
        },
        provenance: {
          creator: 'Reveal Line via built-in image generation',
          source: `${scene.source.path} sha256:${scene.source.sha256}`,
          license:
            'Original generated project artwork; unchanged source retained in authoring library',
          prompt:
            (scene.id.includes('portrait') ? portraitPrompt : landscapePrompt) +
            `\nPrepared production frame: ${file.width}×${file.height}; original preserved; ${JSON.stringify(scene.preparation)}.`,
          parent: { id: `${slotId}.default`, revision: 1 },
        },
        quality: scene.quality,
      },
      await read(filePath),
    );
  }
  let reveals = null;
  try {
    reveals = await json('authoring/library/fpv-field-kit/prepared/reveals/reveals.json');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (reveals) {
    for (const entry of reveals.assets) {
      const { path: filePath, pixelsSha256: _pixels, ...file } = entry.file;
      const exampleSlot =
        entry.compositionId === 'scene-signal-01' && file.width === 768
          ? 'scene.reveal.legacy'
          : entry.compositionId === 'scene-orchard-window' && file.width === 1152
            ? 'scene.reveal.wide'
            : null;
      for (const slotId of [...entry.slotIds, ...(exampleSlot ? [exampleSlot] : [])])
        add(
          slotId,
          {
            kind: 'image',
            file,
            geometry: entry.geometry,
            description: entry.description ?? entry.compositionId,
            provenance: {
              creator: entry.provenance.creator,
              source: `${entry.provenance.source.path} sha256:${entry.provenance.source.sha256}`,
              license: entry.provenance.license,
              prompt: `${entry.provenance.prompt}\n\nPREPARED PRODUCTION CONTRACT: ${file.width}×${file.height} opaque PNG. Preserve these exact derivative settings for compatible variations:\n${JSON.stringify(entry.preparation, null, 2)}`,
              parent: { id: `${slotId}.default`, revision: 1 },
            },
            quality: entry.quality,
          },
          await read(filePath),
        );
    }
  }
  const document = reviseStudioTheme(baseline, { assets, bindings });
  return { document, assets: bytes, coverage: presentationCoverage(document) };
}
/** Deterministic production output from the ledger and explicit retained inputs.
 * This stage owns no release writes and does not read prior compiled artifacts. */
export async function compileFieldKitProduction(
  production,
  { read = (relative) => fs.readFile(path.join(root, relative)), config = {} } = {},
) {
  const previousOutput = await readFieldKitRetainedOutput({ read, assets: production.assets });
  const result = await compilePresentation(production.document, production.assets, {
    previousOutput,
  });
  // Format current artifacts only; retained runtime names bind original raw bytes.
  for (const [name, body] of result.files) {
    if (!/\.(json|css)$/.test(name) || retainedPresentationPath(name)) continue;
    const formatted = Buffer.from(
      await format(new TextDecoder().decode(body), {
        ...config,
        parser: name.endsWith('.json') ? 'json' : 'css',
      }),
    );
    // Pretty-printing must not make otherwise valid Studio metadata unloadable.
    // The compiler already provided bounded canonical bytes as the fallback.
    if (name !== 'studio.json' || formatted.length <= LIMITS.manifestBytes)
      result.files.set(name, formatted);
  }
  const inventory = [...result.files]
    .filter(([name]) => name !== 'manifest.json')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, body]) => ({ path: name, bytes: body.length, sha256: hash(body) }));
  result.files.set(
    'manifest.json',
    Buffer.from(
      await format(
        JSON.stringify({
          format: 'revealline-presentation-build.v1',
          source: { id: production.document.id, revision: production.document.revision },
          files: inventory,
        }),
        { ...config, parser: 'json' },
      ),
    ),
  );
  return result;
}
async function generate(args) {
  if (args.length !== 1 || !['--write', '--check'].includes(args[0]))
    throw new Error('Use --write to adopt production assets or --check for reproducibility.');
  const production = await createFieldKitProduction();
  const historyPath = path.join(root, 'authoring/library/fpv-field-kit/production.rltheme');
  let history = null;
  try {
    history = await importThemeBundle(new Blob([await fs.readFile(historyPath)]), {
      decodeImage: null,
    });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  production.document = retainFieldKitProductionHistory(production.document, history?.document);
  production.assets = new Map([...(history?.assets ?? []), ...production.assets]);
  production.coverage = presentationCoverage(production.document);
  const historyBytes = Buffer.from(
    await (await exportThemeBundle(production.document, production.assets)).arrayBuffer(),
  );
  if (
    args[0] === '--check' &&
    (!history || hash(await fs.readFile(historyPath)) !== hash(historyBytes))
  )
    throw new Error(
      'Stale production revision ledger. Run --write to append compatible revisions.',
    );
  const config = await resolveConfig(path.join(root, 'game/build-config.json'));
  const result = await compileFieldKitProduction(production, { config });
  const out = path.join(root, 'game/presentation/compiled');
  await writePresentation(result.files, out, { check: args[0] === '--check' });
  if (args[0] === '--write') {
    const temporary = `${historyPath}.tmp-${process.pid}`;
    try {
      await fs.writeFile(temporary, historyBytes, { flag: 'wx' });
      await fs.rename(temporary, historyPath);
    } finally {
      await fs.rm(temporary, { force: true });
    }
  }
  process.stdout.write(
    JSON.stringify({
      source: production.document.id,
      revision: production.document.revision,
      slots: production.document.slots.length,
      files: result.files.size,
      assetBytes: [...production.assets.values()].reduce((n, b) => n + b.size, 0),
      coverage: production.coverage.counts,
      qualification:
        'Production candidate. Review required slots in real screens before publication.',
    }) + '\n',
  );
}
async function main(args) {
  if (args.length !== 1 || !['--write', '--check'].includes(args[0]))
    throw new Error('Use --write to adopt production assets or --check for reproducibility.');
  if (args[0] === '--check') return generate(args);
  const lockPath = path.join(root, 'authoring/library/fpv-field-kit/production.rltheme.lock');
  let lock;
  try {
    lock = await fs.open(lockPath, 'wx');
  } catch (error) {
    if (error.code === 'EEXIST')
      throw new Error(
        'Another production writer owns the ledger lock. Inspect it before retrying.',
      );
    throw error;
  }
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid }) + '\n');
    return await generate(args);
  } finally {
    await lock.close();
    await fs.unlink(lockPath);
  }
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(error.message + '\n');
    process.exitCode = 1;
  });

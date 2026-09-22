/** Assemble original production assets into the existing immutable theme model. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { format, resolveConfig } from 'prettier';
import { ASSET_SLOTS, createDefaultThemeBundle } from '../game/presentation/catalog.mjs';
import { FORMATS, presentationCoverage } from '../game/presentation/model.mjs';
import { reviseStudioTheme } from '../game/presentation/studio-session.mjs';
import {
  iconForSlot,
  FIELD_KIT_ICON_IDS,
  FIELD_KIT_ICON_DESCRIPTIONS,
} from '../game/presentation/icons.mjs';
import { encodeSpritePNG, inspectSprite } from './produce-field-kit-sprites.mjs';
import { compilePresentation } from './compile-presentation.mjs';
import { writePresentation } from './write-presentation.mjs';
import { retainProductionHistory } from './presentation-production-history.mjs';
import { importThemeBundle, exportThemeBundle } from '../game/presentation/bundle.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const reference = (asset) => ({ id: asset.id, revision: asset.revision });
const sources = {
  ui: 'game/ui/field-kit-components.css; game/ui/field-kit-compiled.css; game/presentation/host.mjs; game/ui/operation-status.css; game/ui/operation-status.mjs; game/presentation/dom-ownership.mjs',
  screens:
    'game/ui/field-kit-flow.css; game/ui/field-kit-surfaces.css; game/ui/field-kit-compiled.css; site/release-catalog.css',
  motion:
    'authoring/motion-lab/render-character.mjs; game/ui/actor-presentation.mjs; game/presentation/journey-actor-materials.mjs',
  effects:
    'game/ui/classic-view.mjs; game/ui/event-feedback.mjs; game/content-design/actor-marker.mjs; game/ui/lane-presentation.mjs; game/ui/render.mjs; game/ui/relay-view.mjs; game/ui/directional-view.mjs; game/enemy-catalog.mjs',
  audio:
    'game/ui/audio.mjs; game/ui/published-audio.mjs; game/ui/soundtrack-player.mjs; game/ui/audio-master.mjs; game/soundtrack.mjs; game/soundtrack-rights.mjs; game/soundtrack-bundle.mjs; game/soundtrack-share.mjs; game/soundtrack-source.mjs; game/ui/soundtrack-panel.mjs; game/ui/soundtrack-panel.css; game/soundtrack-albums.mjs; game/soundtrack-portable.mjs; game/content/soundtrack-catalogue.mjs',
};

// A recipe stays unreviewed whenever one of its source inputs changes. These
// are deliberate, source-pinned approvals for scoped renderer and loading reviews:
// changing a digest creates a new source-stage revision and re-opens the
// release readiness gate rather than silently inheriting this review.
const REVIEWED_RECIPE_INPUTS = {
  screens: {
    sha256: '1800d7c4754f88e2ec36b104ab9e502cd5ba55ed2e12653609bd52e246548845',
    evidence: [
      'Scoped soundtrack screen source review: docs/verification/soundtrack-v3-framework-2026-09-21/ui-screen-review/review.json sha256:29b58017d3a3e1bf33347606695e522830cb170fb595c907310f9fd5c244fae0; screen recipe inputs sha256:1800d7c4754f88e2ec36b104ab9e502cd5ba55ed2e12653609bd52e246548845. The changed compiled CSS reserves 44px only for visible running-landscape music credits in both board placement and height-derived width. Existing effective 8px bottom reserve and narrow Standard/Large header precedence remain intact.',
      'Independent source arithmetic covers 12 compact cases; 12 focused credit/navigation/board tests pass. Earlier evolving-source native Solo and Team 844x390 observations are attributed in the review, not certified as final-byte screenshots. Unchanged screen inputs retain their historical source reviews in the immutable ledger.',
      'Bounded functional layout approval only. Native smaller landscape/safe-area/First Flight checks, full screen coverage, physical devices, forced colours, offline, art and release acceptance remain separate. No recording is approved. Source-stage fpv39/fpv40 revisions and all original payloads remain preserved before the scoped reviewed successor.',
    ],
  },
  ui: {
    sha256: '28f337f2e488afcae8a93d0d062f06f05ab70ab899d7ea986e88be72dd46cd6e',
    evidence: [
      'Scoped soundtrack UI source review: docs/verification/soundtrack-v3-framework-2026-09-21/ui-screen-review/review.json sha256:29b58017d3a3e1bf33347606695e522830cb170fb595c907310f9fd5c244fae0; UI recipe inputs sha256:28f337f2e488afcae8a93d0d062f06f05ab70ab899d7ea986e88be72dd46cd6e. Only the compiled CSS input changes from accepted main; shared DOM ownership, component and operation-status inputs remain byte-identical.',
      'The independent review checks visible/hidden Solo credits, explicit non-running grid placement, Couch credits and source-link navigation, Large text and compact reserve arithmetic. The 12 focused tests and separately attributed earlier native observations have the scope stated in the review; no final-byte browser claim is inferred.',
      'Functional source approval only. Complete native, forced-colour, screen-reader, physical-device, art, offline, human and public acceptance remain separate. Any UI recipe input change reopens this group. Earlier source approvals and all immutable history remain retained.',
    ],
  },
  audio: {
    sha256: '1128ede72e1d687690a3832d84b240bd8013be643bb9a21b430fe6875adcac94',
    evidence: [
      'Scoped soundtrack-player source and browser review: docs/verification/soundtrack-player-ux-2026-09-21/review.json sha256:b35df30b1583a691852caaf5869e4b1f54a3656037057f156655e9b1f51adc3f. Fourteen ordered audio inputs have fingerprint sha256:1128ede72e1d687690a3832d84b240bd8013be643bb9a21b430fe6875adcac94; soundtrack-panel.css is now an explicit input. Fresh v3 libraries select 90s Synth while saved libraries keep their explicit mode.',
      'The focused catalogue, player, panel, host, v3 compatibility, Couch-audio and modal-navigation cohort passed 274/274; the panel-only compatibility cohort passed 99/99. Browser review covered desktop and 390x844 layouts, style playback, all-style shuffle, visible credits/source links and seven closed advanced sections. Hosts without a catalogue retain visible playlist playback. The verified hosted synth object returned HTTP 200, CORS *, and its declared 1,740,382-byte length.',
      'Functional player approval only. The 70 CC0/CC BY recordings retain audited rights and pending musical review; no recording, composition, Ukrainian authenticity, physical-device, frozen-offline or public-release approval is granted. UA-FPV remains excluded without redistribution permission. All earlier production history remains immutable before this reviewed successor.',
    ],
  },
  motion: {
    sha256: 'ef5ede43180597ba413e26f2042d9f99a06c2f70a224b0d8d5543d384688ea76',
    evidence: [
      'Scoped Journey motion/material source review: docs/verification/journey-delivery-effects-review.md; three ordered motion inputs sha256:ef5ede43180597ba413e26f2042d9f99a06c2f70a224b0d8d5543d384688ea76. Original Motion painter remains unchanged; explicit actor-material successor frames select a fixed 84-recipe body-only table. Old theme IDs and unknown roles fall back; explicit skins and uploaded images retain priority.',
      'Independent six-suite cohort passes 54/54 on each Node20.19.5 and Node22.22.2. Checks cover seven connected bounded role masks across twelve materials, 498 unchanged Solo/Versus identities, 36 Team identities, exact contact/checkpoints, skin/upload override, pause/reduced behavior and fitted-edge envelopes. No source review finding changes authoritative clocks, positions, radii or role badges.',
      'Functional source/material geometry approval only, not subjective art, all-state native/device, human balance, audio/offline or public approval. The unpublished Journey fpv55–58 lineage is preserved as an authenticated inert archive; canonical history starts from accepted main fpv56. See docs/verification/journey-main-reconciliation/README.md. All 127 original payloads remain unchanged. Complete integrated host and hosted qualification remain required; changed motion inputs reopen this group.',
    ],
  },
  effects: {
    sha256: '13a140c0872eaa646b79f26c068b90527a1d0034131284bbbe9f5b5a5e3829d9',
    evidence: [
      'Scoped integrated Journey effects review: docs/verification/journey-delivery-effects-review.md; eight ordered effects inputs sha256:13a140c0872eaa646b79f26c068b90527a1d0034131284bbbe9f5b5a5e3829d9. Includes relay/directional painters and actor catalogue dependency fingerprints. Independent review found no gameplay, clock or input mutation; bounded projections and canvas lifetime remain cosmetic.',
      'Independent presentation/transport/authoring and guidance cohorts pass 132 checks per Node20/Node22. Two Team host checks initially rejected stale exact theme bindings and were repaired in the archived fpv58 checkpoint; those historical results do not qualify the new canonical binding. Complete reconciled host/CI reruns remain mandatory. Separate 100-check effects and fingerprint cohort passes both Nodes. Timed cues, lane contact geometry, relay/directional symbols and checkpoint preservation are scoped functional evidence.',
      'Functional source approval only. All 127 original payloads remain unchanged. Accepted main fpv55/fpv56 records remain canonical and immutable; the differing unpublished Journey fpv55–58 lineage is separately archived, not silently reinterpreted. See docs/verification/journey-main-reconciliation/README.md. Complete visual/art, final-byte native/device, human pacing, audio/offline and public acceptance remain separate. Any effects input change reopens this group.',
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
    if (!sources[slot.group]) continue;
    add(slot.id, {
      kind: 'recipe',
      recipe: { id: slot.recipes[0] },
      description: `${slot.label}: existing bounded component with Field Kit tokens and state styling.`,
      provenance: {
        creator: 'Reveal Line',
        source: recipeSources[slot.group],
        license: 'Project-authored runtime recipe',
        prompt: slot.prompt,
        parent: { id: `${slot.id}.default`, revision: 1 },
      },
      quality: recipeQuality(slot.group, recipeSources[slot.group]),
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
  production.document = retainProductionHistory(production.document, history?.document);
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
  const result = await compilePresentation(production.document, production.assets);
  const out = path.join(root, 'game/presentation/compiled');
  const config = await resolveConfig(path.join(root, 'game/build-config.json'));
  // Generated JSON/CSS follows the same formatter as committed source files.
  for (const [name, body] of result.files)
    if (/\.(json|css)$/.test(name))
      result.files.set(
        name,
        Buffer.from(
          await format(new TextDecoder().decode(body), {
            ...config,
            parser: name.endsWith('.json') ? 'json' : 'css',
          }),
        ),
      );
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

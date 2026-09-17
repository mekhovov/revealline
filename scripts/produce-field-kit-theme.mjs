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
  ui: 'game/ui/field-kit-components.css; game/ui/field-kit-compiled.css; game/presentation/host.mjs; game/ui/operation-status.css; game/ui/operation-status.mjs',
  screens:
    'game/ui/field-kit-flow.css; game/ui/field-kit-surfaces.css; game/ui/field-kit-compiled.css; site/release-catalog.css',
  motion: 'authoring/motion-lab/render-character.mjs; game/ui/actor-presentation.mjs',
  effects: 'game/ui/classic-view.mjs; game/ui/event-feedback.mjs',
  audio:
    'game/ui/audio.mjs; game/ui/published-audio.mjs; game/ui/soundtrack-player.mjs; game/ui/audio-master.mjs',
};

// A recipe stays unreviewed whenever one of its source inputs changes. These
// are deliberate, source-pinned approvals for scoped renderer and loading reviews:
// changing a digest creates a new source-stage revision and re-opens the
// release readiness gate rather than silently inheriting this review.
const REVIEWED_RECIPE_INPUTS = {
  screens: {
    sha256: '4f9a3429dd418dc2376c6d2b871280fd8866e4a23f1f2acc30d4775ecb013e0d',
    evidence: [
      'Scoped P03 source review: docs/verification/cross-mode/replay-disabled-actions/recipe-review.md; screen recipe inputs sha256:4f9a3429dd418dc2376c6d2b871280fd8866e4a23f1f2acc30d4775ecb013e0d. The only screen-input change from accepted fpv26 is the enabled-only primary-action guard in game/ui/field-kit-surfaces.css. Disabled and aria-disabled controls retain muted component styling; enabled and focus behavior remain unchanged. Previous screen approvals remain in immutable history.',
      'Exact Replay source 965f2049 retains the scoped CSS review, 29 passing navigation/display cases on each Node runtime and actual browser completion-to-Restart evidence in docs/verification/cross-mode/replay-disabled-actions/. The native Copper Crossing replay completed at tick 1305; disabled Play was muted, Tab skipped Step, and Restart returned to tick zero. Theme/Standard and Plain/Large were checked at a 1280x720 viewport.',
      'This declaration covers the bounded Replay screen-state correction, not full P03/P05 completion. Empty/loading/error states, physical input, full responsive/zoom, audio and final exact-source/public qualification remain separate. The matching legacy theater CSS guard is reviewed alongside the shared rule but is outside this recipe input list. Original artwork and all other recipe groups are unchanged.',
    ],
  },
  ui: {
    sha256: 'e3f6c6e0b186a3ea3f0ed9203e6da709641782bcbc9a3ca698bdba0bae06a450',
    evidence: [
      'Scoped P01 source review: docs/verification/cross-mode/p01/recipe-review.md; UI recipe inputs sha256:e3f6c6e0b186a3ea3f0ed9203e6da709641782bcbc9a3ca698bdba0bae06a450. Existing control CSS and accepted artwork mapping are unchanged; guarded presentation observations and the shared status DOM/CSS preserve native control, focus and measured-progress semantics.',
      'game/test/operation-status.test.mjs, presentation-host.test.mjs, presentation-page.test.mjs and presentation-ui.test.mjs verify current-owner status, original byte validation, stale cleanup, native handlers/checked state and no focus theft; the P01 recipe-source run passes67/67 including audio contracts.',
      'Current P01 Chromium evidence retained in docs/verification/cross-mode/p01/recipe-evidence/: deploy-large-plain-portrait.png with portrait/landscape measurements and Reduced Effects animationName none; couch-cosmetic-held-portrait.png plus landscape measurements show ready controls during a real141.572s compiled-runtime wait; replay-held-landscape-fixed.png with both viewport measurements shows loading/Cancel44px. These are source-browser checks, not physical-device or release acceptance.',
    ],
  },
  audio: {
    sha256: 'ffc98cb5fae178aa91524368abbe5d62f13e79ab7726f0f312feb4e64dc4e130',
    evidence: [
      'Scoped P02-A source review (functional): docs/verification/cross-mode/p02-a/recipe-review.md; audio recipe inputs sha256:ffc98cb5fae178aa91524368abbe5d62f13e79ab7726f0f312feb4e64dc4e130. Shared master mute/volume applies once while local buses, media envelopes, independent transport intent and historical cue/composition recipes remain separate. The four exact reviewed inputs remain unchanged after integrating P01 candidate cc9f8ff.',
      'Focused core, persistence, native-media binding and actual-host tests retain delayed-play/context ownership, mute/zero enforcement, observer reentrancy, shared 1-percent control precision and disposal coverage in docs/verification/cross-mode/p02-a/. These scoped observations do not replace final integrated-source qualification.',
      'Native owned MP3 and silent-video observations preserve independent transport under master changes. The reproducible output-probe measures actual Soundscape PCM: silent mute/zero windows, quarter-volume RMS ratio0.250056547, restored ratio0.999610075 and owned-context cleanup. This functional recipe approval is not album listening, physical-speaker, native MP3/video gain, device or public-release certification.',
    ],
  },
  motion: {
    sha256: '39127024d6fb37fb50e42a4d3e1e7034b633be8e7e31225b638963a577e63554',
    evidence: [
      'Scoped P03 source review: docs/verification/cross-mode/p03/recipe-review.md; motion recipe inputs sha256:39127024d6fb37fb50e42a4d3e1e7034b633be8e7e31225b638963a577e63554. The only motion-input change adds optional finite cosmetic bodyOffset to drawPresentedActor. Body, rotor and badge translate together; the contact footprint remains at the real frame position. Ordinary callers retain their original transform path.',
      'The retained Team cohort covers actual presentation bindings, layout and separate contact positions; 205/205 passed on Node20.19.5 and Node22.22.2 at the recorded working inputs. Source-browser Team and both Versus boards loaded the exact original artwork. These observations do not constitute a complete animation-set, physical-size or motion-comfort audit.',
      'All original image payloads, rotor recipes, source sizes and previous approvals remain in immutable history. The measured fpv25 source stage is preserved before this scoped review successor. Full source and public qualification remain separate.',
    ],
  },
  effects: {
    sha256: 'e564793d7dd8db06474ed13f6cc773267f733d4361b9d648d84135484f5501b4',
    evidence: [
      'Scoped v0.54 source review: game/ui/classic-view.mjs and game/ui/event-feedback.mjs sha256:e564793d7dd8db06474ed13f6cc773267f733d4361b9d648d84135484f5501b4. The correction supplies the selected body geometry to the existing presented-enemy renderer without changing feedback recipes.',
      'game/test/classic-presentation.test.mjs, game/test/presentation-renderer.test.mjs and game/test/renderer-readability.test.mjs cover the corrected classic renderer call, geometry, contact marker and feedback presentation.',
      'Prior gameplay context: docs/verification/fpv-redesign/phase5/flight-live-cut-desktop.png and docs/verification/fpv-redesign/phase5/flight-line-recovery.png; the source fingerprint above, not those screenshots alone, defines this approval.',
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

export async function createFieldKitProduction({ projectRoot = root } = {}) {
  const read = async (relative) => fs.readFile(path.join(projectRoot, relative));
  const json = async (relative) => JSON.parse(await read(relative));
  const baseline = createDefaultThemeBundle();
  const recipeSources = Object.fromEntries(
    await Promise.all(
      Object.entries(sources).map(async ([group, paths]) => [
        group,
        `${paths} sha256:${hash(Buffer.concat(await Promise.all(paths.split('; ').map(read))))}`,
      ]),
    ),
  );
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

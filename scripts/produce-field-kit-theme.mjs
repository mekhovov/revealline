/** Assemble original production assets into the existing immutable theme model. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveConfig } from 'prettier';
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
import { readPresentation, writePresentation } from './write-presentation.mjs';
import { preparePresentationOutput } from './prepare-presentation-output.mjs';
import { createFieldKitTeamAssets } from './field-kit-team-assets.mjs';
import { applyReviewedTeamArt } from './reviewed-team-art.mjs';
import { retainProductionHistory } from './presentation-production-history.mjs';
import { importThemeBundle, exportThemeBundle } from '../game/presentation/bundle.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const reference = (asset) => ({ id: asset.id, revision: asset.revision });
const sources = {
  ui: 'game/ui/field-kit-components.css; game/ui/field-kit-compiled.css; game/presentation/host.mjs; game/ui/operation-status.css; game/ui/operation-status.mjs; game/presentation/dom-ownership.mjs; game/presentation/manifest-path.mjs; game/presentation/team-actor-slots.mjs; game/presentation/team-anchor-slots.mjs; game/presentation/team-effect-slots.mjs; game/presentation/team-threat-slots.mjs; game/presentation/team-event-slots.mjs',
  screens:
    'game/ui/field-kit-flow.css; game/ui/field-kit-surfaces.css; game/ui/field-kit-compiled.css; site/release-catalog.css',
  motion: 'authoring/motion-lab/render-character.mjs; game/ui/actor-presentation.mjs',
  effects:
    'game/ui/classic-view.mjs; game/ui/event-feedback.mjs; game/content-design/actor-marker.mjs; game/ui/lane-presentation.mjs; game/ui/render.mjs',
  audio:
    'game/ui/audio.mjs; game/ui/published-audio.mjs; game/ui/soundtrack-player.mjs; game/ui/audio-master.mjs',
};

// A recipe stays unreviewed whenever one of its source inputs changes. These
// are deliberate, source-pinned approvals for scoped renderer and loading reviews:
// changing a digest creates a new source-stage revision and re-opens the
// release readiness gate rather than silently inheriting this review.
const REVIEWED_RECIPE_INPUTS = {
  screens: {
    sha256: '18c153b6443e96b59dc3c1253eba9c011dbd3fad45341288cd0b3b2ec044dbb7',
    evidence: [
      'Scoped P03 Pause source review: docs/verification/cross-mode/solo-pause-layout/recipe-review.md; screen recipe inputs sha256:18c153b6443e96b59dc3c1253eba9c011dbd3fad45341288cd0b3b2ec044dbb7. The only screen-input change from accepted fpv30 excludes the Pause state from the later narrow generic overlay grid in game/ui/field-kit-surfaces.css. Existing portrait one-column and short-landscape two-column Pause rules regain precedence. Ready, Lost and Won selector matching is unchanged. Earlier screen approvals remain in immutable history.',
      'The scoped root browser review in docs/verification/cross-mode/solo-pause-layout/root-native-layout-review.json sha256:ed64c647190397231f799b7a80d319dc4b8b1ad06d71d1e9b650a779c687825c binds base 2f1074a37ade9c731ea7be37a6e56e533b51d1ac and candidate CSS sha256:43ebeb2288a7e2e3e153fbfc3c7c84e719fe2fb62e694cbce01ad0fb6c228624. Actual browser observations cover 280x800 Theme/Standard, Theme/Large and Plain/Large; portrait widths 600/601/680/681; short landscape 844x390 and 600x400; and the 540/541 height boundary. Keyboard Restart/Cancel, Brief/Back and Main menu/Continue preserve the examined state; paused rotations retain focus and counters.',
      'This declaration covers only the one-rule Pause layout correction, not a renewed review of every screen or complete P03/P05 acceptance. The exact source-stage fpv31 and scoped reviewed fpv32 successors preserve original history. Narrow Large HUD score clipping and Mission Brief Done reading wrapping remain open. Actual browser zoom, physical touch/controller, screen reader, audio/offline/lifecycle, native Lost/Won and final committed-source/public qualification remain separate. Original payloads, both selected title images, typography tokens and all other recipe groups are unchanged.',
    ],
  },
  ui: {
    sha256: 'b31e970f9ca0b27a5229af8de276938bfc9c08f6954de1a6f4ac29b39a1d8b41',
    evidence: [
      'Scoped Team loader source review: docs/verification/team-presentation-integration/ui-recipe-review.md. UI recipe sha256:b31e970f9ca0b27a5229af8de276938bfc9c08f6954de1a6f4ac29b39a1d8b41 includes the retained-manifest path helper and all five Team role registries, so changes reopen review. Existing component CSS, status ownership and DOM ownership are unchanged.',
      'Actual presentation host, dependency inventory and visual-lease cohorts pass 39/39 on Node20.19.5 and Node22.22.2. Registered Team images enter normal verified decode/crop lifetime; retained loads require the same exact manifest pin and a code-owned hash filename, with no current-release fallback. Missing, altered, cancelled or failed replacements preserve the accepted owner.',
      'Functional source review only. Compiled adoption, all-theme/state visuals, physical devices, screen readers, full offline journeys, human playtests and public acceptance remain separate. Earlier reviewed recipe and historical presentation records remain immutable.',
    ],
  },
  audio: {
    sha256: 'b07a0865c1ff94faf7d1b45ccd7db1a9c0f4b417e366da9ddb1a5e7849beecba',
    evidence: [
      'Scoped Journey P02 music source review (functional): docs/verification/journey-p02-music-recipe.md. Inputs sha256:b07a0865c1ff94faf7d1b45ccd7db1a9c0f4b417e366da9ddb1a5e7849beecba. Only published-audio adds default-compatible cues opt-out for Team; other inputs and recipes unchanged.',
      'Seven published-audio tests cover lazy/verified music, default cues, mute, cancellation, music-only ownership and late readiness/disposal. Preserve fpv33 and all127 original payloads; exact Team picture pins are verified separately.',
      'Adapter review only, not Team cue parity, listening, physical-device, whole-phase or public acceptance. Prior measurements remain historical; final integrated qualification is required.',
    ],
  },
  motion: {
    sha256: 'b050a157f2fcffb3c3811776ded9f477dbec46e1f237fc28d2d1461f989c5cc4',
    evidence: [
      'Scoped P08-A source review: docs/actor-size-recipe-review.md; motion recipe inputs sha256:b050a157f2fcffb3c3811776ded9f477dbec46e1f237fc28d2d1461f989c5cc4. The actor presentation input repairs fitted CSS minimum/maximum sizing while retaining source artwork, rotor recipes and finite actor/tail budgets. The unchanged Motion painter remains the second fingerprint input. The companion Solo/Versus body inset is separately pinned and leaves true contact, cut/head, ability centres and simulation unchanged.',
      'The three runtime bodies committed in v0.61.22 source 307f46382a580b877a99123b3a7df7d9bc53dd40 match the reviewed candidate exactly. The retained cohort passed 100 tests each on Node20.19.5 and Node22.22.2, including actual-paint edge/transform envelopes, separate contact/trail geometry and checkpoint preservation. Original scoped native review sha256:c688971d7375f0e6fd0e361b6cd5b421f283a935ac2b5d62944e6221257a9b47 observed compact/detailed Solo and Versus craft at examined edges and exposed cuts; modeled geometry and browser observations remain distinct.',
      'This is a bounded sizing/inset recipe declaration, not complete animation-set, all-role, all-theme, physical-input, brightness, fairness, audio, offline or public acceptance. Separate narrow Large HUD overflow remains open. Immutable fpv28 approval and the measured fpv29 source-stage successor are retained before this reviewed successor; all original payloads remain unchanged. Final integrated-source qualification and public verification are still required.',
    ],
  },
  effects: {
    sha256: '7f91a47de464c4c54195ad39b5945085954d3293afe59e28c24af2f1d43cdf13',
    evidence: [
      'Scoped v0.76 effects source review: docs/verification/xposed-journey-v076-integration.md; effects recipe inputs sha256:7f91a47de464c4c54195ad39b5945085954d3293afe59e28c24af2f1d43cdf13. The renderer stays cosmetic while lane cues cover the complete inclusive trail-contact envelope.',
      'Independent Node20/Node22 cohorts compare both axes, edge/interior lanes and widths 1, 1.2 and 2 against immediate contact and travelling-impact predicates. Warning/active states remain dashed/solid in two inks; emitter/carrier silhouettes, uploaded-body layering and restored contact rings remain bounded.',
      'Functional source approval only. Complete visual/art, native/device, human pacing/fairness, audio/offline and public acceptance remain separate. Any effects recipe input change reopens this group.',
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
  const team = await createFieldKitTeamAssets({ projectRoot });
  const baseline = structuredClone(createDefaultThemeBundle());
  baseline.slots.push(...team.slots);
  const recipeSources = await fieldKitRecipeSources(read);
  const assets = [],
    bindings = {},
    bytes = new Map();
  const add = (slotId, values, body = null) => {
    const slot = baseline.slots.find((s) => s.id === slotId);
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
  for (const asset of await applyReviewedTeamArt(team.assets, read))
    add(asset.slotId, asset.values, asset.body);
  const document = reviseStudioTheme(baseline, { assets, bindings });
  return {
    document,
    assets: bytes,
    coverage: presentationCoverage(document),
    appendSlots: team.slots,
  };
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
  production.document = retainProductionHistory(production.document, history?.document, {
    appendSlots: production.appendSlots,
  });
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
  // Format only fresh output, then preserve authenticated original bytes.
  const files = await preparePresentationOutput(result.files, {
    formatOptions: config,
    previous: await readPresentation(out, { allowMissing: true }),
  });
  await writePresentation(files, out, { check: args[0] === '--check' });
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
      files: files.size,
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

/** Deterministic, explicit derivatives of retained generated reveal originals.
 * This is pixel preparation, not a claim of hand-authored native pixel artwork. */
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { decodeRGB, encodeScenePNG } from './prepare-field-kit-scenes.mjs';
import { centerCrop } from '../authoring/asset-studio/helpers.mjs';
import { ASSET_SLOTS } from '../game/presentation/catalog.mjs';
import { canonicalJSON } from '../game/data-json.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
export const REVEAL_PREPARATION_VERSION = 1;
export const REVEAL_OUTPUT_DIRECTORY = 'authoring/library/fpv-field-kit/prepared/reveals';
export const REVEAL_PALETTE = Object.freeze([
  '#070b12',
  '#101923',
  '#172837',
  '#213647',
  '#2b4558',
  '#3b586f',
  '#506a82',
  '#718397',
  '#a5b2bb',
  '#c5c8c0',
  '#f3f0db',
  '#163e47',
  '#245966',
  '#326a70',
  '#457f80',
  '#78dce8',
  '#1c302d',
  '#2b4036',
  '#3c5140',
  '#506348',
  '#687c55',
  '#819361',
  '#9dbb7a',
  '#b7c38a',
  '#433d33',
  '#62523e',
  '#806445',
  '#a27d4e',
  '#c29b68',
  '#d7b885',
  '#f4bf62',
  '#dc923f',
  '#bb693a',
  '#8e5740',
  '#464d51',
  '#647786',
]);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const check = (value, message) => {
  if (!value) throw new Error(message);
};
const rgbPalette = REVEAL_PALETTE.map((hex) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)),
);

/** Registered frames retain their exact output dimensions. For odd external
 * dimensions, only the final right/bottom cluster is clipped at the frame edge. */
export function prepareRevealPixels(source, width, height, { crop: cropOverride } = {}) {
  check(
    Number.isInteger(width) &&
      Number.isInteger(height) &&
      width > 0 &&
      height > 0 &&
      width <= 1920 &&
      height <= 1080 &&
      width * height <= 2073600,
    'Invalid reveal target frame.',
  );
  check(
    Number.isInteger(source.width) &&
      Number.isInteger(source.height) &&
      source.width > 0 &&
      source.height > 0 &&
      source.rgb.length === source.width * source.height * 3,
    'Invalid reveal source pixels.',
  );
  const scale = width === 768 ? 2 : width === 1152 ? 3 : 4;
  const logicalWidth = Math.ceil(width / scale),
    logicalHeight = Math.ceil(height / scale),
    crop = cropOverride
      ? { ...cropOverride }
      : centerCrop(source.width, source.height, width, height);
  check(
    [crop.x, crop.y, crop.width, crop.height].every(Number.isInteger) &&
      crop.x >= 0 &&
      crop.y >= 0 &&
      crop.width > 0 &&
      crop.height > 0 &&
      crop.x + crop.width <= source.width &&
      crop.y + crop.height <= source.height,
    'Invalid explicit reveal crop.',
  );
  const logical = new Uint8Array(logicalWidth * logicalHeight * 3),
    selected = new Set();
  const memo = new Map();
  for (let y = 0; y < logicalHeight; y++)
    for (let x = 0; x < logicalWidth; x++) {
      const sx =
          crop.x + Math.min(crop.width - 1, Math.floor(((x + 0.5) * crop.width) / logicalWidth)),
        sy =
          crop.y + Math.min(crop.height - 1, Math.floor(((y + 0.5) * crop.height) / logicalHeight));
      const at = (sy * source.width + sx) * 3,
        sourceRGB = source.rgb.subarray(at, at + 3),
        key = sourceRGB[0] * 65536 + sourceRGB[1] * 256 + sourceRGB[2];
      let index = memo.get(key);
      if (index === undefined) {
        let distance = Infinity;
        for (let p = 0; p < rgbPalette.length; p++) {
          // Perceptual weighting keeps small bright color changes less dominant
          // than luminance changes. No dithering or smooth resampling is applied.
          const d =
            (sourceRGB[0] - rgbPalette[p][0]) ** 2 * 2 +
            (sourceRGB[1] - rgbPalette[p][1]) ** 2 * 4 +
            (sourceRGB[2] - rgbPalette[p][2]) ** 2 * 3;
          if (d < distance) {
            distance = d;
            index = p;
          }
        }
        memo.set(key, index);
      }
      logical.set(rgbPalette[index], (y * logicalWidth + x) * 3);
      selected.add(index);
    }
  const rgb = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const at = (Math.floor(y / scale) * logicalWidth + Math.floor(x / scale)) * 3;
      rgb.set(logical.subarray(at, at + 3), (y * width + x) * 3);
    }
  return {
    width,
    height,
    rgb,
    preparation: {
      algorithm: 'field-kit-reveal-pixel-preparation-v1',
      sourceCrop: crop,
      sampling: 'nearest pixel-center',
      logicalWidth,
      logicalHeight,
      integerScale: scale,
      clippedEdgePixels: {
        right: logicalWidth * scale - width,
        bottom: logicalHeight * scale - height,
      },
      quantization: 'fixed36-color weighted RGB nearest; no dithering',
      palette: [...REVEAL_PALETTE],
      usedColors: [...selected].sort((a, b) => a - b).map((i) => REVEAL_PALETTE[i]),
      alpha: 'opaque',
      disclosure:
        'Generated original sampled to a bounded logical grid, palette-mapped and enlarged with integer clusters. This derivative is not a hand-authored native pixel drawing.',
    },
  };
}
async function preserve(file, bytes, checkOnly) {
  try {
    const existing = await readFile(file);
    check(
      hash(existing) === hash(bytes),
      `Existing derivative differs; preserve it and create a new revision: ${file}`,
    );
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    check(!checkOnly, `Missing prepared reveal ${file}`);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, bytes, { flag: 'wx' });
  }
}
async function optionalJSON(relative) {
  try {
    return JSON.parse(await readFile(resolve(root, relative), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return { records: [] };
    throw error;
  }
}
export function resolveRevealSources(originals, revisions = []) {
  check(
    Array.isArray(originals) && Array.isArray(revisions) && revisions.length <= 128,
    'Invalid reveal source revisions.',
  );
  const sources = new Map();
  for (const source of originals) {
    check(!sources.has(source.id), `Duplicate reveal source ${source.id}`);
    sources.set(source.id, source);
  }
  for (const revision of revisions) {
    const before = sources.get(revision.id);
    check(
      before &&
        Number.isSafeInteger(revision.revision) &&
        revision.revision === (before.revision ?? 1) + 1,
      'Reveal source revision must follow its existing parent.',
    );
    check(
      canonicalJSON(revision.supersedes) === canonicalJSON(before.source),
      'Reveal source revision has a stale parent.',
    );
    check(
      /^[a-z0-9-]+$/.test(revision.id) &&
        revision.source?.path ===
          `authoring/library/fpv-field-kit/originals/reveals/${revision.id}-v${revision.revision}.png`,
      'Reveal revision requires a new versioned source path.',
    );
    check(
      typeof revision.prompt === 'string' && revision.prompt.length >= 100,
      'Reveal source revision needs its full edit prompt.',
    );
    sources.set(revision.id, revision);
  }
  return sources;
}

export async function prepareFieldKitReveals({ checkOnly = false } = {}) {
  const [plan, proof, generated, crops, revisions] = await Promise.all([
    optionalJSON('authoring/design-atlas/reveal-production-plan.json'),
    optionalJSON('authoring/library/fpv-field-kit/reveal-proof-sources.json'),
    optionalJSON('authoring/library/fpv-field-kit/reveal-generated-sources.json'),
    optionalJSON('authoring/library/fpv-field-kit/reveal-crop-decisions.json'),
    optionalJSON('authoring/library/fpv-field-kit/reveal-source-revisions.json'),
  ]);
  check(
    !revisions.format || revisions.format === 'revealline-reveal-source-revisions.v1',
    'Invalid reveal revision format.',
  );
  const all = [...proof.records, ...generated.records],
    sources = resolveRevealSources(all, revisions.records),
    assets = [];
  // Earlier originals remain immutable even when a later source is selected.
  for (const record of [...all, ...revisions.records]) {
    const bytes = await readFile(resolve(root, record.source.path));
    check(
      hash(bytes) === record.source.sha256 && bytes.length === record.source.bytes,
      `Original reveal source changed: ${record.id}`,
    );
  }
  const decoded = new Map(),
    slots = new Map(ASSET_SLOTS.map((slot) => [slot.id, slot]));
  for (const entry of plan.exports) {
    const record = sources.get(entry.compositionId);
    if (!record) continue;
    let image = decoded.get(record.id);
    if (!image) {
      const bytes = await readFile(resolve(root, record.source.path));
      check(
        hash(bytes) === record.source.sha256 && bytes.length === record.source.bytes,
        `Original reveal source changed: ${record.id}`,
      );
      image = decodeRGB(bytes);
      check(
        image.width === record.source.width && image.height === record.source.height,
        `Original reveal source dimensions changed: ${record.id}`,
      );
      decoded.set(record.id, image);
    }
    const cropDecision = crops.records.find((decision) => decision.exportId === entry.id);
    if (cropDecision)
      check(
        cropDecision.sourceId === record.id &&
          cropDecision.sourceDimensions.width === image.width &&
          cropDecision.sourceDimensions.height === image.height,
        'Explicit crop source differs.',
      );
    const output = prepareRevealPixels(image, entry.width, entry.height, {
        crop: cropDecision?.crop,
      }),
      bytes = encodeScenePNG(output),
      decodedOutput = decodeRGB(bytes);
    check(hash(decodedOutput.rgb) === hash(output.rgb), `PNG round-trip differs: ${entry.id}`);
    const slot = slots.get(entry.owners[0]);
    for (const id of entry.owners) {
      const s = slots.get(id);
      check(
        s && s.dimensions.width === entry.width && s.dimensions.height === entry.height,
        `Incorrect reveal owner frame ${id}`,
      );
      check(bytes.length <= s.budget.maxBytes, `Reveal exceeds slot byte budget: ${id}`);
    }
    const version = record.revision ?? 1;
    const path = `${REVEAL_OUTPUT_DIRECTORY}/${entry.id}-v${version}.png`;
    await preserve(resolve(root, path), bytes, checkOnly);
    assets.push({
      id: `${entry.id}-v${version}`,
      compositionId: entry.compositionId,
      slotIds: entry.owners,
      file: {
        path,
        sha256: hash(bytes),
        bytes: bytes.length,
        mime: 'image/png',
        width: entry.width,
        height: entry.height,
        pixelsSha256: hash(output.rgb),
      },
      geometry: {
        ...structuredClone(slot.geometry),
        occupiedBounds: { x: 0, y: 0, width: 1, height: 1 },
      },
      provenance: {
        creator:
          'Original scene generated with OpenAI image_gen; explicit deterministic Field Kit derivative preparation.',
        source: record.source,
        license: 'Project-generated original artwork; no third-party source pixels copied.',
        prompt: record.prompt,
        tool: record.tool,
        toolPath: record.toolPath,
        parent: null,
        ...(record.supersedes ? { supersedesSource: record.supersedes } : {}),
      },
      preparation: { ...output.preparation, cropDecision: cropDecision ?? null },
      quality: {
        stage: 'produced',
        evidence: [
          'Pinned original bytes preserved; full PNG decode; exact registered frame; opaque RGB; fixed palette; deterministic integer clusters; decoded RGB round trip. Artistic and real-game context review remain separate.',
        ],
      },
    });
  }
  const completed = new Set(assets.map((asset) => asset.compositionId)),
    missing = plan.compositions
      .filter((composition) => !completed.has(composition.id))
      .map((composition) => composition.id);
  const manifest = {
    format: 'revealline-prepared-reveals.v1',
    preparationVersion: REVEAL_PREPARATION_VERSION,
    recipeSource: {
      path: 'scripts/prepare-field-kit-reveals.mjs',
      sha256: hash(await readFile(fileURLToPath(import.meta.url))),
    },
    planned: {
      compositions: plan.compositions.length,
      exports: plan.exports.length,
      owners: new Set(plan.exports.flatMap((entry) => entry.owners)).size,
    },
    produced: {
      compositions: completed.size,
      exports: assets.length,
      owners: new Set(assets.flatMap((asset) => asset.slotIds)).size,
      totalPNGBytes: assets.reduce((n, asset) => n + asset.file.bytes, 0),
    },
    missingCompositions: missing,
    assets,
  };
  const manifestPath = resolve(root, `${REVEAL_OUTPUT_DIRECTORY}/reveals.json`),
    content = JSON.stringify(manifest, null, 2) + '\n';
  if (checkOnly)
    check(
      JSON.stringify(JSON.parse(await readFile(manifestPath, 'utf8'))) === JSON.stringify(manifest),
      'Prepared reveal manifest is stale.',
    );
  else {
    await mkdir(dirname(manifestPath), { recursive: true });
    await writeFile(manifestPath + '.next', content);
    await rename(manifestPath + '.next', manifestPath);
  }
  return manifest;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url)
  prepareFieldKitReveals({ checkOnly: process.argv.includes('--check') })
    .then((manifest) =>
      process.stdout.write(
        JSON.stringify({
          produced: manifest.produced,
          missingCompositions: manifest.missingCompositions,
        }) + '\n',
      ),
    )
    .catch((error) => {
      process.stderr.write(error.message + '\n');
      process.exitCode = 1;
    });

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { format, resolveConfig } from 'prettier';
import { pixelArtForSlot, FIELD_KIT_COLORS } from '../game/presentation/pixel-art.mjs';
import { encodeSpritePNG, inspectSprite } from './produce-field-kit-sprites.mjs';
import { ASSET_SLOTS, createDefaultThemeBundle } from '../game/presentation/catalog.mjs';
import { FORMATS, validateThemeBundle, resolvePresentation } from '../game/presentation/model.mjs';
import { reviseStudioTheme, adoptStudioBundle } from '../game/presentation/studio-session.mjs';
import { decodePresentationDocument } from '../game/presentation/document-codec.mjs';
import { exportThemeBundle, importThemeBundle } from '../game/presentation/bundle.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
export const ACTOR_ATLAS_SAMPLE_DIRECTORY = 'authoring/industrial-art-review/atlas-sample';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const ref = ({ id, revision }) => ({ id, revision });
const sourcePaths = [
  'game/presentation/pixel-art.mjs',
  'scripts/produce-field-kit-sprites.mjs',
  'scripts/produce-actor-atlas-sample.mjs',
  'game/presentation/compiled/studio.json',
];
const poses = [
  ['idle', 300, 0, 'danger'],
  ['scan', 300, 0, 'light'],
  ['notice', 160, 0, 'amber'],
  ['brace', 160, 0, 'amber'],
  ['brace-set', 160, 0, 'white'],
  ['tread-a', 100, 0, 'danger'],
  ['tread-b', 100, 1, 'danger'],
  ['tread-c', 100, 2, 'danger'],
  ['blocked', 300, 0, 'danger'],
  ['cooling-a', 220, 0, 'earth'],
  ['cooling-b', 220, 0, 'green'],
  ['caught', 200, 0, 'shadow'],
];

/** Original integer-pixel derivatives of our own canonical source. A tread,
 * sensor shutter and vent are articulated; no reference image is read. Every
 * frame keeps the source silhouette/pivot, transparent margin and north-facing barrel. */
export function actorAtlasSamplePixels() {
  const source = pixelArtForSlot('enemy.bouncer'),
    atlas = { width: 128, height: 96, rgba: new Uint8ClampedArray(128 * 96 * 4) };
  const colors = Object.fromEntries(
      Object.entries(FIELD_KIT_COLORS).map(([key, color]) => [
        key,
        [1, 3, 5].map((at) => parseInt(color.slice(at, at + 2), 16)).concat(255),
      ]),
    ),
    frames = [];
  for (const [index, [id, durationMs, tread, lens]] of poses.entries()) {
    const rgba = new Uint8ClampedArray(source.rgba);
    const rect = (x, y, width, height, color) => {
      for (let yy = y; yy < y + height; yy++)
        for (let xx = x; xx < x + width; xx++) rgba.set(colors[color], (yy * 32 + xx) * 4);
    };
    for (const x of [6, 22]) {
      rect(x, 8, 4, 19, 'frame');
      for (let y = 9 + tread; y < 27; y += 3) rect(x, y, 4, 1, 'metal');
    }
    rect(14, 16, 4, 2, lens);
    if (id === 'idle') rect(14, 16, 1, 1, 'white');
    if (id === 'scan') rect(16, 16, 2, 1, 'white');
    if (id === 'notice') rect(11, 11, 10, 1, 'amber');
    if (id.startsWith('brace')) {
      rect(11, 19, 2, 2, 'light');
      rect(19, 19, 2, 2, 'light');
      if (id === 'brace-set') rect(14, 20, 4, 1, 'metal');
    }
    if (id === 'blocked') {
      rect(14, 16, 4, 1, 'ink');
      rect(13, 24, 6, 1, 'amber');
    }
    if (id.startsWith('cooling')) {
      for (const x of [12, 15, 18]) rect(x, 22, 2, 2, id.endsWith('a') ? 'earth' : 'green');
    }
    if (id === 'caught') {
      rect(14, 16, 4, 2, 'ink');
      rect(10, 11, 12, 2, 'shadow');
      rect(13, 24, 6, 1, 'shadow');
      rect(14, 20, 1, 4, 'ink');
      rect(15, 22, 4, 1, 'ink');
    }
    const x = (index % 4) * 32,
      y = Math.floor(index / 4) * 32;
    for (let row = 0; row < 32; row++)
      atlas.rgba.set(rgba.subarray(row * 128, (row + 1) * 128), ((y + row) * 128 + x) * 4);
    frames.push({
      id,
      durationMs,
      stride: 0,
      breath: 0,
      accessory: 0,
      region: { x, y, width: 32, height: 32 },
    });
  }
  return { source, atlas, frames };
}

export async function createActorAtlasSample() {
  const published = validateThemeBundle(
      decodePresentationDocument(
        await readFile(resolve(root, 'game/presentation/compiled/studio.json'), 'utf8'),
      ),
    ),
    baseline = structuredClone(createDefaultThemeBundle()),
    admittedSlots = new Set(published.slots.map(({ id }) => id));
  // The source registry can contain future picture slots which have not been
  // released to Studio. A sample must import into the published workspace;
  // metadata does not authorize adding those unrelated slots to its history.
  baseline.slots = baseline.slots.filter(({ id }) => admittedSlots.has(id));
  for (const theme of baseline.themes)
    theme.bindings = Object.fromEntries(
      Object.entries(theme.bindings).filter(([id]) => admittedSlots.has(id)),
    );
  const used = new Set(
    baseline.themes.flatMap(({ bindings }) =>
      Object.values(bindings).map(({ id, revision }) => `${id}@${revision}`),
    ),
  );
  baseline.assets = baseline.assets.filter(({ id, revision }) => used.has(`${id}@${revision}`));
  const { source, atlas, frames } = actorAtlasSamplePixels(),
    original = encodeSpritePNG(source),
    png = encodeSpritePNG(atlas),
    slot = ASSET_SLOTS.find(({ id }) => id === 'enemy.bouncer'),
    geometry = {
      ...structuredClone(slot.geometry),
      occupiedBounds: inspectSprite(source).occupiedBounds,
    },
    sourceAsset = {
      format: FORMATS.asset,
      id: 'industrial-atlas-bouncer-source',
      revision: 1,
      kind: 'image',
      description:
        'Original north-facing Field Kit tracked patrol, retained as the immutable atlas parent.',
      provenance: {
        creator: 'RevealLine original pixel-art recipes, authored with Codex',
        source: 'game/presentation/pixel-art.mjs: pixelArtForSlot(enemy.bouncer)',
        license: 'Original project artwork; no external image pixels.',
        prompt: 'Retain the canonical 32px transparent north-facing source unchanged.',
        parent: null,
      },
      file: {
        sha256: hash(original),
        bytes: original.length,
        mime: 'image/png',
        width: 32,
        height: 32,
      },
      recipe: null,
      geometry,
      quality: { stage: 'produced', evidence: [] },
    },
    clip = (ids, loop = true) => ({ frames: ids, loop }),
    animation = {
      format: 'revealline-actor-animation.v1',
      id: 'industrial-bouncer-atlas-sample',
      revision: 1,
      rig: 'sprite.v1',
      material: 'machine',
      parts: ['armor'],
      anchors: { pivot: { ...geometry.pivot }, equipment: { x: 0.5, y: 0.25 } },
      frames,
      clips: {
        idle: clip(['idle', 'scan']),
        notice: clip(['notice', 'idle'], false),
        anticipation: clip(['brace', 'brace-set']),
        move: clip(['tread-a', 'tread-b', 'tread-c']),
        blocked: clip(['blocked']),
        recovery: clip(['cooling-a', 'cooling-b']),
        caught: clip(['caught'], false),
      },
      fallback: 'compact-overhead.v1',
    },
    asset = {
      ...structuredClone(sourceAsset),
      format: FORMATS.animatedAsset,
      id: 'industrial-bouncer-atlas-sample',
      description:
        'Twelve original 32px poses: sensor scan, anticipation bracing, rolling treads, stopped and cooling machinery. Review only.',
      provenance: {
        ...sourceAsset.provenance,
        source:
          'scripts/produce-actor-atlas-sample.mjs; canonical Field Kit source retained in this bundle.',
        prompt:
          'Articulate treads, sensor shutter and vents within the original silhouette. Preserve transparent margins, north-facing pivot and all gameplay cues. No borrowed Broforce or Factorio pixels.',
        parent: ref(sourceAsset),
      },
      file: {
        sha256: hash(png),
        bytes: png.length,
        mime: 'image/png',
        width: atlas.width,
        height: atlas.height,
      },
      animation,
    };
  const draft = structuredClone(
    reviseStudioTheme(validateThemeBundle(baseline), {
      assets: [sourceAsset, asset],
      bindings: { 'enemy.bouncer': ref(asset) },
    }),
  );
  draft.id = 'industrial-atlas-review';
  draft.themes.at(-1).name = 'Industrial atlas · review sample';
  const document = validateThemeBundle(draft),
    assets = new Map([
      [sourceAsset.file.sha256, new Blob([original], { type: 'image/png' })],
      [asset.file.sha256, new Blob([png], { type: 'image/png' })],
    ]),
    bundle = await exportThemeBundle(document, assets);
  // Production transport admission, not a simulated gameplay or automated suite.
  // Browser evidence separately verifies actual decoding and native-size readability.
  const imported = await importThemeBundle(bundle, { decodeImage: null });
  if (
    resolvePresentation(imported.document).assets['enemy.bouncer'].file.sha256 !==
      asset.file.sha256 ||
    imported.assets.size !== 2
  )
    throw new Error('Atlas sample failed native bundle admission.');
  const staged = adoptStudioBundle(published, imported.document);
  if (resolvePresentation(staged).assets['enemy.bouncer'].file.sha256 !== asset.file.sha256)
    throw new Error('Atlas sample failed published Studio workspace admission.');
  const roundTrip = Buffer.from(
      await (await exportThemeBundle(imported.document, imported.assets)).arrayBuffer(),
    ),
    bytes = Buffer.from(await bundle.arrayBuffer());
  if (!roundTrip.equals(bytes)) throw new Error('Atlas sample transport is not byte-identical.');
  return { document, asset, sourceAsset, png, original, bytes };
}

export async function produceActorAtlasSample({ check = false } = {}) {
  const sample = await createActorAtlasSample(),
    formatOptions = await resolveConfig(resolve(root, '.prettierrc.json')),
    files = new Map([
      ['source.png', sample.original],
      ['atlas.png', sample.png],
      ['industrial-bouncer.rltheme', sample.bytes],
      [
        'asset-v2.json',
        Buffer.from(
          await format(JSON.stringify(sample.asset), { ...formatOptions, parser: 'json' }),
        ),
      ],
    ]),
    provenance = {
      format: 'revealline-actor-atlas-sample.v1',
      quality: { stage: 'produced', evidence: [] },
      method:
        'Original Field Kit source recipes and deterministic encodeSpritePNG pipeline; no reference images or downloaded pixels.',
      sources: await Promise.all(
        sourcePaths.map(async (path) => ({
          path,
          sha256: hash(await readFile(resolve(root, path))),
        })),
      ),
      asset: ref(sample.asset),
      parent: ref(sample.sourceAsset),
      frames: sample.asset.animation.frames.length,
      decodedBytes: sample.asset.file.width * sample.asset.file.height * 4,
      files: [...files].map(([path, bytes]) => ({
        path,
        bytes: bytes.length,
        sha256: hash(bytes),
      })),
      admission:
        'Native asset-v2 validation, SHA/header-verified .rltheme import, published Studio workspace adoption and byte-identical re-export. No browser decode or play qualification is claimed.',
      runtimeClips: ['idle', 'move', 'anticipation', 'recovery', 'blocked'],
      previewOnlyClips: ['notice', 'caught'],
    };
  files.set(
    'provenance.json',
    Buffer.from(await format(JSON.stringify(provenance), { ...formatOptions, parser: 'json' })),
  );
  const directory = resolve(root, ACTOR_ATLAS_SAMPLE_DIRECTORY);
  if (!check) await mkdir(directory, { recursive: true });
  for (const [name, bytes] of files) {
    const target = resolve(directory, name);
    if (check) {
      if (!(await readFile(target)).equals(bytes))
        throw new Error(`Stale actor atlas artifact: ${name}`);
    } else await writeFile(target, bytes);
  }
  return {
    directory,
    files: files.size,
    atlasBytes: sample.png.length,
    bundleBytes: sample.bytes.length,
    decodedBytes: provenance.decodedBytes,
  };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url)
  console.log(
    JSON.stringify(await produceActorAtlasSample({ check: process.argv.includes('--check') })),
  );

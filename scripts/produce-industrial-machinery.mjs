import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import { format, resolveConfig } from 'prettier';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import {
  machineryPixels,
  machineryHardwarePixels,
  INDUSTRIAL_TEAM_HARDWARE_SLOTS,
  INDUSTRIAL_MACHINERY_REVISION,
} from '../game/presentation/industrial-machinery.mjs';
import { MILITARY_FIELD_ROLES } from '../game/presentation/military-field-art.mjs';
import { encodeSpritePNG, inspectSprite } from './produce-field-kit-sprites.mjs';
import { createDefaultThemeBundle } from '../game/presentation/catalog.mjs';
import { decodePresentationDocument } from '../game/presentation/document-codec.mjs';
import { FORMATS, validateThemeBundle, resolvePresentation } from '../game/presentation/model.mjs';
import { reviseStudioTheme, adoptStudioBundle } from '../game/presentation/studio-session.mjs';
import { exportThemeBundle, importThemeBundle } from '../game/presentation/bundle.mjs';
import { canonicalJSON } from '../game/data-json.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
export const MACHINERY_BATCH_DIRECTORY = 'authoring/industrial-art-review/machinery-v3';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const ref = ({ id, revision }) => ({ id, revision });

/** Native Studio transport, not a separate artwork engine or production write.
 * Retains the published slot contract and leaves the current workspace intact. */
export async function createIndustrialMachineryBatch() {
  const published = validateThemeBundle(
      decodePresentationDocument(
        await readFile(resolve(root, 'game/presentation/compiled/studio.json'), 'utf8'),
      ),
    ),
    base = structuredClone(createDefaultThemeBundle()),
    slots = new Set(published.slots.map(({ id }) => id));
  base.slots = base.slots.filter(({ id }) => slots.has(id));
  for (const theme of base.themes)
    theme.bindings = Object.fromEntries(
      Object.entries(theme.bindings).filter(([id]) => slots.has(id)),
    );
  const used = new Set(
    base.themes.flatMap(({ bindings }) =>
      Object.values(bindings).map(({ id, revision }) => `${id}@${revision}`),
    ),
  );
  base.assets = base.assets.filter(({ id, revision }) => used.has(`${id}@${revision}`));
  const roles = Object.entries(MILITARY_FIELD_ROLES).filter(([slot]) => slot.startsWith('enemy.'));
  roles.push(['team.enemy.drifter', 'utility-car']);
  for (const phase of ['patrol', 'warning', 'charge', 'recovery'])
    roles.push([`team.enemy.hunter.${phase}`, 'armored-carrier']);
  const records = [],
    payloads = new Map(),
    bindings = {},
    files = new Map(),
    inventory = [];
  const poses = [
    ['idle', 400, 0, 0],
    ['scan', 400, 0, 0.5],
    ['roll-a', 120, 0.125, 0],
    ['roll-b', 120, 0.25, 0.35],
    ['roll-c', 120, 0.375, 0.7],
    ['blocked', 400, 0, 0],
    ['recover', 400, 0, 0.35],
    ['caught', 200, 0, 0],
  ];
  for (const [slotId, family] of [
    ...roles,
    ...INDUSTRIAL_TEAM_HARDWARE_SLOTS.map((id) => [id, null]),
  ]) {
    const slot = base.slots.find(({ id }) => id === slotId),
      { width, height } = slot.dimensions;
    const original = family
        ? machineryPixels({ width, height }, family)
        : machineryHardwarePixels({ width, height }, slotId),
      atlas = family
        ? {
            width: width * 4,
            height: height * 2,
            rgba: new Uint8ClampedArray(width * height * 8 * 4),
          }
        : original;
    const frames = [];
    if (family)
      for (const [index, [id, durationMs, travelPhase, phase]] of poses.entries()) {
        const frame = machineryPixels({ width, height }, family, { travelPhase, phase, speed: 1 });
        if (id === 'caught')
          for (let at = 0; at < frame.rgba.length; at += 4) {
            frame.rgba[at] = Math.floor(frame.rgba[at] * 0.6);
            frame.rgba[at + 1] = Math.floor(frame.rgba[at + 1] * 0.6);
            frame.rgba[at + 2] = Math.floor(frame.rgba[at + 2] * 0.6);
          }
        const x = (index % 4) * width,
          y = Math.floor(index / 4) * height;
        for (let row = 0; row < height; row++)
          atlas.rgba.set(
            frame.rgba.subarray(row * width * 4, (row + 1) * width * 4),
            ((y + row) * atlas.width + x) * 4,
          );
        frames.push({
          id,
          durationMs,
          stride: 0,
          breath: 0,
          accessory: 0,
          region: { x, y, width, height },
        });
      }
    const png = encodeSpritePNG(atlas),
      geometry = {
        ...structuredClone(slot.geometry),
        occupiedBounds: inspectSprite(original).occupiedBounds,
      },
      asset = {
        format: family ? FORMATS.animatedAsset : FORMATS.asset,
        id: `industrial-v3-${slotId}`,
        revision: 1,
        kind: 'image',
        description: family
          ? `Original directly overhead ${family}; north-facing equipment, moving wheels or tracks and restrained accessory motion.`
          : `Original overhead ${slotId}; authoritative state outline and labels remain game-owned.`,
        provenance: {
          creator: 'RevealLine original machinery recipes',
          source: 'game/presentation/industrial-machinery.mjs',
          license: 'Original project artwork; no external image pixels.',
          prompt:
            'Approved overhead industrial art direction. Distinct mechanical silhouettes, opaque equipment with transparent surroundings, restrained material wear. No new combat rules or baked functional cues.',
          parent: null,
        },
        file: {
          sha256: hash(png),
          bytes: png.length,
          mime: 'image/png',
          width: atlas.width,
          height: atlas.height,
        },
        recipe: null,
        geometry,
        quality: { stage: 'produced', evidence: [] },
      };
    if (family) {
      const clip = (frames, loop = true) => ({ frames, loop });
      asset.animation = {
        format: 'revealline-actor-animation.v1',
        id: asset.id,
        revision: 1,
        rig: 'sprite.v1',
        material: 'machine',
        parts: ['armor'],
        anchors: { pivot: { ...geometry.pivot }, equipment: { x: 0.5, y: 0.25 } },
        frames,
        clips: {
          idle: clip(['idle', 'scan']),
          notice: clip(['scan', 'idle'], false),
          anticipation: clip(['scan']),
          move: clip(['roll-a', 'roll-b', 'roll-c']),
          blocked: clip(['blocked']),
          recovery: clip(['recover', 'idle']),
          caught: clip(['caught'], false),
        },
        fallback: 'compact-overhead.v1',
      };
    }
    records.push(asset);
    bindings[slotId] = ref(asset);
    payloads.set(asset.file.sha256, new Blob([png], { type: 'image/png' }));
    files.set(`${slotId}.png`, png);
    inventory.push({
      slot: slotId,
      family,
      asset: ref(asset),
      frames: frames.length || 1,
      decodedBytes: atlas.width * atlas.height * 4,
      sha256: asset.file.sha256,
      bytes: png.length,
    });
  }
  const draft = structuredClone(
    reviseStudioTheme(validateThemeBundle(base), { assets: records, bindings }),
  );
  draft.id = 'industrial-machinery-v3';
  draft.themes.at(-1).name = 'Industrial machinery · overhead batch';
  const document = validateThemeBundle(draft),
    bundle = await exportThemeBundle(document, payloads),
    bytes = Buffer.from(await bundle.arrayBuffer()),
    imported = await importThemeBundle(bundle, { decodeImage: null }),
    adopted = adoptStudioBundle(published, imported.document),
    accepted = resolvePresentation(adopted);
  for (const row of inventory)
    if (accepted.assets[row.slot]?.file?.sha256 !== row.sha256)
      throw new Error(`Machinery Studio admission failed: ${row.slot}`);
  const exported = Buffer.from(
    await (await exportThemeBundle(imported.document, imported.assets)).arrayBuffer(),
  );
  if (!exported.equals(bytes)) throw new Error('Machinery transport round-trip changed bytes.');
  files.set('industrial-machinery.rltheme', bytes);
  files.set(
    'inventory.json',
    Buffer.from(
      await format(
        canonicalJSON({
          format: 'revealline-machinery-batch.v1',
          revision: INDUSTRIAL_MACHINERY_REVISION,
          quality: { stage: 'produced', evidence: [] },
          source: {
            path: 'game/presentation/industrial-machinery.mjs',
            sha256: hash(
              await readFile(resolve(root, 'game/presentation/industrial-machinery.mjs')),
            ),
          },
          slots: inventory,
          decodedBytes: inventory.reduce((n, row) => n + row.decodedBytes, 0),
          bundleBytes: bytes.length,
          admission:
            'Native asset validation, portable import/export and published Studio adoption. No default replacement or public release.',
        }),
        { ...(await resolveConfig(resolve(root, 'package.json'))), parser: 'json' },
      ),
    ),
  );
  return { files, document, assets: payloads, inventory, bytes };
}

export async function produceIndustrialMachinery({ check = false } = {}) {
  const batch = await createIndustrialMachineryBatch(),
    directory = resolve(root, MACHINERY_BATCH_DIRECTORY);
  if (!check) await mkdir(directory, { recursive: true });
  for (const [name, bytes] of batch.files) {
    const file = resolve(directory, name);
    if (check) {
      if (!(await readFile(file)).equals(bytes)) throw new Error(`Stale machinery output: ${name}`);
    } else {
      const temporary = `${file}.${process.pid}.tmp`;
      try {
        await writeFile(temporary, bytes);
        await rename(temporary, file);
      } finally {
        await rm(temporary, { force: true });
      }
    }
  }
  return {
    directory,
    files: batch.files.size,
    bytes: [...batch.files.values()].reduce((n, body) => n + body.length, 0),
    decodedBytes: batch.inventory.reduce((n, row) => n + row.decodedBytes, 0),
    slots: batch.inventory.length,
  };
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url)
  console.log(
    JSON.stringify(await produceIndustrialMachinery({ check: process.argv.includes('--check') })),
  );

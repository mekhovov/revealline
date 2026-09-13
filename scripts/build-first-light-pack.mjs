#!/usr/bin/env node
/** Embed original chapter PNGs into the existing data-only expansion contract. */
import assert from 'node:assert/strict';
import { readFile, writeFile, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validatePack } from '../game/packs.mjs';
import { CONTENT_LIMITS, inspectImageDataUrl } from '../game/content.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
export const FIRST_LIGHT_PICTURES = Object.freeze(
  [
    {
      levelId: 'orchard-window',
      title: 'Orchard Window',
      description:
        'Blossoming orchard, blue timber gate and a small FPV above a Ukrainian village.',
    },
    {
      levelId: 'split-courtyard',
      title: 'Split Courtyard',
      description:
        'Rain-washed brick arches, warm window lights and a distant disabled fictional vehicle.',
    },
    {
      levelId: 'night-signal',
      title: 'Night Signal',
      description: 'Carpathian observatory, warm lantern and starry night above the valley.',
    },
  ].map(Object.freeze),
);

export async function buildFirstLightPack({ root = ROOT, write = false } = {}) {
  const source = path.join(root, 'authoring/library/fpv-arcade');
  const pack = JSON.parse(await readFile(path.join(source, 'pack-source.json'), 'utf8'));
  assert.equal(pack.id, 'fpv-arcade');
  assert.deepEqual(
    pack.campaigns[0].levels.map((level) => level.id),
    FIRST_LIGHT_PICTURES.map((image) => image.levelId),
  );
  assert.deepEqual(
    pack.levelVisuals,
    [],
    'Source recipe must not contain generated embedding data.',
  );
  const backgrounds = [];
  for (const picture of FIRST_LIGHT_PICTURES) {
    const filename = path.join(source, 'backgrounds', `${picture.levelId}.png`);
    const info = await lstat(filename).catch(() => null);
    assert.ok(
      info?.isFile() &&
        !info.isSymbolicLink() &&
        info.size > 0 &&
        info.size <= CONTENT_LIMITS.maxImageBytes,
      `Supply the original ${picture.levelId}.png as a regular PNG file of at most 4 MiB.`,
    );
    const bytes = await readFile(filename);
    assert.ok(
      bytes.length === info.size && bytes.length <= CONTENT_LIMITS.maxImageBytes,
      'Artwork changed during reading.',
    );
    const dataUrl = `data:image/png;base64,${bytes.toString('base64')}`;
    const header = inspectImageDataUrl(dataUrl);
    assert.equal(header.valid, true, `${picture.levelId}: ${header.errors.join('; ')}`);
    assert.equal(
      header.width / header.height,
      2,
      'Wide chapter pictures must have an exact 2:1 ratio.',
    );
    pack.levelVisuals.push({
      levelId: picture.levelId,
      visualOverrides: {
        background: {
          dataUrl,
          name: picture.title,
          fit: 'contain',
          metadata: {
            title: picture.title,
            description: picture.description,
            author: 'Reveal Line · AI-assisted original artwork',
            license: 'Original project artwork',
            rightsStatus:
              'Original AI-generated project illustration; source artwork and generation brief retained separately.',
          },
        },
      },
    });
    backgrounds.push({
      levelId: picture.levelId,
      file: path.relative(root, filename),
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      width: header.width,
      height: header.height,
    });
  }
  assert.equal(
    new Set(backgrounds.map((image) => image.sha256)).size,
    FIRST_LIGHT_PICTURES.length,
    'Each map must have its own distinct original picture.',
  );
  const checked = validatePack(pack);
  assert.equal(checked.valid, true, checked.errors.join('; '));
  const output = path.join(root, 'game/content/packs/fpv-arcade.json');
  const json = JSON.stringify(pack, null, 2) + '\n';
  let outputBytes = Buffer.byteLength(json);
  if (write) await writeFile(output, json);
  else {
    const existing = await readFile(output, 'utf8');
    assert.deepEqual(
      JSON.parse(existing),
      pack,
      'Built chapter differs from its original recipe/artwork. Run --write after reviewing the change.',
    );
    outputBytes = Buffer.byteLength(existing);
  }
  return {
    pack,
    report: {
      packId: pack.id,
      version: pack.version,
      levels: FIRST_LIGHT_PICTURES.length,
      backgrounds,
      encodedPackBytes: outputBytes,
      output: path.relative(root, output),
      validation:
        'Schema and image headers verified. Actual browser installation must fully decode all images.',
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== '--write'))
    throw new Error('Usage: node scripts/build-first-light-pack.mjs [--write]');
  console.log(
    JSON.stringify((await buildFirstLightPack({ write: args[0] === '--write' })).report, null, 2),
  );
}

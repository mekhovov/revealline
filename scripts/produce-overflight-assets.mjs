import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  OVERFLIGHT_FIELD_KIT_IDS,
  overflightFieldKitArt,
} from '../game/presentation/overflight-field-kit-art.mjs';
import { OVERFLIGHT_MOTION_PROFILE } from '../game/presentation/overflight-motion.mjs';
import { encodeSpritePNG, inspectSprite } from './produce-field-kit-sprites.mjs';
import { ASSET_SLOTS } from '../game/presentation/catalog.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const destination = resolve(root, 'authoring/library/overflight-field-kit-v1');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
export async function produceOverflightAssets({ check = false } = {}) {
  const source = 'game/presentation/overflight-field-kit-art.mjs';
  const manifest = {
    format: 'revealline-overflight-assets.v1',
    id: 'overflight-field-kit',
    revision: 1,
    status: 'source-candidate',
    source: { path: source, sha256: sha256(await readFile(resolve(root, source))) },
    motion: OVERFLIGHT_MOTION_PROFILE,
    assets: [],
  };
  const files = new Map();
  for (const slotId of OVERFLIGHT_FIELD_KIT_IDS) {
    const slot = ASSET_SLOTS.find((row) => row.id === slotId),
      pixels = overflightFieldKitArt(slotId),
      bytes = encodeSpritePNG(pixels),
      facts = inspectSprite(pixels);
    if (
      !slot ||
      !facts.opaquePixels ||
      !facts.transparentPixels ||
      facts.colors.length > 12 ||
      bytes.length > slot.budget.maxBytes
    )
      throw new Error(`Invalid Overflight asset ${slotId}.`);
    const name = `${slotId.replaceAll('.', '-')}.png`;
    files.set(name, bytes);
    manifest.assets.push({
      slotId,
      slotRevision: slot.revision,
      file: name,
      sha256: sha256(bytes),
      bytes: bytes.length,
      width: pixels.width,
      height: pixels.height,
      colors: facts.colors,
      provenance:
        'Original code-authored shared Field Kit pixels; no reference game or generated concept pixels sampled.',
    });
  }
  files.set('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
  if (!check) await mkdir(destination, { recursive: true });
  for (const [name, bytes] of files) {
    const path = resolve(destination, name);
    if (check) {
      if (!(await readFile(path)).equals(bytes))
        throw new Error(`Stale Overflight source asset: ${name}`);
    } else await writeFile(path, bytes);
  }
  return {
    destination,
    assets: manifest.assets.length,
    bytes: manifest.assets.reduce((sum, asset) => sum + asset.bytes, 0),
    status: manifest.status,
  };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  console.log(
    JSON.stringify(await produceOverflightAssets({ check: process.argv.includes('--check') })),
  );

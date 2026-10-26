/** Validate the separately downloaded character pack against its exact runtime
 * pin. It is deliberately outside the bounded base FPV package inventory. */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import {
  COMBAT_APPEARANCE_DOWNLOAD,
  COMBAT_APPEARANCE_LIMITS,
  prepareCombatAppearancePack,
} from '../optional-practice/civilian-fpv/combat-appearance.mjs';
import { ACTOR_CASTS, ACTOR_FAMILIES } from '../game/hunt/actor-catalog.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
if (!COMBAT_APPEARANCE_DOWNLOAD) throw new Error('No qualified character pack is pinned.');
const directory = path.dirname(
  fileURLToPath(
    new URL(
      COMBAT_APPEARANCE_DOWNLOAD.url,
      new URL('../optional-practice/civilian-fpv/', import.meta.url),
    ),
  ),
);
const relativeDirectory = path.relative(root, directory);
const manifestBytes = await readFile(path.join(directory, 'manifest.json'));
const manifest = JSON.parse(manifestBytes);
const assets = new Map();
for (const file of manifest.files) {
  if (file.path !== 'characters.glb') throw new Error('Unexpected character pack artifact.');
  assets.set(file.path, new Blob([await readFile(path.join(directory, file.path))]));
}
const admitted = await prepareCombatAppearancePack({
  manifestBytes,
  sha256: COMBAT_APPEARANCE_DOWNLOAD.sha256,
  assets,
});
const actual = new Set(admitted.manifest.characters.map((c) => `${c.family}/${c.cast}`));
for (const family of ACTOR_FAMILIES)
  for (const cast of ACTOR_CASTS)
    if (!actual.has(`${family.id}/${cast.id}`)) throw new Error(`Missing ${family.id}/${cast.id}`);
const bytes =
  manifestBytes.byteLength + [...assets.values()].reduce((n, value) => n + value.size, 0);
if (COMBAT_APPEARANCE_DOWNLOAD.bytes !== bytes)
  throw new Error('Download size differs from runtime pin.');
const config = JSON.parse(await readFile(path.join(root, 'game/build-config.json')));
for (const file of ['manifest.json', 'characters.glb', 'provenance.json'])
  if (!config.include.includes(`${relativeDirectory}/${file}`))
    throw new Error(`Public asset path is not included: ${file}`);
const provenance = await readFile(path.join(directory, 'provenance.json'));
const record = JSON.parse(provenance);
if (record.format !== 'FPVCharacterArtProvenance.v1')
  throw new Error('Unsupported character art provenance.');
for (const file of [...record.release.files, ...record.builders]) {
  const filename = path.resolve(directory, file.path);
  if (!filename.startsWith(directory + path.sep)) throw new Error('Invalid provenance path.');
  const content = await readFile(filename);
  if (
    content.length !== file.bytes ||
    createHash('sha256').update(content).digest('hex') !== file.sha256
  )
    throw new Error(`Provenance differs from artifact: ${file.path}`);
}
const result = {
  checkedAt: new Date().toISOString(),
  status: 'admitted-local-working-tree',
  manifestSHA256: admitted.sha256,
  provenanceSHA256: createHash('sha256').update(provenance).digest('hex'),
  families: ACTOR_FAMILIES.length,
  casts: ACTOR_CASTS.length,
  variants: actual.size,
  checkedBuilderFiles: record.builders.length,
  metrics: admitted.metrics,
  downloadWithManifest: bytes,
  limits: COMBAT_APPEARANCE_LIMITS,
  note: 'Byte/schema/resource admission. Visual, browser, GPU and lifecycle evidence is separate. No release or publication is implied.',
};
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--out'))
  throw new Error('Usage: node scripts/check-fpv-character-art.mjs [--out evidence.json]');
if (args.length) await writeFile(path.resolve(args[1]), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));

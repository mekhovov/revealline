import { readFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { boundedJSON, canonicalJSON, exactKeys, required } from '../game/data-json.mjs';
import { resolveSoundtrackCatalogue, soundtrackRights } from '../game/soundtrack.mjs';
import {
  resolveSoundtrackArchives,
  resolveSoundtrackArchiveInventory,
} from '../game/soundtrack-archive.mjs';

const manifestPath = 'authoring/library/soundtrack-archive-admissions.json';
const hash = (body) => createHash('sha256').update(body).digest('hex');

async function sourceFile(root, relative) {
  required(
    typeof relative === 'string' &&
      relative.startsWith('authoring/library/') &&
      relative.split('/').every((part) => part && part !== '.' && part !== '..') &&
      !relative.includes('\\'),
    'Archive evidence must be an ordinary source-library file.',
  );
  let target = root;
  for (const part of relative.split('/')) {
    target = path.join(target, part);
    required(
      !(await lstat(target)).isSymbolicLink(),
      'Archive evidence cannot use symbolic links.',
    );
  }
  const stat = await lstat(target);
  required(stat.isFile() && stat.size <= 512 * 1024, 'Archive evidence is missing or oversized.');
  return readFile(target);
}
const parse = (body) => boundedJSON(body.toString('utf8'), { maxBytes: 512 * 1024, maxArray: 512 });

/** Code-owned delivery pins only. This never grants rights or admits a recording:
 * every object must already pass the exact-recording publication compiler. */
export async function applySoundtrackArchiveAdmissions(root, built) {
  let manifest;
  try {
    manifest = parse(await sourceFile(root, manifestPath));
  } catch (error) {
    if (error.code === 'ENOENT') return { ...built, archives: [] };
    throw error;
  }
  exactKeys(manifest, ['format', 'archives'], 'soundtrack archive admissions');
  required(
    manifest.format === 'revealline-soundtrack-archive-admissions.v1' &&
      Array.isArray(manifest.archives) &&
      manifest.archives.length <= 32,
    'Unsupported soundtrack archive admissions.',
  );
  const catalogue = resolveSoundtrackCatalogue(built.catalogue);
  const tracks = new Map(catalogue.tracks.map((track) => [track.id, track]));
  const mapped = new Map(),
    archives = [],
    hostedInventories = new Set();
  for (const entry of manifest.archives) {
    exactKeys(
      entry,
      ['admission', 'inventory', 'verification', 'trackIds'],
      'soundtrack archive admission',
    );
    const admission = resolveSoundtrackArchives([entry.admission])[0];
    required(
      !hostedInventories.has(admission.baseURL),
      'One archive base URL can serve only one admitted inventory.',
    );
    hostedInventories.add(admission.baseURL);
    required(
      Array.isArray(entry.trackIds) &&
        entry.trackIds.length > 0 &&
        entry.trackIds.length <= 256 &&
        new Set(entry.trackIds).size === entry.trackIds.length,
      'Archive admission requires unique published recording identities.',
    );
    const inventoryBytes = await sourceFile(root, entry.inventory);
    required(
      hash(inventoryBytes) === admission.inventorySha256,
      'Archive inventory hash differs from its admission.',
    );
    const inventory = resolveSoundtrackArchiveInventory(parse(inventoryBytes), admission);
    const verification = parse(await sourceFile(root, entry.verification));
    exactKeys(
      verification,
      ['format', 'checkedAt', 'baseURL', 'inventorySha256', 'objects'],
      'archive deployment verification',
    );
    required(
      verification.format === 'revealline-soundtrack-host-verification.v1' &&
        typeof verification.checkedAt === 'string' &&
        Number.isFinite(Date.parse(verification.checkedAt)) &&
        verification.baseURL === admission.baseURL &&
        verification.inventorySha256 === admission.inventorySha256 &&
        canonicalJSON(verification.objects) === canonicalJSON(inventory.files),
      'Archive admission requires exact hosted-inventory and object verification evidence.',
    );
    const expected = new Map();
    for (const id of entry.trackIds) {
      const track = tracks.get(id);
      const rights = track && soundtrackRights(track, { catalogue });
      required(
        track &&
          !mapped.has(id) &&
          track.policy &&
          rights.redistribute === 'allowed' &&
          rights.webPlayback === 'allowed',
        'Archive admission references an unavailable or restricted recording.',
      );
      const objectPath = `objects/${track.asset.sha256}.mp3`;
      expected.set(objectPath, {
        path: objectPath,
        bytes: track.asset.bytes,
        sha256: track.asset.sha256,
      });
      mapped.set(id, { ...track, archiveId: admission.id, path: objectPath });
    }
    required(
      inventory.files.length === expected.size &&
        inventory.files.every(
          (file) => canonicalJSON(file) === canonicalJSON(expected.get(file.path)),
        ),
      'Archive inventory must contain exactly the admitted approved recording bytes.',
    );
    archives.push(admission);
  }
  const deliveredCatalogue = resolveSoundtrackCatalogue({
    ...catalogue,
    tracks: catalogue.tracks.map((track) => mapped.get(track.id) ?? track),
  });
  const localPaths = new Set(
    deliveredCatalogue.tracks.filter((track) => !track.archiveId).map((track) => track.path),
  );
  return {
    ...built,
    catalogue: deliveredCatalogue,
    archives: resolveSoundtrackArchives(archives),
    files: built.files.filter((file) => localPaths.has(file.name)),
  };
}

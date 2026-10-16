import { createHash } from 'node:crypto';

/** Refresh derived gameplay descriptors after HTML receives its offline marker.
 * Ownership, groups, originals and soundtrack identities remain unchanged. */
export function finalizeOfflineContent(entries, catalogue) {
  const byPath = new Map(entries.map((entry) => [entry.name, entry]));
  if (byPath.size !== entries.length) throw new Error('Duplicate emitted offline path.');
  const seen = new Set();
  const updates = [];
  for (const file of catalogue.files) {
    if (seen.has(file.path)) throw new Error('Duplicate offline download path.');
    seen.add(file.path);
    if (file.kind === 'soundtrack') continue;
    if (file.kind !== 'gameplay') throw new Error('Unknown offline download kind.');
    const entry = byPath.get(file.path);
    if (!entry || !Buffer.isBuffer(entry.bytes) || entry.bytes.length === 0)
      throw new Error('Offline download has no final emitted bytes: ' + file.path);
    if (file.path === 'offline-content.json')
      throw new Error('Offline catalogue cannot describe itself.');
    updates.push({
      file,
      bytes: entry.bytes.length,
      sha256: createHash('sha256').update(entry.bytes).digest('hex'),
    });
  }
  // Fail closed before changing any descriptor if a dependency is missing.
  for (const { file, bytes, sha256 } of updates) Object.assign(file, { bytes, sha256 });
  return catalogue;
}

import { createHash } from 'node:crypto';

/** Explicit, independently pinned local content packages augment an engine
 * extraction. They are not installation catalogs or unverified file copies. */
export function validateEditionContentPackages(packages, files) {
  if (!Array.isArray(packages) || packages.length > 64 || !(files instanceof Map))
    throw new TypeError('Invalid local content packages.');
  const paths = new Set(), ids = new Set();
  for (const pkg of packages) {
    if (!/^[a-z][a-z0-9-]{0,79}$/.test(pkg?.id) || ids.has(pkg.id) ||
        !Array.isArray(pkg.files) || !pkg.files.length || pkg.files.length > 4096)
      throw new TypeError('Invalid or duplicate local content package.');
    ids.add(pkg.id);
    let total = 0;
    for (const pin of pkg.files) {
      if (typeof pin?.path !== 'string' || !/^game\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+$/.test(pin.path) ||
          pin.path.split('/').some(part => part === '.' || part === '..') || paths.has(pin.path) ||
          pin.approved !== true || pin.publication !== 'public' ||
          !Number.isSafeInteger(pin.bytes) || pin.bytes < 1 || pin.bytes > 32 * 1024 * 1024 ||
          !/^[a-f0-9]{64}$/.test(pin.sha256))
        throw new TypeError('Local content requires unique approved public file pins.');
      const bytes = files.get(pin.path);
      if (!(bytes instanceof Uint8Array) || bytes.length !== pin.bytes ||
          createHash('sha256').update(bytes).digest('hex') !== pin.sha256)
        throw new TypeError(`Local content differs from its approved bytes: ${pin.path}`);
      total += bytes.length;
      if (total > 64 * 1024 * 1024) throw new RangeError('Local content package exceeds its byte budget.');
      paths.add(pin.path);
    }
  }
  return paths;
}

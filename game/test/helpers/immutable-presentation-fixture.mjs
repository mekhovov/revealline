// Opt-in Node fixture transport reuse, never a production/browser cache.
import { createHash } from 'node:crypto';
import { open, readFile } from 'node:fs/promises';
import { hrtime } from 'node:process';

const limits = Object.freeze({
  bytes: 8 * 1024 * 1024,
  entries: 256,
  pending: 8,
  asset: 1024 * 1024,
});
const assetName = /^([a-f0-9]{64})\.(?:png|jpe?g|webp)$/;
const monotonicNow = () => Number(hrtime.bigint()) / 1e6;

async function boundedRead(url, maximumBytes) {
  const file = await open(url, 'r');
  try {
    const before = await file.stat();
    if (!before.isFile() || before.size < 1 || before.size > maximumBytes)
      throw new Error('Immutable presentation fixture exceeds its file-size boundary.');
    // Bound the allocation even if the file changes after stat. The extra byte
    // detects growth; the content hash below rejects any same-size mutation.
    const bytes = Buffer.alloc(before.size + 1);
    let length = 0;
    while (length < bytes.length) {
      const result = await file.read(bytes, length, bytes.length - length, null);
      if (result.bytesRead === 0) break;
      length += result.bytesRead;
    }
    if (length !== before.size)
      throw new Error('Immutable presentation fixture changed during its first read.');
    return bytes.subarray(0, length);
  } finally {
    await file.close();
  }
}

export function createImmutablePresentationFixture({
  root = new URL('../../presentation/compiled/assets/', import.meta.url),
  maximumBytes = limits.bytes,
  maximumEntries = limits.entries,
  maximumPending = limits.pending,
  maximumAssetBytes = limits.asset,
  readAsset = boundedRead,
} = {}) {
  for (const [name, value, maximum] of [
    ['bytes', maximumBytes, limits.bytes],
    ['entries', maximumEntries, limits.entries],
    ['pending', maximumPending, limits.pending],
    ['asset', maximumAssetBytes, limits.asset],
  ])
    if (!Number.isSafeInteger(value) || value < 1 || value > maximum)
      throw new TypeError(`Invalid immutable presentation fixture ${name} bound.`);
  root = new URL(root);
  if (root.protocol !== 'file:' || !root.pathname.endsWith('/') || root.search || root.hash)
    throw new TypeError('Immutable presentation fixture needs a local directory URL.');
  const cache = new Map(),
    pending = new Map(),
    sources = [],
    worstReads = [];
  const counts = {
    requests: 0,
    hits: 0,
    joined: 0,
    reads: 0,
    failures: 0,
    uncached: 0,
    sourceRecordsDropped: 0,
  };
  let retainedBytes = 0;
  function recordRead(path, started, bytes, error) {
    const record = { path, elapsedMs: Number((monotonicNow() - started).toFixed(3)), bytes };
    if (error) record.error = String(error?.message ?? error).slice(0, 256);
    worstReads.push(record);
    worstReads.sort((a, b) => b.elapsedMs - a.elapsedMs);
    worstReads.length = Math.min(worstReads.length, 8);
  }
  return {
    async read(url) {
      url = new URL(url);
      const name = url.href.startsWith(root.href) ? url.href.slice(root.href.length) : '';
      const match = assetName.exec(name);
      // Mutable manifests and all paths outside this exact hash-named image
      // namespace retain their ordinary filesystem transport and no cache.
      if (!match) return readFile(url);
      counts.requests++;
      const cached = cache.get(name);
      if (cached) {
        counts.hits++;
        return Buffer.from(cached);
      }
      const joined = pending.get(name);
      if (joined) {
        counts.joined++;
        return Buffer.from(await joined.promise);
      }
      if (pending.size >= maximumPending) {
        counts.failures++;
        throw new Error('Immutable presentation fixture pending-read bound reached.');
      }
      const started = monotonicNow();
      counts.reads++;
      const entry = { started, promise: null };
      pending.set(name, entry);
      entry.promise = Promise.resolve().then(async () => {
        let bytes;
        try {
          const supplied = await readAsset(url, maximumAssetBytes);
          if (
            !(supplied instanceof Uint8Array) ||
            supplied.byteLength < 1 ||
            supplied.byteLength > maximumAssetBytes
          )
            throw new Error('Immutable presentation fixture exceeds its byte boundary.');
          bytes = Buffer.from(supplied);
          const sha256 = createHash('sha256').update(bytes).digest('hex');
          if (sha256 !== match[1])
            throw new Error('Immutable presentation fixture content hash mismatch.');
          const provenance = {
            name,
            bytes: bytes.length,
            sha256,
            firstReadMs: Number((monotonicNow() - started).toFixed(3)),
          };
          if (sources.length < maximumEntries) sources.push(provenance);
          else counts.sourceRecordsDropped++;
          if (cache.size < maximumEntries && retainedBytes + bytes.length <= maximumBytes) {
            cache.set(name, bytes);
            retainedBytes += bytes.length;
          } else counts.uncached++;
          recordRead(name, started, bytes.length);
          return bytes;
        } catch (error) {
          counts.failures++;
          recordRead(name, started, bytes?.length ?? 0, error);
          throw error;
        } finally {
          pending.delete(name);
        }
      });
      return Buffer.from(await entry.promise);
    },
    snapshot() {
      return {
        scope: 'Node fixture read boundary; not browser timing or physical disk I/O',
        root: root.href,
        limits: { maximumBytes, maximumEntries, maximumPending, maximumAssetBytes },
        ...counts,
        retainedBytes,
        retainedEntries: cache.size,
        pending: [...pending].map(([name, entry]) => ({
          name,
          elapsedMs: Number((monotonicNow() - entry.started).toFixed(3)),
        })),
        sources: sources.map((row) => ({ ...row })),
        worstReads: worstReads.map((row) => ({ ...row })),
      };
    },
  };
}

// Node-side evidence storage only. Every snapshot value is retained; none of
// these bounds change gameplay, timing gates or browser observation policy.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { link, lstat, mkdir, open, readdir, realpath, rename, unlink } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

const MiB = 1024 ** 2;
const FORMAT = 'SoloQualificationSnapshotStoreV1';
const REPORT_FORMAT = 'SoloQualificationReportV1';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const encode = (value) => Buffer.from(JSON.stringify(value) + '\n');
const decode = (bytes) => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
const keys = (value, expected) => assert.deepEqual(Object.keys(value).sort(), [...expected].sort());

function limits(options = {}) {
  const result = {
    maximumBytes: options.maximumBytes ?? 128 * MiB,
    maximumIndexBytes: options.maximumIndexBytes ?? 4 * MiB,
    maximumSnapshotBytes: options.maximumSnapshotBytes ?? MiB,
    maximumSnapshots: options.maximumSnapshots ?? 512,
  };
  for (const [key, maximum] of Object.entries({
    maximumBytes: 128 * MiB,
    maximumIndexBytes: 4 * MiB,
    maximumSnapshotBytes: MiB,
    maximumSnapshots: 512,
  }))
    assert(Number.isSafeInteger(result[key]) && result[key] > 0 && result[key] <= maximum, key);
  assert(result.maximumIndexBytes <= result.maximumBytes);
  assert(result.maximumSnapshotBytes <= result.maximumBytes);
  return result;
}

async function directory(path) {
  assert.equal(
    await realpath(path),
    resolve(path),
    'Evidence directory must not alias another path',
  );
  const info = await lstat(path);
  assert(info.isDirectory() && !info.isSymbolicLink(), 'Evidence directory must be ordinary');
}

async function boundedRead(path, maximum) {
  assert.equal(await realpath(path), resolve(path), 'Evidence file must not alias another path');
  const before = await lstat(path);
  assert(before.isFile() && !before.isSymbolicLink() && before.size <= maximum);
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = await file.stat();
    assert(opened.dev === before.dev && opened.ino === before.ino && opened.size === before.size);
    const buffer = Buffer.alloc(before.size + 1);
    let count = 0;
    while (count < buffer.length) {
      const part = await file.read(buffer, count, buffer.length - count, count);
      if (!part.bytesRead) break;
      count += part.bytesRead;
    }
    const after = await file.stat();
    assert.equal(count, before.size);
    assert(after.size === before.size && after.mtimeMs === before.mtimeMs);
    return buffer.subarray(0, count);
  } finally {
    await file.close();
  }
}

async function exclusiveWrite(path, bytes) {
  const file = await open(
    path,
    constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
    0o600,
  );
  try {
    await file.writeFile(bytes);
    await file.sync();
  } finally {
    await file.close();
  }
  const actual = await boundedRead(path, bytes.length);
  assert.equal(hash(actual), hash(bytes), 'Evidence write readback changed');
}

// The qualifier already treats completed snapshots as immutable. Enforce that
// boundary once, rather than reserializing every old snapshot at every save.
function freezeJSON(value, visiting = new Set()) {
  if (value === null || typeof value !== 'object') {
    assert(!['bigint', 'function', 'symbol'].includes(typeof value));
    return;
  }
  assert(!visiting.has(value), 'Snapshot must not contain a cycle');
  assert(
    Array.isArray(value) ||
      Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null,
  );
  visiting.add(value);
  for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) {
    assert(!descriptor.get && !descriptor.set, 'Snapshot accessors are not evidence values');
    freezeJSON(descriptor.value, visiting);
  }
  visiting.delete(value);
  Object.freeze(value);
}

/** Create in a fresh owned output directory. maximumBytes covers this writer's
 * final files and transient atomic copies; the caller keeps its outer row cap.
 * Reserve any sibling logs/receipts by passing a smaller maximumBytes. */
export async function createQualificationSnapshotStore(reportPath, options = {}) {
  const bound = limits(options);
  const target = resolve(reportPath),
    root = dirname(target),
    name = basename(target);
  assert(/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.json$/.test(name));
  await directory(root);
  await assert.rejects(lstat(target), { code: 'ENOENT' });
  await assert.rejects(lstat(target + '.partial'), { code: 'ENOENT' });
  const storeName = name + '.snapshots',
    store = join(root, storeName);
  await mkdir(store, { mode: 0o700 });
  await directory(store);
  const references = [],
    identities = [];
  let chunkBytes = 0,
    indexBytes = 0,
    writing = false,
    failed = false;
  let snapshotWrites = 0,
    snapshotBytesWritten = 0,
    indexWrites = 0,
    peakLogicalBytes = 0;

  return {
    metrics: () => ({
      snapshotWrites,
      snapshotBytesWritten,
      indexWrites,
      chunkBytes,
      indexBytes,
      peakLogicalBytes,
    }),
    async save(report) {
      assert(!writing && !failed, 'Snapshot store is busy or failed; no implicit retry');
      writing = true;
      try {
        assert.equal(report.format, REPORT_FORMAT);
        assert(!Object.hasOwn(report, 'snapshotStorage'));
        assert(Array.isArray(report.snapshots));
        assert(
          report.snapshots.length >= identities.length &&
            report.snapshots.length <= bound.maximumSnapshots,
        );
        for (let index = 0; index < identities.length; index++)
          assert.equal(
            report.snapshots[index],
            identities[index],
            'Published snapshots cannot be replaced or reordered',
          );
        await directory(root);
        await directory(store);
        // Include both current and prospective index budgets in admission. The
        // snapshot temporary shares an inode with its published hard link, but
        // reserve both logical paths until the temporary is removed.
        for (let index = identities.length; index < report.snapshots.length; index++) {
          const snapshot = report.snapshots[index];
          assert(snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot));
          freezeJSON(snapshot);
          const bytes = encode(snapshot);
          assert(bytes.length <= bound.maximumSnapshotBytes, 'Snapshot byte bound exceeded');
          assert(
            chunkBytes + 2 * bytes.length + indexBytes + bound.maximumIndexBytes <=
              bound.maximumBytes,
            'Snapshot store byte bound exceeded',
          );
          const file = `snapshot-${String(index).padStart(6, '0')}.json`;
          const path = join(store, file),
            temporary = path + '.partial';
          peakLogicalBytes = Math.max(peakLogicalBytes, chunkBytes + 2 * bytes.length + indexBytes);
          await exclusiveWrite(temporary, bytes);
          // link() fails if the immutable target exists; rename() would replace it.
          await link(temporary, path);
          await unlink(temporary);
          assert.equal(hash(await boundedRead(path, bound.maximumSnapshotBytes)), hash(bytes));
          references.push({ file, bytes: bytes.length, sha256: hash(bytes) });
          identities.push(snapshot);
          chunkBytes += bytes.length;
          snapshotWrites++;
          snapshotBytesWritten += bytes.length;
        }
        const snapshotStorage = {
          format: FORMAT,
          directory: storeName,
          count: references.length,
          chunks: references,
        };
        const bytes = encode({ ...report, snapshots: [], snapshotStorage });
        assert(bytes.length <= bound.maximumIndexBytes, 'Snapshot index byte bound exceeded');
        assert(
          chunkBytes + indexBytes + bytes.length <= bound.maximumBytes,
          'Snapshot store byte bound exceeded',
        );
        peakLogicalBytes = Math.max(peakLogicalBytes, chunkBytes + indexBytes + bytes.length);
        await exclusiveWrite(target + '.partial', bytes);
        await rename(target + '.partial', target);
        indexBytes = bytes.length;
        indexWrites++;
        return { snapshots: references.length, bytes: chunkBytes + indexBytes };
      } catch (error) {
        failed = true;
        throw error;
      } finally {
        writing = false;
      }
    },
  };
}

/** Read legacy inline reports or hydrate the exact snapshot values from the new
 * bounded index. Storage metadata is removed from the returned report so all
 * existing gate/resource/replay evaluators receive their original value shape. */
export async function readQualificationSnapshotReport(reportPath, options = {}) {
  const bound = limits(options);
  const target = resolve(reportPath),
    root = dirname(target);
  await directory(root);
  await assert.rejects(lstat(target + '.partial'), { code: 'ENOENT' });
  const bytes = await boundedRead(target, bound.maximumBytes);
  const report = decode(bytes);
  assert.equal(report?.format, REPORT_FORMAT);
  if (!Object.hasOwn(report, 'snapshotStorage')) return report;
  assert(bytes.length <= bound.maximumIndexBytes);
  assert.deepEqual(report.snapshots, []);
  const storage = report.snapshotStorage;
  keys(storage, ['format', 'directory', 'count', 'chunks']);
  assert.equal(storage.format, FORMAT);
  assert.equal(storage.directory, basename(target) + '.snapshots');
  assert(
    Number.isSafeInteger(storage.count) &&
      storage.count >= 0 &&
      storage.count <= bound.maximumSnapshots,
  );
  assert(Array.isArray(storage.chunks) && storage.chunks.length === storage.count);
  const store = join(root, storage.directory);
  await directory(store);
  const entries = await readdir(store, { withFileTypes: true });
  assert(entries.every((entry) => entry.isFile() && !entry.isSymbolicLink()));
  assert.deepEqual(
    entries.map((entry) => entry.name).sort(),
    storage.chunks.map((chunk) => chunk.file).sort(),
    'Missing, extra or partial snapshot chunks',
  );
  let totalBytes = bytes.length;
  const snapshots = [];
  for (let index = 0; index < storage.chunks.length; index++) {
    const chunk = storage.chunks[index];
    keys(chunk, ['file', 'bytes', 'sha256']);
    assert.equal(chunk.file, `snapshot-${String(index).padStart(6, '0')}.json`);
    assert(
      Number.isSafeInteger(chunk.bytes) &&
        chunk.bytes > 0 &&
        chunk.bytes <= bound.maximumSnapshotBytes,
    );
    assert.match(chunk.sha256, /^[a-f0-9]{64}$/);
    totalBytes += chunk.bytes;
    assert(totalBytes <= bound.maximumBytes, 'Snapshot report total byte bound exceeded');
    const value = await boundedRead(join(store, chunk.file), bound.maximumSnapshotBytes);
    assert.equal(value.length, chunk.bytes);
    assert.equal(hash(value), chunk.sha256);
    const snapshot = decode(value);
    assert(snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot));
    snapshots.push(snapshot);
  }
  delete report.snapshotStorage;
  report.snapshots = snapshots;
  return report;
}

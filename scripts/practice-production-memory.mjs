/** Test-server delivery only. Retains exact verified originals, never generated substitutes. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import path from 'node:path';
const sha = (b) => createHash('sha256').update(b).digest('hex');
export const PRODUCTION_MEMORY_MODE = 'bounded-original-memory-v1';
export const PRODUCTION_MEMORY_POLICY = Object.freeze({
  id: PRODUCTION_MEMORY_MODE,
  maxBytes: 128 * 1024 * 1024,
  textFileBytes: 8 * 1024 * 1024,
  jsonFileBytes: 512 * 1024,
  imageFileBytes: 256 * 1024,
  maxFiles: 20000,
});
export function selectProductionMemoryMode(value, productionV2) {
  if (value === undefined) return false;
  assert.equal(value, PRODUCTION_MEMORY_MODE);
  assert.equal(productionV2, true, 'Memory delivery is an explicit production-v2 observer mode.');
  return true;
}
function rank(row) {
  const e = path.posix.extname(row.path);
  if (
    ['.mjs', '.js', '.html', '.css'].includes(e) &&
    row.bytes <= PRODUCTION_MEMORY_POLICY.textFileBytes
  )
    return 0;
  if (['.json', '.webmanifest'].includes(e) && row.bytes <= PRODUCTION_MEMORY_POLICY.jsonFileBytes)
    return 1;
  if (
    ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.woff', '.woff2', '.ttf'].includes(e) &&
    row.bytes <= PRODUCTION_MEMORY_POLICY.imageFileBytes
  )
    return 2;
  return 3;
}
export function createProductionMemory(rows, receipt) {
  assert(
    Array.isArray(rows) && rows.length > 0 && rows.length <= PRODUCTION_MEMORY_POLICY.maxFiles,
  );
  const pins = new Map(),
    selected = new Map(),
    bodies = new Map(),
    delivered = new Map();
  let closed = false,
    retainedBytes = 0;
  for (const row of rows) {
    assert.deepEqual(Object.keys(row).sort(), ['bytes', 'path', 'sha256']);
    assert(
      typeof row.path === 'string' &&
        row.path.length <= 1024 &&
        !/[\\\x00-\x20%?#:]/.test(row.path),
    );
    assert(row.path.split('/').every((v) => v && !v.startsWith('.')));
    assert(Number.isSafeInteger(row.bytes) && row.bytes >= 0 && row.bytes <= 256 * 1024 * 1024);
    assert.match(row.sha256, /^[a-f0-9]{64}$/);
    assert(!pins.has(row.path));
    pins.set(row.path, Object.freeze({ ...row }));
  }
  let selectedBytes = 0;
  const order = [...pins.values()].sort(
    (a, b) => rank(a) - rank(b) || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0),
  );
  for (const p of order)
    if (rank(p) < 3 && selectedBytes + p.bytes <= PRODUCTION_MEMORY_POLICY.maxBytes) {
      selected.set(p.path, p);
      selectedBytes += p.bytes;
    }
  Object.assign(receipt, {
    policy: PRODUCTION_MEMORY_POLICY,
    selected: [...selected.values()].map((p) => ({ ...p })),
    selectedBytes,
    retainedFiles: 0,
    retainedBytes: 0,
    memoryRequests: 0,
    fileRequests: 0,
    delivered: [],
    cleared: false,
    scope:
      'Observer delivery only: private original-byte cache; full original-manifest verification before and after remains mandatory. No cold-filesystem, hosted-capacity or runtime-startup-fix claim.',
  });
  const live = () => assert(!closed, 'Original-byte memory cache already closed.');
  return {
    selected(name) {
      live();
      assert(pins.has(name), 'Unknown production member.');
      return selected.has(name);
    },
    retain(name, bytes) {
      live();
      const p = selected.get(name);
      assert(p, 'Only deterministic selected originals may be retained.');
      assert(!bodies.has(name));
      assert(Buffer.isBuffer(bytes) && bytes.length === p.bytes);
      assert.equal(sha(bytes), p.sha256);
      bodies.set(name, Buffer.from(bytes));
      retainedBytes += bytes.length;
      assert(retainedBytes <= PRODUCTION_MEMORY_POLICY.maxBytes);
      receipt.retainedFiles = bodies.size;
      receipt.retainedBytes = retainedBytes;
    },
    ready() {
      live();
      assert.equal(bodies.size, selected.size);
      assert.equal(retainedBytes, selectedBytes);
      return true;
    },
    read(name) {
      live();
      const p = pins.get(name);
      assert(p, 'Unknown production member.');
      if (!selected.has(name)) return null;
      const bytes = bodies.get(name);
      assert(bytes, 'Selected original was not verified/retained.');
      assert.equal(bytes.length, p.bytes);
      assert.equal(sha(bytes), p.sha256);
      return Buffer.from(bytes);
    },
    delivered(name, source, bytes) {
      live();
      const p = pins.get(name);
      assert(p);
      assert(['verified-memory', 'verified-original-file'].includes(source));
      assert.equal(source, selected.has(name) ? 'verified-memory' : 'verified-original-file');
      assert(Buffer.isBuffer(bytes) && bytes.length === p.bytes);
      assert.equal(sha(bytes), p.sha256);
      receipt[source === 'verified-memory' ? 'memoryRequests' : 'fileRequests']++;
      if (!delivered.has(name)) {
        const row = { ...p, source, requests: 0 };
        delivered.set(name, row);
        receipt.delivered.push(row);
      }
      delivered.get(name).requests++;
    },
    clear() {
      bodies.clear();
      closed = true;
      receipt.cleared = true;
      receipt.remainingBytes = 0;
    },
  };
}

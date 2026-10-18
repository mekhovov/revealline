// Test-only exact executed declaration authority; production hashes current tools.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
export const SHARED_OWNER_WITNESS =
  'docs/performance/fixtures/solo-shared-mode/91b-owner-declared-source.json';
const changed = new Set([
  'scripts/qualify-solo-runtime.mjs',
  'scripts/solo-qualification-shared-mode.mjs',
]);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function sharedOwnerDeclaredRefs(bytes, manifestPath, manifestBytes) {
  assert.equal(bytes.length, 2238);
  assert.equal(hash(bytes), '856b4a67d50ac682ae163509e03ac54330d21531e168c44e781f1dbc3021fe9f');
  const w = JSON.parse(bytes);
  assert.equal(w.format, 'SoloSharedOwnerDeclaredSourceV1');
  assert.equal(w.revision, '91b2a209591f1c63148d839f49d0f67c9b759a6d');
  assert.equal(w.tree, '183b79e2b15486bb65938941b07dccd96ba21fde');
  assert.equal(w.postHocExactGitReadback, true);
  assert.equal(w.records.length, 4);
  const record = w.records.find((r) => r.path === manifestPath);
  assert(record, 'Unwitnessed declaration');
  assert.equal(manifestBytes.length, record.bytes);
  assert.equal(hash(manifestBytes), record.sha256);
  const declaration = w.declarations.find((d) => d.path === manifestPath);
  assert(declaration, 'Unwitnessed helper references');
  return new Map(
    declaration.references.map((path) => {
      assert(changed.has(path));
      const r = w.records.find((r) => r.path === path);
      assert(r);
      return [path, { path, bytes: r.bytes, sha256: r.sha256 }];
    }),
  );
}
export async function assertSharedOwnerDeclaredTool(manifestPath, ref) {
  if (!changed.has(ref.path)) return false;
  const root = new URL('../', import.meta.url);
  const [w, m] = await Promise.all([
    readFile(new URL(SHARED_OWNER_WITNESS, root)),
    readFile(new URL(manifestPath, root)),
  ]);
  const refs = sharedOwnerDeclaredRefs(w, manifestPath, m);
  assert.deepEqual(ref, refs.get(ref.path), 'Exact executed helper reference required');
  return true;
}

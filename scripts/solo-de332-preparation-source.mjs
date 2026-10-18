// Test-only prior declaration source; production admission never imports this file.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
export const DE332_PREPARATION_WITNESS =
  'docs/performance/fixtures/solo-readiness-73a345/de332-declared-source.json';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function declaredPreparationRefs(bytes, manifestPath, manifestBytes) {
  assert.equal(bytes.length, 19017);
  assert.equal(sha(bytes), '49ebf625482a1c9dc4cbda1491538fbbd70ca5064e1a05325eed6bb3602b57cd');
  const value = JSON.parse(bytes);
  assert.equal(value.format, 'SoloDe332PreparationDeclaredSourceV1');
  assert.equal(value.postHocExactGitReadback, true);
  assert.equal(value.revision, '5b3aeeffc6a1c99e731d9a10cae68831a101f149');
  assert.equal(value.tree, '4072796fd4ce4bac01e692e8f689a18f1cef46e4');
  const manifest = value.declarations.find((entry) => entry.path === manifestPath);
  assert(manifest, 'Unwitnessed prior declaration');
  const refs = new Map(value.records.map((ref) => [ref.path, ref]));
  assert.equal(refs.size, value.records.length);
  assert.equal(manifestBytes.length, refs.get(manifestPath)?.bytes);
  assert.equal(sha(manifestBytes), refs.get(manifestPath)?.sha256);
  return new Map(manifest.references.map((path) => [path, refs.get(path)]));
}
export async function readDeclaredPreparationRefs(manifestPath) {
  const root = new URL('../', import.meta.url);
  const [bytes, manifest] = await Promise.all([
    readFile(new URL(DE332_PREPARATION_WITNESS, root)),
    readFile(new URL(manifestPath, root)),
  ]);
  return declaredPreparationRefs(bytes, manifestPath, manifest);
}
export const changedPreparationTools = Object.freeze([
  'scripts/solo-remote-readiness.mjs',
  'scripts/solo-qualification-readiness.mjs',
  'scripts/solo-remote-touch.mjs',
  'scripts/solo-remote-sustained.mjs',
  'scripts/solo-qualification-next-route.mjs',
  'scripts/qualify-solo-runtime.mjs',
  'scripts/run-solo-remote-correctness.mjs',
  'scripts/solo-qualification.mjs',
  'scripts/solo-qualification-hitch-journal.mjs',
  'scripts/solo-remote-diagnostics.mjs',
]);

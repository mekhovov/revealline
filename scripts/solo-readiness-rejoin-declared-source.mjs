// Test-only immutable declaration readback. Production never imports this file.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
export const READINESS_REJOIN_WITNESS =
  'docs/performance/fixtures/solo-readiness-797e03/9aaf-declared-tooling-source.json';
export const changedReadinessTools = Object.freeze([
  'scripts/qualify-solo-runtime.mjs',
  'scripts/solo-qualification-readiness.mjs',
  'scripts/solo-remote-readiness.mjs',
  'scripts/solo-qualification-cpu-profile.mjs',
  'scripts/solo-remote-cpu-profile.mjs',
]);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function declaredReadinessToolRefs(bytes, manifestPath, manifestBytes) {
  assert.equal(bytes.length, 23983);
  assert.equal(sha(bytes), '5626a41e29c66ebad2e45ac1ebff4b6c943ec7370838697b3e3dff136401965e');
  const witness = JSON.parse(bytes);
  assert.equal(witness.format, 'SoloReadinessChangedToolDeclaredSourceV1');
  assert.equal(witness.postHocExactGitReadback, true);
  assert.equal(witness.revision, '9aaf4ea6ee9ebe23821552e59851f2e3e817a15b');
  assert.equal(witness.tree, '7e64a66f9eb309b692719b163ca00fbe78146ad5');
  assert.equal(witness.records.length, 39);
  const record = witness.records.find(
    (row) =>
      row.path === manifestPath &&
      row.bytes === manifestBytes.length &&
      row.sha256 === sha(manifestBytes),
  );
  assert(record, 'Unwitnessed or changed declaration');
  const declaration = witness.declarations.find(
    (row) => row.path === manifestPath && row.revision === record.revision,
  );
  assert(declaration, 'Declaration source is not witnessed');
  const refs = new Map();
  for (const path of declaration.references) {
    assert(changedReadinessTools.includes(path));
    const source = witness.records.find(
      (row) => row.path === path && row.revision === witness.revision,
    );
    assert(source, path);
    refs.set(path, { path, bytes: source.bytes, sha256: source.sha256 });
  }
  assert.equal(refs.size, declaration.references.length);
  return refs;
}
export async function assertDeclaredReadinessTool(manifestPath, ref) {
  if (!changedReadinessTools.includes(ref.path)) return false;
  const root = new URL('../', import.meta.url);
  const [witness, manifest] = await Promise.all([
    readFile(new URL(READINESS_REJOIN_WITNESS, root)),
    readFile(new URL(manifestPath, root)),
  ]);
  const declared = declaredReadinessToolRefs(witness, manifestPath, manifest);
  assert.deepEqual(ref, declared.get(ref.path), 'Exact historical helper reference required');
  return true;
}

// Only pure adapter controls use this modeled current-tool clone. The saved
// declaration and the production stale-input refusal remain unchanged.
export async function modelCurrentReadinessTools(manifestPath, plan) {
  const modeled = structuredClone(plan);
  for (const key of ['adapterInputs', 'frozenTools', 'runtimeRefs']) {
    for (const ref of modeled[key] ?? []) {
      if (!(await assertDeclaredReadinessTool(manifestPath, ref))) continue;
      const bytes = await readFile(new URL('../' + ref.path, import.meta.url));
      ref.bytes = bytes.length;
      ref.sha256 = sha(bytes);
    }
  }
  return modeled;
}

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
  if (await readDeclaredPreHeapTool(manifestPath, ref)) return true;
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

// Test-only readback for the exact tools changed by heap observation. Older
// witnesses remain byte-for-byte independent; this grants no native admission.
export const PRE_HEAP_TOOLING_WITNESS =
  'docs/performance/fixtures/solo-heap-retainers/4d28-declared-tooling-source.json';
function preHeapWitness(bytes) {
  assert.equal(bytes.length, 244528);
  assert.equal(sha(bytes), 'a9340d90751a357745895fc399bed951d8c01bb57b5d8a2c545b5bfe061092cf');
  const witness = JSON.parse(bytes);
  assert.equal(witness.format, 'SoloPreHeapDeclaredToolingSourceV1');
  assert.equal(witness.status, 'immutable-source-only-no-observation-or-native-admission');
  assert.equal(witness.revision, '4d28eb409e45a3db3b26ce4ec7a64437e5929a95');
  assert.equal(witness.tree, '4bd51f0d0b846063e030372d6873ca029852e697');
  assert.equal(witness.declarations.length, 27);
  assert.equal(witness.sources.length, 2);
  for (const record of witness.sources) {
    const body = Buffer.from(record.content);
    assert.equal(body.length, record.bytes);
    assert.equal(sha(body), record.sha256);
  }
  return witness;
}
function preHeapDeclaration(witness, manifestPath, manifestBytes) {
  const declaration = witness.declarations.find((row) => row.path === manifestPath);
  assert(declaration, 'Unwitnessed pre-heap declaration');
  assert.equal(manifestBytes.length, declaration.bytes, 'Changed pre-heap declaration');
  assert.equal(sha(manifestBytes), declaration.sha256, 'Changed pre-heap declaration');
  return declaration;
}
export function declaredPreHeapToolSource(bytes, manifestPath, manifestBytes, ref) {
  const witness = preHeapWitness(bytes);
  const declaration = preHeapDeclaration(witness, manifestPath, manifestBytes);
  const declared = declaration.references.find((row) => row.path === ref.path);
  assert(declared, 'Tool not witnessed for this exact declaration');
  assert.deepEqual(ref, declared, 'Exact pre-heap helper reference required');
  const source = witness.sources.find((row) => row.path === ref.path);
  assert(source, 'Missing pre-heap tool source');
  assert.equal(source.bytes, declared.bytes);
  assert.equal(source.sha256, declared.sha256);
  return Buffer.from(source.content);
}
export async function readDeclaredPreHeapTool(manifestPath, ref) {
  if (!['scripts/qualify-solo-runtime.mjs', 'scripts/solo-remote-sustained.mjs'].includes(ref.path))
    return null;
  const root = new URL('../', import.meta.url);
  const bytes = await readFile(new URL(PRE_HEAP_TOOLING_WITNESS, root));
  const witness = preHeapWitness(bytes);
  const declaration = witness.declarations.find((row) => row.path === manifestPath);
  // Existing older qualifier and sustained identities keep their own witnesses.
  if (!declaration?.references.some((row) => row.path === ref.path)) return null;
  return declaredPreHeapToolSource(
    bytes,
    manifestPath,
    await readFile(new URL(manifestPath, root)),
    ref,
  );
}
export function preHeapTraceWorkflow(bytes, manifestPath, manifestBytes) {
  const witness = preHeapWitness(bytes);
  assert.equal(manifestPath, 'docs/performance/solo-browser-frame-trace-9d-tasks-plan.json');
  preHeapDeclaration(witness, manifestPath, manifestBytes);
  const retained = witness.traceWorkflow;
  assert.equal(retained.path, '.github/workflows/solo-native-package-consumer.yml');
  assert.equal(retained.job, 'hud-cpu');
  const excerpt = Buffer.from(retained.excerpt);
  assert.equal(excerpt.length, retained.excerptIdentity.bytes);
  assert.equal(sha(excerpt), retained.excerptIdentity.sha256);
  return excerpt;
}

// Test-only exact historical readback. Production never imports this module.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export const OVERHEAD_DECLARED_WITNESS =
  'docs/performance/fixtures/solo-overhead-acceptance/237b-declared-source.json';
const changedTools = [
  'scripts/qualify-solo-diagnostics.mjs',
  'scripts/solo-remote-diagnostics.mjs',
];
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function declaredOverheadTool(bytes, manifestPath, manifestBytes, ref) {
  assert.equal(bytes.length, 58143);
  assert.equal(sha(bytes), '053b815fbc0b0936a756b3b447f94e47f834220eb45ca3cffb7df8b11dfbef9a');
  const witness = JSON.parse(bytes);
  assert.equal(witness.format, 'SoloOverheadDeclaredSourceV1');
  assert.equal(witness.postHocExactGitReadback, true);
  assert.equal(witness.sourceRevision, '237b405437def3c41b01165fe057af1ab06f618c');
  assert.equal(witness.sourceTree, '4df53e4ad3993bbcfc881fddd7b24b090faff3cc');
  assert.equal(witness.declarations.length, 10);
  assert.equal(witness.sources.length, 2);
  const declaration = witness.declarations.find((entry) => entry.path === manifestPath);
  assert(declaration, 'Unwitnessed overhead declaration');
  assert.equal(manifestBytes.length, declaration.bytes, 'Changed overhead declaration');
  assert.equal(sha(manifestBytes), declaration.sha256, 'Changed overhead declaration');
  const declared = declaration.references.find((entry) => entry.path === ref.path);
  assert(declared && changedTools.includes(ref.path), 'Unwitnessed historical overhead tool');
  assert.deepEqual(ref, declared, 'Exact historical overhead reference required');
  const source = witness.sources.find((entry) => entry.path === ref.path);
  const content = Buffer.from(source.content);
  assert.equal(content.length, declared.bytes);
  assert.equal(sha(content), declared.sha256);
  assert.equal(
    createHash('sha1')
      .update('blob ' + content.length + '\0')
      .update(content)
      .digest('hex'),
    source.gitBlob,
  );
  return content;
}

export async function assertDeclaredOverheadTool(manifestPath, ref) {
  if (!changedTools.includes(ref.path)) return false;
  const root = new URL('../', import.meta.url);
  const [witness, manifest] = await Promise.all([
    readFile(new URL(OVERHEAD_DECLARED_WITNESS, root)),
    readFile(new URL(manifestPath, root)),
  ]);
  declaredOverheadTool(witness, manifestPath, manifest, ref);
  return true;
}

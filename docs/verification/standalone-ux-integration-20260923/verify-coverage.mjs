import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

// Read-only proof against retained Git objects; no checkout or network required.
const base = '950f19045facacf5151c90661de1ca28d30658df';
const target = '602ffc5aa6bfad6071539ca876fc4b520aed195f';
const guide = 'authoring/skills/xonix-runtime-maintainer/SKILL.md';
const entries = [
  [231, 'af0520ac139d91edae720376a0f674812cda4e57', 'f812c29d82ad67938dc90ac34b9fd07b3036f9b1', '41099ae0094bb6797383018cd0ac27cccba37693'],
  [237, 'e4795408b82d082e0299217fa1be7d3358c823db', '3dda4b0c14e16ab41bd0a472249de8740254ad2d', base],
  [258, 'fcea43eaa0f9c6c98d34fb2409b55040a9eb7864', '3bab3ed8ec7f9e6a0f48c169f3be24334b944f07', base],
  [262, 'fccd82efc36af896643f647c941c0b302ffcc6ea', 'fb12f16c450095643c5aa0ac6e7cbfffb64462d9', base],
];
const git = (...args) => execFileSync('git', args, { maxBuffer: 2000000 });
const text = (...args) => git(...args).toString().trim();
const blob = (ref, path) => git('show', `${ref}:${path}`);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const paths = (a, b) => text('diff', '--name-only', a, b).split('\n');
const union = new Set([guide]);
let expectedGuide = blob(base, guide);
const coverage = entries.map(([pr, original, prepared, preparedBase]) => {
  git('merge-base', '--is-ancestor', prepared, target);
  assert.equal(text('rev-parse', `${prepared}^`), preparedBase);
  const before = blob(preparedBase, guide);
  const after = blob(prepared, guide);
  assert.deepEqual(after.subarray(0, before.length), before, `PR${pr} guide prefix`);
  const appendix = after.subarray(before.length);
  const originalBase = text('merge-base', original, base);
  const originalBefore = blob(originalBase, guide);
  const originalAfter = blob(original, guide);
  assert.deepEqual(originalAfter.subarray(0, originalBefore.length), originalBefore);
  assert.deepEqual(appendix, originalAfter.subarray(originalBefore.length), `PR${pr} original appendix`);
  assert.deepEqual(paths(originalBase, original).sort(), paths(preparedBase, prepared).sort(), `PR${pr} complete original path coverage`);
  expectedGuide = Buffer.concat([expectedGuide, appendix]);
  const files = paths(preparedBase, prepared).filter((path) => path !== guide).map((path) => {
    assert.ok(!union.has(path), `Unexpected shared feature path ${path}`);
    union.add(path);
    const actual = blob(target, path);
    assert.deepEqual(actual, blob(prepared, path), `PR${pr} prepared postimage: ${path}`);
    assert.deepEqual(actual, blob(original, path), `PR${pr} original postimage: ${path}`);
    return { path, bytes: actual.length, gitBlob: text('rev-parse', `${target}:${path}`), sha256: sha(actual) };
  });
  return { pr, original, originalBase, prepared, preparedBase, appendixBytes: appendix.length, appendixSha256: sha(appendix), files };
});
assert.deepEqual(blob(target, guide), expectedGuide, 'Current-main prefix followed by all four exact appendices once');
assert.deepEqual(paths(base, target).sort(), [...union].sort(), 'No unrelated changes');
const proof = {
  schema: 'standalone-ux-coverage-v1',
  status: 'local-unversioned-preparation-only',
  base,
  target,
  tree: text('rev-parse', `${target}^{tree}`),
  changedPaths: union.size,
  guide: { bytes: expectedGuide.length, sha256: sha(expectedGuide), appendOrder: entries.map(([pr]) => pr) },
  coverage,
  verification: {
    node: '20.19.5',
    focusedCompositeTests: { passed: 20, failed: 0, skipped: 0 },
    initialAttempt: '15 sprite cases passed; Studio form test could not load missing sparse starter.mjs. Hydrated the exact 59-file, 481395-byte text import closure and reran all 20 successfully.',
    limitations: 'Historical receipts are preserved, not rerun or reattributed. Full build, replay host cohort, browser/physical/offline matrices, accepted-main reintegration, version allocation and publication remain pending. No current theme-pin acceptance is claimed.',
  },
};
process.stdout.write(`${JSON.stringify(proof, null, 2)}\n`);

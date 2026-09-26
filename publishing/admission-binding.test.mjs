import assert from 'node:assert/strict';
import test from 'node:test';
import { admissionBinding, sameAdmission, canonicalVersionOnly } from './admission-binding.mjs';

const head = '1'.repeat(40),
  base = '2'.repeat(40),
  policyDigest = '3'.repeat(64);
const pull = {
  title: '[Target v1.2.3] Navigation',
  head: { sha: head },
  base: { sha: base },
  milestone: { number: 1, title: 'v1.2.3' },
  labels: [],
  body: 'Depends on #12',
};
const options = { workflowRevision: base, policyDigest, paths: ['game/app.mjs'] };
test('admission is bound to source, metadata, dependencies and policy', () => {
  const receipt = admissionBinding(pull, options);
  assert.equal(sameAdmission(receipt, pull, policyDigest), true);
  for (const change of [
    { title: 'Release v1.2.3' },
    { head: { sha: base } },
    { base: { sha: head } },
    { milestone: { number: 2, title: 'v1.2.3' } },
    { body: 'Depends on #13' },
    { labels: [{ name: 'hold: review' }] },
    { labels: [{ name: 'fastline-approved' }] },
  ]) {
    assert.equal(sameAdmission(receipt, { ...pull, ...change }, policyDigest), false);
  }
  assert.equal(sameAdmission(receipt, pull, '4'.repeat(64)), false);
  assert.equal(sameAdmission({}, pull, policyDigest), false);
});
test('draft promotion and irrelevant metadata do not change source admission', () => {
  const receipt = admissionBinding(pull, options);
  assert.equal(
    sameAdmission(
      receipt,
      { ...pull, draft: false, labels: [{ name: 'documentation' }] },
      policyDigest,
    ),
    true,
  );
});
test('only the four canonical values constitute a version-only diff', () => {
  const before = {
    'package.json': { version: '1.0.0', dependencies: { x: '1' } },
    'package-lock.json': { version: '1.0.0', packages: { '': { version: '1.0.0' } } },
    'game/build-config.json': { version: '1.0.0' },
  };
  const after = JSON.parse(JSON.stringify(before).replaceAll('1.0.0', '1.0.1'));
  const paths = Object.keys(before);
  assert.equal(canonicalVersionOnly(before, after, paths), true);
  assert.equal(canonicalVersionOnly(before, after, [...paths, 'game/app.mjs']), false);
  after['package.json'].dependencies.x = '2';
  assert.equal(canonicalVersionOnly(before, after, paths), false);
});

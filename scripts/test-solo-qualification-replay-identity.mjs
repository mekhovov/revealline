import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createQualificationReplayIdentity } from './solo-qualification-replay-identity.mjs';
import { validateQualification } from './solo-qualification.mjs';

const recipe = JSON.parse(
  await readFile(
    new URL(
      '../docs/performance/fixtures/solo-remote-sustained/long29.qualification.fixture',
      import.meta.url,
    ),
  ),
);
test('two exact public exports retain only bounded scalar identities', () => {
  const witness = createQualificationReplayIdentity();
  witness.observe('{"ticks":208800}');
  assert.equal(witness.report.status, 'pending');
  witness.observe('{"ticks":208800}');
  assert.equal(witness.finish().status, 'pass');
  assert.deepEqual(Object.keys(witness.report.observations[0]), ['bytes', 'sha256']);
});
test('same-length changed checkpoint bytes fail irreversibly', () => {
  const witness = createQualificationReplayIdentity();
  witness.observe('{"tick":1}');
  assert.throws(() => witness.observe('{"tick":2}'), /changed/);
  assert.equal(witness.report.status, 'failed');
  assert.throws(() => witness.finish());
});
test('missing or extra exports and oversized or non-text values fail closed', () => {
  const single = createQualificationReplayIdentity();
  single.observe('x');
  assert.throws(() => single.finish());
  const extra = createQualificationReplayIdentity();
  extra.observe('x');
  extra.observe('x');
  assert.throws(() => extra.observe('x'), /cap/);
  assert.throws(() => extra.finish());
  for (const value of ['', null, {}, 'x'.repeat(32 * 1024 ** 2 + 1)])
    assert.throws(() => createQualificationReplayIdentity().observe(value));
});
test('public whitespace remains exact identity rather than normalized or checkpoint-only equality', () => {
  const witness = createQualificationReplayIdentity();
  witness.observe('{"x":1}');
  assert.throws(() => witness.observe('{ "x":1}'), /changed/);
});
test('schema admits exactly two separated top-level exports with one reload', () => {
  assert.equal(
    validateQualification(structuredClone(recipe)).replayIdentity,
    'exact-public-bytes-pair',
  );
  for (const change of [
    (r) => (r.replayIdentity = 'permissive'),
    (r) =>
      r.actions.splice(
        r.actions.findIndex((a) => a.type === 'reload'),
        1,
      ),
    (r) => r.actions.push({ type: 'exportReplay' }),
    (r) => r.actions.find((a) => a.type === 'repeat').actions.push({ type: 'exportReplay' }),
    (r) => r.actions.find((a) => a.type === 'repeat').actions.push({ type: 'reload' }),
  ]) {
    const r = structuredClone(recipe);
    change(r);
    assert.throws(() => validateQualification(r));
  }
});
test('original scenarios without identity retain existing schema semantics', () => {
  const r = structuredClone(recipe);
  delete r.replayIdentity;
  r.actions = r.actions.slice(
    0,
    r.actions.findIndex((a) => a.type === 'reload'),
  );
  assert.equal(validateQualification(r), r);
});

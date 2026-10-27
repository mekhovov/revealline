import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  SOURCE_VERIFIER_DYNAMIC_ROOTS,
  sourceVerifierSmoke,
} from './solo-source-verifier-smoke.mjs';

async function parent(t) {
  const path = await mkdtemp(join(tmpdir(), 'solo-verifier-contract-'));
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
}
test('actual full source verifier admits small projected fixture through every configured dynamic validation branch', async (t) => {
  const result = await sourceVerifierSmoke(await parent(t));
  assert.equal(result.exitCode, 0, JSON.stringify(result));
  assert.equal(result.report.status, 'passed');
  assert.equal(result.report.failures.length, 0);
  assert.equal(result.report.runtimeSourcesCompared, 5);
  assert.equal(result.report.references.valid, true);
  assert.equal(result.report.generatedRouteDescriptors, 1);
  assert.equal(result.report.workerClosureContract, 'required-in-source');
  assert.equal(result.report.offline.coreFiles, 4);
  assert.equal(result.report.source.dirty, false);
  assert(result.report.source.declaredRevisionIsAncestor);
});
for (const omitImport of SOURCE_VERIFIER_DYNAMIC_ROOTS)
  test(`actual verifier fails closed when ${omitImport} is absent`, async (t) => {
    const path = await parent(t);
    await mkdir(join(path, 'negative'));
    const result = await sourceVerifierSmoke(join(path, 'negative'), { omitImport });
    assert.equal(result.exitCode, 1);
    assert.equal(result.report.status, 'failed');
    assert(
      result.report.failures.some((row) => row.reason.includes(omitImport)),
      JSON.stringify(result),
    );
  });

test('synthetic repository ignores inherited Git repositories, global settings and templates', async (t) => {
  const names = [
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_CONFIG_GLOBAL',
    'GIT_TEMPLATE_DIR',
    'GIT_CONFIG_COUNT',
  ];
  const before = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    for (const name of names)
      process.env[name] = name === 'GIT_CONFIG_COUNT' ? 'invalid-count' : '/not-a-fixture-owner';
    const result = await sourceVerifierSmoke(await parent(t));
    assert.equal(result.exitCode, 0, JSON.stringify(result));
    assert.equal(result.report.source.dirty, false);
  } finally {
    for (const name of names)
      if (before[name] === undefined) delete process.env[name];
      else process.env[name] = before[name];
  }
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  declaredOverheadTool,
  OVERHEAD_DECLARED_WITNESS,
} from './solo-overhead-declared-source.mjs';
import {
  assessEmpiricalClockOverhead,
  EMPIRICAL_CLOCK_ASSESSMENT,
  EMPIRICAL_CLOCK_LIMITATION,
} from './solo-overhead-acceptance.mjs';
// Execute the existing real analyzer, CLI and adapter fixtures in this source lane.
import './test-solo-diagnostics-analysis.mjs';
import './test-solo-journal-cost-analysis.mjs';
import './test-solo-remote-diagnostics.mjs';
import './test-solo-journal-cost-admission.mjs';
import './test-solo-native-consumer-overhead.mjs';

test('empirical acceptance preserves every conditional verdict and refuses self-asserted trust', () => {
  for (const status of [
    'pass',
    'fail',
    'pass-scoped-envelope',
    'fail-scoped-envelope',
    'unresolved',
  ]) {
    const arithmetic = {
      status,
      limit: 0.05,
      reasons: ['retained reason'],
      interval: { lower95: 0.001, upper95: 0.002 },
      unconditionalClockGuarantee: true,
      trustedClockBound: true,
    };
    const original = structuredClone(arithmetic);
    const assessed = assessEmpiricalClockOverhead(arithmetic);
    assert.equal(assessed.status, 'unresolved');
    assert.equal(assessed.conditionalStatus, status);
    assert.deepEqual(assessed.qualificationAssessment, {
      format: EMPIRICAL_CLOCK_ASSESSMENT,
      eligible: false,
      clockEvidence: 'empirical-minimum-step-only',
    });
    assert.deepEqual(assessed.interval, arithmetic.interval);
    assert.deepEqual(assessed.reasons, ['retained reason', EMPIRICAL_CLOCK_LIMITATION]);
    assert.deepEqual(arithmetic, original);
  }
});

test('malformed conditional analyses cannot be accepted or change the five-percent limit', () => {
  for (const value of [
    null,
    { status: 'qualified', limit: 0.05, reasons: [] },
    { status: 'pass', limit: 0.1, reasons: [] },
    { status: 'pass', limit: 0.05, reasons: null },
  ])
    assert.throws(() => assessEmpiricalClockOverhead(value));
});

test('all ten immutable declarations bind the exact retained overhead source bodies', async () => {
  const root = new URL('../', import.meta.url);
  const bytes = await readFile(new URL(OVERHEAD_DECLARED_WITNESS, root));
  const witness = JSON.parse(bytes);
  assert.equal(witness.declarations.length, 10);
  let references = 0;
  for (const declaration of witness.declarations) {
    const manifest = await readFile(new URL(declaration.path, root));
    for (const ref of declaration.references) {
      const source = declaredOverheadTool(bytes, declaration.path, manifest, ref);
      assert.equal(source.length, ref.bytes);
      references++;
    }
  }
  assert.equal(references, 14);
});

test('changed witness, declaration, path and reference cannot use historical overhead readback', async () => {
  const root = new URL('../', import.meta.url);
  const bytes = await readFile(new URL(OVERHEAD_DECLARED_WITNESS, root));
  const declaration = JSON.parse(bytes).declarations[0];
  const manifest = await readFile(new URL(declaration.path, root));
  const ref = declaration.references[0];
  assert.throws(() =>
    declaredOverheadTool(
      Buffer.concat([bytes, Buffer.from('\n')]),
      declaration.path,
      manifest,
      ref,
    ),
  );
  assert.throws(() =>
    declaredOverheadTool(
      bytes,
      declaration.path,
      Buffer.concat([manifest, Buffer.from('\n')]),
      ref,
    ),
  );
  assert.throws(() =>
    declaredOverheadTool(bytes, 'docs/performance/unwitnessed.json', manifest, ref),
  );
  for (const changed of [
    { ...ref, bytes: ref.bytes + 1 },
    { ...ref, sha256: '0'.repeat(64) },
    { ...ref, path: 'scripts/solo-overhead-acceptance.mjs' },
  ])
    assert.throws(() => declaredOverheadTool(bytes, declaration.path, manifest, changed));
});

test('historical witnesses never enter the current production acceptance or setup modules', async () => {
  for (const path of [
    './solo-overhead-acceptance.mjs',
    './solo-remote-diagnostics.mjs',
    './qualify-solo-diagnostics.mjs',
  ]) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    assert(!source.includes('solo-overhead-declared-source'));
    assert(!source.includes(OVERHEAD_DECLARED_WITNESS));
  }
});

test('every live sparse owner retains runtime and test-only historical overhead dependencies', async () => {
  const workflow = await readFile(
    new URL('../.github/workflows/solo-native-package-consumer.yml', import.meta.url),
    'utf8',
  );
  const requirements = new Map();
  for (const job of [
    'readiness',
    'touch',
    'hud-cpu',
    'app-overhead',
    'journal-cost',
    'timing',
    'lifecycle',
  ])
    requirements.set(job, ['scripts/solo-overhead-acceptance.mjs']);
  for (const job of [
    'app-overhead',
    'journal-cost',
    'timing',
    'lifecycle',
    'replay-portability-source',
  ])
    requirements.set(job, [
      ...(requirements.get(job) ?? []),
      'scripts/solo-overhead-declared-source.mjs',
      OVERHEAD_DECLARED_WITNESS,
    ]);
  const check = (text, job, required) => {
    const body = text.split('\n  ' + job + ':\n')[1]?.split(/\n  [A-Za-z_][A-Za-z0-9_-]*:\n/)[0];
    assert(body, 'Missing live owner ' + job);
    const paths = [...body.matchAll(/^            \/(.+)$/gm)].map((match) => match[1]);
    assert.equal(paths.length, new Set(paths).size);
    for (const path of required) assert(paths.includes(path), job + ': missing ' + path);
  };
  for (const [job, required] of requirements) {
    check(workflow, job, required);
    const marker = '\n  ' + job + ':\n';
    const start = workflow.indexOf(marker);
    assert(start >= 0);
    const body = workflow.slice(start).split(/\n  [A-Za-z_][A-Za-z0-9_-]*:\n/)[1];
    for (const path of required) {
      const missing = body.replace('            /' + path + '\n', '');
      assert.notEqual(body, missing);
      const changed = workflow.slice(0, start) + workflow.slice(start).replace(body, missing);
      assert.throws(() => check(changed, job, required), /missing/);
    }
  }
});

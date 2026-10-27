import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  COMPARISON_SETUP_DYNAMIC_ROOTS,
  comparisonSetupSuccessor,
  timingMatrix,
  sustainedMatrix,
} from './solo-remote-sustained.mjs';
import { assertFinalWaveBindings } from './solo-final-wave-witness.mjs';

const root = new URL('../', import.meta.url);
const phases = ['cold-first30', 'warm-first30', 'sentry', 'long-rail', 'soak'];
const paths = (phase) => {
  const name = phase === 'soak' ? phase : `timing-${phase}`;
  return {
    manifest: `docs/performance/solo-final-${name}-plan.json`,
    workflow: `.github/workflows/solo-remote-final-${name}-temporary.yml`,
  };
};
const read = (path) => readFile(new URL(path, root));
const matrix = (m) => (m.phase === 'soak' ? sustainedMatrix(m) : timingMatrix(m));
async function successor(phase) {
  const m = JSON.parse(await read(paths(phase).manifest));
  m.setupSuccessor = comparisonSetupSuccessor(phase);
  m.release.onceOnlyBefore = 'a7e0219818842f02399317ca6d2a14bdd506da3d';
  for (const path of COMPARISON_SETUP_DYNAMIC_ROOTS) {
    const bytes = await read(path);
    m.frozenTools.push({
      path,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  }
  return m;
}

test('five setup successors bind exact witnessed declarations and retain original matrices', async () => {
  for (const phase of phases) {
    const files = paths(phase),
      originalBytes = await read(files.manifest);
    const old = JSON.parse(originalBytes),
      m = await successor(phase);
    const prior = m.setupSuccessor.originalDeclaration;
    assert.equal(prior.path, files.manifest);
    assert.equal(prior.bytes, originalBytes.length);
    assert.equal(prior.sha256, createHash('sha256').update(originalBytes).digest('hex'));
    await assertFinalWaveBindings(
      files.manifest,
      [...old.frozenTools, ...old.adapterInputs, ...Object.values(old.recipes)],
      files.workflow,
    );
    assert.deepEqual(matrix(m), matrix(old));
    assert.equal(m.setupSuccessor.priorConclusion, phase === 'soak' ? 'cancelled' : 'failure');
    assert.equal(m.setupSuccessor.priorNativeObservations, 0);
    assert.equal(m.release.firstEightAllCorrectnessPassed, false);
    assert.equal(m.performanceExclusion, true);
  }
});

test('setup admission rejects changed historical evidence, source, edge, gate and missing validators', async () => {
  for (const phase of phases) {
    const original = await successor(phase);
    for (const mutate of [
      (m) => m.setupSuccessor.priorRun++,
      (m) => {
        m.setupSuccessor.priorConclusion = 'success';
      },
      (m) => {
        m.setupSuccessor.priorNativeObservations = 1;
      },
      (m) => {
        m.setupSuccessor.originalDeclaration.sha256 = '0'.repeat(64);
      },
      (m) => {
        m.setupSuccessor.originalDeclaration.bytes++;
      },
      (m) => {
        m.setupSuccessor.originalDeclaration.path = paths(
          phase === 'soak' ? 'sentry' : 'soak',
        ).manifest;
      },
      (m) => {
        m.setupSuccessor.runtimeChanged = true;
      },
      (m) => {
        m.setupSuccessor.scenarioChanged = true;
      },
      (m) => {
        m.setupSuccessor.gateChanged = true;
      },
      (m) => {
        m.setupSuccessor.automaticRetries = 1;
      },
      (m) => {
        m.setupSuccessor.unreviewed = true;
      },
      (m) => {
        m.release.onceOnlyBefore = m.candidate.revision;
      },
      (m) => {
        delete m.release.onceOnlyBefore;
      },
      (m) => {
        m.release.firstEightAllCorrectnessPassed = true;
      },
      (m) => {
        m.candidate.tree = '0'.repeat(40);
      },
      (m) => {
        m.sourceCohort = 'cold-main8b-candidatecce';
      },
      ...COMPARISON_SETUP_DYNAMIC_ROOTS.map((path) => (m) => {
        m.frozenTools = m.frozenTools.filter((ref) => ref.path !== path);
      }),
    ]) {
      const m = structuredClone(original);
      mutate(m);
      assert.throws(() => matrix(m));
    }
  }
  for (const phase of ['next', 'retry', 'long29', 'diagnostics', '__proto__'])
    assert.throws(() => comparisonSetupSuccessor(phase));
});

test('actual isolated three-module CLI admits the exact setup successor without a full checkout', async (t) => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'solo-setup-successor-')));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'scripts'));
  for (const name of [
    'solo-remote-sustained.mjs',
    'solo-qualification.mjs',
    'solo-qualification-observation.mjs',
  ])
    await writeFile(join(directory, 'scripts', name), await read(`scripts/${name}`));
  for (const phase of phases) {
    const plan = await successor(phase),
      path = join(directory, 'plan.json');
    await writeFile(path, JSON.stringify(plan));
    const result = execFileSync(
      process.execPath,
      [
        join(directory, 'scripts/solo-remote-sustained.mjs'),
        phase === 'soak' ? 'matrix-plan' : 'timing-matrix-plan',
        path,
      ],
      { cwd: directory, encoding: 'utf8', timeout: 5000, maxBuffer: 65536 },
    );
    assert.equal(result, `matrix=${JSON.stringify(matrix(plan))}\n`);
  }
});

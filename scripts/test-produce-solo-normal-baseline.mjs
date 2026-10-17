import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  finalizeNormalBaselineEvidence,
  normalBaselineStages,
  requireProducerSource,
  validateNormalBaselineProducer,
} from './produce-solo-normal-baseline.mjs';
const manifest = JSON.parse(
  await readFile(
    new URL('../docs/performance/solo-normal-baseline-8b019-plan.json', import.meta.url),
  ),
);

test('producer declares exactly latest main, no browser/candidate, bounded owner stages and no retry', () => {
  assert.equal(validateNormalBaselineProducer(manifest), manifest);
  for (const mutate of [
    (x) => {
      x.baseline.revision = 'b11745223861c3973ad4bf440cc536198b8e0371';
    },
    (x) => {
      x.baseline.tree = '0'.repeat(40);
    },
    (x) => {
      x.baseline.reusableArtifact = {};
    },
    (x) => {
      x.baseline.publisher.workflow = '.github/workflows/publish-main-pages.yml';
    },
    (x) => {
      x.candidate = {};
    },
    (x) => {
      x.rows = [];
    },
    (x) => {
      x.playwright = '1.62.1';
    },
    (x) => {
      x.release.automaticRetries = 1;
    },
    (x) => {
      x.release.performanceQualification = 'passed';
    },
    (x) => {
      x.release.before = 'a'.repeat(40);
    },
    (x) => {
      x.commandTimeouts.build++;
    },
    (x) => {
      x.commandRssBytes++;
    },
    (x) => {
      x.commandOutputBytes++;
    },
    (x) => {
      x.helperTimeoutMs++;
    },
    (x) => {
      x.evidenceBytes++;
    },
    (x) => {
      x.finalizationReserveBytes--;
    },
    (x) => {
      x.initialDiskBytes--;
    },
    (x) => {
      x.diskFloorBytes--;
    },
    (x) => {
      x.archiveBytes++;
    },
    (x) => {
      x.proofFileBytes++;
    },
    (x) => {
      x.frozenTools.pop();
    },
  ]) {
    const invalid = structuredClone(manifest);
    mutate(invalid);
    assert.throws(() => validateNormalBaselineProducer(invalid));
  }
  const stages = normalBaselineStages({
    nodeExecutable: '/node',
    sourcePath: '/source',
    buildPath: '/build',
    payloadPath: '/payload',
    evidence: '/evidence',
    toolsPath: '/tools',
  });
  assert.deepEqual(
    stages.map(({ name, timeoutMs }) => ({ name, timeoutMs })),
    [
      { name: 'build', timeoutMs: 1200000 },
      { name: 'inner', timeoutMs: 600000 },
      { name: 'source', timeoutMs: 480000 },
    ],
  );
  assert.deepEqual(stages[0].argv, [
    '/node',
    '/source/scripts/game-cli.mjs',
    'build',
    '--out',
    '/build',
    '--revision',
    manifest.baseline.revision,
  ]);
  assert.equal(stages[0].cwd, '/source');
  assert.deepEqual(stages[1].argv, [
    'python3',
    '-B',
    '/tools/scripts/solo-remote-archive.py',
    'inner',
    '/build/distribution.zip',
    '/payload',
    manifest.baseline.revision,
    '/evidence/baseline-archive.json',
  ]);
  assert.deepEqual(stages[2].argv, [
    '/node',
    '/tools/scripts/verify-solo-build.mjs',
    '/payload',
    '/evidence/baseline-source.json',
    '--source=/source',
    `--base=${manifest.baseline.revision}`,
    '--archive=/build/distribution.zip',
    '--archive-receipt=/evidence/baseline-archive.json',
  ]);
});

test('source admission rejects changed revision/tree, dirty/untracked files and aliased checkout', async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'normal-baseline-source-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8', timeout: 10000 }).trim();
  git('init', '-q');
  await writeFile(join(root, 'file'), 'original');
  git('add', 'file');
  git(
    '-c',
    'user.name=Fixture',
    '-c',
    'user.email=fixture@example.invalid',
    '-c',
    'commit.gpgsign=false',
    'commit',
    '-qm',
    'fixture',
  );
  const revision = git('rev-parse', 'HEAD'),
    tree = git('rev-parse', 'HEAD^{tree}');
  assert.deepEqual(await requireProducerSource(root, revision, tree), { revision, tree });
  await assert.rejects(requireProducerSource(root, '0'.repeat(40), tree));
  await assert.rejects(requireProducerSource(root, revision, '0'.repeat(40)));
  await writeFile(join(root, 'file'), 'changed');
  await assert.rejects(requireProducerSource(root, revision, tree));
  await writeFile(join(root, 'file'), 'original');
  await writeFile(join(root, 'extra'), 'new');
  await assert.rejects(requireProducerSource(root, revision, tree));
  await rm(join(root, 'extra'));
  const alias = root + '-alias';
  await symlink(root, alias);
  t.after(() => rm(alias, { force: true }));
  await assert.rejects(requireProducerSource(alias, revision, tree));
});

test('producer frozen bytes and workflow isolate a single positive package from failure evidence', async () => {
  for (const ref of manifest.frozenTools) {
    const bytes = await readFile(new URL('../' + ref.path, import.meta.url));
    assert.equal(bytes.length, ref.bytes, ref.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), ref.sha256, ref.path);
  }
  const workflow = await readFile(
    new URL('../.github/workflows/solo-remote-baseline-temporary.yml', import.meta.url),
    'utf8',
  );
  assert.match(workflow, /github\.event\.before == '1ccf8368a3dcd099e1608c8a9433e6f0c0518e8f'/);
  assert.match(workflow, /timeout-minutes: 100/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /ref: 8b01991942dc764b8aa4726851699ce1985e53ae/);
  assert(
    !workflow.includes('playwright') &&
      !workflow.includes('path: candidate') &&
      !workflow.includes('b1174522'),
  );
  assert(!workflow.includes('publication-profile'));
  assert.match(
    workflow,
    /timeout --signal=TERM --kill-after=30s 52m node scripts\/produce-solo-normal-baseline\.mjs/,
  );
  assert.match(workflow, /if: \$\{\{ success\(\) && steps\.ready\.outcome == 'success' \}\}/);
  assert.match(
    workflow,
    /admit-upload.*8b01991942dc764b8aa4726851699ce1985e53ae 9373b6a74aea8fa1ef47aa17ace140b4cf714609/,
  );
  assert.match(workflow, /name: solo-normal-baseline-8b019919-\$\{\{ github\.run_id \}\}/);
  assert.match(workflow, /name: solo-normal-baseline-8b019919-evidence-\$\{\{ github\.run_id \}\}/);
  assert.match(
    workflow,
    /Retain every failed, partial and complete command and proof receipt\n\s+if: \$\{\{ always\(\) \}\}/,
  );
  assert.match(workflow, /distribution\.zip\n.*manifest\.json\n.*normal-baseline-proof\//);
});

test('reserve and stop failures retain bounded failed metadata without changing owned receipts', async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'baseline-finalization-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  const receipt = JSON.stringify({
    status: 'closed',
    exitCode: 1,
    failure: 'retained build failure',
  });
  await writeFile(join(root, 'baseline-build.command.json'), receipt);
  await writeFile(join(root, 'baseline-build.log'), 'x'.repeat(2500));
  const plan = { evidenceBytes: 4096, finalizationReserveBytes: 2048, diskFloorBytes: 100 };
  const report = { format: 'fixture', status: 'ready', failure: 'Original resource stop' };
  assert.equal(
    await finalizeNormalBaselineEvidence({ evidence: root, report, plan, diskBytes: 1000 }),
    'failed',
  );
  const saved = JSON.parse(await readFile(join(root, 'summary.json')));
  assert.equal(saved.failure, 'Original resource stop');
  assert.equal(saved.finalizationFailure.reserveFailure, true);
  assert.equal(await readFile(join(root, 'baseline-build.command.json'), 'utf8'), receipt);
  const stopped = { format: 'fixture', status: 'ready' };
  assert.equal(
    await finalizeNormalBaselineEvidence({
      evidence: root,
      report: stopped,
      plan,
      diskBytes: 99,
      stopped: true,
    }),
    'failed',
  );
  assert.equal(
    JSON.parse(await readFile(join(root, 'summary.json'))).finalizationFailure.stopped,
    true,
  );
  const overflow = { format: 'fixture', status: 'ready', details: 'x'.repeat(5000) };
  assert.equal(
    await finalizeNormalBaselineEvidence({
      evidence: root,
      report: overflow,
      plan,
      diskBytes: 1000,
    }),
    'failed',
  );
  assert.equal(JSON.parse(await readFile(join(root, 'summary.json'))).complete, false);
  let retainedBytes = 0;
  for (const name of [
    'baseline-build.command.json',
    'baseline-build.log',
    'summary.json',
    'inventory.json',
  ])
    retainedBytes += (await readFile(join(root, name))).length;
  assert(
    retainedBytes <= plan.evidenceBytes,
    'Existing inventory remains included in fallback capacity',
  );
});

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixtureEnvironment = {
  ...Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_'))),
  GIT_CONFIG_GLOBAL: os.devNull,
  GIT_CONFIG_NOSYSTEM: '1',
};

function run(command, args, cwd, input) {
  const result = spawnSync(command, args, {
    cwd,
    input,
    env: fixtureEnvironment,
    encoding: 'utf8',
    timeout: 180_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);
  return result.stdout;
}

async function checkout(t, workflowName, jobName) {
  const workflow = await fs.readFile(path.join(root, '.github/workflows', workflowName), 'utf8');
  const job = workflow.match(
    new RegExp(`\\n  ${jobName}:\\n([\\s\\S]*?)(?=\\n  [a-z][a-z-]*:|$)`, 'u'),
  )?.[1];
  assert.ok(job, `Missing ${jobName} job`);
  const sparse = job.match(/sparse-checkout: \|\n((?: {12}.+\n)+)/u)?.[1];
  assert.ok(sparse, 'The fixture must exercise the actual sparse checkout contract');
  const patterns = sparse
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'release-utility-sparse-'));
  t.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const repo = path.join(temporary, 'source');
  await fs.mkdir(repo);
  for (const relative of [
    '.github/workflows',
    'publishing/utility',
    'publishing/test-policy.mjs',
    'publishing/test-policy.json',
    // Its absence before the correction reproduces the failing CI checkout.
    'scripts/distribution-zip.mjs',
  ]) {
    const source = path.join(root, relative);
    if (!(await fs.stat(source).catch(() => null))) continue;
    const target = path.join(repo, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.cp(source, target, {
      recursive: true,
      filter: (name) => !name.includes('__pycache__'),
    });
  }
  run('git', ['init', '--quiet'], repo);
  run('git', ['add', '.'], repo);
  run(
    'git',
    [
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.invalid',
      'commit',
      '--quiet',
      '-m',
      'bounded utility fixture',
    ],
    repo,
  );
  run(
    'git',
    [
      'sparse-checkout',
      'set',
      job.includes('sparse-checkout-cone-mode: false') ? '--no-cone' : '--cone',
      '--stdin',
    ],
    repo,
    `${patterns}\n`,
  );
  assert.equal(await fs.stat(path.join(repo, 'node_modules')).catch(() => null), null);
  assert.equal(await fs.stat(path.join(repo, 'scripts/game-cli.mjs')).catch(() => null), null);
  return { repo, job };
}

function verifyWriterAndPolicy(repo) {
  // Reproduce the broken dependency boundary without nesting the entire utility
  // suite, which the workflow itself still discovers and executes unchanged.
  run(
    'python3',
    [
      '-B',
      '-m',
      'unittest',
      'test_distribution_archive.py',
      'test_waived_qualification.PolicyCompatibilityTests',
      'test_release_artifact.InspectionCommandTests',
      'test_release_artifact.WorkflowTests',
    ],
    path.join(repo, 'publishing/utility'),
  );
}

test('full-evidence verification retains the original writer and policy in its dependency-free sparse checkout', async (t) => {
  const { repo, job } = await checkout(t, 'assemble-full-release-evidence.yml', 'verify');
  assert.ok(job.includes("python3 -B -m unittest discover -s publishing/utility -p 'test_*.py'"));
  verifyWriterAndPolicy(repo);
});

test('artifact inspection retains the same original-writer and policy dependencies in its sparse checkout', async (t) => {
  const { repo, job } = await checkout(t, 'qualify-release-source.yml', 'inspect-artifact');
  assert.ok(
    job.includes("python3 -m unittest discover -s automation/publishing/utility -p 'test_*.py'"),
  );
  verifyWriterAndPolicy(repo);
});

test('original upload retains the same read-only verification dependencies before authenticated work', async (t) => {
  const { repo, job } = await checkout(t, 'upload-release-originals.yml', 'upload-originals');
  assert.ok(
    job.includes("python3 -m unittest discover -s automation/publishing/utility -p 'test_*.py'"),
  );
  verifyWriterAndPolicy(repo);
});

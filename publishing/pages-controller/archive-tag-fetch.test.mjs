import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkArchiveTagFetch } from './archive-tag-fetch.mjs';

const lock = {
  format: 'revealline-archive-originals.v2',
  releases: [{ version: 'v0.60.9' }, { version: 'v0.61.0' }],
};
const ref = (version) => `refs/tags/${version}:refs/tags/${version}`;
const workflow = (refs, extra = '') => `jobs:
  build:
    steps:
      - name: Fetch the original immutable release tags for identity verification
        working-directory: source
${extra}        run: git fetch --depth=1 origin ${refs}
      - name: Verify originals
        run: python3 archive/tools/prepare.py --source source
`;

test('archive append checks all source-lock cohorts, preserving the prior cohort', () => {
  assert.throws(() => checkArchiveTagFetch(lock, workflow(ref('v0.60.9'))), /v0\.61\.0/);
  assert.throws(() => checkArchiveTagFetch(lock, workflow(ref('v0.61.0'))), /v0\.60\.9/);
  assert.deepEqual(checkArchiveTagFetch(lock, workflow(`${ref('v0.60.9')} ${ref('v0.61.0')}`)), {
    required: ['v0.60.9', 'v0.61.0'],
    fetched: ['v0.60.9', 'v0.61.0'],
    missing: [],
    hostedExecutionVerified: false,
  });
});

test('tag mentions, comments, another checkout and conditional fetches do not prove coverage', () => {
  const both = workflow(`${ref('v0.60.9')} ${ref('v0.61.0')}`);
  for (const value of [
    workflow(ref('v0.60.9')) + `# ${ref('v0.61.0')}\n`,
    both.replace('working-directory: source', 'working-directory: archive'),
    workflow(`${ref('v0.60.9')} ${ref('v0.61.0')}`, '        if: false\n'),
    both.replace('run: git fetch', '# run: git fetch'),
    both.replace('run: git fetch', 'run: |\n          git fetch'),
  ])
    assert.throws(() => checkArchiveTagFetch(lock, value), /every locked tag/);
});

test('exact source and destination refs are mandatory; dynamic and ambiguous shell is refused', () => {
  for (const value of [
    `${ref('v0.60.9')} refs/tags/v0.61.0:refs/tags/v0.60.9`,
    `${ref('v0.60.9')} refs/tags/v0.61.0`,
    `${ref('v0.60.9')} ${ref('v0.61.0')} || true`,
    `${ref('v0.60.9')} $RELEASE_REFS`,
    `+${ref('v0.60.9')} ${ref('v0.61.0')}`,
  ])
    assert.throws(() => checkArchiveTagFetch(lock, workflow(value)), /same local tag/);
  assert.throws(
    () => checkArchiveTagFetch(lock, workflow(ref('v0.60.9')).replace('origin ', 'upstream ')),
    /explicit archive fetch template/,
  );
});

test('fetch examples inside heredocs and other jobs are not direct build steps', () => {
  const example = `jobs:
  build:
    steps:
      - name: Print a documentation example without fetching
        run: |
          cat <<'EOF'
          - name: Not a real workflow step
            working-directory: source
            run: git fetch --depth=1 origin ${ref('v0.60.9')} ${ref('v0.61.0')}
          EOF
`;
  assert.throws(() => checkArchiveTagFetch(lock, example), /every locked tag/);
  const otherJob =
    workflow(ref('v0.60.9')) +
    `  another-job:
    steps:
      - name: Fetch in an unrelated job
        working-directory: source
        run: git fetch --depth=1 origin ${ref('v0.61.0')}
`;
  assert.throws(() => checkArchiveTagFetch(lock, otherJob), /v0\.61\.0/);
  assert.throws(
    () => checkArchiveTagFetch(lock, workflow(ref('v0.60.9')).replace('  build:', '  other:')),
    /explicit archive jobs\/build\/steps template/,
  );
});

test('source-lock cohort identity and bounded inputs are required', () => {
  for (const releases of [
    [],
    [{ version: 'v0.061.0' }],
    [{ version: 'v0.61.0' }, { version: 'v0.61.0' }],
  ])
    assert.throws(() => checkArchiveTagFetch({ ...lock, releases }, ''));
  assert.throws(
    () => checkArchiveTagFetch({ ...lock, format: 'other' }, ''),
    /archive originals v2/,
  );
  assert.throws(() => checkArchiveTagFetch(lock, 'x'.repeat(1024 * 1024 + 1)), /bounded/);
});

test('CLI reads bounded ordinary inputs and refuses symlinks and oversized files', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'archive-tag-fetch-'));
  try {
    const lockPath = path.join(directory, 'source-lock.json');
    const workflowPath = path.join(directory, 'deploy.yml');
    await fs.writeFile(lockPath, JSON.stringify(lock));
    await fs.writeFile(workflowPath, workflow(`${ref('v0.60.9')} ${ref('v0.61.0')}`));
    const run = (input) =>
      spawnSync(
        process.execPath,
        [
          fileURLToPath(new URL('./archive-tag-fetch.mjs', import.meta.url)),
          '--source-lock',
          input,
          '--workflow',
          workflowPath,
        ],
        { encoding: 'utf8', timeout: 10000, maxBuffer: 64 * 1024 },
      );
    const original = await fs.readFile(lockPath);
    const good = run(lockPath);
    assert.equal(good.status, 0, good.stderr);
    assert.equal(JSON.parse(good.stdout).hostedExecutionVerified, false);
    assert.deepEqual(await fs.readFile(lockPath), original);
    const link = path.join(directory, 'linked.json');
    await fs.symlink(lockPath, link);
    assert.equal(run(link).status, 1);
    const large = path.join(directory, 'large.json');
    await fs.writeFile(large, Buffer.alloc(1024 * 1024 + 1));
    const oversized = run(large);
    assert.equal(oversized.status, 1);
    assert.match(oversized.stderr, /ordinary file <=1 MiB/);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const workflow = await readFile(
  new URL('../.github/workflows/publish-main-pages.yml', import.meta.url),
  'utf8',
);
const step = workflow
  .split('      - name: Verify the uploaded Pages archive against its inventory\n')[1]
  .split('\n      - name:')[0];
const script = fileURLToPath(new URL('./pages-archive-evidence.py', import.meta.url));
test('archive extraction is byte-identical to the frozen production body', async () => {
  const body = (await readFile(script, 'utf8')).replace(/\n$/, '');
  assert.equal(
    createHash('sha256').update(body).digest('hex'),
    'f948bdc99cd255f852ea232177dab698ee369b01e52edaf873c66ceb47cbae6f',
  );
  assert.match(step, /python3 scripts\/pages-archive-evidence\.py\n?$/);
  assert.doesNotMatch(step, /<<'PY'/);
});
const source = 'a'.repeat(40);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function fixture(t, members = [{ name: './index.html', text: 'hello' }]) {
  const directory = await mkdtemp(path.join(tmpdir(), 'pages-archive-evidence-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const inventory = {
    sourceRevision: source,
    files: [{ path: 'index.html', bytes: 5, sha256: hash('hello') }],
  };
  const bytes = JSON.stringify(inventory);
  const staged = {
    sourceRevision: source,
    capacityAccepted: true,
    completeInventory: true,
    inventorySha256: hash(bytes),
    files: 1,
    bytes: 5,
  };
  await writeFile(path.join(directory, 'main-pages-inventory.json'), bytes);
  await writeFile(path.join(directory, 'main-pages-receipt.json'), JSON.stringify(staged));
  const tar = spawnSync(
    'python3',
    [
      '-c',
      `import io, json, sys, tarfile
with tarfile.open(sys.argv[1], 'w', format=tarfile.PAX_FORMAT) as archive:
  for row in json.loads(sys.argv[2]):
    entry = tarfile.TarInfo(row['name'])
    kind = row.get('kind', 'file')
    if kind in ('symlink', 'hardlink'):
      entry.type = tarfile.SYMTYPE if kind == 'symlink' else tarfile.LNKTYPE
      entry.linkname = 'index.html'
      archive.addfile(entry)
    elif kind == 'directory':
      entry.type = tarfile.DIRTYPE
      archive.addfile(entry)
    else:
      data = row.get('text', '').encode()
      entry.size = len(data)
      archive.addfile(entry, io.BytesIO(data))`,
      path.join(directory, 'artifact.tar'),
      JSON.stringify(members),
    ],
    { encoding: 'utf8' },
  );
  assert.equal(tar.status, 0, tar.stderr);
  return { directory, staged };
}

async function run(f, maximum = 980000000) {
  const result = spawnSync('python3', [script], {
    encoding: 'utf8',
    env: {
      ...process.env,
      RUNNER_TEMP: f.directory,
      SOURCE_SHA: source,
      PAGES_ARTIFACT_ID: '12345',
      MAX_PUBLISHED_BYTES: String(maximum),
    },
  });
  const receipt = JSON.parse(
    await readFile(path.join(f.directory, 'main-pages-archive-receipt.json'), 'utf8'),
  );
  return { result, receipt };
}

test('actual uncompressed archive is hash-bound to the staged inventory and upload identity', async (t) => {
  const f = await fixture(t, [
    { name: '.', kind: 'directory' },
    { name: './index.html', text: 'hello' },
  ]);
  const { result, receipt } = await run(f, 10240);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(receipt.archiveAccepted, true);
  assert.equal(receipt.sourceRevision, source);
  assert.equal(receipt.artifactId, '12345');
  assert.equal(receipt.archiveBytes, 10240);
  assert.equal(receipt.stagedBytes, 5);
  assert.equal(receipt.overheadBytes, 10235);
  assert.equal(receipt.files, 1);
  assert.equal(receipt.archiveSha256, hash(await readFile(path.join(f.directory, 'artifact.tar'))));
});

test('archive overhead can reject a raw-file-sized payload and retains failure evidence', async (t) => {
  const { result, receipt } = await run(await fixture(t), 10239);
  assert.equal(result.status, 1);
  assert.equal(receipt.archiveAccepted, false);
  assert.equal(receipt.archiveBytes, 10240);
  assert.match(receipt.errors.join('\n'), /exceeds/);
});

for (const [name, members, error] of [
  ['changed bytes', [{ name: './index.html', text: 'other' }], /content differs/],
  ['missing file', [], /missing inventoried files/],
  ['unexpected file', [{ name: './other.html', text: 'hello' }], /Unexpected archive file/],
  [
    'duplicate file',
    [
      { name: './index.html', text: 'hello' },
      { name: 'index.html', text: 'hello' },
    ],
    /Duplicate archive file/,
  ],
  ['traversal', [{ name: '../index.html', text: 'hello' }], /Unsafe archive path/],
  ['absolute path', [{ name: '/index.html', text: 'hello' }], /Unsafe archive path/],
  ['symlink', [{ name: './index.html', kind: 'symlink' }], /Unsupported archive member/],
  ['hardlink', [{ name: './index.html', kind: 'hardlink' }], /Unsupported archive member/],
])
  test(`${name} cannot pass archive acceptance`, async (t) => {
    const { result, receipt } = await run(await fixture(t, members));
    assert.equal(result.status, 1);
    assert.equal(receipt.archiveAccepted, false);
    assert.match(receipt.errors.join('\n'), error);
  });

test('inventory alteration and wrong source identity fail closed', async (t) => {
  for (const change of [{ inventorySha256: '0'.repeat(64) }, { sourceRevision: 'b'.repeat(40) }]) {
    const f = await fixture(t);
    await writeFile(
      path.join(f.directory, 'main-pages-receipt.json'),
      JSON.stringify({ ...f.staged, ...change }),
    );
    const { result, receipt } = await run(f);
    assert.equal(result.status, 1);
    assert.equal(receipt.archiveAccepted, false);
  }
});

test('missing archive produces diagnostic evidence, never acceptance', async (t) => {
  const f = await fixture(t);
  await rm(path.join(f.directory, 'artifact.tar'));
  const { result, receipt } = await run(f);
  assert.equal(result.status, 1);
  assert.equal(receipt.archiveAccepted, false);
  assert.ok(receipt.errors.length > 0);
});

test('archive verification follows the pinned upload and gates deployment without broader permissions', () => {
  assert.match(
    workflow,
    /id: pages_artifact\n\s+uses: actions\/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9/,
  );
  assert.ok(workflow.indexOf('id: pages_artifact') < workflow.indexOf('id: archive\n'));
  assert.match(step, /PAGES_ARTIFACT_ID: \$\{\{ steps.pages_artifact.outputs.artifact_id \}\}/);
  assert.doesNotMatch(step, /continue-on-error|if:|extractall/);
  assert.match(
    workflow,
    /if: \$\{\{ !cancelled\(\) && \(steps.archive.outcome == 'success' \|\| steps.archive.outcome == 'failure'\) \}\}/,
  );
  assert.match(workflow, /deploy:\n    needs: build\n/);
  assert.match(workflow, /MAX_PUBLISHED_BYTES: 980000000/);
  assert.doesNotMatch(workflow, /contents: write/);
});

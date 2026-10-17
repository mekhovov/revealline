import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { validateStackArtifact, downloadStackArtifact } from './pages-stack-artifacts.mjs';

const expected = { runId: '123', runAttempt: '2', controllerSha: 'a'.repeat(40) };
const metadata = () => ({
  id: 77,
  name: 'stack-pages-123-2',
  expired: false,
  size_in_bytes: 100,
  digest: 'sha256:' + 'b'.repeat(64),
  workflow_run: { id: 123, head_sha: expected.controllerSha },
});
test('artifact metadata binds digest, source, run and attempt-qualified literal name', () => {
  assert.equal(validateStackArtifact(metadata(), 'pages', '77', expected), 'b'.repeat(64));
  for (const mutate of [
    (m) => {
      m.name = 'stack-pages-123-1';
    },
    (m) => {
      m.workflow_run.head_sha = 'c'.repeat(40);
    },
    (m) => {
      m.digest = null;
    },
    (m) => {
      m.expired = true;
    },
    (m) => {
      m.size_in_bytes = 1100000001;
    },
    (m) => {
      m.id = 78;
    },
  ]) {
    const value = metadata();
    mutate(value);
    assert.throws(() => validateStackArtifact(value, 'pages', '77', expected));
  }
});
const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'pages-stack-artifact.py');
async function fixture(rows, kind, wrongHash = false) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'pages-stack-zip-'));
  const zip = path.join(directory, 'input.zip');
  const args = [
    '-c',
    `import json,sys,zipfile
with zipfile.ZipFile(sys.argv[1], 'w') as archive:
 for row in json.load(sys.stdin):
  info=zipfile.ZipInfo(row[0])
  if len(row)>2: info.external_attr=row[2]<<16
  archive.writestr(info,row[1])`,
    zip,
  ];
  assert.ok(
    args.every((arg) => Buffer.byteLength(arg) < 131072),
    'Fixture must respect Linux single-argument bounds',
  );
  const generated = spawnSync('python3', args, { encoding: 'utf8', input: JSON.stringify(rows) });
  assert.equal(generated.status, 0, generated.error?.message || generated.stderr);
  const hash = createHash('sha256')
    .update(await fs.readFile(zip))
    .digest('hex');
  const output = path.join(directory, 'verified');
  const result = spawnSync(
    'python3',
    [
      script,
      '--zip',
      zip,
      '--out',
      output,
      '--sha256',
      wrongHash ? '0'.repeat(64) : hash,
      '--kind',
      kind,
    ],
    { encoding: 'utf8' },
  );
  return { result, output, zip, directory, hash };
}
test('accepts exact digest-bound isolated pages and receipts artifacts', async () => {
  const pages = await fixture([['artifact.tar', 'archive-A']], 'pages');
  assert.equal(pages.result.status, 0, pages.result.stderr);
  assert.equal(await fs.readFile(path.join(pages.output, 'artifact.tar'), 'utf8'), 'archive-A');
  const receipts = await fixture(
    ['main-pages-inventory.json', 'main-pages-receipt.json', 'main-pages-archive-receipt.json'].map(
      (name) => [name, '{}'],
    ),
    'receipts',
  );
  assert.equal(receipts.result.status, 0, receipts.result.stderr);
});
test('rejects receipt-overwrites-pages collision before any namespace assembly', async () => {
  const value = await fixture(
    [
      ['main-pages-inventory.json', '{}'],
      ['main-pages-receipt.json', '{}'],
      ['main-pages-archive-receipt.json', '{}'],
      ['artifact.tar', 'replacement-B'],
    ],
    'receipts',
  );
  assert.notEqual(value.result.status, 0);
  assert.match(value.result.stderr, /Unexpected receipt member/u);
  await assert.rejects(fs.stat(value.output), { code: 'ENOENT' });
});
test('rejects wrong digest, traversal, symlinks, duplicate and incomplete archives', async () => {
  for (const [rows, kind, wrongHash] of [
    [[['artifact.tar', 'A']], 'pages', true],
    [[['../artifact.tar', 'A']], 'pages', false],
    [[['artifact.tar', 'A', 0o120777]], 'pages', false],
    [
      [
        ['artifact.tar', 'A'],
        ['artifact.tar', 'B'],
      ],
      'pages',
      false,
    ],
    [[['main-pages-inventory.json', '{}']], 'receipts', false],
    [
      [
        ['preflight.json', '{}'],
        ['selector.json', '{}'],
        ['overlay/../escape', 'A'],
      ],
      'preflight',
      false,
    ],
  ]) {
    const value = await fixture(rows, kind, wrongHash);
    assert.notEqual(value.result.status, 0);
  }
});
test('streaming transport writes exactly the digest-bound ZIP and rejects mismatched bytes', async () => {
  const value = await fixture([['artifact.tar', 'A'.repeat(200000)]], 'pages');
  const bin = path.join(value.directory, 'bin');
  await fs.mkdir(bin);
  const gh = path.join(bin, 'gh');
  await fs.writeFile(
    gh,
    '#!/usr/bin/env python3\nimport os,sys\nwith open(os.environ["STACK_ARTIFACT_FIXTURE"],"rb") as source:\n while True:\n  data=source.read(8192)\n  if not data: break\n  sys.stdout.buffer.write(data)\n',
  );
  await fs.chmod(gh, 0o700);
  const priorPath = process.env.PATH,
    priorFixture = process.env.STACK_ARTIFACT_FIXTURE;
  process.env.PATH = bin + path.delimiter + priorPath;
  process.env.STACK_ARTIFACT_FIXTURE = value.zip;
  try {
    const meta = {
      ...metadata(),
      size_in_bytes: (await fs.stat(value.zip)).size,
      digest: `sha256:${value.hash}`,
    };
    const downloaded = await downloadStackArtifact(meta, 'pages', '77', expected, value.directory);
    assert.deepEqual(await fs.readFile(downloaded.zipFile), await fs.readFile(value.zip));
    assert.equal(downloaded.bytes, meta.size_in_bytes);
    const other = await fs.mkdtemp(path.join(os.tmpdir(), 'pages-stack-wrong-digest-'));
    await assert.rejects(
      downloadStackArtifact(
        { ...meta, digest: 'sha256:' + '0'.repeat(64) },
        'pages',
        '77',
        expected,
        other,
      ),
      /digest differs/u,
    );
  } finally {
    process.env.PATH = priorPath;
    if (priorFixture === undefined) delete process.env.STACK_ARTIFACT_FIXTURE;
    else process.env.STACK_ARTIFACT_FIXTURE = priorFixture;
  }
});

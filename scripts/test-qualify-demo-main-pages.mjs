import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  defaultBaselines,
  gnuTarSize,
  mainPagesAuditArguments,
  mainPagesAuditFailures,
  qualifyDemoMainPages,
} from './qualify-demo-main-pages.mjs';

test('the tar model reproduces the actual pinned baseline without building or materializing payloads', async () => {
  const bytes = await readFile(new URL('../' + defaultBaselines.inventory, import.meta.url));
  const inventory = JSON.parse(bytes);
  const receipt = JSON.parse(
    await readFile(new URL('../' + defaultBaselines.archive, import.meta.url)),
  );
  assert.equal(createHash('sha256').update(bytes).digest('hex'), receipt.inventorySha256);
  assert.equal(inventory.sourceRevision, receipt.sourceRevision);
  assert.equal(inventory.completeInventory, true);
  const model = gnuTarSize(inventory.files);
  assert.equal(model.bytes, receipt.archiveBytes);
  assert.equal(model.files, receipt.files);
  assert.equal(
    inventory.files.reduce((n, row) => n + row.bytes, 0),
    receipt.stagedBytes,
  );
});

test('tar accounting includes parent directories, long UTF-8 names, block padding, and terminal records', () => {
  const model = gnuTarSize([
    { path: 'one/a', bytes: 513 },
    { path: 'one/' + 'é'.repeat(51), bytes: 0 },
  ]);
  assert.equal(model.files, 2);
  assert.equal(model.directories, 2);
  assert.equal(model.longPaths, 1);
  assert.equal(model.bytes, 10240);
  assert.throws(() => gnuTarSize([{ path: 'a'.repeat(511), bytes: 0 }]), /long-name/);
  for (const files of [
    [{ path: '../a', bytes: 1 }],
    [{ path: 'a', bytes: -1 }],
    [{ path: 'a', bytes: 1.1 }],
    [
      { path: 'a', bytes: 0 },
      { path: 'a', bytes: 0 },
    ],
    [
      { path: 'a', bytes: 0 },
      { path: 'a/b', bytes: 1 },
    ],
  ])
    assert.throws(() => gnuTarSize(files));
});

const goodReport = () => ({
  headStable: true,
  sourceStable: true,
  missingPayloads: [],
  mismatchedPayloads: [],
  missingNative: [],
  mismatchedNative: [],
  literalDemoModuleClosure: { missingModules: [] },
  rollingMainPagesLimitBytes: 980000000,
  finalStaged: { bytes: 979000000 },
  archiveSizeModel: { bytes: 980000000 },
});
test('every missing or mismatched dependency and either staged or modeled capacity breach fails the gate', () => {
  assert.deepEqual(mainPagesAuditFailures(goodReport()), []);
  for (const mutate of [
    (r) => (r.headStable = false),
    (r) => (r.sourceStable = false),
    (r) => r.missingPayloads.push('replay.json'),
    (r) => r.mismatchedPayloads.push('changed.json'),
    (r) => r.missingNative.push({ path: 'game/content/base-artwork.json' }),
    (r) => r.mismatchedNative.push({ path: 'source.json' }),
    (r) => r.literalDemoModuleClosure.missingModules.push('runtime.mjs'),
    (r) => (r.finalStaged.bytes = 980000001),
    (r) => (r.archiveSizeModel.bytes = 980000001),
  ]) {
    const r = goodReport();
    mutate(r);
    assert.equal(mainPagesAuditFailures(r).length, 1);
  }
});

test('CLI requires explicit fresh report path and rejects unknown or duplicated options', () => {
  assert.deepEqual(
    mainPagesAuditArguments([
      '--report=result.json',
      '--baseline-inventory=pinned.json',
      '--baseline-archive=measured.json',
    ]),
    {
      reportPath: 'result.json',
      baselineInventory: 'pinned.json',
      baselineArchive: 'measured.json',
    },
  );
  for (const args of [
    [],
    ['--report=a.json', '--report=b.json'],
    ['--publish=true'],
    ['--report='],
  ])
    assert.throws(() => mainPagesAuditArguments(args));
});

test('existing evidence is rejected before any costly build or source snapshot', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'demo-main-pages-gate-'));
  try {
    const p = path.join(dir, 'receipt.json');
    await writeFile(p, 'preserved');
    await assert.rejects(qualifyDemoMainPages({ reportPath: p }), /Refusing to overwrite/);
    assert.equal(await readFile(p, 'utf8'), 'preserved');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

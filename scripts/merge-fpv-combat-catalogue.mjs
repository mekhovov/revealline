#!/usr/bin/env node
/** Strict merge: every pinned edition/start and every declared case must occur once. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  WORLD_CATALOGUE,
  BEGINNER_CATALOGUE,
} from '../optional-practice/civilian-fpv/world-catalogue.mjs';
import { WORLD_LIBRARY_CATALOGUE } from '../optional-practice/civilian-fpv/world-library.mjs';
import { REGIONAL_LIBRARY_PINS } from '../optional-practice/civilian-fpv/regional-library.mjs';
import { inspectPack } from '../optional-practice/civilian-fpv/world-content.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = path.resolve(root, process.argv[2] ?? 'docs/evidence/fpv-combat');
const shardCounts = {
  native: Number(process.argv[3] ?? 4),
  regional: Number(process.argv[4] ?? process.argv[3] ?? 4),
};
assert.ok(Object.values(shardCounts).every((n) => Number.isSafeInteger(n) && n > 0 && n <= 32));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const git = (revision, file) =>
  execFileSync('git', ['show', `${revision}:${file}`], {
    cwd: root,
    maxBuffer: 100 * 1024 * 1024,
  });
const entryKey = (row) =>
  [row.kind, row.catalogueIdentity ?? row.sha256, row.id, row.course, row.start ?? ''].join('/');
const expected = { native: [], regional: [] };
for (const [kind, entries] of [
  ['bundled', WORLD_CATALOGUE],
  ['learning', BEGINNER_CATALOGUE],
])
  for (const entry of entries)
    expected.native.push(
      entryKey({
        kind,
        catalogueIdentity: entry.packIdentity,
        id: entry.id,
        course: entry.course.id,
      }),
    );
for (const pin of WORLD_LIBRARY_CATALOGUE) {
  const bytes = git(pin.commit, pin.path);
  assert.equal(hash(bytes), pin.sha256);
  assert.equal(bytes.length, pin.bytes);
  const pack = await inspectPack(new Uint8Array(bytes));
  for (const course of pack.project.courses)
    expected.native.push(
      entryKey({ kind: 'download', sha256: pin.sha256, id: pin.id, course: course.id }),
    );
}
for (const pin of REGIONAL_LIBRARY_PINS) {
  const parts = new URL(pin.pin.url).pathname.split('/'),
    revision = parts[3],
    file = parts.slice(4).join('/'),
    directory = file.slice(0, file.lastIndexOf('/') + 1),
    bytes = git(revision, file);
  assert.equal(hash(bytes), pin.pin.sha256);
  assert.equal(bytes.length, pin.pin.bytes);
  const descriptor = JSON.parse(bytes),
    terrainBytes = git(revision, directory + descriptor.terrain.path),
    declared = descriptor.files.find((row) => row.path === descriptor.terrain.path);
  assert.equal(hash(terrainBytes), declared.sha256);
  assert.equal(terrainBytes.length, declared.bytes);
  const manifest = JSON.parse(terrainBytes);
  for (const spawn of manifest.spawns)
    expected.regional.push(
      entryKey({
        kind: 'regional',
        sha256: pin.pin.sha256,
        id: pin.id,
        course: manifest.id,
        start: spawn.id,
      }),
    );
}
const selectionKey = (row) =>
  [row.activity, row.population, row.survivalMode ?? '', row.backend].join('/');
const selections = [
  ...['continuous', 'hunting', 'elimination', 'strike'].map((activity) => ({
    activity,
    population: 12,
  })),
  ...['timed', 'endless'].flatMap((survivalMode) =>
    [64, 96, 128].map((population) => ({ activity: 'survival', population, survivalMode })),
  ),
].flatMap((row) => ['standard', 'advanced'].map((backend) => selectionKey({ ...row, backend })));
const editions = [],
  reports = [];
let sources;
for (const scope of ['native', 'regional']) {
  const found = new Map(),
    shardCount = shardCounts[scope];
  for (let index = 0; index < shardCount; index++) {
    const name = `overhaul-catalogue-${scope}-${index}.json`,
      report = JSON.parse(await readFile(path.join(directory, name), 'utf8'));
    assert.equal(report.format, 'FPVCombatCatalogueMatrix.v2');
    assert.equal(report.scope, scope);
    assert.deepEqual(report.shard, { index, count: shardCount });
    assert.equal(report.filter, null);
    assert.ok(report.completedAt, `Unfinished shard: ${name}`);
    assert.equal(report.replayRequested, true);
    assert.deepEqual(report.errors, [], `Inventory failures: ${name}`);
    assert.equal(report.ticksPerCase, 3);
    sources ??= report.sources;
    assert.deepEqual(report.sources, sources, `Mixed source revisions: ${name}`);
    for (const row of report.editions) {
      const key = entryKey(row);
      assert.equal(row.ordinal % shardCount, index);
      assert.equal(expected[scope][row.ordinal], key, `Unexpected entry: ${key}`);
      assert.ok(!found.has(key), `Duplicate entry: ${key}`);
      found.set(key, row);
      assert.deepEqual(
        row.cases.map(selectionKey).sort(),
        [...selections].sort(),
        `Wrong cases: ${key}`,
      );
      for (const item of row.cases) {
        assert.ok(['passed', 'failed'].includes(item.status));
        if (item.status === 'failed') {
          assert.equal(typeof item.error, 'string');
          continue;
        }
        assert.equal(item.recoveryRestored, true, `Recovery untested: ${key}`);
        assert.equal(item.replayVerified, true, `Replay untested: ${key}`);
        assert.equal(item.acceptedTicks, report.ticksPerCase);
        assert.ok(item.admitted > 0 && item.required > 0);
        assert.equal(item.baseIdentity, row.baseIdentity);
      }
    }
    reports.push({
      file: name,
      sha256: hash(await readFile(path.join(directory, name))),
      createdAt: report.createdAt,
      completedAt: report.completedAt,
    });
  }
  assert.deepEqual(
    [...found.keys()].sort(),
    [...expected[scope]].sort(),
    `Incomplete ${scope} coverage`,
  );
  editions.push(
    ...[...found.values()].sort((a, b) => a.ordinal - b.ordinal).map((row) => ({ ...row, scope })),
  );
}
for (const [file, fingerprint] of Object.entries(sources))
  assert.equal(hash(await readFile(path.join(root, file))), fingerprint, `Source changed: ${file}`);
const cases = editions.flatMap((row) => row.cases);
const passed = cases.filter((row) => row.status === 'passed');
const merged = {
  format: 'FPVCombatCatalogueMatrixMerged.v2',
  completedAt: new Date().toISOString(),
  sources,
  shards: reports,
  summary: {
    entries: editions.length,
    nativeEntries: expected.native.length,
    regionalStarts: expected.regional.length,
    cases: cases.length,
    passed: passed.length,
    failed: cases.length - passed.length,
    recoveryRestored: cases.filter((row) => row.recoveryRestored).length,
    replayVerified: cases.filter((row) => row.replayVerified).length,
    minAdmitted: Math.min(...passed.map((row) => row.admitted)),
    minRequired: Math.min(...passed.map((row) => row.required)),
  },
  methodology:
    'Exact pinned inventory, each entry once, all ten activity/population selections on both physical backends. Three accepted ticks, actual paired restore, and fresh accepted-command replay. All source hashes match.',
  limitations: [
    'Short starts establish admission, recovery and replay compatibility; they do not establish complete activity victories or global navigation.',
    'No browser GPU, sustained frame pacing, physical radio or human satisfaction claim is made.',
  ],
  editions,
};
const output = path.join(directory, 'overhaul-catalogue-matrix.json');
const temporary = `${output}.tmp-${process.pid}`;
try {
  await writeFile(temporary, JSON.stringify(merged) + '\n');
  await rename(temporary, output);
} catch (error) {
  await rm(temporary, { force: true }).catch(() => {});
  throw error;
}
console.log(JSON.stringify(merged.summary));
if (merged.summary.failed) process.exitCode = 1;

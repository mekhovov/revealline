#!/usr/bin/env node
/** Read-only capacity planning for the unchanged, fully duplicated Pages layout. */
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { publishedReleaseIndex } from './build-pages.mjs';
import { MAIN_PAGES_BUDGET_BYTES } from './pages-archive.mjs';

export const PAGES_BUDGET_BYTES = MAIN_PAGES_BUDGET_BYTES;
const VERSION = /^v\d+\.\d+\.\d+$/;
const excluded = new Set(['distribution.zip', 'distribution.zip.sha256']);
const jsonBytes = (value) => Buffer.byteLength(JSON.stringify(value, null, 2) + '\n');

async function ordinaryFile(file) {
  if (!(await fs.lstat(file)).isFile()) throw new Error(`Expected ordinary file: ${file}`);
  return fs.readFile(file);
}

async function playableSize(directory, prefix = '') {
  if (!(await fs.lstat(directory)).isDirectory())
    throw new Error(`Expected ordinary site directory: ${directory}`);
  let bytes = 0,
    files = 0;
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const relative = prefix + entry.name,
      file = path.join(directory, entry.name);
    if (excluded.has(relative)) continue;
    if (entry.isDirectory()) {
      const child = await playableSize(file, relative + '/');
      bytes += child.bytes;
      files += child.files;
    } else if (entry.isFile()) {
      bytes += (await fs.stat(file)).size;
      files++;
    } else throw new Error(`Pages artifacts require ordinary files/directories: ${file}`);
    if (!Number.isSafeInteger(bytes)) throw new Error('Pages byte total exceeds integer bounds.');
  }
  return { bytes, files };
}

export async function inspectPagesCapacity({
  projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  repository = 'mekhovov/revealline',
  nextPlayableBytes,
} = {}) {
  if (
    nextPlayableBytes !== undefined &&
    (!Number.isSafeInteger(nextPlayableBytes) || nextPlayableBytes < 1)
  )
    throw new Error('Next playable size must be a positive safe integer.');
  const git = (args) => {
    const result = spawnSync('git', args, { cwd: projectRoot, encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr || 'Git capacity inspection failed.');
    return result.stdout.trim();
  };
  const latest = `v${JSON.parse(await ordinaryFile(path.join(projectRoot, 'package.json'))).version}`;
  if (!VERSION.test(latest)) throw new Error('Invalid current playable version.');
  const versions = git(['tag', '--list', 'v*'])
    .split('\n')
    .filter((version) => VERSION.test(version))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (!versions.includes(latest))
    throw new Error(`Freeze and tag ${latest} before measuring Pages.`);
  const records = [],
    releases = [];
  for (const version of versions) {
    const directory = path.join(projectRoot, 'releases', version);
    if (!(await fs.lstat(directory)).isDirectory())
      throw new Error(`Expected ordinary release directory: ${directory}`);
    const raw = await ordinaryFile(path.join(directory, 'release.json')),
      record = JSON.parse(raw);
    if (
      record.version !== version ||
      record.sourceRevision !== git(['rev-parse', `${version}^{commit}`])
    )
      throw new Error(`Archive does not match immutable tag ${version}.`);
    const site = await playableSize(path.join(directory, 'site'));
    records.push(record);
    releases.push({
      version,
      sourceRevision: record.sourceRevision,
      ...site,
      recordBytes: raw.length,
    });
  }
  const current = releases.find((release) => release.version === latest),
    record = records.find((release) => release.version === latest),
    index = publishedReleaseIndex(records, repository, latest),
    historicalPlayableBytes = releases.reduce((sum, release) => sum + release.bytes, 0),
    metadataBytes =
      releases.reduce((sum, release) => sum + release.recordBytes, 0) +
      jsonBytes(index.json) +
      Buffer.byteLength(index.html) +
      jsonBytes(record),
    totalBytes = historicalPlayableBytes + current.bytes + metadataBytes;
  if (!Number.isSafeInteger(totalBytes)) throw new Error('Pages total exceeds integer bounds.');
  const report = {
    formatVersion: 1,
    layout: 'exact-root-and-all-versioned-sites',
    latest,
    sourceRevision: current.sourceRevision,
    budgetBytes: PAGES_BUDGET_BYTES,
    totalBytes,
    headroomBytes: PAGES_BUDGET_BYTES - totalBytes,
    withinBudget: totalBytes <= PAGES_BUDGET_BYTES,
    playableVersions: releases.length,
    files: releases.reduce((sum, release) => sum + release.files + 1, 0) + current.files + 4,
    historicalPlayableBytes,
    latestRootCopyBytes: current.bytes,
    metadataBytes,
    releases,
  };
  if (nextPlayableBytes !== undefined) {
    // Root changes to the new tree; all existing versioned trees remain, plus the new one.
    // Exclude ALL metadata, so this is a strict payload-only lower bound, not a pass prediction.
    const minimumBytes = historicalPlayableBytes + nextPlayableBytes * 2;
    if (!Number.isSafeInteger(minimumBytes))
      throw new Error('Next Pages total exceeds integer bounds.');
    report.nextRelease = {
      assumedPlayableBytes: nextPlayableBytes,
      payloadOnlyMinimumBytes: minimumBytes,
      minimumOverBudgetBytes: Math.max(0, minimumBytes - PAGES_BUDGET_BYTES),
      verdict: minimumBytes > PAGES_BUDGET_BYTES ? 'cannot-fit' : 'requires-exact-build',
      metadataIncluded: false,
    };
  }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length && !/^[1-9]\d*$/.test(args[0])))
    throw new Error('Usage: node scripts/pages-capacity.mjs [next-playable-bytes]');
  const report = await inspectPagesCapacity({
    nextPlayableBytes: args.length ? Number(args[0]) : undefined,
  });
  console.log(JSON.stringify(report, null, 2));
  if (!report.withinBudget || report.nextRelease?.verdict === 'cannot-fit') process.exitCode = 1;
}

#!/usr/bin/env node
/**
 * Refresh reviewed controller metadata from immutable published release assets.
 * This is intentionally a maintainer command, not a deployment-time mutation.
 */
import * as fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMMIT, digest, VERSION } from './metadata.mjs';

const controllerDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(controllerDirectory, '../..');
const sourceRepository = 'mekhovov/revealline';

function usage() {
  throw new Error(
    'Usage: sync-release-metadata.mjs --versions v0.49.0,v0.50.0 [--qualification v0.51.0]',
  );
}

function git(...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || `git ${args[0]} failed`);
  return result.stdout.trim();
}

function compareVersions(left, right) {
  const a = left.slice(1).split('.').map(Number),
    b = right.slice(1).split('.').map(Number);
  for (let index = 0; index < 3; index++) if (a[index] !== b[index]) return a[index] - b[index];
  return left.localeCompare(right);
}

async function fetchAsset(version, name, maximumBytes = 8_000_000) {
  const url = `https://github.com/${sourceRepository}/releases/download/${encodeURIComponent(version)}/${encodeURIComponent(name)}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Cannot download ${version}/${name}: HTTP ${response.status}.`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > maximumBytes)
    throw new Error(`Invalid ${version}/${name} size.`);
  return bytes;
}

function parseJSON(bytes, name) {
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new Error(`Invalid JSON in ${name}.`);
  }
}

async function main() {
  const args = process.argv.slice(2),
    versionsIndex = args.indexOf('--versions'),
    qualificationIndex = args.indexOf('--qualification');
  if (
    versionsIndex < 0 ||
    versionsIndex + 1 >= args.length ||
    args.some(
      (arg, index) =>
        index !== versionsIndex &&
        index !== versionsIndex + 1 &&
        index !== qualificationIndex &&
        index !== qualificationIndex + 1,
    )
  )
    usage();
  const versions = [...new Set(args[versionsIndex + 1].split(',').filter(Boolean))];
  if (!versions.length || versions.some((version) => !VERSION.test(version))) usage();
  const qualificationVersion = qualificationIndex < 0 ? '' : args[qualificationIndex + 1];
  if (qualificationIndex >= 0 && (!qualificationVersion || !VERSION.test(qualificationVersion)))
    usage();

  const catalogPath = path.join(controllerDirectory, 'catalog.json'),
    catalog = parseJSON(await fs.readFile(catalogPath), 'catalog.json');
  if (
    catalog.format !== 'revealline-frozen-catalog.v1' ||
    catalog.sourceRepository !== sourceRepository ||
    !Array.isArray(catalog.releases)
  )
    throw new Error('Invalid frozen catalog.');
  const releases = new Map(catalog.releases.map((record) => [record.version, record]));
  for (const version of versions) {
    const [recordBytes, manifestBytes, checksumBytes] = await Promise.all(
      ['release.json', 'manifest.json', 'distribution.zip.sha256'].map((name) =>
        fetchAsset(version, name),
      ),
    );
    const record = parseJSON(recordBytes, `${version}/release.json`),
      manifest = parseJSON(manifestBytes, `${version}/manifest.json`),
      sourceRevision = git('rev-parse', `${version}^{commit}`),
      tagObject = git('rev-parse', `refs/tags/${version}`);
    if (
      record.version !== version ||
      record.sourceRevision !== sourceRevision ||
      manifest.version !== version ||
      manifest.sourceRevision !== sourceRevision ||
      !COMMIT.test(sourceRevision) ||
      !COMMIT.test(tagObject) ||
      checksumBytes.toString('utf8') !== `${record.distributionSha256}  distribution.zip\n`
    )
      throw new Error(`Published metadata identity mismatch for ${version}.`);
    const target = path.join(controllerDirectory, 'metadata', version);
    await fs.mkdir(target, { recursive: true });
    await Promise.all([
      fs.writeFile(path.join(target, 'release.json'), recordBytes),
      fs.writeFile(path.join(target, 'manifest.json'), manifestBytes),
      fs.writeFile(path.join(target, 'distribution.zip.sha256'), checksumBytes),
    ]);
    releases.set(version, {
      version,
      sourceRevision,
      tagObject,
      recordSha256: digest(recordBytes),
      manifestSha256: digest(manifestBytes),
      checksumSha256: digest(checksumBytes),
    });
  }
  catalog.releases = [...releases.values()].sort((left, right) =>
    compareVersions(left.version, right.version),
  );
  await fs.writeFile(catalogPath, JSON.stringify(catalog, null, 2) + '\n');
  if (qualificationVersion) {
    const qualification = await fetchAsset(qualificationVersion, 'source-qualification.json'),
      parsed = parseJSON(qualification, `${qualificationVersion}/source-qualification.json`);
    if (
      parsed.version !== qualificationVersion ||
      !COMMIT.test(parsed.sourceRevision) ||
      parsed.sourceRevision !== git('rev-parse', `${qualificationVersion}^{commit}`) ||
      parsed.passed !== true
    )
      throw new Error(`Published source qualification mismatch for ${qualificationVersion}.`);
    const target = path.join(
      controllerDirectory,
      'evidence',
      `current-${qualificationVersion.replaceAll('.', '')}`,
    );
    await fs.mkdir(target, { recursive: true });
    await fs.writeFile(path.join(target, 'source-qualification.json'), qualification);
    console.log(
      JSON.stringify({ qualificationVersion, qualificationSha256: digest(qualification) }),
    );
  }
  console.log(JSON.stringify({ versions, catalogSha256: digest(await fs.readFile(catalogPath)) }));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

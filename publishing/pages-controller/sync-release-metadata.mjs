#!/usr/bin/env node
/**
 * Refresh reviewed controller metadata from immutable published release assets.
 * This is intentionally a maintainer command, not a deployment-time mutation.
 */
import * as fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMMIT, digest, validateMetadata, VERSION } from './metadata.mjs';
import { validateWaivedSourceQualification } from './source-qualification.mjs';

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

function gitFile(revision, relative) {
  const result = spawnSync('git', ['show', `${revision}:${relative}`], {
    cwd: root,
    encoding: null,
    maxBuffer: 64 * 1024,
  });
  if (result.status !== 0) throw new Error('Cannot read policy evidence from release source.');
  return Buffer.from(result.stdout);
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

async function readRegular(file) {
  try {
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink())
      throw new Error(`Not a regular metadata file: ${file}`);
    return await fs.readFile(file);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

const sameBytes = (left, right) =>
  left === null || right === null ? left === right : left.equals(right);

/** Validate the entire batch before adding files. Existing frozen bytes are never rewritten. */
export async function syncReleaseMetadata({
  directory = controllerDirectory,
  versions,
  qualificationVersion = '',
  download = fetchAsset,
  resolveTag = (version) => ({
    sourceRevision: git('rev-parse', `${version}^{commit}`),
    tagObject: git('rev-parse', `refs/tags/${version}`),
    sourceTree: git('rev-parse', `${version}^{tree}`),
  }),
  readSourceFile = gitFile,
}) {
  if (
    !Array.isArray(versions) ||
    !versions.length ||
    versions.some((version) => !VERSION.test(version)) ||
    (qualificationVersion && !VERSION.test(qualificationVersion))
  )
    usage();
  versions = [...new Set(versions)];
  directory = path.resolve(directory);
  const lockPath = path.join(directory, '.metadata-sync.lock');
  const lock = await fs.open(lockPath, 'wx');
  try {
    return await syncLocked();
  } finally {
    await lock.close();
    await fs.unlink(lockPath);
  }

  async function syncLocked() {
    const catalogPath = path.join(directory, 'catalog.json'),
      catalogBytes = await readRegular(catalogPath),
      catalog = parseJSON(catalogBytes, 'catalog.json');
    if (
      catalog.format !== 'revealline-frozen-catalog.v1' ||
      catalog.sourceRepository !== sourceRepository ||
      !Array.isArray(catalog.releases)
    )
      throw new Error('Invalid frozen catalog.');
    const releases = new Map(catalog.releases.map((record) => [record.version, record]));
    if (
      releases.size !== catalog.releases.length ||
      catalog.releases.some((pin) => !VERSION.test(pin.version))
    )
      throw new Error('Duplicate or invalid frozen catalog version.');
    const observed = new Map([[catalogPath, catalogBytes]]),
      additions = new Map(),
      tags = new Map();
    async function checkParents(file) {
      for (let parent = path.dirname(file); parent !== directory; parent = path.dirname(parent)) {
        try {
          const stat = await fs.lstat(parent);
          if (!stat.isDirectory() || stat.isSymbolicLink())
            throw new Error(`Unsafe metadata directory: ${parent}`);
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }
      }
    }
    async function retainOrAdd(file, bytes, required = false) {
      await checkParents(file);
      const before = await readRegular(file);
      if ((required && before === null) || (before !== null && !before.equals(bytes)))
        throw new Error(`Existing frozen metadata cannot change: ${file}`);
      observed.set(file, before);
      if (before === null) additions.set(file, bytes);
    }
    async function pinTag(version) {
      const tag = await resolveTag(version);
      if (!COMMIT.test(tag.sourceRevision) || !COMMIT.test(tag.tagObject))
        throw new Error(`Invalid local tag identity for ${version}.`);
      tags.set(version, tag);
      return tag;
    }
    let catalogChanged = false;
    for (const version of versions) {
      const [recordBytes, manifestBytes, checksumBytes] = await Promise.all(
        ['release.json', 'manifest.json', 'distribution.zip.sha256'].map((name) =>
          download(version, name),
        ),
      );
      const { sourceRevision, tagObject } = await pinTag(version);
      const pin = {
        version,
        sourceRevision,
        tagObject,
        recordSha256: digest(recordBytes),
        manifestSha256: digest(manifestBytes),
        checksumSha256: digest(checksumBytes),
      };
      validateMetadata({ recordBytes, manifestBytes, checksumBytes, pin });
      const existing = releases.get(version);
      if (existing) {
        if (existing.sourceRevision !== sourceRevision || existing.tagObject !== tagObject)
          throw new Error(`Existing frozen tag cannot change: ${version}`);
        validateMetadata({
          recordBytes,
          manifestBytes,
          checksumBytes,
          pin: existing,
        });
      }
      const target = path.join(directory, 'metadata', version);
      for (const [name, bytes] of [
        ['release.json', recordBytes],
        ['manifest.json', manifestBytes],
        ['distribution.zip.sha256', checksumBytes],
      ])
        await retainOrAdd(path.join(target, name), bytes, Boolean(existing));
      if (!existing) {
        releases.set(version, pin);
        catalogChanged = true;
      }
    }
    let qualificationSha256;
    if (qualificationVersion) {
      const qualification = await download(qualificationVersion, 'source-qualification.json'),
        parsed = parseJSON(qualification, `${qualificationVersion}/source-qualification.json`),
        tag = await pinTag(qualificationVersion),
        pin = releases.get(qualificationVersion);
      const legacy = parsed.format === 'revealline-source-qualification.v1';
      if (
        !pin ||
        pin.sourceRevision !== tag.sourceRevision ||
        pin.tagObject !== tag.tagObject ||
        parsed.version !== qualificationVersion ||
        parsed.sourceRevision !== tag.sourceRevision ||
        (legacy && parsed.passed !== true)
      )
        throw new Error(`Published source qualification mismatch for ${qualificationVersion}.`);
      if (!legacy) {
        if (parsed.format !== 'revealline-source-qualification.v2' || !COMMIT.test(tag.sourceTree))
          throw new Error(`Published source qualification mismatch for ${qualificationVersion}.`);
        await validateWaivedSourceQualification({
          qualification: parsed,
          version: qualificationVersion,
          sourceRevision: tag.sourceRevision,
          sourceTree: tag.sourceTree,
          readPolicyEvidence: readSourceFile,
        });
      }
      const target = path.join(
        directory,
        'evidence',
        `current-${qualificationVersion.replaceAll('.', '')}`,
      );
      await retainOrAdd(path.join(target, 'source-qualification.json'), qualification);
      qualificationSha256 = digest(qualification);
    }
    const output = catalogChanged
      ? Buffer.from(
          JSON.stringify(
            {
              ...catalog,
              releases: [...releases.values()].sort((a, b) =>
                compareVersions(a.version, b.version),
              ),
            },
            null,
            2,
          ) + '\n',
        )
      : catalogBytes;
    // Network work can take time. Reject concurrent edits before publishing any addition.
    for (const [file, before] of observed)
      if (!sameBytes(await readRegular(file), before))
        throw new Error(`Metadata changed during sync: ${file}`);
    for (const [version, tag] of tags) {
      const current = await resolveTag(version);
      if (current.sourceRevision !== tag.sourceRevision || current.tagObject !== tag.tagObject)
        throw new Error(`Tag changed during sync: ${version}`);
    }
    for (const [file, before] of observed) {
      await checkParents(file);
      if (!sameBytes(await readRegular(file), before))
        throw new Error(`Metadata changed during sync: ${file}`);
    }
    if (additions.size || catalogChanged) {
      const stage = await fs.mkdtemp(path.join(directory, '.metadata-sync-')),
        linked = [];
      try {
        let index = 0;
        for (const [file, bytes] of additions) {
          const staged = path.join(stage, String(index++));
          await fs.writeFile(staged, bytes, { flag: 'wx' });
          await checkParents(file);
          await fs.mkdir(path.dirname(file), { recursive: true });
          await checkParents(file);
          // A racing file is never overwritten, even if it appeared after preflight.
          await fs.link(staged, file);
          linked.push(file);
        }
        if (catalogChanged) {
          const staged = path.join(stage, 'catalog.json');
          await fs.writeFile(staged, output, { flag: 'wx' });
          for (const file of linked) await checkParents(file);
          if (!sameBytes(await readRegular(catalogPath), catalogBytes))
            throw new Error('Catalog changed during sync.');
          await fs.rename(staged, catalogPath);
        }
      } catch (error) {
        for (const file of linked) await fs.unlink(file);
        throw error;
      } finally {
        await fs.rm(stage, { recursive: true, force: true });
      }
    }
    return {
      versions,
      catalogSha256: digest(output),
      ...(qualificationVersion ? { qualificationVersion, qualificationSha256 } : {}),
    };
  }
}

async function main() {
  const args = process.argv.slice(2),
    options = new Map();
  for (let i = 0; i < args.length; i += 2) {
    if (
      !['--versions', '--qualification'].includes(args[i]) ||
      !args[i + 1] ||
      options.has(args[i])
    )
      usage();
    options.set(args[i], args[i + 1]);
  }
  if (!options.has('--versions')) usage();
  console.log(
    JSON.stringify(
      await syncReleaseMetadata({
        versions: options.get('--versions').split(','),
        qualificationVersion: options.get('--qualification') || '',
      }),
    ),
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });

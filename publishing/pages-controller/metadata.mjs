/** Historical bridges use authenticated metadata; original payloads stay at admitted archives. */
import { createHash } from 'node:crypto';
import { archiveRedirect, archiveRetirementWorker } from '../../scripts/pages-archive.mjs';

export const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const jsonBytes = (value) => Buffer.from(JSON.stringify(value, null, 2) + '\n');
export const VERSION = /^v\d+\.\d+\.\d+$/;
export const SHA = /^[a-f0-9]{64}$/;
export const COMMIT = /^[a-f0-9]{40}$/;

function versionParts(version) {
  if (!VERSION.test(version)) throw new Error('Invalid release version.');
  return version.slice(1).split('.').map(Number);
}

export function validReleaseRetention(value) {
  return value === 'all' || (Number.isSafeInteger(value) && value >= 1 && value <= 100);
}

export function validRetentionConfiguration(configuration) {
  const global = Object.hasOwn(configuration, 'retainedReleaseCount');
  const perMajor = Object.hasOwn(configuration, 'retainedReleasesPerMajor');
  if (global === perMajor) return false;
  return global
    ? Number.isSafeInteger(configuration.retainedReleaseCount) &&
        configuration.retainedReleaseCount >= 1 &&
        configuration.retainedReleaseCount <= 100
    : validReleaseRetention(configuration.retainedReleasesPerMajor);
}

/** Global stable selection includes an explicitly selected rollback release. */
export function selectReleaseMetadata(metadata, configuration) {
  if (!(metadata instanceof Map) || !validRetentionConfiguration(configuration))
    throw new Error('Invalid release retention policy.');
  if (!Object.hasOwn(configuration, 'retainedReleaseCount'))
    return retainRecentMetadata(metadata, configuration.retainedReleasesPerMajor);
  if (!metadata.has(configuration.currentVersion))
    throw new Error('Current release is not in the stable catalog.');
  const versions = [...metadata.keys()];
  for (const version of versions) versionParts(version);
  versions.sort((a, b) => {
    const left = a.slice(1).split('.').map(BigInt),
      right = b.slice(1).split('.').map(BigInt);
    for (let index = 0; index < 3; index++) {
      if (left[index] !== right[index]) return left[index] > right[index] ? -1 : 1;
    }
    return a.localeCompare(b);
  });
  const retained = new Set([
    configuration.currentVersion,
    ...versions
      .filter((v) => v !== configuration.currentVersion)
      .slice(0, configuration.retainedReleaseCount - 1),
  ]);
  return new Map([...metadata].filter(([version]) => retained.has(version)));
}

/** Keep all validated history, or a bounded recent set for every semantic major. */
export function retainRecentMetadata(metadata, retainedReleasesPerMajor) {
  if (!(metadata instanceof Map) || !validReleaseRetention(retainedReleasesPerMajor))
    throw new Error('Invalid per-major release retention policy.');
  const groups = new Map();
  for (const [version, item] of metadata) {
    const parts = versionParts(version),
      major = parts[0];
    if (!groups.has(major)) groups.set(major, []);
    groups.get(major).push({ version, item, parts });
  }
  const retained = new Set();
  for (const rows of groups.values()) {
    rows.sort((left, right) => {
      for (let index = 0; index < 3; index++) {
        if (left.parts[index] !== right.parts[index]) return left.parts[index] - right.parts[index];
      }
      return left.version.localeCompare(right.version);
    });
    const selected =
      retainedReleasesPerMajor === 'all' ? rows : rows.slice(-retainedReleasesPerMajor);
    for (const row of selected) retained.add(row.version);
  }
  return new Map([...metadata].filter(([version]) => retained.has(version)));
}

export function exact(value, keys) {
  return (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join(',') === [...keys].sort().join(',')
  );
}
export function safePath(value) {
  if (
    typeof value !== 'string' ||
    value.length > 1024 ||
    /[\\\x00-\x1f\x7f:%?#]/.test(value) ||
    value.split('/').some((part) => !part || part === '.' || part === '..')
  )
    throw new Error('Unsafe publication path.');
  return value;
}
export function parseJSON(bytes, limit = 8_000_000) {
  if (!(bytes instanceof Uint8Array) || bytes.length > limit || !bytes.length)
    throw new Error('Metadata exceeds its byte budget.');
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
export function validateMetadata({ recordBytes, manifestBytes, checksumBytes, pin }) {
  if (
    !exact(pin, [
      'version',
      'sourceRevision',
      'tagObject',
      'recordSha256',
      'manifestSha256',
      'checksumSha256',
    ]) ||
    !VERSION.test(pin.version) ||
    !COMMIT.test(pin.sourceRevision) ||
    !COMMIT.test(pin.tagObject) ||
    ![pin.recordSha256, pin.manifestSha256, pin.checksumSha256].every((x) => SHA.test(x))
  )
    throw new Error('Invalid frozen metadata pin.');
  if (
    digest(recordBytes) !== pin.recordSha256 ||
    digest(manifestBytes) !== pin.manifestSha256 ||
    digest(checksumBytes) !== pin.checksumSha256
  )
    throw new Error('Frozen metadata byte pin mismatch.');
  const record = parseJSON(recordBytes, 4096),
    manifest = parseJSON(manifestBytes);
  if (
    !exact(record, [
      'formatVersion',
      'version',
      'sourceRevision',
      ...(record.formatVersion === 2
        ? ['sourceTree', 'sourceUrl', 'sourceManifestSha256']
        : ['sourceArchiveSha256']),
      'distributionSha256',
      'manifestSha256',
      'play',
      'download',
    ]) ||
    ![1, 2].includes(record.formatVersion) ||
    record.version !== pin.version ||
    record.sourceRevision !== pin.sourceRevision ||
    record.manifestSha256 !== pin.manifestSha256 ||
    (record.formatVersion === 2
      ? !COMMIT.test(record.sourceTree) ||
        !SHA.test(record.sourceManifestSha256) ||
        record.sourceUrl !==
          `https://github.com/mekhovov/revealline/archive/${record.sourceRevision}.tar.gz`
      : !SHA.test(record.sourceArchiveSha256)) ||
    !SHA.test(record.distributionSha256) ||
    record.play !== `${pin.version}/site/game/` ||
    record.download !== `${pin.version}/site/distribution.zip`
  )
    throw new Error('Frozen release record mismatch.');
  if (
    Buffer.from(checksumBytes).toString('utf8') !==
    `${record.distributionSha256}  distribution.zip\n`
  )
    throw new Error('Original distribution checksum mismatch.');
  if (
    !exact(manifest, [
      'formatVersion',
      'version',
      'sourceRevision',
      'entry',
      'totalBytes',
      'files',
    ]) ||
    manifest.formatVersion !== 1 ||
    manifest.version !== pin.version ||
    manifest.sourceRevision !== pin.sourceRevision ||
    manifest.entry !== 'game/index.html' ||
    !Array.isArray(manifest.files) ||
    !manifest.files.length ||
    manifest.files.length > 20000 ||
    !Number.isSafeInteger(manifest.totalBytes) ||
    manifest.totalBytes < 0 ||
    manifest.totalBytes > 800_000_000
  )
    throw new Error('Invalid frozen manifest.');
  const seen = new Set();
  let total = 0;
  for (const row of manifest.files) {
    if (
      !exact(row, ['path', 'bytes', 'sha256']) ||
      !Number.isSafeInteger(row.bytes) ||
      row.bytes < 0 ||
      !SHA.test(row.sha256)
    )
      throw new Error('Invalid frozen file descriptor.');
    safePath(row.path);
    if (
      [
        'manifest.json',
        'distribution.zip',
        'distribution.zip.sha256',
        '.xonix-build.json',
      ].includes(row.path) ||
      row.path === 'releases' ||
      row.path.startsWith('releases/') ||
      seen.has(row.path)
    )
      throw new Error('Duplicate or reserved frozen file.');
    seen.add(row.path);
    total += row.bytes;
  }
  if (total !== manifest.totalBytes || !seen.has('index.html') || !seen.has(manifest.entry))
    throw new Error('Frozen manifest total or entry mismatch.');
  return {
    record,
    manifest,
    recordBytes: Buffer.from(recordBytes),
    manifestBytes: Buffer.from(manifestBytes),
    checksumBytes: Buffer.from(checksumBytes),
  };
}

/** No historical asset reads or network requests. Canonical URLs come from validated allocation. */
export function metadataBridges(metadata, canonicalSite) {
  const { record, manifest, manifestBytes, checksumBytes } = metadata;
  const url = new URL(canonicalSite);
  if (
    url.protocol !== 'https:' ||
    !/^[a-zA-Z0-9-]+\.github\.io$/.test(url.hostname) ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !new RegExp(`^/[A-Za-z0-9_.-]+/releases/${record.version.replaceAll('.', '\\.')}\/site/$`).test(
      url.pathname,
    )
  )
    throw new Error('Invalid admitted archive URL.');
  const files = new Map([
    ['manifest.json', Buffer.from(manifestBytes)],
    ['distribution.zip.sha256', Buffer.from(checksumBytes)],
  ]);
  for (const row of manifest.files) {
    if (row.path.endsWith('.html'))
      files.set(
        row.path,
        Buffer.from(
          archiveRedirect(canonicalSite + row.path.split('/').map(encodeURIComponent).join('/')),
        ),
      );
    else if (row.path === 'service-worker.js')
      files.set(row.path, Buffer.from(archiveRetirementWorker(canonicalSite)));
  }
  return files;
}

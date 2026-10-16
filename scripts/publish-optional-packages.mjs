#!/usr/bin/env node
/** Existing-release delivery and selector staging only. Never allocates or promotes a release. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import {
  createOptionalPackageReview,
  verifyOptionalPackageReview,
} from '../publishing/optional-package-admission.mjs';
import {
  validateOptionalPackagePublication,
  frozenOptionalPackageOverlay,
  selectRetainedOptionalPackageRelease,
} from '../publishing/optional-package-promotion.mjs';
import { editionHash } from '../publishing/edition-zip.mjs';
import {
  deliverOptionalPackageDraft,
  sameOptionalDeliveryReceipt,
} from '../publishing/optional-package-delivery.mjs';

const [command, ...args] = process.argv.slice(2),
  options = {};
if (
  ![
    'review-template',
    'verify',
    'upload-draft',
    'sync-selector',
    'select-retained',
    'stage-pages',
  ].includes(command)
)
  throw new Error(
    'Use review-template, verify, upload-draft, sync-selector, select-retained or stage-pages.',
  );
for (let index = 0; index < args.length; index += 2) {
  if (
    ![
      '--bundle',
      '--review',
      '--repository',
      '--selector',
      '--base-path',
      '--version',
      '--packages',
      '--release-id',
      '--out',
    ].includes(args[index]) ||
    !args[index + 1] ||
    options[args[index]]
  )
    throw new Error('Invalid optional publication option.');
  options[args[index]] = args[index + 1];
}
const releaseId = Number(options['--release-id']);
if (
  command === 'upload-draft'
    ? !/^[1-9]\d*$/.test(options['--release-id'] ?? '') || !Number.isSafeInteger(releaseId)
    : options['--release-id'] !== undefined
)
  throw new Error('Only upload-draft requires an explicit positive --release-id.');
const parse = (bytes) => JSON.parse(Buffer.from(bytes).toString('utf8'));
const readJSON = async (file, limit = 1024 * 1024) => {
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.size > limit)
    throw new Error('Optional metadata must be an ordinary bounded file.');
  return fs.readFile(file);
};
const repository = options['--repository'];
const gh = (args, { binary = false, limit = 9 * 1024 * 1024 } = {}) => {
  const result = spawnSync('gh', args, { encoding: binary ? undefined : 'utf8', maxBuffer: limit });
  if (result.status !== 0 || result.error)
    throw new Error('Optional release operation failed; existing artifacts were not replaced.');
  return result.stdout;
};
const api = (route) => parse(gh(['api', `repos/${repository}/${route}`]));
function remoteReader() {
  if (repository !== 'mekhovov/revealline' || options['--base-path'] !== '/revealline/')
    throw new Error('Optional selection requires the configured Pages target.');
  const releases = new Map();
  const release = (version) => {
    if (!/^v\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid published optional version.');
    if (!releases.has(version)) {
      const row = api(`releases/tags/${version}`);
      if (row.draft || row.prerelease || row.tag_name !== version || !Array.isArray(row.assets))
        throw new Error('Optional selection requires a published stable release.');
      releases.set(version, row);
    }
    return releases.get(version);
  };
  return {
    targetBasePath: options['--base-path'],
    resolveReleaseIdentity: async (version) => {
      release(version);
      const commit = api(`commits/tags/${version}`);
      return { sourceRevision: commit.sha, sourceTree: commit.commit?.tree?.sha };
    },
    readReleaseAsset: async (version, name, limit) => {
      const assets = release(version).assets.filter((row) => row.name === name);
      if (
        assets.length !== 1 ||
        assets[0].state !== 'uploaded' ||
        !Number.isSafeInteger(assets[0].size) ||
        assets[0].size <= 0 ||
        assets[0].size > limit ||
        !Number.isSafeInteger(assets[0].id) ||
        assets[0].id <= 0
      )
        throw new Error('Published optional artifact is missing or oversized.');
      const bytes = gh(
        [
          'api',
          '-H',
          'Accept: application/octet-stream',
          `repos/${repository}/releases/assets/${assets[0].id}`,
        ],
        { binary: true, limit },
      );
      if (bytes.length !== assets[0].size)
        throw new Error('Published optional download is truncated.');
      return bytes;
    },
  };
}
async function replaceSelector(file, original, updated) {
  const check = async () => {
    if (!(await fs.readFile(file)).equals(original))
      throw new Error('Optional selector changed during verification.');
  };
  await check();
  const next = `${file}.next`;
  await fs.writeFile(next, JSON.stringify(updated, null, 2) + '\n', { flag: 'wx' });
  try {
    await check();
    await fs.rename(next, file);
  } catch (error) {
    await fs.rm(next, { force: true });
    throw error;
  }
}
if (command === 'stage-pages') {
  if (
    !options['--out'] ||
    !options['--selector'] ||
    options['--bundle'] ||
    options['--review'] ||
    options['--version'] ||
    options['--packages']
  )
    throw new Error('Pages staging needs an existing output directory and a reviewed selector.');
  const output = path.resolve(options['--out']);
  if (!(await fs.lstat(output)).isDirectory() || (await fs.lstat(output)).isSymbolicLink())
    throw new Error('Pages output must be an ordinary existing directory.');
  const files = await frozenOptionalPackageOverlay(
    parse(await readJSON(options['--selector'])),
    remoteReader(),
  );
  // A complete optional overlay is additive: never replace the main game or a
  // previously staged practice tree. The caller checks combined hosted capacity.
  try {
    await fs.lstat(path.join(output, 'practice'));
    throw new Error('Pages practice directory already exists.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  for (const [name, bytes] of files) {
    const target = path.join(output, name);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, bytes, { flag: 'wx' });
  }
  console.log(
    JSON.stringify({
      optionalFiles: files.size,
      optionalBytes: [...files.values()].reduce((sum, bytes) => sum + bytes.length, 0),
      index: 'practice/index.json',
    }),
  );
  process.exit(0);
}
if (options['--out']) throw new Error('--out belongs only to stage-pages.');
if (command === 'select-retained') {
  if (
    !options['--selector'] ||
    !options['--version'] ||
    !options['--packages'] ||
    options['--bundle'] ||
    options['--review']
  )
    throw new Error('Optional rollback needs an explicit selector, version and package list.');
  const file = path.resolve(options['--selector']),
    original = await readJSON(file);
  const updated = await selectRetainedOptionalPackageRelease(
    parse(original),
    { version: options['--version'], packageIds: options['--packages'].split(',') },
    remoteReader(),
  );
  await replaceSelector(file, original, updated);
  console.log('Verified optional rollback staged locally. No release changed.');
  process.exit(0);
}
if (options['--version'] || options['--packages'] || !options['--bundle'] || !options['--review'])
  throw new Error(
    'Optional bundle and review are required; version/packages belong only to rollback.',
  );
const directory = path.resolve(options['--bundle']);
const envelopeBytes = await readJSON(path.join(directory, 'optional-packages.json'));
if (command === 'review-template') {
  await fs.writeFile(
    options['--review'],
    JSON.stringify(createOptionalPackageReview(envelopeBytes), null, 2) + '\n',
    { flag: 'wx' },
  );
  console.log('Pending optional review created. No qualification claimed.');
  process.exit(0);
}
const envelope = parse(envelopeBytes),
  reviewBytes = await readJSON(options['--review']),
  review = parse(reviewBytes);
const frozen = new Map([
  ['optional-packages.json', envelopeBytes],
  ['optional-package-review.json', reviewBytes],
]);
const admission = await verifyOptionalPackageReview(envelopeBytes, review, {
  read: async (row) => {
    if (!/^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(row.path))
      throw new Error('Invalid optional release artifact path.');
    const bytes = await readJSON(path.join(directory, row.path), row.bytes);
    if (bytes.length !== row.bytes || editionHash(bytes) !== row.sha256)
      throw new Error('Optional original artifact changed.');
    frozen.set(row.path, bytes);
    return bytes;
  },
});
if (command === 'verify') {
  console.log(JSON.stringify(admission));
  process.exit(0);
}
if (!/^[\w.-]+\/[\w.-]+$/.test(repository ?? ''))
  throw new Error('An explicit GitHub repository is required.');
if (command === 'sync-selector') {
  if (!options['--selector']) throw new Error('Optional selector path is required.');
  const file = path.resolve(options['--selector']),
    original = await readJSON(file),
    current = validateOptionalPackagePublication(parse(original));
  if (current.releases.some((row) => row.version === envelope.version))
    throw new Error('This optional version is already retained; use explicit rollback selection.');
  const ids = envelope.packages.map((row) => row.id);
  const updated = validateOptionalPackagePublication({
    ...current,
    releases: [
      ...current.releases.map((row) => ({
        ...row,
        activePackageIds: row.activePackageIds.filter((id) => !ids.includes(id)),
      })),
      {
        version: envelope.version,
        basePath: options['--base-path'],
        envelopeSha256: editionHash(envelopeBytes),
        reviewSha256: editionHash(reviewBytes),
        packageIds: ids,
        activePackageIds: ids,
      },
    ],
  });
  await frozenOptionalPackageOverlay(updated, remoteReader());
  await replaceSelector(file, original, updated);
  console.log(
    'Optional selector staged from verified downloaded release bytes. No release changed.',
  );
  process.exit(0);
}
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'optional-upload-'));
try {
  const receipt = await deliverOptionalPackageDraft({
    repository,
    releaseId,
    envelope,
    envelopeBytes,
    reviewBytes,
    files: frozen,
    readRelease: (id) => api(`releases/${id}`),
    readTagRelease: (version) => api(`releases/tags/${version}`),
    readTagIdentity: (version) => {
      const commit = api(`commits/tags/${version}`);
      return { sourceRevision: commit.sha, sourceTree: commit.commit?.tree?.sha };
    },
    readAsset: (id, limit) =>
      gh(
        [
          'api',
          '-H',
          'Accept: application/octet-stream',
          `repos/${repository}/releases/assets/${id}`,
        ],
        { binary: true, limit },
      ),
    uploadAsset: async (url, name, bytes) => {
      const file = path.join(temporary, name);
      await fs.writeFile(file, bytes, { flag: 'wx' });
      return parse(
        gh([
          'api',
          '--method',
          'POST',
          '-H',
          'Content-Type: application/octet-stream',
          url,
          '--input',
          file,
        ]),
      );
    },
    record: (event) =>
      fs.appendFile(
        path.join(directory, 'optional-package-delivery-attempts.jsonl'),
        JSON.stringify({ at: new Date().toISOString(), ...event }) + '\n',
      ),
  });
  const receiptPath = path.join(directory, 'optional-package-delivery.json'),
    receiptBytes = Buffer.from(JSON.stringify(receipt, null, 2) + '\n');
  try {
    await fs.writeFile(receiptPath, receiptBytes, { flag: 'wx' });
  } catch (error) {
    if (
      error.code !== 'EEXIST' ||
      !sameOptionalDeliveryReceipt(parse(await readJSON(receiptPath)), receipt)
    )
      throw error;
  }
  console.log(JSON.stringify(receipt));
} finally {
  await fs.rm(temporary, { recursive: true, force: true });
}

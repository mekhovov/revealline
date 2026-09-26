#!/usr/bin/env node
/** Explicit frozen edition promotion. Never creates a tag, publishes a draft, or rebuilds. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import {
  verifyEditionReview,
  EDITION_REVIEW_GATES,
  validateEditionPublication,
  frozenEditionOverlay,
  selectRetainedEditionRelease,
} from '../publishing/edition-promotion.mjs';
import { editionHash } from '../publishing/edition-zip.mjs';

const [command, ...args] = process.argv.slice(2),
  options = {};
if (
  !['review-template', 'verify', 'upload-draft', 'sync-selector', 'select-retained'].includes(
    command,
  )
)
  throw new Error(
    'Usage: publish-editions.mjs review-template|verify|upload-draft|sync-selector --bundle DIR --review FILE [--repository OWNER/REPO --selector FILE --base-path /PATH/]; or select-retained --version vX.Y.Z --editions ID[,ID] --selector FILE --repository OWNER/REPO --base-path /PATH/',
  );
for (let i = 0; i < args.length; i += 2) {
  if (
    ![
      '--bundle',
      '--review',
      '--repository',
      '--selector',
      '--base-path',
      '--version',
      '--editions',
    ].includes(args[i]) ||
    !args[i + 1] ||
    options[args[i]]
  )
    throw new Error('Invalid or duplicate promotion option.');
  options[args[i]] = args[i + 1];
}
if (command === 'select-retained') {
  if (
    options['--bundle'] ||
    options['--review'] ||
    !options['--selector'] ||
    !options['--version'] ||
    !options['--editions'] ||
    options['--repository'] !== 'mekhovov/revealline' ||
    options['--base-path'] !== '/revealline/'
  )
    throw new Error(
      'Retained selection needs explicit version, editions, selector and the configured Pages target.',
    );
  const selectorPath = path.resolve(options['--selector']);
  const originalSelector = await fs.readFile(selectorPath);
  const releases = new Map();
  const request = (args, maxBuffer, binary = false) => {
    const result = spawnSync('gh', args, { encoding: binary ? undefined : 'utf8', maxBuffer });
    if (result.status !== 0 || result.error)
      throw new Error('Retained release download failed; the selector was not changed.');
    return result.stdout;
  };
  const api = (route) =>
    JSON.parse(request(['api', `repos/mekhovov/revealline/${route}`], 8_000_000));
  const publishedRelease = (version) => {
    if (!releases.has(version)) {
      const release = api(`releases/tags/${version}`);
      if (
        release.draft ||
        release.prerelease ||
        release.tag_name !== version ||
        !Array.isArray(release.assets)
      )
        throw new Error('Retained selection requires the original published stable release.');
      releases.set(version, release);
    }
    return releases.get(version);
  };
  const updated = await selectRetainedEditionRelease(
    JSON.parse(originalSelector),
    { version: options['--version'], editionIds: options['--editions'].split(',') },
    {
      targetBasePath: options['--base-path'],
      resolveReleaseIdentity: async (version) => {
        publishedRelease(version);
        const commit = api(`commits/${version}`);
        return { sourceRevision: commit.sha, sourceTree: commit.commit?.tree?.sha };
      },
      readReleaseAsset: async (version, name, limit) => {
        const rows = publishedRelease(version).assets.filter((asset) => asset.name === name);
        if (
          rows.length !== 1 ||
          rows[0].state !== 'uploaded' ||
          !Number.isSafeInteger(rows[0].size) ||
          rows[0].size <= 0 ||
          rows[0].size > limit ||
          !Number.isSafeInteger(rows[0].id) ||
          rows[0].id <= 0
        )
          throw new Error(
            'Retained release asset is missing or exceeds its exact download budget.',
          );
        const bytes = request(
          [
            'api',
            '-H',
            'Accept: application/octet-stream',
            `repos/mekhovov/revealline/releases/assets/${rows[0].id}`,
          ],
          limit,
          true,
        );
        if (bytes.length !== rows[0].size)
          throw new Error('Retained release download length differs.');
        return bytes;
      },
    },
  );
  if (!(await fs.readFile(selectorPath)).equals(originalSelector))
    throw new Error('The selector changed during verification; review and retry.');
  const next = `${selectorPath}.next`;
  await fs.writeFile(next, `${JSON.stringify(updated, null, 2)}\n`, { flag: 'wx' });
  await fs.rename(next, selectorPath);
  console.log(
    'Retained edition selection verified and staged locally. Review it through the sole Pages publisher; no release was changed.',
  );
  process.exit(0);
}
if (options['--version'] || options['--editions'])
  throw new Error('Explicit version and editions belong to select-retained only.');
if (!options['--bundle'] || !options['--review'])
  throw new Error('Bundle and review paths are required.');
const directory = path.resolve(options['--bundle']);
const original = await fs.readFile(path.join(directory, 'editions.json')),
  envelope = JSON.parse(original);
const descriptor = (name, bytes) => ({
  path: name,
  bytes: bytes.length,
  sha256: editionHash(bytes),
});
if (command === 'review-template') {
  const review = {
    format: 'revealline-edition-review.v1',
    version: envelope.version,
    sourceRevision: envelope.sourceRevision,
    sourceTree: envelope.sourceTree,
    envelopeSha256: editionHash(original),
    publication: 'public',
    editions: envelope.editions.map((entry) => ({
      id: entry.id,
      gates: EDITION_REVIEW_GATES.map((id) => ({
        id,
        status: 'pending',
        reviewer: '',
        reviewedAt: '',
        evidence: null,
      })),
    })),
  };
  await fs.writeFile(options['--review'], `${JSON.stringify(review, null, 2)}\n`, { flag: 'wx' });
  console.log('Created pending review template. No qualification is claimed.');
  process.exit(0);
}
const reviewBytes = await fs.readFile(options['--review']),
  review = JSON.parse(reviewBytes);
const frozen = new Map([
  ['editions.json', original],
  ['edition-review.json', reviewBytes],
]);
const read = async (row) => {
  if (!/^[A-Za-z0-9_.-]+$/.test(row.path) || ['.', '..'].includes(row.path))
    throw new Error('Invalid release asset path.');
  const file = path.join(directory, row.path),
    stat = await fs.lstat(file);
  if (!stat.isFile() || stat.size !== row.bytes || stat.size > 950_000_000)
    throw new Error('Release artifact size differs.');
  const bytes = await fs.readFile(file);
  if (editionHash(bytes) !== row.sha256) throw new Error('Release artifact digest differs.');
  frozen.set(row.path, bytes);
  return bytes;
};
const admission = await verifyEditionReview(original, review, { read });
if (command === 'verify') {
  console.log(JSON.stringify(admission));
  process.exit(0);
}
const repository = options['--repository'];
if (!/^[\w.-]+\/[\w.-]+$/.test(repository ?? ''))
  throw new Error('An explicit GitHub repository is required.');
const gh = (args, binary = false) => {
  const result = spawnSync('gh', args, {
    encoding: binary ? undefined : 'utf8',
    maxBuffer: 950_000_000,
  });
  if (result.status !== 0)
    throw new Error('GitHub release operation failed; existing artifacts were not replaced.');
  return result.stdout;
};
const api = (route) => JSON.parse(gh(['api', `repos/${repository}/${route}`]));
let release = api(`releases/tags/${envelope.version}`);
const taggedCommit = api(`commits/${envelope.version}`);
if (
  taggedCommit.sha !== envelope.sourceRevision ||
  taggedCommit.commit?.tree?.sha !== envelope.sourceTree
)
  throw new Error('Release tag does not resolve to the frozen engine commit and tree.');
if (command === 'upload-draft' && !release.draft)
  throw new Error(
    'Upload is limited to an existing draft release. Published releases are immutable.',
  );
if (command === 'sync-selector' && (release.draft || release.prerelease))
  throw new Error('Only a published stable release may enter the deployment selector.');
const verifyRemote = (name, bytes) => {
  const rows = release.assets.filter((asset) => asset.name === name);
  if (rows.length !== 1 || rows[0].state !== 'uploaded' || rows[0].size !== bytes.length)
    throw new Error(`Published asset is missing or differs: ${name}`);
  const downloaded = gh(
    [
      'api',
      '-H',
      'Accept: application/octet-stream',
      `repos/${repository}/releases/assets/${rows[0].id}`,
    ],
    true,
  );
  if (editionHash(downloaded) !== editionHash(bytes))
    throw new Error(`Downloaded release asset differs: ${name}`);
};
if (command === 'upload-draft') {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'revealline-edition-upload-'));
  try {
    // Publish the envelope last, after every dependency is present and reread.
    const names = [...frozen.keys()]
      .filter((name) => name !== 'editions.json')
      .concat('editions.json');
    for (const name of names) {
      const bytes = frozen.get(name);
      release = api(`releases/tags/${envelope.version}`);
      if (!release.draft)
        throw new Error(
          'The release was published during upload. Stop and review its existing assets.',
        );
      if (!release.assets.some((asset) => asset.name === name)) {
        const filename = path.join(temporary, name);
        await fs.writeFile(filename, bytes, { flag: 'wx' });
        gh(['release', 'upload', envelope.version, filename, '--repo', repository]);
        release = api(`releases/tags/${envelope.version}`);
      }
      verifyRemote(name, bytes);
    }
    const receipt = {
      format: 'revealline-edition-delivery.v1',
      repository,
      version: envelope.version,
      sourceRevision: envelope.sourceRevision,
      envelopeSha256: editionHash(original),
      reviewSha256: editionHash(reviewBytes),
      status: 'draft-assets-downloaded-and-verified',
      files: [...frozen].map(([name, bytes]) => descriptor(name, bytes)),
    };
    await fs.writeFile(
      path.join(directory, 'edition-delivery.json'),
      `${JSON.stringify(receipt, null, 2)}\n`,
      { flag: 'wx' },
    );
    console.log(JSON.stringify(receipt));
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
} else {
  if (repository !== 'mekhovov/revealline' || options['--base-path'] !== '/revealline/')
    throw new Error(
      'This selector belongs to the configured mekhovov/revealline Pages target. Add another reviewed target before routing elsewhere.',
    );
  for (const [name, bytes] of frozen) verifyRemote(name, bytes);
  const selectorPath = options['--selector'];
  if (!selectorPath || !options['--base-path'])
    throw new Error('Selector path and deployment base path are required.');
  const selector = validateEditionPublication(JSON.parse(await fs.readFile(selectorPath, 'utf8')));
  if (selector.releases.some((row) => row.version === envelope.version))
    throw new Error(
      'This immutable version is already selected. Review a rollback by editing activeEditionIds only.',
    );
  const ids = envelope.editions.map((entry) => entry.id);
  const updated = validateEditionPublication({
    ...selector,
    releases: [
      ...selector.releases.map((row) => ({
        ...row,
        activeEditionIds: row.activeEditionIds.filter((id) => !ids.includes(id)),
      })),
      {
        version: envelope.version,
        envelopeSha256: editionHash(original),
        reviewSha256: editionHash(reviewBytes),
        basePath: options['--base-path'],
        editionIds: ids,
        activeEditionIds: ids,
      },
    ],
  });
  await frozenEditionOverlay(
    { ...updated, releases: [updated.releases.at(-1)] },
    {
      targetBasePath: options['--base-path'],
      resolveReleaseIdentity: async () => ({
        sourceRevision: taggedCommit.sha,
        sourceTree: taggedCommit.commit.tree.sha,
      }),
      readReleaseAsset: async (_version, name) => frozen.get(name),
    },
  );
  const next = `${selectorPath}.next`;
  await fs.writeFile(next, `${JSON.stringify(updated, null, 2)}\n`, { flag: 'wx' });
  await fs.rename(next, selectorPath);
  console.log(
    'Selector updated from downloaded, verified release bytes. Review this change through the sole Pages publisher.',
  );
}

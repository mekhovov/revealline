/** Fail-closed source-version and previous-public-release guards for release PRs. */
import * as fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMMIT, exact, parseJSON, SHA, VERSION } from './metadata.mjs';
import {
  latestStableRelease,
  publishedReleasePages,
  releaseDecision,
} from './release-policy.mjs';

const MAX_PUBLIC_BYTES = 1_000_000;

function stableVersion(value) {
  if (typeof value !== 'string' || !/^\d+\.\d+\.\d+$/.test(value))
    throw new Error('Release source must use one stable numeric version.');
  return value;
}

export function verifyNextReleaseTitle(title, latest) {
  const match = /^Release v(\d+\.\d+\.\d+)(?:\s|$)/.exec(title || '');
  if (!match || !VERSION.test(latest))
    throw new Error('A next release must name one exact stable version.');
  const requested = match[1].split('.').map(BigInt);
  const current = latest.slice(1).split('.').map(BigInt);
  for (let index = 0; index < 3; index++) {
    if (requested[index] > current[index]) return `v${match[1]}`;
    if (requested[index] < current[index]) break;
  }
  throw new Error(`Release v${match[1]} must be newer than published ${latest}.`);
}

export function verifySourceVersion({
  title,
  packageVersion,
  lockVersion,
  rootVersion,
  buildVersion,
}) {
  const match = /^Release v(\d+\.\d+\.\d+)(?:\s|$)/.exec(title || '');
  if (!match) throw new Error('A release PR must have an exact Release vX.Y.Z title.');
  const version = stableVersion(packageVersion);
  for (const [name, value] of [
    ['package-lock version', lockVersion],
    ['package-lock root version', rootVersion],
    ['game build version', buildVersion],
    ['release title version', match[1]],
  ]) {
    if (value !== version) throw new Error(`${name} ${value} does not match ${version}.`);
  }
  return `v${version}`;
}

export function verifyPublicBoundary({ configuration, pages, rootRelease, buildInfo }) {
  const { latest } = releaseDecision({ configuration, pages });
  if (!VERSION.test(configuration.currentVersion))
    throw new Error('The reviewed selector has an invalid current version.');
  if (
    rootRelease?.version !== latest ||
    rootRelease?.play !== `releases/${latest}/site/game/` ||
    !/^[a-f0-9]{40}$/.test(rootRelease?.sourceRevision || '')
  )
    throw new Error(`Public root does not expose the accepted ${latest} release.`);
  if (
    buildInfo?.version !== latest ||
    buildInfo?.sourceRevision !== rootRelease.sourceRevision ||
    buildInfo?.entry !== 'game/index.html'
  )
    throw new Error(`Public game bytes do not match the accepted ${latest} release.`);
  return { latest, sourceRevision: rootRelease.sourceRevision };
}

const BRIDGE_KEYS = ['formatVersion', 'active', 'repository', 'public', 'blocked', 'requested'];
const RELEASE_ASSETS = [
  'distribution.zip',
  'distribution.zip.sha256',
  'manifest.json',
  'qualification-evidence-record.json',
  'release.json',
  'source-qualification-evidence.zip',
  'source-qualification.json',
  'source.tar',
  'verification.json',
];

function versionParts(version) {
  if (!VERSION.test(version)) throw new Error('The hotfix bridge has an invalid version.');
  return version.slice(1).split('.').map(Number);
}

function verifyPinnedTag(pin, remote, label) {
  if (
    !exact(pin, ['version', 'tagObject', 'sourceRevision', 'sourceTree']) ||
    !VERSION.test(pin.version) ||
    !COMMIT.test(pin.tagObject) ||
    !COMMIT.test(pin.sourceRevision) ||
    !COMMIT.test(pin.sourceTree) ||
    remote?.ref?.ref !== `refs/tags/${pin.version}` ||
    remote?.ref?.object?.type !== 'tag' ||
    remote.ref.object.sha !== pin.tagObject ||
    remote?.tag?.sha !== pin.tagObject ||
    remote?.tag?.tag !== pin.version ||
    remote?.tag?.object?.type !== 'commit' ||
    remote.tag.object.sha !== pin.sourceRevision ||
    remote?.commit?.sha !== pin.sourceRevision ||
    remote?.commit?.tree?.sha !== pin.sourceTree
  )
    throw new Error(`${label} release tag or source identity changed.`);
}

function verifyBlockedRelease(pin, release) {
  if (
    !exact(pin, [
      'version',
      'releaseId',
      'tagObject',
      'sourceRevision',
      'sourceTree',
      'assets',
    ]) ||
    !Number.isSafeInteger(pin.releaseId) ||
    pin.releaseId <= 0 ||
    release?.id !== pin.releaseId ||
    release?.tag_name !== pin.version ||
    release?.draft !== false ||
    release?.prerelease !== false ||
    !Array.isArray(pin.assets) ||
    !Array.isArray(release?.assets) ||
    pin.assets.length !== RELEASE_ASSETS.length ||
    release.assets.length !== pin.assets.length
  )
    throw new Error('Blocked release identity changed.');
  const expected = [...pin.assets].sort((left, right) => left.name.localeCompare(right.name));
  const actual = [...release.assets]
    .map(({ name, id, size, digest }) => ({
      name,
      id,
      size,
      sha256: typeof digest === 'string' ? digest.replace(/^sha256:/, '') : '',
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
  if (
    expected.some(
      (asset, index) =>
        !exact(asset, ['name', 'id', 'size', 'sha256']) ||
        !RELEASE_ASSETS.includes(asset.name) ||
        !Number.isSafeInteger(asset.id) ||
        asset.id <= 0 ||
        !Number.isSafeInteger(asset.size) ||
        asset.size <= 0 ||
        !SHA.test(asset.sha256) ||
        JSON.stringify(asset) !== JSON.stringify(actual[index]),
    ) ||
    new Set(expected.map((asset) => asset.name)).size !== RELEASE_ASSETS.length
  )
    throw new Error('Blocked release assets changed.');
}

function verifyLinearHotfix(compare, base, head) {
  if (
    !COMMIT.test(head) ||
    compare?.status !== 'ahead' ||
    compare?.behind_by !== 0 ||
    !Number.isSafeInteger(compare?.ahead_by) ||
    compare.ahead_by < 1 ||
    compare?.base_commit?.sha !== base ||
    compare?.merge_base_commit?.sha !== base ||
    !Array.isArray(compare?.commits) ||
    compare.commits.length !== compare.ahead_by
  )
    throw new Error('Hotfix source is not a linear descendant of the blocked release.');
  let parent = base;
  for (const commit of compare.commits) {
    if (
      !COMMIT.test(commit?.sha || '') ||
      !Array.isArray(commit?.parents) ||
      commit.parents.length !== 1 ||
      commit.parents[0]?.sha !== parent
    )
      throw new Error('Hotfix source contains divergence or a merge commit.');
    parent = commit.sha;
  }
  if (parent !== head) throw new Error('Hotfix comparison does not terminate at the reviewed head.');
}

export function verifyHotfixBoundary({
  bridge,
  configuration,
  pages,
  rootRelease,
  buildInfo,
  title,
  head,
  publicRemote,
  blockedRemote,
  compare,
}) {
  if (
    !exact(bridge, BRIDGE_KEYS) ||
    bridge.formatVersion !== 1 ||
    bridge.active !== true ||
    bridge.repository !== 'mekhovov/revealline' ||
    !exact(bridge.requested, ['version'])
  )
    throw new Error('The one-time hotfix bridge is missing, inactive, or invalid.');
  verifyPinnedTag(bridge.public, publicRemote, 'Public predecessor');
  verifyPinnedTag(
    {
      version: bridge.blocked?.version,
      tagObject: bridge.blocked?.tagObject,
      sourceRevision: bridge.blocked?.sourceRevision,
      sourceTree: bridge.blocked?.sourceTree,
    },
    blockedRemote,
    'Blocked',
  );
  verifyBlockedRelease(bridge.blocked, blockedRemote?.release);

  if (
    configuration?.deploymentEnabled !== true ||
    configuration?.currentVersion !== bridge.public.version ||
    rootRelease?.version !== bridge.public.version ||
    rootRelease?.sourceRevision !== bridge.public.sourceRevision ||
    rootRelease?.play !== `releases/${bridge.public.version}/site/game/` ||
    buildInfo?.version !== bridge.public.version ||
    buildInfo?.sourceRevision !== bridge.public.sourceRevision ||
    buildInfo?.entry !== 'game/index.html'
  )
    throw new Error('Public predecessor bytes do not match the pinned hotfix bridge.');

  const stable = pages
    .flat()
    .filter(
      (release) =>
        release?.draft === false && release?.prerelease === false && VERSION.test(release?.tag_name),
    )
    .map((release) => release.tag_name);
  const unique = [...new Set(stable)];
  unique.sort((left, right) => {
    const a = versionParts(left),
      b = versionParts(right);
    for (let index = 0; index < 3; index++) {
      if (a[index] !== b[index]) return a[index] - b[index];
    }
    return 0;
  });
  if (
    stable.length !== unique.length ||
    unique.at(-1) !== bridge.blocked.version ||
    unique.at(-2) !== bridge.public.version ||
    latestStableRelease(pages) !== bridge.blocked.version
  )
    throw new Error('Stable release ordering no longer matches the one-time hotfix bridge.');

  const blocked = versionParts(bridge.blocked.version);
  const requested = versionParts(bridge.requested.version);
  if (
    requested[0] !== blocked[0] ||
    requested[1] !== blocked[1] ||
    requested[2] !== blocked[2] + 1 ||
    verifyNextReleaseTitle(title, bridge.blocked.version) !== bridge.requested.version
  )
    throw new Error('Only the pinned patch release may use the hotfix bridge.');

  verifyLinearHotfix(compare, bridge.blocked.sourceRevision, head);
  return {
    latest: bridge.public.version,
    sourceRevision: bridge.public.sourceRevision,
    requested: bridge.requested.version,
    skipped: bridge.blocked.version,
    bridge: 'one-time-pinned',
  };
}

async function fetchPublicJSON(url) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, {
        cache: 'no-store',
        headers: { 'cache-control': 'no-cache', pragma: 'no-cache' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      return parseJSON(bytes, MAX_PUBLIC_BYTES);
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
  }
  throw lastError;
}

function ghJSON(endpoint) {
  const response = spawnSync('gh', ['api', endpoint], {
    encoding: 'utf8',
    maxBuffer: 16_000_000,
  });
  if (response.status !== 0) throw new Error(`Cannot read pinned GitHub metadata for ${endpoint}.`);
  return parseJSON(Buffer.from(response.stdout), 16_000_000);
}

function remoteTag(repository, pin) {
  return {
    ref: ghJSON(`repos/${repository}/git/ref/tags/${pin.version}`),
    tag: ghJSON(`repos/${repository}/git/tags/${pin.tagObject}`),
    commit: ghJSON(`repos/${repository}/git/commits/${pin.sourceRevision}`),
  };
}

async function verifySource(root) {
  const read = async (name) => parseJSON(await fs.readFile(path.join(root, name)));
  const packageJSON = await read('package.json');
  const lock = await read('package-lock.json');
  const build = await read('game/build-config.json');
  return verifySourceVersion({
    title: process.env.PR_TITLE,
    packageVersion: packageJSON.version,
    lockVersion: lock.version,
    rootVersion: lock.packages?.['']?.version,
    buildVersion: build.version,
  });
}

async function verifyPublic() {
  const configuration = parseJSON(
    await fs.readFile(new URL('./publication.json', import.meta.url)),
  );
  const base = (process.env.PUBLIC_BASE || 'https://mekhovov.github.io/revealline').replace(
    /\/$/,
    '',
  );
  const cacheKey = encodeURIComponent(
    `${process.env.GITHUB_RUN_ID || 'local'}-${process.env.GITHUB_RUN_ATTEMPT || '0'}-${Date.now()}`,
  );
  const rootRelease = await fetchPublicJSON(`${base}/release.json?boundary=${cacheKey}`);
  const version = configuration.currentVersion;
  const buildInfo = await fetchPublicJSON(
    `${base}/releases/${version}/site/game/build-info.json?boundary=${cacheKey}`,
  );
  const pages = publishedReleasePages();
  try {
    const boundary = verifyPublicBoundary({ configuration, pages, rootRelease, buildInfo });
    return {
      ...boundary,
      requested: verifyNextReleaseTitle(process.env.PR_TITLE, boundary.latest),
    };
  } catch (normalError) {
    let bridge;
    try {
      bridge = parseJSON(await fs.readFile(new URL('./hotfix-bridge.json', import.meta.url)));
    } catch {
      throw normalError;
    }
    if (bridge?.active !== true) throw normalError;
    const publicRemote = remoteTag(bridge.repository, bridge.public);
    const blockedRemote = {
      ...remoteTag(bridge.repository, bridge.blocked),
      release: ghJSON(`repos/${bridge.repository}/releases/tags/${bridge.blocked.version}`),
    };
    const head = process.env.PR_HEAD_SHA || '';
    const compare = ghJSON(
      `repos/${bridge.repository}/compare/${bridge.blocked.sourceRevision}...${head}`,
    );
    return verifyHotfixBoundary({
      bridge,
      configuration,
      pages,
      rootRelease,
      buildInfo,
      title: process.env.PR_TITLE,
      head,
      publicRemote,
      blockedRemote,
      compare,
    });
  }
}

async function main() {
  const [command, root = '.'] = process.argv.slice(2);
  if (command === 'source') console.log(JSON.stringify({ version: await verifySource(root) }));
  else if (command === 'public') console.log(JSON.stringify(await verifyPublic()));
  else throw new Error('Usage: release-train-boundary.mjs source [ROOT]|public');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

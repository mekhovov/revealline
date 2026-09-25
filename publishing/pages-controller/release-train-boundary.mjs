/** Fail-closed source-version and previous-public-release guards for release PRs. */
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseJSON, VERSION } from './metadata.mjs';
import { publishedReleasePages, releaseDecision } from './release-policy.mjs';

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
  const boundary = verifyPublicBoundary({
    configuration,
    pages: publishedReleasePages(),
    rootRelease,
    buildInfo,
  });
  return {
    ...boundary,
    requested: verifyNextReleaseTitle(process.env.PR_TITLE, boundary.latest),
  };
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

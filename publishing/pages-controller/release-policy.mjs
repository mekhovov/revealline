/** Latest stable release policy, independent of frozen artifact assembly. */
import * as fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseJSON, VERSION } from './metadata.mjs';

export function latestStableRelease(pages) {
  if (!Array.isArray(pages) || pages.some((page) => !Array.isArray(page)))
    throw new Error('Invalid published release response.');
  const versions = pages
    .flat()
    .filter(
      (release) =>
        release &&
        release.draft === false &&
        release.prerelease === false &&
        typeof release.tag_name === 'string' &&
        release.tag_name.length <= 64 &&
        VERSION.test(release.tag_name),
    )
    .map((release) => release.tag_name);
  if (!versions.length) throw new Error('No published stable release was found.');
  versions.sort((left, right) => {
    const a = left.slice(1).split('.').map(BigInt),
      b = right.slice(1).split('.').map(BigInt);
    for (let index = 0; index < 3; index++) {
      if (a[index] < b[index]) return -1;
      if (a[index] > b[index]) return 1;
    }
    return left.localeCompare(right);
  });
  return versions.at(-1);
}

export function releaseDecision({ configuration, pages, requested = '', route = false }) {
  const latest = latestStableRelease(pages);
  if (
    requested &&
    (typeof requested !== 'string' || requested.length > 64 || !VERSION.test(requested))
  )
    throw new Error('A publication request must name an exact stable semantic tag.');
  if (route && !requested) throw new Error('A release routing request must name its tag.');
  if (route && requested !== latest)
    return {
      shouldDispatch: false,
      requested,
      latest,
      reason: 'A newer stable release is published.',
    };
  if (!configuration || configuration.deploymentEnabled !== true)
    throw new Error('The reviewed frozen publication selector is not enabled.');
  if (configuration.currentVersion !== latest && route)
    return {
      shouldDispatch: false,
      requested,
      latest,
      reason: 'Awaiting a reviewed frozen selector for the latest stable release.',
    };
  if (configuration.currentVersion !== latest)
    throw new Error(
      `The reviewed selector ${configuration.currentVersion} is not the latest stable release ${latest}.`,
    );
  if (requested && requested !== configuration.currentVersion)
    throw new Error('The requested release does not match the reviewed frozen selector.');
  return { shouldDispatch: route, requested: requested || configuration.currentVersion, latest };
}

export function publishedReleasePages() {
  const response = spawnSync(
    'gh',
    ['api', '--paginate', '--slurp', 'repos/mekhovov/revealline/releases?per_page=100'],
    { encoding: 'utf8', maxBuffer: 16_000_000 },
  );
  if (response.status !== 0) throw new Error('Cannot read published stable releases.');
  return parseJSON(Buffer.from(response.stdout), 16_000_000);
}

async function main() {
  const command = process.argv[2];
  if (!['route', 'verify'].includes(command) || process.argv.length !== 3)
    throw new Error('Usage: release-policy.mjs route|verify');
  if (
    command === 'verify' &&
    process.env.GITHUB_ACTIONS &&
    process.env.GITHUB_REF !== 'refs/heads/main'
  )
    throw new Error('Frozen publication must run from main.');
  const configuration = parseJSON(
    await fs.readFile(new URL('./publication.json', import.meta.url)),
  );
  const decision = releaseDecision({
    configuration,
    pages: publishedReleasePages(),
    requested: process.env.REQUESTED_RELEASE || '',
    route: command === 'route',
  });
  if (process.env.GITHUB_OUTPUT && command === 'route')
    await fs.appendFile(process.env.GITHUB_OUTPUT, `should_dispatch=${decision.shouldDispatch}\n`);
  console.log(JSON.stringify(decision));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

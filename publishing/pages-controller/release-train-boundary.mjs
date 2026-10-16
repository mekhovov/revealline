/** Exact-source Pages boundary checks. Version metadata is informational only. */
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseJSON } from './metadata.mjs';

const MAX_PUBLIC_BYTES = 1_000_000;

export function verifySourceVersion({
  packageVersion,
}) {
  // Versions remain available to callers and release notes, but do not control
  // Pages admission or block a source build.
  return typeof packageVersion === 'string' ? packageVersion : null;
}

export function verifyPublicBoundary({
  deployment,
  buildInfo,
  expectedMainSha = null,
}) {
  if (
    deployment?.format !== 'revealline-main-deployment.v1' ||
    deployment?.channel !== 'main' ||
    deployment?.play !== 'game/' ||
    !/^[a-f0-9]{40}$/.test(deployment?.sourceRevision || '') ||
    !/^main-[a-f0-9]{12}$/.test(deployment?.buildVersion || '')
  )
    throw new Error('Public root does not expose a valid continuous-main deployment.');
  if (expectedMainSha !== null && deployment.sourceRevision !== expectedMainSha)
    throw new Error(
      `Public main deployment ${deployment.sourceRevision} does not match protected base ${expectedMainSha}.`,
    );
  if (
    buildInfo?.sourceRevision !== deployment.sourceRevision ||
    buildInfo?.entry !== 'game/index.html'
  )
    throw new Error('Public game bytes do not match the continuous-main deployment marker.');
  return {
    sourceRevision: deployment.sourceRevision,
    buildVersion: deployment.buildVersion,
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

async function verifySource(root) {
  const read = async (name) => parseJSON(await fs.readFile(path.join(root, name)));
  const packageJSON = await read('package.json');
  return verifySourceVersion({ packageVersion: packageJSON.version });
}

async function verifyPublic() {
  const base = (process.env.PUBLIC_BASE || 'https://mekhovov.github.io/revealline').replace(
    /\/$/,
    '',
  );
  const cacheKey = encodeURIComponent(
    `${process.env.GITHUB_RUN_ID || 'local'}-${process.env.GITHUB_RUN_ATTEMPT || '0'}-${Date.now()}`,
  );
  const deployment = await fetchPublicJSON(`${base}/main-deployment.json?boundary=${cacheKey}`);
  const buildInfo = await fetchPublicJSON(`${base}/game/build-info.json?boundary=${cacheKey}`);
  return verifyPublicBoundary({ deployment, buildInfo, expectedMainSha: process.env.PR_BASE_SHA || null });
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

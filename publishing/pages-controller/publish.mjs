#!/usr/bin/env node
/** Main-only publication of a reviewed immutable release selector. Node built-ins only. */
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  assemble,
  directoryInventory,
  loadCatalog,
  readOrdinary,
  validateAdmissions,
} from './assemble.mjs';
import { digest, jsonBytes, parseJSON, retainRecentMetadata } from './metadata.mjs';
import { publishedReleasePages, releaseDecision } from './release-policy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const directory = path.join(root, 'publishing/pages-controller');
const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', maxBuffer: 16_000_000 });
  if (result.status !== 0) throw new Error(`${command} ${args[0]} failed: ${result.stderr}`);
  return result.stdout.trim();
};
async function verify({ preview = false, remote = false } = {}) {
  const { lock, metadata: catalogMetadata, catalogSha256 } = await loadCatalog(directory),
    configuration = parseJSON(await readOrdinary(directory, 'publication.json'));
  if (configuration.catalogSha256 !== catalogSha256) throw new Error('Frozen catalog changed.');
  const testingVersions = new Set(Object.keys(configuration.testingRoutes || {})),
    testingMetadata = new Map(
      [...catalogMetadata].filter(([version]) => testingVersions.has(version)),
    ),
    metadata = retainRecentMetadata(
      new Map([...catalogMetadata].filter(([version]) => !testingVersions.has(version))),
      configuration.retainedReleasesPerMajor,
    ),
    _testingRoutesExist =
      testingMetadata.size === testingVersions.size ||
      (() => {
        throw new Error('A development testing route has no frozen metadata.');
      })(),
    { qualification, admissions } = await validateAdmissions({
      directory,
      configuration,
      metadata,
      requireBrowser: !preview,
    });
  const actualTags = new Set(
    run('git', ['tag', '--list', 'v*'])
      .split('\n')
      .filter((tag) => /^v\d+\.\d+\.\d+$/.test(tag)),
  );
  if (lock.releases.some((row) => !actualTags.has(row.version)))
    throw new Error('A frozen catalog tag is missing from the repository.');
  for (const row of lock.releases) {
    if (
      run('git', ['rev-parse', row.version]) !== row.tagObject ||
      run('git', ['rev-parse', `${row.version}^{commit}`]) !== row.sourceRevision
    )
      throw new Error(`Frozen tag identity changed: ${row.version}`);
  }
  const qualifiedSourceTree = run('git', ['rev-parse', `${qualification.sourceRevision}^{tree}`]);
  if (qualifiedSourceTree !== qualification.sourceTree)
    throw new Error('Qualified source tree does not match the immutable game commit.');
  if (
    run('git', ['status', '--porcelain', '--untracked-files=no']) ||
    run('git', ['ls-files', 'publishing/pages-controller/publication.json']) !==
      'publishing/pages-controller/publication.json'
  )
    throw new Error('Publishing tools and configuration must be committed with a clean checkout.');
  const controllerCommit = run('git', ['rev-parse', 'HEAD']),
    controllerTree = run('git', ['rev-parse', 'HEAD^{tree}']);
  if (
    process.env.GITHUB_EVENT_NAME !== 'pull_request' &&
    process.env.GITHUB_SHA &&
    controllerCommit !== process.env.GITHUB_SHA
  )
    throw new Error('Publishing checkout does not equal its triggering commit.');
  const observations = [];
  let releasePolicy = null;
  if (remote) {
    if (!preview) {
      if (process.env.GITHUB_REF !== 'refs/heads/main')
        throw new Error('Frozen publication must run from main.');
      releasePolicy = releaseDecision({
        configuration,
        pages: publishedReleasePages(),
        requested: process.env.REQUESTED_RELEASE || '',
      });
    }
    const response = await fetch(
      `https://github.com/mekhovov/revealline/releases/download/${configuration.currentVersion}/source-qualification.json`,
      { signal: AbortSignal.timeout(60_000) },
    );
    if (!response.ok)
      throw new Error('The selected release does not publish its source qualification.');
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > 8_000_000) {
        await response.body.cancel().catch(() => {});
        throw new Error('Published qualification exceeds its byte budget.');
      }
      chunks.push(chunk);
    }
    if (digest(Buffer.concat(chunks)) !== configuration.currentSourceQualification.sha256)
      throw new Error('Published source qualification does not match the reviewed pin.');
    for (const admission of admissions) {
      const repo = `mekhovov/revealline-${admission.id}`;
      const api = (suffix) => JSON.parse(run('gh', ['api', `repos/${repo}/${suffix}`]));
      const commit = api('commits/main'),
        deployment = api(`deployments/${admission.deploymentId}`),
        statuses = api(`deployments/${admission.deploymentId}/statuses`);
      if (
        commit.sha !== admission.infrastructureCommit ||
        deployment.sha !== admission.infrastructureCommit ||
        deployment.environment !== 'github-pages' ||
        statuses[0]?.state !== 'success'
      )
        throw new Error(`Admitted archive changed or is not deployed: ${admission.id}`);
      observations.push({
        archiveId: admission.id,
        infrastructureCommit: commit.sha,
        deploymentId: deployment.id,
        deploymentState: statuses[0].state,
      });
    }
  }
  return {
    configuration,
    controllerCommit,
    controllerTree,
    catalogSha256,
    qualifiedSourceTree,
    admittedArchives: admissions.length,
    observations,
    releasePolicy,
    publishable: !preview,
  };
}
async function main() {
  const command = process.argv[2],
    preview = process.argv.includes('--preview');
  if (
    !['verify', 'build', 'verify-artifact'].includes(command) ||
    process.argv.slice(3).some((arg) => arg !== '--preview')
  )
    throw new Error('Usage: publish.mjs verify|build|verify-artifact [--preview]');
  const identity = await verify({ preview, remote: Boolean(process.env.GITHUB_ACTIONS) });
  const output = path.join(root, '.cache/frozen-pages');
  if (command === 'verify') {
    const { configuration, ...binding } = identity;
    console.log(
      JSON.stringify({
        ...binding,
        currentVersion: configuration.currentVersion,
      }),
    );
    return;
  }
  if (command === 'verify-artifact') {
    const receipt = parseJSON(
      await readOrdinary(output, 'artifact-receipt.json', 16_000_000),
      16_000_000,
    );
    if (
      receipt.controllerCommit !== identity.controllerCommit ||
      receipt.controllerTree !== identity.controllerTree ||
      receipt.qualifiedSourceTree !== identity.qualifiedSourceTree ||
      receipt.currentVersion !== identity.configuration.currentVersion ||
      receipt.catalogSha256 !== identity.catalogSha256 ||
      receipt.configurationSha256 !== digest(await readOrdinary(directory, 'publication.json')) ||
      receipt.publishable !== !preview
    )
      throw new Error('Artifact receipt is not bound to this publishing controller.');
    const rows = await directoryInventory(path.join(output, 'artifact'));
    if (
      JSON.stringify(rows) !== JSON.stringify(receipt.files) ||
      rows.reduce((n, row) => n + row.bytes, 0) !== receipt.totalBytes ||
      receipt.totalBytes > 950_000_000
    )
      throw new Error('Prepared artifact inventory changed.');
    console.log(
      JSON.stringify({
        status: 'PASS',
        controllerCommit: identity.controllerCommit,
        gameSourceRevision: receipt.gameSourceRevision,
        files: rows.length,
        totalBytes: receipt.totalBytes,
        publishable: !preview,
      }),
    );
    return;
  }
  await fs.mkdir(output, { recursive: true });
  const currentSite = path.join(output, 'current-site');
  run('python3', [
    path.join(directory, 'extract-current.py'),
    '--metadata',
    path.join(directory, 'metadata', identity.configuration.currentVersion),
    '--output',
    currentSite,
    '--receipt',
    path.join(output, 'zip-receipt.json'),
  ]);
  const receipt = await assemble({
    directory,
    currentSite,
    outputDirectory: path.join(output, 'artifact'),
    requireBrowser: !preview,
  });
  const { configuration: _configuration, ...binding } = identity;
  await fs.writeFile(
    path.join(output, 'artifact-receipt.json'),
    jsonBytes({ ...receipt, ...binding }),
    { flag: 'wx' },
  );
  console.log(
    JSON.stringify({
      ...binding,
      currentVersion: receipt.currentVersion,
      gameSourceRevision: receipt.gameSourceRevision,
      totalBytes: receipt.totalBytes,
      files: receipt.files.length,
    }),
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

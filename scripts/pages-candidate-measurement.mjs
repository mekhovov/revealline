/** Manual diagnostic controller. This never publishes, qualifies or authorizes merges. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseCandidateInput,
  validateCandidateSnapshot,
  unsupportedCandidatePaths,
  validateArtifactProvenance,
  validateCandidateRun,
  assessCandidateFreshness,
} from './pages-candidate-contract.mjs';
import {
  freezeCandidateOverlay,
  recheckCandidateOverlay,
  trustedImportClosure,
} from './pages-candidate-overlay.mjs';

const repository = 'mekhovov/revealline';
const selectorPath = 'publishing/pages-controller/optional-packages.json';
const controllerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const parse = (bytes) => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
const json = (value) => JSON.stringify(value, null, 2) + '\n';
const temporary = () => process.env.RUNNER_TEMP;
const packetPath = () => path.join(temporary(), 'candidate-preflight', 'preflight.json');
function command(name, args, options = {}) {
  const result = spawnSync(name, args, {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    ...options,
  });
  assert.equal(result.status, 0, `${name} failed: ${String(result.stderr || '').slice(0, 2000)}`);
  return result.stdout;
}
function git(args, cwd = controllerRoot, env = process.env) {
  return command('git', ['-c', 'core.hooksPath=/dev/null', ...args], { cwd, env }).trim();
}
function api(endpoint) {
  const target = endpoint.startsWith('repos/') ? endpoint : `repos/${repository}/${endpoint}`;
  assert.ok(target.startsWith(`repos/${repository}/`), 'Foreign API endpoint');
  return parse(Buffer.from(command('gh', ['api', target])));
}
function overlayReader() {
  return {
    api,
    readAsset: ({ id, limit }) => {
      const bytes = command(
        'gh',
        [
          'api',
          `repos/${repository}/releases/assets/${id}`,
          '-H',
          'Accept: application/octet-stream',
        ],
        {
          encoding: 'buffer',
          maxBuffer: limit + 1024,
        },
      );
      assert.ok(bytes.length <= limit, 'Oversized optional release asset');
      return bytes;
    },
  };
}
async function bounded(file, maximum = 16 * 1024 * 1024) {
  const info = await fs.lstat(file);
  assert.ok(info.isFile() && info.nlink === 1 && info.size <= maximum, 'Invalid evidence file');
  return fs.readFile(file);
}
async function readPreflight() {
  const bytes = await bounded(packetPath());
  assert.equal(digest(bytes), process.env.PREFLIGHT_SHA256, 'Trusted preflight checksum differs');
  const value = parse(bytes);
  assert.equal(value.controllerSha, process.env.GITHUB_SHA, 'Controller source differs');
  assert.match(value.syntheticSha, /^[0-9a-f]{40}$/u);
  assert.match(value.syntheticTree, /^[0-9a-f]{40}$/u);
  return value;
}
export function composeCandidate(input, cwd, committedAt) {
  git(['fetch', '--no-tags', '--depth=1', 'origin', input.mainSha, input.headSha], cwd);
  // merge-tree needs common ancestry; public fetch is read-only and has no credential helper.
  if (git(['rev-parse', '--is-shallow-repository'], cwd) === 'true')
    git(['fetch', '--no-tags', '--unshallow', 'origin', input.mainSha, input.headSha], cwd);
  const tree = git(['merge-tree', '--write-tree', input.mainSha, input.headSha], cwd);
  assert.match(tree, /^[0-9a-f]{40}$/u, 'Candidate merge is not clean');
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: 'Pages diagnostic',
    GIT_AUTHOR_EMAIL: 'pages-diagnostic@localhost',
    GIT_COMMITTER_NAME: 'Pages diagnostic',
    GIT_COMMITTER_EMAIL: 'pages-diagnostic@localhost',
    GIT_AUTHOR_DATE: committedAt,
    GIT_COMMITTER_DATE: committedAt,
  };
  const commit = git(
    [
      'commit-tree',
      tree,
      '-p',
      input.mainSha,
      '-p',
      input.headSha,
      '-m',
      'Read-only Pages candidate measurement',
    ],
    cwd,
    env,
  );
  return { tree, commit };
}
async function prepare() {
  assert.equal(process.env.GITHUB_REF, 'refs/heads/main');
  assert.equal(process.env.GITHUB_REPOSITORY, repository);
  const input = parseCandidateInput({
    prNumber: process.env.CANDIDATE_PR,
    mainSha: process.env.EXPECTED_MAIN,
    headSha: process.env.EXPECTED_HEAD,
  });
  assert.equal(
    input.mainSha,
    process.env.GITHUB_SHA,
    'Dispatch must bind the current main controller',
  );
  assert.equal(api('commits/main').sha, input.mainSha, 'Main moved before preflight');
  const snapshot = validateCandidateSnapshot(api(`pulls/${input.prNumber}`), input);
  const sourceCommittedAt = git(['show', '-s', '--format=%cI', input.mainSha]);
  const synthetic = composeCandidate(input, controllerRoot, sourceCommittedAt);
  const changed = command(
    'git',
    ['diff', '--no-renames', '--name-only', '-z', input.mainSha, synthetic.commit],
    { cwd: controllerRoot },
  )
    .split('\0')
    .filter(Boolean);
  assert.deepEqual(
    unsupportedCandidatePaths(changed),
    [],
    'Unsupported publication contract change',
  );
  const closureSources = new Map();
  const closure = await trustedImportClosure('publishing/optional-package-promotion.mjs', {
    readSource: async (file) => {
      const bytes = command('git', ['show', `${input.mainSha}:${file}`], {
        cwd: controllerRoot,
        encoding: 'buffer',
        maxBuffer: 8 * 1024 * 1024,
      });
      closureSources.set(file, digest(bytes));
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    },
  });
  assert.deepEqual(
    changed.filter((file) => closure.paths.includes(file)),
    [],
    'Candidate changes the frozen overlay import closure',
  );
  const selectorBytes = Buffer.from(
    command('git', ['show', `${synthetic.commit}:${selectorPath}`], {
      cwd: controllerRoot,
      encoding: 'buffer',
      maxBuffer: 1024 * 1024,
    }),
  );
  const frozen = await freezeCandidateOverlay(selectorBytes, overlayReader());
  const directory = path.dirname(packetPath());
  await fs.mkdir(directory);
  for (const [name, bytes] of frozen.overlay) {
    const destination = path.join(directory, 'overlay', name);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, bytes, { flag: 'wx' });
  }
  await fs.writeFile(path.join(directory, 'selector.json'), selectorBytes, { flag: 'wx' });
  const value = {
    format: 'revealline-pages-candidate-preflight.v1',
    controllerSha: input.mainSha,
    input,
    snapshot,
    syntheticSha: synthetic.commit,
    syntheticTree: synthetic.tree,
    sourceCommittedAt,
    buildVersion: `main-${synthetic.commit.slice(0, 12)}`,
    overlay: frozen.identity,
    controllerClosure: {
      ...closure,
      files: closure.paths.map((file) => ({ path: file, sha256: closureSources.get(file) })),
    },
    mergeAuthorized: false,
    qualificationPerformed: false,
    productionDeploymentPerformed: false,
  };
  const bytes = Buffer.from(json(value));
  await fs.writeFile(packetPath(), bytes, { flag: 'wx' });
  await fs.appendFile(
    process.env.GITHUB_OUTPUT,
    `preflight_sha256=${digest(bytes)}\nsource_sha=${synthetic.commit}\n`,
  );
}
async function reconstruct() {
  assert.ok(
    !process.env.GH_TOKEN && !process.env.GITHUB_TOKEN,
    'Candidate reconstruction must not receive API credentials',
  );
  const frozen = await readPreflight();
  const cwd = path.join(process.env.GITHUB_WORKSPACE, 'candidate');
  const synthetic = composeCandidate(frozen.input, cwd, frozen.sourceCommittedAt);
  assert.equal(synthetic.commit, frozen.syntheticSha);
  assert.equal(synthetic.tree, frozen.syntheticTree);
  git(['checkout', '--detach', synthetic.commit], cwd);
}
async function stage() {
  assert.ok(
    !process.env.GH_TOKEN && !process.env.GITHUB_TOKEN,
    'Candidate staging must not receive API credentials',
  );
  const frozen = await readPreflight();
  const site = path.join(temporary(), 'main-pages');
  assert.ok((await fs.lstat(site)).isDirectory());
  await assert.rejects(fs.lstat(path.join(site, 'practice')), { code: 'ENOENT' });
  for (const row of frozen.overlay.files) {
    assert.ok(
      row.path.startsWith('practice/') &&
        row.path.split('/').every((part) => part && part !== '.' && part !== '..'),
    );
    const bytes = await bounded(
      path.join(path.dirname(packetPath()), 'overlay', row.path),
      980000000,
    );
    assert.equal(bytes.length, row.bytes);
    assert.equal(digest(bytes), row.sha256);
    const destination = path.join(site, row.path);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, bytes, { flag: 'wx' });
  }
  command(process.execPath, [path.join(controllerRoot, 'scripts/write-main-pages-metadata.mjs')], {
    env: {
      ...process.env,
      SOURCE_SHA: frozen.syntheticSha,
      SOURCE_COMMITTED_AT: frozen.sourceCommittedAt,
      BUILD_VERSION: frozen.buildVersion,
    },
  });
}
export async function verifyCandidateMetadata(actual, frozen) {
  const rehearsal = await fs.mkdtemp(path.join(temporary(), 'candidate-metadata-'));
  await fs.mkdir(path.join(rehearsal, 'main-pages', 'game'), { recursive: true });
  await fs.writeFile(
    path.join(rehearsal, 'main-pages/game/index.html'),
    actual.metadata.gameGateHTML,
    { flag: 'wx' },
  );
  command(process.execPath, [path.join(controllerRoot, 'scripts/write-main-pages-metadata.mjs')], {
    env: {
      ...process.env,
      RUNNER_TEMP: rehearsal,
      SOURCE_SHA: frozen.syntheticSha,
      SOURCE_COMMITTED_AT: frozen.sourceCommittedAt,
      BUILD_VERSION: frozen.buildVersion,
    },
  });
  for (const [name, key] of [
    ['main-deployment.json', 'mainDeployment'],
    ['release.json', 'release'],
    ['releases/index.html', 'releasesHTML'],
  ]) {
    assert.equal(
      actual.metadata[key],
      await fs.readFile(path.join(rehearsal, 'main-pages', name), 'utf8'),
      `Rolling metadata differs: ${name}`,
    );
  }
}
async function verify() {
  const frozen = await readPreflight();
  validateCandidateRun(api(`actions/runs/${process.env.GITHUB_RUN_ID}`), {
    runId: process.env.GITHUB_RUN_ID,
    controllerSha: frozen.controllerSha,
    workflowPath: '.github/workflows/measure-pages-candidate.yml',
  });
  for (const [artifactId, name] of [
    [process.env.PREFLIGHT_ARTIFACT_ID, 'candidate-preflight'],
    [process.env.CANDIDATE_ARTIFACT_ID, 'candidate-pages'],
    [process.env.RECEIPT_ARTIFACT_ID, 'candidate-receipts'],
  ]) {
    validateArtifactProvenance(api(`actions/artifacts/${artifactId}`), {
      artifactId,
      runId: process.env.GITHUB_RUN_ID,
      controllerSha: frozen.controllerSha,
      name,
    });
  }
  const bundle = path.join(temporary(), 'candidate-bundle');
  assert.equal(
    parse(await bounded(path.join(bundle, 'main-pages-archive-receipt.json'))).artifactId,
    process.env.CANDIDATE_ARTIFACT_ID,
    'Receipt points to a different actual artifact',
  );
  command('python3', [
    path.join(controllerRoot, 'scripts/pages-candidate-archive.py'),
    '--bundle',
    bundle,
    '--preflight',
    packetPath(),
  ]);
  const actual = parse(await bounded(path.join(bundle, 'independent-archive.json')));
  await verifyCandidateMetadata(actual, frozen);
  const selector = await bounded(
    path.join(path.dirname(packetPath()), 'selector.json'),
    1024 * 1024,
  );
  assert.equal(digest(selector), frozen.overlay.selectorSha256);
  let externalInputFailure;
  let externalInputStatus = 'verified';
  try {
    await recheckCandidateOverlay(selector, frozen.overlay, overlayReader());
  } catch (error) {
    // Preserve the actual measured archive as historical, never as current
    // evidence when external inputs changed or could not be independently read.
    externalInputStatus = error?.code === 'CANDIDATE_OVERLAY_STALE' ? 'changed' : 'unverifiable';
    externalInputFailure =
      error instanceof Error
        ? 'External identities changed or independent reads failed; no current capacity conclusion.'
        : 'External verification unavailable.';
  }
  const currentMainSha = api('commits/main').sha;
  const current = api(`pulls/${frozen.input.prNumber}`);
  const freshness = assessCandidateFreshness(frozen.snapshot, current, {
    expectedMainSha: frozen.input.mainSha,
    currentMainSha,
  });
  if (externalInputFailure) {
    Object.assign(freshness, {
      current: false,
      stale: true,
      currentQueueEligible: false,
      historicalDiagnosticOnly: true,
    });
    freshness.reasons.push(`external-inputs-${externalInputStatus}`);
  }
  const result = {
    ...freshness,
    format: 'revealline-pages-candidate-measurement.v1',
    measurementComplete: true,
    controllerSha: frozen.controllerSha,
    syntheticSha: frozen.syntheticSha,
    syntheticTree: frozen.syntheticTree,
    preflightSha256: process.env.PREFLIGHT_SHA256,
    artifactId: process.env.CANDIDATE_ARTIFACT_ID,
    archiveBytes: actual.archiveBytes,
    archiveSha256: actual.archiveSha256,
    externalInputFailure,
    externalInputStatus,
    mergeAuthorized: false,
    qualificationPerformed: false,
    productionDeploymentPerformed: false,
    limitation:
      'Complete archive byte verification is not source-content, gameplay, native or offline qualification; no capacity reservation or isolated PR attribution.',
  };
  await fs.writeFile(path.join(temporary(), 'candidate-measurement.json'), json(result), {
    flag: 'wx',
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const actions = { prepare, reconstruct, stage, verify };
  assert.ok(
    Object.hasOwn(actions, process.argv[2]) && process.argv.length === 3,
    'Unknown diagnostic command',
  );
  try {
    await actions[process.argv[2]]();
  } catch (error) {
    if (process.argv[2] === 'verify') {
      await fs.writeFile(
        path.join(temporary(), 'candidate-measurement.json'),
        json({
          format: 'revealline-pages-candidate-measurement.v1',
          measurementComplete: false,
          currentQueueEligible: false,
          mergeAuthorized: false,
          qualificationPerformed: false,
          productionDeploymentPerformed: false,
          reason:
            'Independent verification failed; no accepted archive measurement. Inspect the trusted verification step.',
        }),
        { flag: 'wx' },
      );
    }
    throw error;
  }
}

/** Manual bounded stack diagnostic. Never publishes, qualifies or merges. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseStackInput, assessStackFreshness } from './pages-stack-contract.mjs';
import { freezeStackSources, readStackObservations } from './pages-stack-source.mjs';
import { composeStackObjects } from './pages-candidate-stack.mjs';
import { validateArtifactProvenance } from './pages-candidate-contract.mjs';
import {
  freezeCandidateOverlay,
  recheckCandidateOverlay,
  trustedImportClosure,
} from './pages-candidate-overlay.mjs';
import { verifyCandidateMetadata } from './pages-candidate-measurement.mjs';
import {
  validateStackPacket,
  validateStackRun,
  stackArtifactName,
  stackFailure,
  stackFlags,
} from './pages-stack-packet.mjs';
import { downloadStackArtifact } from './pages-stack-artifacts.mjs';

const repository = 'mekhovov/revealline';
const selectorPath = 'publishing/pages-controller/optional-packages.json';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const json = (value) => JSON.stringify(value, null, 2) + '\n';
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const parse = (bytes) => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
const temp = () => {
  assert.ok(path.isAbsolute(process.env.RUNNER_TEMP || ''), 'Missing runner temporary directory');
  return process.env.RUNNER_TEMP;
};
const packetFile = () => path.join(temp(), 'candidate-preflight/preflight.json');
const expected = () => ({
  controllerSha: process.env.GITHUB_SHA,
  runId: process.env.GITHUB_RUN_ID,
  runAttempt: process.env.GITHUB_RUN_ATTEMPT,
});
function command(name, args, options = {}) {
  const value = spawnSync(name, args, {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    timeout: 120000,
    ...options,
  });
  assert.equal(value.status, 0, `Trusted diagnostic operation failed: ${name}`);
  return value.stdout;
}
function git(args, cwd = root, options = {}) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')),
  );
  Object.assign(env, {
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
    GIT_NO_REPLACE_OBJECTS: '1',
    GIT_GRAFT_FILE: '/dev/null',
    GIT_NO_LAZY_FETCH: '1',
    GIT_TERMINAL_PROMPT: '0',
    GIT_ALLOW_PROTOCOL: 'https',
  });
  return command(
    'git',
    [
      '-c',
      'core.hooksPath=/dev/null',
      '-c',
      'core.fsmonitor=false',
      '-c',
      'credential.helper=',
      '-c',
      'gc.auto=0',
      ...args,
    ],
    { cwd, env, ...options },
  );
}
function exactSha(value) {
  assert.ok(typeof value === 'string' && value.length === 40 && /^[a-f0-9]{40}$/u.test(value));
  return value;
}
function fetchObjects(values, cwd = root) {
  assert.ok(Array.isArray(values) && values.length <= 10);
  values.forEach(exactSha);
  assert.match(
    git(['remote', 'get-url', 'origin'], cwd).trim(),
    /^https:\/\/github\.com\/mekhovov\/revealline(?:\.git)?$/u,
  );
  const shallow = git(['rev-parse', '--is-shallow-repository'], cwd).trim() === 'true';
  git(
    [
      'fetch',
      '--no-tags',
      '--no-write-fetch-head',
      ...(shallow ? ['--unshallow'] : []),
      'origin',
      ...new Set(values),
    ],
    cwd,
  );
}
function prove(ancestor, descendant, cwd = root) {
  exactSha(ancestor);
  exactSha(descendant);
  git(['merge-base', '--is-ancestor', ancestor, descendant], cwd);
  return true;
}
function api(endpoint) {
  const target = endpoint.startsWith('repos/') ? endpoint : `repos/${repository}/${endpoint}`;
  assert.ok(
    target.startsWith(`repos/${repository}/`) && !/[\x00-\x20]/u.test(target),
    'Foreign API endpoint',
  );
  return parse(Buffer.from(command('gh', ['api', target])));
}
function overlayReader() {
  return {
    api,
    readAsset: ({ id, limit }) => {
      assert.ok(
        Number.isSafeInteger(id) &&
          id > 0 &&
          Number.isSafeInteger(limit) &&
          limit > 0 &&
          limit <= 950000000,
      );
      const bytes = command(
        'gh',
        [
          'api',
          `repos/${repository}/releases/assets/${id}`,
          '-H',
          'Accept: application/octet-stream',
        ],
        { encoding: 'buffer', maxBuffer: limit + 1024 },
      );
      assert.ok(bytes.length <= limit);
      return bytes;
    },
  };
}
async function bounded(file, maximum = 16 * 1024 * 1024) {
  const info = await fs.lstat(file);
  assert.ok(
    info.isFile() && !info.isSymbolicLink() && info.nlink === 1 && info.size <= maximum,
    'Invalid evidence file',
  );
  const bytes = await fs.readFile(file);
  assert.equal(bytes.length, info.size);
  return bytes;
}
function noCredentials() {
  assert.ok(
    !process.env.GH_TOKEN && !process.env.GITHUB_TOKEN,
    'Candidate execution received API credentials',
  );
}
function controllerIdentity() {
  assert.equal(process.env.GITHUB_REF, 'refs/heads/main');
  assert.equal(process.env.GITHUB_REPOSITORY, repository);
  assert.equal(
    git(['rev-parse', 'HEAD']).trim(),
    exactSha(process.env.GITHUB_SHA),
    'Controller checkout differs',
  );
}
async function readPacket() {
  const bytes = await bounded(packetFile());
  assert.equal(digest(bytes), process.env.PREFLIGHT_SHA256, 'Trusted preflight checksum differs');
  return validateStackPacket(parse(bytes), expected());
}
async function download() {
  controllerIdentity();
  validateStackRun(api(`actions/runs/${process.env.GITHUB_RUN_ID}`), expected());
  const directory = await fs.mkdtemp(path.join(temp(), 'stack-verified-downloads-'));
  const downloads = [];
  for (const [kind, artifactId] of [
    ['preflight', process.env.PREFLIGHT_ARTIFACT_ID],
    ...(process.env.CANDIDATE_RESULT === 'success'
      ? [
          ['pages', process.env.CANDIDATE_ARTIFACT_ID],
          ['receipts', process.env.RECEIPT_ARTIFACT_ID],
        ]
      : []),
  ]) {
    const metadata = api(`actions/artifacts/${artifactId}`);
    const result = await downloadStackArtifact(metadata, kind, artifactId, expected(), directory);
    command(
      'python3',
      [
        path.join(root, 'scripts/pages-stack-artifact.py'),
        '--zip',
        result.zipFile,
        '--out',
        result.output,
        '--sha256',
        result.checksum,
        '--kind',
        kind,
      ],
      { timeout: 600000 },
    );
    downloads.push({ kind, artifactId, ...result });
  }
  await fs.rename(
    downloads.find((row) => row.kind === 'preflight').output,
    path.dirname(packetFile()),
  );
  const frozen = await readPacket();
  const names = [];
  async function walk(directory, prefix = '') {
    for (const name of await fs.readdir(directory)) {
      const relative = prefix + name;
      const target = path.join(directory, name);
      const info = await fs.lstat(target);
      if (info.isDirectory() && !info.isSymbolicLink()) await walk(target, relative + '/');
      else {
        assert.ok(info.isFile() && info.nlink === 1);
        names.push(relative);
      }
    }
  }
  await walk(path.dirname(packetFile()));
  assert.deepEqual(
    names.sort(),
    [
      'preflight.json',
      'selector.json',
      ...frozen.overlay.files.map((row) => `overlay/${row.path}`),
    ].sort(),
    'Preflight ZIP namespace differs',
  );
  assert.equal(
    digest(await bounded(path.join(path.dirname(packetFile()), 'selector.json'), 1024 * 1024)),
    frozen.overlay.selectorSha256,
  );
  for (const row of frozen.overlay.files) {
    const bytes = await bounded(
      path.join(path.dirname(packetFile()), 'overlay', row.path),
      950000000,
    );
    assert.equal(bytes.length, row.bytes);
    assert.equal(digest(bytes), row.sha256);
  }
  if (process.env.CANDIDATE_RESULT === 'success') {
    const bundle = path.join(temp(), 'candidate-bundle');
    await fs.mkdir(bundle);
    for (const name of [
      'artifact.tar',
      'main-pages-inventory.json',
      'main-pages-receipt.json',
      'main-pages-archive-receipt.json',
    ]) {
      const row = downloads.find(
        (row) => row.kind === (name === 'artifact.tar' ? 'pages' : 'receipts'),
      );
      await fs.copyFile(
        path.join(row.output, name),
        path.join(bundle, name),
        fsConstants.COPYFILE_EXCL,
      );
    }
  }
  await fs.writeFile(path.join(temp(), 'stack-artifact-downloads.json'), json(downloads), {
    flag: 'wx',
  });
}
async function prepare() {
  controllerIdentity();
  const input = parseStackInput(process.env.EXPECTED_MAIN, process.env.STACK_PRS);
  assert.equal(input.mainSha, process.env.GITHUB_SHA);
  validateStackRun(api(`actions/runs/${process.env.GITHUB_RUN_ID}`), expected());
  const sourceCommittedAt = git(['show', '-s', '--format=%cI', input.mainSha]).trim();
  const closureSources = new Map();
  const closure = await trustedImportClosure('publishing/optional-package-promotion.mjs', {
    readSource: async (file) => {
      const bytes = git(['show', `${input.mainSha}:${file}`], root, {
        encoding: 'buffer',
        maxBuffer: 8 * 1024 * 1024,
      });
      closureSources.set(file, digest(bytes));
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    },
  });
  const source = await freezeStackSources(input, {
    api,
    fetchObjects,
    prove,
    compose: (value) => composeStackObjects(value, root, sourceCommittedAt),
    changedPaths: (base, head) =>
      git(['diff', '--no-renames', '--name-only', '-z', base, head]).split('\0').filter(Boolean),
    closurePaths: closure.paths,
  });
  const selector = git(['show', `${source.composition.commit}:${selectorPath}`], root, {
    encoding: 'buffer',
    maxBuffer: 1024 * 1024,
  });
  const overlay = await freezeCandidateOverlay(selector, overlayReader());
  const packet = {
    format: 'revealline-pages-stack-preflight.v1',
    ...expected(),
    input,
    snapshot: source.snapshot,
    composition: source.composition,
    pathEvidence: source.pathEvidence,
    syntheticSha: source.composition.commit,
    syntheticTree: source.composition.tree,
    sourceCommittedAt,
    buildVersion: `main-${source.composition.commit.slice(0, 12)}`,
    overlay: overlay.identity,
    controllerClosure: {
      entry: 'publishing/optional-package-promotion.mjs',
      ...closure,
      files: closure.paths.map((file) => ({ path: file, sha256: closureSources.get(file) })),
    },
    ...stackFlags(),
  };
  validateStackPacket(packet, expected());
  // Fail closed if a long public download outlived any frozen PR/ref/check input.
  const fresh = assessStackFreshness(
    packet.snapshot,
    await readStackObservations(input, { api, prove }),
    api('git/ref/heads/main').object?.sha,
  );
  assert.equal(fresh.currentQueueEligible, true, 'Stack moved during external preflight');
  const directory = path.dirname(packetFile());
  await fs.mkdir(directory);
  for (const [name, bytes] of overlay.overlay) {
    const target = path.join(directory, 'overlay', name);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, bytes, { flag: 'wx' });
  }
  await fs.writeFile(path.join(directory, 'selector.json'), selector, { flag: 'wx' });
  const bytes = Buffer.from(json(packet));
  assert.ok(bytes.length <= 16 * 1024 * 1024);
  await fs.writeFile(packetFile(), bytes, { flag: 'wx' });
  await fs.appendFile(
    process.env.GITHUB_OUTPUT,
    `preflight_sha256=${digest(bytes)}\nsource_sha=${packet.syntheticSha}\n`,
  );
}
async function reconstruct() {
  noCredentials();
  controllerIdentity();
  const frozen = await readPacket();
  const cwd = path.join(process.env.GITHUB_WORKSPACE, 'candidate');
  fetchObjects(
    [
      frozen.input.mainSha,
      ...frozen.input.entries.map((row) => row.headSha),
      ...frozen.snapshot.members.map((row) => row.baseSha),
    ],
    cwd,
  );
  const actual = composeStackObjects(
    { mainSha: frozen.input.mainSha, headShas: frozen.input.entries.map((row) => row.headSha) },
    cwd,
    frozen.sourceCommittedAt,
  );
  assert.deepEqual(actual, frozen.composition, 'Reconstruction differs from trusted source');
  git(['checkout', '--detach', actual.commit], cwd);
}
async function stage() {
  noCredentials();
  controllerIdentity();
  const frozen = await readPacket();
  const site = path.join(temp(), 'main-pages');
  assert.ok((await fs.lstat(site)).isDirectory());
  await assert.rejects(fs.lstat(path.join(site, 'practice')), { code: 'ENOENT' });
  for (const row of frozen.overlay.files) {
    const bytes = await bounded(
      path.join(path.dirname(packetFile()), 'overlay', row.path),
      950000000,
    );
    assert.equal(bytes.length, row.bytes);
    assert.equal(digest(bytes), row.sha256);
    const destination = path.join(site, row.path);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, bytes, { flag: 'wx' });
  }
  command(process.execPath, [path.join(root, 'scripts/write-main-pages-metadata.mjs')], {
    env: {
      ...process.env,
      SOURCE_SHA: frozen.syntheticSha,
      SOURCE_COMMITTED_AT: frozen.sourceCommittedAt,
      BUILD_VERSION: frozen.buildVersion,
    },
  });
}
async function verify() {
  controllerIdentity();
  const frozen = await readPacket();
  validateStackRun(api(`actions/runs/${process.env.GITHUB_RUN_ID}`), expected());
  for (const [artifactId, kind] of [
    [process.env.PREFLIGHT_ARTIFACT_ID, 'preflight'],
    [process.env.CANDIDATE_ARTIFACT_ID, 'pages'],
    [process.env.RECEIPT_ARTIFACT_ID, 'receipts'],
  ]) {
    validateArtifactProvenance(api(`actions/artifacts/${artifactId}`), {
      artifactId,
      runId: frozen.runId,
      controllerSha: frozen.controllerSha,
      name: stackArtifactName(kind, frozen),
    });
  }
  const bundle = path.join(temp(), 'candidate-bundle');
  assert.equal(
    parse(await bounded(path.join(bundle, 'main-pages-receipt.json'))).maximumBytes,
    980000000,
  );
  assert.equal(
    parse(await bounded(path.join(bundle, 'main-pages-archive-receipt.json'))).maximumArchiveBytes,
    980000000,
  );
  assert.equal(
    parse(await bounded(path.join(bundle, 'main-pages-archive-receipt.json'))).artifactId,
    process.env.CANDIDATE_ARTIFACT_ID,
  );
  command('python3', [
    path.join(root, 'scripts/pages-candidate-archive.py'),
    '--bundle',
    bundle,
    '--preflight',
    packetFile(),
  ]);
  const actual = parse(await bounded(path.join(bundle, 'independent-archive.json')));
  await verifyCandidateMetadata(actual, frozen);
  const selector = await bounded(
    path.join(path.dirname(packetFile()), 'selector.json'),
    1024 * 1024,
  );
  assert.equal(digest(selector), frozen.overlay.selectorSha256);
  const reasons = [];
  let externalInputStatus = 'verified';
  try {
    await recheckCandidateOverlay(selector, frozen.overlay, overlayReader());
  } catch (error) {
    externalInputStatus = error?.code === 'CANDIDATE_OVERLAY_STALE' ? 'changed' : 'unverifiable';
    reasons.push(`external-inputs-${externalInputStatus}`);
  }
  let observations = null;
  try {
    fetchObjects([
      frozen.input.mainSha,
      ...frozen.input.entries.map((row) => row.headSha),
      ...frozen.snapshot.members.map((row) => row.baseSha),
    ]);
    const recomposed = composeStackObjects(
      { mainSha: frozen.input.mainSha, headShas: frozen.input.entries.map((row) => row.headSha) },
      root,
      frozen.sourceCommittedAt,
    );
    assert.deepEqual(recomposed, frozen.composition);
    observations = await readStackObservations(frozen.input, { api, prove });
  } catch (error) {
    reasons.push(
      error instanceof assert.AssertionError ? 'chain-invalid-or-changed' : 'chain-unverifiable',
    );
  }
  let currentMainSha;
  try {
    currentMainSha = api('git/ref/heads/main').object?.sha;
  } catch {
    reasons.push('main-unverifiable');
  }
  const freshness = assessStackFreshness(frozen.snapshot, observations, currentMainSha);
  freshness.reasons.push(...reasons);
  if (reasons.length)
    Object.assign(freshness, {
      current: false,
      stale: true,
      currentQueueEligible: false,
      historicalDiagnosticOnly: true,
    });
  const result = {
    ...freshness,
    format: 'revealline-pages-stack-measurement.v1',
    measurementComplete: true,
    controllerSha: frozen.controllerSha,
    runId: frozen.runId,
    runAttempt: frozen.runAttempt,
    snapshot: frozen.snapshot,
    composition: frozen.composition,
    syntheticSha: frozen.syntheticSha,
    syntheticTree: frozen.syntheticTree,
    preflightSha256: process.env.PREFLIGHT_SHA256,
    artifactId: process.env.CANDIDATE_ARTIFACT_ID,
    archiveBytes: actual.archiveBytes,
    archiveSha256: actual.archiveSha256,
    externalInputStatus,
    ...stackFlags(),
    limitation:
      'Complete archive byte verification is not source-content, gameplay, native or offline qualification; no capacity reservation, merge authorization or isolated PR attribution.',
  };
  await fs.writeFile(path.join(temp(), 'stack-measurement.json'), json(result), { flag: 'wx' });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const actions = { prepare, reconstruct, stage, download, verify };
  assert.ok(
    Object.hasOwn(actions, process.argv[2]) && process.argv.length === 3,
    'Unknown stack diagnostic command',
  );
  try {
    await actions[process.argv[2]]();
  } catch (error) {
    if (['verify', 'download'].includes(process.argv[2]))
      await fs.writeFile(
        path.join(temp(), 'stack-measurement.json'),
        json(stackFailure('independent-verification-failed')),
        { flag: 'wx' },
      );
    throw error;
  }
}

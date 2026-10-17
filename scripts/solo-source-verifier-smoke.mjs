import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { projectDefaultRuntimeMetadata } from './default-runtime-metadata.mjs';
import { SOLO_MP3_WORKER_FILES } from './solo-build-worker-closure.mjs';

// These imports execute in readBuildConfig even when no distribution is built.
export const SOURCE_VERIFIER_DYNAMIC_ROOTS = Object.freeze([
  'scripts/soundtrack-distribution.mjs',
  'scripts/optional-distribution.mjs',
  'scripts/external-distribution.mjs',
  'scripts/optional-artwork.mjs',
]);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function put(directory, name, value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
  assert(bytes.length < 64 * 1024, 'Small synthetic fixture only');
  await mkdir(dirname(join(directory, name)), { recursive: true });
  await writeFile(join(directory, name), bytes, { flag: 'wx' });
  return bytes;
}
function isolatedGitEnvironment(source) {
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')),
  );
  return {
    ...environment,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'core.hooksPath',
    GIT_CONFIG_VALUE_0: join(dirname(source), 'hooks'),
    GIT_TERMINAL_PROMPT: '0',
  };
}
function git(source, args) {
  const result = spawnSync('git', args, {
    cwd: source,
    encoding: 'utf8',
    timeout: 5000,
    maxBuffer: 64 * 1024,
    env: isolatedGitEnvironment(source),
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
export async function sourceVerifierSmoke(directory, { omitImport = null } = {}) {
  const owned = await mkdtemp(join(resolve(directory), 'source-verifier-smoke-'));
  const source = join(owned, 'source'),
    artifact = join(owned, 'artifact');
  await mkdir(join(owned, 'hooks'));
  await mkdir(source);
  await mkdir(artifact);
  const originalConfig = JSON.parse(await readFile(join(root, 'game/build-config.json')));
  const config = {
    version: '0.1.0',
    entry: 'game/index.html',
    include: ['game'],
    optionalOffline: [],
  };
  for (const name of [
    'soundtrackAlbums',
    'optionalChapters',
    'externalChapters',
    'optionalArtwork',
  ]) {
    assert(originalConfig[name], `Required configured verification branch: ${name}`);
    config[name] = originalConfig[name];
  }
  await put(source, 'game/build-config.json', JSON.stringify(config));
  await put(
    source,
    'game/content/packs/index.json',
    JSON.stringify({ format: 'xonix-pack-index.v1', packs: [] }),
  );
  const template = 'const config = __XONIX_OFFLINE_CONFIG__;\n';
  await put(source, 'game/offline/service-worker.template.js', template);
  const entries = new Map();
  const add = async (name, value, inSource = false) => {
    let bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
    if (inSource) {
      await put(source, name, bytes);
      const projected = { name, bytes };
      await projectDefaultRuntimeMetadata(source, [projected]);
      bytes = projected.bytes;
    }
    await put(artifact, name, bytes);
    entries.set(name, bytes);
    return { path: name, bytes: bytes.length, sha256: hash(bytes) };
  };
  await add('game/index.html', '<!doctype html><main>Verifier closure fixture</main>', true);
  await add('game/app.mjs', 'export function fixture() {\n    return 1;\n}\n', true);
  const workers = [];
  for (const name of SOLO_MP3_WORKER_FILES)
    workers.push(await add(name, 'export const fixture = true;\n', true));
  await add(
    'game/content-design/route-snapshot.mjs',
    'export function loadRouteSnapshot(value) { return value; }\n',
  );
  const descriptor = await add('game/content-design/fixture.json', '{}');
  const current = {
      id: 'fixture',
      path: 'fixture.json',
      bytes: descriptor.bytes,
      sha256: descriptor.sha256,
    },
    routes = {};
  await add(
    'game/content-design/route-loader.mjs',
    `import { loadRouteSnapshot } from './route-snapshot.mjs';\nconst CURRENT = ${JSON.stringify(current)};\nconst ROUTES = ${JSON.stringify(routes)};\nexport async function loadAuthoredJourneyRoute(id, options = {}) {\n  const descriptor = id === CURRENT.id && !options.fullSource ? CURRENT : ROUTES[id];\n  return descriptor ? loadRouteSnapshot(descriptor, options) : null;\n}\n`,
  );
  const core = {
    format: 'revealline-offline.v1',
    version: '0.1.0',
    buildId: 'smoke',
    files: workers,
  };
  await add('offline-cache.json', JSON.stringify(core));
  await add(
    'offline-content.json',
    JSON.stringify({
      format: 'revealline-offline-content.v2',
      version: '0.1.0',
      groups: [],
      files: [],
    }),
  );
  await add(
    'offline-inventory.json',
    JSON.stringify({
      format: 'revealline-offline-inventory.v1',
      version: '0.1.0',
      files: workers.map((row) => ({ ...row, delivery: 'core' })),
    }),
  );
  await add(
    'service-worker.js',
    template.replace('__XONIX_OFFLINE_CONFIG__', JSON.stringify(core)),
  );
  // The verifier's default path checks a digest sidecar, not ZIP expansion. The
  // archive admission/hosted full package tests remain independent requirements.
  const zip = Buffer.from('Synthetic sidecar-check bytes; not an archive or game build.');
  await put(artifact, 'distribution.zip', zip);
  await put(artifact, 'distribution.zip.sha256', hash(zip) + '  distribution.zip\n');
  git(source, ['init', '--template=', '-q']);
  git(source, ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'add', '.']);
  git(source, [
    '-c',
    'user.name=Fixture',
    '-c',
    'user.email=fixture@example.invalid',
    '-c',
    'commit.gpgsign=false',
    'commit',
    '-qm',
    'Synthetic verifier dependency fixture',
  ]);
  const revision = git(source, ['rev-parse', 'HEAD']);
  await put(
    artifact,
    '.xonix-build.json',
    JSON.stringify({ tool: 'xonix-game-cli', formatVersion: 1 }),
  );
  const files = [...entries].map(([path, bytes]) => ({
    path,
    bytes: bytes.length,
    sha256: hash(bytes),
  }));
  await put(
    artifact,
    'manifest.json',
    JSON.stringify({
      formatVersion: 1,
      version: '0.1.0',
      sourceRevision: revision,
      totalBytes: files.reduce((sum, row) => sum + row.bytes, 0),
      files,
    }),
  );
  const output = join(owned, 'report.json'),
    args = process.execArgv.filter((arg) => !arg.startsWith('--test'));
  if (omitImport) {
    assert(SOURCE_VERIFIER_DYNAMIC_ROOTS.includes(omitImport));
    const loader = `export async function resolve(specifier, context, next) { const result = await next(specifier, context); if (result.url === ${JSON.stringify(pathToFileURL(join(root, omitImport)).href)}) { const error = new Error('Deliberately omitted verified dynamic dependency: ' + result.url); error.code = 'ERR_MODULE_NOT_FOUND'; throw error; } return result; }`;
    args.push('--experimental-loader', 'data:text/javascript,' + encodeURIComponent(loader));
  }
  args.push(
    join(root, 'scripts/verify-solo-build.mjs'),
    artifact,
    output,
    `--source=${source}`,
    `--base=${revision}`,
  );
  const command = spawnSync(process.execPath, args, {
    cwd: root,
    env: isolatedGitEnvironment(source),
    encoding: 'utf8',
    timeout: 15000,
    maxBuffer: 1024 * 1024,
  });
  const bytes = await readFile(output);
  assert(bytes.length < 256 * 1024);
  const report = JSON.parse(bytes);
  return {
    directory: owned,
    exitCode: command.status,
    signal: command.signal,
    error: command.error?.code ?? null,
    report,
    reportIdentity: { bytes: bytes.length, sha256: hash(bytes) },
    stderr: command.stderr.slice(0, 4096),
    scope:
      'Synthetic source-verifier dependency smoke only; no game build, browser, archive or performance qualification.',
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await sourceVerifierSmoke(process.argv[2]);
  console.log(JSON.stringify(result));
  process.exitCode = result.exitCode;
}

/** Tiny real-Git/controller integration; mock transport, never a full site build. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { trustedImportClosure } from './pages-candidate-overlay.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const realGit = spawnSync('/usr/bin/which', ['git'], { encoding: 'utf8' }).stdout.trim();
const repository = 'mekhovov/revealline';
function run(name, args, options = {}) {
  const value = spawnSync(name, args, {
    encoding: 'utf8',
    timeout: 60000,
    maxBuffer: 4 * 1024 * 1024,
    ...options,
  });
  assert.equal(value.status, 0, value.stderr || value.error?.message);
  return value.stdout;
}
const gitEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Tiny fixture',
  GIT_AUTHOR_EMAIL: 'fixture@localhost',
  GIT_COMMITTER_NAME: 'Tiny fixture',
  GIT_COMMITTER_EMAIL: 'fixture@localhost',
  GIT_AUTHOR_DATE: '2026-10-16T00:00:00Z',
  GIT_COMMITTER_DATE: '2026-10-16T00:00:00Z',
};
const git = (cwd, ...args) =>
  run(realGit, ['-c', 'core.hooksPath=/dev/null', ...args], { cwd, env: gitEnv }).trim();
async function put(file, bytes) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, bytes);
}
async function executable(file, source) {
  await put(file, source);
  await fs.chmod(file, 0o700);
}

test('actual controller commands retain advanced main and parent/child objects, bind ZIPs and verify complete tiny archive', async (t) => {
  const directory = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'pages-stack-controller-')),
  );
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const controller = path.join(directory, 'controller');
  await fs.mkdir(controller);
  const closure = await trustedImportClosure('scripts/pages-stack-measurement.mjs', {
    readSource: (name) => fs.readFile(path.join(root, name), 'utf8'),
  });
  const files = [
    ...new Set([
      ...closure.paths,
      'package.json',
      'scripts/pages-stack-artifact.py',
      'scripts/pages-candidate-archive.py',
      'scripts/pages-capacity-evidence.py',
      'scripts/pages-archive-evidence.py',
      'scripts/write-main-pages-metadata.mjs',
      'scripts/access-pages.mjs',
      'publishing/pages-controller/optional-packages.json',
    ]),
  ];
  for (const name of files)
    await put(path.join(controller, name), await fs.readFile(path.join(root, name)));
  await put(path.join(controller, '.gitignore'), 'node_modules\n');
  await fs.symlink(path.join(root, 'node_modules'), path.join(controller, 'node_modules'), 'dir');
  git(controller, 'init', '-b', 'main');
  git(controller, 'add', '.');
  git(controller, 'commit', '-m', 'tiny trusted source');
  const base = git(controller, 'rev-parse', 'HEAD');
  git(controller, 'switch', '-c', 'codex/stack-parent');
  await put(path.join(controller, 'game/parent-fixture.txt'), 'parent retained\n');
  git(controller, 'add', 'game/parent-fixture.txt');
  git(controller, 'commit', '-m', 'parent');
  const parent = git(controller, 'rev-parse', 'HEAD');
  git(controller, 'switch', '-c', 'codex/stack-child');
  await put(path.join(controller, 'game/child-fixture.txt'), 'child retained\n');
  git(controller, 'add', 'game/child-fixture.txt');
  git(controller, 'commit', '-m', 'child');
  const child = git(controller, 'rev-parse', 'HEAD');
  git(controller, 'switch', 'main');
  await put(path.join(controller, 'game/main-fixture.txt'), 'advanced main retained\n');
  git(controller, 'add', 'game/main-fixture.txt');
  git(controller, 'commit', '-m', 'advance main');
  const main = git(controller, 'rev-parse', 'HEAD');
  const configFile = path.join(directory, 'api.json');
  const pulls = [parent, child].map((head, i) => ({
    number: i + 1,
    state: 'open',
    draft: true,
    mergeable: true,
    mergeable_state: 'clean',
    head: {
      sha: head,
      ref: i ? 'codex/stack-child' : 'codex/stack-parent',
      repo: { full_name: repository },
    },
    base: {
      sha: i ? parent : base,
      ref: i ? 'codex/stack-parent' : 'main',
      repo: { full_name: repository },
    },
  }));
  const config = { main, parent, child, pulls, statuses: 'success', artifacts: {} };
  await fs.writeFile(configFile, JSON.stringify(config));
  const bin = path.join(directory, 'bin');
  await fs.mkdir(bin);
  // Transport doubles expose only local fixture objects/bytes. Actual Git object
  // composition, ancestry, checkout, Python scanners and metadata writer execute.
  await executable(
    path.join(bin, 'git'),
    `#!/usr/bin/env python3
import os,sys,json
args=sys.argv[1:]
c=json.load(open(os.environ['STACK_TEST_API']))
if args[-3:]==['remote','get-url','origin']:
 print('https://github.com/mekhovov/revealline');sys.exit(0)
if 'fetch' in args:
 values=args[args.index('origin')+1:]
 if not values or any(v not in c['objects'] for v in values):sys.exit(9)
 sys.exit(0)
os.execv(${JSON.stringify(realGit)},[${JSON.stringify(realGit)}]+args)
`,
  );
  await executable(
    path.join(bin, 'gh'),
    `#!/usr/bin/env python3
import os,sys,json
from urllib.parse import unquote
c=json.load(open(os.environ['STACK_TEST_API']))
if len(sys.argv)<3 or sys.argv[1]!='api':sys.exit(8)
e=unquote(sys.argv[2]);prefix='repos/mekhovov/revealline/'
if not e.startswith(prefix):sys.exit(7)
e=e[len(prefix):]
if e=='actions/runs/123':v={'id':123,'run_attempt':1,'head_sha':c['main'],'head_branch':'main','event':'workflow_dispatch','path':'.github/workflows/measure-pages-stack.yml','repository':{'full_name':'mekhovov/revealline'}}
elif e.startswith('pulls/'):v=c['pulls'][int(e.split('/')[1])-1]
elif e=='git/ref/heads/main':v={'object':{'type':'commit','sha':c['main']}}
elif e=='git/ref/heads/codex/stack-parent':v={'object':{'type':'commit','sha':c['parent']}}
elif '/check-runs?' in e:v={'total_count':0,'check_runs':[]}
elif '/statuses?' in e:v=[{'id':71,'context':'external-ci','state':c['statuses'],'target_url':None,'description':None,'created_at':None,'updated_at':None}]
elif e.startswith('actions/artifacts/'):
 a=c['artifacts'][e.split('/')[2]]
 if e.endswith('/zip'):
  with open(a['file'],'rb') as body:
   while True:
    data=body.read(8192)
    if not data:break
    sys.stdout.buffer.write(data)
  sys.exit(0)
 v=a['metadata']
else:sys.exit(6)
print(json.dumps(v))
`,
  );
  config.objects = [main, parent, child, base];
  await fs.writeFile(configFile, JSON.stringify(config));
  const env = {
    ...gitEnv,
    PATH: bin + path.delimiter + process.env.PATH,
    STACK_TEST_API: configFile,
    GITHUB_REF: 'refs/heads/main',
    GITHUB_REPOSITORY: repository,
    GITHUB_SHA: main,
    GITHUB_RUN_ID: '123',
    GITHUB_RUN_ATTEMPT: '1',
    GH_TOKEN: '',
    GITHUB_TOKEN: '',
    MAX_PUBLISHED_BYTES: '980000000',
  };
  const preflightTemp = path.join(directory, 'preflight');
  await fs.mkdir(preflightTemp);
  const dispatch = {
    ...env,
    RUNNER_TEMP: preflightTemp,
    EXPECTED_MAIN: main,
    STACK_PRS: JSON.stringify([
      { prNumber: 1, headSha: parent },
      { prNumber: 2, headSha: child },
    ]),
    GITHUB_OUTPUT: path.join(directory, 'outputs'),
  };
  const script = (cwd) => path.join(cwd, 'scripts/pages-stack-measurement.mjs');
  run(process.execPath, [script(controller), 'prepare'], { env: dispatch });
  const packetBytes = await fs.readFile(
    path.join(preflightTemp, 'candidate-preflight/preflight.json'),
  );
  const packet = JSON.parse(packetBytes);
  const packetHash = hash(packetBytes);
  assert.equal(packet.snapshot.members[0].baseSha, base);
  assert.equal(packet.snapshot.mainSha, main);
  assert.notEqual(packet.syntheticSha, main);
  assert.equal(git(controller, 'rev-parse', 'HEAD'), main);

  const workspace = path.join(directory, 'workspace');
  await fs.mkdir(workspace);
  const candidate = path.join(workspace, 'candidate');
  git(directory, 'clone', '--no-hardlinks', controller, candidate);
  const candidateTemp = path.join(directory, 'candidate-temp');
  await fs.mkdir(candidateTemp);
  await fs.cp(
    path.join(preflightTemp, 'candidate-preflight'),
    path.join(candidateTemp, 'candidate-preflight'),
    { recursive: true },
  );
  const candidateEnv = {
    ...env,
    GITHUB_WORKSPACE: workspace,
    RUNNER_TEMP: candidateTemp,
    PREFLIGHT_SHA256: packetHash,
    SOURCE_SHA: packet.syntheticSha,
    PAGES_ARTIFACT_ID: '2',
    GITHUB_OUTPUT: path.join(candidateTemp, 'outputs'),
  };
  run(process.execPath, [script(controller), 'reconstruct'], { env: candidateEnv });
  assert.equal(git(candidate, 'rev-parse', 'HEAD'), packet.syntheticSha);
  for (const name of ['parent', 'child', 'main'])
    assert.equal(
      git(candidate, 'show', `HEAD:game/${name}-fixture.txt`),
      `${name === 'main' ? 'advanced main' : name} retained`,
    );
  const site = path.join(candidateTemp, 'main-pages');
  const tags = ['id', 'salt', 'iterations', 'verifier']
    .map((name) => `<meta name="revealline-access-${name}" content="test-only-${name}">`)
    .join('\n');
  await put(path.join(site, 'game/index.html'), tags);
  await put(
    path.join(site, 'app/app.mjs'),
    '/* tiny manual build fixture, not a full site build */\n',
  );
  run(process.execPath, [script(controller), 'stage'], { env: candidateEnv });
  run('python3', [path.join(controller, 'scripts/pages-capacity-evidence.py')], {
    env: candidateEnv,
  });
  run('python3', [
    '-c',
    'import tarfile,sys\nwith tarfile.open(sys.argv[2],"w",format=tarfile.GNU_FORMAT) as bundle:bundle.add(sys.argv[1],arcname=".")',
    site,
    path.join(candidateTemp, 'artifact.tar'),
  ]);
  run('python3', [path.join(controller, 'scripts/pages-archive-evidence.py')], {
    env: candidateEnv,
  });

  const artifacts = path.join(directory, 'artifacts');
  await fs.mkdir(artifacts);
  for (const [id, kind, source, names] of [
    ['1', 'preflight', path.join(preflightTemp, 'candidate-preflight'), null],
    ['2', 'pages', candidateTemp, ['artifact.tar']],
    [
      '3',
      'receipts',
      candidateTemp,
      ['main-pages-inventory.json', 'main-pages-receipt.json', 'main-pages-archive-receipt.json'],
    ],
  ]) {
    const file = path.join(artifacts, id + '.zip');
    run('python3', [
      '-c',
      `import zipfile,pathlib,json,sys
source=pathlib.Path(sys.argv[1]);names=json.loads(sys.argv[3])
if names is None:names=[str(p.relative_to(source)) for p in source.rglob('*') if p.is_file()]
with zipfile.ZipFile(sys.argv[2],'w',compression=zipfile.ZIP_DEFLATED) as archive:
 for name in names:archive.write(source/name,name)`,
      source,
      file,
      JSON.stringify(names),
    ]);
    const bytes = await fs.readFile(file);
    config.artifacts[id] = {
      file,
      metadata: {
        id: Number(id),
        name: `stack-${kind}-123-1`,
        expired: false,
        size_in_bytes: bytes.length,
        digest: `sha256:${hash(bytes)}`,
        workflow_run: { id: 123, head_sha: main },
      },
    };
  }
  await fs.writeFile(configFile, JSON.stringify(config));
  const trustedVerifier = path.join(directory, 'trusted-verifier');
  git(directory, 'clone', '--no-hardlinks', controller, trustedVerifier);
  await fs.symlink(
    path.join(root, 'node_modules'),
    path.join(trustedVerifier, 'node_modules'),
    'dir',
  );
  async function verify(label, status = 'success') {
    config.statuses = status;
    await fs.writeFile(configFile, JSON.stringify(config));
    const verifierTemp = path.join(directory, label);
    await fs.mkdir(verifierTemp);
    const verifierEnv = {
      ...env,
      RUNNER_TEMP: verifierTemp,
      PREFLIGHT_SHA256: packetHash,
      PREFLIGHT_ARTIFACT_ID: '1',
      CANDIDATE_ARTIFACT_ID: '2',
      RECEIPT_ARTIFACT_ID: '3',
      CANDIDATE_RESULT: 'success',
    };
    run(process.execPath, [script(trustedVerifier), 'download'], { env: verifierEnv });
    run(process.execPath, [script(trustedVerifier), 'verify'], { env: verifierEnv });
    return JSON.parse(await fs.readFile(path.join(verifierTemp, 'stack-measurement.json'), 'utf8'));
  }
  const accepted = await verify('verified');
  assert.equal(accepted.measurementComplete, true);
  assert.equal(accepted.currentQueueEligible, true);
  assert.equal(accepted.syntheticSha, packet.syntheticSha);
  assert.equal(
    accepted.archiveBytes,
    (await fs.stat(path.join(candidateTemp, 'artifact.tar'))).size,
  );
  for (const key of ['mergeAuthorized', 'qualificationPerformed', 'productionDeploymentPerformed'])
    assert.equal(accepted[key], false);
  const historical = await verify('historical', 'failure');
  assert.equal(historical.measurementComplete, true);
  assert.equal(historical.currentQueueEligible, false);
  assert.equal(historical.historicalDiagnosticOnly, true);
  assert.equal(historical.archiveSha256, accepted.archiveSha256);
  assert.equal(git(controller, 'rev-parse', 'HEAD'), main);
  assert.equal(git(controller, 'rev-parse', 'codex/stack-parent'), parent);
  assert.equal(git(controller, 'rev-parse', 'codex/stack-child'), child);
});

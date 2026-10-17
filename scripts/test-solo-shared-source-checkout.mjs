import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { sourceVerifierSmoke } from './solo-source-verifier-smoke.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const helper = join(root, 'scripts/solo-shared-source-checkout.sh');
const actualGit = spawnSync('which', ['git'], { encoding: 'utf8' }).stdout.trim();
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
function command(args, cwd, env, check = true) {
  const result = spawnSync(args[0], args.slice(1), {
    cwd,
    env,
    encoding: 'utf8',
    timeout: 15000,
    maxBuffer: 1024 * 1024,
  });
  if (check) assert.equal(result.status, 0, result.stderr);
  return result;
}
async function fixture(t) {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'solo-shared-checkout-')));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')),
  );
  Object.assign(env, {
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_TERMINAL_PROMPT: '0',
  });
  const smoke = await sourceVerifierSmoke(directory);
  assert.equal(smoke.exitCode, 0);
  const source = join(smoke.directory, 'source');
  const git = (cwd, ...args) => command([actualGit, ...args], cwd, env).stdout.trim();
  const baselineRevision = git(source, 'rev-parse', 'HEAD');
  const baselineTree = git(source, 'rev-parse', 'HEAD^{tree}');
  git(source, 'branch', 'baseline');
  await writeFile(join(source, 'synthetic-source-note.txt'), 'Distinct candidate commit.\n');
  git(source, 'add', 'synthetic-source-note.txt');
  git(
    source,
    '-c',
    'user.name=Fixture',
    '-c',
    'user.email=fixture@example.invalid',
    '-c',
    'commit.gpgsign=false',
    'commit',
    '-qm',
    'Synthetic candidate',
  );
  const candidateRevision = git(source, 'rev-parse', 'HEAD');
  const candidateTree = git(source, 'rev-parse', 'HEAD^{tree}');
  const remote = join(directory, 'remote.git');
  git(directory, 'clone', '--bare', '--no-local', source, remote);
  const workspace = join(directory, 'workspace');
  await mkdir(workspace);
  git(
    workspace,
    'clone',
    '--quiet',
    '--no-local',
    '--depth=1',
    '--single-branch',
    '--branch=baseline',
    `file://${remote}`,
    'baseline',
  );
  const baseline = join(workspace, 'baseline');
  git(baseline, 'remote', 'set-url', 'origin', 'https://github.com/mekhovov/revealline');
  assert.notEqual(
    command([actualGit, 'cat-file', '-e', candidateRevision], baseline, env, false).status,
    0,
    'The candidate commit must arrive only in the tested fetch',
  );
  const bin = join(directory, 'bin');
  await mkdir(bin);
  const calls = join(directory, 'fetch-calls.jsonl');
  // Test-only transport seam: the production command still checks exact HTTPS
  // origin/authentication. Only its fetch transport is redirected to a tiny bare repo.
  await writeFile(
    join(bin, 'git'),
    `#!/usr/bin/env python3
import os,sys,json,subprocess,base64
args=sys.argv[1:];env=dict(os.environ)
if env.get('TEST_INSPECTION_FAIL') in ['status','ls-files'] and env['TEST_INSPECTION_FAIL'] in args:sys.exit(23)
if 'fetch' in args:
 expected='AUTHORIZATION: basic '+base64.b64encode(b'x-access-token:fixture-token').decode()
 assert env.get('GIT_CONFIG_COUNT')=='1'
 assert env.get('GIT_CONFIG_KEY_0')=='http.https://github.com/.extraheader'
 assert env.get('GIT_CONFIG_VALUE_0')==expected
 assert 'fixture-token' not in ' '.join(args) and expected not in ' '.join(args)
 with open(${JSON.stringify(calls)},'a') as f:f.write(json.dumps({'args':args,'authInEnvironmentOnly':True})+'\\n')
 if env.get('TEST_FETCH_FAIL')=='1':sys.exit(23)
 args[args.index('origin')]=${JSON.stringify(remote)}
 args=['-c','protocol.file.allow=always']+args
 for key in ['GIT_CONFIG_COUNT','GIT_CONFIG_KEY_0','GIT_CONFIG_VALUE_0']:env.pop(key,None)
result=subprocess.run([${JSON.stringify(actualGit)}]+args,env=env)
sys.exit(result.returncode)
`,
    { mode: 0o755 },
  );
  const run = (extra = {}, identities = []) =>
    command(
      [
        'bash',
        helper,
        ...[baselineRevision, baselineTree, candidateRevision, candidateTree].map(
          (value, index) => identities[index] ?? value,
        ),
      ],
      workspace,
      {
        ...env,
        PATH: bin + ':' + env.PATH,
        GITHUB_WORKSPACE: workspace,
        GITHUB_TOKEN: 'fixture-token',
        ...extra,
      },
      false,
    );
  return {
    directory,
    workspace,
    baseline,
    candidate: join(workspace, 'candidate'),
    baselineRevision,
    baselineTree,
    candidateRevision,
    candidateTree,
    smoke,
    git,
    env,
    calls,
    run,
  };
}
test('shared store materializes independent exact sources and actual native-source verifier accepts the worktree', async (t) => {
  const f = await fixture(t);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  const receipt = JSON.parse(result.stdout);
  assert.equal(receipt.status, 'passed');
  assert.equal(receipt.distinctFullWorktrees, true);
  assert.equal(f.git(f.baseline, 'rev-parse', 'HEAD'), f.baselineRevision);
  assert.equal(f.git(f.baseline, 'rev-parse', 'HEAD^{tree}'), f.baselineTree);
  assert.equal(f.git(f.baseline, 'status', '--porcelain'), '');
  assert.equal(f.git(f.candidate, 'rev-parse', 'HEAD'), f.candidateRevision);
  assert.match(await readFile(join(f.candidate, '.git'), 'utf8'), /^gitdir: /);
  const calls = (await readFile(f.calls, 'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(calls.length, 1);
  assert(calls[0].authInEnvironmentOnly);
  assert(!calls[0].args.some((arg) => arg.includes('filter')));
  const config = await readFile(join(f.baseline, '.git/config'), 'utf8');
  assert(!/fixture-token|AUTHORIZATION|extraheader/.test(config));
  assert(!/fixture-token|AUTHORIZATION/.test(result.stdout + result.stderr));
  const manifestPath = join(f.smoke.report.artifact, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath));
  manifest.sourceRevision = f.candidateRevision;
  await writeFile(manifestPath, JSON.stringify(manifest));
  const verify = (name) => {
    const output = join(f.directory, name + '.json');
    const commandResult = command(
      [
        process.execPath,
        join(root, 'scripts/verify-solo-build.mjs'),
        f.smoke.report.artifact,
        output,
        `--source=${f.candidate}`,
        `--base=${f.candidateRevision}`,
      ],
      root,
      f.env,
      false,
    );
    return { output, commandResult };
  };
  const positive = verify('clean-worktree');
  assert.equal(positive.commandResult.status, 0, positive.commandResult.stderr);
  const proof = JSON.parse(await readFile(positive.output));
  assert.equal(proof.status, 'passed');
  assert.equal(proof.source.wholeTreeRevision, f.candidateRevision);
  await writeFile(join(f.candidate, 'game/app.mjs'), 'export const changed = true;\n');
  const negative = verify('dirty-worktree');
  assert.notEqual(negative.commandResult.status, 0);
  assert.equal(JSON.parse(await readFile(negative.output)).status, 'failed');
  assert.equal(f.git(f.baseline, 'status', '--porcelain'), '');
});
test('failed fetch is attempted once without fallback or candidate materialization', async (t) => {
  const f = await fixture(t);
  const result = f.run({ TEST_FETCH_FAIL: '1' });
  assert.equal(result.status, 23);
  assert.match(result.stderr, /failed at fetch-candidate/);
  assert.equal((await readFile(f.calls, 'utf8')).trim().split('\n').length, 1);
  await assert.rejects(readFile(join(f.candidate, '.git')), { code: 'ENOENT' });
  assert.equal(f.git(f.baseline, 'rev-parse', 'HEAD'), f.baselineRevision);
  assert.equal(f.git(f.baseline, 'status', '--porcelain'), '');
});
test('wrong candidate tree is rejected before materialization and baseline remains exact', async (t) => {
  const f = await fixture(t);
  assert.notEqual(f.run({}, [undefined, undefined, undefined, '0'.repeat(40)]).status, 0);
  await assert.rejects(readFile(join(f.candidate, '.git')), { code: 'ENOENT' });
  assert.equal(f.git(f.baseline, 'rev-parse', 'HEAD'), f.baselineRevision);
});
test('dirty, sparse or wrong-origin baseline and candidate alias cannot enter fetch', async (t) => {
  const f = await fixture(t);
  for (const command of ['status', 'ls-files'])
    assert.notEqual(f.run({ TEST_INSPECTION_FAIL: command }).status, 0);
  await writeFile(join(f.baseline, 'untracked.txt'), 'dirty');
  assert.notEqual(f.run().status, 0);
  await rm(join(f.baseline, 'untracked.txt'));
  f.git(f.baseline, 'config', 'core.sparseCheckout', 'true');
  assert.notEqual(f.run().status, 0);
  f.git(f.baseline, 'config', '--unset', 'core.sparseCheckout');
  f.git(f.baseline, 'remote', 'set-url', 'origin', 'https://example.invalid/repo');
  assert.notEqual(f.run().status, 0);
  f.git(f.baseline, 'remote', 'set-url', 'origin', 'https://github.com/mekhovov/revealline');
  await symlink(f.baseline, f.candidate);
  assert.notEqual(f.run().status, 0);
  await assert.rejects(readFile(f.calls), { code: 'ENOENT' });
});
test('helper source retains transient authentication and no source filters or native commands', async () => {
  const source = await readFile(helper, 'utf8');
  assert.match(source, /--no-write-fetch-head origin "\$candidate_revision"/);
  assert.match(source, /worktree add --quiet --detach/);
  assert.match(source, /GIT_CONFIG_VALUE_0="\$authorization"/);
  assert(!/git_safe .*config .*extraheader/.test(source));
  assert(!/--filter|playwright|npm |curl /.test(source));
  assert.match(hash(source), /^[a-f0-9]{64}$/);
});

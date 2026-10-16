import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { composeCandidate, verifyCandidateMetadata } from './pages-candidate-measurement.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureRoot = process.env.RUNNER_TEMP || path.resolve(root, '..');
function git(cwd, ...args) {
  const result = spawnSync('git', ['-c', 'core.hooksPath=/dev/null', ...args], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Fixture',
      GIT_AUTHOR_EMAIL: 'fixture@localhost',
      GIT_COMMITTER_NAME: 'Fixture',
      GIT_COMMITTER_EMAIL: 'fixture@localhost',
    },
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
test('public shallow reconstruction produces deterministic clean synthetic source without pushing', async () => {
  const directory = await fs.mkdtemp(path.join(fixtureRoot, 'candidate-compose-'));
  const source = path.join(directory, 'source');
  await fs.mkdir(source);
  git(source, 'init', '-b', 'main');
  await fs.writeFile(path.join(source, 'base.txt'), 'base\n');
  git(source, 'add', '.');
  git(source, 'commit', '-m', 'base');
  git(source, 'switch', '-c', 'feature');
  await fs.writeFile(path.join(source, 'feature.txt'), 'candidate\n');
  git(source, 'add', '.');
  git(source, 'commit', '-m', 'feature');
  const headSha = git(source, 'rev-parse', 'HEAD');
  git(source, 'switch', 'main');
  await fs.writeFile(path.join(source, 'main.txt'), 'main\n');
  git(source, 'add', '.');
  git(source, 'commit', '-m', 'main');
  const mainSha = git(source, 'rev-parse', 'HEAD');
  const destination = path.join(directory, 'clone');
  git(
    directory,
    'clone',
    '--no-hardlinks',
    '--depth=1',
    '--branch=main',
    pathToFileURL(source).href,
    destination,
  );
  const input = { mainSha, headSha };
  const first = composeCandidate(input, destination, '2026-10-16T00:00:00Z');
  const second = composeCandidate(input, destination, '2026-10-16T00:00:00Z');
  assert.deepEqual(second, first);
  assert.equal(git(destination, 'rev-parse', 'HEAD'), mainSha);
  assert.equal(git(source, 'rev-parse', 'main'), mainSha);
  assert.equal(git(destination, 'show', `${first.commit}:feature.txt`), 'candidate');
  assert.equal(git(destination, 'show', `${first.commit}:main.txt`), 'main');
  assert.equal(
    git(destination, 'rev-list', '--parents', '-n', '1', first.commit),
    `${first.commit} ${mainSha} ${headSha}`,
  );
});

test('rolling HTML and JSON validation invokes only the trusted literal writer', async () => {
  const temporary = await fs.mkdtemp(path.join(fixtureRoot, 'candidate-metadata-test-'));
  const previous = process.env.RUNNER_TEMP;
  process.env.RUNNER_TEMP = temporary;
  try {
    const site = path.join(temporary, 'main-pages');
    await fs.mkdir(path.join(site, 'game'), { recursive: true });
    const gameGateHTML =
      '<html><head>' +
      ['id', 'salt', 'iterations', 'verifier']
        .map((name) => `<meta name="revealline-access-${name}" content="test-only-${name}">`)
        .join('') +
      '</head></html>';
    await fs.writeFile(path.join(site, 'game/index.html'), gameGateHTML);
    const frozen = {
      syntheticSha: 'a'.repeat(40),
      sourceCommittedAt: '2026-10-16T00:00:00Z',
      buildVersion: `main-${'a'.repeat(12)}`,
    };
    const result = spawnSync(process.execPath, ['scripts/write-main-pages-metadata.mjs'], {
      cwd: root,
      env: {
        ...process.env,
        SOURCE_SHA: frozen.syntheticSha,
        SOURCE_COMMITTED_AT: frozen.sourceCommittedAt,
        BUILD_VERSION: frozen.buildVersion,
      },
    });
    assert.equal(result.status, 0, String(result.stderr));
    const metadata = { gameGateHTML };
    for (const [name, key] of [
      ['main-deployment.json', 'mainDeployment'],
      ['release.json', 'release'],
      ['releases/index.html', 'releasesHTML'],
    ])
      metadata[key] = await fs.readFile(path.join(site, name), 'utf8');
    await verifyCandidateMetadata({ metadata }, frozen);
    await assert.rejects(
      verifyCandidateMetadata(
        { metadata: { ...metadata, releasesHTML: '<html>unprotected</html>' } },
        frozen,
      ),
      /Rolling metadata differs/,
    );
    await assert.rejects(
      verifyCandidateMetadata({ metadata: { ...metadata, release: '{}' } }, frozen),
      /Rolling metadata differs/,
    );
    await assert.rejects(
      verifyCandidateMetadata({ metadata: { ...metadata, gameGateHTML: '<html></html>' } }, frozen),
      /incomplete/,
    );
  } finally {
    if (previous === undefined) delete process.env.RUNNER_TEMP;
    else process.env.RUNNER_TEMP = previous;
  }
});

test('manual workflow separates candidate execution from trusted verification and all write authority', async () => {
  const workflow = await fs.readFile(
    path.join(root, '.github/workflows/measure-pages-candidate.yml'),
    'utf8',
  );
  assert.doesNotMatch(workflow, /^\s+(?:pull_request|pull_request_target|workflow_run|push):/mu);
  assert.doesNotMatch(
    workflow,
    /(?:contents|actions|pages|id-token):\s*write|environment:|actions\/deploy-pages@|gh (?:pr|release)|pages-production/u,
  );
  assert.match(workflow, /MAX_PUBLISHED_BYTES: 980000000/u);
  assert.match(workflow, /group: pages-candidate-diagnostic/u);
  for (const job of ['preflight', 'candidate', 'verify'])
    assert.match(workflow, new RegExp(`^  ${job}:`, 'm'));
  const candidate = workflow.split('\n  candidate:')[1].split('\n  verify:')[0];
  assert.doesNotMatch(candidate, /GH_TOKEN|GITHUB_TOKEN|github-token:|secrets\./u);
  assert.equal((workflow.match(/persist-credentials: false/gu) || []).length, 4);
  assert.match(candidate, /--publication-profile main-pages/u);
  assert.match(candidate, /name: candidate-pages/u);
  const verifier = workflow.split('\n  verify:')[1];
  assert.doesNotMatch(
    verifier,
    /ref:.*(?:head_sha|source_sha)|working-directory: candidate|game-cli\.mjs|npm ci --prefer-offline/u,
  );
  assert.equal((verifier.match(/artifact-ids:/gu) || []).length, 3);
  assert.match(verifier, /ref: \$\{\{ github.sha \}\}/u);
  assert.match(verifier, /if-no-files-found: error/u);
});

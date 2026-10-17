import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const workflows = new URL('../.github/workflows/', import.meta.url);

test('pull-request admission workflows do not require GitHub Pages', async () => {
  for (const name of await fs.readdir(workflows)) {
    if (!/\.ya?ml$/u.test(name)) continue;
    // Publishing the protected main snapshot is intentionally optional and
    // runs only after a merge. It must not become an admission dependency for
    // pull requests, but it is not itself a pull-request workflow.
    if (name === 'publish-main-pages.yml') continue;
    const source = await fs.readFile(new URL(name, workflows), 'utf8');
    if (name === 'measure-pages-candidate.yml' || name === 'measure-pages-stack.yml') {
      // Manual measurement has no admission/deployment authority. Its archive
      // uses the same pinned uploader but a non-deployment artifact name.
      assert.match(source, /workflow_dispatch:/u);
      assert.match(source, /github.ref == 'refs\/heads\/main'/u);
      assert.doesNotMatch(source, /^\s+(?:pull_request|pull_request_target|workflow_run|push):/mu);
      assert.doesNotMatch(
        source,
        /(?:contents|actions|pages|id-token):\s*write|environment:|actions\/deploy-pages@|pages-production/u,
      );
      if (name === 'measure-pages-candidate.yml') assert.match(source, /name: candidate-pages/u);
      else
        assert.match(
          source,
          /name: stack-pages-\$\{\{ github.run_id \}\}-\$\{\{ github.run_attempt \}\}/u,
        );
      assert.match(source, /MAX_PUBLISHED_BYTES: 980000000/u);
      assert.match(source, /group: pages-candidate-diagnostic/u);
      continue;
    }
    if (name === 'preserve-pages-recovery.yml') {
      // This manually dispatched post-deployment recovery operation is not PR
      // admission. Assert its separation instead of mistaking receipt names
      // and read-only artifact downloads for a Pages publishing dependency.
      assert.match(source, /workflow_dispatch:/u);
      assert.match(source, /github.ref == 'refs\/heads\/main'/u);
      assert.doesNotMatch(source, /^\s+(?:pull_request|pull_request_target|workflow_run|push):/mu);
      assert.doesNotMatch(
        source,
        /pages:\s*write|actions\/(?:upload-pages-artifact|deploy-pages)@/u,
      );
      continue;
    }
    assert.doesNotMatch(source, /github-pages|pages:\s*write/u, name);
    assert.doesNotMatch(source, /actions\/(?:upload-pages-artifact|deploy-pages)@/u, name);
    assert.doesNotMatch(source, /main-pages|stage-pages|pages-production/u, name);
  }
});

test('the optional Pages publisher cannot run for a pull request', async () => {
  const source = await fs.readFile(
    new URL('../.github/workflows/publish-main-pages.yml', import.meta.url),
    'utf8',
  );
  assert.match(source, /push:\n\s+branches: \[main\]/u);
  assert.match(source, /workflow_dispatch:/u);
  assert.doesNotMatch(source, /pull_request|pull_request_target|workflow_run/u);
});

test('the required exact-head source gate remains independent of hosted deployment', async () => {
  const source = await fs.readFile(
    new URL('../.github/workflows/deploy-pages.yml', import.meta.url),
    'utf8',
  );
  assert.match(source, /^name: Validate source for continuous main$/mu);
  for (const command of [
    'npm run validate',
    'node ../automation/scripts/run-test-shard.mjs --shard ${{ matrix.shard }}/4 --root .',
    'node .source-gate-automation/scripts/check-source-identity.mjs --root .',
  ])
    assert.ok(source.includes(command), command);
  assert.match(source, /  release-ready:\n/);
  assert.doesNotMatch(source, /release-train-boundary\.mjs public|public Pages|Main Pages/u);
});

test('auto-merge wakes from PR validation, never hosted deployment', async () => {
  const source = await fs.readFile(
    new URL('../.github/workflows/fastline-auto-merge.yml', import.meta.url),
    'utf8',
  );
  for (const name of [
    'Validate source for continuous main',
    'Appearance preview',
    'Industrial feature verification',
    'Company edition candidates',
    'Assemble full-test release evidence',
    'Community hosted acceptance',
    'Community MinIO recovery',
  ])
    assert.ok(source.includes(`- ${name}`), name);
  assert.doesNotMatch(source, /Build and deploy GitHub Pages|github-pages/u);
});

test('the package interface exposes no Pages build command', async () => {
  const manifest = JSON.parse(
    await fs.readFile(new URL('../package.json', import.meta.url), 'utf8'),
  );
  assert.equal(Object.hasOwn(manifest.scripts, 'build:pages'), false);
});

test('the retired Pages playbook cannot prescribe a deployment path', async () => {
  const source = await fs.readFile(
    new URL('../.cursor/skills/deploy-release-pages/SKILL.md', import.meta.url),
    'utf8',
  );
  assert.match(source, /^# Retired GitHub Pages delivery$/mu);
  assert.match(
    source,
    /has no Pages deployment path\. Do not deploy, retry,\ndispatch, validate, or troubleshoot a Pages publication/u,
  );
  assert.doesNotMatch(source, /actions\/deploy-pages|upload-pages-artifact|pages:\s*write/u);
});

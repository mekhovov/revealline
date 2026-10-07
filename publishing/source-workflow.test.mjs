import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const workflows = new URL('../.github/workflows/', import.meta.url);

test('active workflows do not require GitHub Pages', async () => {
  for (const name of await fs.readdir(workflows)) {
    if (!/\.ya?ml$/u.test(name)) continue;
    const source = await fs.readFile(new URL(name, workflows), 'utf8');
    assert.doesNotMatch(source, /github-pages|pages:\s*write/u, name);
    assert.doesNotMatch(source, /actions\/(?:upload-pages-artifact|deploy-pages)@/u, name);
    assert.doesNotMatch(source, /main-pages|stage-pages|pages-production/u, name);
  }
});

test('the required exact-head source gate remains independent of hosted deployment', async () => {
  const source = await fs.readFile(new URL('../.github/workflows/deploy-pages.yml', import.meta.url), 'utf8');
  assert.match(source, /^name: Validate source for continuous main$/mu);
  for (const command of [
    'npm run validate',
    'node ../automation/scripts/run-test-shard.mjs --shard ${{ matrix.shard }}/4 --root .',
    'node .source-gate-automation/scripts/check-source-identity.mjs --root .',
  ]) assert.ok(source.includes(command), command);
  assert.match(source, /  release-ready:\n/);
  assert.doesNotMatch(source, /release-train-boundary\.mjs public|public Pages|Main Pages/u);
});

test('auto-merge wakes only from the exact-head source gate', async () => {
  const source = await fs.readFile(
    new URL('../.github/workflows/fastline-auto-merge.yml', import.meta.url),
    'utf8',
  );
  assert.match(source, /workflows: \[Validate source for continuous main\]/u);
  assert.doesNotMatch(source, /Build and deploy GitHub Pages|github-pages/u);
});

test('the package interface exposes no Pages build command', async () => {
  const manifest = JSON.parse(await fs.readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(Object.hasOwn(manifest.scripts, 'build:pages'), false);
});

test('the retired Pages playbook cannot prescribe a deployment path', async () => {
  const source = await fs.readFile(
    new URL('../.cursor/skills/deploy-release-pages/SKILL.md', import.meta.url),
    'utf8',
  );
  assert.match(source, /^# Retired GitHub Pages delivery$/mu);
  assert.match(source, /has no Pages deployment path\. Do not deploy, retry,\ndispatch, validate, or troubleshoot a Pages publication/u);
  assert.doesNotMatch(source, /actions\/deploy-pages|upload-pages-artifact|pages:\s*write/u);
});

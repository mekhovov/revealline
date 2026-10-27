import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFile(path.join(root, name), 'utf8');
test('manual stack workflow preserves three-job trust separation and unchanged capacity', async () => {
  const workflow = await read('.github/workflows/measure-pages-stack.yml');
  assert.match(workflow, /workflow_dispatch:/u);
  assert.doesNotMatch(workflow, /^  (?:push|pull_request|schedule|workflow_run):/mu);
  assert.match(workflow, /permissions:\n  contents: read\n  actions: read/u);
  assert.match(workflow, /group: pages-candidate-diagnostic\n  cancel-in-progress: false/u);
  assert.match(workflow, /MAX_PUBLISHED_BYTES: 980000000/u);
  assert.doesNotMatch(
    workflow,
    /(?:pages|id-token|contents|pull-requests): write|secrets\.|deploy-pages@|gh pr merge|git push/u,
  );
  const candidate = workflow.split('\n  candidate:\n')[1].split('\n  verify:\n')[0];
  assert.match(candidate, /permissions:\n      contents: read/u);
  assert.doesNotMatch(candidate, /GH_TOKEN|GITHUB_TOKEN|github\.token|inputs\./u);
  assert.equal((candidate.match(/persist-credentials: false/gu) || []).length, 2);
  assert.match(candidate, /node controller\/scripts\/pages-stack-measurement\.mjs reconstruct/u);
  assert.match(candidate, /--publication-profile main-pages/u);
  assert.match(candidate, /python3 controller\/scripts\/pages-capacity-evidence\.py/u);
  assert.match(candidate, /python3 controller\/scripts\/pages-archive-evidence\.py/u);
  const verifier = workflow.split('\n  verify:\n')[1];
  assert.equal((verifier.match(/actions\/checkout@/gu) || []).length, 1);
  assert.doesNotMatch(verifier, /working-directory: candidate|path: candidate\n/u);
  assert.doesNotMatch(verifier, /actions\/download-artifact@|merge-multiple:/u);
  assert.match(verifier, /node scripts\/pages-stack-measurement\.mjs download/u);
  const controller = await read('scripts/pages-stack-measurement.mjs');
  assert.match(controller, /downloadStackArtifact/u);
  assert.match(controller, /pages-stack-artifact\.py/u);
  assert.match(controller, /COPYFILE_EXCL/u);
  for (const name of ['preflight', 'pages', 'receipts', 'measurement'])
    assert.ok(workflow.includes(`name: stack-${name}-`));
  for (const line of workflow.split('\n').filter((line) => line.includes('uses:')))
    assert.match(line, /@[a-f0-9]{40}(?:\s|$)/u);
  assert.doesNotMatch(workflow, /run:.*\$\{\{ inputs\./u);
});
test('existing single-candidate workflow bytes are unchanged', async () => {
  const actual = createHash('sha1')
    .update(await read('.github/workflows/measure-pages-candidate.yml'))
    .digest('hex');
  // Literal digest is frozen independently before implementation publication.
  assert.equal(actual, '93180309e7210af310c46403400a7264c63b4be9');
});
test('unprivileged reconstruction and staging reject supplied credentials before Git or API access', () => {
  for (const action of ['reconstruct', 'stage']) {
    const result = spawnSync(
      process.execPath,
      [path.join(root, 'scripts/pages-stack-measurement.mjs'), action],
      {
        encoding: 'utf8',
        env: { ...process.env, GH_TOKEN: 'fixture-not-a-credential', GITHUB_TOKEN: '' },
      },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Candidate execution received API credentials/u);
  }
});

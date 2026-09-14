import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('source qualification retains six gates while the controller owns guarded main publication', async () => {
  const legacy = await fs.readFile(
    new URL('../../.github/workflows/deploy-pages.yml', import.meta.url),
    'utf8',
  );
  const workflow = await fs.readFile(
    new URL('../../.github/workflows/publish-frozen-pages.yml', import.meta.url),
    'utf8',
  );
  let previous = -1;
  for (const command of [
    'npm run validate',
    'npm run lint',
    'npm test',
    'npm run format:check',
    'npm run format:native:check',
    'node --check authoring/motion-lab/app.js',
  ]) {
    const offset = legacy.indexOf(command);
    assert.ok(offset > previous, `Missing or reordered source gate: ${command}`);
    previous = offset;
  }
  assert.match(legacy, /test -f publishing\/pages-controller\/publication.json/);
  assert.match(
    legacy,
    /if: github.event_name != 'pull_request' && needs.verify.outputs.frozen-controller != 'true'/,
  );
  assert.match(
    workflow,
    /if: github.event_name != 'pull_request' && github.ref == 'refs\/heads\/main'/,
  );
  assert.match(workflow, /environment:\n\s+name: github-pages/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /include-hidden-files: true/);
  assert.match(workflow, /publish\.mjs verify-artifact/);
  assert.ok(
    workflow.indexOf('publish.mjs verify-artifact') <
      workflow.indexOf('name: Upload verified Pages artifact'),
  );
  assert.doesNotMatch(workflow, /pull_request_target|environment:.*preview|npm test/);
});

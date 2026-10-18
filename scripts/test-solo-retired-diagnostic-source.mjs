import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import {
  RETIRED_SOLO_SOURCE,
  readSoloDiagnosticSource,
  retiredSoloDiagnosticSource,
} from './solo-retired-diagnostic-source.mjs';

const root = new URL('../', import.meta.url);
const load = (path) => readFile(new URL(path, root));
const witnessBytes = await load(RETIRED_SOLO_SOURCE);
const witness = JSON.parse(witnessBytes);

test('thirteen expired release edges retain exact historical source and unchanged jobs', async () => {
  assert.equal(witness.closedPullRequest, 1544);
  assert.equal(witness.mergeCommit, '56e29fd264f77df191b75b3425cc6e7bb0ce9e13');
  assert.equal(witness.workflows.length, 13);
  assert.equal(new Set(witness.workflows.map(({ path }) => path)).size, 13);
  for (const { path, source } of witness.workflows) {
    const current = (await load(path)).toString();
    assert.equal((await readSoloDiagnosticSource(path)).toString(), source);
    assert.equal(
      current.slice(current.indexOf('\npermissions:')),
      source.slice(source.indexOf('\npermissions:')),
    );
    assert.match(current, /on:\n  workflow_call:\n\npermissions:/);
    assert(!current.includes('\n  pull_request:'));
    assert(!current.includes('workflow_dispatch'));
    assert.match(current, /github.event.pull_request.number == 1544/);
    assert.match(current, /github.event.action == 'synchronize'/);
  }
});

test('no active workflow calls the retired diagnostics', async () => {
  const names = await readdir(new URL('.github/workflows/', root));
  for (const name of names.filter((name) => /\.ya?ml$/.test(name))) {
    const source = (await load(`.github/workflows/${name}`)).toString();
    for (const { path } of witness.workflows) {
      const filename = path.split('/').at(-1);
      assert(!new RegExp(`uses:[^\\n]*${filename.replaceAll('.', '\\.')}`).test(source), name);
    }
  }
});

test('active sparse consumers include the historical reader and its pinned source', async () => {
  const retired = new Set(witness.workflows.map(({ path }) => path));
  const names = await readdir(new URL('.github/workflows/', root));
  let consumers = 0;
  for (const name of names.filter((name) => /\.ya?ml$/.test(name))) {
    const path = `.github/workflows/${name}`;
    if (retired.has(path)) continue;
    const source = (await load(path)).toString();
    for (const block of source.split('sparse-checkout: |').slice(1)) {
      const checkout = block.split(/\n      - /)[0];
      if (!/\/scripts\/solo-(final-wave|page-error-source)-witness\.mjs/.test(checkout)) continue;
      consumers++;
      assert(checkout.includes('/scripts/solo-retired-diagnostic-source.mjs'), path);
      assert(checkout.includes(`/${RETIRED_SOLO_SOURCE}`), path);
    }
  }
  assert(consumers >= 4);
  assert.equal(witness.sparseConsumers.length, 4);
  for (const { path, source } of witness.sparseConsumers) {
    const current = await load(path);
    assert.equal(retiredSoloDiagnosticSource(path, current, witnessBytes).toString(), source);
    assert.throws(() => retiredSoloDiagnosticSource(path, Buffer.from(source), witnessBytes));
    assert.throws(() =>
      retiredSoloDiagnosticSource(path, Buffer.concat([current, Buffer.from(' ')]), witnessBytes),
    );
  }
});

test('historical reader rejects trigger revival, weakened guards and changed execution bytes', async () => {
  for (const { path, source } of witness.workflows) {
    const current = (await load(path)).toString();
    for (const altered of [
      source,
      current.replace('workflow_call:', 'pull_request:'),
      current.replace('number == 1544', 'number > 0'),
      current.replace('cancel-in-progress: false', 'cancel-in-progress: true'),
      `${current} `,
    ]) {
      assert.throws(() => retiredSoloDiagnosticSource(path, Buffer.from(altered), witnessBytes));
    }
  }
});

test('historical source bytes cannot be replaced and unretired files remain current', async () => {
  const { path } = witness.workflows[0];
  assert.throws(() =>
    retiredSoloDiagnosticSource(
      path,
      Buffer.from('changed'),
      Buffer.concat([witnessBytes, Buffer.from(' ')]),
    ),
  );
  const current = Buffer.from('unrelated current source');
  assert.equal(retiredSoloDiagnosticSource('unknown.yml', current, witnessBytes), current);
  assert.deepEqual(await readSoloDiagnosticSource('package.json'), await load('package.json'));
});

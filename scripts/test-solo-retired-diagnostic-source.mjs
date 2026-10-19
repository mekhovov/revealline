import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
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

test('active historical helper calls run without the retired module or fixture', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'solo-active-witness-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const retired = new Set(witness.workflows.map(({ path }) => path));
  const metadata = [
    'docs/performance/fixtures/solo-final-wave/a7e-execution-source.json',
    'docs/performance/fixtures/solo-error-witness/historical-source.json',
    'docs/performance/fixtures/solo-readiness/prior-tools-source.json',
    'docs/performance/fixtures/solo-representative/prior-qualification-tools.json',
  ];
  const documents = await Promise.all(metadata.map(async (path) => JSON.parse(await load(path))));
  const files = new Set([
    ...metadata,
    'scripts/solo-final-wave-witness.mjs',
    'scripts/solo-page-error-source-witness.mjs',
    'docs/performance/fixtures/solo-final-wave/a7e-correctness-workflow.yml',
  ]);
  for (const document of documents) {
    for (const source of document.sources ?? [document]) {
      for (const release of source.releases) {
        if (retired.has(release.workflow)) continue;
        files.add(release.workflow);
        for (const manifest of release.manifest
          ? [release.manifest]
          : Object.keys(release.manifests))
          files.add(manifest);
      }
    }
  }
  for (const path of files) {
    const target = join(directory, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, await load(path));
  }
  const final = await import(pathToFileURL(join(directory, 'scripts/solo-final-wave-witness.mjs')));
  const page = await import(
    pathToFileURL(join(directory, 'scripts/solo-page-error-source-witness.mjs'))
  );
  const refs = new Map(documents[0].files.map((entry) => [entry.path, entry]));
  let calls = 0;
  for (const release of documents[0].releases) {
    if (retired.has(release.workflow)) continue;
    for (const [manifest, paths] of Object.entries(release.manifests)) {
      await final.assertFinalWaveBindings(
        manifest,
        paths.map((path) => refs.get(path)),
        release.workflow,
      );
      calls++;
    }
  }
  for (const [document, read] of [
    [documents[2], page.readHistoricalPageErrorRefs],
    [documents[3], page.readHistoricalQualificationRefs],
  ]) {
    for (const source of document.sources) {
      for (const release of source.releases) {
        if (retired.has(release.workflow)) continue;
        assert((await read(release.manifest, release.workflow)).size > 0);
        calls++;
      }
    }
  }
  assert(calls >= 10);
  await assert.rejects(readFile(join(directory, 'scripts/solo-retired-diagnostic-source.mjs')));
  await assert.rejects(readFile(join(directory, RETIRED_SOLO_SOURCE)));
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

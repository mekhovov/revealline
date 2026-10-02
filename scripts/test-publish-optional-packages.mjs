import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { optionalPackageFixture } from '../publishing/optional-package-fixture.mjs';
const cli = new URL('publish-optional-packages.mjs', import.meta.url).pathname;
test('main Pages staging emits an explicit empty catalogue without GitHub and refuses replacement', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'practice-main-pages-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const output = path.join(directory, 'site'),
    selector = path.join(directory, 'selector.json');
  await fs.mkdir(output);
  await fs.writeFile(
    selector,
    JSON.stringify({ format: 'revealline-optional-package-publication.v1', releases: [] }),
  );
  const run = () =>
    spawnSync(
      process.execPath,
      [
        cli,
        'stage-pages',
        '--out',
        output,
        '--selector',
        selector,
        '--repository',
        'mekhovov/revealline',
        '--base-path',
        '/revealline/',
      ],
      { encoding: 'utf8' },
    );
  const first = run();
  assert.equal(first.status, 0, first.stderr);
  const bytes = await fs.readFile(path.join(output, 'practice/index.json'));
  assert.deepEqual(JSON.parse(bytes).packages, []);
  assert.notEqual(run().status, 0);
  assert.deepEqual(await fs.readFile(path.join(output, 'practice/index.json')), bytes);
});
async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'optional-delivery-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const candidate = await optionalPackageFixture();
  const bundle = path.join(directory, 'bundle');
  await fs.mkdir(bundle);
  for (const [name, bytes] of candidate.files) await fs.writeFile(path.join(bundle, name), bytes);
  const responsePath = path.join(directory, 'responses.json'),
    callsPath = path.join(directory, 'calls.jsonl'),
    selectorPath = path.join(directory, 'selector.json');
  const prefix = 'repos/mekhovov/revealline',
    responses = {},
    assets = [];
  let nextId = 1;
  for (const [name, bytes] of candidate.files) {
    const id = nextId++;
    assets.push({
      id,
      name,
      size: bytes.length,
      state: 'uploaded',
      digest: 'sha256:' + createHash('sha256').update(bytes).digest('hex'),
    });
    responses[`${prefix}/releases/assets/${id}`] = bytes.toString('base64');
  }
  const json = (value) => Buffer.from(JSON.stringify(value)).toString('base64');
  responses[`${prefix}/releases/tags/${candidate.envelope.version}`] = json({
    id: 101,
    tag_name: candidate.envelope.version,
    target_commitish: candidate.envelope.sourceRevision,
    upload_url:
      'https://uploads.github.com/repos/mekhovov/revealline/releases/101/assets{?name,label}',
    draft: false,
    prerelease: false,
    assets,
  });
  responses[`${prefix}/releases/101`] =
    responses[`${prefix}/releases/tags/${candidate.envelope.version}`];
  responses[`${prefix}/commits/tags/${candidate.envelope.version}`] = json({
    sha: candidate.envelope.sourceRevision,
    commit: { tree: { sha: candidate.envelope.sourceTree } },
  });
  await fs.writeFile(responsePath, JSON.stringify(responses));
  await fs.writeFile(callsPath, '');
  await fs.writeFile(
    selectorPath,
    JSON.stringify({ format: 'revealline-optional-package-publication.v1', releases: [] }),
  );
  await fs.writeFile(
    path.join(directory, 'gh'),
    `#!/usr/bin/env node
const fs = require('node:fs'); const args = process.argv.slice(2);
fs.appendFileSync(process.env.OPTIONAL_CALLS, JSON.stringify(args) + '\\n');
if(args[0] === 'api' && args.includes('--method') && args[args.indexOf('--method')+1] === 'POST' && process.env.OPTIONAL_ALLOW_UPLOAD === 'test-only') {
  const data = JSON.parse(fs.readFileSync(process.env.OPTIONAL_RESPONSES));
  const prefix = 'repos/mekhovov/revealline', route = prefix + '/releases/101';
  const url = new URL(args.find(value=>value.startsWith('https://')));
  if(url.origin !== 'https://uploads.github.com' || url.pathname !== '/repos/mekhovov/revealline/releases/101/assets')process.exit(93);
  const release = JSON.parse(Buffer.from(data[route], 'base64'));
  const bytes = fs.readFileSync(args[args.indexOf('--input')+1]), name = url.searchParams.get('name');
  if(release.assets.some(row=>row.name === name) || args.includes('--clobber'))process.exit(92);
  const id = 1000 + release.assets.length;
  const asset = {id,name,size:bytes.length,state:'uploaded',digest:'sha256:'+require('node:crypto').createHash('sha256').update(bytes).digest('hex')};
  release.assets.push(asset);
  data[prefix + '/releases/assets/' + id] = bytes.toString('base64');
  data[route] = Buffer.from(JSON.stringify(release)).toString('base64');
  data[prefix + '/releases/tags/' + release.tag_name] = data[route];
  fs.writeFileSync(process.env.OPTIONAL_RESPONSES, JSON.stringify(data));
  process.stdout.write(JSON.stringify(asset));
  process.exit(0);
}
if(args[0] !== 'api' || args.includes('--method') || args.includes('-X')) process.exit(90);
const route = args.find(value=>value.startsWith('repos/'));
if(process.env.OPTIONAL_EDIT_ROUTE === route) fs.writeFileSync(process.env.OPTIONAL_SELECTOR, process.env.OPTIONAL_EDIT_BYTES);
const data = JSON.parse(fs.readFileSync(process.env.OPTIONAL_RESPONSES));
if(!data[route])process.exit(91);
process.stdout.write(Buffer.from(data[route], 'base64'));
`,
    { mode: 0o755 },
  );
  const run = (command, extra = [], environment = {}) =>
    spawnSync(
      process.execPath,
      [
        cli,
        command,
        '--bundle',
        bundle,
        '--review',
        path.join(bundle, 'optional-package-review.json'),
        ...extra,
      ],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: directory + path.delimiter + process.env.PATH,
          OPTIONAL_CALLS: callsPath,
          OPTIONAL_RESPONSES: responsePath,
          OPTIONAL_SELECTOR: selectorPath,
          ...environment,
        },
      },
    );
  return {
    candidate,
    directory,
    bundle,
    selectorPath,
    callsPath,
    responses,
    responsePath,
    prefix,
    run,
  };
}

test('optional CLI verifies local originals without GitHub and stages only downloaded reviewed selectors', async (t) => {
  const f = await fixture(t);
  const verified = f.run('verify');
  assert.equal(verified.status, 0, verified.stderr);
  assert.equal(JSON.parse(verified.stdout).publicEligible, true);
  assert.equal(await fs.readFile(f.callsPath, 'utf8'), '');
  const selected = f.run('sync-selector', [
    '--repository',
    'mekhovov/revealline',
    '--base-path',
    '/revealline/',
    '--selector',
    f.selectorPath,
  ]);
  assert.equal(selected.status, 0, selected.stderr);
  const selector = JSON.parse(await fs.readFile(f.selectorPath));
  assert.deepEqual(selector.releases[0], f.candidate.release);
  const calls = (await fs.readFile(f.callsPath, 'utf8')).trim().split('\n').map(JSON.parse);
  assert.ok(calls.some((args) => args.includes(`${f.prefix}/commits/tags/v1.2.3`)));
  assert.ok(
    calls.every((args) => args[0] === 'api' && !args.includes('--method') && !args.includes('-X')),
  );
});

test('optional selector remains unchanged after foreign tags, changed downloads or concurrent edits', async (t) => {
  for (const mode of ['tag', 'bytes', 'concurrent'])
    await t.test(mode, async (t) => {
      const f = await fixture(t),
        original = await fs.readFile(f.selectorPath);
      const manifestAssetId =
        [...f.candidate.files.keys()].indexOf(f.candidate.package.manifest.path) + 1;
      if (mode === 'tag')
        f.responses[`${f.prefix}/commits/tags/v1.2.3`] = Buffer.from(
          JSON.stringify({
            sha: 'c'.repeat(40),
            commit: { tree: { sha: f.candidate.envelope.sourceTree } },
          }),
        ).toString('base64');
      if (mode === 'bytes')
        f.responses[`${f.prefix}/releases/assets/${manifestAssetId}`] =
          Buffer.from('changed').toString('base64');
      await fs.writeFile(f.responsePath, JSON.stringify(f.responses));
      const edited = Buffer.from('{"concurrent":"preserve"}');
      const result = f.run(
        'sync-selector',
        [
          '--repository',
          'mekhovov/revealline',
          '--base-path',
          '/revealline/',
          '--selector',
          f.selectorPath,
        ],
        mode === 'concurrent'
          ? {
              OPTIONAL_EDIT_ROUTE: `${f.prefix}/commits/tags/v1.2.3`,
              OPTIONAL_EDIT_BYTES: edited.toString(),
            }
          : {},
      );
      assert.notEqual(result.status, 0);
      assert.deepEqual(
        await fs.readFile(f.selectorPath),
        mode === 'concurrent' ? edited : original,
      );
    });
});

test('optional upload refuses already published releases without sending any write request', async (t) => {
  const f = await fixture(t);
  const result = f.run('upload-draft', [
    '--repository',
    'mekhovov/revealline',
    '--release-id',
    '101',
  ]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /draft identity changed/);
  const calls = (await fs.readFile(f.callsPath, 'utf8')).trim().split('\n').map(JSON.parse);
  assert.ok(calls.every((args) => args[0] === 'api' && !args.includes('--method')));
});

test('draft delivery uploads the envelope last, verifies downloaded originals and resumes without replacement', async (t) => {
  const f = await fixture(t);
  const route = `${f.prefix}/releases/tags/v1.2.3`;
  const release = JSON.parse(Buffer.from(f.responses[route], 'base64'));
  release.draft = true;
  release.assets = [];
  f.responses[route] = Buffer.from(JSON.stringify(release)).toString('base64');
  f.responses[`${f.prefix}/releases/101`] = f.responses[route];
  await fs.writeFile(f.responsePath, JSON.stringify(f.responses));
  const result = f.run(
    'upload-draft',
    ['--repository', 'mekhovov/revealline', '--release-id', '101'],
    {
      OPTIONAL_ALLOW_UPLOAD: 'test-only',
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).status, 'draft-assets-downloaded-and-verified');
  const calls = (await fs.readFile(f.callsPath, 'utf8')).trim().split('\n').map(JSON.parse);
  const uploads = calls.filter((args) => args.includes('--method'));
  assert.equal(uploads.length, f.candidate.files.size);
  assert.equal(
    new URL(uploads.at(-1).find((value) => value.startsWith('https://'))).searchParams.get('name'),
    'optional-packages.json',
  );
  assert.ok(
    uploads.every(
      (args) => args[0] === 'api' && args.includes('POST') && !args.includes('--clobber'),
    ),
  );
  assert.equal(
    calls.filter((args) => args.includes('-H') && !args.includes('--method')).length,
    f.candidate.files.size,
  );
  const receiptPath = path.join(f.bundle, 'optional-package-delivery.json');
  const originalReceipt = await fs.readFile(receiptPath);
  assert.equal(JSON.parse(originalReceipt).releaseId, 101);
  await fs.writeFile(f.callsPath, '');
  const resumed = f.run('upload-draft', [
    '--repository',
    'mekhovov/revealline',
    '--release-id',
    '101',
  ]);
  assert.equal(resumed.status, 0, resumed.stderr);
  const resumedCalls = (await fs.readFile(f.callsPath, 'utf8')).trim().split('\n').map(JSON.parse);
  assert.ok(resumedCalls.every((args) => args[0] === 'api' && !args.includes('--method')));
  assert.deepEqual(await fs.readFile(receiptPath), originalReceipt);
  const responses = JSON.parse(await fs.readFile(f.responsePath));
  const published = JSON.parse(Buffer.from(responses[route], 'base64'));
  responses[`${f.prefix}/releases/assets/${published.assets[0].id}`] =
    Buffer.from('tampered').toString('base64');
  await fs.writeFile(f.responsePath, JSON.stringify(responses));
  const changed = f.run('upload-draft', [
    '--repository',
    'mekhovov/revealline',
    '--release-id',
    '101',
  ]);
  assert.notEqual(changed.status, 0);
  assert.match(changed.stderr, /Downloaded optional artifact differs/);
});

test('optional delivery requires an explicit canonical positive release ID before any network access', async (t) => {
  const f = await fixture(t);
  for (const value of [null, '0', '-1', '1.1', '001', '9007199254740992']) {
    const result = f.run('upload-draft', [
      '--repository',
      'mekhovov/revealline',
      ...(value === null ? [] : ['--release-id', value]),
    ]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /explicit positive --release-id/);
  }
  assert.equal(await fs.readFile(f.callsPath, 'utf8'), '');
});

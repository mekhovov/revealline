import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  captureEmittedPreview,
  openEmittedPreview,
  EMITTED_PREVIEW_LIMITS,
} from './emitted-preview.mjs';
import { fingerprintDemoSources } from './demo-source-fingerprint.mjs';
import { mainPagesAuditArguments } from './qualify-demo-main-pages.mjs';
const sha = (b) => createHash('sha256').update(b).digest('hex');
const identity = {
  sourceRevision: 'a'.repeat(40),
  sourceFingerprint: { sha256: 'b'.repeat(64), files: 10, bytes: 100 },
  buildInputFingerprint: { sha256: 'c'.repeat(64), files: 5, bytes: 80 },
};
async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'emitted-preview-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'game'));
  await writeFile(path.join(root, 'game/main.mjs'), 'unchanged');
  await writeFile(path.join(root, 'game/route-loader.mjs'), 'source compiler');
  await writeFile(path.join(root, 'game/omitted.png'), 'not published');
  const entries = [
    { name: 'game/main.mjs', bytes: Buffer.from('unchanged') },
    { name: 'game/route-loader.mjs', bytes: Buffer.from('published loader') },
    { name: 'game/generated.json', bytes: Buffer.from('published loader') },
    {
      name: '.xonix-build.json',
      bytes: Buffer.from('{"tool":"xonix-game-cli","formatVersion":1}'),
    },
    { name: '_headers', bytes: Buffer.from('/*\n  test: exact\n') },
  ];
  const options = {
    root,
    directory: '.cache/emitted',
    entries,
    auditReportPath: 'audit.json',
    ...identity,
  };
  async function admit(descriptor) {
    const manifest = JSON.parse(await readFile(path.join(root, descriptor.manifestPath)));
    const audit = {
      complete: true,
      headStable: true,
      sourceStable: true,
      sourceRevision: manifest.sourceRevision,
      sourceFingerprint: manifest.sourceFingerprint,
      buildInputFingerprint: manifest.buildInputFingerprint,
      finalSourceFingerprint: manifest.sourceFingerprint,
      finalBuildInputFingerprint: manifest.buildInputFingerprint,
      emittedPreview: descriptor,
    };
    await writeFile(path.join(root, 'audit.json'), JSON.stringify(audit));
    await writeFile(
      path.join(root, 'audit.inventory.json'),
      JSON.stringify({
        sourceRevision: manifest.sourceRevision,
        files: manifest.files.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 })),
      }),
    );
    return { manifest, audit };
  }
  return { root, entries, options, admit };
}

test('actual emitted deltas and verified source bodies cover exactly the admitted inventory', async (t) => {
  const f = await fixture(t),
    descriptor = await captureEmittedPreview(f.options);
  assert.equal(descriptor.deltaFiles, 4);
  assert.equal(descriptor.deltaBlobs, 3);
  const { manifest } = await f.admit(descriptor);
  const preview = await openEmittedPreview(descriptor.directory, { root: f.root });
  assert.equal(preview.manifestSHA256, descriptor.manifestSHA256);
  assert.deepEqual(preview.manifest, manifest);
  for (const { name, bytes } of f.entries) assert.deepEqual(await preview.read(name), bytes);
  assert.equal(preview.has('game/omitted.png'), false);
  await assert.rejects(preview.read('game/omitted.png'), { code: 'ENOENT' });
  await assert.rejects(preview.read('../game/main.mjs'), { code: 'ENOENT' });
  assert.equal(manifest.files.find((f) => f.path === 'game/main.mjs').storage, 'source');
  assert.equal(manifest.files.find((f) => f.path === 'game/route-loader.mjs').storage, 'blob');
});

test('every read rechecks exact bytes, including source changes after successful admission', async (t) => {
  const f = await fixture(t),
    descriptor = await captureEmittedPreview(f.options);
  const { manifest } = await f.admit(descriptor);
  const preview = await openEmittedPreview(descriptor.directory, { root: f.root });
  await preview.read('game/main.mjs');
  await writeFile(path.join(f.root, 'game/main.mjs'), 'x'.repeat(9));
  await assert.rejects(preview.read('game/main.mjs'), /identity mismatch/);
  const blob = manifest.files.find((f) => f.path === 'game/route-loader.mjs');
  await writeFile(
    path.join(f.root, descriptor.directory, 'blobs', blob.sha256),
    'x'.repeat(blob.bytes),
  );
  await assert.rejects(preview.read(blob.path), /identity mismatch/);
});

test('unadmitted, modified, incomplete, or foreign-source captures cannot open', async (t) => {
  const f = await fixture(t),
    descriptor = await captureEmittedPreview(f.options);
  await assert.rejects(openEmittedPreview(descriptor.directory, { root: f.root }), {
    code: 'ENOENT',
  });
  const { audit } = await f.admit(descriptor);
  for (const changed of [
    { ...audit, complete: false },
    { ...audit, sourceRevision: 'd'.repeat(40) },
    { ...audit, emittedPreview: { ...descriptor, manifestSHA256: 'e'.repeat(64) } },
  ]) {
    await writeFile(path.join(f.root, 'audit.json'), JSON.stringify(changed));
    await assert.rejects(openEmittedPreview(descriptor.directory, { root: f.root }));
  }
  await f.admit(descriptor);
  await writeFile(
    path.join(f.root, 'audit.inventory.json'),
    JSON.stringify({ sourceRevision: identity.sourceRevision, files: [] }),
  );
  await assert.rejects(
    openEmittedPreview(descriptor.directory, { root: f.root }),
    /complete actual emitted inventory/,
  );
});

test('failed capture removes only its own partial directory and cannot overwrite existing data', async (t) => {
  const f = await fixture(t);
  const limits = { ...EMITTED_PREVIEW_LIMITS, deltaFiles: 1 };
  await assert.rejects(
    captureEmittedPreview({ ...f.options, limits }),
    /delta exceeds its file bound/,
  );
  await assert.rejects(readFile(path.join(f.root, '.cache/emitted/manifest.json')), {
    code: 'ENOENT',
  });
  await mkdir(path.join(f.root, '.cache/emitted'));
  await writeFile(path.join(f.root, '.cache/emitted/user.txt'), 'keep');
  await assert.rejects(captureEmittedPreview(f.options), { code: 'EEXIST' });
  assert.equal(await readFile(path.join(f.root, '.cache/emitted/user.txt'), 'utf8'), 'keep');
});

test('capture byte bounds, duplicate paths and unsafe paths fail closed', async (t) => {
  const f = await fixture(t);
  for (const limits of [
    { ...EMITTED_PREVIEW_LIMITS, bodyBytes: 1 },
    { ...EMITTED_PREVIEW_LIMITS, deltaBytes: 1 },
    { ...EMITTED_PREVIEW_LIMITS, manifestBytes: 1 },
  ]) {
    await assert.rejects(captureEmittedPreview({ ...f.options, limits }), /byte bound/);
    await assert.rejects(readFile(path.join(f.root, '.cache/emitted/manifest.json')), {
      code: 'ENOENT',
    });
  }
  await assert.rejects(
    captureEmittedPreview({ ...f.options, entries: [...f.entries, f.entries[0]] }),
    /Duplicate emitted path/,
  );
  await assert.rejects(
    captureEmittedPreview({
      ...f.options,
      entries: [{ name: '../escape', bytes: Buffer.from('bad') }],
    }),
  );
  await assert.rejects(
    captureEmittedPreview({ ...f.options, directory: '../escape' }),
    /within its source root/,
  );
});

test('symlink source and captured blob substitution are rejected', async (t) => {
  const f = await fixture(t),
    descriptor = await captureEmittedPreview(f.options);
  const { manifest } = await f.admit(descriptor);
  const preview = await openEmittedPreview(descriptor.directory, { root: f.root });
  await rm(path.join(f.root, 'game/main.mjs'));
  await symlink(path.join(f.root, 'game/omitted.png'), path.join(f.root, 'game/main.mjs'));
  await assert.rejects(preview.read('game/main.mjs'), /Symbolic links/);
  const blob = manifest.files.find((f) => f.path === 'game/route-loader.mjs');
  const blobPath = path.join(f.root, descriptor.directory, 'blobs', blob.sha256);
  await rm(blobPath);
  await symlink(path.join(f.root, 'game/route-loader.mjs'), blobPath);
  await assert.rejects(preview.read(blob.path), /Symbolic links/);
});

test('manifest content is pinned by the completed audit and exact inventory', async (t) => {
  const f = await fixture(t),
    descriptor = await captureEmittedPreview(f.options);
  const { manifest } = await f.admit(descriptor);
  manifest.files[0].bytes++;
  await writeFile(path.join(f.root, descriptor.manifestPath), JSON.stringify(manifest));
  await assert.rejects(openEmittedPreview(descriptor.directory, { root: f.root }));
  assert.notEqual(
    sha(await readFile(path.join(f.root, descriptor.manifestPath))),
    descriptor.manifestSHA256,
  );
});

test('optional preview CLI keeps defaults and rejects duplicate or empty paths', () => {
  assert.deepEqual(mainPagesAuditArguments(['--report=out.json']), { reportPath: 'out.json' });
  assert.deepEqual(
    mainPagesAuditArguments(['--report=out.json', '--preview-output=.cache/exact-preview']),
    { reportPath: 'out.json', previewOutput: '.cache/exact-preview' },
  );
  assert.throws(
    () =>
      mainPagesAuditArguments(['--report=out.json', '--preview-output=a', '--preview-output=b']),
    /Duplicate/,
  );
  assert.throws(
    () => mainPagesAuditArguments(['--report=out.json', '--preview-output=']),
    /Unknown/,
  );
});

test('strict qualification rejects stale runtime, build inputs and HEAD while historical opening stays explicit', async (t) => {
  const f = await fixture(t);
  for (const directory of ['optional-practice', 'publishing', 'scripts', 'authoring'])
    await mkdir(path.join(f.root, directory));
  const bodies = {
    'optional-practice/model.mjs': 'native',
    'publishing/policy.mjs': 'policy',
    'scripts/producer.mjs': 'producer',
    'authoring/catalog.json': '{}',
  };
  for (const [name, body] of Object.entries(bodies)) await writeFile(path.join(f.root, name), body);
  const git = (...args) =>
    execFileSync(
      'git',
      [
        '-c',
        'user.name=Preview fixture',
        '-c',
        'user.email=fixture@example.invalid',
        '-c',
        'commit.gpgsign=false',
        '-c',
        'core.hooksPath=/dev/null',
        ...args,
      ],
      { cwd: f.root, encoding: 'utf8' },
    ).trim();
  git('init', '-q');
  git('add', '.');
  git('commit', '-qm', 'capture fixture');
  Object.assign(f.options, {
    sourceRevision: git('rev-parse', 'HEAD'),
    sourceFingerprint: await fingerprintDemoSources(f.root),
    buildInputFingerprint: await fingerprintDemoSources(f.root, ['scripts', 'authoring']),
  });
  const descriptor = await captureEmittedPreview(f.options);
  await f.admit(descriptor);
  const admitted = await openEmittedPreview(descriptor.directory, {
    root: f.root,
    verifySource: true,
  });
  assert.equal(admitted.sourceVerification.head, f.options.sourceRevision);
  for (const [name, original, expected] of [
    ['game/route-loader.mjs', 'source compiler', /Runtime differs/],
    ['scripts/producer.mjs', 'producer', /Build inputs differ/],
    ['authoring/catalog.json', '{}', /Build inputs differ/],
  ]) {
    await writeFile(path.join(f.root, name), original + ' changed');
    await assert.rejects(
      openEmittedPreview(descriptor.directory, { root: f.root, verifySource: true }),
      expected,
    );
    const historical = await openEmittedPreview(descriptor.directory, { root: f.root });
    assert.equal(historical.sourceVerification, null);
    assert.equal((await historical.read('game/route-loader.mjs')).toString(), 'published loader');
    await writeFile(path.join(f.root, name), original);
  }
  git('commit', '--allow-empty', '-qm', 'new candidate');
  await assert.rejects(
    openEmittedPreview(descriptor.directory, { root: f.root, verifySource: true }),
    /different HEAD/,
  );
  await openEmittedPreview(descriptor.directory, { root: f.root, verifySource: false });
});

test('canonical fingerprint hashes sorted path plus raw digest and excludes test/coverage inputs', async (t) => {
  const f = await fixture(t);
  for (const directory of ['optional-practice', 'publishing', 'game/test'])
    await mkdir(path.join(f.root, directory));
  const source = {
    'game/main.mjs': 'unchanged',
    'game/route-loader.mjs': 'source compiler',
    'optional-practice/world.json': '{}',
    'publishing/policy.js': 'policy',
  };
  for (const [name, body] of Object.entries({
    ...source,
    'game/test/check.mjs': 'excluded',
    'game/check.test.mjs': 'excluded',
    'game/coverage.json': 'excluded',
    'game/note.txt': 'excluded',
  }))
    await writeFile(path.join(f.root, name), body);
  const expected = createHash('sha256');
  let bytes = 0;
  for (const name of Object.keys(source).sort()) {
    const body = Buffer.from(source[name]);
    bytes += body.length;
    expected.update(name + '\0').update(createHash('sha256').update(body).digest());
  }
  assert.deepEqual(await fingerprintDemoSources(f.root), {
    sha256: expected.digest('hex'),
    files: 4,
    bytes,
  });
});

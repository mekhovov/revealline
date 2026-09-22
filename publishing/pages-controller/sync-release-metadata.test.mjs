import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { digest, jsonBytes } from './metadata.mjs';
import { syncReleaseMetadata } from './sync-release-metadata.mjs';

test('trailing-slash controller directory is normalized', async (t) => {
  const f = await setup(t),
    before = await files(f.directory);
  await syncReleaseMetadata({ ...f.options, directory: f.directory + '/', versions: ['v0.1.0'] });
  assert.deepEqual(await files(f.directory), before);
});

test('an ancestor symlink introduced by the final tag check cannot redirect writes', async (t) => {
  const f = await setup(t),
    catalog = await fs.readFile(path.join(f.directory, 'catalog.json'));
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'rl-sync-outside-'));
  t.after(() => fs.rm(outside, { recursive: true, force: true }));
  let calls = 0;
  await assert.rejects(
    syncReleaseMetadata({
      ...f.options,
      versions: ['v0.2.0'],
      resolveTag: async (v) => {
        if (++calls === 2)
          await fs.symlink(outside, path.join(f.directory, 'metadata/v0.2.0'), 'dir');
        return f.releases.get(v).tag;
      },
    }),
    /Unsafe metadata directory/,
  );
  assert.deepEqual(await fs.readdir(outside), []);
  assert.deepEqual(await fs.readFile(path.join(f.directory, 'catalog.json')), catalog);
});

function release(version) {
  const sourceRevision = 'a'.repeat(40),
    tagObject = 'b'.repeat(40);
  const manifest = jsonBytes({
    formatVersion: 1,
    version,
    sourceRevision,
    entry: 'game/index.html',
    totalBytes: 2,
    files: ['index.html', 'game/index.html'].map((name) => ({
      path: name,
      bytes: 1,
      sha256: digest('x'),
    })),
  });
  const record = jsonBytes({
    formatVersion: 1,
    version,
    sourceRevision,
    sourceArchiveSha256: 'c'.repeat(64),
    distributionSha256: 'd'.repeat(64),
    manifestSha256: digest(manifest),
    play: `${version}/site/game/`,
    download: `${version}/site/distribution.zip`,
  });
  const checksum = Buffer.from(`${'d'.repeat(64)}  distribution.zip\n`);
  return {
    tag: { sourceRevision, tagObject },
    pin: {
      version,
      sourceRevision,
      tagObject,
      recordSha256: digest(record),
      manifestSha256: digest(manifest),
      checksumSha256: digest(checksum),
    },
    assets: new Map([
      ['release.json', record],
      ['manifest.json', manifest],
      ['distribution.zip.sha256', checksum],
      [
        'source-qualification.json',
        jsonBytes({
          format: 'revealline-source-qualification.v1',
          version,
          sourceRevision,
          passed: true,
        }),
      ],
    ]),
  };
}

function waivedReleaseQualification(item) {
  const policy = jsonBytes({
      format: 'revealline-release-test-policy.v1',
      mode: 'waived',
      authorization: 'explicit-user-request-20260922',
      scope: 'automated-test-suites',
      reason: 'Temporary automated test waiver requested by the user.',
      restoration: 'Restore required automated tests in a reviewed change.',
    }),
    sourceTree = 'e'.repeat(40),
    step = (name, number) => ({ name, number, status: 'completed', conclusion: 'success' }),
    policyEvidence = {
      path: 'publishing/test-policy.json',
      bytes: policy.length,
      sha256: digest(policy),
    },
    runEvidence = { path: 'run.json', bytes: 10, sha256: '1'.repeat(64) },
    jobsEvidence = { path: 'jobs.json', bytes: 10, sha256: '2'.repeat(64) };
  item.tag.sourceTree = sourceTree;
  item.assets.set(
    'source-qualification.json',
    jsonBytes({
      format: 'revealline-source-qualification.v2',
      status: 'qualified-with-test-waiver',
      releaseEligible: true,
      version: item.pin.version,
      sourceRevision: item.tag.sourceRevision,
      sourceTree,
      actualCheckoutCommit: item.tag.sourceRevision,
      actualCheckoutTree: sourceTree,
      allTrackedSourceContentsAndModesMatch: true,
      gates: ['validate', 'lint', 'format', 'native-format', 'motion-syntax'].map(
        (gate, index) => ({
          gate,
          command: [
            'npm run validate',
            'npm run lint',
            'npm run format:check',
            'npm run format:native:check',
            'node --check authoring/motion-lab/app.js',
          ][index],
          jobId: 100 + index,
          step: step(`Gate ${gate}`, index + 1),
        }),
      ),
      tests: { status: 'waived', counts: null },
      testPolicy: {
        mode: 'waived',
        authorization: 'explicit-user-request-20260922',
        reason: 'Temporary automated test waiver requested by the user.',
        policyEvidence,
      },
      waiverEvidence: { runId: 42, runEvidence, jobsEvidence },
      evidencePins: [policyEvidence, runEvidence, jobsEvidence],
      ordinaryBuildCorroboration: {
        command: 'npm run build',
        step: step('Build', 20),
      },
      frozenArtifactCorroboration: {
        artifactId: 99,
        runId: 42,
        wholeOriginalArtifactVerifiedBeforeQualification: true,
        sourceTarGitBlobTypeModeAndPaxCommitVerified: true,
        allInnerZipManifestBytesVerified: true,
        frozenOfflineInventoryAndBindingsVerified: true,
      },
    }),
  );
  return policy;
}

async function setup(t, pinned = ['v0.1.0']) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rl-metadata-sync-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const releases = new Map(['v0.1.0', 'v0.2.0', 'v0.3.0'].map((v) => [v, release(v)]));
  const catalog = {
    format: 'revealline-frozen-catalog.v1',
    sourceRepository: 'mekhovov/revealline',
    releases: pinned.map((v) => releases.get(v).pin),
  };
  // Deliberately retain noncanonical whitespace to verify a true byte-identical no-op.
  await fs.writeFile(path.join(directory, 'catalog.json'), JSON.stringify(catalog) + '\n\n');
  for (const version of pinned) {
    const target = path.join(directory, 'metadata', version);
    await fs.mkdir(target, { recursive: true });
    for (const [name, bytes] of releases.get(version).assets)
      if (name !== 'source-qualification.json') await fs.writeFile(path.join(target, name), bytes);
  }
  return {
    directory,
    releases,
    options: {
      directory,
      download: async (version, name) => releases.get(version).assets.get(name),
      resolveTag: async (version) => releases.get(version).tag,
    },
  };
}

async function files(directory, prefix = '') {
  const result = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const name = prefix + entry.name,
      file = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await files(file, name + '/')));
    else result.push([name, digest(await fs.readFile(file))]);
  }
  return result.sort(([a], [b]) => a.localeCompare(b));
}

test('sync adds verified metadata and qualification; repeat preserves every byte and timestamp', async (t) => {
  const f = await setup(t),
    original = await files(f.directory);
  const options = {
    ...f.options,
    versions: ['v0.2.0'],
    qualificationVersion: 'v0.2.0',
  };
  const result = await syncReleaseMetadata(options);
  const catalog = JSON.parse(await fs.readFile(path.join(f.directory, 'catalog.json')));
  assert.deepEqual(catalog.releases, [f.releases.get('v0.1.0').pin, f.releases.get('v0.2.0').pin]);
  for (const [name, sha] of original.filter(([name]) => name !== 'catalog.json'))
    assert.equal(digest(await fs.readFile(path.join(f.directory, name))), sha);
  assert.equal(
    result.qualificationSha256,
    digest(f.releases.get('v0.2.0').assets.get('source-qualification.json')),
  );
  const before = await files(f.directory),
    times = await Promise.all(before.map(([name]) => fs.stat(path.join(f.directory, name))));
  await syncReleaseMetadata(options);
  assert.deepEqual(await files(f.directory), before);
  assert.deepEqual(
    await Promise.all(
      before.map(async ([name]) => (await fs.stat(path.join(f.directory, name))).mtimeMs),
    ),
    times.map((s) => s.mtimeMs),
  );
});

test('sync accepts v2 only with the exact policy from the tagged source', async (t) => {
  const f = await setup(t),
    item = f.releases.get('v0.2.0'),
    policy = waivedReleaseQualification(item),
    result = await syncReleaseMetadata({
      ...f.options,
      versions: ['v0.2.0'],
      qualificationVersion: 'v0.2.0',
      readSourceFile: async (revision, name) => {
        assert.equal(revision, item.tag.sourceRevision);
        assert.equal(name, 'publishing/test-policy.json');
        return policy;
      },
    });
  assert.equal(result.qualificationVersion, 'v0.2.0');
  assert.equal(result.qualificationSha256, digest(item.assets.get('source-qualification.json')));
});

test('sync rejects a v2 policy substitution before writing any metadata', async (t) => {
  const f = await setup(t),
    item = f.releases.get('v0.2.0'),
    policy = waivedReleaseQualification(item),
    before = await files(f.directory);
  await assert.rejects(
    syncReleaseMetadata({
      ...f.options,
      versions: ['v0.2.0'],
      qualificationVersion: 'v0.2.0',
      readSourceFile: async () => Buffer.concat([policy, Buffer.from('\n')]),
    }),
    /policy byte pin mismatch/,
  );
  assert.deepEqual(await files(f.directory), before);
});

test('existing-only sync preserves original catalog whitespace', async (t) => {
  const f = await setup(t),
    before = await files(f.directory);
  await syncReleaseMetadata({ ...f.options, versions: ['v0.1.0'] });
  assert.deepEqual(await files(f.directory), before);
});

for (const kind of [
  'manifest-link',
  'zip-checksum',
  'record-shape',
  'missing-entry',
  'late-qualification',
])
  test(`whole batch rejects ${kind} without adding an earlier valid release`, async (t) => {
    const f = await setup(t),
      broken = f.releases.get('v0.3.0'),
      before = await files(f.directory);
    if (kind === 'manifest-link' || kind === 'record-shape') {
      const record = JSON.parse(broken.assets.get('release.json'));
      if (kind === 'manifest-link') record.manifestSha256 = 'e'.repeat(64);
      else record.extra = true;
      broken.assets.set('release.json', jsonBytes(record));
    } else if (kind === 'zip-checksum')
      broken.assets.set('distribution.zip.sha256', Buffer.from('invalid\n'));
    else if (kind === 'missing-entry') {
      const manifest = JSON.parse(broken.assets.get('manifest.json'));
      manifest.files[1].path = 'other.html';
      const bytes = jsonBytes(manifest),
        record = JSON.parse(broken.assets.get('release.json'));
      record.manifestSha256 = digest(bytes);
      broken.assets.set('manifest.json', bytes);
      broken.assets.set('release.json', jsonBytes(record));
    } else
      broken.assets.set(
        'source-qualification.json',
        jsonBytes({ version: 'v0.3.0', passed: false }),
      );
    await assert.rejects(
      syncReleaseMetadata({
        ...f.options,
        versions: ['v0.2.0', 'v0.3.0'],
        qualificationVersion: kind === 'late-qualification' ? 'v0.3.0' : '',
      }),
    );
    assert.deepEqual(await files(f.directory), before);
  });

for (const kind of ['downloaded-pin', 'tag', 'local-file', 'missing-file', 'qualification'])
  test(`existing frozen ${kind} cannot be replaced`, async (t) => {
    const f = await setup(t),
      existing = f.releases.get('v0.1.0');
    let qualificationVersion = '';
    if (kind === 'downloaded-pin') {
      const record = JSON.parse(existing.assets.get('release.json'));
      record.sourceArchiveSha256 = 'e'.repeat(64);
      existing.assets.set('release.json', jsonBytes(record));
    } else if (kind === 'tag') existing.tag.tagObject = 'e'.repeat(40);
    else if (kind === 'local-file')
      await fs.writeFile(path.join(f.directory, 'metadata/v0.1.0/manifest.json'), 'edited');
    else if (kind === 'missing-file')
      await fs.unlink(path.join(f.directory, 'metadata/v0.1.0/manifest.json'));
    else {
      qualificationVersion = 'v0.1.0';
      const target = path.join(f.directory, 'evidence/current-v010');
      await fs.mkdir(target, { recursive: true });
      await fs.writeFile(
        path.join(target, 'source-qualification.json'),
        'existing immutable proof',
      );
    }
    const before = await files(f.directory);
    await assert.rejects(
      syncReleaseMetadata({
        ...f.options,
        versions: ['v0.2.0', 'v0.1.0'],
        qualificationVersion,
      }),
    );
    assert.deepEqual(await files(f.directory), before);
  });

test('catalog edit during download is preserved and prevents every addition', async (t) => {
  const f = await setup(t),
    external = Buffer.from('concurrent edit\n');
  await assert.rejects(
    syncReleaseMetadata({
      ...f.options,
      versions: ['v0.2.0'],
      download: async (v, name) => {
        await fs.writeFile(path.join(f.directory, 'catalog.json'), external);
        return f.releases.get(v).assets.get(name);
      },
    }),
    /changed during sync/,
  );
  assert.deepEqual(await fs.readFile(path.join(f.directory, 'catalog.json')), external);
  assert.equal(
    (await files(f.directory)).some(([name]) => name.includes('v0.2.0')),
    false,
  );
});

test('tag movement after downloads leaves the whole batch unchanged', async (t) => {
  const f = await setup(t),
    before = await files(f.directory);
  let calls = 0;
  await assert.rejects(
    syncReleaseMetadata({
      ...f.options,
      versions: ['v0.2.0'],
      resolveTag: async (v) => ({
        ...f.releases.get(v).tag,
        tagObject: ++calls === 1 ? 'b'.repeat(40) : 'e'.repeat(40),
      }),
    }),
    /Tag changed during sync/,
  );
  assert.deepEqual(await files(f.directory), before);
});

test('a concurrent destination is preserved before any additions are written', async (t) => {
  const f = await setup(t),
    catalog = await fs.readFile(path.join(f.directory, 'catalog.json'));
  const destination = path.join(f.directory, 'metadata/v0.2.0/manifest.json');
  let calls = 0;
  await assert.rejects(
    syncReleaseMetadata({
      ...f.options,
      versions: ['v0.2.0'],
      resolveTag: async (v) => {
        if (++calls === 2) {
          await fs.mkdir(path.dirname(destination), { recursive: true });
          await fs.writeFile(destination, 'concurrent');
        }
        return f.releases.get(v).tag;
      },
    }),
    /Metadata changed during sync/,
  );
  assert.equal(await fs.readFile(destination, 'utf8'), 'concurrent');
  assert.deepEqual(await fs.readFile(path.join(f.directory, 'catalog.json')), catalog);
  assert.deepEqual(await fs.readdir(path.dirname(destination)), ['manifest.json']);
});

test('a later write failure rolls back new release files and preserves the catalog', async (t) => {
  const f = await setup(t),
    before = await files(f.directory);
  const evidence = path.join(f.directory, 'evidence');
  await fs.mkdir(evidence);
  await fs.chmod(evidence, 0o500);
  try {
    await assert.rejects(
      syncReleaseMetadata({ ...f.options, versions: ['v0.2.0'], qualificationVersion: 'v0.2.0' }),
      /EACCES|EPERM/,
    );
  } finally {
    await fs.chmod(evidence, 0o700);
  }
  assert.deepEqual(await files(f.directory), before);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  EDITION_REVIEW_GATES,
  verifyEditionReview,
  validateEditionPublication,
  frozenEditionOverlay,
  selectRetainedEditionRelease,
} from './edition-promotion.mjs';
import { editionAdmissionFixture } from './edition-fixture.mjs';
import { editionHash, inspectEditionZip } from './edition-zip.mjs';

const bytes = (value) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value));
const descriptor = (path, value) => ({ path, bytes: value.length, sha256: editionHash(value) });
const json = (value) => JSON.parse(Buffer.from(value).toString('utf8'));
const selector = (...releases) => ({ format: 'revealline-edition-publication.v1', releases });

/** Synthetic test receipts only. These do not assert any real human validation. */
function reviewedFixture(options = {}) {
  const fixture = editionAdmissionFixture(options);
  const envelopeBytes = bytes(fixture.envelope);
  const review = {
    format: 'revealline-edition-review.v1',
    envelopeSha256: editionHash(envelopeBytes),
    sourceRevision: fixture.envelope.sourceRevision,
    sourceTree: fixture.envelope.sourceTree,
    version: fixture.envelope.version,
    publication: 'public',
    editions: fixture.envelope.editions.map((edition) => ({
      id: edition.id,
      gates: EDITION_REVIEW_GATES.map((id) => {
        const path = `review-${edition.id}-${id}.txt`;
        const source = bytes(
          `SYNTHETIC TEST FIXTURE ONLY. Not a real review: ${edition.id}/${id}.`,
        );
        fixture.files.set(path, source);
        return {
          id,
          status: 'passed',
          reviewer: 'Synthetic fixture reviewer',
          reviewedAt: '2026-09-26T12:00:00.000Z',
          evidence: { ...descriptor(path, source), publication: 'public', approved: true },
        };
      }),
    })),
  };
  const reviewBytes = bytes(review);
  fixture.files.set('editions.json', envelopeBytes);
  fixture.files.set('edition-review.json', reviewBytes);
  const release = {
    version: fixture.envelope.version,
    envelopeSha256: editionHash(envelopeBytes),
    reviewSha256: editionHash(reviewBytes),
    basePath: options.basePath ?? '/revealline/',
    editionIds: fixture.envelope.editions.map((edition) => edition.id),
    activeEditionIds: fixture.envelope.editions.map((edition) => edition.id),
  };
  return { ...fixture, envelopeBytes, review, reviewBytes, release };
}
function releaseReader(...fixtures) {
  return async (version, name, limit) => {
    const fixture = fixtures.find((entry) => entry.envelope.version === version);
    const source = fixture?.files.get(name);
    assert(source, `Fixture artifact exists: ${version}/${name}`);
    assert(source.length <= limit, `Bounded read: ${version}/${name}`);
    return source;
  };
}
function releaseIdentity(...fixtures) {
  return async (version) => {
    const fixture = fixtures.find((entry) => entry.envelope.version === version);
    assert(fixture, `Fixture tag exists: ${version}`);
    return {
      sourceRevision: fixture.envelope.sourceRevision,
      sourceTree: fixture.envelope.sourceTree,
    };
  };
}
function runtimeMembers(fixture) {
  const edition = fixture.envelope.editions[0];
  const manifestBytes = fixture.files.get(edition.manifest.path);
  return inspectEditionZip(fixture.files.get(edition.distribution.path), [
    ...json(manifestBytes).files,
    descriptor('manifest.json', manifestBytes),
  ]);
}

test('an empty edition selector neither downloads nor changes any default publication files', async () => {
  const defaults = new Map([
    ['index.html', bytes('published default home')],
    ['app/current.json', bytes('{"version":"v0.132.1"}')],
    ['releases/v0.132.1/site/game/index.html', bytes('frozen default game')],
  ]);
  const before = new Map(defaults);
  const input = selector();
  assert.equal(validateEditionPublication(input), input);
  const overlay = await frozenEditionOverlay(input, {
    readReleaseAsset: () => assert.fail('Empty selection must not read release assets.'),
  });
  assert.equal(overlay.size, 0);
  assert.deepEqual(new Map([...defaults, ...overlay]), before);
});

test('review admission verifies real ZIP members and all hash-bound evidence gates', async () => {
  const fixture = reviewedFixture();
  const result = await verifyEditionReview(fixture.envelopeBytes, fixture.review, fixture);
  assert.equal(result.zipMembersVerified, true);
  assert.equal(result.publicEligible, true);
  assert.equal(result.reviewSha256, editionHash(fixture.reviewBytes));
  assert(runtimeMembers(fixture).has('app/manifest.webmanifest'));
});

test('candidate artifacts and incomplete or fabricated review coverage cannot be promoted', async () => {
  const fixture = reviewedFixture();
  await assert.rejects(verifyEditionReview(fixture.envelopeBytes, undefined, fixture), /review/);
  for (const mutate of [
    (review) => {
      review.publication = 'candidate';
    },
    (review) => {
      review.editions[0].gates.pop();
    },
    (review) => {
      review.editions[0].gates[0].status = 'review-required';
    },
    (review) => {
      review.editions[0].gates[0].reviewer = '';
    },
    (review) => {
      review.editions[0].gates[0].reviewedAt = 'not-a-date';
    },
    (review) => {
      review.editions[0].gates[1] = review.editions[0].gates[0];
    },
    (review) => {
      review.editions[0].gates[0].evidence.approved = false;
    },
    (review) => {
      review.editions[0].gates[0].evidence.publication = 'restricted';
    },
  ]) {
    const review = structuredClone(fixture.review);
    mutate(review);
    await assert.rejects(verifyEditionReview(fixture.envelopeBytes, review, fixture));
  }
});

test('receipt pins reject another envelope, source tree or changed human evidence bytes', async () => {
  for (const mutate of [
    (review) => {
      review.envelopeSha256 = '0'.repeat(64);
    },
    (review) => {
      review.sourceRevision = '0'.repeat(40);
    },
    (review) => {
      review.sourceTree = '0'.repeat(40);
    },
    (review) => {
      review.version = 'v99.0.0';
    },
    (review) => {
      review.editions[0].id = 'another-company';
    },
    (review) => {
      review.editions[0].gates[0].evidence.path = '../private.md';
    },
  ]) {
    const fixture = reviewedFixture();
    const review = structuredClone(fixture.review);
    mutate(review);
    await assert.rejects(verifyEditionReview(fixture.envelopeBytes, review, fixture));
  }
  const fixture = reviewedFixture();
  const evidence = fixture.review.editions[0].gates[0].evidence;
  const changed = Buffer.from(fixture.files.get(evidence.path));
  changed[0] ^= 1;
  fixture.files.set(evidence.path, changed);
  await assert.rejects(
    verifyEditionReview(fixture.envelopeBytes, fixture.review, fixture),
    /evidence bytes changed/,
  );
});

test('promotion preserves every frozen byte and changes only the stable launcher pointer', async () => {
  const fixture = reviewedFixture();
  const originals = runtimeMembers(fixture);
  const before = new Map([...fixture.files].map(([name, source]) => [name, Buffer.from(source)]));
  const output = await frozenEditionOverlay(selector(fixture.release), {
    readReleaseAsset: releaseReader(fixture),
    resolveReleaseIdentity: releaseIdentity(fixture),
    targetBasePath: '/revealline/',
  });
  const id = fixture.release.editionIds[0],
    version = fixture.release.version;
  const base = `editions/${id}/`,
    frozen = `${base}releases/${version}/site/`;
  for (const [name, source] of originals) {
    assert.deepEqual(output.get(frozen + name), source, `Frozen member retained: ${name}`);
    if (name.startsWith('app/') && name !== 'app/current.json')
      assert.deepEqual(output.get(base + name), source, `Stable launcher retained: ${name}`);
  }
  const manifest = json(fixture.files.get(fixture.envelope.editions[0].manifest.path));
  assert.deepEqual(json(output.get(`${base}app/current.json`)), {
    editionId: id,
    version,
    scope: `../releases/${version}/site/`,
    entry: manifest.entry,
  });
  assert.notDeepEqual(output.get(`${base}app/current.json`), originals.get('app/current.json'));
  assert(output.get('editions/index.html').toString().includes(`${id}/app/`));
  assert(!output.has('index.html'));
  assert(!output.has('app/current.json'));
  assert.deepEqual(fixture.files, before, 'Promotion never mutates downloaded original artifacts.');
});

test('inactive historical editions retain frozen files and only the chosen version owns the launcher', async () => {
  const older = reviewedFixture({ version: 'v0.139.0' });
  older.release.activeEditionIds = [];
  const newer = reviewedFixture({ version: 'v0.140.0' });
  const output = await frozenEditionOverlay(selector(older.release, newer.release), {
    readReleaseAsset: releaseReader(older, newer),
    resolveReleaseIdentity: releaseIdentity(older, newer),
  });
  const id = newer.release.editionIds[0];
  assert.equal(json(output.get(`editions/${id}/app/current.json`)).version, newer.release.version);
  for (const fixture of [older, newer])
    for (const [name, source] of runtimeMembers(fixture))
      assert.deepEqual(
        output.get(`editions/${id}/releases/${fixture.release.version}/site/${name}`),
        source,
      );
});

test('retained rollback changes only explicitly selected launcher ownership after full artifact verification', async () => {
  const older = reviewedFixture({ version: 'v0.139.0' });
  older.release.activeEditionIds = [];
  const newer = reviewedFixture({ version: 'v0.140.0' });
  const other = reviewedFixture({ version: 'v0.141.0', editionId: 'droneaid' });
  const input = selector(older.release, newer.release, other.release),
    before = structuredClone(input),
    ports = {
      readReleaseAsset: releaseReader(older, newer, other),
      resolveReleaseIdentity: releaseIdentity(older, newer, other),
      targetBasePath: '/revealline/',
    };
  const updated = await selectRetainedEditionRelease(
    input,
    { version: older.release.version, editionIds: ['coupa'] },
    ports,
  );
  assert.deepEqual(input, before);
  assert.deepEqual(updated.releases[0], { ...before.releases[0], activeEditionIds: ['coupa'] });
  assert.deepEqual(updated.releases[1], { ...before.releases[1], activeEditionIds: [] });
  assert.deepEqual(updated.releases[2], before.releases[2]);
  const oldOutput = await frozenEditionOverlay(input, ports),
    output = await frozenEditionOverlay(updated, ports);
  for (const [name, bytes] of oldOutput)
    if (!name.startsWith('editions/coupa/app/') && name !== 'editions/index.html')
      assert.deepEqual(output.get(name), bytes, `Unchanged frozen or unrelated member: ${name}`);
  assert.equal(json(output.get('editions/coupa/app/current.json')).version, 'v0.139.0');
  assert.deepEqual(
    await selectRetainedEditionRelease(
      updated,
      { version: 'v0.139.0', editionIds: ['coupa'] },
      ports,
    ),
    updated,
    'Repeating an already selected retained version is a verified no-op.',
  );
});

test('invalid retained selections and changed review evidence never return a staged selector', async () => {
  const fixture = reviewedFixture(),
    input = selector(fixture.release),
    before = structuredClone(input);
  for (const request of [
    { version: 'v99.0.0', editionIds: ['coupa'] },
    { version: fixture.release.version, editionIds: ['droneaid'] },
    { version: fixture.release.version, editionIds: [] },
    { version: fixture.release.version, editionIds: ['coupa', 'coupa'] },
    { version: '../escape', editionIds: ['coupa'] },
  ])
    await assert.rejects(
      selectRetainedEditionRelease(input, request, {
        readReleaseAsset: () => assert.fail('Invalid selections must fail before downloading.'),
      }),
      /retained|selection/i,
    );
  fixture.files.set('edition-review.json', Buffer.concat([fixture.reviewBytes, bytes('changed')]));
  await assert.rejects(
    selectRetainedEditionRelease(
      input,
      { version: fixture.release.version, editionIds: ['coupa'] },
      {
        readReleaseAsset: releaseReader(fixture),
        resolveReleaseIdentity: releaseIdentity(fixture),
      },
    ),
    /metadata differs/,
  );
  assert.deepEqual(input, before);
});

test('select-retained CLI uses read-only exact downloads and leaves the selector intact on corruption', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'edition-rollback-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const older = reviewedFixture({ version: 'v0.139.0' });
  older.release.activeEditionIds = [];
  const newer = reviewedFixture({ version: 'v0.140.0' });
  const other = reviewedFixture({ version: 'v0.141.0', editionId: 'droneaid' });
  const input = selector(older.release, newer.release, other.release),
    selectorPath = path.join(directory, 'selector.json'),
    responsePath = path.join(directory, 'responses.json'),
    callsPath = path.join(directory, 'calls.jsonl');
  await fs.writeFile(selectorPath, JSON.stringify(input));
  const responses = {},
    root = 'repos/mekhovov/revealline';
  let nextId = 1,
    corruptedId;
  const add = (route, content) => {
    responses[`${root}/${route}`] = content.toString('base64');
  };
  for (const fixture of [older, newer, other]) {
    const assets = [];
    for (const [name, contents] of fixture.files) {
      const id = nextId++;
      assets.push({ id, name, state: 'uploaded', size: contents.length });
      add(`releases/assets/${id}`, contents);
      if (fixture === older && name === fixture.envelope.editions[0].distribution.path)
        corruptedId = id;
    }
    add(
      `releases/tags/${fixture.envelope.version}`,
      bytes({ tag_name: fixture.envelope.version, draft: false, prerelease: false, assets }),
    );
    add(
      `commits/${fixture.envelope.version}`,
      bytes({
        sha: fixture.envelope.sourceRevision,
        commit: { tree: { sha: fixture.envelope.sourceTree } },
      }),
    );
  }
  await fs.writeFile(responsePath, JSON.stringify(responses));
  await fs.writeFile(
    path.join(directory, 'gh'),
    `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.EDITION_TEST_CALLS, JSON.stringify(args) + '\\n');
if (args[0] !== 'api' || args.includes('--method') || args.includes('-X')) process.exit(90);
const route = args.find(value => value.startsWith('repos/'));
const data = JSON.parse(fs.readFileSync(process.env.EDITION_TEST_RESPONSES));
if (!data[route]) process.exit(91);
process.stdout.write(Buffer.from(data[route], 'base64'));
`,
    { mode: 0o755 },
  );
  const run = () =>
    spawnSync(
      process.execPath,
      [
        new URL('../scripts/publish-editions.mjs', import.meta.url).pathname,
        'select-retained',
        '--selector',
        selectorPath,
        '--version',
        'v0.139.0',
        '--editions',
        'coupa',
        '--repository',
        'mekhovov/revealline',
        '--base-path',
        '/revealline/',
      ],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${directory}${path.delimiter}${process.env.PATH}`,
          EDITION_TEST_CALLS: callsPath,
          EDITION_TEST_RESPONSES: responsePath,
        },
      },
    );
  const success = run();
  assert.equal(success.status, 0, success.stderr);
  const selectedBytes = await fs.readFile(selectorPath),
    selected = JSON.parse(selectedBytes);
  assert.deepEqual(
    selected.releases.map((row) => row.activeEditionIds),
    [['coupa'], [], ['droneaid']],
  );
  assert.deepEqual(selected.releases[2], input.releases[2]);
  assert.ok(
    (await fs.readFile(callsPath, 'utf8'))
      .split('\n')
      .filter(Boolean)
      .every((line) => JSON.parse(line)[0] === 'api'),
  );
  const releaseRoute = `${root}/releases/tags/${older.envelope.version}`,
    originalRelease = responses[releaseRoute];
  for (const change of [{ draft: true }, { prerelease: true }, { tag_name: 'v99.0.0' }]) {
    responses[releaseRoute] = bytes({
      ...JSON.parse(Buffer.from(originalRelease, 'base64')),
      ...change,
    }).toString('base64');
    await fs.writeFile(responsePath, JSON.stringify(responses));
    const rejected = run();
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /original published stable release/);
    assert.deepEqual(await fs.readFile(selectorPath), selectedBytes);
  }
  responses[releaseRoute] = originalRelease;
  const corrupt = Buffer.from(responses[`${root}/releases/assets/${corruptedId}`], 'base64');
  corrupt[0] ^= 1;
  responses[`${root}/releases/assets/${corruptedId}`] = corrupt.toString('base64');
  await fs.writeFile(responsePath, JSON.stringify(responses));
  const rejected = run();
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /artifact bytes differ/);
  assert.deepEqual(await fs.readFile(selectorPath), selectedBytes);
  await assert.rejects(fs.access(`${selectorPath}.next`), { code: 'ENOENT' });
});

test('duplicate active launchers and duplicate selected identities fail before release reads', async () => {
  const a = reviewedFixture({ version: 'v0.139.0' });
  const b = reviewedFixture({ version: 'v0.140.0' });
  await assert.rejects(
    frozenEditionOverlay(selector(a.release, b.release), {
      readReleaseAsset: () => assert.fail('Conflicting selectors must fail before downloading.'),
    }),
    /conflicting active/,
  );
  const duplicate = structuredClone(a.release);
  duplicate.editionIds.push(duplicate.editionIds[0]);
  assert.throws(() => validateEditionPublication(selector(duplicate)), /Duplicate selected/);
  const doubleActive = structuredClone(a.release);
  doubleActive.activeEditionIds.push(doubleActive.activeEditionIds[0]);
  assert.throws(() => validateEditionPublication(selector(doubleActive)), /conflicting active/);
});

test('a different deployment base path cannot reuse the frozen PWA installation identity', async () => {
  const fixture = reviewedFixture();
  const wrongTarget = { ...fixture.release, basePath: '/another-site/' };
  await assert.rejects(
    frozenEditionOverlay(selector(wrongTarget), {
      readReleaseAsset: releaseReader(fixture),
      resolveReleaseIdentity: releaseIdentity(fixture),
    }),
    /installation identity/,
  );
});

test('configured deployment mismatch rejects a selector before reading any release assets', async () => {
  const fixture = reviewedFixture();
  await assert.rejects(
    frozenEditionOverlay(selector(fixture.release), {
      targetBasePath: '/another-site/',
      readReleaseAsset: () => assert.fail('Wrong deployment target must not download artifacts.'),
    }),
    /configured deployment target/,
  );
});

test('repeated verification and extraction use one bounded original download per release asset', async () => {
  const fixture = reviewedFixture();
  const calls = new Map();
  const read = releaseReader(fixture);
  await frozenEditionOverlay(selector(fixture.release), {
    targetBasePath: '/revealline/',
    resolveReleaseIdentity: releaseIdentity(fixture),
    readReleaseAsset: async (version, name, limit) => {
      calls.set(name, (calls.get(name) ?? 0) + 1);
      return read(version, name, limit);
    },
  });
  assert.equal(calls.get('editions.json'), 1);
  assert.equal(calls.get('edition-review.json'), 1);
  assert.equal(calls.get(fixture.envelope.editions[0].distribution.path), 1);
  assert.equal(calls.get(fixture.envelope.editions[0].manifest.path), 1);
  assert([...calls.values()].every((count) => count === 1));
});

test('published selector rejects changed receipt bytes and changed distribution payload', async () => {
  const receipt = reviewedFixture();
  receipt.files.set('edition-review.json', Buffer.concat([receipt.reviewBytes, bytes('\n')]));
  await assert.rejects(
    frozenEditionOverlay(selector(receipt.release), {
      readReleaseAsset: releaseReader(receipt),
      resolveReleaseIdentity: releaseIdentity(receipt),
    }),
    /metadata differs/,
  );
  const distribution = reviewedFixture();
  const path = distribution.envelope.editions[0].distribution.path;
  const corrupt = Buffer.from(distribution.files.get(path));
  corrupt[0] ^= 1;
  distribution.files.set(path, corrupt);
  await assert.rejects(
    frozenEditionOverlay(selector(distribution.release), {
      readReleaseAsset: releaseReader(distribution),
      resolveReleaseIdentity: releaseIdentity(distribution),
    }),
    /artifact bytes differ/,
  );
});

test('publication requires an independently resolved tag matching both source commit and tree', async () => {
  const fixture = reviewedFixture();
  await assert.rejects(
    frozenEditionOverlay(selector(fixture.release), {
      readReleaseAsset: releaseReader(fixture),
    }),
    /independent release tag identity/,
  );
  for (const property of ['sourceRevision', 'sourceTree']) {
    const identity = await releaseIdentity(fixture)(fixture.release.version);
    identity[property] = '0'.repeat(40);
    await assert.rejects(
      frozenEditionOverlay(selector(fixture.release), {
        readReleaseAsset: releaseReader(fixture),
        resolveReleaseIdentity: async (version) => {
          assert.equal(version, fixture.release.version);
          return identity;
        },
      }),
      /source differs from the immutable release tag/,
    );
  }
});

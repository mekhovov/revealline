import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EDITION_REVIEW_GATES,
  verifyEditionReview,
  validateEditionPublication,
  frozenEditionOverlay,
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

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  verifyNextReleaseTitle,
  verifyPublishedBase,
  verifyPublicBoundary,
  verifySourceVersion,
} from './release-train-boundary.mjs';

const release = (tag) => ({ draft: false, prerelease: false, tag_name: tag });

test('release source title, package, lock and build versions must match exactly', () => {
  const valid = {
    title: 'Release v0.111.1 — correction',
    packageVersion: '0.111.1',
    lockVersion: '0.111.1',
    rootVersion: '0.111.1',
    buildVersion: '0.111.1',
  };
  assert.equal(verifySourceVersion(valid), 'v0.111.1');
  for (const field of ['lockVersion', 'rootVersion', 'buildVersion'])
    assert.throws(() => verifySourceVersion({ ...valid, [field]: '0.111.0' }), /does not match/);
  assert.throws(() => verifySourceVersion({ ...valid, title: 'Fix v0.111.1' }), /exact Release/);
  assert.throws(
    () => verifySourceVersion({ ...valid, title: 'Release v0.111.2 — wrong slot' }),
    /does not match/,
  );
});

test('next release waits until the previous stable selector and public bytes agree', () => {
  const configuration = { deploymentEnabled: true, currentVersion: 'v0.111.0' };
  const pages = [[release('v0.110.1'), release('v0.111.0')]];
  const rootRelease = {
    version: 'v0.111.0',
    sourceRevision: 'a'.repeat(40),
    play: 'releases/v0.111.0/site/game/',
  };
  const buildInfo = {
    version: 'v0.111.0',
    sourceRevision: 'a'.repeat(40),
    entry: 'game/index.html',
  };
  assert.deepEqual(verifyPublicBoundary({ configuration, pages, rootRelease, buildInfo }), {
    latest: 'v0.111.0',
    sourceRevision: 'a'.repeat(40),
  });
  assert.throws(
    () =>
      verifyPublicBoundary({
        configuration: { ...configuration, currentVersion: 'v0.110.1' },
        pages,
        rootRelease: { ...rootRelease, version: 'v0.110.1' },
        buildInfo: { ...buildInfo, version: 'v0.110.1' },
      }),
    /not the latest/,
  );
  assert.throws(
    () =>
      verifyPublicBoundary({
        configuration,
        pages,
        rootRelease: { ...rootRelease, version: 'v0.110.1' },
        buildInfo,
      }),
    /Public root/,
  );
  assert.throws(
    () =>
      verifyPublicBoundary({
        configuration,
        pages,
        rootRelease,
        buildInfo: { ...buildInfo, sourceRevision: 'b'.repeat(40) },
      }),
    /Public game bytes/,
  );
});

test('a release title must allocate a version newer than the accepted stable release', () => {
  assert.equal(verifyNextReleaseTitle('Release v0.111.1 — patch', 'v0.111.0'), 'v0.111.1');
  assert.equal(verifyNextReleaseTitle('Release v0.112.0 — feature', 'v0.111.1'), 'v0.112.0');
  assert.throws(
    () => verifyNextReleaseTitle('Release v0.111.0 — duplicate', 'v0.111.0'),
    /must be newer/,
  );
  assert.throws(
    () => verifyNextReleaseTitle('Release v0.110.9 — rollback', 'v0.111.0'),
    /must be newer/,
  );
});

test('another product root waits until the main source version is publicly accepted', () => {
  assert.equal(verifyPublishedBase('0.115.0', 'v0.115.0'), 'v0.115.0');
  assert.throws(
    () => verifyPublishedBase('0.115.1', 'v0.115.0'),
    /Finish its immutable release and Pages acceptance/,
  );
  assert.throws(() => verifyPublishedBase('next', 'v0.115.0'), /stable numeric version/);
});

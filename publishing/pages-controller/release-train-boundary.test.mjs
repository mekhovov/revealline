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
  assert.equal(
    verifySourceVersion({ ...valid, title: 'Release evidence v0.111.1 — recovery' }),
    'v0.111.1',
  );
  for (const field of ['lockVersion', 'rootVersion', 'buildVersion'])
    assert.throws(() => verifySourceVersion({ ...valid, [field]: '0.111.0' }), /does not match/);
  assert.throws(() => verifySourceVersion({ ...valid, title: 'Fix v0.111.1' }), /exact Release/);
  assert.throws(
    () => verifySourceVersion({ ...valid, title: 'Release v0.111.2 — wrong slot' }),
    /does not match/,
  );
});

test('next release waits until the exact protected main bytes are public', () => {
  const configuration = { deploymentEnabled: true, currentVersion: 'v0.111.0' };
  const pages = [[release('v0.110.1'), release('v0.111.0')]];
  const deployment = {
    format: 'revealline-main-deployment.v1',
    channel: 'main',
    sourceRevision: 'a'.repeat(40),
    buildVersion: `main-${'a'.repeat(12)}`,
    play: 'game/',
  };
  const buildInfo = {
    version: '0.111.1',
    sourceRevision: 'a'.repeat(40),
    entry: 'game/index.html',
  };
  assert.deepEqual(
    verifyPublicBoundary({
      configuration,
      pages,
      deployment,
      buildInfo,
      expectedMainSha: 'a'.repeat(40),
      expectedGameVersion: '0.111.1',
    }),
    {
      latest: 'v0.111.0',
      sourceRevision: 'a'.repeat(40),
      buildVersion: `main-${'a'.repeat(12)}`,
    },
  );
  assert.throws(
    () =>
      verifyPublicBoundary({
        configuration: { ...configuration, currentVersion: 'v0.110.1' },
        pages,
        deployment,
        buildInfo: { ...buildInfo, version: 'v0.110.1' },
      }),
    /not the latest/,
  );
  assert.throws(
    () =>
      verifyPublicBoundary({
        configuration,
        pages,
        deployment: { ...deployment, channel: 'stable' },
        buildInfo,
      }),
    /continuous-main deployment/,
  );
  assert.throws(
    () =>
      verifyPublicBoundary({
        configuration,
        pages,
        deployment,
        buildInfo: { ...buildInfo, sourceRevision: 'b'.repeat(40) },
      }),
    /continuous-main deployment marker/,
  );
  assert.throws(
    () =>
      verifyPublicBoundary({
        configuration,
        pages,
        deployment,
        buildInfo: { ...buildInfo, version: '0.111.0' },
        expectedGameVersion: '0.111.1',
      }),
    /continuous-main deployment marker/,
  );
  assert.throws(
    () =>
      verifyPublicBoundary({
        configuration,
        pages,
        deployment,
        buildInfo,
        expectedMainSha: 'b'.repeat(40),
      }),
    /does not match protected base/,
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

test('a cumulative root may finish its exact already-allocated unpublished version', () => {
  assert.equal(verifyPublishedBase('0.141.7', 'v0.141.6', 'v0.141.7'), 'v0.141.7');
  assert.equal(verifyPublishedBase('0.141.6', 'v0.141.6', 'v0.141.7'), 'v0.141.6');
  assert.throws(
    () => verifyPublishedBase('0.141.7', 'v0.141.6', 'v0.141.8'),
    /Finish its immutable release/,
  );
  assert.throws(() => verifyPublishedBase('0.141.7', 'v0.141.6'), /Finish its immutable release/);
  assert.throws(() => verifyPublishedBase('0.141.6', 'v0.141.6', 'v0.141.6'), /must be newer/);
  assert.throws(() => verifyPublishedBase('0.141.5', 'v0.141.6', 'v0.141.5'), /must be newer/);
  assert.throws(
    () => verifyPublishedBase('next', 'v0.141.6', 'v0.141.7'),
    /stable numeric version/,
  );
});

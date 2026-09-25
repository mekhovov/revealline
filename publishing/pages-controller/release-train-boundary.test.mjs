import test from 'node:test';
import assert from 'node:assert/strict';
import {
  verifyHotfixBoundary,
  verifyNextReleaseTitle,
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

const publicPin = {
  version: 'v0.112.0',
  tagObject: '1'.repeat(40),
  sourceRevision: '2'.repeat(40),
  sourceTree: '3'.repeat(40),
};
const blockedAssets = [
  'distribution.zip',
  'distribution.zip.sha256',
  'manifest.json',
  'qualification-evidence-record.json',
  'release.json',
  'source-qualification-evidence.zip',
  'source-qualification.json',
  'source.tar',
  'verification.json',
].map((name, index) => ({
  name,
  id: index + 1,
  size: index + 10,
  sha256: ((index + 4) % 16).toString(16).repeat(64),
}));
const blockedPin = {
  version: 'v0.113.0',
  releaseId: 77,
  tagObject: 'a'.repeat(40),
  sourceRevision: 'b'.repeat(40),
  sourceTree: 'c'.repeat(40),
  assets: blockedAssets,
};
const hotfixHead = 'e'.repeat(40);
const hotfixFixture = () => ({
  bridge: {
    formatVersion: 1,
    active: true,
    repository: 'mekhovov/revealline',
    public: publicPin,
    blocked: blockedPin,
    requested: { version: 'v0.113.1' },
  },
  configuration: { deploymentEnabled: true, currentVersion: 'v0.112.0' },
  pages: [[release('v0.111.1'), release('v0.112.0'), release('v0.113.0')]],
  rootRelease: {
    version: 'v0.112.0',
    sourceRevision: publicPin.sourceRevision,
    play: 'releases/v0.112.0/site/game/',
  },
  buildInfo: {
    version: 'v0.112.0',
    sourceRevision: publicPin.sourceRevision,
    entry: 'game/index.html',
  },
  title: 'Release v0.113.1 — bounded correction',
  head: hotfixHead,
  publicRemote: {
    ref: { ref: 'refs/tags/v0.112.0', object: { type: 'tag', sha: publicPin.tagObject } },
    tag: {
      sha: publicPin.tagObject,
      tag: 'v0.112.0',
      object: { type: 'commit', sha: publicPin.sourceRevision },
    },
    commit: { sha: publicPin.sourceRevision, tree: { sha: publicPin.sourceTree } },
  },
  blockedRemote: {
    ref: { ref: 'refs/tags/v0.113.0', object: { type: 'tag', sha: blockedPin.tagObject } },
    tag: {
      sha: blockedPin.tagObject,
      tag: 'v0.113.0',
      object: { type: 'commit', sha: blockedPin.sourceRevision },
    },
    commit: { sha: blockedPin.sourceRevision, tree: { sha: blockedPin.sourceTree } },
    release: {
      id: blockedPin.releaseId,
      tag_name: 'v0.113.0',
      draft: false,
      prerelease: false,
      assets: blockedAssets.map(({ name, id, size, sha256 }) => ({
        name,
        id,
        size,
        digest: `sha256:${sha256}`,
      })),
    },
  },
  compare: {
    status: 'ahead',
    ahead_by: 2,
    behind_by: 0,
    base_commit: { sha: blockedPin.sourceRevision },
    merge_base_commit: { sha: blockedPin.sourceRevision },
    head_commit: { sha: hotfixHead },
    commits: [
      { sha: 'd'.repeat(40), parents: [{ sha: blockedPin.sourceRevision }] },
      { sha: hotfixHead, parents: [{ sha: 'd'.repeat(40) }] },
    ],
  },
});

test('one exact pinned hotfix may bridge one broken published release', () => {
  assert.deepEqual(verifyHotfixBoundary(hotfixFixture()), {
    latest: 'v0.112.0',
    sourceRevision: publicPin.sourceRevision,
    requested: 'v0.113.1',
    skipped: 'v0.113.0',
    bridge: 'one-time-pinned',
  });
});

test('hotfix bridge fails closed for stale state, changed releases, and divergent source', () => {
  for (const mutate of [
    (value) => (value.bridge.active = false),
    (value) => (value.configuration.currentVersion = 'v0.111.1'),
    (value) => (value.pages[0].push(release('v0.114.0'))),
    (value) => (value.blockedRemote.release.id += 1),
    (value) => (value.blockedRemote.release.assets[0].size += 1),
    (value) => (value.blockedRemote.tag.object.sha = 'f'.repeat(40)),
    (value) => (value.title = 'Release v0.113.2 — wrong patch'),
    (value) => (value.compare.behind_by = 1),
    (value) => (value.compare.commits[0].parents = [
      { sha: blockedPin.sourceRevision },
      { sha: '0'.repeat(40) },
    ]),
  ]) {
    const value = hotfixFixture();
    mutate(value);
    assert.throws(() => verifyHotfixBoundary(value));
  }
});

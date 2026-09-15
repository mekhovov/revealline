import test from 'node:test';
import assert from 'node:assert/strict';
import { latestStableRelease, releaseDecision } from './release-policy.mjs';

const release = (tag_name, extra = {}) => ({ tag_name, draft: false, prerelease: false, ...extra });
const pages = [
  [release('v0.9.0'), release('v0.51.0')],
  [
    release('v1.0.0', { draft: true }),
    release('v9.0.0', { prerelease: true }),
    release('v2.0.0-beta.1'),
    release('nightly'),
  ],
];
const configuration = { deploymentEnabled: true, currentVersion: 'v0.51.0' };

test('latest stable policy preserves numeric ordering, pagination and publication status', () => {
  assert.equal(latestStableRelease(pages), 'v0.51.0');
  assert.equal(
    latestStableRelease([[release('v1.9.99'), release('v1.10.0'), release('v1.10.1')]]),
    'v1.10.1',
  );
  assert.throws(() => latestStableRelease([]), /No published/);
  assert.throws(() => latestStableRelease([{}]), /Invalid/);
});
test('older release events cannot roll back or implicitly change the reviewed selector', () => {
  const result = releaseDecision({ configuration, pages, requested: 'v0.9.0', route: true });
  assert.equal(result.shouldDispatch, false);
  assert.equal(configuration.currentVersion, 'v0.51.0');
  assert.throws(
    () => releaseDecision({ configuration, pages, requested: 'v0.9.0' }),
    /does not match/,
  );
});
test('a latest release requires an enabled selector before routing or publishing', () => {
  for (const route of [true, false]) {
    const args = { pages, requested: 'v0.51.0', route };
    assert.throws(
      () =>
        releaseDecision({ ...args, configuration: { ...configuration, deploymentEnabled: false } }),
      /not enabled/,
    );
    assert.equal(releaseDecision({ ...args, configuration }).shouldDispatch, route);
  }
  assert.throws(
    () => releaseDecision({ configuration, pages, requested: 'refs/heads/main', route: true }),
    /exact stable/,
  );
  assert.throws(() => releaseDecision({ configuration, pages, route: true }), /name its tag/);
  assert.equal(releaseDecision({ configuration, pages }).requested, 'v0.51.0');
});
test('a newly published release waits successfully for its reviewed frozen selector', () => {
  const waiting = releaseDecision({
    configuration: { ...configuration, currentVersion: 'v0.9.0' },
    pages,
    requested: 'v0.51.0',
    route: true,
  });
  assert.deepEqual(waiting, {
    shouldDispatch: false,
    requested: 'v0.51.0',
    latest: 'v0.51.0',
    reason: 'Awaiting a reviewed frozen selector for the latest stable release.',
  });
  assert.throws(
    () =>
      releaseDecision({
        configuration: { ...configuration, currentVersion: 'v0.9.0' },
        pages,
        requested: 'v0.51.0',
      }),
    /not the latest/,
  );
});

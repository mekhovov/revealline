import test from 'node:test';
import assert from 'node:assert/strict';
import {
  verifyPublicBoundary,
  verifySourceVersion,
} from './release-train-boundary.mjs';

test('source version metadata is informational', () => {
  assert.equal(verifySourceVersion({ packageVersion: '0.111.1' }), '0.111.1');
  assert.equal(verifySourceVersion({ packageVersion: 'custom-build' }), 'custom-build');
  assert.equal(verifySourceVersion({ packageVersion: null }), null);
});

test('Pages requires the exact protected main bytes, not version equality', () => {
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
      deployment,
      buildInfo,
      expectedMainSha: 'a'.repeat(40),
    }),
    {
      sourceRevision: 'a'.repeat(40),
      buildVersion: `main-${'a'.repeat(12)}`,
    },
  );
  assert.throws(
    () =>
      verifyPublicBoundary({
        deployment: { ...deployment, channel: 'stable' },
        buildInfo,
      }),
    /continuous-main deployment/,
  );
  assert.throws(
    () =>
      verifyPublicBoundary({
        deployment,
        buildInfo: { ...buildInfo, sourceRevision: 'b'.repeat(40) },
      }),
    /continuous-main deployment marker/,
  );
  assert.throws(
    () =>
      verifyPublicBoundary({
        deployment,
        buildInfo,
        expectedMainSha: 'b'.repeat(40),
      }),
    /does not match protected base/,
  );
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { checkCuratedAppearancePackage } from './check-curated-appearance-package.mjs';

test('edited Studio theme survives two real compiled community entries and verified cache-only reload', async () => {
  const { report } = await checkCuratedAppearancePackage();
  assert.equal(report.communities.length, 2);
  assert.ok(report.communities.every((row) => row.emittedModules > 20 && row.offlineRequests > 0));
  assert.equal(report.pin.familyId.startsWith('candidate-'), true);
});

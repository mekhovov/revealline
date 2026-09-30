import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INCLUDED_BUNDLED_PACK_MAX_BYTES,
  isIncludedBundledMission,
} from '../mission-library/included-bundled-pack.mjs';

const row = (patch = {}) => ({
  source: 'bundled',
  sourceFile: { bytes: INCLUDED_BUNDLED_PACK_MAX_BYTES },
  ...patch,
});

test('only small first-party bundled missions qualify as included game content', () => {
  assert.equal(isIncludedBundledMission(row()), true);
  assert.equal(
    isIncludedBundledMission(row({ sourceFile: { bytes: INCLUDED_BUNDLED_PACK_MAX_BYTES + 1 } })),
    false,
  );
  for (const source of ['optional', 'external', 'archived'])
    assert.equal(isIncludedBundledMission(row({ source })), false);
  assert.equal(isIncludedBundledMission(row({ sourceFile: { bytes: 0 } })), false);
});

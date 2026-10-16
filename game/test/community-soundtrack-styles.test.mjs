import assert from 'node:assert/strict';
import test from 'node:test';
import { availableCommunitySoundtrackStyles } from '../community-soundtrack-styles.mjs';
import {
  DEFAULT_PUBLIC_SOUNDTRACK_STYLE_IDS,
  PUBLIC_SOUNDTRACK_STYLE_IDS,
} from '../soundtrack-style-taxonomy.mjs';

test('main game and community brands expose only their admitted special song styles', () => {
  assert.strictEqual(availableCommunitySoundtrackStyles(), PUBLIC_SOUNDTRACK_STYLE_IDS);
  for (const brandId of ['social-drone-ua', 'victory-drones', 'fpv-learning'])
    assert.deepEqual(availableCommunitySoundtrackStyles(brandId), PUBLIC_SOUNDTRACK_STYLE_IDS);
  assert.deepEqual(availableCommunitySoundtrackStyles('ukraine-culture'), [
    ...DEFAULT_PUBLIC_SOUNDTRACK_STYLE_IDS,
    'ukrainian',
  ]);
  for (const brandId of ['coupa', 'droneaid', 'droneaid-nl', 'unknown-community'])
    assert.deepEqual(
      availableCommunitySoundtrackStyles(brandId),
      DEFAULT_PUBLIC_SOUNDTRACK_STYLE_IDS,
    );
});

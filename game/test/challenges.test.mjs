import test from 'node:test';
import assert from 'node:assert/strict';
import { challengeCampaign } from '../challenges.mjs';
import { validateLevel } from '../core/index.mjs';
import { campaignKey } from '../library.mjs';
test('daily routes are repeatable and difficulty changes partition score identity', () => {
  const a = challengeCampaign('2026-09-12');
  assert.deepEqual(a, challengeCampaign('2026-09-12'));
  assert.notEqual(campaignKey(a), campaignKey(challengeCampaign('2026-09-13')));
  assert.notEqual(campaignKey(a), campaignKey(challengeCampaign('2026-09-12', 'calm')));
});
test('all three challenge recipes produce valid boards across representative dates', () => {
  for (const date of ['1994-01-01', '2000-02-29', '2026-09-12', '2027-12-31'])
    for (const kind of ['daily', 'calm', 'expert'])
      assert.equal(validateLevel(challengeCampaign(date, kind).levels[0]).valid, true);
});
test('malformed dates and unknown recipes cannot generate content', () => {
  for (const date of ['2026-02-30', 'invalid', '2026-00-12'])
    assert.throws(() => challengeCampaign(date));
  assert.throws(() => challengeCampaign('2026-09-12', 'unknown'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { projectRewardExhibits } from '../rewards/exhibit.mjs';

const locales = {
  en: { title: 'Earned', teaser: 'A public promise' },
  uk: { title: 'Зібрано', teaser: 'Публічна обіцянка' },
};
const reward = (id, scope, campaignId = 'workshop') => ({
  id,
  campaignId,
  scope: { kind: 'mission', id: scope },
  locales,
  payloads: [{ type: 'image', asset: { assetId: 'hidden-' + id, sha256: 'a'.repeat(64) } }],
});

test('exhibits follow authored campaign and mission order without exposing locked payloads', () => {
  const exhibits = projectRewardExhibits({
    campaigns: [
      { id: 'workshop', missionIds: ['m1', 'm2'], discovery: { exhibitLayout: 'mosaic' } },
      { id: 'other', missionIds: ['o1'] },
    ],
    definitions: [reward('r2', 'm2'), reward('r1', 'm1'), reward('r3', 'o1', 'other')],
    receipts: [],
    progress: [],
  });
  assert.deepEqual(
    exhibits.map((x) => x.campaign.id),
    ['workshop', 'other'],
  );
  assert.deepEqual(
    exhibits[0].rows.map((x) => x.id),
    ['r1', 'r2'],
  );
  assert.equal(exhibits[0].layout, 'mosaic');
  assert.equal(exhibits[1].layout, 'route');
  assert.equal(exhibits[0].collected, 0);
  assert.doesNotMatch(JSON.stringify(exhibits), /hidden-|payloads|sha256/);
});

test('exhibit pictures and descriptions come from the exact earned receipt', () => {
  const current = reward('r1', 'm1'),
    original = structuredClone(current);
  original.payloads[0].asset.assetId = 'original-image';
  original.payloads.push({
    type: 'video',
    asset: { assetId: 'original-video', sha256: 'b'.repeat(64) },
  });
  original.locales.en.title = 'Original title';
  const receipt = { definition: original };
  const [exhibit] = projectRewardExhibits({
    campaigns: [{ id: 'workshop', missionIds: ['m1'] }],
    definitions: [current],
    receipts: [receipt],
    progress: [],
  });
  assert.equal(exhibit.rows[0].image.asset.assetId, 'original-image');
  assert.equal(exhibit.rows[0].video.asset.assetId, 'original-video');
  assert.equal(exhibit.rows[0].locales.en.title, 'Original title');
  assert.equal(exhibit.rows[0].receipt, receipt);
  assert.equal(exhibit.collected, 1);
  assert.equal(exhibit.total, 1);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { importCampaignKeyArt } from '../../scripts/lib/import-campaign-key-art.mjs';
import { rasterFixtures } from './helpers/raster-fixtures.mjs';

function fixture() {
  const { bytes } = rasterFixtures().find(({ extension }) => extension === 'jpg');
  const digest = createHash('sha256').update(bytes).digest('hex');
  const record = {
    campaignId: 'sample',
    role: 'campaign-key',
    revision: 1,
    title: 'Sample',
    tool: 'built-in image_gen.imagegen',
    prompt: 'An original imaginary workshop with legible shapes and no logos.',
    transparentBackground: false,
    rightsClassification: 'generated-original',
    humanReview: 'deferred',
    visualReview: { masterViewed: true, derivativeDimensionsVerified: true },
    alt: { en: 'A sample', uk: 'Приклад' },
    publicationContext: { en: 'Fictional illustration.', uk: 'Уявна ілюстрація.' },
    sourceInspiration: [{ url: 'https://example.org/objects', role: 'Context only, not copied.' }],
    master: {
      path: '/private/generated_images/session/master.png',
      sha256: digest,
      bytes: bytes.length,
      width: 1,
      height: 1,
    },
    derivative: {
      path: 'game/editions/assets/sample/key-v1.jpg',
      sha256: digest,
      bytes: bytes.length,
      width: 1,
      height: 1,
      transformation: 'Mechanical encode without cropping.',
    },
  };
  return {
    record,
    bytes,
    args: {
      receipts: [{ schema: 'revealline-generated-campaign-art-review.v1', assets: [record] }],
      campaigns: [{ id: 'sample' }],
      assets: [],
      artwork: [],
      sources: { assets: [] },
      read: async () => bytes,
    },
  };
}
test('campaign-key admission verifies exact raster bytes, preserves provenance and is idempotent', async () => {
  const { args } = fixture();
  const result = await importCampaignKeyArt(args);
  assert.equal(result.imported[0].assetId, 'sample-key-v1');
  assert.equal(result.artwork[0].id, 'sample-key-picture');
  assert.equal(
    result.sources.assets[0].original.path,
    '$CODEX_HOME/generated_images/session/master.png',
  );
  assert(!JSON.stringify(result).includes('/private/'));
  assert.deepEqual(await importCampaignKeyArt({ ...args, ...result }), result);
});
test('art admission rejects substituted bytes, immutable revision edits, bad source and unreviewed scenes', async () => {
  for (const change of [
    ({ args }) => {
      args.read = async () => Buffer.from('not an image');
    },
    ({ record }) => {
      record.derivative.width = 2;
    },
    ({ record }) => {
      record.derivative.path = 'game/editions/assets/../secret.jpg';
    },
    ({ record }) => {
      record.sourceInspiration[0].url = 'javascript:alert(1)';
    },
    ({ record }) => {
      record.visualReview.masterViewed = false;
    },
  ]) {
    const f = fixture();
    change(f);
    await assert.rejects(importCampaignKeyArt(f.args));
  }
  const { args, record } = fixture();
  const result = await importCampaignKeyArt(args);
  record.prompt += ' Changed.';
  await assert.rejects(importCampaignKeyArt({ ...args, ...result }), /immutable/);
});
test('mission scenes share reviewed-byte admission but bind their own exact artwork identity', async () => {
  const { args, record } = fixture();
  args.receipts[0].schema = 'revealline-generated-mission-art-review.v1';
  args.missions = [{ id: 'sample-01' }];
  delete record.campaignId;
  record.missionId = 'sample-01';
  record.role = 'mission-reveal';
  const result = await importCampaignKeyArt(args);
  assert.equal(result.artwork[0].id, 'sample-01-picture');
  assert.equal(result.imported[0].assetId, 'sample-01-reveal-v1');
  assert.equal(result.imported[0].missionId, 'sample-01');
});

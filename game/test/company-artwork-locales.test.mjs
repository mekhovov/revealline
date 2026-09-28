import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { selectExactCompanyArtworkDescriptions } from '../company-campaigns/artwork.mjs';
import { CURRICULUM_LESSONS } from '../company-campaigns/curriculum-lessons.mjs';
import { CURRICULUM_CAMPAIGNS } from '../company-campaigns/curriculum.mjs';
import { createCurriculumProject } from '../company-campaigns/curriculum-content.mjs';
import { createCurriculumRewards } from '../company-campaigns/curriculum-rewards.mjs';
import { createRewardMissionBindings } from '../rewards/bindings.mjs';

const asset = {
  id: 'selected-picture',
  path: 'game/editions/assets/selected.jpg',
  sha256: 'a'.repeat(64),
  bytes: 512,
};
const record = {
  ...asset,
  publication: 'public',
  locales: {
    en: { alt: 'Selected original gallery.' },
    uk: { alt: 'Обрана оригінальна галерея.' },
  },
  prompt: 'Authoring provenance must stay outside the reward payload.',
};

test('localized image descriptions require the exact selected public media identity', () => {
  assert.deepEqual(selectExactCompanyArtworkDescriptions(asset, [record]), {
    en: record.locales.en.alt,
    uk: record.locales.uk.alt,
  });
  for (const mutation of [
    { path: 'game/editions/assets/other.jpg' },
    { sha256: 'b'.repeat(64) },
    { bytes: 513 },
    { publication: 'restricted' },
  ])
    assert.throws(
      () => selectExactCompanyArtworkDescriptions(asset, [{ ...record, ...mutation }]),
      /selected public bytes/,
    );
  assert.throws(
    () =>
      selectExactCompanyArtworkDescriptions(asset, [
        { ...record, locales: { en: record.locales.en } },
      ]),
    /English and Ukrainian/,
  );
  assert.equal(selectExactCompanyArtworkDescriptions(asset, [{ ...record, id: 'other' }]), null);
  assert.equal(selectExactCompanyArtworkDescriptions(asset), null);
});

test('mission and finale image rewards use the reviewed selected artwork descriptions without provenance', async () => {
  const json = async (file) => JSON.parse(await readFile(new URL(file, import.meta.url), 'utf8'));
  const [assets, artwork, sourceManifest] = await Promise.all(
    ['../editions/assets.json', '../editions/artwork.json', '../editions/asset-sources.json'].map(
      json,
    ),
  );
  const definition = CURRICULUM_CAMPAIGNS.find(({ id }) => id === 'ukraine-threads');
  const source = createCurriculumProject({ campaignId: definition.id, artwork });
  const rewards = createCurriculumRewards({
    definition,
    source,
    lessons: CURRICULUM_LESSONS,
    assets,
    assetSources: sourceManifest.assets,
    missionBindings: createRewardMissionBindings(source),
  });
  let verified = 0;
  for (const reward of rewards)
    for (const payload of reward.payloads.filter(({ type }) => type === 'image')) {
      const media = assets.find(({ id }) => id === payload.asset.assetId);
      const descriptions = selectExactCompanyArtworkDescriptions(media, sourceManifest.assets);
      if (!descriptions) continue;
      for (const locale of ['en', 'uk'])
        assert.equal(payload.locales[locale].alt, descriptions[locale]);
      assert.deepEqual(Object.keys(payload).sort(), ['asset', 'id', 'locales', 'type']);
      assert.equal(payload.asset.sha256, media.sha256);
      verified += 1;
    }
  assert.ok(
    verified >= 6,
    'Reviewed mission images must appear both as first-win and finale payloads.',
  );
});

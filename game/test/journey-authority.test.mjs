import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { campaignKey } from '../library.mjs';
import { createExecutionCatalog } from '../campaign-contexts.mjs';
import { createJourneyAuthority } from '../journey/authority.mjs';

const json = async (name) => JSON.parse(await readFile(new URL(name, import.meta.url), 'utf8'));
const base = await json('../content/campaign.json');
base.classRecipes = await json('../content/classes.json');
const pins = await json('../content/journey-campaign-pins.json');

test('Journey rejects edited same-ID base missions, equipment and pack ownership', () => {
  const authority = createJourneyAuthority({ baseCampaign: base, pins });
  const entry = { campaign: base, classRecipes: base.classRecipes, sourcePackId: null };
  assert.equal(authority.matches(entry), true);
  const edited = structuredClone(entry);
  edited.campaign.levels[0].goal.coverage = 0.01;
  assert.equal(authority.matches(edited), false);
  const equipment = structuredClone(entry);
  equipment.campaign.classRecipes[0].cooldown += 1;
  assert.equal(authority.matches(equipment), false);
  assert.equal(authority.matches({ ...entry, sourcePackId: 'not-official' }), false);
});

test('all active pack pins match shipped original gameplay and both difficulty projections', async () => {
  const catalog = await json('../content/packs/catalog.json');
  const actual = [];
  const authority = createJourneyAuthority({ baseCampaign: base, pins });
  for (const item of catalog.packs) {
    const pack = await json(`../content/packs/${item.path}`);
    for (const authored of pack.campaigns) {
      const campaign = {
        ...authored,
        classRecipes: pack.classRecipes.filter(
          (recipe) => !authored.classIds || authored.classIds.includes(recipe.id),
        ),
      };
      actual.push({ packId: pack.id, campaignId: campaign.id, gameplayKey: campaignKey(campaign) });
      const entry = { campaign, classRecipes: campaign.classRecipes, sourcePackId: pack.id };
      for (const context of createExecutionCatalog([entry]).entries)
        assert.equal(authority.matches(context), true, `${pack.id}: ${context.difficulty}`);
      const modified = structuredClone(entry);
      modified.campaign.levels[0].goal.coverage = 0.01;
      assert.equal(authority.matches(modified), false, `${pack.id}: same IDs, different map`);
    }
  }
  assert.deepEqual(pins.campaigns, actual, 'Pins must cover exactly the active shipped catalog.');
});

test('Journey authority refuses duplicate or malformed pin declarations', () => {
  assert.throws(
    () =>
      createJourneyAuthority({
        baseCampaign: base,
        pins: { ...pins, campaigns: [...pins.campaigns, pins.campaigns[0]] },
      }),
    /duplicate/i,
  );
  assert.throws(
    () => createJourneyAuthority({ baseCampaign: base, pins: { ...pins, format: 'future' } }),
    /format/i,
  );
  assert.throws(
    () =>
      createJourneyAuthority({
        baseCampaign: base,
        pins: {
          ...pins,
          campaigns: [{ ...pins.campaigns[0], gameplayKey: 'different/1/0123456789abcdef' }],
        },
      }),
    /identity/i,
  );
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { preparePack, resolvePackCampaign } from '../packs.mjs';
import { campaignKey } from '../library.mjs';
import {
  CLASSIC_RULES_CURRENT,
  CLASSIC_RULES_ORIGINAL,
  projectClassicCurrentRulesEntry,
} from '../mission-library/classic-current-rules.mjs';

const recipe = JSON.parse(
  await readFile(new URL('../content/packs/fpv-pressure-frontier.json', import.meta.url), 'utf8'),
);
recipe.visualOverrides = {};
recipe.levelVisuals = [];
const pack = (await preparePack(recipe)).pack;
const original = resolvePackCampaign(pack, recipe.campaigns[0].id);

test('Current rules project every compatible level without mutating its authenticated original', () => {
  const before = structuredClone(original);
  const current = projectClassicCurrentRulesEntry(original, CLASSIC_RULES_CURRENT);
  assert.deepEqual(original, before);
  assert.notEqual(current, original);
  assert.notEqual(campaignKey(current.campaign), campaignKey(original.campaign));
  assert.equal(current.classicRulesSourceCampaignKey, campaignKey(original.campaign));
  assert.equal(current.classicRulesEdition, CLASSIC_RULES_CURRENT);
  for (let index = 0; index < current.campaign.levels.length; index++) {
    const level = current.campaign.levels[index];
    assert.deepEqual(level.classic.lineImpact, { version: 'line-impact.v1', speed: 24 });
    assert.notEqual(level.revision, original.campaign.levels[index].revision);
    assert.equal(level.id, original.campaign.levels[index].id);
    assert.deepEqual(level.enemies, original.campaign.levels[index].enemies);
  }
  assert(Object.isFrozen(current));
  assert(Object.isFrozen(current.campaign.levels[0].classic.lineImpact));
});

test('Original rules remain the exact authenticated object and legacy schemas reject projection', async () => {
  assert.equal(projectClassicCurrentRulesEntry(original, CLASSIC_RULES_ORIGINAL), original);
  const legacy = {
    campaign: JSON.parse(
      await readFile(new URL('../content/campaign.json', import.meta.url), 'utf8'),
    ),
  };
  assert.throws(
    () => projectClassicCurrentRulesEntry(legacy, CLASSIC_RULES_CURRENT),
    /not compatible/,
  );
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dataIdentity } from '../data-json.mjs';
import { createExecutionCatalog } from '../campaign-contexts.mjs';
import { normalizedLevel } from '../core/level.mjs';
import { contentText, isRegisteredContent } from '../i18n/content.mjs';
import { getLocale, setLocale, t } from '../i18n/index.mjs';
import { missionBriefing } from '../mission-brief.mjs';
import {
  CLASSIC_RULES_ORIGINAL,
  CLASSIC_RULES_CURRENT,
  projectClassicCurrentRulesEntry,
} from '../mission-library/classic-current-rules.mjs';
import {
  applyGameplayTuning,
  resolveGameplayTuning,
  GAMEPLAY_PRESSURE_PRESETS,
  GAMEPLAY_TUNING_DEFAULTS,
} from '../gameplay-tuning.mjs';

const packs = [
  ['neon-reference-pack', 16],
  ['neon-mosaic-pack', 38],
];

async function shippedCampaigns(packId) {
  const pack = JSON.parse(
    await readFile(new URL(`../content/packs/${packId}.json`, import.meta.url), 'utf8'),
  );
  // Match the installed pack's filtered roster. No picture decoding, download,
  // installation or content mutation is needed to derive presentation records.
  return pack.campaigns.map((campaign) => ({
    ...campaign,
    classRecipes: pack.classRecipes.filter(
      (recipe) => !campaign.classIds || campaign.classIds.includes(recipe.id),
    ),
  }));
}

function restoreLocale(context) {
  const original = getLocale();
  context.after(() => setLocale(original, { persist: false }));
}

for (const [packId, levelCount] of packs)
  test(`${packId}: exact Original and Current rules briefings translate across built-in pressure presets without changing recipes`, async (context) => {
    restoreLocale(context);
    const campaigns = await shippedCampaigns(packId),
      sourceIdentity = dataIdentity(campaigns),
      acceptedIdentities = new Set();
    for (const campaign of campaigns)
      for (const rulesEdition of [CLASSIC_RULES_ORIGINAL, CLASSIC_RULES_CURRENT]) {
        // Use the same entry-level policy as the launch adapter: Current rules
        // revisions include the exact installed campaign identity.
        const projected = projectClassicCurrentRulesEntry({ campaign }, rulesEdition);
        const executions = createExecutionCatalog([projected]);
        for (const execution of executions.entries)
          for (const pressure of Object.keys(GAMEPLAY_PRESSURE_PRESETS)) {
            const accepted = execution.campaign.levels.map((level) =>
              normalizedLevel(applyGameplayTuning(level, resolveGameplayTuning(pressure))),
            );
            const before = dataIdentity(accepted),
              campaignBefore = dataIdentity(execution.campaign);
            for (const locale of ['uk', 'en', 'uk']) {
              setLocale(locale, { persist: false });
              const campaignTitle = contentText(execution.campaign, 'title');
              if (locale === 'uk') assert.match(campaignTitle, /[А-ЯІЇЄҐа-яіїєґ]/);
              else assert.equal(campaignTitle, execution.campaign.title);
              for (const level of accepted) {
                const label = `${packId}/${rulesEdition}/${execution.difficulty}/${pressure}/${level.id}`;
                assert.equal(isRegisteredContent(level), true, label);
                const name = contentText(level, 'name'),
                  description = contentText(level, 'metadata.description'),
                  brief = missionBriefing(level);
                assert.equal(brief.fullTitle, name, label);
                assert.ok(brief.fullBrief.includes(description), label);
                assert.ok(
                  brief.goal.includes(
                    t('gameplay:brief.routeCoverage', {
                      coverage: Number((level.goal.coverage * 100).toFixed(6)),
                    }),
                  ),
                  label,
                );
                if (locale === 'uk') {
                  assert.notEqual(name, level.name, label);
                  assert.match(name, /[А-ЯІЇЄҐа-яіїєґ]/, label);
                  assert.notEqual(description, level.metadata.description, label);
                  assert.match(description, /[А-ЯІЇЄҐа-яіїєґ]/, label);
                  assert.match(brief.goal, /[А-ЯІЇЄҐа-яіїєґ]/, label);
                  assert.doesNotMatch(brief.goal, /Capture .*reachable routes/, label);
                } else {
                  assert.equal(name, level.name, label);
                  assert.equal(description, level.metadata.description, label);
                }
              }
              assert.equal(dataIdentity(accepted), before);
              assert.equal(dataIdentity(execution.campaign), campaignBefore);
            }
            for (const level of accepted) acceptedIdentities.add(dataIdentity(level));
          }
      }
    assert.equal(acceptedIdentities.size, levelCount * 2 * 2 * 3);
    assert.equal(dataIdentity(campaigns), sourceIdentity);
  });

test('same-named edited Neon levels, custom names and administrator tuning retain literal authored text', async (context) => {
  restoreLocale(context);
  setLocale('uk', { persist: false });
  for (const [packId] of packs) {
    const [campaign] = await shippedCampaigns(packId);
    for (const rulesEdition of [CLASSIC_RULES_ORIGINAL, CLASSIC_RULES_CURRENT]) {
      const projected = projectClassicCurrentRulesEntry({ campaign }, rulesEdition);
      const execution = createExecutionCatalog([projected]).entries[0];
      const original = execution.campaign.levels[0],
        accepted = applyGameplayTuning(original, resolveGameplayTuning('standard'));
      const edited = structuredClone(accepted);
      assert.notEqual(contentText(edited, 'name'), edited.name);
      edited.rules.lives++;
      assert.equal(edited.id, accepted.id);
      assert.equal(edited.revision, accepted.revision);
      assert.equal(edited.name, accepted.name);
      assert.equal(isRegisteredContent(edited), false);
      assert.equal(contentText(edited, 'name'), edited.name);
      assert.equal(contentText(edited, 'metadata.description'), edited.metadata.description);
      const custom = structuredClone(accepted);
      custom.name = 'My own Neon arena';
      custom.metadata.description = 'Keep this description exactly as I wrote it.';
      const customBefore = dataIdentity(custom);
      const administrator = applyGameplayTuning(
        original,
        resolveGameplayTuning('standard', { ...GAMEPLAY_TUNING_DEFAULTS, enemySpeed: 1.01 }),
      );
      for (const locale of ['en', 'uk']) {
        setLocale(locale, { persist: false });
        for (const record of [custom, administrator]) {
          assert.equal(isRegisteredContent(record), false);
          assert.equal(contentText(record, 'name'), record.name);
          assert.equal(contentText(record, 'metadata.description'), record.metadata.description);
        }
      }
      assert.equal(dataIdentity(custom), customBefore);
    }
  }
});

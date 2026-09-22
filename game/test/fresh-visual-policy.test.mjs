import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createExecutionCatalog } from '../campaign-contexts.mjs';
import {
  FRESH_SOLO_VISUAL_RELEASE,
  freshSoloVisualSelection,
  prepareFreshSoloVisualTheme,
} from '../presentation/fresh-visual-theme.mjs';
import { createVisualThemeCatalogue } from '../presentation/visual-theme-catalogue.mjs';
import { prepareCampaignVisualThemeContext } from '../presentation/visual-theme-identities.mjs';
const read = async (name) => JSON.parse(await fs.readFile(new URL(name, import.meta.url), 'utf8'));
async function entries() {
  const campaign = await read('../content/campaign.json');
  campaign.classRecipes = await read('../content/classes.json');
  return createExecutionCatalog([
    { campaign, themes: (await read('../content/themes.json')).themes },
  ]).entries;
}
test('fresh policy declares exact full original coverage for both accepted difficulties', async () => {
  const rows = await entries(),
    catalogue = createVisualThemeCatalogue(await read('../presentation/visual-themes.json'));
  for (const entry of rows) {
    assert.deepEqual(freshSoloVisualSelection(entry, 'fpv'), FRESH_SOLO_VISUAL_RELEASE.selection);
    for (const level of entry.campaign.levels) {
      const content = await prepareCampaignVisualThemeContext({
        entry,
        level,
        association: { editionId: 'field-kit', contentThemeId: 'fpv', mode: 'solo' },
      });
      const match = catalogue.resolve(FRESH_SOLO_VISUAL_RELEASE.selection, content);
      assert.equal(match.kind, 'compatible');
      assert.equal(match.content.owner.baseCampaignKey, FRESH_SOLO_VISUAL_RELEASE.campaignKey);
    }
    assert.equal(freshSoloVisualSelection(entry, 'coupa'), null);
    assert.equal(freshSoloVisualSelection({ ...entry, activity: 'challenge' }, 'fpv'), null);
    assert.equal(
      freshSoloVisualSelection(
        { ...entry, baseCampaignKey: 'first-signal/2/another-owner' },
        'fpv',
      ),
      null,
    );
  }
});
test('same-named or mutated authored content cannot reuse approved fresh coverage', async () => {
  const entry = structuredClone((await entries())[0]);
  entry.campaign.levels[0].spawn.x += 1;
  let fetched = false;
  await assert.rejects(
    prepareFreshSoloVisualTheme(
      { entry, level: entry.campaign.levels[0], themeId: 'fpv' },
      {
        fetch: async () => {
          fetched = true;
        },
      },
    ),
    /verified authored campaign/,
  );
  assert.equal(fetched, false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createOpeningCandidates } from '../content-design/horizon-candidates.mjs';
import { createCandidateVersusHost } from '../content-design/versus-host.mjs';
import { createContentExecutionCatalog } from '../content-design/execution.mjs';
import { soloCompatibleMusicContext } from '../couch/couch-music-context.mjs';

const { themes } = JSON.parse(
  await readFile(new URL('../content-design/themes.json', import.meta.url)),
);
test('all authored Versus presets share exact Solo music assignment identity without changing the execution', () => {
  const source = createOpeningCandidates({ artwork: true });
  const solo = createContentExecutionCatalog(source);
  const versus = createCandidateVersusHost(source, { themes });
  assert.equal(versus.rows.length, 30);
  for (const row of versus.rows) {
    const entry = solo.select(row.mission.packId, row.mission.campaignId, row.difficulty);
    const context = soloCompatibleMusicContext({
      campaignKey: row.musicCampaignKey,
      level: row.level,
      themeId: row.defaultThemeId,
    });
    assert.equal(row.musicCampaignKey, entry.baseCampaignKey);
    assert.equal(row.executionKey, entry.executionKey);
    assert.deepEqual(context, {
      campaignKey: entry.baseCampaignKey,
      mapKey: JSON.stringify([
        entry.baseCampaignKey,
        row.level.id,
        row.level.revision,
        row.defaultThemeId,
      ]),
      themeId: row.defaultThemeId,
    });
  }
});

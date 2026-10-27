import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { retryFixture } from './retry-scenarios.mjs';
import { preparePack, resolvePackCampaign } from '../../packs.mjs';
import { campaignKey } from '../../library.mjs';
import { createRun } from '../../core/index.mjs';
import { createDuel } from '../../multiplayer.mjs';
import { normalizedLevel } from '../../core/level.mjs';
import { versionsForLevel } from '../../core/versions.mjs';
import { arcadeActionCapabilities } from '../../core/arcade-actions.mjs';
import { CAMPAIGN_DIFFICULTIES, createDifficultyContext } from '../../campaign-difficulty.mjs';
import { preparedPackIdentity } from '../../mission-library/pack-identity.mjs';
import { prepareMissionLibraryIndex } from '../../mission-library/classic-source.mjs';
import { INCLUDED_BUNDLED_PACK_MAX_BYTES } from '../../mission-library/included-bundled-pack.mjs';

/** A new procedural chapter for the included-content test branch. This is not
 * a stripped or renamed copy of a shipped artwork-bearing chapter. All runtime
 * and browsing identities below derive from these actual validated test bytes. */
export async function includedChapterFixture() {
  const themes = JSON.parse(
    await readFile(new URL('../../content/themes.json', import.meta.url), 'utf8'),
  ).themes;
  const classes = JSON.parse(
    await readFile(new URL('../../content/classes.json', import.meta.url), 'utf8'),
  );
  const theme = themes.find((row) => row.id === 'retro');
  assert.ok(theme, 'The fixture uses an existing procedural theme.');
  const levels = Array.from({ length: 3 }, (_, index) => ({
    ...retryFixture('self-contact').level,
    id: `included-fixture-${index + 1}`,
    name: `Included fixture ${index + 1}`,
  }));
  const source = {
    format: 'xonix-pack.v1',
    id: 'library-included-fixture',
    version: '1.0.0',
    name: 'Included fixture chapter',
    description: 'Procedural three-mission host test fixture, not shipped content.',
    engine: 'xonix-core.v2',
    dependencies: [],
    music: [],
    visualOverrides: {},
    levelVisuals: [],
    themes: [structuredClone(theme)],
    classRecipes: classes,
    campaigns: [
      {
        version: 'xonix-campaign.v1',
        id: 'library-included-fixture',
        revision: '1',
        title: 'Included fixture campaign',
        themeId: theme.id,
        levels,
      },
    ],
  };
  const bytes = Buffer.from(JSON.stringify(source));
  assert.ok(bytes.length > 0 && bytes.length <= INCLUDED_BUNDLED_PACK_MAX_BYTES);
  const { pack } = await preparePack(source);
  const packIdentity = await preparedPackIdentity(pack);
  const entry = resolvePackCampaign(pack, source.campaigns[0].id);
  const campaign = entry.campaign,
    key = campaignKey(campaign);
  const path = `game/content/packs/${pack.id}.json`;
  const sourceFile = {
    path,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
  const difficulties = CAMPAIGN_DIFFICULTIES.filter((preset) => {
    try {
      createDifficultyContext(campaign, preset);
      return true;
    } catch {
      return false;
    }
  });
  assert.ok(difficulties.includes('standard'));
  const rows = campaign.levels.map((level, levelIndex) => {
    const options = { classRecipes: entry.classRecipes, classId: entry.classRecipes[0].id };
    createRun(level, options);
    createDuel(level, options);
    const actual = normalizedLevel(level),
      arcade = !arcadeActionCapabilities(level).manualAbility;
    return {
      id: ['classic', 'bundled', pack.id, key, level.id, level.revision]
        .map(encodeURIComponent)
        .join('/'),
      source: 'bundled',
      packId: pack.id,
      packVersion: pack.version,
      packIdentity,
      campaignId: campaign.id,
      campaignRevision: campaign.revision,
      campaignKey: key,
      levelId: level.id,
      levelRevision: level.revision,
      levelIndex,
      name: level.name,
      campaignTitle: campaign.title,
      edition: pack.name,
      themeId: theme.id,
      modes: ['solo', 'versus'],
      tags: ['Classic', ...(arcade ? ['Arcade'] : [])],
      rules: `${actual.goal.coverage * 100}% coverage · ${actual.rules.lives} lives · ${actual.rules.moveSpeed} cells/s`,
      ruleDetails: {
        ruleset: versionsForLevel(level).ruleset,
        coverage: actual.goal.coverage,
        lives: actual.rules.lives,
        moveSpeed: actual.rules.moveSpeed,
        timeLimitSeconds: actual.rules.timeLimitSeconds || 0,
        enemies: [...new Set(actual.enemies.map((enemy) => enemy.type))].map((type) => ({
          type,
          count: actual.enemies.filter((enemy) => enemy.type === type).length,
        })),
        requiredObjectives: actual.objectives.filter((objective) => objective.required).length,
      },
      difficultiesByMode: { solo: difficulties, versus: ['standard'] },
      sourceFile,
    };
  });
  prepareMissionLibraryIndex({ format: 'revealline-mission-library-index.v1', missions: rows });
  const catalogEntry = {
    id: pack.id,
    path: `${pack.id}.json`,
    name: pack.name,
    campaigns: [
      {
        id: campaign.id,
        revision: campaign.revision,
        title: campaign.title,
        levels: campaign.levels.map((level) => ({ id: level.id, name: level.name })),
      },
    ],
  };
  return { source, bytes, pack, rows, catalogEntry, fetchPath: `content/packs/${pack.id}.json` };
}

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { getLocale, setLocale, t } from '../i18n/index.mjs';
import { contentText } from '../i18n/content.mjs';
import { dataIdentity } from '../data-json.mjs';
import * as current from '../gameplay-tuning.mjs';
import * as v1 from '../gameplay-tuning-v1.mjs';
import * as v2 from '../gameplay-tuning-v2.mjs';
import * as v3 from '../gameplay-tuning-v3.mjs';
import { journeyPreset } from '../content-design/catalogs.mjs';
import { journeyActorThemeCandidates } from '../presentation/journey-actor-materials.mjs';
import {
  gameplayTuningDescription,
  gameplayDifficultyLabel,
  journeyPresetDescription,
  activeJourneyRules,
} from '../ui/gameplay-copy.mjs';

test('localized tuning preserves every historical English description and recipe identity', (context) => {
  const locale = getLocale();
  context.after(() => setLocale(locale));
  for (const module of [v1, v2, v3, current]) {
    for (const difficulty of ['gentle', 'standard', 'expert']) {
      const recipe = module.resolveGameplayTuning(difficulty);
      const identity = dataIdentity(recipe);
      setLocale('en');
      assert.equal(gameplayTuningDescription(recipe), current.gameplayTuningDescription(recipe));
      setLocale('uk');
      const ukrainian = gameplayTuningDescription(recipe);
      assert.match(ukrainian, /швидкість|Цільовий темп/);
      assert.doesNotMatch(ukrainian, /enemy|craft|Authored|undefined|tuning\./);
      assert.equal(dataIdentity(recipe), identity);
      assert.notEqual(gameplayDifficultyLabel(difficulty), difficulty);
    }
  }
});

test('live HUD plurals and mission summaries cover Ukrainian count categories', (context) => {
  const locale = getLocale();
  context.after(() => setLocale(locale));
  setLocale('uk');
  for (const count of [0, 1, 2, 5, 11, 21, 22, 1.5]) {
    const expected =
      Number.isInteger(count) &&
      (count % 10 === 0 || count % 10 >= 5 || (count % 100 >= 11 && count % 100 <= 14))
        ? 'життів'
        : 'життя';
    assert.equal(
      t('gameplay:hud.lives', { count }),
      `${new Intl.NumberFormat('uk').format(count)} ${expected}`,
    );
    assert.match(
      t('interface:solo.campaignLibraryComplete', {
        campaign: 'Моя кампанія',
        count,
        total: 22,
      }),
      count === 1 ? /1 місію/ : [2, 22].includes(count) ? /місії/ : /місій|місії/,
    );
  }
  const preset = journeyPreset('standard');
  assert.match(journeyPresetDescription(preset, 'gameplay-pressure.v4'), /3 життя в місії/);
  assert.match(journeyPresetDescription(preset, 'gameplay-pressure.v1'), /Три життя/);
  const run = { level: { rules: { lives: 5, timeLimitSeconds: 25 } } };
  const before = JSON.stringify(run);
  assert.match(
    activeJourneyRules(run, preset, 'gameplay-pressure.v4'),
    /5 початкових життів; ліміт часу — 25 с/,
  );
  assert.equal(JSON.stringify(run), before);
});

test('Journey source and actor-theme labels translate only for exact registered content', async (context) => {
  const locale = getLocale();
  context.after(() => setLocale(locale));
  const { themes } = JSON.parse(
    await fs.readFile(new URL('../content-design/themes.json', import.meta.url)),
  );
  setLocale('uk');
  for (const theme of [...themes, ...journeyActorThemeCandidates(themes)]) {
    assert.equal(contentText(theme, 'labels.currency'), 'Очки');
    assert.notEqual(contentText(theme, 'subtitle'), theme.subtitle);
    const custom = { ...theme, name: 'My theme' };
    assert.equal(contentText(custom, 'labels.currency'), theme.labels.currency);
    assert.equal(contentText(custom, 'name'), 'My theme');
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CURRICULUM_CAMPAIGNS } from '../company-campaigns/curriculum.mjs';
import { createCurriculumLocalization } from '../company-campaigns/curriculum-localization.mjs';
import {
  createCampaignLocalization,
  validateCampaignLocalization,
} from '../editions/localization.mjs';
import { createRewardMissionBindings } from '../rewards/bindings.mjs';

const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const fields = [
  'name',
  'design.lesson',
  'design.routeDecision',
  'design.counterplay',
  'design.captureConsequence',
  'design.memorableMoment',
  'design.mastery',
];

test('all 108 mission detail sidecars provide exact English and authored Ukrainian without changing gameplay', async () => {
  let count = 0;
  for (const definition of CURRICULUM_CAMPAIGNS) {
    const source = await json(`../content/company-campaigns/${definition.id}.json`);
    const before = JSON.stringify(source),
      bindings = createRewardMissionBindings(source);
    const localized = createCurriculumLocalization({ definition, source });
    assert.deepEqual(
      validateCampaignLocalization(localized, source, source.campaigns[0]),
      localized,
    );
    for (const record of localized.records.filter(({ kind }) => kind === 'mission')) {
      assert.deepEqual(Object.keys(record.fields).sort(), [...fields].sort());
      for (const [field, text] of Object.entries(record.fields)) {
        assert.notEqual(text.uk, text.en, `${record.id} ${field} must be translated`);
        assert.match(text.uk, /[а-яіїєґ]/iu);
        assert.ok(text.uk.length <= 2048);
      }
      count++;
    }
    assert.equal(JSON.stringify(source), before);
    assert.deepEqual(createRewardMissionBindings(source), bindings);
  }
  assert.equal(count, 108);
});

test('localization helper preserves legacy minimal fields and rejects stale optional source pins', async () => {
  const definition = CURRICULUM_CAMPAIGNS[0];
  const source = await json(`../content/company-campaigns/${definition.id}.json`);
  const missionLocales = Object.fromEntries(
    source.missions.map((mission) => [
      mission.id,
      {
        uk: { name: 'Місія', brief: 'Пояснення', routeDecision: 'Вибір маршруту' },
      },
    ]),
  );
  const legacy = createCampaignLocalization({
    source,
    campaignId: definition.id,
    campaignLocales: definition.locales,
    missionLocales,
  });
  assert.equal(Object.keys(legacy.records[1].fields).length, 3);
  missionLocales[source.missions[0].id].uk.mastery = 'Завершіть без втрати життя.';
  const expanded = createCampaignLocalization({
    source,
    campaignId: definition.id,
    campaignLocales: definition.locales,
    missionLocales,
  });
  assert.equal(Object.keys(expanded.records[1].fields).length, 4);
  const altered = structuredClone(expanded);
  altered.records[1].fields['design.mastery'].en = 'Unrelated gameplay advice';
  assert.throws(
    () => validateCampaignLocalization(altered, source, source.campaigns[0]),
    /exact English/,
  );
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { getLocale, setLocale, t } from '../i18n/index.mjs';
import { resultContinuationLabel } from '../ui/result-continuation.mjs';

test('known result destinations name a mission or campaign and endings browse', () => {
  const translate = (key, values = {}) =>
    ({
      'interface:browseMissions': 'Browse missions',
      'interface:browseMissions2': 'Browse missions →',
      'interface:nextMission2': 'Next mission',
      'interface:nextMissionNamed': `Next: ${values.mission}`,
      'interface:nextCampaignNamed': `Next campaign: ${values.campaign}`,
    })[key];
  assert.equal(
    resultContinuationLabel(translate, { mission: 'Relay Orchard' }),
    'Next: Relay Orchard',
  );
  assert.equal(
    resultContinuationLabel(translate, {
      mission: 'Behind the patrol',
      campaign: 'Border Bloom',
      crossesCampaign: true,
    }),
    'Next campaign: Border Bloom',
  );
  assert.equal(resultContinuationLabel(translate, { browse: true }), 'Browse missions');
  assert.equal(
    resultContinuationLabel(translate, {
      browse: true,
      browseKey: 'interface:browseMissions2',
    }),
    'Browse missions →',
  );
});

test('an unresolved catalogue successor stays generic and Ukrainian interpolation is complete', (tContext) => {
  const original = getLocale();
  tContext.after(() => setLocale(original, { persist: false }));
  setLocale('uk', { persist: false });
  assert.equal(resultContinuationLabel(t), 'Наступна місія');
  assert.equal(resultContinuationLabel(t, { mission: 'Сад естафет' }), 'Далі: Сад естафет');
  assert.equal(
    resultContinuationLabel(t, {
      mission: 'За патрулем',
      campaign: 'Квітучий кордон',
      crossesCampaign: true,
    }),
    'Наступна кампанія: Квітучий кордон',
  );
  assert.doesNotMatch(
    resultContinuationLabel(t, {
      mission: 'За патрулем',
      campaign: 'Квітучий кордон',
      crossesCampaign: true,
    }),
    /undefined|\{\{/u,
  );
});

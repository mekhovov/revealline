import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAuthoredJourneyRoute } from '../content-design/route-loader.mjs';
import { contentText } from '../i18n/content.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

test('optional cultural pressure triptych resolves all owned presentation text in Ukrainian', async () => {
  const previousLocale = getLocale();
  const route = await loadAuthoredJourneyRoute('whole-spatial-v34');
  const owned = route.source.missions.filter(
    (mission) => mission.design?.routeDecision && mission.design?.mastery,
  );

  setLocale('uk', { persist: false });
  assert.equal(
    contentText(route, 'label'),
    'Повна подорож · український триптих просторового тиску · баланс очікує перевірки',
  );
  assert.equal(
    contentText(route.source, 'name'),
    'Повна подорож · український триптих просторового тиску',
  );
  for (const mission of owned) {
    assert.notEqual(contentText(mission.design, 'routeDecision'), mission.design.routeDecision);
    assert.notEqual(contentText(mission.design, 'mastery'), mission.design.mastery);
  }
  assert.match(
    contentText(owned.find((mission) => mission.id === 'garden-refuges').design, 'routeDecision'),
    /ажурну скобу/,
  );

  setLocale('en', { persist: false });
  for (const mission of owned) {
    assert.equal(contentText(mission.design, 'routeDecision'), mission.design.routeDecision);
    assert.equal(contentText(mission.design, 'mastery'), mission.design.mastery);
  }
  setLocale(previousLocale, { persist: false });
});

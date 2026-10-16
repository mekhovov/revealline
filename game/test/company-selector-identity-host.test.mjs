import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { campaignKey, loadLibrary } from '../library.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { retryFixture } from './fixtures/retry-scenarios.mjs';

const classes = JSON.parse(readFileSync(new URL('../content/classes.json', import.meta.url)));

test('mission selector repaint uses the adopted base identity after a real win and difficulty/locale changes', async (t) => {
  const locale = getLocale();
  t.after(() => setLocale(locale, { persist: false }));
  setLocale('en', { persist: false });
  const source = {
    version: 'xonix-campaign.v1',
    id: 'selector-identity',
    revision: '1',
    title: 'Selector identity',
    classRecipes: classes,
    levels: Array.from({ length: 3 }, (_, index) => ({
      ...retryFixture('self-contact').level,
      id: `selector-${index + 1}`,
      name: `Selector mission ${index + 1}`,
      goal: { coverage: 0.1 },
      rules: { lives: 3 },
    })),
  };
  const baseKey = campaignKey(source);
  const page = await soloPage(t, {
    fetchResponse(path) {
      if (path === 'content/campaign.json') return { ok: true, json: async () => source };
    },
  });
  const cards = () => [...page.$('missions').children];
  const available = () => cards().map((card) => !card.disabled);
  assert.deepEqual(available(), [true, false, false]);
  assert.deepEqual(
    cards().map((card) => card.dataset.pictureState),
    ['concealed', 'concealed', 'concealed'],
  );
  assert.equal(page.$('pack-select').value, '');
  assert.equal(page.$('campaign-select').value, baseKey);

  const levels = source.levels;
  let selectorGeometryReads = 0;
  source.levels = new Proxy(levels, {
    get(target, property, receiver) {
      if (property === 'map' && new Error().stack.includes('refreshContentSelectors'))
        selectorGeometryReads++;
      return Reflect.get(target, property, receiver);
    },
  });
  t.after(() => {
    source.levels = levels;
  });
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.key('ArrowDown');
  // The same accepted fixed-step cut earns the first picture and opens mission 2.
  for (let frame = 0; frame < 225 && page.rendered.run.status === 'running'; frame++)
    page.frame(1000 / 30);
  page.key('ArrowDown', false);
  assert.equal(page.rendered.run.status, 'won');
  assert.deepEqual(available(), [true, true, false]);
  assert.match(cards()[0].querySelector('.medal').textContent, /^★+$/);
  assert.equal(cards()[2].dataset.pictureState, 'concealed');
  assert.equal(page.$('pack-select').value, '');
  const profile = loadLibrary(page.storage, 'revealline.library.dev.v1').library;
  assert.deepEqual(Object.keys(profile.campaigns[baseKey].clears), ['selector-1']);
  const checkpoint = authoritativeCheckpoint(page.rendered.run);
  page.change('difficulty-select', 'gentle');
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.deepEqual(available(), [true, true, false]);
  assert.equal(page.$('pack-select').value, '');

  const englishLabel = page.$('pack-select').options[0].textContent;
  setLocale('uk', { persist: false });
  assert.notEqual(page.$('pack-select').options[0].textContent, englishLabel);
  assert.deepEqual(available(), [true, true, false]);
  assert.equal(page.$('campaign-select').value, baseKey);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  setLocale('en', { persist: false });
  assert.equal(page.$('pack-select').options[0].textContent, englishLabel);
  cards()[1].click();
  await settle(
    () =>
      page.$('level-select').value === 'selector-2' &&
      page.doc.body.dataset.pictureState === 'ready',
  );
  page.frame(0);
  assert.equal(page.rendered.run.levelId, 'selector-2');
  assert.equal(page.$('difficulty-select').value, 'gentle');
  assert.equal(page.$('pack-select').value, '', 'Gentle still belongs to the same base chapter.');
  assert.equal(cards()[0].querySelector('.medal').textContent, '✓');
  assert.deepEqual(available(), [true, true, false]);
  assert.deepEqual(
    [...page.$('level-select').options].map((option) => !option.disabled),
    [true, true, false],
  );
  assert.equal(cards()[2].dataset.pictureState, 'concealed');
  assert.equal(selectorGeometryReads, 0, 'Selector painting must not renormalize the raw base.');
  assert.deepEqual(page.errors, []);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { contentText } from '../i18n/content.mjs';
import { setLocale } from '../i18n/index.mjs';
import { dataIdentity } from '../data-json.mjs';

const scripts = await Promise.all([
  '../vendor/i18next-26.4.2.min.js', '../i18n/catalogs.mjs', '../i18n/bootstrap.mjs',
].map(file => fs.readFile(new URL(file, import.meta.url), 'utf8')));
const key = 'revealline.locale.v1';
function runtime({ saved, languages, language, blocked = false } = {}) {
  const values = new Map(saved === undefined ? [] : [[key, saved]]);
  const events = new Map();
  const context = vm.createContext({
    Intl, console, WeakRef, navigator: { languages, language },
    localStorage: {
      getItem: name => { if (blocked) throw Error('Blocked'); return values.get(name) ?? null; },
      setItem: (name, value) => { if (blocked) throw Error('Blocked'); values.set(name, value); },
    },
    addEventListener: (name, callback) => events.set(name, callback),
  });
  for (const source of scripts) vm.runInContext(source, context);
  return { api: context.RevealLineI18n, values, events };
}

test('locale resolution respects saved choices, ordered preferences and regional tags', () => {
  for (const [options, expected] of [
    [{ languages: ['de-DE', 'uk-UA', 'en-GB'] }, 'uk'],
    [{ languages: ['en-GB', 'uk-UA'] }, 'en'],
    [{ languages: ['bad_tag', 'fr'], language: 'UK-ua' }, 'uk'],
    [{ languages: [], language: 'uk' }, 'uk'],
    [{ languages: ['ru', 'de'], language: 'zz' }, 'en'],
    [{ saved: 'uk', languages: ['en'] }, 'uk'],
    [{ saved: 'en', languages: ['uk'] }, 'en'],
    [{ saved: 'uk-UA', languages: ['en'] }, 'en'],
    [{ saved: '__proto__', languages: ['uk'] }, 'uk'],
    [{ saved: '', languages: [null, 42] }, 'en'],
  ]) assert.equal(runtime(options).api.getLocale(), expected);
});

test('automatic detection is not persisted; explicit choice survives restart and storage failure', () => {
  const first = runtime({ languages: ['uk-UA'] });
  assert.equal(first.values.has(key), false);
  first.api.setLocale('en');
  assert.equal(first.values.get(key), 'en');
  assert.equal(runtime({ saved: first.values.get(key), languages: ['uk'] }).api.getLocale(), 'en');
  first.events.get('languagechange')();
  assert.equal(first.api.getLocale(), 'en');
  const blocked = runtime({ blocked: true });
  assert.equal(blocked.api.setLocale('uk').saved, false);
  assert.equal(blocked.api.t('common:language.label'), 'Мова');
  assert.throws(() => blocked.api.setLocale('ru'), /Unsupported/);
});

test('cross-tab changes update language only and ignore game-save storage events', () => {
  const { api, events, values } = runtime();
  let changes = 0;
  const unsubscribe = api.onLocaleChange(() => changes++);
  values.set(key, 'uk');
  events.get('storage')({ key });
  assert.equal(api.getLocale(), 'uk');
  events.get('storage')({ key: 'xonix-player-library.v1' });
  assert.equal(changes, 1);
  values.delete(key);
  events.get('storage')({ key });
  assert.equal(api.getLocale(), 'en');
  unsubscribe();
  api.setLocale('uk');
  assert.equal(changes, 2);
});

test('Ukrainian plural rules include zero, teens, compound counts and decimals', () => {
  const { api } = runtime({ saved: 'uk' });
  for (const [count, expected] of [[0, '0 рівнів'], [1, '1 рівень'], [2, '2 рівні'], [5, '5 рівнів'], [11, '11 рівнів'], [21, '21 рівень'], [22, '22 рівні'], [1.5, '1,5 рівня']])
    assert.equal(api.t('common:counts.levels', { count }), expected);
});

test('text and attribute bindings update in place without touching editor or flight state', () => {
  const { api } = runtime();
  const node = { textContent: '', value: 'Unsaved title', selectionStart: 3, scrollTop: 14, attributes: {}, getAttribute(name) { return this.attributes[name]; }, setAttribute(name, value) { this.attributes[name] = value; } };
  const flight = { paused: true, tick: 129, inputs: [1, 2, 3] };
  const before = structuredClone(flight);
  api.localizedText(node, () => api.t('common:actions.pause'));
  api.localizedAttribute(node, 'aria-label', () => api.t('common:language.label'));
  api.setLocale('uk');
  assert.equal(node.textContent, 'Пауза');
  assert.equal(node.attributes['aria-label'], 'Мова');
  assert.equal(node.value, 'Unsaved title');
  assert.equal(node.selectionStart, 3);
  assert.equal(node.scrollTop, 14);
  assert.deepEqual(flight, before);
});

test('content uses exact identity and field; edited imports retain authored text and hashes', async () => {
  const campaign = JSON.parse(await fs.readFile(new URL('../content/campaign.json', import.meta.url)));
  const before = dataIdentity(campaign);
  setLocale('uk', { persist: false });
  try {
    assert.equal(contentText(campaign, 'title'), 'Перший сигнал');
    assert.equal(contentText(campaign.levels[1], 'name'), 'Сад ретрансляторів');
    const edited = structuredClone(campaign.levels[1]);
    edited.rules.lives += 1;
    assert.equal(contentText(edited, 'name'), 'Relay Orchard');
    edited.name = 'My own map';
    assert.equal(contentText(edited, 'name'), 'My own map');
    assert.equal(dataIdentity(campaign), before);
  } finally { setLocale('en', { persist: false }); }
});

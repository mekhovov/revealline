import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext, runInNewContext } from 'node:vm';
import { pathToFileURL } from 'node:url';
import { mainEntryLocale, applyMainEntryLocale } from '../i18n/main-entry-locale.mjs';

// The override supports an isolated proposal; normal repository execution needs none.
const root = process.env.PRACTICE_LOCALE_TEST_ROOT
  ? pathToFileURL(`${process.env.PRACTICE_LOCALE_TEST_ROOT}/`)
  : new URL('../../', import.meta.url);
const { PRACTICE_DIRECTORY_SCRIPT } = await import(
  new URL('publishing/practice-directory.mjs', root)
);
const { Document } = await import(new URL('game/test/helpers/couch-dom.mjs', root));
const scripts = await Promise.all(
  ['vendor/i18next-26.4.2.min.js', 'i18n/catalogs.mjs', 'i18n/bootstrap.mjs'].map((file) =>
    readFile(new URL(`game/${file}`, root), 'utf8'),
  ),
);
const key = 'revealline.locale.v1';
function runtime(saved) {
  const values = new Map(saved === null ? [] : [[key, saved]]);
  const document = new Document();
  const context = createContext({
    Intl,
    WeakRef,
    document,
    navigator: { languages: ['en-US'] },
    localStorage: {
      getItem: (name) => values.get(name) ?? null,
      setItem: (name, value) => values.set(name, value),
    },
    addEventListener() {},
  });
  for (const script of scripts) runInContext(script, context);
  return { api: context.RevealLineI18n, document, values };
}
function directoryReturn(locale) {
  const link = { href: 'https://example.test/revealline/game/' };
  const select = {};
  runInNewContext(PRACTICE_DIRECTORY_SCRIPT, {
    document: {
      hidden: true,
      documentElement: {},
      getElementById: () => select,
      querySelectorAll: (selector) => (selector === '[data-launch], [data-locale]' ? [link] : []),
    },
    location: { href: 'https://example.test/revealline/practice/' },
    URL,
    addEventListener() {},
    setTimeout() {},
  });
  select.value = locale;
  select.onchange();
  return new URL(link.href).search;
}

test('only one exact supported language intent is accepted', () => {
  for (const [search, expected] of [
    ['?lang=en', 'en'],
    ['?lang=uk&other=value', 'uk'],
    ['?lang=%75k', 'uk'],
    ['', null],
    ['?other=uk', null],
    ['?lang=', null],
    ['?lang=UK', null],
    ['?lang=uk-UA', null],
    ['?lang=ru', null],
    ['?lang=uk&lang=uk', null],
    ['?lang=uk&lang=en', null],
    ['?lang=en&%6cang=uk', null],
    ['?lang=%FF', null],
    ['lang=uk', null],
    [null, null],
    [undefined, null],
  ])
    assert.equal(mainEntryLocale(search), expected, String(search));
});

for (const [saved, selected] of [
  ['en', 'uk'],
  ['uk', 'en'],
  [null, 'uk'],
]) {
  test(`real standalone directory return selects ${selected} without overwriting ${saved}`, () => {
    const { api, document, values } = runtime(saved);
    const search = directoryReturn(selected);
    assert.equal(applyMainEntryLocale(search, api.setLocale), selected);
    assert.equal(api.getLocale(), selected);
    assert.equal(document.documentElement.lang, selected);
    assert.equal(values.get(key) ?? null, saved);
    assert.equal(runtime(saved).api.getLocale(), saved ?? 'en');
  });
}

test('absent, invalid and duplicate intents keep the actual saved preference untouched', () => {
  for (const saved of ['en', 'uk']) {
    for (const search of ['', '?lang=ru', '?lang=', '?lang=uk&lang=en', '?lang=uk&lang=uk']) {
      const { api, values } = runtime(saved);
      assert.equal(applyMainEntryLocale(search, api.setLocale), null);
      assert.equal(api.getLocale(), saved);
      assert.equal(values.get(key), saved);
    }
  }
});

test('ordinary maintained language control still persists a subsequent user selection', () => {
  const { api, document, values } = runtime('en');
  applyMainEntryLocale('?lang=uk', api.setLocale);
  const mount = document.createElement('div');
  mount.setAttribute('data-language-control', '');
  document.body.append(mount);
  api.attachLanguageControls(document);
  const select = mount.querySelector('[data-language-select]');
  assert.equal(select.value, 'uk');
  select.value = 'en';
  select.emit('change');
  assert.equal(api.getLocale(), 'en');
  assert.equal(values.get(key), 'en');
  select.value = 'uk';
  select.emit('change');
  assert.equal(values.get(key), 'uk');
  assert.equal(runtime(values.get(key)).api.getLocale(), 'uk');
});

test('main entry applies intent before other app dependencies, without changing global bootstrap', async () => {
  const entry = await readFile(new URL('../i18n/main-entry.mjs', import.meta.url), 'utf8');
  assert.match(entry, /import \{ setLocale \} from '\.\/index\.mjs'/);
  assert.match(entry, /applyMainEntryLocale\(globalThis\.location\?\.search, setLocale\)/);
  const app = await readFile(new URL('game/app.mjs', root), 'utf8');
  assert.ok(app.startsWith("import './i18n/main-entry.mjs';\n"));
  assert.doesNotMatch(scripts[2], /main-entry|searchParams/);
});

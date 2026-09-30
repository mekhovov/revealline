import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'parse5';
import {
  readPracticePresentation,
  readPracticeRemainsOverride,
} from '../ui/practice-presentation.mjs';
import { getLocale, setLocale, translateDOM } from '../i18n/index.mjs';
import { Document } from './helpers/couch-dom.mjs';

test('only one exact, explicitly owned practice query may hide remains', () => {
  const search = '?practice=1&revision=studio-7&preview-remains=hide';
  assert.deepEqual(readPracticePresentation(search, { practice: true }), {
    showCombatScrap: false,
  });
  for (const practice of [undefined, false, 1, '1'])
    assert.deepEqual(readPracticePresentation(search, { practice }), { showCombatScrap: true });
  assert.deepEqual(readPracticePresentation(search), { showCombatScrap: true });
});

test('missing, malformed, unknown and duplicate options retain the usual presentation', () => {
  for (const search of [
    '',
    '?preview-remains=hide',
    '?practice=true&preview-remains=hide',
    '?practice=01&preview-remains=hide',
    '?practice=1&practice=1&preview-remains=hide',
    '?practice=1&practice=0&preview-remains=hide',
    '?practice=1',
    '?practice=1&preview-remains=',
    '?practice=1&preview-remains=show',
    '?practice=1&preview-remains=HIDE',
    '?practice=1&preview-remains=hide%20',
    '?practice=1&preview-remains=hide&preview-remains=hide',
    '?practice=1&preview-remains=hide&preview-remains=show',
    '?practice=1&preview-remains=%E0%A4%A',
  ])
    assert.deepEqual(
      readPracticePresentation(search, { practice: true }),
      { showCombatScrap: true },
      search,
    );
});

test('reading cosmetic options leaves the query unchanged and returns an immutable choice', () => {
  const query = new URLSearchParams('practice=1&preview-remains=hide');
  const before = query.toString();
  const result = readPracticePresentation(query, { practice: true });
  assert.equal(query.toString(), before);
  assert.equal(Object.isFrozen(result), true);
  assert.throws(() => {
    result.showCombatScrap = true;
  }, TypeError);
  assert.deepEqual(readPracticePresentation('?practice=1', { practice: true }), {
    showCombatScrap: true,
  });
  assert.equal(Object.isFrozen(readPracticePresentation('')), true);
});

test('actual Studio remains control has a native label and translates through the runtime catalog without changing selection', async () => {
  const html = parse(await readFile(new URL('../studio/index.html', import.meta.url), 'utf8'));
  const descendants = (node) => [node, ...(node.childNodes ?? []).flatMap(descendants)];
  const source = descendants(html).find((node) =>
    node.attrs?.some((attr) => attr.name === 'id' && attr.value === 'preview-remains-options'),
  );
  assert(source);
  const doc = new Document();
  function mount(node) {
    const element = doc.createElement(node.tagName);
    for (const { name, value } of node.attrs) {
      element.setAttribute(name, value);
      if (name === 'type') element.type = value;
      if (['hidden', 'disabled', 'checked'].includes(name)) element[name] = true;
    }
    element.textContent = (node.childNodes ?? [])
      .filter((child) => child.nodeName === '#text')
      .map((child) => child.value)
      .join('');
    for (const child of node.childNodes ?? []) if (child.tagName) element.append(mount(child));
    return element;
  }
  const options = mount(source);
  doc.body.append(options);
  const checkbox = doc.getElementById('preview-show-remains'),
    caption = checkbox.parentElement.querySelector('[data-i18n]'),
    hint = doc.getElementById('preview-remains-hint');
  assert.equal(options.hidden, true);
  assert.equal(checkbox.disabled, true);
  assert.equal(checkbox.checked, true);
  assert.equal(checkbox.type, 'checkbox');
  assert.equal(checkbox.parentElement.tagName, 'LABEL');
  assert.equal(checkbox.getAttribute('aria-describedby'), hint.id);
  options.hidden = false;
  checkbox.disabled = false;
  checkbox.checked = false;
  checkbox.focus();
  const locale = getLocale();
  try {
    translateDOM(options);
    for (const language of ['en', 'uk', 'en']) {
      setLocale(language, { persist: false });
      assert.equal(
        caption.textContent,
        language === 'uk' ? 'Показувати уламки ворогів' : 'Show enemy remains',
      );
      assert.match(hint.textContent, language === 'uk' ? /лише|Лише/ : /next Solo preview/);
      assert.doesNotMatch(hint.textContent, /tools:|studio\.preview\./);
      assert.equal(checkbox.checked, false);
      assert.equal(checkbox.disabled, false);
      assert.equal(doc.activeElement, checkbox);
    }
  } finally {
    setLocale(locale, { persist: false });
  }
});

test('only explicit owned preview choices override global remains', () => {
  assert.equal(
    readPracticeRemainsOverride('?practice=1&preview-remains=hide', { practice: true }),
    false,
  );
  assert.equal(
    readPracticeRemainsOverride('?practice=1&preview-remains=show', { practice: true }),
    true,
  );
  for (const search of [
    '',
    '?practice=1',
    '?practice=1&preview-remains=',
    '?practice=1&preview-remains=show&preview-remains=hide',
  ])
    assert.equal(readPracticeRemainsOverride(search, { practice: true }), null);
  assert.equal(
    readPracticeRemainsOverride('?practice=1&preview-remains=show', { practice: false }),
    null,
  );
});

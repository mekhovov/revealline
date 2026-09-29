import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'parse5';
import { Document, Events } from './helpers/couch-dom.mjs';
import { attachEncounterDisplayControls } from '../ui/encounter-display-controls.mjs';
import { ENCOUNTER_DISPLAY_PREFERENCES_KEY } from '../encounter-display-preferences.mjs';
import { getLocale, setLocale, translateDOM } from '../i18n/index.mjs';

const pages = [
  { mode: 'Solo', path: '../index.html', prefix: '' },
  { mode: 'Versus', path: '../couch/index.html', prefix: 'race-' },
  { mode: 'Team', path: '../couch/relay-rescue.html', prefix: 'coop-' },
];
const encode = (showRemains) =>
  JSON.stringify({ format: 'EncounterDisplayPreferencesV1', showRemains });
const css = await readFile(new URL('../ui/settings.css', import.meta.url), 'utf8');
const copies = Object.fromEntries(
  await Promise.all(
    ['en', 'uk'].map(async (locale) => [
      locale,
      JSON.parse(await readFile(new URL(`../locales/${locale}/common.json`, import.meta.url))),
    ]),
  ),
);
const attr = (node, key) => node.attrs?.find(({ name }) => name === key)?.value;
function* walk(node) {
  yield node;
  for (const child of node.childNodes ?? []) yield* walk(child);
}
function mount(node, parent, document) {
  if (node.nodeName === '#text') {
    parent._text += node.value;
    return;
  }
  if (!node.tagName) return;
  const element = document.createElement(node.tagName);
  for (const { name, value } of node.attrs) {
    element.setAttribute(name, value);
    if (name === 'class') element.className = value;
    if (['type', 'value'].includes(name)) element[name] = value;
    if (['hidden', 'disabled', 'checked'].includes(name)) element[name] = true;
  }
  parent.append(element);
  for (const child of node.childNodes ?? []) mount(child, element, document);
}

// Actual shipped settings markup and helper; native CSS/focus layout is not
// simulated. The DOM boundary models events, ownership and label structure.
async function fixture(t, page = pages[0], { stored, writable = () => true } = {}) {
  const tree = parse(await readFile(new URL(page.path, import.meta.url), 'utf8'));
  const nodes = [...walk(tree)];
  const input = nodes.find((node) => attr(node, 'id') === `${page.prefix}enemy-remains`);
  assert.ok(input, `${page.mode} exposes the actual checkbox`);
  let panel = input;
  while (panel && !attr(panel, 'class')?.split(/\s+/).includes('shared-settings'))
    panel = panel.parentNode;
  assert.ok(panel, 'The checkbox belongs to the shared settings surface');
  const document = new Document();
  mount(panel, document.body, document);
  const window = new Events();
  const data = new Map(stored === undefined ? [] : [[ENCOUNTER_DISPLAY_PREFERENCES_KEY, stored]]);
  data.set('revealline.player', 'untouched player data');
  const writes = [];
  let failSave = false;
  const storage = {
    getItem: (key) => data.get(key) ?? null,
    setItem(key, value) {
      if (failSave) throw new Error('Storage denied');
      writes.push({ key, value });
      data.set(key, value);
    },
  };
  const checkbox = document.getElementById(`${page.prefix}enemy-remains`);
  const status = document.getElementById(`${page.prefix}enemy-remains-status`);
  const retry = document.getElementById(`${page.prefix}enemy-remains-retry`);
  const other = document.createElement('button');
  document.body.append(other);
  other.focus();
  const controls = attachEncounterDisplayControls({
    document,
    window,
    getStorage: () => storage,
    writable,
    prefix: page.prefix,
  });
  t.after(() => {
    controls.dispose();
    document.body.replaceChildren();
  });
  return {
    document,
    window,
    nodes,
    checkbox,
    status,
    retry,
    other,
    controls,
    data,
    writes,
    failSave(value) {
      failSave = value;
    },
    external(showRemains) {
      const value = encode(showRemains);
      data.set(ENCOUNTER_DISPLAY_PREFERENCES_KEY, value);
      window.emit('storage', {
        key: ENCOUNTER_DISPLAY_PREFERENCES_KEY,
        storageArea: storage,
        newValue: value,
      });
    },
  };
}

for (const page of pages)
  test(`${page.mode} uses a native labeled remains checkbox and shared touch target, with silent saved-choice synchronization`, async (t) => {
    const h = await fixture(t, page, { stored: encode(false) });
    const label = h.checkbox.parentElement;
    assert.equal(label.tagName, 'LABEL');
    assert.equal(h.checkbox.type, 'checkbox');
    assert.ok(label.classList.contains('settings-check'));
    assert.equal(
      label.querySelector('span').getAttribute('data-i18n'),
      'common:preferences.enemyRemains',
    );
    const hint = h.document.getElementById(h.checkbox.getAttribute('aria-describedby'));
    assert.equal(hint.getAttribute('data-i18n'), 'common:preferences.enemyRemainsHint');
    assert.equal(h.status.getAttribute('role'), 'status');
    assert.equal(h.retry.tagName, 'BUTTON');
    assert.equal(h.retry.type, 'button');
    assert.ok(
      h.nodes.some(
        (node) =>
          node.tagName === 'link' &&
          attr(node, 'rel') === 'stylesheet' &&
          new URL(
            attr(node, 'href') ?? attr(node, 'data-boot-href') ?? '',
            new URL(page.path, import.meta.url),
          ).href === new URL('../ui/settings.css', import.meta.url).href,
      ),
    );
    const targetRule = css.match(
      /\.shared-settings :is\([^)]*\.settings-check[^)]*\)[^{]*\{([^}]+)\}/,
    )?.[1];
    assert.ok(
      Number(targetRule?.match(/min-block-size:\s*(\d+)px/)?.[1]) >= 44,
      'The native label uses the actual shared minimum 44px target rule',
    );
    assert.equal(h.checkbox.checked, false);
    assert.equal(h.status.hidden, true);
    assert.equal(h.retry.hidden, true);
    assert.equal(h.document.activeElement, h.other);
    assert.deepEqual(h.writes, [], 'Mount reads the saved global choice without writing');
    h.external(true);
    assert.equal(h.checkbox.checked, true);
    assert.equal(h.controls.snapshot().showRemains, true);
    assert.equal(h.status.hidden, true);
    assert.equal(h.document.activeElement, h.other);
    h.checkbox.focus();
    h.checkbox.checked = false;
    h.checkbox.emit('change');
    assert.deepEqual(h.writes, [{ key: ENCOUNTER_DISPLAY_PREFERENCES_KEY, value: encode(false) }]);
    assert.equal(h.document.activeElement, h.checkbox);
    assert.equal(h.data.get('revealline.player'), 'untouched player data');
  });

test('failed persistence keeps the chosen view, updates EN/UK labels and status without moving focus, and retries explicitly', async (t) => {
  const locale = getLocale();
  t.after(() => setLocale(locale, { persist: false }));
  const h = await fixture(t, pages[1], { stored: encode(true) });
  h.failSave(true);
  h.checkbox.checked = false;
  h.checkbox.focus();
  h.checkbox.emit('change');
  for (const language of ['en', 'uk']) {
    setLocale(language, { persist: false });
    translateDOM(h.document.body);
    assert.equal(
      h.checkbox.parentElement.querySelector('span').textContent,
      copies[language]['preferences.enemyRemains'],
    );
    assert.equal(h.status.textContent, copies[language]['preferences.encounterSaveFailed']);
    assert.equal(h.retry.textContent, copies[language]['preferences.retryEncounterSave']);
    assert.equal(h.status.hidden, false);
    assert.equal(h.retry.hidden, false);
    assert.equal(h.document.activeElement, h.checkbox);
  }
  assert.equal(h.controls.snapshot().showRemains, false);
  assert.equal(h.data.get(ENCOUNTER_DISPLAY_PREFERENCES_KEY), encode(true));
  h.external(true);
  h.window.emit('pageshow', { persisted: true });
  assert.equal(
    h.checkbox.checked,
    false,
    'Pending user choice survives external saved data and BFCache refresh',
  );
  h.failSave(false);
  h.retry.click();
  assert.equal(h.data.get(ENCOUNTER_DISPLAY_PREFERENCES_KEY), encode(false));
  assert.equal(h.controls.snapshot().durable, true);
  assert.equal(h.status.textContent, '');
  assert.equal(h.status.hidden, true);
  assert.equal(h.retry.hidden, true);
  assert.equal(
    h.document.activeElement,
    h.checkbox,
    'Saving does not take focus from the current control',
  );
});

test('a session-only host localizes its warning and never offers a misleading persistence retry', async (t) => {
  const locale = getLocale();
  t.after(() => setLocale(locale, { persist: false }));
  const h = await fixture(t, pages[2], { stored: encode(true), writable: () => false });
  h.checkbox.checked = false;
  h.checkbox.emit('change');
  for (const language of ['en', 'uk']) {
    setLocale(language, { persist: false });
    assert.equal(h.status.textContent, copies[language]['preferences.encounterSessionOnly']);
    assert.equal(h.status.hidden, false);
    assert.equal(h.retry.hidden, true);
  }
  assert.deepEqual(h.writes, []);
  assert.equal(h.data.get(ENCOUNTER_DISPLAY_PREFERENCES_KEY), encode(true));
  assert.equal(h.document.activeElement, h.other);
  assert.equal(h.controls.snapshot().showRemains, false);
});

test('disposal removes control and storage owners; later gestures, restores and detached locale refresh cannot update the retired view', async (t) => {
  const locale = getLocale();
  t.after(() => setLocale(locale, { persist: false }));
  const h = await fixture(t);
  h.failSave(true);
  h.checkbox.checked = false;
  h.checkbox.emit('change');
  const before = h.controls.snapshot();
  const warning = h.status.textContent;
  h.controls.dispose();
  h.controls.dispose();
  assert.equal(h.checkbox.listeners.get('change')?.size ?? 0, 0);
  assert.equal(h.retry.listeners.get('click')?.size ?? 0, 0);
  assert.equal(h.window.listeners.get('storage')?.size ?? 0, 0);
  assert.equal(h.window.listeners.get('pageshow')?.size ?? 0, 0);
  h.checkbox.checked = true;
  h.checkbox.emit('change');
  h.failSave(false);
  h.retry.click();
  h.external(true);
  h.window.emit('pageshow', { persisted: true });
  h.document.body.replaceChildren();
  setLocale(locale === 'en' ? 'uk' : 'en', { persist: false });
  assert.equal(h.controls.snapshot(), before);
  assert.equal(h.status.textContent, warning);
  assert.deepEqual(h.writes, []);
});

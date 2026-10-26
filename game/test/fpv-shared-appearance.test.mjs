import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import { Document, Events } from './helpers/couch-dom.mjs';
import { createEnemyArtworkPreferences } from '../hunt/preferences.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { mountEnemyAppearanceControls } from '../ui/enemy-appearance-controls.mjs';
import { attachSimThemeFamilyControls } from '../../optional-practice/civilian-fpv/flight-fullscreen.mjs';
import { OPTIONAL_PACKAGE_POLICIES } from '../../publishing/optional-package-policy.mjs';

const settle = () => new Promise((resolve) => setImmediate(resolve));

test('projected theme and standalone appearance controls retain distinct accessible identities and lifecycles', async (t) => {
  const document = new Document(),
    themeRoot = document.createElement('section'),
    standaloneRoot = document.createElement('section'),
    preferences = createEnemyArtworkPreferences({
      window: new Events(),
      getStorage: () => null,
    }),
    calls = [],
    originalLocale = getLocale();
  document.body.append(themeRoot, standaloneRoot);
  setLocale('en', { persist: false });
  const state = {
    familyId: 'follow-game',
    arcadeArt: 'follow-game',
    ornaments: 'theme',
    highContrast: false,
    opaqueHud: false,
  };
  const theme = attachSimThemeFamilyControls({
    document,
    root: themeRoot,
    host: {
      availableThemeChoices: () => [],
      snapshot: () => state,
      getWarning: () => '',
      preferences: {
        snapshot: () => state,
        subscribe(listener) {
          listener(state);
          return () => {};
        },
      },
      subscribe: () => () => {},
      subscribeStatus: () => () => {},
      applyComplete: (id) => calls.push(['theme', id]),
      set: (value) => calls.push(['theme', value]),
    },
  });
  const standalone = mountEnemyAppearanceControls({
    document,
    container: standaloneRoot,
    preferences,
    locale: getLocale,
    applyMilitary: () => calls.push(['standalone', 'military']),
    applyAuthored: () => calls.push(['standalone', 'authored']),
  });
  t.after(() => {
    theme.dispose();
    standalone.dispose();
    preferences.dispose();
    setLocale(originalLocale, { persist: false });
  });
  const first = themeRoot.querySelector('[data-enemy-appearance]'),
    second = standaloneRoot.querySelector('[data-enemy-appearance]');
  assert.notEqual(first.id, second.id, 'The two shipped consumers must share the ID allocator.');
  for (const [root, select] of [
    [themeRoot, first],
    [standaloneRoot, second],
  ]) {
    const help = document.getElementById(select.getAttribute('aria-describedby'));
    assert.ok(root.contains(help), 'Each accessible description belongs to its own control.');
    assert.equal(document.getElementById(select.id), select);
    assert.match(root.textContent, /Enemy appearance preset/);
  }
  assert.deepEqual(calls, []);
  first.value = 'military';
  first.dispatchEvent({ type: 'change' });
  await settle();
  assert.deepEqual(calls, [['theme', 'military-field']]);
  assert.equal(second.value, 'authored', 'Injected preference owners remain independent.');
  second.value = 'military';
  second.dispatchEvent({ type: 'change' });
  await settle();
  assert.deepEqual(calls, [
    ['theme', 'military-field'],
    ['standalone', 'military'],
  ]);
  setLocale('uk', { persist: false });
  standalone.refresh();
  assert.match(themeRoot.textContent, /Набір оформлення ворогів/);
  assert.match(standaloneRoot.textContent, /Набір оформлення ворогів/);
  assert.equal(themeRoot.querySelector('[data-enemy-appearance]'), first);
  assert.equal(standaloneRoot.querySelector('[data-enemy-appearance]'), second);
  theme.dispose();
  first.value = 'authored';
  first.dispatchEvent({ type: 'change' });
  second.value = 'authored';
  second.dispatchEvent({ type: 'change' });
  await settle();
  assert.deepEqual(calls.at(-1), ['standalone', 'authored']);
  assert.equal(calls.length, 3, 'Disposing one owner does not detach the other or revive itself.');
  assert.equal(themeRoot.querySelector('[data-enemy-appearance]'), null);
  assert.equal(standaloneRoot.querySelector('[data-enemy-appearance]'), second);
});

test('the shared appearance import and its static dependencies stay inside every existing optional package closure', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url)),
    shell = 'optional-practice/civilian-fpv/flight-fullscreen.mjs',
    appearance = 'game/ui/enemy-appearance-controls.mjs',
    visited = new Set();
  const imports = async (file) => {
    const source = await readFile(path.join(root, file), 'utf8');
    return parse(source, { sourceType: 'module', ecmaVersion: 'latest' })
      .body.filter(
        (node) =>
          node.type === 'ImportDeclaration' ||
          node.type === 'ExportAllDeclaration' ||
          node.type === 'ExportNamedDeclaration',
      )
      .flatMap((node) =>
        node.source
          ? [path.posix.normalize(path.posix.join(path.posix.dirname(file), node.source.value))]
          : [],
      );
  };
  assert.ok((await imports(shell)).includes(appearance));
  async function visit(file) {
    if (visited.has(file)) return;
    visited.add(file);
    for (const dependency of await imports(file)) await visit(dependency);
  }
  await visit(appearance);
  for (const id of ['civilian-flight', 'civilian-fpv', 'fpv-worlds']) {
    const policy = OPTIONAL_PACKAGE_POLICIES[id],
      admitted = new Set([
        ...policy.sharedFiles,
        ...policy.localFiles.map((file) => policy.root + file),
      ]);
    assert.ok(admitted.has(shell), id);
    for (const dependency of visited) assert.ok(admitted.has(dependency), `${id}: ${dependency}`);
    for (const base of ['https://example.test/release/', 'file:///app/', 'capacitor://localhost/'])
      assert.equal(
        new URL('../../game/ui/enemy-appearance-controls.mjs', new URL(shell, base)).href,
        new URL(appearance, base).href,
      );
  }
});

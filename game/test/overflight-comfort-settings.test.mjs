import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { parse } from 'acorn';
import { Document } from './helpers/couch-dom.mjs';
import { createDisplayPreferences, DISPLAY_PREFERENCES_KEY } from '../display-preferences.mjs';
import { MENU_ANIMATION_KEY } from '../ui/menu-animation-preferences.mjs';
import { mountComfortPresets } from '../ui/comfort-presets.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

// Execute the actual Survival host's settings-provider call and teardown hook.
// This is its settings ownership boundary, not a mounted WebGL/flight test.
const source = await readFile(new URL('../overflight/app.mjs', import.meta.url), 'utf8'),
  ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' }),
  declaration = ast.body.find((node) =>
    node.declarations?.some((item) => item.id.name === 'comfortPresets'),
  ),
  cleanup = ast.body.find(
    (node) =>
      node.type === 'ExpressionStatement' &&
      node.expression.callee?.object?.name === 'cleanup' &&
      node.expression.arguments?.[0]?.body?.callee?.object?.name === 'comfortPresets',
  );
assert.ok(declaration && cleanup, 'The host owns the preset mount and its matching teardown.');

for (const locale of ['en', 'uk'])
  test(`Survival ${locale} source-wired settings retain display/menu intent through failure, Retry and teardown`, (t) => {
    const prior = getLocale();
    setLocale(locale, { persist: false });
    t.after(() => setLocale(prior, { persist: false }));
    const doc = new Document(),
      win = doc.defaultView,
      root = doc.createElement('section'),
      data = new Map(),
      cleanups = [],
      writes = [];
    root.id = 'overflight-menu-settings-panel-accessibility';
    doc.body.append(root);
    let working = false;
    win.localStorage = {
      getItem: (key) => data.get(key) ?? null,
      setItem(key, value) {
        writes.push([key, value]);
        if (!working) throw new DOMException('Modeled full storage', 'QuotaExceededError');
        data.set(key, value);
      },
    };
    const display = createDisplayPreferences({ window: win, getStorage: () => win.localStorage });
    t.after(() => display.dispose());
    runInNewContext(
      `${source.slice(declaration.start, declaration.end)}\n${source.slice(cleanup.start, cleanup.end)}`,
      {
        doc,
        win,
        display,
        settingsView: { panels: { accessibility: root } },
        mountComfortPresets,
        cleanup: cleanups,
      },
    );
    const $ = (suffix) => doc.getElementById(`${root.id}-comfort-${suffix}`);
    assert.equal(writes.length, 0);
    const apply = $('apply');
    apply.click();
    assert.equal(display.snapshot().textFace, 'plain');
    assert.equal(display.snapshot().textSize, 'large');
    assert.match($('status').textContent, locale === 'en' ? /Session only/ : /Лише в цьому сеансі/);
    working = true;
    apply.click();
    assert.equal(data.get(MENU_ANIMATION_KEY), 'off');
    assert.equal(JSON.parse(data.get(DISPLAY_PREFERENCES_KEY)).reducedEffects, true);
    $('undo').focus();
    $('undo').click();
    assert.equal(display.snapshot().textFace, 'pixel');
    assert.equal(data.get(MENU_ANIMATION_KEY), 'on');
    assert.equal(doc.activeElement, apply);
    assert.equal(cleanups.length, 1);
    cleanups[0]();
    const before = writes.length;
    apply.click();
    win.emit('pageshow', { persisted: true });
    assert.equal(writes.length, before);
    assert.equal(root.querySelector('.comfort-presets'), null);
  });

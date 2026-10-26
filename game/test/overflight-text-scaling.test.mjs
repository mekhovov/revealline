import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { Document, Events } from './helpers/couch-dom.mjs';
import { createDisplayPreferences, DISPLAY_PREFERENCES_KEY } from '../display-preferences.mjs';
import { renderTextSizeControl } from '../ui/text-size-control.mjs';
import { effectiveTextSize } from '../text-size.mjs';
import { resolvePresentation } from '../presentation/theme-system.mjs';
import { buildThemeBootstrap } from '../../scripts/refresh-theme-bootstrap.mjs';

const desired = { textFace: 'plain', textSize: 'extra-large', reducedEffects: false };
function storage(initial = desired) {
  let raw = JSON.stringify(initial),
    fail = false;
  const writes = [];
  return {
    writes,
    getItem: (key) => (key === DISPLAY_PREFERENCES_KEY ? raw : null),
    setItem(key, value) {
      if (fail) throw new Error('Unavailable');
      assert.equal(key, DISPLAY_PREFERENCES_KEY);
      writes.push(value);
      raw = value;
    },
    fail: () => (fail = true),
    peer: (value) => (raw = JSON.stringify(value)),
  };
}

test('opt-in and unsupported owners retain one desired size through startup, peer updates and reload', () => {
  const saved = storage(),
    windows = [new Events(), new Events()],
    qualified = createDisplayPreferences({
      window: windows[0],
      getStorage: () => saved,
      extraLarge: true,
    }),
    fallback = createDisplayPreferences({ window: windows[1], getStorage: () => saved });
  try {
    assert.equal(qualified.snapshot().effectiveTextSize, 'extra-large');
    assert.equal(fallback.snapshot().effectiveTextSize, 'large');
    assert.equal(fallback.snapshot().textSize, 'extra-large');
    assert.deepEqual(saved.writes, []);
    for (const size of ['standard', 'large', 'extra-large']) {
      qualified.set({ textSize: size });
      windows[1].emit('storage', {
        key: DISPLAY_PREFERENCES_KEY,
        newValue: saved.getItem(DISPLAY_PREFERENCES_KEY),
        storageArea: saved,
      });
      assert.equal(fallback.snapshot().textSize, size);
      assert.equal(fallback.snapshot().effectiveTextSize, effectiveTextSize(size));
      assert.equal(qualified.snapshot().effectiveTextSize, size);
      assert.deepEqual(JSON.parse(saved.writes.at(-1)), { ...desired, textSize: size });
    }
    const reloaded = createDisplayPreferences({ getStorage: () => saved, extraLarge: true });
    assert.equal(reloaded.snapshot().effectiveTextSize, 'extra-large');
    reloaded.dispose();
  } finally {
    qualified.dispose();
    fallback.dispose();
  }
});

for (const mode of ['failed-save', 'session-only'])
  test(`${mode} opt-in intent remains local without claiming durable storage or accepting older peer state`, () => {
    const saved = storage({ ...desired, textSize: 'standard' }),
      window = new Events(),
      owner = createDisplayPreferences({
        window,
        getStorage: () => saved,
        extraLarge: true,
        writable: () => mode !== 'session-only',
      });
    try {
      if (mode === 'failed-save') saved.fail();
      owner.set({ textSize: 'extra-large' });
      assert.equal(owner.snapshot().effectiveTextSize, 'extra-large');
      assert.deepEqual(saved.writes, []);
      assert.equal(
        owner.getWarningKey(),
        mode === 'session-only'
          ? 'common:preferences.displaySessionOnly'
          : 'common:preferences.displaySaveFailed',
      );
      saved.peer({ ...desired, textSize: 'large' });
      window.emit('storage', {
        key: DISPLAY_PREFERENCES_KEY,
        storageArea: saved,
        newValue: saved.getItem(DISPLAY_PREFERENCES_KEY),
      });
      window.emit('pageshow', { persisted: true });
      assert.equal(owner.snapshot().textSize, 'extra-large');
      assert.equal(owner.snapshot().effectiveTextSize, 'extra-large');
    } finally {
      owner.dispose();
    }
  });

test('one native selector enables opt-in Extra large and localizes in place without focus, event or save side effects', () => {
  const doc = new Document(),
    select = doc.createElement('select');
  select.id = 'text-size';
  for (const size of ['standard', 'large']) {
    const option = doc.createElement('option');
    option.value = size;
    select.append(option);
  }
  doc.body.append(select);
  select.setAttribute('aria-describedby', 'host-help');
  let changes = 0;
  select.addEventListener('change', () => changes++);
  select.focus();
  renderTextSizeControl(select, 'extra-large', { locale: 'en' });
  const option = select.querySelector('[data-text-size-retained]');
  assert.equal(option.disabled, true);
  for (const [locale, label] of [
    ['uk', 'Дуже великий'],
    ['en', 'Extra large'],
  ]) {
    renderTextSizeControl(select, 'extra-large', { locale, extraLarge: true });
    assert.ok(select.querySelector('[data-text-size-retained]') === option);
    assert.equal(option.disabled, false);
    assert.equal(option.textContent, label);
    assert.equal(select.value, 'extra-large');
    assert.equal(select.getAttribute('aria-describedby'), 'host-help');
    assert.equal(doc.querySelector('[data-text-size-fallback]').hidden, true);
    assert.ok(doc.activeElement === select);
  }
  renderTextSizeControl(select, 'standard', { locale: 'en', extraLarge: true });
  assert.ok(select.querySelector('[data-text-size-retained]') === option);
  assert.equal(
    option.disabled,
    false,
    'The opted-in choice stays available after choosing Standard.',
  );
  assert.equal(changes, 0);
});

test('generated first paint and runtime agree for every desired size, density and capability without startup writes', async () => {
  const source = await fs.readFile(
    new URL('../presentation/theme-bootstrap.mjs', import.meta.url),
    'utf8',
  );
  assert.equal(source, await buildThemeBootstrap());
  for (const capability of [undefined, 'overflight', 'unsupported'])
    for (const size of ['standard', 'large', 'extra-large'])
      for (const density of ['player', 'studio']) {
        const variables = new Map(),
          dataset = capability ? { textScaling: capability } : {};
        const document = {
          documentElement: {
            dataset,
            style: { setProperty: (key, value) => variables.set(key, value) },
          },
          currentScript: { dataset: { themeDensity: density } },
          querySelector: () => null,
        };
        vm.runInNewContext(source, {
          document,
          localStorage: {
            getItem: (key) =>
              key === DISPLAY_PREFERENCES_KEY
                ? JSON.stringify({ ...desired, textSize: size })
                : null,
            setItem: () => assert.fail('First paint cannot persist player intent.'),
          },
          location: { href: 'https://example.test/game/overflight/play.html' },
          URL,
          matchMedia: () => ({ matches: false }),
        });
        const effective = effectiveTextSize(size, { extraLarge: capability === 'overflight' });
        const runtime = resolvePresentation({
          density,
          accessibility: {
            textFace: 'plain',
            textSize: size,
            extraLarge: capability === 'overflight',
          },
        });
        assert.equal(dataset.themeTextSize, effective);
        assert.equal(runtime.accessibility.textSize, effective);
        assert.equal(variables.get('--iw-text-size'), effective === 'large' ? '20px' : '16px');
        assert.equal(
          variables.get('--iw-target'),
          density === 'studio' && effective === 'standard' ? '32px' : '44px',
        );
        assert.equal(
          variables.get('--overflight-text-scale'),
          capability === 'overflight' ? (effective === 'extra-large' ? '2' : '1') : undefined,
        );
      }
});

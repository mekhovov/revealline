import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { syncStudioDifficulty } from '../studio/difficulty-view.mjs';
import { journeyPreset } from '../content-design/catalogs.mjs';
import { getLocale, setLocale, t } from '../i18n/index.mjs';
import { Document } from './helpers/couch-dom.mjs';

function selector() {
  return {
    value: 'expert',
    disabled: false,
    options: ['gentle', 'standard', 'expert'].map((value) => ({ value, textContent: value })),
  };
}

for (const catalog of ['journey-difficulty-v1', 'journey-difficulty-v2'])
  for (const team of [false, true])
    test(`difficulty labels follow the applied catalogue and mode: ${catalog}/${team ? 'team' : 'solo'}`, () => {
      const select = selector();
      syncStudioDifficulty(select, catalog, { team });
      for (const option of select.options) {
        const preset = journeyPreset(option.value, catalog);
        assert.equal(
          option.textContent,
          `${option.value[0].toUpperCase()}${option.value.slice(1)} · ${preset.lives} ${team ? 'shared lives' : 'lives'} · enemy speed ×${preset.enemySpeedFactor}`,
        );
      }
      assert.equal(select.value, 'expert');
      assert.equal(select.disabled, false);
    });

test('switching/undoing editions and leaving a Team mission removes stale speed and shared-life labels', () => {
  const select = selector();
  syncStudioDifficulty(select, 'journey-difficulty-v1');
  const original = structuredClone(select);
  syncStudioDifficulty(select, 'journey-difficulty-v2', { team: true });
  assert.match(select.options[2].textContent, /2 shared lives · enemy speed ×1\.75$/);
  select.disabled = true;
  syncStudioDifficulty(select, 'journey-difficulty-v1');
  assert.equal(select.value, original.value);
  assert.equal(select.disabled, true);
  assert.deepEqual(select.options, original.options);
});

test('unregistered catalogue fails before changing any labels or selection', () => {
  const select = selector(),
    before = structuredClone(select);
  assert.throws(() => syncStudioDifficulty(select, 'unknown'), /registered difficulty catalog/);
  assert.deepEqual(select, before);
});

test('applied board refresh owns labels and links the actual rule explanation accessibly', async () => {
  const host = await readFile(new URL('../studio/studio.mjs', import.meta.url), 'utf8');
  const html = await readFile(new URL('../studio/index.html', import.meta.url), 'utf8');
  const inspect = host.slice(
    host.indexOf('function inspectBoard('),
    host.indexOf('function render('),
  );
  assert.match(inspect, /syncStudioDifficulty\(\$\('difficulty'\), project\.difficultyCatalogId/);
  assert(inspect.indexOf('syncStudioDifficulty') < inspect.indexOf('if (!mission)'));
  assert.match(inspect, /!mission\.modes\.includes\('solo'\) && mission\.modes\[0\] === 'team'/);
  assert(html.includes('id="difficulty" aria-describedby="difficulty-help rules"'));
  assert(html.includes("Enemy speed is relative to each moving actor's authored tier"));
  assert.doesNotMatch(html, />Gentle · 5 lives<|>Standard · 3 lives<|>Expert · 2 lives</);
});

test('live Studio difficulty captions preserve option nodes, focus and unapplied editor input', () => {
  const previous = getLocale();
  const doc = new Document();
  const select = doc.createElement('select');
  const source = doc.createElement('textarea');
  source.value = '{"my draft": "unapplied Україна"}';
  source.selectionStart = 4;
  source.selectionEnd = 13;
  source.scrollTop = 45;
  for (const value of ['gentle', 'standard', 'expert']) {
    const option = doc.createElement('option');
    option.value = value;
    select.append(option);
  }
  doc.body.append(select, source);
  select.value = 'expert';
  select.disabled = true;
  source.focus();
  const nodes = [...select.options];
  const input = source.value;
  try {
    syncStudioDifficulty(select, 'journey-difficulty-v2', { team: true });
    for (const locale of ['uk', 'en', 'uk', 'en']) {
      setLocale(locale, { persist: false });
      assert.equal(
        select.options[2].textContent,
        locale === 'uk'
          ? 'Експертна · 2 спільні життя · швидкість ворогів ×1,75'
          : 'Expert · 2 shared lives · enemy speed ×1.75',
      );
      assert.equal(select.value, 'expert');
      assert.equal(select.disabled, true);
      assert.equal(doc.activeElement, source);
      assert.equal(source.value, input);
      assert.equal(source.selectionStart, 4);
      assert.equal(source.selectionEnd, 13);
      assert.equal(source.scrollTop, 45);
      assert.deepEqual([...select.options], nodes);
    }
    syncStudioDifficulty(select, 'journey-difficulty-v1');
    setLocale('uk', { persist: false });
    assert.equal(select.options[2].textContent, 'Експертна · 2 життя · швидкість ворогів ×1,1');
  } finally {
    setLocale(previous, { persist: false });
  }
});

test('Ukrainian difficulty lives use all plural forms and decimal formatting', () => {
  const previous = getLocale();
  try {
    setLocale('uk', { persist: false });
    for (const [count, display, lives, shared] of [
      [0, '0', 'життів', 'спільних життів'],
      [1, '1', 'життя', 'спільне життя'],
      [2, '2', 'життя', 'спільні життя'],
      [5, '5', 'життів', 'спільних життів'],
      [11, '11', 'життів', 'спільних життів'],
      [21, '21', 'життя', 'спільне життя'],
      [22, '22', 'життя', 'спільні життя'],
      [1.5, '1,5', 'життя', 'спільного життя'],
    ]) {
      assert.equal(
        t('tools:studio.difficulty.solo', { name: 'Тест', count, speed: 1.75 }),
        `Тест · ${display} ${lives} · швидкість ворогів ×1,75`,
      );
      assert.equal(
        t('tools:studio.difficulty.shared', { name: 'Тест', count, speed: 1.75 }),
        `Тест · ${display} ${shared} · швидкість ворогів ×1,75`,
      );
    }
  } finally {
    setLocale(previous, { persist: false });
  }
});

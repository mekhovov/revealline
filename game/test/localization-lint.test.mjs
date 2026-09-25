import test from 'node:test';
import assert from 'node:assert/strict';
import { Linter } from 'eslint';
import { noShadowedTranslator } from '../../scripts/eslint-localization.mjs';

const lint = (code) =>
  new Linter().verify(code, [
    {
      plugins: { localization: { rules: { translator: noShadowedTranslator } } },
      rules: { 'localization/translator': 'error' },
    },
  ]);

test('translation calls cannot be captured by a renderer clock or callback parameter', () => {
  for (const body of [
    'function draw() { t("interface:error"); const t = 1; }',
    'function draw(t) { return t("interface:error"); }',
  ]) {
    const messages = lint('import { t } from "../i18n/index.mjs"; ' + body);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].ruleId, 'localization/translator');
  }
});

test('ordinary time variables and classic-script translator adapters remain valid', () => {
  assert.deepEqual(
    lint(
      'import { t } from "../i18n/index.mjs"; function draw(t) { return t * 2; } t("interface:error");',
    ),
    [],
  );
  assert.deepEqual(
    lint('const t = (key) => globalThis.RevealLineI18n.t(key); t("interface:error");'),
    [],
  );
});

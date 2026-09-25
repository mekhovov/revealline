import assert from 'node:assert/strict';
import test from 'node:test';
import { auditSource } from './localization-audit.mjs';

test('source audit finds untranslated producers without treating references as copy', () => {
  const found = auditSource(
    "localizedText(label, () => `Ready for ${name}`);\nlocalizedText(other, () => t('common:actions.cancel'));",
    'game/example.mjs',
  );
  assert.deepEqual(
    found.map(({ text, kind, line }) => ({ text, kind, line })),
    [{ text: 'Ready for {{expression1}}', kind: 'dom', line: 1 }],
  );
});

test('interpolated English remains a candidate and pure expressions do not', () => {
  const found = auditSource(
    "label.textContent = `${name}`; t('interface:summary', { status: 'Flight ready' });",
    'game/example.mjs',
  );
  assert.deepEqual(
    found.map(({ text, kind }) => ({ text, kind })),
    [{ text: 'Flight ready', kind: 'interpolation' }],
  );
});

test('rich DOM slots retain their own translation responsibility', () => {
  const found = auditSource(
    '<html lang="en"><h1 data-i18n="common:title">Welcome</h1><p data-i18n-rich="website:help">Read <a data-i18n-slot="link">the guide</a><b data-i18n-slot="action" data-i18n="common:actions.start">Start</b></p><input aria-label="Project name" placeholder="Write here" data-i18n-placeholder="tools:name" /><code>Technical example</code><span lang="en">Original attribution</span></html>',
    'site/example.html',
  );
  assert.deepEqual(
    found.map(({ text, kind }) => ({ text, kind })),
    [
      { text: 'the guide', kind: 'html' },
      { text: 'Project name', kind: 'attribute' },
    ],
  );
});

test('canvas text, options and DOM attributes are inventoried', () => {
  const found = auditSource(
    "ctx.fillText('READY', 0, 0); new Option('Normal', 'normal'); el.setAttribute('aria-label', 'Play');",
    'game/example.mjs',
  );
  assert.deepEqual(
    found.map(({ text, kind }) => ({ text, kind })),
    [
      { text: 'READY', kind: 'canvas-or-option' },
      { text: 'Normal', kind: 'canvas-or-option' },
      { text: 'Play', kind: 'attribute' },
    ],
  );
});

test('technical identifiers and property keys are not display candidates', () => {
  const found = auditSource(
    "text.normalize('NFKC'); new FontFace('FieldKitDisplay', url); const schema = { 'Display name': id, font: 'RLStudioValidation' };",
    'game/example.mjs',
  );
  assert.deepEqual(found, []);
});

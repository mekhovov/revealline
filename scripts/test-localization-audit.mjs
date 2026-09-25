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

test('DOM helper signatures distinguish element IDs from labels and honor lexical shadowing', () => {
  const found = auditSource(
    `
    const node = (tag, text = '') => { const element = document.createElement(tag); element.textContent = text; return element; };
    node('p', 'Outer caption');
    function panel() {
      function node(tag, id, text = '') { const element = document.createElement(tag); element.id = id; localizedText(element, () => text); return element; }
      node('p', 'status', 'Pending download');
      node('p', 'title', t('common:actions.cancel'));
    }
    node('button', 'Open panel');
  `,
    'game/example.mjs',
  );
  assert.deepEqual(
    found.map(({ text, kind }) => ({ text, kind })),
    [
      { text: 'Outer caption', kind: 'dom-factory' },
      { text: 'Pending download', kind: 'dom-factory' },
      { text: 'Open panel', kind: 'dom-factory' },
    ],
  );
});

test('state comparisons within display producers remain review candidates rather than display copy', () => {
  const found = auditSource(
    `
    localizedText(label, () => state === 'Ready' ? 'Begin flight' : 'Preparing flight');
    label.textContent = kind !== 'flight' ? 'Open menu' : 'Keep flying';
  `,
    'game/example.mjs',
  );
  assert.deepEqual(
    found.map(({ text, kind }) => ({ text, kind })),
    [
      { text: 'Ready', kind: 'review' },
      { text: 'Begin flight', kind: 'dom' },
      { text: 'Preparing flight', kind: 'dom' },
      { text: 'Open menu', kind: 'dom' },
      { text: 'Keep flying', kind: 'dom' },
    ],
  );
});

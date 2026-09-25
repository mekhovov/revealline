/** Source inventory, never a rendered-text replacement or a claim of full coverage. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { parse as parseJS } from 'acorn';
import { parse as parseHTML, parseFragment } from 'parse5';

const messageKey = /^(?:common|interface|gameplay|content|tools|website|errors):[\w.]+$/;
const humanAttributes = new Set(['aria-label', 'title', 'placeholder', 'alt', 'data-menu-label']);
const displayFields = new Set(['textContent', 'innerText', 'title', 'placeholder', 'alt']);
const metadataFields = new Set([
  'label',
  'title',
  'description',
  'hint',
  'help',
  'empty',
  'message',
  'caption',
  'brief',
  'name',
]);
const invariantLabels = new Set([
  'Reveal Line',
  'RevealLine',
  'REVEALLINE',
  'REVEAL',
  'LINE',
  'REVEAL / LINE',
  'FPV',
  'English',
  'MIT',
  'JSON',
  'PNG',
  'MP3',
  'SVG',
  'CSS',
  'HTML',
  'URL',
  'ID',
]);
const propertyName = (node) => (node?.computed ? node.property?.value : node?.property?.name);
const callName = (node) => node?.callee?.name || propertyName(node?.callee);
const attribute = (node, name) => node.attrs?.find((item) => item.name === name)?.value;
function readable(value, direct = false) {
  if (typeof value !== 'string') return false;
  const text = value.replace(/\{\{[^}]*\}\}/g, '').trim();
  if (!/[A-Za-z]{2}/.test(text) || messageKey.test(text) || invariantLabels.has(text)) return false;
  if (/^(?:https?:|data:|blob:|\.\.?\/)|^[\w/-]+\.(?:m?js|css|json|png|svg|woff2?|ttf)$/.test(text))
    return false;
  return direct || /[a-zA-Z][ ,;?!][A-Za-z]|^[A-Z][a-z]{2,}(?:[ !?.…]|$)/.test(text);
}

export function auditSource(source, file) {
  const candidates = [];
  const seen = new Set();
  const add = (text, kind, line, column) => {
    text = text.replace(/\s+/g, ' ').trim();
    if (!readable(text, kind !== 'review')) return;
    const id = `${line}:${column}:${kind}:${text}`;
    if (seen.has(id)) return;
    seen.add(id);
    candidates.push({ file, line, column, kind, text });
  };
  function markup(tree, baseLine = 0) {
    const walk = (node, covered = false, ignored = false) => {
      ignored ||=
        ['script', 'style', 'code', 'pre', 'kbd', 'noscript'].includes(node.tagName) ||
        (node.tagName !== 'html' && attribute(node, 'lang') !== undefined);
      if (ignored) return;
      // A named slot is retained in place; its own text needs its own marker.
      if (attribute(node, 'data-i18n-slot') !== undefined) covered = false;
      covered ||=
        attribute(node, 'data-i18n') !== undefined ||
        attribute(node, 'data-i18n-rich') !== undefined;
      const location = node.sourceCodeLocation;
      if (node.nodeName === '#text' && !covered)
        add(node.value, 'html', baseLine + (location?.startLine || 1), location?.startCol || 1);
      for (const attr of node.attrs || []) {
        if (
          !humanAttributes.has(attr.name) ||
          attribute(node, `data-i18n-${attr.name}`) !== undefined
        )
          continue;
        const loc = location?.attrs?.[attr.name] || location;
        add(attr.value, 'attribute', baseLine + (loc?.startLine || 1), loc?.startCol || 1);
      }
      for (const child of node.childNodes || []) walk(child, covered, ignored);
      if (node.content) walk(node.content, covered, ignored);
    };
    walk(tree);
  }
  if (file.endsWith('.html')) {
    markup(parseHTML(source, { sourceCodeLocationInfo: true }));
    return candidates;
  }
  function context(ancestors) {
    for (let index = ancestors.length - 1; index >= 0; index--) {
      const node = ancestors[index];
      const child = ancestors[index + 1];
      if (
        node.type === 'AssignmentExpression' &&
        child === node.right &&
        displayFields.has(propertyName(node.left))
      )
        return 'dom';
      if (
        node.type === 'Property' &&
        child === node.value &&
        metadataFields.has(node.key?.name || node.key?.value)
      )
        return 'metadata';
      if (!['CallExpression', 'NewExpression'].includes(node.type)) continue;
      const name = callName(node);
      if (['t', 'localizedMessage'].includes(name)) return 'interpolation';
      if (name === 'localizedText' && child === node.arguments[1]) return 'dom';
      if (
        name === 'localizedAttribute' &&
        humanAttributes.has(node.arguments[1]?.value) &&
        child === node.arguments[2]
      )
        return 'attribute';
      if (
        name === 'setAttribute' &&
        humanAttributes.has(node.arguments[0]?.value) &&
        child === node.arguments[1]
      )
        return 'attribute';
      if (
        ['fillText', 'strokeText', 'localizedOption', 'Option'].includes(name) &&
        child === node.arguments[0]
      )
        return 'canvas-or-option';
      if (
        ['text', 'node', 'el'].includes(name) &&
        /^(?:p|h[1-6]|span|div|label|button|option|small|strong)$/.test(node.arguments[0]?.value) &&
        child === node.arguments[1]
      )
        return 'dom-factory';
      if (node.type === 'NewExpression' && /Error$/.test(name)) return 'error';
    }
    return 'review';
  }
  function walk(node, ancestors = []) {
    if (!node || typeof node !== 'object') return;
    const parent = ancestors.at(-1);
    if (parent?.type === 'Property' && node === parent.key && !parent.computed) return;
    if (
      (node.type === 'Literal' && typeof node.value === 'string') ||
      node.type === 'TemplateLiteral'
    ) {
      const text =
        node.type === 'Literal'
          ? node.value
          : node.quasis
              .map(
                (part, i) =>
                  part.value.cooked + (i < node.expressions.length ? `{{expression${i + 1}}}` : ''),
              )
              .join('');
      if (/<[a-z][^>]*>/i.test(text))
        markup(parseFragment(text, { sourceCodeLocationInfo: true }), node.loc.start.line - 1);
      else add(text, context([...ancestors, node]), node.loc.start.line, node.loc.start.column + 1);
    }
    for (const [key, value] of Object.entries(node)) {
      if (['loc', 'start', 'end', 'quasis'].includes(key)) continue;
      if (Array.isArray(value)) value.forEach((child) => walk(child, [...ancestors, node]));
      else if (value && typeof value === 'object') walk(value, [...ancestors, node]);
    }
  }
  walk(parseJS(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true }));
  return candidates;
}

export async function auditSources(directory, files, resources) {
  const byText = new Map();
  for (const [namespace, entries] of Object.entries(resources.en))
    for (const [key, text] of Object.entries(entries)) {
      const normalized = text.replace(/\s+/g, ' ').trim();
      if (!byText.has(normalized)) byText.set(normalized, []);
      byText.get(normalized).push(`${namespace}:${key}`);
    }
  const candidates = [];
  for (const file of files) {
    const source = await fs.readFile(path.join(directory, file), 'utf8');
    for (const candidate of auditSource(source, file))
      candidates.push({ ...candidate, existingKeys: byText.get(candidate.text) || [] });
  }
  return {
    note: 'Review source candidates and runtime routes. Registered content, user data, technical identifiers, legal text and bilingual specimens may intentionally remain authored. This heuristic inventory is not a completeness certificate.',
    byKind: Object.fromEntries(
      [...new Set(candidates.map(({ kind }) => kind))]
        .sort()
        .map((kind) => [kind, candidates.filter((item) => item.kind === kind).length]),
    ),
    candidates,
  };
}

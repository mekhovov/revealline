import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Document as CandidateDocument,
  Element as CandidateElement,
} from './helpers/couch-dom.mjs';
// Preserve the exact pre-cache matching algorithm as a local regression oracle.
// No external scratch checkout, file read, network or production CSS claim.
class ReferenceElement extends CandidateElement {
  matches(selector) {
    return selector.split(',').some((part) => {
      part = part.trim();
      if (/\s/.test(part)) {
        let depth = 0,
          split = -1;
        for (let index = 0; index < part.length; index++) {
          if (['[', '('].includes(part[index])) depth++;
          if ([']', ')'].includes(part[index])) depth--;
          if (depth === 0 && /\s/.test(part[index])) split = index;
        }
        if (split >= 0) {
          const ancestor = part.slice(0, split).trim(),
            descendant = part.slice(split + 1);
          return (
            this.matches(descendant) &&
            (ancestor.endsWith('>')
              ? !!this.parentElement?.matches(ancestor.slice(0, -1).trim())
              : !!this.parentElement?.closest(ancestor))
          );
        }
      }
      if (part === '.race-pad button')
        return this.tagName === 'BUTTON' && !!this.parentElement?.closest('.race-pad');
      if (part === ':disabled') return this.disabled;
      if (part.startsWith('.')) return this.classList.contains(part.slice(1));
      if (part.startsWith('#')) return this.id === part.slice(1);
      const excluded = [...part.matchAll(/:not\(([^)]+)\)/g)].map((match) => match[1]);
      if (excluded.some((item) => this.matches(item))) return false;
      part = part.replace(/:not\([^)]+\)/g, '');
      const tag = part.match(/^[a-z][a-z0-9-]*/i)?.[0];
      if (tag && this.tagName !== tag.toUpperCase()) return false;
      for (const match of part.matchAll(/\[([^=*\]]+)(?:(\*?=)["']?([^"'\]]+)["']?)?\]/g)) {
        const [, key, operator, value] = match;
        const actual =
          key === 'hidden'
            ? this.hidden
              ? ''
              : null
            : key === 'disabled'
              ? this.disabled
                ? ''
                : null
              : key === 'inert'
                ? this.inert
                  ? ''
                  : null
                : key === 'open'
                  ? this.open
                    ? ''
                    : null
                  : this.getAttribute(key);
        if (
          actual === null ||
          (value !== undefined && (operator === '*=' ? !actual.includes(value) : actual !== value))
        )
          return false;
      }
      return !!tag || part.startsWith('[') || part === '*';
    });
  }
}
class ReferenceDocument extends CandidateDocument {
  createElement(tag) {
    return new ReferenceElement(this, tag);
  }
}

function tree(Document) {
  const doc = new Document();
  const section = doc.createElement('section');
  section.id = 'root';
  section.className = 'race-pad';
  doc.body.append(section);
  for (let i = 0; i < 6; i++) {
    const row = doc.createElement('div');
    row.id = `row-${i}`;
    row.className = i % 2 ? 'odd item' : 'even item';
    row.setAttribute('data-label', i % 2 ? 'alpha beta' : 'alpha,beta');
    const button = doc.createElement('button');
    button.id = `button-${i}`;
    button.className = 'action';
    button.setAttribute('data-value', `item-${i}`);
    button.disabled = i === 1;
    button.hidden = i === 2;
    button.inert = i === 3;
    button.open = i === 4;
    button.type = 'button';
    row.append(button, doc.createTextNode(`label ${i}`));
    section.append(row);
  }
  return { doc, section };
}
const selectors = [
  '*',
  'button',
  'BUTTON',
  'section',
  'div',
  'span',
  '#button-2',
  '#absent',
  '.action',
  '.odd',
  ':disabled',
  '[hidden]',
  '[disabled]',
  '[inert]',
  '[open]',
  '[data-value]',
  '[missing]',
  '[data-value="item-1"]',
  '[data-value*=item]',
  '[type=button]',
  '[data-label="alpha beta"]',
  'button:not([disabled])',
  'button:not([hidden]):not([inert])',
  'button,div',
  '.race-pad button',
  'section > div',
  'section > button',
  'section div button',
  '#root > div > button',
  ':scope > div',
  ':scope > button',
  // Preserve the model's existing limited-selector behavior; do not silently
  // claim full browser CSS support or change historically unsupported forms.
  '.odd.item',
  '.action:not([disabled])',
  '#button-1[disabled]',
  'button:hover',
  '[data-label="alpha,beta"]',
  '[data-value=""]',
  '',
  'button:not(.absent)',
];
function identities(nodes) {
  return [...nodes].map((node) => node.id || node.tagName || node.nodeName);
}
function compare(a, b) {
  for (const selector of selectors) {
    assert.deepEqual(
      identities(a.doc.querySelectorAll(selector)),
      identities(b.doc.querySelectorAll(selector)),
      selector,
    );
    assert.equal(
      a.doc.querySelector(selector)?.id ?? null,
      b.doc.querySelector(selector)?.id ?? null,
      selector,
    );
    const left = a.section.children
      .flatMap((row) => [row, ...row.children])
      .filter((node) => node.nodeType === 1);
    const right = b.section.children
      .flatMap((row) => [row, ...row.children])
      .filter((node) => node.nodeType === 1);
    assert.equal(left.length, right.length);
    for (let i = 0; i < left.length; i++) {
      assert.equal(
        left[i].matches(selector),
        right[i].matches(selector),
        `${selector}: ${left[i].id}`,
      );
      assert.equal(
        left[i].closest(selector)?.id ?? null,
        right[i].closest(selector)?.id ?? null,
        selector,
      );
    }
  }
}
test('parsed selectors retain exact reference matching, first-result and descendant order', () => {
  compare(tree(CandidateDocument), tree(ReferenceDocument));
});
test('warm selector plans still observe live attributes, classes, states and reparenting', () => {
  const a = tree(CandidateDocument),
    b = tree(ReferenceDocument);
  compare(a, b);
  for (const value of [a, b]) {
    const button = value.doc.getElementById('button-1');
    button.disabled = false;
    button.hidden = true;
    button.inert = true;
    button.open = true;
    button.className = 'changed';
    button.setAttribute('data-value', 'item-live');
    button.id = 'changed-id';
    value.section.children[0].append(button);
    value.section.children[2].remove();
  }
  compare(a, b);
  for (const value of [a, b]) {
    const button = value.doc.getElementById('changed-id');
    button.removeAttribute('data-value');
    button.classList.add('action');
    button.hidden = false;
    value.section.append(button);
  }
  compare(a, b);
});
test('a warm selector is parsed once while matched values remain live', () => {
  const doc = new CandidateDocument(),
    node = doc.createElement('button');
  const selector = 'button[data-selector-cache-regression="active"]:not([disabled])';
  node.setAttribute('data-selector-cache-regression', 'active');
  const split = String.prototype.split;
  let parses = 0;
  String.prototype.split = function (separator, ...args) {
    if (separator === ',' && String(this) === selector) parses++;
    return split.call(this, separator, ...args);
  };
  try {
    assert.equal(node.matches(selector), true);
    for (let i = 0; i < 20; i++) {
      node.disabled = i % 2 === 0;
      assert.equal(node.matches(selector), !node.disabled);
    }
    assert.equal(parses, 1, 'Repeated model frames must not rebuild the same selector parse.');
  } finally {
    String.prototype.split = split;
  }
});
test('parsed-selector cache evicts old plans rather than retaining unbounded authored strings', () => {
  const node = new CandidateDocument().createElement('div');
  const selector = '[data-selector-cache-eviction="old"]';
  const split = String.prototype.split;
  let parses = 0;
  String.prototype.split = function (separator, ...args) {
    if (separator === ',' && String(this) === selector) parses++;
    return split.call(this, separator, ...args);
  };
  try {
    node.matches(selector);
    for (let i = 0; i < 130; i++) node.matches(`[data-selector-cache-eviction="${i}"]`);
    node.matches(selector);
    assert.equal(parses, 2, 'The fixed-size cache must evict old selectors.');
  } finally {
    String.prototype.split = split;
  }
});

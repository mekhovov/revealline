import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';

function fixture() {
  const document = new Document();
  const left = document.createElement('section');
  const nested = document.createElement('button');
  const right = document.createElement('button');
  left.id = 'scope';
  nested.id = 'first';
  right.id = 'second';
  nested.setAttribute('data-choice', 'yes');
  left.append(nested);
  document.body.append(left, right);
  return { document, left, nested, right };
}

test('first-result queries retain depth-first document order, including selector lists', () => {
  const { document, left, nested } = fixture();
  for (const selector of [
    'button',
    '#second, #first',
    '[data-choice="yes"]',
    'button:not([disabled])',
  ])
    assert.equal(document.querySelector(selector), document.querySelectorAll(selector)[0]);
  assert.equal(document.querySelector('button'), nested);
  assert.equal(left.querySelector('#scope'), null, 'the scope itself is excluded');
  assert.equal(left.querySelector('#second'), null, 'siblings are excluded');
  assert.equal(document.querySelector('#absent'), null);
});

test('first-result queries stop before visiting later unrelated descendants', () => {
  const { document, nested, right } = fixture();
  right.matches = () => assert.fail('a first-result query must stop after the first match');
  assert.equal(document.querySelector('button'), nested);
  assert.equal(document.getElementById('first'), nested);
});

test('first-result queries reflect removal, insertion and attribute changes without stale caches', () => {
  const { document, nested, right } = fixture();
  nested.remove();
  assert.equal(document.querySelector('button'), right);
  right.id = 'renamed';
  assert.equal(document.getElementById('second'), null);
  assert.equal(document.getElementById('renamed'), right);
  document.head.append(nested);
  nested.hidden = true;
  assert.equal(document.querySelector('button'), nested, 'visibility does not filter selectors');
  nested.disabled = true;
  assert.equal(document.querySelector('button:not([disabled])'), right);
  assert.deepEqual(document.querySelectorAll('button'), [nested, right]);
});

test('ID lookup uses literal identifiers without invoking selector parsing', () => {
  const document = new Document();
  document.querySelector = () => assert.fail('ID lookup is not a CSS selector query.');
  for (const id of ['ordinary', 'a,b', 'a b', 'a>b', 'a#b', 'a.b', '[id]', ':scope', 'quote"']) {
    const node = document.createElement('button');
    node.id = id;
    node.matches = () => assert.fail('Literal ID lookup must not parse element selectors.');
    document.body.append(node);
    assert.equal(document.getElementById(id), node);
    node.remove();
    assert.equal(document.getElementById(id), null);
  }
  assert.equal(document.getElementById(''), null);
  assert.equal(document.getElementById('missing'), null);
});

test('ID lookup preserves first tree order across duplicates, moves, removal and ID changes', () => {
  const { document, left, nested, right } = fixture();
  nested.id = right.id = 'duplicate';
  assert.equal(document.getElementById('duplicate'), nested);
  document.body.insertBefore(right, left);
  assert.equal(document.getElementById('duplicate'), right);
  right.remove();
  assert.equal(document.getElementById('duplicate'), nested);
  nested.setAttribute('id', 'new-value');
  assert.equal(document.getElementById('duplicate'), null);
  assert.equal(document.getElementById('new-value'), nested);
  document.head.append(right);
  assert.equal(document.getElementById('duplicate'), right);
  right.id = 'changed-again';
  assert.equal(document.getElementById('duplicate'), null);
  assert.equal(document.getElementById('changed-again'), right);
  document.documentElement.id = 'document-root';
  assert.ok(document.getElementById('document-root') === document.documentElement);
  document.documentElement.remove();
  assert.equal(
    document.getElementById('new-value'),
    null,
    'Detached documents retain no connected match.',
  );
  assert.equal(document.getElementById('document-root'), null);
});

test('ID lookup does not inspect descendants after its first match', () => {
  const { document, nested, right } = fixture();
  Object.defineProperty(right, 'id', {
    get() {
      assert.fail('A later element must not be inspected.');
    },
  });
  assert.equal(document.getElementById('first'), nested);
});

test('parsed selector syntax never caches element attributes, ancestry, visibility or results', () => {
  const { document, left, nested, right } = fixture();
  const dialog = document.createElement('dialog');
  document.body.append(dialog);
  for (let repeat = 0; repeat < 3; repeat++) {
    dialog.open = false;
    assert.deepEqual(document.querySelectorAll('dialog[open]'), []);
    dialog.open = true;
    assert.deepEqual(document.querySelectorAll('dialog[open]'), [dialog]);
  }
  left.classList.add('group');
  nested.setAttribute('data-title', 'two words');
  nested.setAttribute('data-choice', 'yes-value');
  for (const selector of [
    '.group > button',
    '.group button',
    '[data-title="two words"]',
    '[data-choice*="yes"]',
    'button:not([hidden]):not([disabled])',
  ]) {
    assert.ok(nested.matches(selector), selector);
  }
  nested.hidden = true;
  assert.equal(nested.matches('button:not([hidden]):not([disabled])'), false);
  nested.hidden = false;
  nested.disabled = true;
  assert.ok(nested.matches(':disabled'));
  assert.equal(nested.matches('button:not([hidden]):not([disabled])'), false);
  nested.disabled = false;
  nested.setAttribute('data-title', 'changed');
  assert.equal(nested.matches('[data-title="two words"]'), false);
  nested.removeAttribute('data-choice');
  assert.equal(nested.matches('[data-choice*="yes"]'), false);
  right.append(nested);
  assert.equal(nested.matches('.group > button'), false);
  assert.equal(nested.matches('.group button'), false);
  left.append(right);
  assert.equal(nested.matches('.group > button'), false);
  assert.ok(nested.matches('.group button'));
  assert.deepEqual(left.querySelectorAll(':scope > button'), [right]);
  left.classList.remove('group');
  assert.equal(nested.matches('.group button'), false);
  assert.deepEqual(document.querySelectorAll('#first, #second'), [right, nested]);
  assert.deepEqual(document.querySelectorAll('[missing], dialog[open]'), [dialog]);
});

test('selector syntax parsing is bounded and evicts syntax without retaining query results', () => {
  const { nested } = fixture();
  const first = '[data-syntax-cache-proof="yes"]';
  nested.setAttribute('data-syntax-cache-proof', 'yes');
  const split = String.prototype.split;
  let parses = 0;
  String.prototype.split = function (...args) {
    if (String(this) === first) parses++;
    return split.apply(this, args);
  };
  try {
    for (let repeat = 0; repeat < 10; repeat++) assert.ok(nested.matches(first));
    assert.equal(parses, 1, 'Repeated matches reuse syntax, not node state.');
    nested.removeAttribute('data-syntax-cache-proof');
    assert.equal(nested.matches(first), false);
    for (let index = 0; index < 64; index++)
      assert.equal(nested.matches(`[data-eviction-${index}]`), false);
    assert.equal(nested.matches(first), false);
    assert.equal(parses, 2, 'The oldest syntax is evicted after 64 other selectors.');
  } finally {
    String.prototype.split = split;
  }
});

test('oversized selector syntax is parsed without retention on every match', () => {
  const { nested } = fixture();
  const value = 'x'.repeat(2048);
  const selector = `[data-long="${value}"]`;
  nested.setAttribute('data-long', value);
  const split = String.prototype.split;
  let parses = 0;
  String.prototype.split = function (...args) {
    if (String(this) === selector) parses++;
    return split.apply(this, args);
  };
  try {
    assert.ok(nested.matches(selector));
    assert.ok(nested.matches(selector));
    nested.removeAttribute('data-long');
    assert.equal(nested.matches(selector), false);
    assert.equal(parses, 3, 'Selectors longer than 2048 characters are never retained.');
  } finally {
    String.prototype.split = split;
  }
});

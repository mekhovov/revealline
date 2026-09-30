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

import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';

function fixture() {
  const doc = new Document();
  const first = doc.createElement('section');
  const nested = doc.createElement('button');
  const later = doc.createElement('button');
  first.id = 'first';
  nested.id = later.id = 'duplicate';
  nested.classList.add('chosen');
  nested.setAttribute('data-slot', 'action');
  first.append(nested);
  doc.body.append(first, later);
  return { doc, first, nested, later };
}

test('querySelector keeps descendant document order and the existing supported selector semantics', () => {
  const { doc, first, nested, later } = fixture();
  for (const selector of [
    '#duplicate',
    'button',
    '.chosen',
    '[data-slot="action"]',
    'button,section',
  ]) {
    assert.equal(doc.querySelector(selector), doc.querySelectorAll(selector)[0]);
    assert.equal(first.querySelector(selector), first.querySelectorAll(selector)[0]);
  }
  assert.equal(doc.getElementById('duplicate'), nested);
  assert.deepEqual(doc.querySelectorAll('#duplicate'), [nested, later]);
  assert.equal(first.querySelector('#first'), null, 'Element queries exclude the element itself.');
  assert.equal(doc.querySelector('#missing'), null);
});

test('first matches reflect moves, ID changes, removals and attributes without cached node identities', () => {
  const { doc, first, nested, later } = fixture();
  first.append(later);
  nested.id = 'renamed';
  assert.equal(doc.getElementById('duplicate'), later);
  assert.equal(doc.getElementById('renamed'), nested);
  nested.remove();
  assert.equal(doc.getElementById('renamed'), null);
  later.disabled = true;
  assert.equal(doc.querySelector('button:not([disabled])'), null);
  later.disabled = false;
  assert.equal(doc.querySelector('button:not([disabled])'), later);
});

test('Document querySelector honors intentional querySelectorAll overrides and empty results', () => {
  const { doc, later } = fixture();
  const calls = [];
  doc.querySelectorAll = (selector) => {
    calls.push(selector);
    return [later];
  };
  assert.equal(doc.querySelector('#duplicate'), later);
  assert.deepEqual(calls, ['#duplicate']);
  doc.querySelectorAll = () => [];
  assert.equal(doc.getElementById('duplicate'), null);
});

test('Element and nested traversal honor custom descendant query results', () => {
  const { doc, first, later } = fixture();
  first.querySelectorAll = () => [later];
  assert.equal(first.querySelector('#duplicate'), later);
  assert.equal(doc.getElementById('duplicate'), later);
  first.querySelectorAll = () => [];
  assert.equal(first.querySelector('#duplicate'), null);
  assert.equal(doc.getElementById('duplicate'), later);
});

test('a child querySelector override cannot redefine its ancestors query engine', () => {
  const { doc, first, nested, later } = fixture();
  first.querySelector = () => later;
  assert.equal(doc.getElementById('duplicate'), nested);
  doc.documentElement.querySelector = () => later;
  assert.equal(doc.getElementById('duplicate'), nested);
});

test('first-match lookup avoids scanning later branches without changing querySelectorAll', () => {
  const { doc, nested, later } = fixture();
  let inspected = 0;
  const match = later.matches.bind(later);
  later.matches = (selector) => {
    inspected++;
    return match(selector);
  };
  assert.equal(doc.getElementById('duplicate'), nested);
  assert.equal(inspected, 0);
  assert.deepEqual(doc.querySelectorAll('#duplicate'), [nested, later]);
  assert.equal(inspected, 1);
});

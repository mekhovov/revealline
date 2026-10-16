import test from 'node:test';
import assert from 'node:assert/strict';
import { Events } from './helpers/couch-dom.mjs';

function tree() {
  const document = new Events(),
    target = new Events(),
    calls = [];
  target.parentNode = document;
  return { document, target, calls };
}

test('host capture stopImmediatePropagation prevents later listeners on the same document', () => {
  const { document, target, calls } = tree();
  document.addEventListener(
    'keydown',
    (event) => {
      calls.push('guard');
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true,
  );
  document.addEventListener('keydown', () => calls.push('navigation'), true);
  target.addEventListener('keydown', () => calls.push('target'));
  const event = target.emit('keydown');
  assert.deepEqual(calls, ['guard']);
  assert.equal(event.defaultPrevented, true);
});

test('host ordinary stopPropagation still runs other listeners on that same node', () => {
  const { document, target, calls } = tree();
  document.addEventListener(
    'click',
    (event) => {
      calls.push('first');
      event.stopPropagation();
    },
    true,
  );
  document.addEventListener('click', () => calls.push('second'), true);
  target.addEventListener('click', () => calls.push('target'));
  const event = target.emit('click');
  assert.deepEqual(calls, ['first', 'second']);
  assert.equal(event.defaultPrevented, false);
});

test('host target stopImmediatePropagation also suppresses its property handler and ancestors', () => {
  const { document, target, calls } = tree();
  target.addEventListener('click', (event) => {
    calls.push('first');
    event.stopImmediatePropagation();
  });
  target.addEventListener('click', () => calls.push('second'));
  target.onclick = () => calls.push('property');
  document.addEventListener('click', () => calls.push('ancestor'));
  assert.equal(target.dispatchEvent(new Event('click', { bubbles: true, cancelable: true })), true);
  assert.deepEqual(calls, ['first']);
});

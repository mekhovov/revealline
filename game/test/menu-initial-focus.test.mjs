import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';

function surface() {
  const document = new Document();
  const menu = document.createElement('section');
  document.body.append(menu);
  const add = (tag, id, parent = menu) => {
    const control = document.createElement(tag);
    control.id = id;
    parent.append(control);
    return control;
  };
  const first = add('button', 'first'),
    primary = add('button', 'primary');
  let scope = 'lobby';
  const navigation = attachControllerNavigation({
    document,
    getRoot: () => menu,
    getScope: () => scope,
    getDefaultFocus: () => primary,
  });
  return {
    document,
    menu,
    first,
    primary,
    navigation,
    add,
    scope: (value) => {
      scope = value;
    },
  };
}

test('one-shot focus uses the existing visible default without activating it or owning later scope changes', () => {
  const h = surface();
  let activations = 0;
  h.primary.onclick = () => {
    activations++;
  };
  assert.equal(h.navigation.focusAvailable(), h.primary);
  assert.equal(h.document.activeElement.id, 'primary');
  assert.equal(activations, 0);
  h.document.body.focus();
  h.scope('paused');
  h.navigation.sync();
  assert.equal(
    h.document.activeElement.tagName,
    'BODY',
    'One-shot focus did not engage controller ownership.',
  );
  h.navigation.engage();
  assert.equal(
    h.document.activeElement.id,
    'primary',
    'Ordinary controller engagement still works.',
  );
  h.navigation.destroy();
});

for (const kind of ['hidden', 'disabled', 'inert', 'invisible', 'closed details'])
  test(`one-shot focus excludes a ${kind} preferred control using the shared navigation filter`, () => {
    const h = surface();
    if (kind === 'invisible') h.primary.style.visibility = 'hidden';
    else if (kind === 'closed details') {
      const details = h.add('details', 'collapsed');
      h.add('summary', 'summary', details);
      details.append(h.primary);
    } else h.primary[kind] = true;
    h.navigation.focusAvailable();
    assert.equal(h.document.activeElement.id, 'first');
    h.navigation.destroy();
  });

test('one-shot focus keeps a current eligible choice and refuses destroyed, empty or flight scopes', () => {
  const h = surface();
  h.first.focus();
  h.navigation.focusAvailable();
  assert.equal(h.document.activeElement.id, 'first');
  h.document.body.focus();
  h.scope('flight');
  assert.equal(h.navigation.focusAvailable(), null);
  h.scope('lobby');
  h.first.disabled = true;
  h.primary.hidden = true;
  assert.equal(h.navigation.focusAvailable(), null);
  h.navigation.destroy();
  h.first.disabled = false;
  assert.equal(h.navigation.focusAvailable(), null);
  assert.equal(h.document.activeElement.tagName, 'BODY');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { focusEditionPresentationRecovery } from '../ui/edition-presentation-recovery.mjs';

// Routing/ownership fixture only: no native layout, controller or save-system claim.
function fixture(ownerId = 'settings-dialog') {
  const nodes = new Map();
  const calls = { home: 0, settings: 0, data: 0, workshop: 0, scroll: 0 };
  const doc = {
    getElementById: (id) => {
      const node = nodes.get(id);
      return node && doc.contains(node) ? node : null;
    },
    contains: (node) => doc.body.contains(node),
  };
  class Element {
    constructor(id, tag = 'div', parent = doc.body) {
      Object.assign(this, { id, tag, parent, open: false, hidden: false, inert: false });
      nodes.set(id, this);
    }
    contains(node) {
      for (let current = node; current; current = current.parent) if (current === this) return true;
      return false;
    }
    closest(selector) {
      for (let current = this; current; current = current.parent) {
        if (selector === 'dialog' && current.tag === 'dialog') return current;
        if (selector === 'details' && current.tag === 'details') return current;
        if (
          selector === '[hidden],[inert],[aria-hidden="true"]' &&
          (current.hidden || current.inert || current.ariaHidden === 'true')
        )
          return current;
      }
      return null;
    }
    close() {
      this.open = false;
    }
    click() {
      this.onclick?.();
    }
    focus() {
      doc.activeElement = this;
      this.onfocus?.();
    }
    scrollIntoView() {
      calls.scroll++;
    }
  }
  doc.body = new Element('body', 'body', null);
  const home = new Element('shell-home', 'dialog');
  const settings = new Element('settings-dialog', 'dialog');
  const workshop = new Element('shell-workshop-dialog', 'dialog');
  const collection = new Element('collection-dialog', 'dialog');
  const foreign = new Element('foreign', 'dialog');
  const owner = nodes.get(ownerId);
  const panel = new Element('data-panel', 'section', owner);
  panel.hidden = owner === settings;
  panel.inert = owner === settings;
  const details = new Element('recovery-details', 'details', panel);
  const choice = new Element('edition-presentation-select', 'select', details);
  const options = new Element('shell-options', 'button', home);
  const dataTab = new Element('settings-tab-data', 'button', settings);
  options.onclick = () => {
    calls.settings++;
    settings.open = true;
    doc.activeElement = dataTab;
  };
  dataTab.onclick = () => {
    calls.data++;
    panel.hidden = false;
    panel.inert = false;
    doc.activeElement = dataTab;
  };
  collection.open = true;
  doc.activeElement = collection;
  const shell = {
    openHome() {
      calls.home++;
      home.open = true;
      doc.activeElement = home;
    },
    openWorkshop() {
      calls.workshop++;
      workshop.open = true;
      doc.activeElement = workshop;
    },
  };
  return {
    doc,
    shell,
    calls,
    nodes,
    home,
    settings,
    workshop,
    collection,
    foreign,
    owner,
    panel,
    details,
    choice,
    options,
    dataTab,
    Element,
    run: () => focusEditionPresentationRecovery({ document: doc, shell }),
  };
}

for (const owner of ['settings-dialog', 'shell-home', 'shell-workshop-dialog']) {
  test(`recovery opens the exact ${owner} owner and focuses its existing selector`, () => {
    const h = fixture(owner);
    assert.equal(h.run(), true);
    assert.equal(h.doc.activeElement, h.choice);
    assert.equal(h.details.open, true);
    assert.equal(h.collection.open, false);
    assert.equal(h.calls.home, 1);
    assert.equal(h.calls.settings, Number(owner === 'settings-dialog'));
    assert.equal(h.calls.data, Number(owner === 'settings-dialog'));
    assert.equal(h.calls.workshop, Number(owner === 'shell-workshop-dialog'));
    assert.equal(h.calls.scroll, 1);
  });
}

test('same-ID replacement during Settings opening does not inherit the old selector operation', () => {
  const h = fixture();
  const open = h.options.onclick;
  h.options.onclick = () => {
    open();
    new h.Element('edition-presentation-select', 'select', h.details);
  };
  assert.equal(h.run(), false);
  assert.equal(h.calls.data, 0);
  assert.equal(h.calls.scroll, 0);
  assert.notEqual(h.doc.activeElement, h.choice);
});

test('a newer focus owner during category selection is not overridden', () => {
  const h = fixture();
  const select = h.dataTab.onclick;
  h.dataTab.onclick = () => {
    select();
    h.foreign.open = true;
    h.doc.activeElement = h.foreign;
  };
  assert.equal(h.run(), false);
  assert.equal(h.doc.activeElement, h.foreign);
  assert.equal(h.details.open, false);
  assert.equal(h.calls.scroll, 0);
});

for (const condition of ['detached', 'hidden', 'inert', 'aria-hidden', 'disabled', 'closed']) {
  test(`a ${condition} selector owner cannot receive recovery focus`, () => {
    const h = fixture();
    const select = h.dataTab.onclick;
    h.dataTab.onclick = () => {
      select();
      if (condition === 'detached') h.choice.parent = null;
      if (condition === 'hidden') h.panel.hidden = true;
      if (condition === 'inert') h.panel.inert = true;
      if (condition === 'aria-hidden') h.panel.ariaHidden = 'true';
      if (condition === 'disabled') h.choice.disabled = true;
      if (condition === 'closed') h.settings.open = false;
    };
    assert.equal(h.run(), false);
    assert.notEqual(h.doc.activeElement, h.choice);
    assert.equal(h.calls.scroll, 0);
  });
}

test('focus reentry cannot scroll a selector after another screen takes ownership', () => {
  const h = fixture();
  h.choice.onfocus = () => {
    h.doc.activeElement = h.foreign;
  };
  assert.equal(h.run(), false);
  assert.equal(h.doc.activeElement, h.foreign);
  assert.equal(h.calls.scroll, 0);
});

test('an unregistered dialog does not gain a recovery route', () => {
  const h = fixture('foreign');
  assert.equal(h.run(), false);
  assert.equal(h.calls.settings + h.calls.workshop + h.calls.data + h.calls.scroll, 0);
});

test('missing selector leaves the opened Home without attempting another route', () => {
  const h = fixture();
  h.choice.parent = null;
  assert.equal(h.run(), false);
  assert.equal(h.doc.activeElement, h.home);
  assert.equal(h.calls.settings + h.calls.workshop + h.calls.data + h.calls.scroll, 0);
});

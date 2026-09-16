import test from 'node:test';
import assert from 'node:assert/strict';
import { attachOptionalChaptersPanel } from '../ui/optional-chapters-panel.mjs';
import { Document, Element, Events } from './helpers/couch-dom.mjs';

// Exact panel code with finite native dialog/event boundaries. These cases test
// the panel lease; real flight/checkpoint/save adoption stays in the Solo host.
function fixture(t, kind, choose) {
  const doc = new Document(),
    win = new Events();
  doc.defaultView = win;
  doc.createElement = (tag) => {
    const element = new Element(doc, tag);
    if (tag === 'dialog') {
      element.showModal = () => {
        element.open = true;
        element.setAttribute('open', '');
      };
      element.close = () => {
        element.open = false;
        element.removeAttribute('open');
        element.emit('close');
      };
    }
    return element;
  };
  const pack = {
    id: 'lease-fixture',
    name: 'Lease fixture',
    campaigns: [{ levels: [{ classic: {} }] }],
    themes: [{ id: 'fpv' }],
  };
  let chosen = 0;
  const panel = attachOptionalChaptersPanel({
    document: doc,
    matchMedia: () => null,
    getLibrary: () => ({ packs: kind === 'installed' ? [pack] : [] }),
    loadCatalog: async () => ({ format: 'revealline-optional-chapters.v1', packs: [] }),
    sourceChapters:
      kind === 'source'
        ? [
            {
              id: 'source-fixture',
              controlId: 'source',
              name: 'Source fixture',
              description: 'Exact original-pair presenter fixture',
              themeId: 'fpv',
              mode: 'Arcade',
              levels: 1,
              bytes: 1024,
              inspect: async () => ({ status: 'installed' }),
              choose: (options) => choose(options),
            },
          ]
        : [],
    chooseInstalled: (_pack, options) => choose(options),
    onChosen: () => chosen++,
  });
  t.after(() => panel.dispose());
  const $ = (id) => doc.getElementById(`optional-worlds-${id}`);
  return {
    panel,
    doc,
    win,
    $,
    get chosen() {
      return chosen;
    },
    choose: () => $(kind === 'source' ? 'source-choose' : 'installed-choose-lease-fixture'),
  };
}

for (const kind of ['installed', 'source']) {
  test(`${kind}: deferred replacement survives outer operation settlement and selects only once`, async (t) => {
    let launch;
    const h = fixture(t, kind, async (options) => {
      launch = options.launch;
      return false; // The real host has opened Stay / Replace, not selected yet.
    });
    await h.panel.open();
    const choose = h.choose();
    choose.focus();
    await choose.onclick();
    assert.equal(h.$('dialog').open, true, 'False/deferred does not close the parent.');
    assert.equal(choose.disabled, false, 'The completed verification releases busy controls.');
    assert.equal(h.chosen, 0);
    assert.equal(launch.isCurrent(), true, 'The decision lease survives run finally.');
    assert.equal(launch.opener, choose);
    launch.onSelected();
    assert.equal(h.$('dialog').open, false);
    assert.equal(h.chosen, 1);
    launch.onSelected();
    assert.equal(h.chosen, 1, 'Late duplicate callback cannot select or close again.');
  });

  for (const event of ['blur', 'pagehide', 'hidden', 'close-reopen', 'dispose'])
    test(`${kind}: ${event} retires a pending Choose and its late focus/selection`, async (t) => {
      let launch, release;
      const h = fixture(t, kind, (options) => {
        launch = options.launch;
        return new Promise((resolve) => {
          release = resolve;
        });
      });
      await h.panel.open();
      const choose = h.choose();
      choose.focus();
      const pending = choose.onclick();
      assert.equal(typeof release, 'function');
      assert.equal(choose.disabled, true);
      let restores = 0;
      const focus = choose.focus.bind(choose);
      choose.focus = (...args) => {
        restores++;
        return focus(...args);
      };
      if (event === 'blur') {
        h.doc.focused = false;
        h.win.emit('blur');
        h.doc.focused = true; // Foreground return must not revive the old lease.
      } else if (event === 'pagehide') h.win.emit('pagehide');
      else if (event === 'hidden') {
        h.doc.hidden = true;
        h.doc.emit('visibilitychange');
        h.doc.hidden = false;
      } else if (event === 'close-reopen') {
        h.panel.close(false);
        await h.panel.open();
      } else h.panel.dispose();
      assert.equal(launch.isCurrent(), false);
      release(false);
      await pending;
      assert.equal(restores, 0, 'Late finally does not revive retired Choose focus.');
      const openBeforeCallback = h.$('dialog')?.open ?? false;
      launch.onSelected();
      assert.equal(h.chosen, 0);
      assert.equal(h.$('dialog')?.open ?? false, openBeforeCallback);
    });

  test(`${kind}: a nested decision keeps its focus when verification settles`, async (t) => {
    let launch;
    const h = fixture(t, kind, async (options) => {
      launch = options.launch;
      const decision = h.doc.createElement('dialog'),
        stay = h.doc.createElement('button');
      stay.id = 'fixture-stay';
      decision.append(stay);
      h.doc.body.append(decision);
      decision.showModal();
      stay.focus();
      return false;
    });
    await h.panel.open();
    const choose = h.choose();
    choose.focus();
    await choose.onclick();
    assert.equal(h.doc.activeElement.id, 'fixture-stay');
    assert.equal(choose.disabled, false);
    assert.equal(launch.isCurrent(), true);
    assert.equal(h.$('dialog').open, true);
    assert.equal(h.chosen, 0);
  });
}

test('explicit cancellation releases its Choose without stealing an already moved return focus', async (t) => {
  let launch, release;
  const h = fixture(t, 'installed', (options) => {
    launch = options.launch;
    return new Promise((resolve) => {
      release = resolve;
    });
  });
  t.after(() => release?.());
  await h.panel.open();
  const choose = h.choose();
  choose.focus();
  const pending = choose.onclick();
  assert.equal(choose.disabled, true);
  const decision = h.doc.createElement('dialog'),
    stay = h.doc.createElement('button');
  decision.append(stay);
  h.doc.body.append(decision);
  decision.showModal();
  stay.focus();
  decision.close();
  // Another close listener already made an intentional, visible parent choice.
  // This tests callback ownership, not browser top-layer layout or a live cut.
  const newer = h.$('summary');
  newer.focus();
  assert.equal(launch.onCancelled({ dialog: decision }), true);
  assert.equal(choose.disabled, false);
  assert.equal(h.doc.activeElement, newer);
  assert.equal(launch.isCurrent(), false);
  release(false);
  await pending;
  launch.onSelected();
  assert.equal(h.doc.activeElement, newer);
  assert.equal(h.$('dialog').open, true);
  assert.equal(h.chosen, 0);
});

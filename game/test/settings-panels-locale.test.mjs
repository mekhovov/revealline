import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { setLocale, t as translate } from '../i18n/index.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';

const locale = (value) => setLocale(value, { persist: false });
let moduleSequence = 0;
async function fixture(t, startup) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const doc = new Document();
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
  locale(startup);
  // Each import initializes the module under this visit's actual startup
  // language, independent of another test's already-loaded tab adapter.
  const { attachSettingsPanels, settingsTabOwnsKey } = await import(
    `../ui/settings-panels.mjs?startup=${startup}&fixture=${++moduleSequence}`
  );
  const root = doc.createElement('section');
  doc.body.append(root);
  const list = doc.createElement('div');
  list.className = 'field-kit-settings-tabs';
  root.append(list);
  const panels = [],
    tabs = [];
  for (const [index, name] of [
    'general',
    'display',
    'controls',
    'accessibility',
    'about',
  ].entries()) {
    const tab = doc.createElement('button');
    tab.id = `settings-tab-${name}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', `settings-panel-${name}`);
    tab.setAttribute('aria-selected', String(index === 2));
    list.append(tab);
    tabs.push(tab);
    const panel = doc.createElement('section');
    panel.id = `settings-panel-${name}`;
    root.append(panel);
    panels.push(panel);
  }
  const input = doc.createElement('input');
  panels[2].append(input);
  const selections = [];
  const settings = attachSettingsPanels({
    root,
    document: doc,
    beforeSelect: (tab) => {
      selections.push(tab.id);
      return false;
    },
  });
  tabs[2].focus();
  let navigation = null;
  t.after(() => {
    navigation?.destroy();
    settings.destroy();
    doc.body.replaceChildren();
    locale('en');
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else delete globalThis.document;
  });
  const owns = (target, key, extra = {}) => settingsTabOwnsKey({ target, key, ...extra }, root);
  return {
    doc,
    root,
    tabs,
    panels,
    input,
    settings,
    selections,
    owns,
    press: (key, extra = {}) => doc.activeElement.emit('keydown', { key, ...extra }),
    select(index) {
      settings.select(tabs[index].id, { focus: true });
    },
    compose() {
      const yielded = [],
        observed = [],
        back = [];
      navigation = attachControllerNavigation({
        document: doc,
        keyboard: true,
        getRoot: () => root,
        getScope: () => 'settings',
        ownsKeyboardEvent: (event) => {
          const owned = settingsTabOwnsKey(event, root);
          if (owned) yielded.push(event.key);
          return owned;
        },
        onNativeInput: (event) => observed.push(event.key),
        onBack: () => back.push(true),
      });
      return { yielded, observed, back, destroy: () => navigation.destroy() };
    },
  };
}
function assertSelection(h, index) {
  assert.equal(h.settings.selected(), h.tabs[index].id);
  assert.equal(h.doc.activeElement, h.tabs[index]);
  for (const [i, tab] of h.tabs.entries()) {
    assert.equal(tab.getAttribute('aria-selected'), String(i === index));
    assert.equal(tab.tabIndex, i === index ? 0 : -1);
    assert.equal(h.panels[i].hidden, i !== index);
    assert.equal(h.panels[i].inert, i !== index);
  }
}

for (const startup of ['en', 'uk']) {
  test(`cold ${startup}: literal Home/End keep native ownership across locale changes`, async (t) => {
    const h = await fixture(t, startup);
    for (const language of [startup, startup === 'en' ? 'uk' : 'en', startup]) {
      h.select(2);
      const count = h.selections.length;
      locale(language);
      assertSelection(h, 2);
      assert.equal(
        h.selections.length,
        count,
        'Changing language never selects or focuses a category.',
      );
      for (const [key, target] of [
        ['Home', 0],
        ['End', 4],
      ]) {
        assert.equal(h.owns(h.doc.activeElement, key), true, `${key} is owned in ${language}.`);
        const before = h.selections.length;
        const event = h.press(key);
        assert.equal(event.defaultPrevented, true);
        assert.equal(event.cancelBubble, true);
        assert.equal(h.selections.length, before + 1);
        assertSelection(h, target);
      }
    }
  });

  test(`cold ${startup}: arrows wrap and Home/End skip disabled or hidden categories`, async (t) => {
    const h = await fixture(t, startup);
    h.tabs[0].disabled = true;
    h.tabs[4].setAttribute('aria-disabled', 'true');
    h.tabs[1].hidden = true;
    for (const language of ['uk', 'en']) {
      locale(language);
      h.select(2);
      for (const [key, target] of [
        ['End', 3],
        ['ArrowRight', 2],
        ['ArrowLeft', 3],
        ['Home', 2],
      ]) {
        const count = h.selections.length;
        const event = h.press(key);
        assert.equal(event.defaultPrevented, true);
        assert.equal(h.selections.length, count + 1);
        assertSelection(h, target);
      }
      for (const index of [0, 1, 4]) {
        assert.equal(h.owns(h.tabs[index], 'Home'), false);
        assert.equal(h.owns(h.tabs[index], 'ArrowRight'), false);
      }
    }
  });

  test(`cold ${startup}: modifiers and native panel inputs keep their keys`, async (t) => {
    const h = await fixture(t, startup);
    for (const key of ['Home', 'End', 'ArrowLeft', 'ArrowRight']) {
      for (const modifier of ['ctrlKey', 'metaKey', 'altKey', 'shiftKey']) {
        const count = h.selections.length;
        assert.equal(h.owns(h.tabs[2], key, { [modifier]: true }), false);
        const event = h.press(key, { [modifier]: true });
        assert.equal(event.defaultPrevented, false);
        assert.equal(h.selections.length, count);
        assertSelection(h, 2);
      }
      assert.equal(h.owns(h.tabs[2], key, { defaultPrevented: true }), false);
    }
    for (const key of ['Enter', ' ', 'Tab', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown']) {
      assert.equal(h.owns(h.tabs[2], key), false);
      assert.equal(h.press(key).defaultPrevented, false);
      assertSelection(h, 2);
    }
    h.input.focus();
    const count = h.selections.length;
    for (const key of ['Home', 'End', 'ArrowLeft', 'ArrowRight']) {
      assert.equal(h.owns(h.input, key), false);
      assert.equal(h.press(key).defaultPrevented, false);
      assert.equal(h.doc.activeElement, h.input);
      assert.equal(h.settings.selected(), h.tabs[2].id);
    }
    assert.equal(h.selections.length, count);
  });

  test(`cold ${startup}: translated display labels never become keyboard key identities`, async (t) => {
    const h = await fixture(t, startup);
    locale('uk');
    const labels = [translate('common:navigation.home'), translate('interface:end')];
    assert.ok(labels.every((label) => !['Home', 'End'].includes(label)));
    const count = h.selections.length;
    for (const language of ['uk', 'en']) {
      locale(language);
      for (const key of labels) {
        assert.equal(h.owns(h.tabs[2], key), false);
        assert.equal(h.press(key).defaultPrevented, false);
        assertSelection(h, 2);
      }
    }
    assert.equal(h.selections.length, count);
  });

  test(`cold ${startup}: shared keyboard navigation yields exactly once to native tab handling`, async (t) => {
    const h = await fixture(t, startup),
      nav = h.compose();
    let bubbled = 0;
    h.root.addEventListener('keydown', () => bubbled++);
    for (const language of ['uk', 'en']) {
      locale(language);
      h.select(2);
      for (const [key, target] of [
        ['Home', 0],
        ['ArrowLeft', 4],
        ['End', 4],
        ['ArrowRight', 0],
      ]) {
        const before = {
          selected: h.selections.length,
          yielded: nav.yielded.length,
          observed: nav.observed.length,
        };
        const event = h.press(key);
        assert.equal(event.defaultPrevented, true);
        assert.equal(
          h.selections.length,
          before.selected + 1,
          'Only the tab handler selects a category.',
        );
        assert.equal(nav.yielded.length, before.yielded + 1);
        assert.equal(nav.observed.length, before.observed + 1);
        assert.equal(nav.yielded.at(-1), key);
        assertSelection(h, target);
      }
    }
    assert.equal(bubbled, 0, 'Consumed tab keys do not reach a second ancestor handler.');
    assert.equal(nav.back.length, 0);
  });

  test(`cold ${startup}: teardown removes navigation without changing the selected panel`, async (t) => {
    const h = await fixture(t, startup),
      nav = h.compose();
    h.select(3);
    const count = h.selections.length;
    const focus = h.doc.activeElement;
    nav.destroy();
    h.settings.destroy();
    for (const language of ['uk', 'en']) {
      locale(language);
      for (const key of ['Home', 'End', 'ArrowLeft', 'ArrowRight'])
        assert.equal(h.press(key).defaultPrevented, false);
      assert.equal(h.selections.length, count);
      assert.equal(h.doc.activeElement, focus);
      assert.equal(h.tabs[3].getAttribute('aria-selected'), 'true');
      assert.equal(h.panels[3].hidden, false);
      assert.equal(h.settings.selected(), null);
    }
  });
}

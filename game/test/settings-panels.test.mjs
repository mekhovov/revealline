import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attachSettingsPanels,
  settingsTabOwnsKey,
  settingsPanelBack,
  restoreSettingsPanelFocus,
} from '../ui/settings-panels.mjs';
import { Document } from './helpers/couch-dom.mjs';

function fixture(document = new Document(), prefix = 'settings') {
  const root = document.createElement('section'),
    list = document.createElement('div'),
    tabs = {},
    panels = {};
  list.className = 'field-kit-settings-tabs';
  list.setAttribute('role', 'tablist');
  root.append(list);
  for (const category of ['controls', 'audio', 'display', 'data']) {
    const tab = document.createElement('button'),
      panel = document.createElement('section');
    tab.id = `${prefix}-tab-${category}`;
    panel.id = `${prefix}-panel-${category}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', panel.id);
    tab.setAttribute('aria-selected', String(category === 'audio'));
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    list.append(tab);
    root.append(panel);
    tabs[category] = tab;
    panels[category] = panel;
  }
  document.body.append(root);
  return { document, root, list, tabs, panels };
}
const visiblePanels = (f) =>
  Object.entries(f.panels)
    .filter(([, panel]) => !panel.hidden && !panel.inert)
    .map(([name]) => name);

test('vertical settings arrows select categories; compact Confirm enters and Back returns once', () => {
  const f = fixture();
  f.root.classList.add('native-settings');
  f.document.defaultView.innerWidth = 390;
  f.list.setAttribute('aria-orientation', 'vertical');
  const input = f.document.createElement('input');
  f.panels.display.append(input);
  const panels = attachSettingsPanels(f);
  f.tabs.audio.focus();
  assert.equal(settingsTabOwnsKey({ key: 'ArrowRight', target: f.tabs.audio }, f.root), false);
  assert.equal(settingsTabOwnsKey({ key: 'ArrowDown', target: f.tabs.audio }, f.root), true);
  f.tabs.audio.emit('keydown', { key: 'ArrowDown' });
  assert.equal(panels.selected(), f.tabs.display.id);
  assert.equal(f.document.activeElement, f.tabs.display);
  assert.equal(f.root.getAttribute('data-settings-view'), 'categories');
  f.tabs.display.click();
  assert.equal(f.root.getAttribute('data-settings-view'), 'panel');
  assert.equal(f.document.activeElement, input);
  f.root.hidden = true;
  f.document.body.focus();
  assert.equal(
    settingsPanelBack(f.document.body),
    false,
    'a closed Settings screen cannot consume landing Back',
  );
  assert.equal(f.document.activeElement, f.document.body);
  assert.equal(f.root.getAttribute('data-settings-view'), 'panel');
  f.root.hidden = false;
  assert.equal(settingsPanelBack(f.root), true);
  assert.equal(f.root.getAttribute('data-settings-view'), 'categories');
  assert.equal(f.document.activeElement, f.tabs.display);
  assert.equal(settingsPanelBack(f.root), false);
  panels.destroy();
  assert.equal(settingsPanelBack(f.root), false);
});

test('compact native dialog cancellation returns to categories before allowing parent cancellation', () => {
  const f = fixture();
  f.root.classList.add('native-settings');
  f.document.defaultView.innerWidth = 640;
  const input = f.document.createElement('input');
  f.panels.audio.append(input);
  const panels = attachSettingsPanels(f);
  let parentCancellations = 0;
  f.root.addEventListener('cancel', () => parentCancellations++);
  f.tabs.audio.click();
  assert.equal(f.root.emit('cancel').defaultPrevented, true);
  assert.equal(parentCancellations, 0, 'consumed Back cannot reach a later host dialog listener');
  assert.equal(f.root.emit('cancel').defaultPrevented, false);
  assert.equal(parentCancellations, 1, 'second Back belongs to the host close lifecycle');
  f.document.defaultView.innerWidth = 1024;
  f.tabs.audio.click();
  assert.equal(settingsPanelBack(f.root), false, 'wide settings retain a single screen');
  panels.destroy();
});

test('mount respects the authored category and keeps existing controls, values and focus', () => {
  const f = fixture(),
    input = f.document.createElement('input'),
    outside = f.document.createElement('button');
  input.value = 'authored preference';
  f.panels.controls.append(input);
  f.document.body.append(outside);
  outside.focus();
  let hooks = 0;
  const panels = attachSettingsPanels({
    ...f,
    beforeSelect: () => {
      hooks++;
    },
  });
  assert.equal(panels.selected(), f.tabs.audio.id);
  assert.equal(panels.primary(), f.tabs.audio);
  assert.deepEqual(visiblePanels(f), ['audio']);
  assert.equal(f.document.activeElement, outside);
  assert.equal(hooks, 0);
  assert.equal(panels.select(f.tabs.display.id), true);
  assert.deepEqual(visiblePanels(f), ['display']);
  assert.equal(f.document.activeElement, outside, 'programmatic selection does not steal focus');
  assert.equal(f.panels.controls.children[0], input);
  assert.equal(input.value, 'authored preference');
  assert.equal(hooks, 1);
  assert.equal(f.tabs.audio.getAttribute('aria-selected'), 'false');
  assert.equal(f.tabs.audio.tabIndex, -1);
  assert.equal(f.tabs.display.getAttribute('aria-selected'), 'true');
  assert.equal(f.tabs.display.tabIndex, 0);
  panels.destroy();
});

test('tab arrows wrap and Home/End select before focus without bubbling a game command', () => {
  const f = fixture(),
    panels = attachSettingsPanels(f);
  let leaked = 0;
  f.root.addEventListener('keydown', () => leaked++);
  f.tabs.audio.focus();
  for (const [key, expected] of [
    ['ArrowRight', 'display'],
    ['End', 'data'],
    ['ArrowRight', 'controls'],
    ['ArrowLeft', 'data'],
    ['Home', 'controls'],
  ]) {
    const event = f.document.activeElement.emit('keydown', { key });
    assert.equal(event.defaultPrevented, true, key);
    assert.equal(event.cancelBubble, true, key);
    assert.equal(panels.primary(), f.tabs[expected]);
    assert.equal(f.document.activeElement, f.tabs[expected]);
    assert.deepEqual(visiblePanels(f), [expected]);
  }
  assert.equal(leaked, 0);
  panels.destroy();
});

test('capture-phase navigation recognizes only owned visible tab keys', () => {
  const f = fixture(),
    other = fixture(f.document, 'other'),
    child = f.document.createElement('span');
  f.tabs.audio.append(child);
  const event = { key: 'ArrowRight', target: child };
  assert.equal(settingsTabOwnsKey(event, f.root), true);
  assert.equal(settingsTabOwnsKey(event, other.root), false);
  for (const key of ['ArrowUp', 'ArrowDown', 'Enter', ' ', 'Tab', 'Escape'])
    assert.equal(settingsTabOwnsKey({ ...event, key }, f.root), false, key);
  for (const flag of ['ctrlKey', 'metaKey', 'altKey', 'shiftKey', 'defaultPrevented'])
    assert.equal(settingsTabOwnsKey({ ...event, [flag]: true }, f.root), false, flag);
  f.root.hidden = true;
  assert.equal(settingsTabOwnsKey(event, f.root), false);
  f.root.hidden = false;
  f.list.inert = true;
  assert.equal(settingsTabOwnsKey(event, f.root), false);
  f.list.inert = false;
  f.tabs.audio.style.visibility = 'hidden';
  assert.equal(settingsTabOwnsKey(event, f.root), false);
  f.tabs.audio.style.visibility = 'visible';
  f.tabs.audio.disabled = true;
  assert.equal(settingsTabOwnsKey(event, f.root), false);
  assert.equal(settingsTabOwnsKey(event, null), false);
});

test('owned tabs cannot toggle another root or a replaced panel', () => {
  const f = fixture(),
    other = fixture(f.document, 'other');
  f.tabs.data.setAttribute('aria-controls', other.panels.data.id);
  const panels = attachSettingsPanels(f),
    before = [other.panels.data.hidden, other.panels.data.inert];
  assert.equal(panels.select(f.tabs.data.id), false);
  assert.equal(panels.select(other.tabs.audio.id), false);
  assert.equal(panels.select('missing'), false);
  assert.equal(settingsTabOwnsKey({ key: 'Home', target: f.tabs.data }, f.root), false);
  assert.deepEqual([other.panels.data.hidden, other.panels.data.inert], before);
  other.root.append(f.panels.display);
  assert.equal(panels.select(f.tabs.display.id), false);
  f.tabs.display.click();
  assert.equal(panels.selected(), f.tabs.audio.id);
  assert.equal(f.panels.display.hidden, true, 'a moved panel is not mutated by its former owner');
  panels.destroy();
});

test('a native cancellation hook may request focus without changing control values', () => {
  const f = fixture(),
    binding = f.document.createElement('button');
  f.panels.controls.append(binding);
  let capturing = false;
  const panels = attachSettingsPanels({
    ...f,
    beforeSelect(tab) {
      if (!capturing || tab === f.tabs.controls) return false;
      capturing = false;
      binding.focus(); // The existing cancellation action returns to its binding.
      return true;
    },
  });
  panels.select(f.tabs.controls.id);
  capturing = true;
  binding.focus();
  f.tabs.audio.click();
  assert.equal(capturing, false);
  assert.equal(f.document.activeElement, f.tabs.audio);
  assert.deepEqual(visiblePanels(f), ['audio']);
  panels.destroy();
});

test('a newer hook selection or removed root cannot be overwritten or refocused', () => {
  const f = fixture();
  let panels;
  panels = attachSettingsPanels({
    ...f,
    beforeSelect(tab) {
      if (tab === f.tabs.controls) panels.select(f.tabs.display.id, { focus: true });
      if (tab === f.tabs.data) f.root.remove();
    },
  });
  assert.equal(panels.select(f.tabs.controls.id, { focus: true }), false);
  assert.equal(panels.selected(), f.tabs.display.id);
  assert.equal(f.document.activeElement, f.tabs.display);
  assert.equal(panels.select(f.tabs.data.id, { focus: true }), false);
  assert.equal(panels.selected(), null);
  assert.equal(panels.primary(), null);
  panels.destroy();
});

test('disabled tabs are skipped and their previous panel still closes', () => {
  const f = fixture(),
    panels = attachSettingsPanels(f);
  f.tabs.audio.disabled = true;
  assert.equal(panels.select(f.tabs.audio.id), false);
  f.tabs.controls.emit('keydown', { key: 'ArrowRight' });
  assert.equal(panels.selected(), f.tabs.display.id);
  assert.deepEqual(visiblePanels(f), ['display']);
  panels.destroy();
});

test('a target hidden or disabled by its host hook does not replace the current panel or focus', () => {
  for (const state of ['hidden', 'disabled', 'aria-disabled']) {
    const f = fixture(),
      panels = attachSettingsPanels({
        ...f,
        beforeSelect(tab) {
          if (state === 'aria-disabled') tab.setAttribute(state, 'true');
          else tab[state] = true;
          return true;
        },
      });
    f.tabs.audio.focus();
    assert.equal(panels.select(f.tabs.display.id, { focus: true }), false, state);
    assert.equal(panels.selected(), f.tabs.audio.id, state);
    assert.deepEqual(visiblePanels(f), ['audio'], state);
    assert.equal(f.tabs.audio.getAttribute('aria-selected'), 'true', state);
    assert.equal(f.tabs.display.getAttribute('aria-selected'), 'false', state);
    assert.equal(f.document.activeElement, f.tabs.audio, state);
    panels.destroy();
  }
});

test('destroy and absent supporting-page roots leave no active listeners or focus changes', () => {
  const f = fixture(),
    panels = attachSettingsPanels(f);
  panels.select(f.tabs.display.id, { focus: true });
  panels.destroy();
  panels.destroy();
  f.tabs.audio.click();
  const event = f.tabs.display.emit('keydown', { key: 'Home' });
  assert.equal(event.defaultPrevented, false);
  assert.equal(panels.select(f.tabs.controls.id, { focus: true }), false);
  assert.equal(panels.selected(), null);
  assert.equal(panels.primary(), null);
  assert.deepEqual(visiblePanels(f), ['display']);
  assert.equal(f.document.activeElement, f.tabs.display);
  for (const root of [undefined, null, f.document.createElement('section')]) {
    const empty = attachSettingsPanels({ root, document: f.document });
    assert.equal(empty.select('anything'), false);
    assert.equal(empty.selected(), null);
    assert.equal(empty.primary(), null);
    empty.destroy();
  }
});

test('presentation notifications observe committed category, compact Back and resize owners; rejected selection publishes nothing', () => {
  const f = fixture();
  f.root.classList.add('native-settings');
  f.document.defaultView.innerWidth = 390;
  const events = [];
  let reject = false;
  const panels = attachSettingsPanels({
    ...f,
    beforeSelect(tab) {
      if (reject) tab.disabled = true;
    },
    onPresentationChange() {
      events.push({ panel: visiblePanels(f), view: f.root.getAttribute('data-settings-view') });
    },
  });
  assert.deepEqual(events, []);
  panels.select(f.tabs.data.id, { drill: true });
  assert.deepEqual(events.at(-1), { panel: ['data'], view: 'panel' });
  const unchanged = events.length;
  panels.select(f.tabs.data.id, { drill: true });
  assert.equal(
    events.length,
    unchanged,
    'Selecting the same committed panel does not retire its report.',
  );
  panels.back();
  assert.deepEqual(events.at(-1), { panel: ['data'], view: 'categories' });
  f.tabs.data.emit('keydown', { key: 'ArrowLeft' });
  assert.deepEqual(events.at(-1), { panel: ['display'], view: 'categories' });
  const count = events.length;
  reject = true;
  assert.equal(panels.select(f.tabs.controls.id), false);
  assert.equal(events.length, count);
  reject = false;
  panels.focusPanel();
  f.tabs.display.focus();
  f.document.defaultView.emit('resize');
  assert.equal(events.at(-1).view, 'categories');
  panels.destroy();
  assert.equal(events.length, count + 3);
});

test('a presentation notification that retires settings cannot restore the old panel focus', () => {
  const f = fixture();
  let panels,
    retire = false;
  panels = attachSettingsPanels({
    ...f,
    onPresentationChange() {
      if (retire) {
        retire = false;
        panels.destroy();
        f.document.body.focus();
      }
    },
  });
  retire = true;
  assert.equal(panels.select(f.tabs.data.id, { focus: true }), false);
  assert.equal(f.document.activeElement, f.document.body);
});

test('compact CSS breakpoint changes notify with unchanged categories and outside focus; same-side resizes do not', () => {
  const f = fixture();
  f.root.classList.add('native-settings');
  f.document.defaultView.innerWidth = 1000;
  const notifications = [];
  const panels = attachSettingsPanels({
    ...f,
    onPresentationChange() {
      notifications.push({
        width: f.document.defaultView.innerWidth,
        view: f.root.getAttribute('data-settings-view'),
        active: f.document.activeElement,
      });
    },
  });
  panels.select(f.tabs.data.id);
  notifications.length = 0;
  f.document.body.focus();
  for (const width of [1000, 701, 700, 699, 320, 1000]) {
    f.document.defaultView.innerWidth = width;
    f.document.defaultView.emit('resize');
  }
  assert.deepEqual(
    notifications.map(({ width, view }) => ({ width, view })),
    [
      { width: 700, view: 'categories' },
      { width: 1000, view: 'categories' },
    ],
  );
  assert.ok(notifications.every(({ active }) => active === f.document.body));
  panels.destroy();
});

test('tool return notifies only committed view changes and keeps the original focus owner', () => {
  const f = fixture();
  f.root.classList.add('native-settings');
  f.document.defaultView.innerWidth = 390;
  const input = f.document.createElement('input');
  f.panels.data.append(input);
  const events = [];
  const panels = attachSettingsPanels({
    ...f,
    onPresentationChange: () => events.push(f.root.dataset.settingsView),
  });
  panels.select(f.tabs.data.id, { drill: true });
  panels.focusCategories();
  events.length = 0;
  assert.equal(restoreSettingsPanelFocus(f.root, input), true);
  assert.equal(f.document.activeElement === input, true);
  assert.deepEqual(events, ['panel']);
  restoreSettingsPanelFocus(f.root, input);
  assert.deepEqual(events, ['panel'], 'An unchanged visible panel is not retired.');
  panels.destroy();
});

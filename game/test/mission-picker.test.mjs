import test from 'node:test';
import assert from 'node:assert/strict';
import { attachMissionPicker } from '../ui/mission-picker.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';
import { soloPage, settle } from './helpers/solo-dom.mjs';

const card = (h, value) =>
  [...h.$('mission-picker-cards').children].find(
    (node) => node.getAttribute('data-pack') === value,
  );
const setup = async (t, options) => {
  const h = await soloPage(t, options),
    picker = attachMissionPicker({ document: h.doc });
  t.after(() => picker.destroy());
  assert.ok(picker);
  return { h, picker };
};

test('actual controls are moved once, native loadout edits and locked missions survive, and destroy restores original nodes', async (t) => {
  const h = await soloPage(t),
    deck = h.doc.querySelector('.flight-deck');
  // Also works once the production host attaches the enhancement at startup.
  attachMissionPicker({ document: h.doc })?.destroy();
  const before = [...deck.children],
    missions = h.$('missions'),
    buttons = [...missions.children];
  const locked = buttons.filter((button) => button.disabled);
  assert.ok(locked.length > 0);
  const picker = attachMissionPicker({ document: h.doc });
  assert.equal(attachMissionPicker({ document: h.doc }), picker);
  assert.equal(h.$('mission-picker-setup').open, false);
  assert.equal(h.$('mission-picker-missions').contains(missions), true);
  assert.equal(h.$('mission-picker-missions').contains(h.$('content-select-status')), true);
  assert.deepEqual(
    [...missions.children],
    buttons,
    'Mission handlers and native disabled state are reused',
  );
  for (const id of ['pack-select', 'level-select', 'class-select', 'turn-select', 'body-select'])
    assert.equal(h.$('mission-picker-setup').contains(h.$(id)), true);
  const tick = h.rendered.run.tick;
  for (const button of locked) button.click();
  assert.equal(h.rendered.run.tick, tick);
  picker.revealSetup();
  assert.equal(h.$('mission-picker-setup').open, true);
  h.change('turn-select', 'grid-center');
  h.frame(0);
  assert.equal(h.rendered.run.turnPolicy, 'grid-center');
  picker.destroy();
  assert.deepEqual([...deck.children], before);
  assert.equal(h.$('mission-picker-stage'), null);
  assert.equal(h.$('missions'), missions);
});

test('chapter activation dispatches one real change; a pending install cannot receive a second card command', async (t) => {
  const { h, picker } = await setup(t);
  const originalFetch = globalThis.fetch;
  let finish,
    fetched = 0,
    changes = 0;
  const waiting = new Promise((resolve) => {
    finish = resolve;
  });
  globalThis.fetch = async (url, ...args) => {
    if (url === 'content/packs/night-shift.json') {
      fetched++;
      await waiting;
    }
    return originalFetch(url, ...args);
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  h.$('pack-select').addEventListener('change', () => changes++);
  const current = h.$('pack-select').value,
    target = card(h, 'night-shift');
  const sourceLabel = [...h.$('pack-select').options].find(
    (option) => option.value === 'night-shift',
  ).label;
  assert.match(sourceLabel, / · install on select$/u);
  const chapterLabel = sourceLabel.replace(/ · install on select$/u, '');
  assert.match(chapterLabel, / · \d+ levels?$/u);
  assert.equal(target.children[0].textContent, chapterLabel);
  target.click();
  assert.equal(changes, 1);
  assert.equal(h.$('pack-select').disabled, true);
  assert.equal(target.disabled, true);
  assert.equal(
    card(h, current).getAttribute('aria-pressed'),
    'true',
    'Prior chapter remains selected until host adoption',
  );
  assert.equal(h.$('mission-picker-chapters').getAttribute('aria-busy'), 'true');
  card(h, 'living-threads').click();
  target.click();
  assert.equal(changes, 1);
  finish();
  await settle(() => !h.$('pack-select').disabled);
  picker.sync();
  h.frame(0);
  assert.equal(fetched, 1);
  assert.equal(h.$('pack-select').value, 'night-shift');
  assert.equal(card(h, 'night-shift').getAttribute('aria-pressed'), 'true');
  assert.equal(card(h, 'night-shift'), target, 'Async host option rebuild retains card identity');
  assert.equal(target.children[0].textContent, chapterLabel);
  assert.equal(
    [...h.$('pack-select').options].find((option) => option.value === 'night-shift').label,
    `${chapterLabel} · installed`,
    'Flight setup retains the exact authoritative install label',
  );
  assert.match(h.$('content-select-status').textContent, /selected and ready/);
  assert.equal(h.rendered.run.tick, 0);
  assert.equal(h.rendered.run.levelId, h.$('level-select').value);
});

test('failed native install preserves the prior pack, mission and saved bytes and exposes the host error', async (t) => {
  const { h, picker } = await setup(t);
  const originalFetch = globalThis.fetch,
    current = h.$('pack-select').value;
  const prior = new Map(h.storage.map),
    run = h.rendered.run;
  globalThis.fetch = async (url, ...args) => {
    if (url === 'content/packs/night-shift.json') throw new Error('Chapter download unavailable');
    return originalFetch(url, ...args);
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  card(h, 'night-shift').click();
  await settle(() => !h.$('pack-select').disabled);
  picker.sync();
  h.frame(0);
  assert.equal(h.$('pack-select').value, current);
  assert.equal(h.rendered.run, run);
  assert.deepEqual(h.storage.map, prior);
  assert.match(h.$('content-select-status').textContent, /Chapter download unavailable/);
  assert.equal(h.$('mission-picker-stage').getAttribute('data-status'), 'error');
  assert.equal(card(h, current).getAttribute('aria-pressed'), 'true');
  assert.equal(
    card(h, 'night-shift').disabled,
    false,
    'A failed install remains deliberately retryable',
  );
});

test('sync follows native selection/options/disabled state without dispatching or reviving removed chapter controls', async (t) => {
  const { h, picker } = await setup(t);
  let changes = 0;
  h.$('pack-select').addEventListener('change', () => changes++);
  const target = card(h, 'night-shift');
  target.focus();
  const options = [...h.$('pack-select').options];
  h.$('pack-select').replaceChildren(
    ...options.map((o) => new globalThis.Option(o.label, o.value)),
  );
  h.$('pack-select').value = 'night-shift';
  picker.sync();
  assert.equal(card(h, 'night-shift'), target);
  assert.equal(h.doc.activeElement, target);
  assert.equal(changes, 0);
  h.$('pack-select').disabled = true;
  picker.sync();
  assert.equal(target.disabled, true);
  target.click();
  assert.equal(changes, 0);
  h.$('pack-select').disabled = false;
  h.$('pack-select').replaceChildren(new globalThis.Option('Base game', ''));
  h.$('pack-select').value = '';
  picker.sync();
  target.disabled = false;
  target.click();
  assert.equal(changes, 0);
  assert.equal(target.isConnected, false);
  assert.equal(card(h, 'night-shift'), undefined);
});

test('native summary and chapter cards use the existing controller adapter; current chapter selects missions without resetting', async (t) => {
  const { h, picker } = await setup(t);
  const nav = attachControllerNavigation({
    document: h.doc,
    getRoot: () => h.doc.querySelector('.flight-deck'),
  });
  t.after(() => nav.destroy());
  let changes = 0;
  h.$('pack-select').addEventListener('change', () => changes++);
  // Exercise the retained native picker after a real pause, without giving
  // the asynchronous unified gallery simultaneous ownership of menu input.
  assert.equal(h.$('shell-missions').open, false);
  h.$('shell-menu').click();
  h.$('shell-home').close();
  h.$('shell-missions').showModal();
  assert.equal(h.$('shell-missions').open, true);
  assert.equal(picker.focusSelectedChapter(), true);
  nav.engage();
  nav.handle({ confirm: true });
  assert.equal(changes, 0);
  assert.ok(h.$('missions').contains(h.doc.activeElement));
  const summary = h.$('mission-picker-setup').querySelector('summary');
  // The minimal DOM does not implement the browser's native summary default.
  summary.addEventListener('click', (event) => {
    if (!event.defaultPrevented) summary.parentElement.open = !summary.parentElement.open;
  });
  summary.focus();
  nav.handle({ confirm: true });
  assert.equal(h.$('mission-picker-setup').open, true);
  assert.equal(h.rendered.run.tick, 0);
});

test('source-only observation synchronizes status and options and cannot recreate controls after destroy', async (t) => {
  const h = await soloPage(t);
  attachMissionPicker({ document: h.doc })?.destroy();
  let observer;
  h.doc.defaultView.MutationObserver = class {
    targets = [];
    constructor(callback) {
      this.callback = callback;
      observer = this;
    }
    observe(target) {
      this.targets.push(target);
    }
    disconnect() {
      this.disconnected = true;
    }
  };
  const picker = attachMissionPicker({ document: h.doc });
  assert.deepEqual(observer.targets, [
    h.$('pack-select'),
    h.$('level-select'),
    h.$('content-select-status'),
  ]);
  const option = [...h.$('pack-select').options].find((item) => item.value === 'night-shift');
  option.label = 'A newly named chapter';
  option.disabled = true;
  h.$('content-select-status').dataset.kind = 'error';
  h.$('content-select-status').textContent = 'Exact host error remains here.';
  observer.callback();
  await Promise.resolve();
  assert.equal(card(h, 'night-shift').disabled, true);
  assert.equal(card(h, 'night-shift').children[0].textContent, option.label);
  assert.equal(h.$('mission-picker-stage').getAttribute('data-status'), 'error');
  assert.equal(h.$('content-select-status').textContent, 'Exact host error remains here.');
  observer.callback();
  picker.destroy();
  await Promise.resolve();
  assert.equal(observer.disconnected, true);
  assert.equal(h.$('mission-picker-stage'), null);
});

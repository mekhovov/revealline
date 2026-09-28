import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { createEarnedResultLayout } from '../ui/earned-result-layout.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';
import { attachQuickMusicControls } from '../ui/quick-music-controls.mjs';

function fixture() {
  const document = new Document(),
    unit = document.createElement('section'),
    reading = document.createElement('div'),
    result = document.createElement('section'),
    actions = document.createElement('div');
  unit.id = 'overlay-reading-unit';
  reading.id = 'overlay-reading';
  result.id = 'completion-reward-result';
  actions.className = 'overlay-actions';
  document.body.append(unit);
  unit.append(reading, result, actions);
  const buttons = {};
  for (const id of [
    'start-button',
    'next-button',
    'view-picture',
    'retry-button',
    'journey-save-options',
    'flight-preparation-cancel',
    'overlay-menu',
    'skip-mission',
    'watch-first-cut',
  ]) {
    const button = document.createElement('button');
    button.id = id;
    button.textContent = id;
    actions.append(button);
    buttons[id] = button;
  }
  buttons['start-button'].hidden = true;
  const note = document.createElement('p');
  note.id = 'overlay-footnote';
  note.textContent = 'Optional advice.';
  unit.append(note);
  const save = document.createElement('p');
  save.className = 'completion-reward-save-note';
  save.textContent = 'Keep a backup.';
  result.append(save);
  const originals = [...actions.children],
    layout = createEarnedResultLayout({ document, reading, result }),
    run = { status: 'won' };
  return { document, unit, reading, result, actions, buttons, note, save, originals, layout, run };
}

test('earned layout preserves immediate actions and restores every existing node and handler on leaving results', () => {
  const f = fixture(),
    calls = [];
  for (const [id, button] of Object.entries(f.buttons)) button.onclick = () => calls.push(id);
  f.layout.sync(true, f.run);
  const more = f.document.getElementById('earned-result-more');
  assert.equal(more.open, false);
  for (const id of [
    'next-button',
    'retry-button',
    'view-picture',
    'journey-save-options',
    'flight-preparation-cancel',
  ]) {
    assert.equal(f.buttons[id].parentElement, f.actions);
    f.buttons[id].click();
  }
  assert.equal(f.buttons['overlay-menu'].closest('details'), more);
  assert.equal(f.note.closest('details'), more);
  assert.equal(f.save.closest('details'), more);
  more.open = true;
  f.buttons['overlay-menu'].click();
  assert.deepEqual(calls, [
    'next-button',
    'retry-button',
    'view-picture',
    'journey-save-options',
    'flight-preparation-cancel',
    'overlay-menu',
  ]);
  f.layout.sync(false, null);
  assert.equal(more.hidden, true);
  assert.equal(more.open, false);
  assert.deepEqual(
    f.actions.children.filter((node) => node !== more),
    f.originals,
  );
  assert.equal(f.note.parentElement, f.unit);
  assert.equal(f.save.parentElement, f.result);
  f.layout.dispose();
  assert.equal(f.document.querySelector('[data-earned-result-anchor]'), null);
  assert.deepEqual(f.actions.children, f.originals);
});

test('late native soundtrack rows keep their real player owner and restore after the unchanged Start anchor', () => {
  const f = fixture(),
    calls = [];
  f.layout.sync(true, f.run);
  const music = attachQuickMusicControls({
    document: f.document,
    prefix: 'layout',
    after: [f.buttons['start-button']],
    snapshot: () => ({
      desired: false,
      status: 'paused',
      track: { title: 'Track' },
      queue: ['one'],
    }),
    play: () => calls.push('play'),
    pause: () => calls.push('pause'),
    next: () => calls.push('next'),
    getStorage: () => null,
  });
  const row = f.document.getElementById('layout-quick-music-0');
  assert.equal(row.parentElement, f.actions);
  f.layout.sync(true, f.run);
  assert.equal(row.closest('details').id, 'earned-result-more');
  row.querySelector('button').click();
  assert.deepEqual(calls, ['play']);
  f.layout.sync(false, null);
  assert.equal(row.parentElement, f.actions);
  assert.equal(
    f.actions.children.indexOf(row),
    f.actions.children.indexOf(f.buttons['start-button']) + 1,
  );
  f.layout.dispose();
  music.dispose();
});

test('existing keyboard/controller navigation opens native More and Back restores focus without launching', () => {
  const f = fixture();
  let launches = 0;
  f.buttons['next-button'].onclick = () => launches++;
  f.layout.sync(true, f.run);
  const more = f.document.getElementById('earned-result-more'),
    summary = more.querySelector('summary');
  const navigation = attachControllerNavigation({
    document: f.document,
    keyboard: true,
    getScope: () => 'won',
    getRoot: () => f.unit,
    getDefaultFocus: () => f.buttons['next-button'],
    onBack: () => f.layout.close(),
  });
  navigation.engage();
  summary.focus();
  navigation.handle({ confirm: true });
  assert.equal(more.open, true);
  f.buttons['overlay-menu'].focus();
  navigation.handle({ back: true });
  assert.equal(more.open, false);
  assert.equal(f.document.activeElement, summary);
  assert.equal(launches, 0);
  summary.focus();
  assert.equal(summary.emit('keydown', { key: 'Enter' }).defaultPrevented, false);
  // The adapter leaves Enter to the browser's native summary activation.
  summary.click();
  assert.equal(more.open, true);
  summary.emit('keydown', { key: 'Escape' });
  assert.equal(more.open, false);
  assert.equal(launches, 0);
  more.open = true;
  f.unit.hidden = true;
  assert.equal(f.layout.close(), false, 'Hidden results cannot consume another surface’s Back.');
  f.layout.sync(false, null);
  assert.equal(more.open, false);
  f.unit.hidden = false;
  f.layout.sync(true, f.run);
  assert.equal(more.open, false);
  navigation.destroy();
  f.layout.dispose();
});

test('host-disposed or reparented controls are not resurrected or reclaimed from their owner', () => {
  for (const refreshFirst of [false, true]) {
    const f = fixture();
    f.layout.sync(true, f.run);
    const music = attachQuickMusicControls({
      document: f.document,
      prefix: 'disposed',
      after: [f.buttons['start-button']],
      snapshot: () => ({ desired: false, status: 'paused', track: null, queue: [] }),
      getStorage: () => null,
    });
    const row = f.document.getElementById('disposed-quick-music-0');
    f.layout.sync(true, f.run);
    assert.equal(row.closest('details').id, 'earned-result-more');
    music.dispose();
    f.document.body.append(f.buttons['overlay-menu'], f.note);
    if (refreshFirst) f.layout.sync(true, f.run);
    f.layout.sync(false, null);
    assert.equal(row.isConnected, false, 'Disposal remains owned by the real soundtrack host.');
    assert.equal(f.buttons['overlay-menu'].parentElement, f.document.body);
    assert.equal(f.note.parentElement, f.document.body);
    assert.equal(f.document.querySelector('[data-earned-result-anchor]'), null);
    f.layout.dispose();
  }
});

test('repeated result refreshes retire old save notices and keep a deliberate disclosure open for its exact run', () => {
  const f = fixture();
  f.layout.sync(true, f.run);
  const more = f.document.getElementById('earned-result-more');
  more.open = true;
  for (let index = 0; index < 20; index++) {
    f.result.replaceChildren();
    const note = f.document.createElement('p');
    note.className = 'completion-reward-save-note';
    f.result.append(note);
    f.layout.sync(true, f.run);
    assert.equal(more.open, true);
    assert.equal(more.querySelectorAll('.completion-reward-save-note').length, 1);
  }
  f.layout.sync(true, { status: 'won' });
  assert.equal(more.open, false);
  f.layout.dispose();
  assert.equal(f.document.getElementById('earned-result-more'), null);
  assert.equal(f.document.querySelector('[data-earned-result-anchor]'), null);
});

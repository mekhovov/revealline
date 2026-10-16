import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Document, Events } from './helpers/couch-dom.mjs';
import {
  attachMenuRetune,
  commitMenuRetune,
  menuRetuneOrigin,
  MENU_RETUNE_MS,
} from '../ui/menu-retune.mjs';
import { setMenuAnimation } from '../ui/menu-scenes.mjs';
import { attachMissionLibraryChooser } from '../ui/mission-library-chooser.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';

function fixture(t) {
  const doc = new Document(),
    win = doc.defaultView,
    values = new Map(),
    timers = new Map();
  const reduced = Object.assign(new Events(), { matches: false });
  win.matchMedia = () => reduced;
  win.localStorage = {
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
  };
  let mutations,
    observing = false,
    observedOptions,
    time = 0,
    sequence = 0;
  win.MutationObserver = class {
    constructor(callback) {
      mutations = callback;
    }
    observe(_target, options) {
      observing = true;
      observedOptions = options;
    }
    disconnect() {
      observing = false;
    }
  };
  const root = doc.createElement('section'),
    opener = doc.createElement('button'),
    scene = doc.createElement('div');
  root.className = 'native-landing';
  scene.className = 'menu-scene';
  root.append(scene, opener);
  doc.body.append(root);
  const destination = doc.createElement('dialog');
  destination.className = 'mission-library-chooser';
  doc.body.append(destination);
  const context = {};
  const owner = attachMenuRetune({
    root,
    getContext: () => context,
    now: () => time,
    schedule(callback, delay) {
      const id = ++sequence;
      timers.set(id, { callback, at: time + delay });
      return id;
    },
    unschedule: (id) => timers.delete(id),
  });
  t.after(() => owner.dispose());
  return {
    doc,
    win,
    root,
    opener,
    scene,
    destination,
    owner,
    context,
    reduced,
    timers,
    mutations: (type = 'attributes') => {
      if (observing && observedOptions[type]) mutations();
    },
    observing: () => observing,
    advance(ms) {
      time += ms;
      for (const [id, job] of [...timers])
        if (job.at <= time) {
          timers.delete(id);
          job.callback();
        }
    },
  };
}
const active = (root) =>
  root.querySelector('.menu-retune-layer')?.getAttribute('data-active') === 'true';

test('explicit committed navigation paints only one inert decorative layer and never owns input or focus', (t) => {
  const f = fixture(t);
  assert.equal(f.observing(), false, 'No document mutation work while idle.');
  assert.equal(menuRetuneOrigin(f.opener), f.root);
  assert.equal(
    commitMenuRetune(f.root, f.destination),
    false,
    'An unopened target is not a commit.',
  );
  f.destination.showModal();
  f.opener.focus();
  assert.equal(commitMenuRetune(f.root, f.destination), true);
  const layer = f.destination.querySelector('.menu-retune-layer');
  assert.equal(layer.getAttribute('aria-hidden'), 'true');
  assert.equal(layer.getAttribute('inert'), '');
  assert.equal(f.doc.activeElement, f.opener);
  assert.equal(f.observing(), true);
  assert.equal(f.timers.size, 1);
  f.advance(MENU_RETUNE_MS);
  assert.equal(active(f.destination), false);
  assert.equal(f.observing(), false);
  f.advance(800);
  f.destination.close();
  assert.equal(commitMenuRetune(f.destination, f.root), true);
  assert.equal(f.root.querySelector('.menu-retune-layer').parentNode, f.scene);
});

test('rapid navigation cancels the old burst without restarting or queueing another', (t) => {
  const f = fixture(t);
  f.destination.showModal();
  commitMenuRetune(f.root, f.destination);
  const stale = [...f.timers.values()][0].callback;
  f.advance(80);
  f.destination.close();
  assert.equal(commitMenuRetune(f.destination, f.root), false);
  assert.equal(active(f.destination), false);
  assert.equal(f.timers.size, 0);
  f.advance(800);
  f.destination.showModal();
  assert.equal(commitMenuRetune(f.root, f.destination), true);
  stale();
  assert.equal(active(f.destination), true, 'A retired timeout cannot cancel a later burst.');
  assert.equal(f.destination.querySelectorAll('.menu-retune-layer').length, 1);
});

for (const gate of ['hidden', 'reduced', 'preference', 'context', 'pagehide', 'detached'])
  test(`${gate} cancels a live burst, clears timers and never replays it on return`, (t) => {
    const f = fixture(t);
    f.destination.showModal();
    assert.equal(commitMenuRetune(f.root, f.destination), true);
    if (gate === 'hidden') {
      f.doc.hidden = true;
      f.doc.emit('visibilitychange');
    }
    if (gate === 'reduced') {
      f.reduced.matches = true;
      f.reduced.emit('change');
    }
    if (gate === 'preference') setMenuAnimation(false, f.win);
    if (gate === 'context') {
      f.context.active = false;
      f.mutations();
    }
    if (gate === 'pagehide') f.win.emit('pagehide');
    if (gate === 'detached') {
      f.destination.remove();
      f.mutations('childList');
    }
    assert.equal(active(f.destination), false);
    assert.equal(f.timers.size, 0);
    f.advance(1000);
    assert.equal(commitMenuRetune(f.root, f.destination), false);
    f.doc.hidden = false;
    f.reduced.matches = false;
    f.context.active = true;
    setMenuAnimation(true, f.win);
    f.win.emit('pageshow');
    f.doc.body.append(f.destination);
    assert.equal(active(f.destination), false);
  });

test('settings, dialogs, focus and controls do not opt into navigation decoration', (t) => {
  const f = fixture(t),
    settings = f.doc.createElement('dialog');
  f.doc.body.append(settings);
  settings.showModal();
  assert.equal(commitMenuRetune(f.root, settings), false);
  f.opener.focus();
  f.opener.emit('pointerover');
  f.opener.emit('change');
  assert.equal(f.timers.size, 0);
  f.destination.showModal();
  assert.equal(
    commitMenuRetune(f.root, f.destination),
    false,
    'A covering unrelated dialog retires the visual commit.',
  );
  f.owner.dispose();
  assert.equal(menuRetuneOrigin(f.opener), null);
  assert.equal(commitMenuRetune(f.root, f.destination), false);
});

test('a legacy mission dialog used for reading is outside retune navigation', (t) => {
  const f = fixture(t);
  f.destination.className = '';
  f.destination.id = 'shell-missions';
  f.destination.dataset.view = 'brief';
  f.destination.showModal();
  assert.equal(commitMenuRetune(f.root, f.destination), false);
  f.destination.close();
  assert.equal(commitMenuRetune(f.destination, f.root), false);
  assert.equal(f.timers.size, 0);
});

test('a replacement picker releases old layers and a covering dialog cancels the active one', (t) => {
  const f = fixture(t);
  let previous = f.destination;
  for (let i = 0; i < 8; i++) {
    const target = f.doc.createElement('dialog');
    target.className = 'mission-library-chooser';
    f.doc.body.append(target);
    previous.close();
    target.showModal();
    assert.equal(commitMenuRetune(f.root, target), true);
    assert.equal(previous.querySelector('.menu-retune-layer'), null);
    assert.equal(f.doc.querySelectorAll('.menu-retune-layer').length, 1);
    f.advance(1000);
    previous = target;
  }
  previous.close();
  assert.equal(commitMenuRetune(previous, f.root), true);
  const settings = f.doc.createElement('dialog');
  f.doc.body.append(settings);
  settings.showModal();
  f.mutations();
  assert.equal(active(f.root), false);
  assert.equal(f.timers.size, 0);
});

for (const mode of ['solo', 'versus', 'team'])
  test(`${mode}: actual chooser commits only open and Back, never filters or recovery`, (t) => {
    const f = fixture(t);
    f.destination.remove();
    const library = createMissionLibrary([
      {
        id: 'authored',
        collection: 'Classic',
        editionId: 'v1',
        edition: 'Original',
        entries: [
          {
            id: 'one',
            name: 'One',
            campaignKey: 'one',
            campaignTitle: 'First',
            levelIndex: 0,
            modes: [mode],
            tags: [],
            rules: '',
          },
        ],
        describe: (entry) => entry,
        availability: () => ({ state: 'ready' }),
        launch: () => true,
      },
    ]);
    const chooser = attachMissionLibraryChooser({ document: f.doc, library, mode });
    t.after(() => chooser.destroy());
    chooser.open(f.opener);
    const dialog = f.doc.getElementById('journey-chooser');
    assert.equal(active(dialog), true);
    f.advance(1000);
    f.doc.getElementById('journey-search').value = 'One';
    f.doc.getElementById('journey-search').emit('input');
    f.doc.getElementById('journey-mode').emit('change');
    chooser.refresh();
    assert.equal(active(dialog), false);
    f.doc.getElementById('journey-back').click();
    assert.equal(active(f.root), true);
    f.advance(1000);
    chooser.restore();
    assert.equal(active(dialog), false, 'Recovery reopening does not retune.');
    chooser.destroy();
    assert.equal(active(f.root), false, 'Disposal does not retune the landing.');
  });

test('the stylesheet reuses stepped local noise below content without transforms or filters', async () => {
  const css = await readFile(new URL('../ui/menu-retune.css', import.meta.url), 'utf8');
  assert.match(css, /analog-noise-atlas\.png/);
  assert.match(css, /menu-retune-frames 220ms step-end 1/);
  assert.match(css, /pointer-events: none/);
  assert.match(css, /z-index: -1/);
  assert.doesNotMatch(css, /(?:backdrop-filter|transform|filter):/);
});

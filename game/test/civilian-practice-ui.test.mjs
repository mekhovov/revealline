import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'parse5';
import { mountCivilianPractice } from '../../optional-practice/civilian-flight/app.mjs';
import { replayPractice } from '../../optional-practice/civilian-flight/model.mjs';
import { GLOBAL_SETTINGS } from '../ui/global-settings-view.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';
import { activateMissionCard } from './helpers/library-selection.mjs';

async function fixture(t, { storage, search = '', previews = [] } = {}) {
  const doc = new Document(),
    win = new Events();
  const html = parse(
    await readFile(
      new URL('../../optional-practice/civilian-flight/index.html', import.meta.url),
      'utf8',
    ),
  );
  const body = html.childNodes
    .find((node) => node.tagName === 'html')
    .childNodes.find((node) => node.tagName === 'body');
  function copy(source, parent) {
    if (!source.tagName) return;
    const node = doc.createElement(source.tagName);
    for (const attribute of source.attrs ?? []) {
      node.setAttribute(attribute.name, attribute.value);
      if (attribute.name === 'class') node.className = attribute.value;
    }
    for (const text of source.childNodes ?? [])
      if (text.nodeName === '#text') node.textContent += text.value;
    parent.append(node);
    for (const child of source.childNodes ?? []) copy(child, node);
  }
  for (const child of body.childNodes) copy(child, doc.body);
  doc.getElementById('board').getContext = () => null;
  const createElement = doc.createElement.bind(doc);
  doc.createElement = (tag) => {
    const element = createElement(tag);
    if (tag === 'canvas') {
      const operations = [];
      previews.push({ canvas: element, operations });
      element.getContext = () =>
        new Proxy(
          {},
          {
            get:
              (_target, key) =>
              (...args) =>
                operations.push([key, ...args]),
          },
        );
    }
    return element;
  };
  const frames = new Map();
  let frameId = 0,
    now = 0;
  win.requestAnimationFrame = (fn) => {
    frames.set(++frameId, fn);
    return frameId;
  };
  win.cancelAnimationFrame = (id) => frames.delete(id);
  win.getComputedStyle = doc.defaultView.getComputedStyle;
  win.Event = Event;
  win.CustomEvent = CustomEvent;
  win.navigator = { getGamepads: () => [] };
  win.location = new URL('https://example.test/optional-practice/civilian-flight/' + search);
  Object.defineProperty(win, 'localStorage', {
    get() {
      if (storage) return storage;
      throw new Error('Practice cannot use player storage');
    },
  });
  const view = mountCivilianPractice({ document: doc, window: win });
  t.after(() => view.dispose());
  const tick = (count = 1) => {
    for (let index = 0; index < count; index++) {
      const [id, callback] = frames.entries().next().value;
      frames.delete(id);
      callback(now);
      now += 50;
    }
  };
  return {
    doc,
    win,
    view,
    frames,
    tick,
    jump(milliseconds) {
      now += milliseconds;
    },
    key(code, type = 'keydown', repeat = false) {
      win.emit(type, {
        code,
        repeat,
        key: code.startsWith('Key') ? code.slice(3).toLowerCase() : code,
      });
    },
  };
}
test('actual optional page is playable with canvas fallback and verifies a complete keyboard practice transcript', async (t) => {
  const f = await fixture(t);
  const $ = (id) => f.doc.getElementById(id);
  assert.equal($('drill').children.length, 12);
  assert.equal($('fallback').hidden, false);
  $('start').click();
  assert.equal(f.doc.activeElement, $('arena'));
  f.key('KeyR');
  f.tick(21);
  f.key('KeyR', 'keyup');
  f.tick(30);
  assert.equal(f.view.snapshot().checkpoint, 1);
  f.key('KeyF');
  f.tick(20);
  f.key('KeyF', 'keyup');
  f.tick(30);
  assert.equal(f.view.snapshot().status, 'complete');
  assert.equal(replayPractice(f.view.catalogue(), f.view.trace()).status, 'complete');
  assert.ok($('discovery').textContent.length > 0);
  assert.equal($('start').disabled, true);
  assert.match($('drill').children[0].textContent, /✓/);
  const completedState = f.view.snapshot(),
    completedTrace = f.view.trace(),
    discovery = $('discovery');
  for (const action of ['results', 'back']) {
    $('gym-shell-action-menu').click();
    if (action === 'results') $('gym-shell-action-home-results').click();
    else $('gym-shell-home-dialog').emit('cancel');
    assert.equal($('gym-shell-home-dialog').open, false);
    assert.equal($('gym-shell-results-dialog').open, false);
    assert.equal($('discovery'), discovery);
    assert.equal(f.doc.activeElement, discovery);
    f.tick(3);
    assert.deepEqual(f.view.snapshot(), completedState);
    assert.deepEqual(f.view.trace(), completedTrace);
  }
  $('gym-shell-action-menu').click();
  $('gym-shell-action-primary').click();
  assert.equal(f.view.snapshot().status, 'active', 'Only explicit Retry starts a fresh drill.');
  assert.equal(f.view.snapshot().ticks, 0);
  $('drill').value = 'square';
  $('drill').emit('change');
  assert.equal(f.view.snapshot().status, 'ready');
  assert.equal(f.view.snapshot().ticks, 0);
});
test('reading and failed imports pause the gym and cannot grant completions or resume a held control', async (t) => {
  const f = await fixture(t);
  const $ = (id) => f.doc.getElementById(id);
  $('start').click();
  f.key('KeyW');
  f.tick(3);
  $('help').click();
  const paused = f.view.snapshot();
  f.tick(20);
  assert.deepEqual(f.view.snapshot(), paused);
  assert.equal($('help-dialog').open, true);
  $('export').click();
  const exported = $('catalogue').value;
  assert.equal(JSON.parse(exported).drills.length, 12);
  $('catalogue').value = '{"completed":true}';
  $('import').click();
  assert.deepEqual(f.view.snapshot(), paused);
  $('close-help').click();
  assert.equal(f.view.snapshot().status, 'paused');
  $('start').click();
  f.key('KeyW', 'keydown', true);
  f.tick(3);
  assert.equal(f.view.snapshot().z, paused.z);
  assert.ok($('drill').children.every((option) => !option.textContent.includes('✓')));
  f.win.emit('blur');
  assert.equal(f.view.snapshot().status, 'paused');
  f.view.dispose();
  assert.equal(f.frames.size, 0);
});

test('final gym exit retires reparented controls before removing their shell', async (t) => {
  const f = await fixture(t),
    sound = f.doc.getElementById('sound'),
    shell = f.doc.querySelector('[data-mode-play-shell="gym-shell"]');
  assert.equal(shell.contains(sound), true);
  assert.equal(typeof sound.onclick, 'function');
  assert.doesNotThrow(() => f.win.emit('pagehide', { persisted: false }));
  assert.equal(sound.onclick, null);
  assert.equal(f.frames.size, 0);
  assert.equal(f.win.listeners.get('pagehide')?.size ?? 0, 0);
  assert.equal(f.win.listeners.get('orientationchange')?.size ?? 0, 0);
  assert.equal(shell.isConnected, false);
  assert.doesNotThrow(() => f.view.dispose(), 'Repeated teardown remains harmless.');
});

test('gym title and settings reuse the accepted drill without starting or resuming it', async (t) => {
  const f = await fixture(t),
    $ = (id) => f.doc.getElementById(id);
  assert.equal($('gym-shell-home-dialog').open, true);
  assert.equal(f.view.snapshot().status, 'ready');
  $('gym-shell-action-settings').click();
  assert.equal($('gym-shell-settings-dialog').open, true);
  f.tick(3);
  assert.equal(f.view.snapshot().ticks, 0);
  $('gym-shell-action-settings-back').click();
  $('gym-shell-action-primary').click();
  assert.equal($('gym-shell-briefing-dialog').open, false);
  assert.equal(f.view.snapshot().status, 'active');
  f.tick(3);
  $('gym-shell-action-menu').click();
  const paused = f.view.snapshot();
  assert.equal(paused.status, 'paused');
  f.tick(4);
  assert.deepEqual(f.view.snapshot(), paused);
  $('gym-shell-action-primary').click();
  assert.equal(f.view.snapshot().status, 'active');
});

test('a gym Pause pointer keeps its intent when moving focus first pauses flight input', async (t) => {
  const f = await fixture(t),
    $ = (id) => f.doc.getElementById(id);
  $('gym-shell-action-primary').click();
  $('gym-shell-action-start').click();
  f.tick(3);
  const button = $('gym-shell-action-pause');
  button.emit('pointerdown', { pointerId: 1, button: 0 });
  button.focus();
  assert.equal(f.view.snapshot().status, 'paused');
  button.emit('click', { detail: 1 });
  assert.equal($('gym-shell-pause-dialog').open, true);
  const paused = f.view.snapshot();
  f.tick(4);
  assert.deepEqual(f.view.snapshot(), paused);
});

function controller(f) {
  const pad = {
    index: 0,
    id: 'Standard fixture controller',
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
  let reads = 0;
  f.win.navigator.getGamepads = () => {
    reads++;
    return [pad];
  };
  const set = (index, pressed) => {
    pad.buttons[index] = { pressed, value: pressed ? 1 : 0 };
  };
  return {
    pad,
    set,
    get reads() {
      return reads;
    },
    pulse(index) {
      f.tick();
      set(index, true);
      f.tick();
      set(index, false);
      f.tick();
    },
  };
}

test('gym reuses neutral controller menu navigation without arming on device join', async (t) => {
  const f = await fixture(t, { search: '?game-return=https://example.test/game/' }),
    $ = (id) => f.doc.getElementById(id),
    pad = controller(f);
  pad.set(0, true);
  f.tick(4);
  assert.equal(f.view.snapshot().ticks, 0, 'A held on arrival cannot activate the title.');
  pad.set(0, false);
  f.tick();
  pad.pulse(0);
  assert.equal(
    $('gym-shell-home-dialog').open,
    true,
    'The first fresh A only joins menu ownership.',
  );
  assert.equal(f.doc.activeElement, $('gym-shell-action-primary'));
  pad.pulse(13);
  assert.equal(f.doc.activeElement, $('gym-shell-action-missions'));
  pad.pulse(13);
  assert.equal(f.doc.activeElement, $('gym-shell-action-settings'));
  pad.pulse(13);
  assert.equal(f.doc.activeElement, $('gym-shell-action-sound'));
  pad.pulse(13);
  assert.equal(f.doc.activeElement, $('gym-shell-action-fullscreen'));
  pad.pulse(13);
  assert.equal(f.doc.activeElement, $('game-mode-simulator'));
  for (const id of [
    'game-mode-solo',
    'game-mode-team',
    'game-mode-versus',
    'game-mode-snake',
    'game-mode-overflight',
    'game-mode-simulator',
  ]) {
    pad.pulse(15);
    assert.equal(f.doc.activeElement, $(id));
  }
  pad.pulse(13);
  assert.equal(f.doc.activeElement, $('gym-shell-action-primary'));
  pad.pulse(13);
  pad.pulse(13);
  assert.equal(f.doc.activeElement, $('gym-shell-action-settings'));
  pad.pulse(0);
  assert.equal($('gym-shell-settings-dialog').open, true);
  assert.equal(f.view.snapshot().status, 'ready');
  pad.pulse(1);
  assert.equal($('gym-shell-home-dialog').open, true);
  assert.equal($('gym-shell-settings-dialog').open, false);
  assert.equal(f.view.snapshot().ticks, 0);
});

test('gym controller Pause requires a fresh explicit Continue and samples hardware once per frame', async (t) => {
  const f = await fixture(t),
    $ = (id) => f.doc.getElementById(id),
    pad = controller(f);
  pad.pulse(0); // neutral, then join without activation
  $('connect').click();
  $('gym-shell-action-primary').click();
  $('gym-shell-action-start').click();
  f.tick(3);
  assert.equal(f.view.snapshot().status, 'active');
  const reads = pad.reads;
  f.tick(5);
  assert.equal(pad.reads - reads, 5, 'The existing frame loop owns the only hardware read.');
  pad.set(9, true);
  f.tick();
  assert.equal($('gym-shell-home-dialog').open, true);
  assert.equal(f.view.snapshot().status, 'paused');
  const paused = f.view.snapshot();
  pad.set(0, true);
  f.tick(4);
  assert.deepEqual(f.view.snapshot(), paused, 'Menu handoff never resumes a held action.');
  pad.set(9, false);
  pad.set(0, false);
  f.tick();
  pad.pulse(0);
  assert.equal(f.view.snapshot().status, 'active');
  assert.equal($('gym-shell-home-dialog').open, false);
});

test('gym menu keyboard navigation owns arrows and returns from nested help without flight input', async (t) => {
  const f = await fixture(t, { search: '?game-return=https://example.test/game/' }),
    $ = (id) => f.doc.getElementById(id);
  const arrow = (key = 'ArrowDown') => {
    f.doc.emit('keydown', { key, code: key, target: f.doc.activeElement });
    f.doc.emit('keyup', { key, code: key, target: f.doc.activeElement });
  };
  arrow();
  assert.equal(f.doc.activeElement, $('gym-shell-action-missions'));
  arrow();
  assert.equal(f.doc.activeElement, $('gym-shell-action-settings'));
  arrow();
  assert.equal(f.doc.activeElement, $('gym-shell-action-sound'));
  arrow();
  assert.equal(f.doc.activeElement, $('gym-shell-action-fullscreen'));
  arrow();
  assert.equal(f.doc.activeElement, $('game-mode-simulator'));
  for (const id of [
    'game-mode-solo',
    'game-mode-team',
    'game-mode-versus',
    'game-mode-snake',
    'game-mode-overflight',
    'game-mode-simulator',
  ]) {
    arrow('ArrowRight');
    assert.equal(f.doc.activeElement, $(id));
  }
  arrow();
  assert.equal(f.doc.activeElement, $('gym-shell-action-primary'));
  arrow();
  arrow();
  assert.equal(f.doc.activeElement, $('gym-shell-action-settings'));
  $('gym-shell-action-settings').click();
  $('gym-shell-action-help').click();
  assert.equal($('help-dialog').open, true);
  f.doc.emit('keydown', { key: 'Escape', code: 'Escape', target: f.doc.activeElement });
  f.doc.emit('keyup', { key: 'Escape', code: 'Escape', target: f.doc.activeElement });
  assert.equal($('help-dialog').open, false);
  assert.equal($('gym-shell-settings-dialog').open, true);
  f.tick(4);
  assert.equal(f.view.snapshot().status, 'ready');
  assert.equal(f.view.snapshot().ticks, 0);
});

test('gym Select Mission starts the selected drill with one action', async (t) => {
  const previews = [],
    f = await fixture(t, { previews }),
    $ = (id) => f.doc.getElementById(id);
  const before = f.view.trace();
  $('gym-shell-action-missions').click();
  assert.equal(f.doc.querySelector('[data-copy="prepare"]'), null);
  assert.equal($('journey-chooser').open, true);
  assert.equal($('gym-shell-missions-dialog').open, false);
  assert.equal($('journey-cards').children.length, 12);
  assert.equal(previews.filter(({ canvas }) => $('journey-cards').contains(canvas)).length, 12);
  assert.deepEqual(f.view.trace(), before, 'Browsing does not alter the accepted recording.');
  const card = [...$('journey-cards').children].find(
    (row) => JSON.parse(row.dataset.missionId)[3] === 'square',
  );
  const drill = f.view.catalogue().drills.find((item) => item.id === 'square');
  const preview = previews.find((item) => card.contains(item.canvas));
  assert.deepEqual(
    preview.operations
      .filter(([kind]) => kind === 'arc')
      .map(([, x, y]) => [Number(x.toFixed(4)), Number(y.toFixed(4))]),
    drill.checkpoints.map(({ x, z }) => [12 + (x * 264) / 2000, 12 + (z * 264) / 2000]),
    'The thumbnail renders this exact drill route inside the complete gym boundary.',
  );
  await activateMissionCard(card);
  assert.equal($('journey-chooser').open, false);
  assert.equal($('gym-shell-briefing-dialog').open, false);
  assert.equal(f.view.snapshot().status, 'active');
  assert.equal(f.view.snapshot().ticks, 0);
  assert.equal(f.view.trace().drillId, 'square');
  assert.equal(
    $('gym-shell-briefing-title').textContent,
    drill.locales[f.doc.documentElement.lang].title,
  );
});

test('gym shared selector keeps search and pause state, rejects filtered cards and supports controller Back', async (t) => {
  const f = await fixture(t),
    $ = (id) => f.doc.getElementById(id),
    pad = controller(f);
  f.doc.defaultView.matchMedia = () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  });
  $('start').click();
  f.tick(3);
  $('gym-shell-action-menu').click();
  const opener = $('gym-shell-action-pause-choose') ?? $('gym-shell-action-missions');
  opener.focus();
  opener.click();
  assert.equal($('journey-chooser').open, true);
  f.tick();
  const hint = f.doc.querySelector('.gym-menu-hint');
  assert.equal(
    hint.parentElement,
    $('journey-filter-details').querySelector('.journey-filter-options'),
  );
  assert.equal(
    $('journey-filter-details').open,
    false,
    'Mobile secondary controls start collapsed.',
  );
  assert.ok(
    hint.textContent.length > 0,
    'The controller instructions remain available in Filters.',
  );
  $('journey-filter-details').open = true;
  assert.equal(hint.hidden, false);
  $('journey-filter-details').open = false;
  const paused = f.view.snapshot(),
    trace = f.view.trace(),
    stale = $('journey-cards').children[0],
    selectedDrill = f.view.catalogue().drills.find((entry) => entry.id === 'square');
  $('journey-search').value = selectedDrill.locales[f.doc.documentElement.lang].title;
  $('journey-search').emit('input');
  assert.equal($('journey-cards').children.length, 1);
  await stale.onclick();
  f.tick(3);
  assert.deepEqual(f.view.snapshot(), paused);
  assert.deepEqual(f.view.trace(), trace);
  pad.pulse(0); // Connect the controller without activating the current card.
  pad.pulse(1);
  assert.equal($('journey-chooser').open, false);
  assert.equal(f.doc.activeElement, opener);
  opener.click();
  assert.equal($('journey-cards').children.length, 1);
  assert.equal(JSON.parse($('journey-cards').children[0].dataset.missionId)[3], 'square');
  assert.deepEqual(f.view.trace(), trace);
});

test('gym imported catalogue replaces selector authority and exact route without inheriting completion', async (t) => {
  const f = await fixture(t),
    $ = (id) => f.doc.getElementById(id);
  $('start').click();
  f.key('KeyR');
  f.tick(21);
  f.key('KeyR', 'keyup');
  f.tick(30);
  f.key('KeyF');
  f.tick(20);
  f.key('KeyF', 'keyup');
  f.tick(30);
  assert.equal(f.view.snapshot().status, 'complete');
  $('gym-shell-action-menu').click();
  $('gym-shell-action-missions').click();
  const retired = $('journey-cards').children[0],
    imported = f.view.catalogue();
  assert.equal(retired.dataset.completionState, 'completed');
  imported.drills = [imported.drills[0]];
  imported.drills[0].spawn.x = 900;
  imported.drills[0].locales.en.title = 'Imported hover';
  imported.drills[0].locales.uk.title = 'Імпортоване зависання';
  $('catalogue').value = JSON.stringify(imported);
  $('import').click();
  assert.equal($('journey-cards').children.length, 1);
  const current = $('journey-cards').children[0];
  assert.notEqual(current.dataset.missionId, retired.dataset.missionId);
  assert.equal(current.dataset.completionState, 'new');
  const accepted = f.view.trace();
  await retired.onclick();
  assert.deepEqual(f.view.trace(), accepted);
  assert.equal(f.view.snapshot().status, 'ready');
  await activateMissionCard(current);
  assert.equal(f.view.snapshot().status, 'active');
  assert.equal(f.view.snapshot().x, 900);
  assert.equal(f.view.trace().catalogueIdentity, accepted.catalogueIdentity);
  assert.equal($('journey-chooser').open, false);
});

test('a flight arrow released inside a controller menu is usable on the first press after Resume', async (t) => {
  const f = await fixture(t),
    $ = (id) => f.doc.getElementById(id);
  // Model the browser window → document capture chain for consumed keyup.
  f.doc.parentNode = f.win;
  const key = (target, type, code) => target.emit(type, { key: code, code, bubbles: true });
  $('start').click();
  key($('arena'), 'keydown', 'ArrowUp');
  f.tick(2);
  $('gym-shell-action-menu').click();
  f.tick();
  key($('gym-shell-action-primary'), 'keyup', 'ArrowUp');
  $('gym-shell-action-primary').click();
  const before = f.view.snapshot().z;
  key($('arena'), 'keydown', 'ArrowUp');
  f.tick(3);
  assert.notEqual(f.view.snapshot().z, before, 'Menu keyup cannot leave the physical key latched.');
  key($('arena'), 'keyup', 'ArrowUp');
});

test('gym adopts the complete common preference inventory and keeps practice tools reachable without changing the drill', async (t) => {
  const values = new Map(),
    storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key),
    };
  const f = await fixture(t, { storage }),
    $ = (id) => f.doc.getElementById(id);
  const root = $('gym-shell-settings-dialog');
  for (const { key } of GLOBAL_SETTINGS.filter(({ required }) => required))
    assert.equal(root.querySelectorAll(`[data-global-setting="${key}"]`).length, 1, key);
  assert.equal(
    $('gym-shell-action-workshop').closest('[role="tabpanel"]').id,
    'gym-settings-panel-extras',
    'Secondary launchers belong inside categories instead of becoming extra layout columns.',
  );
  assert.equal(
    $('sound').hidden,
    true,
    'The original mute alias remains callable but is not duplicated in Settings.',
  );
  assert.equal($('language').closest('[data-global-setting]').dataset.globalSetting, 'language');
  assert.equal($('connect').closest('[role="tabpanel"]').id, 'gym-settings-panel-controls');
  assert.equal($('offline').closest('[role="tabpanel"]').id, 'gym-settings-panel-content');
  assert.equal($('export-trace').closest('[role="tabpanel"]').id, 'gym-settings-panel-data');
  const snapshot = f.view.snapshot(),
    trace = f.view.trace();
  $('gym-shell-action-settings').click();
  for (const [key, value] of [
    ['textFace', 'plain'],
    ['textSize', 'large'],
  ]) {
    $(`gym-global-${key}`).value = value;
    $(`gym-global-${key}`).emit('change');
  }
  $('gym-global-reducedEffects').click();
  $('gym-global-menuAnimation').click();
  $('gym-global-masterVolume').value = '0.37';
  $('gym-global-masterVolume').emit('change');
  assert.deepEqual(JSON.parse(values.get('revealline.display.v1')), {
    textFace: 'plain',
    textSize: 'large',
    reducedEffects: true,
  });
  assert.equal(values.get('revealline.menu-animation.v1'), 'off');
  assert.equal(JSON.parse(values.get('revealline.audio-master.v1')).volume, 0.37);
  assert.equal(f.doc.body.dataset.textFace, 'plain');
  assert.equal(f.doc.body.dataset.effects, 'reduced');
  assert.deepEqual(f.view.snapshot(), snapshot);
  assert.deepEqual(f.view.trace(), trace);
  assert.ok(
    [...values.keys()].every((key) =>
      [
        'revealline.display.v1',
        'revealline.menu-animation.v1',
        'revealline.audio-master.v1',
      ].includes(key),
    ),
    'Shared presentation changes never write a game save.',
  );
});

test('gym shares six ordered Ukrainian mode choices and mobile category keyboard/controller Back without restarting practice', async (t) => {
  const originalLocale = getLocale();
  const f = await fixture(t, { search: '?game-return=/game/&lang=uk' });
  t.after(() => setLocale(originalLocale));
  const $ = (id) => f.doc.getElementById(id);
  const modes = f.doc.querySelector('.game-mode-choice');
  assert.deepEqual(
    modes.children.map((node) => node.dataset.gameMode),
    ['solo', 'team', 'versus', 'snake', 'overflight', 'simulator'],
  );
  assert.equal(modes.querySelectorAll('[aria-current="page"]').length, 1);
  assert.equal(modes.querySelector('[aria-current="page"]').dataset.gameMode, 'simulator');
  assert.equal(modes.children[5].querySelector('.game-mode-badge').textContent, 'beta');
  assert.equal(modes.children[3].dataset.menuIcon, 'snake');
  const root = $('gym-shell-settings-dialog');
  f.doc.defaultView.innerWidth = 320;
  $('gym-shell-action-settings').click();
  const controls = $('gym-settings-tab-controls'),
    audio = $('gym-settings-tab-audio');
  controls.focus();
  controls.emit('keydown', { key: 'ArrowDown' });
  assert.equal(f.doc.activeElement, audio);
  audio.click();
  assert.equal(root.dataset.settingsView, 'panel');
  $('gym-shell-action-settings-back').click();
  assert.equal(root.open, true);
  assert.equal(root.dataset.settingsView, 'categories');
  assert.equal(f.doc.activeElement, audio);
  const pad = controller(f);
  pad.pulse(0);
  pad.pulse(0);
  assert.equal(root.dataset.settingsView, 'panel');
  pad.pulse(1);
  assert.equal(root.dataset.settingsView, 'categories');
  pad.pulse(1);
  assert.equal(root.open, false);
  assert.equal($('gym-shell-home-dialog').open, true);
  assert.equal(f.view.snapshot().status, 'ready');
  assert.equal(f.view.snapshot().ticks, 0);
});

for (const clock of ['animation timestamp', 'callback execution']) {
  test(`gym cancels an imminent auto-next before a stalled ${clock}`, async (t) => {
    const f = await fixture(t),
      $ = (id) => f.doc.getElementById(id);
    let executionTime = 0;
    f.win.performance = { now: () => executionTime };
    $('start').click();
    f.key('KeyR');
    f.tick(21);
    f.key('KeyR', 'keyup');
    f.tick(30);
    f.key('KeyF');
    f.tick(20);
    f.key('KeyF', 'keyup');
    f.tick(30);
    assert.equal(f.view.snapshot().status, 'complete');
    const flow = f.doc.querySelector('[data-continuous-play]');
    for (let i = 0; i < 220 && !flow.textContent.includes('Next level in 1s'); i++) f.tick();
    assert.match(flow.textContent, /Next level in 1s/);
    f.tick(15);
    const completed = f.view.snapshot(),
      trace = f.view.trace();
    if (clock === 'animation timestamp') f.jump(1500);
    else executionTime = 1500;
    f.tick(4);
    assert.deepEqual(f.view.snapshot(), completed, 'A stalled frame must not change drills.');
    assert.deepEqual(f.view.trace(), trace);
    assert.equal(flow.hidden, true, 'The cancelled timer cannot silently rearm.');
  });
}

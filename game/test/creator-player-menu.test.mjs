import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Document, Events } from './helpers/couch-dom.mjs';
import { mountCouch } from './helpers/mount-html.mjs';
import { attachCreatorPlayerMenu, creatorVersusHref } from '../creator/player-menu.mjs';
import { focusCreatorInstalledPlay } from '../creator/player-menu-focus.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';
import { DISPLAY_PREFERENCES_KEY } from '../display-preferences.mjs';
import { getLocale, setLocale, translateDOM } from '../i18n/index.mjs';

const html = await readFile(new URL('../creator/player.html', import.meta.url), 'utf8');
const pack = Object.freeze({
  editionId: 'exact-edition',
  manifest: {
    content: {
      compatibility: { modes: ['solo', 'versus'] },
      project: {
        missions: [
          { id: 'first', name: 'First picture', revision: '1' },
          { id: 'second', name: 'Second picture', revision: '2' },
        ],
        campaigns: [{ id: 'pictures', missionIds: ['first', 'second'] }],
      },
    },
  },
});
function fixture(t, { initial = {}, stored = null, fullscreen = false, width = 1200 } = {}) {
  const doc = new Document(),
    win = doc.defaultView;
  doc.parentNode = win;
  mountCouch(doc, html);
  doc.documentElement.dataset.buildVersion = '0.142.3';
  const $ = (id) => doc.getElementById(id),
    writes = [],
    launched = [],
    destinations = [];
  const values = new Map(stored ? [[DISPLAY_PREFERENCES_KEY, JSON.stringify(stored)]] : []);
  const reduced = Object.assign(new Events(), { matches: false });
  Object.assign(win, {
    innerWidth: width,
    location: new URL('https://example.test/site/game/creator/player.html?edition=exact-edition'),
    matchMedia: () => reduced,
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
        writes.push([key, value]);
      },
    },
  });
  doc.fullscreenEnabled = fullscreen;
  let requests = 0,
    exits = 0;
  doc.documentElement.requestFullscreen = async () => {
    requests++;
    doc.fullscreenElement = doc.documentElement;
    doc.emit('fullscreenchange');
  };
  doc.exitFullscreen = async () => {
    exits++;
    doc.fullscreenElement = null;
    doc.emit('fullscreenchange');
  };
  const state = {
    ready: true,
    busy: false,
    paused: true,
    ended: false,
    savedRaw: null,
    attempt: null,
    pack,
    missionId: 'first',
    missionOrder: ['first', 'second'],
    ...initial,
  };
  let resets = 0;
  $('start').disabled = false;
  const menu = attachCreatorPlayerMenu({
    document: doc,
    window: win,
    getState: () => state,
    onChooseMission: (id) => launched.push(id),
    onInputReset: () => resets++,
    navigate: (url) => destinations.push(url),
  });
  t.after(() => menu.destroy());
  return {
    doc,
    win,
    $,
    menu,
    state,
    launched,
    destinations,
    writes,
    reduced,
    requests: () => requests,
    exits: () => exits,
    resets: () => resets,
  };
}

test('Custom Solo shows only real landing actions and retains actual settings controls', (t) => {
  const h = fixture(t),
    { $, menu } = h;
  assert.equal(menu.primary(), $('start'));
  assert.equal($('start').parentNode, $('creator-primary-actions'));
  assert.equal($('difficulty').closest('dialog'), $('creator-settings'));
  assert.equal($('import-attempt').closest('dialog'), $('creator-settings'));
  assert.equal($('creator-version').textContent, '0.142.3');
  assert.equal(
    $('creator-fullscreen').hidden,
    true,
    'unsupported fullscreen does not promise an action',
  );
  assert.equal($('creator-mode-versus').hidden, false);
  assert.equal(
    h.doc.querySelector('[data-menu-icon="team"]'),
    null,
    'a picture bundle does not gain Team compatibility',
  );
  assert.equal(
    h.doc.querySelector('[data-menu-icon="sound"]'),
    null,
    'the silent runtime does not show a fake audio switch',
  );
  assert.equal($('creator-game').hidden, true);
  assert.equal($('earned').parentNode, $('creator-panel-data'));
  assert.equal(h.writes.length, 0);
});

test('every Custom dialog pauses the real scene; compact Back returns categories before closing', (t) => {
  const h = fixture(t, { width: 390 }),
    { $, doc } = h;
  const scene = doc.querySelector('.menu-scene');
  assert.equal(scene.dataset.running, 'true');
  $('creator-open-settings').focus();
  $('creator-open-settings').click();
  assert.equal(scene.dataset.running, 'false');
  $('creator-tab-data').click();
  assert.equal($('creator-settings').dataset.settingsView, 'panel');
  $('creator-settings-back').click();
  assert.equal($('creator-settings').open, true);
  assert.equal($('creator-settings').dataset.settingsView, 'categories');
  assert.equal(doc.activeElement, $('creator-tab-data'));
  $('creator-settings-back').click();
  assert.equal($('creator-settings').open, false);
  assert.equal(doc.activeElement, $('creator-open-settings'));
  assert.equal(scene.dataset.running, 'true');
  $('creator-select-mission').focus();
  $('creator-select-mission').click();
  assert.equal(scene.dataset.running, 'false');
  h.state.savedRaw = 'exact checkpoint';
  $('creator-mission-list').querySelector('button').click();
  assert.equal($('creator-replace-attempt').open, true);
  assert.equal(scene.dataset.running, 'false');
  $('creator-replace-cancel').click();
  assert.equal(scene.dataset.running, 'false', 'underlying mission selector still owns the screen');
  $('creator-missions-back').click();
  assert.equal(scene.dataset.running, 'true');
});

test('mission replacement Cancel is inert and stale guards cannot launch', (t) => {
  const h = fixture(t, { initial: { attempt: {}, savedRaw: 'before' } }),
    { $ } = h;
  $('creator-select-mission').click();
  const second = $('creator-mission-list').querySelectorAll('button')[1];
  second.focus();
  second.click();
  assert.equal(h.doc.activeElement, $('creator-replace-cancel'));
  assert.deepEqual(h.launched, []);
  $('creator-replace-cancel').click();
  assert.equal(h.doc.activeElement, second);
  assert.equal(h.state.savedRaw, 'before');
  second.click();
  h.state.savedRaw = 'different checkpoint';
  $('creator-replace-confirm').click();
  assert.deepEqual(h.launched, [], 'a changed attempt cannot be replaced by an old approval');
  second.click();
  $('creator-replace-confirm').click();
  assert.deepEqual(h.launched, ['second']);
  assert.equal($('creator-missions').open, false);
  assert.equal(h.writes.length, 0, 'only the player action callback has save authority');
});

test('qualified Versus URLs preserve exact edition and mission; unsupported bundles expose no handoff', (t) => {
  const h = fixture(t, { initial: { attempt: {}, savedRaw: 'saved' } }),
    { $ } = h;
  const href = new URL(creatorVersusHref(pack, 'second', h.win.location.href));
  assert.equal(href.pathname, '/site/game/couch/');
  assert.deepEqual(JSON.parse(href.searchParams.get('library-mission')), [
    'creator:exact-edition',
    'exact-edition',
    'pictures',
    'second',
    '2',
  ]);
  assert.equal(href.searchParams.get('journey'), 'legacy');
  assert.equal(
    creatorVersusHref(
      { manifest: { content: { compatibility: { modes: ['solo'] } } } },
      'first',
      href,
    ),
    null,
  );
  $('creator-mode-versus').click();
  $('creator-replace-cancel').click();
  assert.deepEqual(h.destinations, []);
  $('creator-mode-versus').click();
  $('creator-replace-confirm').click();
  assert.equal(h.destinations.length, 1);
  assert.equal(h.state.savedRaw, 'saved');
  assert.equal(h.writes.length, 0);
});

test('existing Plain/Large/reduced reading policy is adopted without writes, and display changes are explicit', (t) => {
  const h = fixture(t, { stored: { textFace: 'plain', textSize: 'large', reducedEffects: true } });
  assert.equal(h.doc.body.dataset.textFace, 'plain');
  assert.equal(h.doc.body.dataset.textSize, 'large');
  assert.equal(h.doc.querySelector('.menu-scene').dataset.motion, 'off');
  assert.equal(h.writes.length, 0);
  h.$('creator-text-size').value = 'standard';
  h.$('creator-text-size').emit('change');
  assert.equal(h.writes.length, 1);
  assert.equal(JSON.parse(h.writes[0][1]).textSize, 'standard');
  assert.equal(h.doc.body.dataset.textFace, 'plain');
});

test('shared fullscreen controls synchronize, and Escape exits without leaving the menu', async (t) => {
  const h = fixture(t, { fullscreen: true }),
    { $, doc, win } = h;
  $('creator-fullscreen').focus();
  $('creator-fullscreen').click();
  await Promise.resolve();
  assert.equal(h.requests(), 1);
  for (const id of ['creator-fullscreen', 'creator-settings-fullscreen'])
    assert.equal($(id).getAttribute('aria-pressed'), 'true');
  const event = win.emit('keydown', { key: 'Escape' });
  await Promise.resolve();
  assert.equal(event.defaultPrevented, true);
  assert.equal(h.exits(), 1);
  assert.equal($('creator-home').hidden, false);
  assert.equal(doc.activeElement, $('creator-fullscreen'));
  assert.equal($('creator-settings-fullscreen').getAttribute('aria-pressed'), 'false');
});

test('semantic home arrows reach each action and mode without entering closed settings', (t) => {
  const h = fixture(t),
    { $, doc } = h;
  const navigation = attachControllerNavigation({
    document: doc,
    getScope: () => 'creator-menu',
    getRoot: h.menu.root,
    getDefaultFocus: h.menu.primary,
  });
  t.after(() => navigation.destroy());
  navigation.engage();
  assert.equal(doc.activeElement, $('start'));
  navigation.handle({ direction: 'down' });
  assert.equal(doc.activeElement, $('creator-select-mission'));
  navigation.handle({ direction: 'down' });
  assert.equal(doc.activeElement, $('creator-open-settings'));
  $('start').focus();
  navigation.handle({ direction: 'up' });
  assert.equal(doc.activeElement, $('creator-mode-solo'));
  navigation.handle({ direction: 'right' });
  assert.equal(doc.activeElement, $('creator-mode-versus'));
  navigation.handle({ direction: 'down' });
  assert.equal(doc.activeElement, $('start'));
});

test('successful Install focuses Play only while it still owns the foreground interaction', () => {
  const doc = new Document(),
    opener = doc.createElement('button'),
    play = doc.createElement('a'),
    other = doc.createElement('button');
  doc.body.append(opener, play, other);
  opener.focus();
  assert.equal(focusCreatorInstalledPlay({ document: doc, opener, play, wasFocused: true }), true);
  assert.equal(doc.activeElement, play);
  doc.body.focus();
  assert.equal(focusCreatorInstalledPlay({ document: doc, opener, play, wasFocused: true }), true);
  other.focus();
  assert.equal(focusCreatorInstalledPlay({ document: doc, opener, play, wasFocused: true }), false);
  opener.focus();
  doc.hidden = true;
  assert.equal(focusCreatorInstalledPlay({ document: doc, opener, play, wasFocused: true }), false);
  doc.hidden = false;
  doc.focused = false;
  assert.equal(focusCreatorInstalledPlay({ document: doc, opener, play, wasFocused: true }), false);
  doc.focused = true;
  play.hidden = true;
  assert.equal(focusCreatorInstalledPlay({ document: doc, opener, play, wasFocused: true }), false);
});

test('Custom menu labels follow English and Ukrainian without changing mission identity', (t) => {
  const h = fixture(t),
    original = getLocale();
  t.after(() => setLocale(original));
  setLocale('uk', { persist: false });
  translateDOM(h.doc.body);
  assert.equal(h.$('creator-modes').getAttribute('aria-label'), 'Режим гри');
  assert.equal(h.$('resume').textContent, 'Продовжити');
  h.state.savedRaw = 'save';
  h.$('creator-select-mission').click();
  h.$('creator-mission-list').querySelectorAll('button')[1].click();
  assert.equal(h.$('creator-replace-title').textContent, 'Почати іншу спробу?');
  assert.equal(h.$('creator-mission-list').querySelectorAll('button')[1].dataset.mission, 'second');
  setLocale('en', { persist: false });
  assert.equal(h.$('creator-replace-title').textContent, 'Start another attempt?');
  translateDOM(h.doc.body);
  assert.equal(h.$('creator-modes').getAttribute('aria-label'), 'Game mode');
  assert.equal(h.$('resume').textContent, 'Continue');
});

test('result actions and earned media stay reachable while flight hides home and moves the real Pause button', (t) => {
  const h = fixture(t),
    { $, menu, state } = h;
  $('pause').disabled = false;
  state.attempt = {};
  state.paused = false;
  menu.refresh();
  assert.equal($('creator-home').hidden, true);
  assert.equal($('creator-game').hidden, false);
  assert.equal($('pause').parentNode, $('creator-flight-actions'));
  state.paused = true;
  menu.refresh();
  assert.equal($('pause').parentNode, $('creator-primary-actions'));
  assert.equal($('creator-home').hidden, false);
  state.ended = true;
  $('retry').disabled = false;
  menu.refresh();
  assert.equal(menu.primary(), $('retry'), 'a loss exposes the actual Retry action');
  assert.equal($('earned').parentNode, $('creator-game'));
  assert.equal(menu.root(), h.doc.body, 'result video controls are inside the active menu scope');
  $('next').hidden = false;
  $('next').disabled = false;
  menu.refresh();
  assert.equal(menu.primary(), $('next'), 'completion retains the actual Next handler');
  assert.equal($('retry').closest('dialog'), $('creator-settings'));
});

test('save failures remain visible on the compact home and busy state cancels old replacement approval', (t) => {
  const h = fixture(t, { initial: { attempt: {}, savedRaw: 'saved' } }),
    { $ } = h;
  $('save-status').dataset.error = 'true';
  $('save-status').textContent = 'Device storage refused the save.';
  h.menu.refresh();
  assert.equal($('creator-save-warning').hidden, false);
  assert.equal($('creator-save-warning').textContent, $('save-status').textContent);
  $('creator-select-mission').click();
  $('creator-mission-list').querySelector('button').click();
  h.state.busy = true;
  h.menu.refresh();
  assert.equal($('creator-select-mission').disabled, true);
  assert.equal($('creator-replace-attempt').open, false);
  $('creator-replace-confirm').click();
  assert.deepEqual(h.launched, []);
});

test('loading to ready retires the temporary primary Up override and keeps the complete action stack', (t) => {
  const h = fixture(t, { initial: { ready: false, busy: true } }),
    { $, doc } = h;
  h.state.ready = true;
  h.state.busy = false;
  h.menu.refresh();
  const navigation = attachControllerNavigation({
    document: doc,
    getScope: () => 'creator-menu',
    getRoot: h.menu.root,
    getDefaultFocus: h.menu.primary,
  });
  t.after(() => navigation.destroy());
  navigation.engage();
  $('creator-open-settings').focus();
  navigation.handle({ direction: 'up' });
  assert.equal(doc.activeElement, $('creator-select-mission'));
  navigation.handle({ direction: 'up' });
  assert.equal(doc.activeElement, $('start'));
  navigation.handle({ direction: 'up' });
  assert.equal(doc.activeElement, $('creator-mode-solo'));
  navigation.handle({ direction: 'down' });
  assert.equal(doc.activeElement, $('start'));
});

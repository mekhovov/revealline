import test from 'node:test';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { sourceSimGlobalTools, menuPad } from './helpers/global-tools-fixture.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { parse } from 'parse5';
import { Document, Events } from './helpers/couch-dom.mjs';
import { mountWorldApp, routeThumbnail } from '../../optional-practice/civilian-fpv/world-app.mjs';
import { WORLD_CATALOGUE } from '../../optional-practice/civilian-fpv/world-catalogue.mjs';
import {
  createWorldFlight,
  createWorldRecorder,
  initWorldRuntime,
} from '../../optional-practice/civilian-fpv/world-model.mjs';
import {
  resolveSimThemeProfile,
  snapshotSimThemeProfile,
} from '../../optional-practice/civilian-fpv/world-themes.mjs';
import { worldRecordIdentity } from '../../optional-practice/civilian-fpv/world-records.mjs';

const requireAuthoring = createRequire(
  new URL('../../authoring/fpv-worlds/package.json', import.meta.url),
);
const { IDBFactory } = requireAuthoring('fake-indexeddb');
const html = parse(
  await readFile(new URL('../../optional-practice/fpv-worlds/index.html', import.meta.url), 'utf8'),
);

function fixture(
  t,
  {
    storage = new Map(),
    url = 'https://example.test/optional-practice/fpv-worlds/index.html',
    ...factories
  } = {},
) {
  const doc = new Document(),
    win = new Events(),
    frames = new Map(),
    rendered = [];
  const pads = [];
  let frameId = 0,
    now = 0,
    rendererDisposals = 0;
  const createElement = doc.createElement.bind(doc);
  doc.createElement = (tag) => {
    const element = createElement(tag);
    Object.defineProperty(element, 'previousElementSibling', {
      get() {
        const siblings = this.parentElement?.children.filter((child) => child.nodeType === 1);
        return siblings?.[siblings.indexOf(this) - 1] ?? null;
      },
    });
    return element;
  };
  const priorOption = globalThis.Option;
  globalThis.Option = function (text, value) {
    const option = doc.createElement('option');
    option.textContent = text;
    option.value = value;
    return option;
  };
  t.after(() => {
    if (priorOption) globalThis.Option = priorOption;
    else delete globalThis.Option;
  });
  doc.createElementNS = (_namespace, name) => doc.createElement(name);
  function copy(source, parent) {
    if (!source.tagName) return;
    const element = doc.createElement(source.tagName);
    for (const { name, value } of source.attrs ?? []) {
      element.setAttribute(name, value);
      if (name === 'class') element.className = value;
      if (name === 'hidden') element.hidden = true;
      if (name === 'value') element.value = value;
      if (['min', 'max'].includes(name)) element[name] = value;
    }
    parent.append(element);
    for (const child of source.childNodes ?? []) copy(child, element);
    if (source.tagName === 'select') {
      element.value = element.children[0]?.value ?? '';
      Object.defineProperty(element, 'selectedOptions', {
        get: () => element.options.filter((option) => option.value === element.value),
      });
    }
  }
  const body = html.childNodes
    .find((node) => node.tagName === 'html')
    .childNodes.find((node) => node.tagName === 'body');
  for (const child of body.childNodes) copy(child, doc.body);
  const originalSettingsControls = [
    ...doc.getElementById('sim-settings').querySelectorAll('button,select,input'),
    ...doc.getElementById('sim-flight-controls').querySelectorAll('button,select,input'),
  ].filter((node) => node.id !== 'close-sim-settings');
  Object.assign(win, {
    location: new URL(url),
    performance: { now: () => now },
    navigator: { getGamepads: () => pads },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
    indexedDB: new IDBFactory(),
    requestAnimationFrame(callback) {
      frames.set(++frameId, callback);
      return frameId;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
    matchMedia: () => ({ matches: false }),
    setTimeout,
    clearTimeout,
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
  });
  const renderer = {
    available: true,
    setPresentation(value) {
      this.presentation = value;
    },
    setCourse(course) {
      rendered.push({
        course,
        presentation: this.presentation,
        profile: resolveSimThemeProfile(course, this.presentation),
      });
    },
    setQuality() {},
    setDrone(drone) {
      if (rendered.length) rendered.at(-1).drone = drone;
    },
    setGhost() {},
    setPath() {},
    async loadScene() {},
    draw() {},
    dispose() {
      rendererDisposals++;
    },
  };
  const app = mountWorldApp({
    document: doc,
    window: win,
    rendererFactory: () => renderer,
    ...factories,
  });
  t.after(() => app.dispose());
  return {
    app,
    doc,
    win,
    rendered,
    pads,
    originalSettingsControls,
    pendingFrames: () => frames.size,
    rendererDisposals: () => rendererDisposals,
    $: (id) => doc.getElementById(id),
    tick(count = 1) {
      for (let i = 0; i < count; i++) {
        const [id, callback] = frames.entries().next().value;
        frames.delete(id);
        callback(now);
        now += 20;
      }
    },
  };
}

test('World disposal retires menu and renderer owners before their reparented controls disappear', async (t) => {
  const h = fixture(t);
  await h.app.ready;
  await h.app.startFlight(WORLD_CATALOGUE.find((item) => !item.legacy));
  h.$('worlds-shell-action-menu').click();
  assert.ok(h.$('sim-menu-hint'));
  await h.app.dispose();
  assert.equal(h.pendingFrames(), 0);
  assert.equal(h.rendererDisposals(), 1);
  assert.equal(h.$('sim-menu-hint'), null);
  await h.app.dispose();
  h.win.emit('blur');
  assert.equal(h.pendingFrames(), 0);
  assert.equal(h.rendererDisposals(), 1);
});

test('World Reset unapplied fields discards Hunt and pursuit drafts without changing the accepted course', async (t) => {
  const h = fixture(t);
  await h.app.ready;
  const entry = WORLD_CATALOGUE.find((item) => item.id === 'native-pursuit-armor-windows');
  h.$('creator-template').value = `${entry.packIdentity}:${entry.id}`;
  h.$('clone-challenge').click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(h.$('creator-json').value, h.$('studio-status').textContent);
  h.$('criterion-list').value = '0';
  h.$('criterion-list').emit('change');
  const source = JSON.parse(h.$('creator-json').value),
    targets = source.steps['self-level'][0].targets,
    shownTargets = () =>
      h.doc.querySelectorAll('[data-hunt-target-id]').map((node) => node.dataset.huntTargetId),
    graph = () => h.doc.querySelector('[data-pursuit-editor] textarea');
  assert.equal(targets.length, 2);
  assert.deepEqual(shownTargets(), targets);
  const originalGraph = graph().value;
  h.doc.querySelector('[data-hunt-target-action="remove"]').click();
  graph().value = '{"unapplied":true}';
  graph().emit('input');
  h.$('criterion-list').emit('change');
  assert.deepEqual(shownTargets(), targets.slice(1), 'ordinary refresh preserves target drafts');
  assert.equal(graph().value, '{"unapplied":true}', 'ordinary refresh preserves graph drafts');
  h.$('creator-title').value = 'Unapplied title';
  h.$('editor-reset-fields').click();
  assert.deepEqual(shownTargets(), targets);
  assert.equal(graph().value, originalGraph);
  assert.equal(h.$('creator-title').value, source.locales.en.title);
  assert.deepEqual(JSON.parse(h.$('creator-json').value), source);
  assert.equal(h.$('undo-edit').disabled, true, 'reset does not create an applied edit');
  assert.equal(h.app.snapshot().state, undefined, 'reset does not launch a flight');
});

test('World app prepares a pinned appearance and queues drone/theme changes after arming', async (t) => {
  const h = fixture(t);
  await h.app.ready;
  const entry = WORLD_CATALOGUE.find((item) => !item.legacy);
  const theme = h.$('sim-appearance-world');
  theme.value = 'industrial-workshop';
  theme.emit('change');
  await h.app.startFlight(entry);
  assert.equal(h.rendered.at(-1).course.world.themeProfile.id, 'industrial-workshop');
  assert.equal(
    h.doc.querySelector('.world-mini-map svg').getAttribute('data-sim-profile'),
    'industrial-workshop',
  );
  h.$('world-arm').click();
  assert.equal(h.app.snapshot().state.status, 'active');
  h.app.pause();
  const activeRender = h.rendered.at(-1);
  const renderCount = h.rendered.length;
  theme.value = 'authored';
  theme.emit('change');
  assert.notEqual(
    h.doc.querySelector('.world-mini-map svg').getAttribute('data-sim-profile'),
    'industrial-workshop',
  );
  assert.equal(h.rendered.length, renderCount);
  assert.equal(
    h.rendered.at(-1),
    activeRender,
    'lobby appearance must not rebuild an armed flight',
  );
  h.$('drone-look').value = 'utility';
  h.$('drone-look').emit('change');
  assert.equal(h.app.snapshot().appearance.accepted.collectionId, 'industrial-workshop');
  assert.equal(h.app.snapshot().appearance.pending, true);
  await h.app.startFlight(entry);
  assert.equal(h.app.snapshot().appearance.accepted.collectionId, 'authored');
  assert.equal(h.app.snapshot().appearance.accepted.drone, 'utility');
  assert.equal(h.app.snapshot().appearance.pending, false);
  assert.equal(h.app.snapshot().state.status, 'active');
});

test('World route thumbnails share selected palettes without modifying source geometry or authored scene references', (t) => {
  const h = fixture(t);
  const original = WORLD_CATALOGUE.find((item) => !item.legacy).course;
  const profile = resolveSimThemeProfile(original);
  profile.palette.accent = 0xabcdef;
  const course = {
    ...original,
    world: { ...original.world, theme: profile.id, themeProfile: profile },
    scene: { asset: 'authored-model.glb' },
  };
  const before = structuredClone(course);
  const authored = routeThumbnail(h.doc, course);
  const industrial = routeThumbnail(h.doc, course, {
    collectionId: 'industrial-workshop',
    revision: 'r1',
  });
  assert.equal(authored.querySelector('path[stroke-dasharray]').getAttribute('stroke'), '#abcdef');
  assert.equal(
    industrial.querySelector('path[stroke-dasharray]').getAttribute('stroke'),
    '#e8b45c',
  );
  assert.notEqual(
    authored.querySelector('rect').getAttribute('fill'),
    industrial.querySelector('rect').getAttribute('fill'),
  );
  assert.equal(
    authored.querySelector('path[stroke-dasharray]').getAttribute('d'),
    industrial.querySelector('path[stroke-dasharray]').getAttribute('d'),
  );
  assert.deepEqual(course, before);
});

test('World recovery retains its saved theme and drone while new appearance choices remain queued', async (t) => {
  const h = fixture(t);
  await h.app.ready;
  await initWorldRuntime();
  const entry = WORLD_CATALOGUE.find((item) => !item.legacy);
  const themeProfile = resolveSimThemeProfile(entry.course, {
    collectionId: 'industrial-workshop',
    revision: 'r1',
  });
  themeProfile.drone = 'utility';
  themeProfile.palette.wall = 0x123456;
  const pinned = {
    ...entry.course,
    world: { ...entry.course.world, theme: themeProfile.id, themeProfile },
  };
  const flight = createWorldFlight({ course: pinned });
  const recorder = createWorldRecorder(flight);
  flight.arm();
  flight.step({ roll: 0, pitch: 0, yaw: 0, throttle: 0, actions: 0 });
  recorder.record();
  const proof = recorder.export();
  flight.dispose();
  await h.app.startFlight({ ...entry, course: pinned }, { recover: proof });
  const prepared = h.rendered.at(-1).course;
  assert.equal(prepared.world.themeProfile.id, 'industrial-workshop');
  assert.equal(prepared.world.themeProfile.drone, 'utility');
  assert.deepEqual(h.rendered.at(-1).profile, themeProfile);
  h.$('sim-appearance-world').value = 'authored';
  h.$('sim-appearance-world').emit('change');
  assert.equal(h.app.snapshot().appearance.accepted.drone, 'utility');
  assert.equal(h.app.snapshot().appearance.pending, true);
  assert.equal(h.app.snapshot().state.status, 'active');
  assert.equal(h.rendered.at(-1).course, prepared);
});

for (const savedFallback of [false, true])
  test(`World replay visibly falls back from an unavailable pinned revision (${savedFallback ? 'saved authored profile' : 'legacy environment'}) without changing its record`, async (t) => {
    const h = fixture(t);
    await h.app.ready;
    await initWorldRuntime();
    const entry = WORLD_CATALOGUE.find((item) => !item.legacy);
    const authoredProfile = resolveSimThemeProfile(entry.course);
    authoredProfile.palette.wall = 0x123456;
    authoredProfile.drone = 'pixel';
    const source = {
      ...entry.course,
      world: { ...entry.course.world, theme: authoredProfile.id, themeProfile: authoredProfile },
    };
    const themeProfile = (savedFallback ? snapshotSimThemeProfile : resolveSimThemeProfile)(
      source,
      {
        collectionId: 'industrial-workshop',
        revision: 'r1',
      },
    );
    themeProfile.revision = 'r2';
    themeProfile.drone = 'utility';
    const pinned = {
      ...source,
      world: { ...source.world, theme: themeProfile.id, themeProfile },
    };
    const original = structuredClone(pinned);
    const flight = createWorldFlight({ course: pinned });
    const recorder = createWorldRecorder(flight);
    flight.arm();
    flight.step({ roll: 0, pitch: 0, yaw: 0, throttle: 0, actions: 0 });
    recorder.record();
    const proof = recorder.export();
    const identity = worldRecordIdentity({ course: pinned, proof });
    flight.dispose();
    await h.app.startFlight({ ...entry, course: pinned }, { replayProof: proof });
    const rendered = h.rendered.at(-1);
    assert.deepEqual(h.app.snapshot().appearance.accepted, {
      collectionId: 'industrial-workshop',
      revision: 'r2',
      drone: 'utility',
    });
    assert.equal(rendered.presentation.collectionId, 'authored');
    assert.notEqual(rendered.profile.id, 'industrial-workshop');
    if (savedFallback) assert.deepEqual(rendered.profile, authoredProfile);
    else assert.notEqual(rendered.profile.palette.wall, authoredProfile.palette.wall);
    assert.equal(rendered.drone, rendered.profile.drone);
    assert.equal(rendered.course, pinned);
    assert.deepEqual(pinned, original);
    assert.equal(worldRecordIdentity({ course: pinned, proof }), identity);
    assert.match(
      h.$('flight-status').textContent,
      /Playing verified recording.*Recorded appearance unavailable/,
    );
    assert.match(
      h.$('flight-status').textContent,
      savedFallback ? /saved authored appearance/ : /authored environment appearance/,
    );
    h.app.pause();
    assert.match(
      h.doc.querySelector('.sim-appearance-controls [role="status"]').textContent,
      /Recorded appearance unavailable/,
    );
  });

test('World pre-arm appearance refresh keeps focus on the control the player is using', async (t) => {
  const h = fixture(t);
  await h.app.ready;
  await h.app.startFlight(
    WORLD_CATALOGUE.find((item) => !item.legacy),
    { paused: true },
  );
  h.$('world-flight-menu').click();
  h.$('worlds-shell-action-settings').click();
  const select = h.$('sim-appearance-world');
  select.focus();
  select.value = 'industrial-workshop';
  select.emit('change');
  for (let attempt = 0; attempt < 100; attempt++) {
    await new Promise((resolve) => setImmediate(resolve));
    if (
      h.rendered.at(-1)?.profile.id === 'industrial-workshop' &&
      /^Ready/.test(h.$('flight-status').textContent)
    )
      break;
  }
  assert.equal(h.rendered.at(-1).profile.id, 'industrial-workshop');
  assert.match(h.$('flight-status').textContent, /^Ready/);
  assert.equal(h.$('sim-settings').open, true);
  assert.equal(h.$('worlds-shell-pause-dialog').open, true);
  assert.equal(
    h.doc.activeElement === select,
    true,
    `Appearance control lost focus to ${h.doc.activeElement?.id || h.doc.activeElement?.tagName}`,
  );
});

test('World title retains connected catalogue nodes and transfers the common bar into native flight', async (t) => {
  const h = fixture(t);
  await h.app.ready;
  assert.equal(h.$('worlds-shell-home-dialog').open, true);
  assert.equal(h.$('worlds-shell-action-pause').dataset.menuIcon, 'pause');
  assert.equal(h.$('worlds-shell-action-settings').dataset.menuIcon, 'settings');
  assert.ok(h.doc.querySelector('#worlds-shell-home-dialog img'));
  assert.ok(h.$('theme-tabs').isConnected);
  h.$('worlds-shell-action-missions').click();
  assert.equal(h.$('worlds-shell-missions-dialog').open, true);
  assert.ok(h.$('world-grid').isConnected);
  const entry = WORLD_CATALOGUE.find((item) => !item.legacy);
  await h.app.startFlight(entry);
  assert.equal(h.$('worlds-shell-home-dialog').open, false);
  assert.equal(h.$('worlds-shell-missions-dialog').open, false);
  assert.equal(h.$('worlds-shell-action-menu').closest('dialog'), h.$('flight-dialog'));
  h.$('world-arm').click();
  assert.equal(h.app.snapshot().state.status, 'active');
  h.$('worlds-shell-action-menu').click();
  assert.equal(h.app.snapshot().state.status, 'paused');
  assert.equal(h.$('worlds-shell-home-dialog').open, true);
});

test('World keyboard and native pause actions open the same shared menu without resuming on Back', async (t) => {
  const h = fixture(t);
  await h.app.ready;
  await h.app.startFlight(WORLD_CATALOGUE.find((item) => !item.legacy));
  const pauses = [
    () => h.win.emit('keydown', { code: 'KeyP', key: 'p', target: h.$('world-viewport') }),
    () => h.$('flight-dialog').emit('cancel', { bubbles: false }),
    () => h.$('world-flight-menu').click(),
  ];
  for (const pause of pauses) {
    h.$('world-arm').click();
    assert.equal(h.app.snapshot().state.status, 'active');
    pause();
    assert.equal(h.$('worlds-shell-pause-dialog').open, true);
    assert.notEqual(h.$('flight-dialog').dataset.flightMenuOpen, 'true');
    assert.equal(h.app.snapshot().state.status, 'paused');
    const paused = h.app.snapshot().state;
    h.$('worlds-shell-pause-dialog').emit('cancel', { bubbles: false });
    assert.equal(h.$('worlds-shell-pause-dialog').open, false);
    assert.equal(h.$('flight-dialog').open, true);
    assert.deepEqual(h.app.snapshot().state, paused);
  }
});

test('World language refresh preserves native mission ownership and menu phase without another animation frame', async (t) => {
  const h = fixture(t);
  await h.app.ready;
  const entry = WORLD_CATALOGUE.find((item) => item.id === 'native-pursuit-runner-court');
  await h.app.startFlight(entry);
  const shell = h.doc.querySelector('[data-mode-play-shell]');
  const assertMissionOwner = () => {
    const title = h.$('flight-title').textContent;
    // This regression checks ownership; the native host owns title localization.
    assert.ok(Object.values(entry.course.locales).some((copy) => copy.title === title));
    assert.equal(shell.querySelector('.mode-play-mission').textContent, title);
  };
  h.$('world-arm').click();
  h.tick(2);
  const active = h.app.snapshot().state;
  assert.equal(active.status, 'active');
  assert.equal(shell.dataset.phase, 'playing');

  h.$('world-language').value = 'uk';
  h.$('world-language').emit('change');
  assert.deepEqual(h.app.snapshot().state, active);
  assert.equal(shell.dataset.phase, 'playing');
  assert.equal(h.doc.documentElement.lang, 'uk');
  assert.equal(h.$('worlds-shell-action-settings').textContent, 'Налаштування');
  assertMissionOwner();

  h.$('worlds-shell-action-menu').click();
  const paused = h.app.snapshot().state;
  assert.equal(paused.status, 'paused');
  assert.equal(shell.dataset.phase, 'paused');
  assert.equal(h.$('worlds-shell-action-primary').textContent, 'Продовжити');
  h.$('world-language').value = 'en';
  h.$('world-language').emit('change');
  assert.deepEqual(h.app.snapshot().state, paused);
  assert.equal(shell.dataset.phase, 'paused');
  assert.equal(h.doc.documentElement.lang, 'en');
  assertMissionOwner();
  assert.equal(h.$('worlds-shell-action-primary').textContent, 'Continue');
  h.$('worlds-shell-home-dialog').emit('cancel', { bubbles: false });
  assert.deepEqual(h.app.snapshot().state, paused);
});

test('World terminal preview offers Retry and prepares a fresh disarmed attempt', async (t) => {
  const h = fixture(t);
  await h.app.ready;
  const source = WORLD_CATALOGUE.find((item) => !item.legacy);
  const entry = {
    ...source,
    course: {
      ...source.course,
      actors: [],
      steps: {
        'self-level': [{ type: 'survive', ticks: 1 }],
        acro: [{ type: 'survive', ticks: 1 }],
      },
    },
  };
  await h.app.startFlight(entry, { preview: true });
  h.$('world-arm').click();
  h.tick(3);
  assert.equal(h.app.snapshot().state.status, 'complete');
  assert.equal(h.doc.querySelector('[data-mode-play-shell]').dataset.phase, 'results');
  h.$('worlds-shell-action-menu').click();
  assert.equal(h.$('worlds-shell-action-primary').textContent, 'Retry');
  assert.equal(h.$('worlds-shell-action-pause').disabled, true);
  const completedState = h.app.snapshot().state,
    nativeOutcome = h.$('result-panel');
  h.$('worlds-shell-action-home-results').click();
  assert.equal(h.$('worlds-shell-home-dialog').open, false);
  assert.equal(h.$('worlds-shell-results-dialog').open, false);
  assert.equal(h.$('flight-dialog').open, true);
  assert.equal(h.$('result-panel'), nativeOutcome);
  assert.equal(nativeOutcome.hidden, false);
  assert.equal(h.doc.activeElement, nativeOutcome);
  h.tick(3);
  assert.deepEqual(h.app.snapshot().state, completedState);
  h.$('worlds-shell-action-menu').click();
  h.$('worlds-shell-home-dialog').emit('cancel', { bubbles: false });
  assert.equal(h.$('worlds-shell-home-dialog').open, false);
  assert.equal(h.doc.activeElement, nativeOutcome);
  assert.deepEqual(h.app.snapshot().state, completedState);
  h.$('worlds-shell-action-menu').click();
  h.$('worlds-shell-action-primary').click();
  for (let i = 0; i < 100; i++) {
    await new Promise((resolve) => setImmediate(resolve));
    if (h.app.snapshot().state.status === 'disarmed') break;
  }
  assert.equal(h.app.snapshot().state.status, 'disarmed');
  assert.equal(h.app.snapshot().state.ticks, 0);
  assert.equal(h.$('worlds-shell-home-dialog').open, false);
  assert.equal(h.$('flight-dialog').open, true);
  h.$('world-arm').click();
  assert.match(h.$('flight-status').textContent, /Preview: completion does not earn rewards/);
});

test('World menu Back dismisses the visible surface without closing its paused native flight', async (t) => {
  const h = fixture(t);
  await h.app.ready;
  await h.app.startFlight(WORLD_CATALOGUE.find((item) => !item.legacy));
  h.$('world-arm').click();
  h.$('worlds-shell-action-menu').click();
  const paused = h.app.snapshot().state;
  const escape = (element) => {
    element.emit('keydown', { key: 'Escape', code: 'Escape' });
    element.emit('keyup', { key: 'Escape', code: 'Escape' });
  };
  h.doc.emit('keydown', { key: 'Shift', code: 'ShiftLeft' });
  const hint = h.$('worlds-shell-home-dialog').querySelector('.sim-menu-hint');
  const instructions = hint.textContent;
  assert.ok(instructions.length > 0);
  h.win.emit('blur');
  assert.equal(hint.textContent, instructions, 'suspension must not collapse the menu hint');
  assert.equal(hint.hidden, false);
  h.doc.emit('keydown', { key: 'Shift', code: 'ShiftLeft' });
  assert.equal(hint.textContent, instructions, 'input reacquisition keeps the same hint geometry');
  // The hidden catalogue button is not the action bridge for an in-flight menu.
  h.$('lobby-settings').click = () => assert.fail('Settings must use its shared native action');
  h.$('worlds-shell-action-settings').click();
  assert.equal(h.$('sim-settings').open, true);
  assert.equal(
    h.$('flight-source').closest('[role="tabpanel"]').id,
    'worlds-settings-panel-controls',
  );
  escape(h.$('sim-settings').querySelector('button'));
  assert.equal(h.$('sim-settings').open, false);
  assert.equal(h.$('worlds-shell-home-dialog').open, true);
  assert.equal(h.$('flight-dialog').open, true);
  escape(h.$('worlds-shell-action-primary'));
  assert.equal(h.$('worlds-shell-home-dialog').open, false);
  assert.equal(h.$('flight-dialog').open, true);
  assert.deepEqual(h.app.snapshot().state, paused);

  h.$('worlds-shell-action-menu').click();
  h.$('flight-dialog').emit('cancel', { bubbles: false });
  assert.equal(h.$('worlds-shell-home-dialog').open, false);
  assert.equal(h.$('flight-dialog').open, true);
  assert.deepEqual(h.app.snapshot().state, paused);
});

test('World native Hunt guide remains reachable from the shared pause menu without consuming controls or changing the flight', async (t) => {
  const h = fixture(t);
  await h.app.ready;
  await h.app.startFlight(
    WORLD_CATALOGUE.find((entry) => entry.id === 'native-pursuit-armor-windows'),
  );
  assert.equal(h.$('world-flight-enemy-guide').hidden, false);
  h.$('world-arm').click();
  h.$('worlds-shell-action-menu').click();
  const paused = h.app.snapshot();
  h.$('world-menu-enemy-guide').click();
  assert.equal(h.$('world-enemy-guide').open, true);
  assert.match(h.$('world-enemy-guide').textContent, /25 hull damage/);
  h.doc.emit('keydown', { key: ' ', code: 'Space' });
  h.doc.emit('keyup', { key: ' ', code: 'Space' });
  h.tick(5);
  assert.deepEqual(h.app.snapshot().state, paused.state);
  assert.deepEqual(h.app.snapshot().records, paused.records);
  h.$('world-enemy-guide').querySelector('button').click();
  assert.equal(h.$('world-enemy-guide').open, false);
  assert.equal(h.$('worlds-shell-home-dialog').open, true);
  assert.equal(h.$('flight-dialog').open, true);
  assert.deepEqual(h.app.snapshot().state, paused.state);
  // Choosing an ordinary course cannot leave a stale specialist guide button.
  await h.app.startFlight(
    WORLD_CATALOGUE.find((entry) => !entry.legacy && entry.activity !== 'hunt'),
  );
  assert.equal(h.$('world-menu-enemy-guide').hidden, true);
  assert.equal(h.$('world-flight-enemy-guide').hidden, true);
});

for (const section of [false, true])
  test(`World exhausted ${section ? 'section' : 'unfinished'} playback keeps native Results reachable without Continue`, async (t) => {
    const h = fixture(t);
    await h.app.ready;
    await initWorldRuntime();
    const entry = WORLD_CATALOGUE.find((item) => !item.legacy),
      flight = createWorldFlight({ course: entry.course }),
      recorder = createWorldRecorder(flight);
    flight.arm();
    for (let i = 0; i < 4; i++) {
      flight.step({ roll: 0, pitch: 0, yaw: 0, throttle: 0, actions: 0 });
      recorder.record();
    }
    assert.equal(flight.snapshot().status, 'active');
    const proof = recorder.export(),
      original = structuredClone(proof),
      records = h.app.snapshot().records;
    flight.dispose();
    await h.app.startFlight(
      entry,
      section
        ? { checkpoint: { mode: proof.mode, index: 0, proof, watch: true } }
        : { replayProof: proof },
    );
    h.tick(12);
    const ended = h.app.snapshot(),
      nativeOutcome = h.$('result-panel'),
      shell = h.doc.querySelector('[data-mode-play-shell]');
    assert.equal(ended.replay.finished, true);
    assert.equal(ended.state.ticks, proof.frames.length);
    assert.equal(ended.state.status, 'paused');
    if (section) assert.equal(ended.sectionReplay.sectionComplete, false);
    assert.equal(shell.dataset.phase, 'results');
    assert.equal(h.$('world-arm').disabled, true);
    assert.equal(h.$('worlds-shell-action-pause').disabled, true);
    h.$('worlds-shell-action-menu').click();
    assert.equal(h.$('worlds-shell-action-primary').textContent, 'Retry');
    assert.equal(h.$('worlds-shell-action-home-results').hidden, false);
    h.$('worlds-shell-action-home-results').click();
    assert.equal(h.$('worlds-shell-home-dialog').open, false);
    assert.equal(h.$('worlds-shell-results-dialog').open, false);
    assert.equal(h.$('flight-dialog').open, true);
    assert.equal(h.$('result-panel'), nativeOutcome);
    assert.equal(nativeOutcome.hidden, false);
    assert.equal(h.doc.activeElement, nativeOutcome);
    h.$('world-arm').click();
    h.tick(8);
    assert.deepEqual(h.app.snapshot().state, ended.state);
    assert.deepEqual(h.app.snapshot().records, records);
    assert.deepEqual(proof, original);
    h.$('worlds-shell-action-menu').click();
    h.$('worlds-shell-home-dialog').emit('cancel', { bubbles: false });
    assert.equal(h.$('worlds-shell-home-dialog').open, false);
    assert.equal(h.doc.activeElement, nativeOutcome);
    assert.equal(shell.dataset.phase, 'results');
  });

test('World categories retain every authored preference and restore Home and Pause openers', async (t) => {
  const h = fixture(t);
  await h.app.ready;
  h.doc.defaultView.innerWidth = 390;
  const homeSettings = h.$('worlds-shell-action-settings');
  homeSettings.focus();
  homeSettings.click();
  for (const original of h.originalSettingsControls) {
    const control = original.id === 'sim-motion' ? h.$('worlds-global-reducedEffects') : original;
    const panel = control.closest('[role="tabpanel"]');
    assert.ok(panel, `${control.id} belongs to a settings category`);
    assert.equal(panel.closest('dialog'), h.$('sim-settings'));
    h.$(panel.getAttribute('aria-labelledby')).click();
    assert.equal(control.closest('[hidden],[inert]'), null, `${control.id} is reachable`);
  }
  h.$('worlds-settings-tab-controls').click();
  h.$('close-sim-settings').click();
  assert.equal(h.$('sim-settings').open, true);
  assert.equal(h.$('sim-settings').dataset.settingsView, 'categories');
  h.$('close-sim-settings').click();
  assert.equal(h.$('sim-settings').open, false);
  assert.equal(h.doc.activeElement, homeSettings);
  await h.app.startFlight(WORLD_CATALOGUE.find((item) => !item.legacy));
  h.$('world-arm').click();
  h.$('world-flight-menu').click();
  const pauseSettings = h.$('worlds-shell-action-pause-settings');
  pauseSettings.focus();
  pauseSettings.click();
  h.$('close-sim-settings').click();
  assert.equal(h.doc.activeElement, pauseSettings);
  assert.equal(h.app.snapshot().state.status, 'paused');
});

test('Worlds uses shared display and master settings ahead of old SIM-local preferences', async (t) => {
  const storage = new Map([
    [
      'revealline.display.v1',
      JSON.stringify({ textFace: 'plain', textSize: 'large', reducedEffects: true }),
    ],
    ['revealline.audio-master.v1', JSON.stringify({ muted: true, volume: 0.25 })],
    [
      'revealline.appearance.v2',
      JSON.stringify({
        familyId: 'industrial-workshop',
        arcadeArt: 'follow-game',
        ornaments: 'theme',
        highContrast: false,
        opaqueHud: false,
      }),
    ],
    [
      'revealline.fpv.world-settings.v1',
      JSON.stringify({ 'sim-text-face': 'pixel', 'sim-motion': 'system' }),
    ],
  ]);
  const h = fixture(t, { storage });
  await h.app.ready;
  assert.equal(h.$('sim-text-face').value, 'plain');
  assert.equal(h.$('worlds-global-textSize').value, 'large');
  assert.equal(h.$('worlds-global-reducedEffects').checked, true);
  assert.equal(h.$('worlds-global-masterVolume').value, '0.25');
  assert.equal(h.doc.documentElement.dataset.themeFamily, 'industrial-workshop');
  assert.equal(h.doc.body.dataset.effects, 'reduced');
  const root = h.$('sim-settings');
  for (const key of [
    'language',
    'appearance',
    'textFace',
    'textSize',
    'reducedEffects',
    'menuAnimation',
    'masterMuted',
    'masterVolume',
  ])
    assert.equal(root.querySelectorAll(`[data-global-setting="${key}"]`).length, 1, key);
  h.$('worlds-global-textSize').value = 'standard';
  h.$('worlds-global-textSize').emit('change');
  assert.equal(JSON.parse(storage.get('revealline.display.v1')).textSize, 'standard');
});

test('World shared tools keep iframe focus through D-pad and return to paused Settings on controller Back', async (t) => {
  const h = fixture(t, { globalToolsFactory: sourceSimGlobalTools });
  await h.app.ready;
  const entry = WORLD_CATALOGUE.find((item) => !item.legacy);
  await h.app.startFlight(entry);
  h.$('world-arm').click();
  h.tick(3);
  h.$('worlds-shell-action-pause').click();
  const paused = h.app.snapshot().state;
  h.$('worlds-shell-action-settings').click();
  h.$('worlds-settings-tab-controls').click();
  await waitFor(() => h.$('sim-global-tools-controllerTools'));
  const opener = h.$('sim-global-tools-controllerTools');
  opener.focus();
  opener.click();
  const dialog = h.$('sim-global-tools-tool-dialog'),
    frame = dialog.querySelector('iframe');
  assert.equal(dialog.open, true);
  frame.focus();
  const pad = menuPad();
  h.pads.push(pad);
  h.tick(2);
  pad.buttons[13] = { pressed: true, value: 1 };
  h.tick();
  pad.buttons[13] = { pressed: false, value: 0 };
  h.tick();
  assert.equal(h.doc.activeElement, frame);
  assert.deepEqual(h.app.snapshot().state, paused);
  pad.buttons[1] = { pressed: true, value: 1 };
  h.tick();
  pad.buttons[1] = { pressed: false, value: 0 };
  h.tick();
  assert.equal(dialog.open, false);
  assert.equal(h.$('sim-settings').open, true);
  assert.equal(h.doc.activeElement, opener);
  assert.deepEqual(h.app.snapshot().state, paused);
  opener.click();
  assert.equal(dialog.open, true);
  frame.focus();
  h.tick(2);
  pad.buttons[9] = { pressed: true, value: 1 };
  h.tick();
  pad.buttons[9] = { pressed: false, value: 0 };
  h.tick();
  assert.equal(dialog.open, false, 'Start also exits the focused tool frame.');
  assert.equal(h.$('sim-settings').open, true);
  assert.equal(h.doc.activeElement, opener);
  assert.deepEqual(h.app.snapshot().state, paused);
});

test('fresh Ukrainian World launch localizes shared Appearance and cue controls immediately', async (t) => {
  const prior = getLocale();
  t.after(() => setLocale(prior, { persist: false }));
  setLocale('en', { persist: false });
  const h = fixture(t, {
    url: 'https://example.test/optional-practice/fpv-worlds/index.html?lang=uk',
  });
  await h.app.ready;
  assert.equal(h.doc.querySelector('.theme-family-controls h3').textContent, 'Вигляд');
  assert.equal(h.$('sim-global-menu-audio-enabled').closest('label').textContent, 'Звуки меню');
});

test('World flight feedback and shared menu sound retain separate sliders and preference records', async (t) => {
  const storage = new Map([
    [
      'revealline.fpv.audio-mix.v1',
      JSON.stringify({ format: 'SimAudioMix.v1', interface: 0.62, motor: 0.7, ambience: 0.8 }),
    ],
    ['revealline.menu-audio.v1', JSON.stringify({ enabled: true, volume: 0.35 })],
  ]);
  const h = fixture(t, { storage });
  await h.app.ready;
  const feedback = h.$('sim-audio-mix-interface'),
    menu = h.$('sim-global-menu-audio-volume');
  assert.equal(feedback.value, '62');
  assert.equal(menu.value, '35');
  const originalMenu = storage.get('revealline.menu-audio.v1');
  feedback.value = '21';
  feedback.emit('input');
  assert.equal(menu.value, '35');
  assert.equal(storage.get('revealline.menu-audio.v1'), originalMenu);
  assert.deepEqual(JSON.parse(storage.get('revealline.fpv.audio-mix.v1')), {
    format: 'SimAudioMix.v1',
    interface: 0.21,
    motor: 0.7,
    ambience: 0.8,
  });
  const savedMix = storage.get('revealline.fpv.audio-mix.v1');
  menu.value = '76';
  menu.emit('input');
  assert.equal(feedback.value, '21');
  assert.equal(storage.get('revealline.fpv.audio-mix.v1'), savedMix);
  assert.deepEqual(JSON.parse(storage.get('revealline.menu-audio.v1')), {
    enabled: true,
    volume: 0.76,
  });
});

test('World result shortcuts are immediately available while the result is being verified', async (t) => {
  const h = fixture(t);
  await h.app.ready;
  const source = WORLD_CATALOGUE.find((item) => !item.legacy);
  const entry = {
    ...source,
    course: {
      ...source.course,
      actors: [],
      steps: {
        'self-level': [{ type: 'survive', ticks: 1 }],
        acro: [{ type: 'survive', ticks: 1 }],
      },
    },
  };
  await h.app.startFlight(entry, { preview: true });
  h.$('world-arm').click();
  h.tick(3);
  const choice = (text) =>
    [...h.$('result-panel').querySelectorAll('button')].find((node) => node.textContent === text);
  assert.ok(choice('Random level'));
  assert.ok(choice('Choose mission'));
  assert.ok(choice('Home'));
  choice('Choose mission').click();
  assert.equal(h.$('worlds-shell-missions-dialog').open, true);
  assert.equal(h.app.snapshot().state.status, 'complete');
});

test('World defeat focuses Retry and verification preserves the connected action row and chosen focus', async (t) => {
  const h = fixture(t);
  await h.app.ready;
  const source = WORLD_CATALOGUE.find((item) => !item.legacy);
  const entry = {
    ...source,
    course: {
      ...source.course,
      rules: { ...source.course.rules, maxTicks: 1 },
    },
  };
  await h.app.startFlight(entry, { preview: true });
  h.$('world-arm').click();
  h.tick(3);
  assert.equal(h.app.snapshot().state.status, 'expired');
  const panel = h.$('result-panel'),
    actionRow = panel.querySelector('.continuous-result-actions'),
    retry = [...actionRow.querySelectorAll('button')].find(
      (node) => node.textContent === 'Fly again',
    ),
    choose = [...actionRow.querySelectorAll('button')].find(
      (node) => node.textContent === 'Choose mission',
    );
  assert.equal(h.doc.activeElement, retry, 'Defeat must prepare Retry, never Next.');
  choose.focus();
  let removals = 0;
  const remove = actionRow.remove.bind(actionRow);
  actionRow.remove = () => {
    removals++;
    return remove();
  };
  await waitFor(() =>
    panel.textContent.includes('Authoring preview · no rewards or completion earned.'),
  );
  assert.equal(removals, 0, 'Verification must not detach and blur the action subtree.');
  assert.equal(actionRow.isConnected, true);
  assert.equal(
    h.doc.activeElement,
    choose,
    'Verification must not override deliberate navigation.',
  );
  assert.equal(panel.querySelector('.continuous-result-actions'), actionRow);
});

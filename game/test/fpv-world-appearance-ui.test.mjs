import test from 'node:test';
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

function fixture(t) {
  const doc = new Document(),
    win = new Events(),
    storage = new Map(),
    frames = new Map(),
    rendered = [];
  let frameId = 0,
    now = 0;
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
  Object.assign(win, {
    location: new URL('https://example.test/optional-practice/fpv-worlds/index.html'),
    performance: { now: () => now },
    navigator: { getGamepads: () => [] },
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
    dispose() {},
  };
  const app = mountWorldApp({ document: doc, window: win, rendererFactory: () => renderer });
  t.after(() => app.dispose());
  return {
    app,
    doc,
    win,
    rendered,
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
  assert.equal(h.app.snapshot().state.status, 'disarmed');
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
  assert.equal(h.app.snapshot().state.status, 'paused');
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
  await h.app.startFlight(WORLD_CATALOGUE.find((item) => !item.legacy));
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
  assert.equal(h.doc.activeElement, select);
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
    assert.equal(h.$('worlds-shell-home-dialog').open, true);
    assert.notEqual(h.$('flight-dialog').dataset.flightMenuOpen, 'true');
    assert.equal(h.app.snapshot().state.status, 'paused');
    const paused = h.app.snapshot().state;
    h.$('worlds-shell-home-dialog').emit('cancel', { bubbles: false });
    assert.equal(h.$('worlds-shell-home-dialog').open, false);
    assert.equal(h.$('flight-dialog').open, true);
    assert.deepEqual(h.app.snapshot().state, paused);
  }
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
  assert.equal(h.$('sim-flight-controls').parentElement, h.$('sim-settings-controls'));
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

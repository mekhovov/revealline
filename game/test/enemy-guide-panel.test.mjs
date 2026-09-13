import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Events, Document } from './helpers/couch-dom.mjs';
import { SoloElement, soloPage, memoryStorage } from './helpers/solo-dom.mjs';
import { attachEnemyGuide } from '../ui/enemy-guide.mjs';
import {
  attachEnemyWorkshopReturnHost,
  attachEnemyWorkshopReturn,
} from '../ui/enemy-workshop-return.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

const themes = JSON.parse(readFileSync(new URL('../content/themes.json', import.meta.url))).themes;
const impact = JSON.parse(
  readFileSync(new URL('../content/scenarios/line-impact-demo.json', import.meta.url)),
);
const handoff = 'revealline.playground.current';
function setup(t, options = {}) {
  const doc = new Document(),
    host = new Events();
  host.location = { href: 'http://localhost/releases/v0.28.0/site/game/' };
  host.crypto = globalThis.crypto;
  host.sessionStorage = memoryStorage({ [handoff]: 'prior preview bytes' });
  doc.createElement = (tag) => {
    const el = new SoloElement(doc, tag);
    el.getContext = () => options.context ?? null;
    return el;
  };
  const opener = doc.createElement('button');
  doc.body.append(opener);
  opener.focus();
  let started = 0,
    returned = 0,
    closed = 0;
  const guide = attachEnemyGuide({
    document: doc,
    window: host,
    themes,
    getThemeId: () => 'ukraine',
    getTurnPolicy: () => 'grid-center',
    loadImpactScenario: async () => impact,
    onPractice: () => started++,
    onReturn: () => returned++,
    onClose: () => closed++,
    onRead: (request) => nav.beginReading(request),
    ...options,
  });
  const nav = attachControllerNavigation({
    document: doc,
    getScope: () => (guide.dialog.open ? 'guide' : 'closed'),
    getRoot: () => guide.dialog,
    getDefaultFocus: () => doc.getElementById('enemy-guide-topic'),
    onBack: () => guide.close(),
    keyboard: true,
  });
  t.after(() => {
    nav.destroy();
    guide.dispose();
  });
  guide.open();
  nav.sync();
  return {
    doc,
    host,
    guide,
    nav,
    opener,
    get started() {
      return started;
    },
    get returned() {
      return returned;
    },
    get closed() {
      return closed;
    },
    $: (id) => doc.getElementById(`enemy-guide-${id}`),
  };
}
test('guide has concise theme-aware copy and native controls reachable through shared navigation', (t) => {
  const h = setup(t);
  assert.equal(h.$('theme').value, 'ukraine');
  assert.match(h.$('form').textContent, /beetle/i);
  h.nav.engage();
  h.nav.handle({ confirm: true });
  h.nav.handle({ direction: 'down' });
  h.nav.handle({ confirm: true });
  assert.equal(h.$('topic').value, 'border-patrol');
  assert.match(h.$('spot').textContent, /starting ground/);
  const found = new Set();
  for (let i = 0; i < 12; i++) {
    found.add(h.doc.activeElement.id);
    h.nav.handle({ direction: 'down' });
  }
  for (const id of ['topic', 'theme', 'read', 'previous', 'next', 'play', 'back'])
    assert.ok(found.has(`enemy-guide-${id}`), id);
  h.$('previous').click();
  assert.equal(h.$('topic').value, 'bouncer');
  h.$('previous').click();
  assert.equal(h.$('topic').value, 'line-impact');
  assert.equal(h.$('exercise').closest('label').hidden, false);
  h.$('exercise').value = 'escape';
  h.$('exercise').onchange();
  assert.match(h.$('instructions').textContent, /Enable Boost/);
  h.nav.handle({ back: true });
  assert.equal(h.guide.dialog.open, false);
  assert.equal(h.doc.activeElement, h.opener);
});
test('original role previews move but Pause and reduced effects hold their cosmetic frames', (t) => {
  const calls = [],
    context = new Proxy(
      {},
      { get: (target, key) => target[key] ?? ((...args) => calls.push([key, ...args])) },
    );
  const h = setup(t, { context });
  const paint = (dt, settings) => {
    calls.length = 0;
    h.guide.update(dt, settings);
    return structuredClone(calls);
  };
  const first = paint(0.1),
    moving = paint(0.1);
  assert.notDeepEqual(moving, first);
  assert.deepEqual(paint(0.1, { paused: true }), moving);
  const reduced = paint(0.1, { reduced: true });
  assert.deepEqual(paint(0.1, { reduced: true }), reduced);
});
test('practice uses a version-relative same-origin URL and restores only its own temporary handoff', async (t) => {
  const h = setup(t);
  h.guide.open({ topic: 'line-impact' });
  assert.equal(await h.$('play').onclick(), true);
  const url = new URL(h.guide.frame.src);
  assert.equal(url.pathname, '/releases/v0.28.0/site/game/');
  assert.equal(url.searchParams.get('practice-return'), 'enemy-guide');
  assert.equal(h.started, 1);
  assert.equal(h.guide.ownsPracticeFocus(), true);
  const data = JSON.parse(h.host.sessionStorage.getItem(handoff));
  assert.equal(data.level.id, 'line-impact-demo');
  assert.equal(data.settings.turnPolicy, 'grid-center');
  assert.equal(data.theme.id, 'ukraine');
  assert.equal(h.guide.close(), false);
  assert.equal(h.guide.practiceActive, false);
  assert.equal(h.guide.dialog.open, true);
  assert.equal(h.returned, 1);
  assert.equal(h.$('topic').value, 'line-impact');
  assert.equal(h.host.sessionStorage.getItem(handoff), 'prior preview bytes');
  await h.$('play').onclick();
  h.host.sessionStorage.setItem(handoff, 'a newer explicit preview');
  h.$('return').click();
  assert.equal(h.host.sessionStorage.getItem(handoff), 'a newer explicit preview');
});
test('Cancel or disposal during preparation cannot launch late or replace preview/save data', async (t) => {
  let resolve;
  const pending = new Promise((done) => {
    resolve = done;
  });
  const h = setup(t, { loadImpactScenario: () => pending });
  h.guide.open({ topic: 'line-impact' });
  const operation = h.$('play').onclick();
  h.guide.close();
  resolve(impact);
  assert.equal(await operation, false);
  assert.equal(h.started, 0);
  assert.equal(h.guide.practiceActive, false);
  assert.equal(h.host.sessionStorage.getItem(handoff), 'prior preview bytes');
  const failing = setup(t, {
    onPractice: () => {
      throw new Error('Flight could not pause.');
    },
  });
  assert.equal(await failing.$('play').onclick(), false);
  assert.match(failing.$('status').textContent, /Flight could not pause/);
  assert.equal(failing.guide.practiceActive, false);
  assert.equal(failing.host.sessionStorage.getItem(handoff), 'prior preview bytes');
});
test('storage failure is visible and returns the suspended parent without launching a child', async (t) => {
  const h = setup(t);
  h.host.sessionStorage.setItem = () => {
    throw new Error('Storage full');
  };
  assert.equal(await h.$('play').onclick(), false);
  assert.match(h.$('status').textContent, /Storage full/);
  assert.equal(h.guide.practiceActive, false);
  assert.equal(h.returned, 1);
  assert.equal(h.host.sessionStorage.getItem(handoff), 'prior preview bytes');
});
test('a denied preview restoration stays visible after practice returns to the guide', async (t) => {
  const h = setup(t);
  assert.equal(await h.$('play').onclick(), true);
  h.host.sessionStorage.setItem = () => {
    throw new Error('Storage denied during return');
  };
  h.$('return').click();
  assert.equal(h.guide.practiceActive, false);
  assert.equal(h.returned, 1);
  assert.equal(h.guide.dialog.open, true);
  assert.match(h.$('status').textContent, /temporary handoff could not be restored/);
});
test('a cancelled asynchronous pause callback cannot close a newer lesson', async (t) => {
  let resolveFirst,
    calls = 0,
    oldSignal;
  const h = setup(t, {
    onPractice: ({ signal }) => {
      calls++;
      if (calls === 1) {
        oldSignal = signal;
        return new Promise((resolve) => {
          resolveFirst = resolve;
        });
      }
    },
  });
  const old = h.$('play').onclick();
  await new Promise((resolve) => setImmediate(resolve));
  h.guide.close();
  assert.equal(oldSignal.aborted, true);
  h.guide.open({ topic: 'line-impact' });
  assert.equal(await h.$('play').onclick(), true);
  const currentURL = h.guide.frame.src,
    currentHandoff = h.host.sessionStorage.getItem(handoff);
  resolveFirst();
  assert.equal(await old, false);
  assert.equal(h.guide.practiceActive, true);
  assert.equal(h.guide.frame.src, currentURL);
  assert.equal(h.host.sessionStorage.getItem(handoff), currentHandoff);
});
test('bridge accepts only finite return destinations and never a foreign game URL', (t) => {
  const h = setup(t),
    frame = { contentWindow: {} };
  for (const options of [
    { returnTo: 'write-profile' },
    { gameURL: 'https://elsewhere.test/game/' },
  ])
    assert.throws(() =>
      attachEnemyWorkshopReturnHost({ window: h.host, frame, onReturn() {}, ...options }),
    );
  const root = h.doc.createElement('div');
  root.id = 'game-overlay';
  const actions = h.doc.createElement('div');
  actions.className = 'overlay-actions';
  root.append(actions);
  h.doc.body.append(root);
  const base = `http://localhost/game/?practice=1&enemy-workshop-session=${'a'.repeat(32)}`;
  for (const tail of [
    '&practice-return=write-profile',
    '&practice-return=enemy-guide&practice-return=workshop',
  ]) {
    attachEnemyWorkshopReturn({
      enabled: true,
      window: { parent: {}, location: { href: base + tail } },
      document: h.doc,
      onReturn() {},
    });
    assert.equal(h.doc.getElementById('enemy-workshop-return'), null);
  }
});
test('actual child practice can lose, Retry the same impact lesson and return to the unchanged guide without rewards', async (t) => {
  const h = setup(t);
  h.guide.open({ topic: 'line-impact' });
  await h.$('play').onclick();
  let page;
  h.host.postMessage = (data, targetOrigin) => {
    assert.equal(targetOrigin, 'http://localhost');
    queueMicrotask(() =>
      h.host.emit('message', { data, origin: 'http://localhost', source: page.win }),
    );
  };
  page = await soloPage(t, {
    search: new URL(h.guide.frame.src).search,
    parentWindow: h.host,
    previewStorage: h.host.sessionStorage,
  });
  h.guide.frame.contentWindow = page.win;
  assert.equal(page.$('enemy-workshop-return').textContent, 'Return to field guide');
  page.$('start-button').click();
  page.key('ArrowDown');
  for (let i = 0; i < 400 && page.rendered.run.status === 'running'; i++) page.frame();
  page.key('ArrowDown', false);
  const lost = page.rendered.run,
    checkpoint = authoritativeCheckpoint(lost);
  assert.equal(lost.status, 'lost');
  for (let i = 0; i < 10; i++) page.frame(100);
  page.$('retry-button').click();
  page.frame(0);
  assert.equal(page.rendered.run.levelId, 'line-impact-demo');
  assert.equal(page.rendered.run.lives, 1);
  assert.equal(page.rendered.run.tick, 0);
  page.$('pause-button').click();
  page.$('enemy-workshop-return').click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.guide.practiceActive, false);
  assert.equal(h.guide.dialog.open, true);
  assert.equal(h.$('topic').value, 'line-impact');
  assert.equal(h.doc.activeElement, h.$('play'));
  assert.equal(h.host.sessionStorage.getItem(handoff), 'prior preview bytes');
  assert.equal(page.storage.writes.length, 0);
  assert.deepEqual(authoritativeCheckpoint(lost), checkpoint);
  assert.deepEqual(page.errors, []);
});

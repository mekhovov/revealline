import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Events, Document } from './helpers/couch-dom.mjs';
import { SoloElement, soloPage, memoryStorage } from './helpers/solo-dom.mjs';
import { attachEnemyGuide } from '../ui/enemy-guide.mjs';
import { createEnemyPresentations } from '../enemy-presentations.mjs';
import { createEnemyBodyAssets, createEnemyImagePool } from '../ui/enemy-body-assets.mjs';
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
const enemyPresentations = createEnemyPresentations(
  JSON.parse(readFileSync(new URL('../content/enemy-presentations.json', import.meta.url))),
);
const settleArtwork = () => new Promise((resolve) => setImmediate(resolve));
function deferredArtwork() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function artworkFixture({ load, catalog } = {}) {
  const loads = [],
    released = [],
    calls = [];
  let notify;
  const context = new Proxy(
    {},
    {
      get: (target, key) => target[key] ?? ((...args) => calls.push([key, ...args])),
      set: (target, key, value) => {
        target[key] = value;
        calls.push(['set', key, value]);
        return true;
      },
    },
  );
  const pool = createEnemyImagePool({
    load: async (record, options) => {
      loads.push(record.type);
      return load
        ? load(record, options)
        : {
            image: { type: record.type },
            release() {
              released.push(record.type);
            },
          };
    },
  });
  return {
    context,
    calls,
    loads,
    released,
    pool,
    notify: () => notify(),
    createBodyAssets({ changed }) {
      notify = changed;
      return createEnemyBodyAssets({
        pool,
        changed,
        catalog: catalog ?? (async () => enemyPresentations),
      });
    },
  };
}
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
test('the guide paints only the selected registered image and motion, with separate boss bodies', async (t) => {
  const art = artworkFixture();
  const h = setup(t, { ...art, getThemeId: () => 'fpv' });
  assert.deepEqual(art.loads, []);
  for (const record of enemyPresentations.entries) {
    h.$('topic').value = record.type;
    h.$('topic').onchange();
    await settleArtwork();
    art.calls.length = 0;
    h.guide.update(0.1);
    const images = art.calls.filter(([method]) => method === 'drawImage');
    assert.equal(images.length, 1);
    assert.deepEqual(images[0][1], { type: record.type });
    assert.equal(art.pool.size(), 1);
    for (const part of record.motion)
      assert.ok(
        art.calls.some(
          ([method, key, value]) => method === 'set' && key === 'fillStyle' && value === part.color,
        ),
      );
    assert.equal(h.$('artwork-status').hidden, true);
  }
  assert.deepEqual(
    art.loads,
    enemyPresentations.entries.map(({ type }) => type),
  );
  h.$('theme').value = 'ukraine';
  h.$('theme').onchange();
  await settleArtwork();
  assert.equal(art.pool.size(), 0);
  assert.deepEqual(art.released, art.loads);
  art.calls.length = 0;
  h.guide.update(0.1);
  assert.equal(
    art.calls.some(([method]) => method === 'drawImage'),
    false,
  );
  h.guide.open({ topic: 'line-impact' });
  art.calls.length = 0;
  h.guide.update(0.1);
  await settleArtwork();
  assert.equal(art.loads.length, 7);
  assert.ok(
    art.calls.some(
      ([method, x, y, width, height]) =>
        method === 'fillRect' && x === 20 && y === 51 && width === 152 && height === 2,
    ),
  );
  assert.equal(
    art.calls.some(([method]) => method === 'drawImage'),
    false,
  );
});
test('artwork completion repaints the same manual-clock frame and preserves reduced effects', async (t) => {
  const art = artworkFixture();
  const h = setup(t, { ...art, getThemeId: () => 'fpv' });
  await settleArtwork();
  const paint = (settings) => {
    art.calls.length = 0;
    h.guide.update(0.1, settings);
    return structuredClone(art.calls);
  };
  paint({});
  for (const settings of [{ paused: true }, { reduced: true }]) {
    const held = paint(settings);
    art.calls.length = 0;
    art.notify();
    assert.deepEqual(art.calls, held);
    assert.deepEqual(paint(settings), held);
  }
});
test('retired guide catalogs cannot request images after a topic change, hidden page or disposal', async (t) => {
  const pending = [];
  const art = artworkFixture({
    catalog: () => {
      const item = deferredArtwork();
      pending.push(item);
      return item.promise;
    },
  });
  const h = setup(t, { ...art, getThemeId: () => 'fpv' });
  await settleArtwork();
  h.guide.open({ topic: 'line-impact' });
  pending[0].resolve(enemyPresentations);
  await settleArtwork();
  assert.deepEqual(art.loads, []);
  h.guide.open({ topic: 'bouncer' });
  await settleArtwork();
  h.doc.hidden = true;
  h.doc.emit('visibilitychange');
  pending[1].resolve(enemyPresentations);
  await settleArtwork();
  assert.deepEqual(art.loads, []);
  h.doc.hidden = false;
  h.doc.emit('visibilitychange');
  await settleArtwork();
  h.guide.dispose();
  pending[2].resolve(enemyPresentations);
  await settleArtwork();
  assert.deepEqual(art.loads, []);
  assert.equal(art.pool.size(), 0);
});
test('returning to a visible or reopened guide reacquires only its selected body', async (t) => {
  const art = artworkFixture();
  const h = setup(t, { ...art, getThemeId: () => 'fpv' });
  await settleArtwork();
  for (const boundary of ['visibility', 'pagehide', 'close']) {
    if (boundary === 'visibility') {
      h.doc.hidden = true;
      h.doc.emit('visibilitychange');
    }
    if (boundary === 'pagehide') h.host.emit('pagehide');
    if (boundary === 'close') h.guide.close();
    assert.equal(art.pool.size(), 0);
    assert.equal(art.released.length, art.loads.length);
    if (boundary === 'visibility') {
      h.doc.hidden = false;
      h.doc.emit('visibilitychange');
    }
    if (boundary === 'pagehide') h.host.emit('pageshow');
    if (boundary === 'close') h.guide.open();
    await settleArtwork();
    assert.equal(art.pool.size(), 1);
    assert.equal(art.loads.length, art.released.length + 1);
    assert.ok(art.loads.every((type) => type === 'bouncer'));
    assert.equal(h.$('artwork-status').hidden, true);
  }
});
test('hidden, closed, page-hidden and disposed previews release pending decodes without late painting', async (t) => {
  for (const boundary of ['visibility', 'close', 'native-close', 'pagehide', 'dispose']) {
    const pending = deferredArtwork();
    let closed = 0,
      signal;
    const art = artworkFixture({
      load: (_record, options) => {
        signal = options.signal;
        return pending.promise;
      },
    });
    const h = setup(t, { ...art, getThemeId: () => 'fpv' });
    await settleArtwork();
    assert.equal(art.loads.length, 1, boundary);
    if (boundary === 'visibility') {
      h.doc.hidden = true;
      h.doc.emit('visibilitychange');
    }
    if (boundary === 'close') h.guide.close();
    if (boundary === 'native-close') {
      h.guide.dialog.close();
      h.guide.dialog.emit('close');
    }
    if (boundary === 'pagehide') h.host.emit('pagehide');
    if (boundary === 'dispose') h.guide.dispose();
    assert.equal(signal.aborted, true, boundary);
    assert.equal(art.pool.size(), 0, boundary);
    art.calls.length = 0;
    pending.resolve({
      image: { retired: boundary },
      release() {
        closed++;
      },
    });
    await settleArtwork();
    art.notify();
    assert.equal(closed, 1, boundary);
    assert.deepEqual(art.calls, [], boundary);
  }
});
test('practice releases artwork immediately and its return errors survive independent artwork failures', async (t) => {
  const pause = deferredArtwork();
  const art = artworkFixture({
    load: async () => {
      throw new Error('Artwork unavailable');
    },
  });
  const h = setup(t, { ...art, getThemeId: () => 'fpv', onPractice: () => pause.promise });
  await settleArtwork();
  assert.match(h.$('artwork-status').textContent, /unavailable.*vector body/);
  assert.equal(h.$('artwork-status').hidden, false);
  const preparing = h.$('play').onclick();
  assert.equal(art.pool.size(), 0);
  assert.equal(h.$('artwork-status').hidden, true);
  const loads = art.loads.length;
  art.notify();
  assert.match(h.$('status').textContent, /Preparing an isolated lesson/);
  await settleArtwork();
  pause.resolve();
  assert.equal(await preparing, true);
  art.notify();
  assert.equal(art.loads.length, loads);
  assert.equal(art.pool.size(), 0);
  assert.match(h.$('status').textContent, /Practice only/);
  h.host.sessionStorage.setItem = () => {
    throw new Error('Restoration denied');
  };
  h.$('return').click();
  await settleArtwork();
  assert.match(h.$('status').textContent, /temporary handoff could not be restored/);
  assert.match(h.$('artwork-status').textContent, /unavailable.*vector body/);
  assert.equal(h.$('artwork-status').hidden, false);
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

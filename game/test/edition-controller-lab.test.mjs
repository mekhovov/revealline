import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Events } from './helpers/couch-dom.mjs';
import { editionProviderFixture } from './helpers/edition-provider-fixture.mjs';
import { CONTROLLER_PREVIEW_STATUS_FORMAT } from '../ui/controller-preview.mjs';

test('actual company lab loads only admitted boot data and never overwrites Playground', async () => {
  const fixture = await editionProviderFixture();
  const doc = new Document(),
    host = new Events();
  const originals = new Map(),
    writes = [],
    posts = [];
  host.location = new URL('http://localhost/game/controller-lab/?edition=sample-public');
  const ids = [
    'game-frame',
    'load-status',
    'connect',
    'disconnect',
    'release',
    'focus-game',
    'connection-status',
    'gesture',
    'mission',
    'craft',
    'steering',
    'viewport',
    'frame-space',
    'viewport-readout',
    'load',
    'scope',
    'focused',
    'pad-status',
    'apply-stick',
    'axis-status',
    'practice-difficulty',
    'practice-difficulty-field',
    'control-concepts-open',
    ...[0, 1, 2, 3].flatMap((index) => [`axis-${index}`, `axis-${index}-value`]),
  ];
  const selects = new Set([
    'mission',
    'craft',
    'steering',
    'viewport',
    'gesture',
    'practice-difficulty',
  ]);
  const elements = Object.fromEntries(
    ids.map((id) => {
      const element = doc.createElement(
        selects.has(id) ? 'select' : id === 'game-frame' ? 'iframe' : 'div',
      );
      element.id = id;
      doc.body.append(element);
      return [id, element];
    }),
  );
  const home = doc.createElement('a');
  home.setAttribute('data-workshop-return', 'game');
  const playground = doc.createElement('a');
  playground.setAttribute('data-workshop-tool', 'playground');
  doc.body.append(home, playground);
  elements['game-frame'].contentWindow = {
    postMessage(data) {
      posts.push(data);
    },
    focus() {},
  };
  elements['frame-space'].clientWidth = 1000;
  elements['practice-difficulty'].value = 'standard';
  elements.steering.value = 'immediate';
  elements.viewport.value = '1280x720';
  const globals = {
    window: host,
    document: doc,
    fetch: fixture.fetcher,
    sessionStorage: {
      setItem(...args) {
        writes.push(args);
        throw new Error('Forbidden practice write');
      },
    },
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
  };
  for (const [key, value] of Object.entries(globals)) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const clickLoad = async () => {
    for (const listener of elements.load.listeners.get('click') ?? []) await listener({});
  };
  try {
    await import(`../controller-lab/lab.mjs?edition-test=${Date.now()}`);
    assert.equal(elements.mission.children.length, 4, elements['load-status'].textContent);
    assert.equal(elements.craft.children.length, 7);
    assert.equal(playground.hidden, true);
    assert.equal(home.textContent, fixture.catalog.editions[0].name);
    assert.equal(doc.body.dataset.editionId, 'sample-public');
    assert.equal(
      doc.documentElement.style['--brand-accent'],
      fixture.data.themes.themes[0].palette.accent,
    );
    let destination = new URL(elements['game-frame'].src);
    assert.equal(destination.searchParams.get('edition-mission'), 'nearby-shore');
    assert.equal(destination.searchParams.get('edition'), 'sample-public');
    elements.craft.value = 'fiber';
    elements.steering.value = 'grid-center';
    elements['practice-difficulty'].value = 'gentle';
    await clickLoad();
    destination = new URL(elements['game-frame'].src);
    assert.equal(destination.searchParams.get('class'), 'fiber');
    assert.equal(destination.searchParams.get('turn-policy'), 'grid-center');
    assert.equal(destination.searchParams.get('difficulty'), 'gentle');
    elements.mission.value = '1';
    elements.mission.emit('change');
    assert.equal(elements['practice-difficulty'].disabled, true);
    await clickLoad();
    destination = new URL(elements['game-frame'].src);
    assert.equal(destination.searchParams.get('course'), 'first-flight');
    assert.equal(destination.searchParams.get('edition'), 'sample-public');
    assert.equal(destination.pathname, '/game/index.html');
    assert.ok(fixture.requests.every((path) => fixture.files.has(path)));
    assert.ok(
      !fixture.requests.some((path) =>
        /fieldcraft|sentinel-relay|reading-practice|content\/themes.json/.test(path),
      ),
    );
    assert.deepEqual(writes, []);
    host.emit('message', {
      source: elements['game-frame'].contentWindow,
      origin: host.location.origin,
      data: {
        format: CONTROLLER_PREVIEW_STATUS_FORMAT,
        session: destination.searchParams.get('controller-session'),
        sequence: 0,
        readSequence: -1,
        scope: 'paused',
        focusedId: '',
        focusedLabel: '',
        assigned: false,
        message: 'Ready',
      },
    });
    elements.connect.emit('click', { detail: 0 });
    assert.equal(posts.at(-1).pad.connected, true);
    const originalSrc = elements['game-frame'].src;
    elements['control-concepts-open'].click();
    assert.equal(doc.getElementById('control-lab').open, true);
    assert.equal(posts.at(-1).pad.connected, false);
    assert.ok(posts.at(-1).pad.axes.every((value) => value === 0));
    assert.ok(posts.at(-1).pad.buttons.every((value) => value === false));
    const pitch = doc.getElementById('control-lab-pitch');
    pitch.value = '0.5';
    pitch.emit('input');
    doc.getElementById('control-lab-close').click();
    assert.equal(elements['game-frame'].src, originalSrc);
    assert.equal(
      posts.at(-1).pad.connected,
      false,
      'Closing diagrams never reconnects arcade input',
    );
    assert.deepEqual(writes, []);
  } finally {
    host.emit('pagehide');
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});

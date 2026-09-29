import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { couchPage } from './helpers/couch-host.mjs';
import { page as teamPage } from './helpers/coop-host.mjs';
import { PNGImage } from './helpers/png-image.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

test('Solo starts reception on actual Start and freezes it through pause without rearming', async (t) => {
  const page = await soloPage(t);
  page.frame(0);
  assert.equal(page.rendered.signalReception, 'ready');
  assert.equal(page.rendered.signalEffectsRunning, false);
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.frame(0);
  assert.equal(page.rendered.signalReception, 'playing');
  assert.equal(page.rendered.signalEffectsRunning, true);
  page.$('pause-button').click();
  const run = page.rendered.run,
    before = authoritativeCheckpoint(run);
  page.frame(100);
  assert.equal(page.rendered.signalReception, 'playing');
  assert.equal(page.rendered.signalEffectsRunning, false);
  assert.deepEqual(authoritativeCheckpoint(run), before);
  page.$('start-button').click();
  page.frame(0);
  assert.equal(page.rendered.signalReception, 'playing');
  assert.equal(page.rendered.signalEffectsRunning, true);
  page.doc.hidden = true;
  page.win.emit('blur');
  page.frame(100);
  assert.equal(page.rendered.signalEffectsRunning, false);
});

test('Versus keeps both receivers ready through the start cue and freezes paused boards', async (t) => {
  const page = await couchPage(t);
  assert.ok(page.drawOptions.every((options) => options.signalReception === 'ready'));
  assert.ok(page.drawOptions.every((options) => !options.signalEffectsRunning));
  page.$('race-start').click();
  page.frame(0, { preserveStartCue: true });
  assert.ok(page.drawOptions.every((options) => options.signalReception === 'ready'));
  assert.ok(page.drawOptions.every((options) => !options.signalEffectsRunning));
  page.frame();
  assert.ok(page.drawOptions.every((options) => options.signalReception === 'playing'));
  assert.ok(page.drawOptions.every((options) => options.signalEffectsRunning));
  page.$('race-pause').click();
  const before = page.checkpoint();
  page.frames(4);
  assert.ok(page.drawOptions.every((options) => options.signalReception === 'playing'));
  assert.ok(page.drawOptions.every((options) => !options.signalEffectsRunning));
  assert.deepEqual(page.checkpoint(), before);
});

test(
  'the ordinary Journey title starts reception only when its current mission enters play',
  { timeout: 120000 },
  async (t) => {
    const memory = managedIndexedDB();
    const page = await soloPage(t, {
      search: '',
      titleScreen: true,
      journeyIndexedDB: memory.indexedDB,
      pictures: { Image: PNGImage },
      fetchResponse: async (path) => {
        if (String(path).includes('/content-design/assets/'))
          return new Response(await readFile(path));
      },
    });
    page.frame(0);
    assert.equal(page.rendered.signalReception, 'ready');
    assert.equal(page.rendered.signalEffectsRunning, false);
    const primary = page.$('shell-continue').hidden
      ? page.$('shell-featured')
      : page.$('shell-continue');
    assert.equal(primary.hidden, false);
    const handler = primary.onclick;
    let preparation;
    primary.onclick = (...args) => (preparation = handler.apply(primary, args));
    try {
      primary.focus();
      primary.click();
    } finally {
      primary.onclick = handler;
    }
    // Real current-catalogue preparation validates the released original bytes;
    // join the actual DOM transaction rather than asserting a cold-load budget.
    assert.ok(preparation instanceof Promise);
    await preparation;
    assert.equal(page.doc.body.dataset.flightState, 'running');
    page.frame(0);
    assert.equal(page.rendered.run.levelId, 'first-return');
    assert.equal(page.rendered.signalReception, 'playing');
    assert.equal(page.rendered.signalEffectsRunning, true);
    page.$('pause-button').click();
    const before = authoritativeCheckpoint(page.rendered.run);
    page.frame(100);
    assert.equal(page.rendered.signalReception, 'playing');
    assert.equal(page.rendered.signalEffectsRunning, false);
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), before);
    assert.deepEqual(page.errors, []);
  },
);

test('actual Team receiver advances only with visible play, finishes once, and releases its texture on navigation', async (t) => {
  const surfaces = [];
  const page = await teamPage(t, {
    beforeImport({ doc }) {
      const board = doc.getElementById('coop-canvas');
      board.getContext('2d').canvas = board;
      const create = doc.createElement.bind(doc);
      doc.createElement = (tag) => {
        const element = create(tag);
        if (tag === 'canvas') {
          let writes = 0;
          const context = element.getContext('2d');
          context.createImageData = (width, height) => ({
            data: new Uint8ClampedArray(width * height * 4),
          });
          context.getImageData = (_x, _y, width, height) => ({
            data: new Uint8ClampedArray(width * height * 4),
          });
          context.fillRect = () => {};
          context.drawImage = (source) => {
            assert.equal(source, board, 'Reception copies only the completed permitted board.');
          };
          context.putImageData = () => {
            writes++;
          };
          element.getContext = () => context;
          surfaces.push({
            element,
            get writes() {
              return writes;
            },
          });
        }
        return element;
      };
    },
  });
  assert.equal(surfaces.filter((surface) => surface.writes).length, 0);
  page.$('coop-start').click();
  page.tick(3);
  const noise = surfaces.find((surface) => surface.writes);
  assert.ok(noise, 'Actual Start allocates the bounded presentation texture.');
  assert.ok(page.drawImages.includes(noise.element));
  page.tick(15);
  assert.ok(noise.writes > 1);
  page.$('coop-pause').click();
  const writes = noise.writes,
    clock = page.$('coop-clock').textContent;
  page.tick(30);
  assert.equal(noise.writes, writes);
  assert.equal(page.$('coop-clock').textContent, clock);
  page.$('coop-resume').click();
  page.tick(5);
  assert.ok(
    noise.writes > writes,
    'Resume continues the same acquisition instead of cancelling it.',
  );
  page.tick(85);
  const completedWrites = noise.writes;
  page.tick(30);
  assert.equal(noise.writes, completedWrites, 'Settled acquisition does not restart during play.');
  assert.equal(surfaces.filter((surface) => surface.writes).length, 1);
  page.win.emit('pagehide', { persisted: true });
  assert.ok(noise.element.width > 0, 'BFCache suspends the owned texture.');
  page.win.emit('pagehide', { persisted: false });
  assert.equal(noise.element.width, 0);
  assert.equal(noise.element.height, 0);
});

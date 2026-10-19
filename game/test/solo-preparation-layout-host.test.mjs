import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage } from './helpers/solo-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { PNGImage } from './helpers/png-image.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

const microtasks = () => new Promise((resolve) => setImmediate(resolve));
async function fixture(t, { manual = false } = {}) {
  let scene;
  const prepares = [],
    observers = [];
  const geometry = { width: 320, height: 240 };
  const original = BoardPainter.prototype.prepare;
  BoardPainter.prototype.prepare = async function (...args) {
    prepares.push({
      flightState: globalThis.document.body.dataset.flightState,
      layout: globalThis.document.body.dataset.flightLayout,
      width: args[2].displayCSSWidth,
      screenControls: globalThis.document.body.dataset.screenControls,
      run: args[1],
    });
    return original.apply(this, args);
  };
  t.after(() => {
    BoardPainter.prototype.prepare = original;
  });
  const page = await soloPage(t, {
    pictures: { Image: PNGImage },
    fetchResponse: async (path) =>
      String(path).includes('/content-design/assets/')
        ? new Response(await readFile(path))
        : undefined,
    search: '?journey=opening&performance=1',
    journeyIndexedDB: managedIndexedDB().indexedDB,
    automaticPreparationFrames: !manual,
    browserSetup({ document: doc, globals }) {
      globals.innerWidth = 400;
      globals.innerHeight = 800;
      const create = doc.createElement.bind(doc);
      doc.createElement = (tag, ...args) => {
        const element = create(tag, ...args);
        if (String(tag).toLowerCase() === 'canvas') {
          // A declared CSS/RO delivery model, not a native layout engine. Actual
          // application owners, public input and Phaser submission are exercised.
          const flightLayout = () =>
            doc.body.dataset.flightState === 'running' ||
            doc.body.dataset.flightLayout === 'preparing';
          Object.defineProperties(element, {
            clientWidth: {
              configurable: true,
              get: () =>
                flightLayout()
                  ? geometry.width - (doc.body.dataset.screenControls === 'shown' ? 20 : 0)
                  : 360,
            },
            clientHeight: {
              configurable: true,
              get: () => (flightLayout() ? geometry.height : 270),
            },
          });
        }
        return element;
      };
      globals.ResizeObserver = class {
        constructor(callback) {
          this.callback = callback;
          observers.push(this);
        }
        observe(target) {
          this.target = target;
        }
        disconnect() {
          this.disposed = true;
        }
      };
      const Scene = globals.Phaser.Scene;
      globals.Phaser.Scene = class extends Scene {
        constructor(...args) {
          super(...args);
          scene = this;
        }
      };
    },
  });
  const run = page.rendered.run,
    before = authoritativeCheckpoint(run);
  const observer = observers.find((entry) => entry.target === scene.game.canvas);
  assert(observer, 'The actual scene observes its displayed canvas.');
  return {
    page,
    scene,
    prepares,
    geometry,
    run,
    before,
    initialPosition: { x: run.player.x, y: run.player.y },
    resize() {
      observer.callback([{ target: scene.game.canvas }]);
    },
    async waitSubmission(count = 1) {
      await waitFor(
        () => {
          page.frame(0, { dispatchRender: false });
          return prepares.length >= count && !!scene.preparedFrame;
        },
        { timeoutMs: 20000 },
      );
      assert.notEqual(page.doc.body.dataset.flightState, 'running');
      assert.deepEqual(authoritativeCheckpoint(run), before);
    },
    async finish(action) {
      let completed = false;
      const observed = Promise.resolve(action).finally(() => {
        completed = true;
      });
      await waitFor(
        () => {
          page.frame(scene.cadence.waiting ? 1000 / 60 : 0);
          return completed;
        },
        { timeoutMs: 20000 },
      );
      await observed;
    },
  };
}

test('Start and Resume prepare the final CSS geometry before granting the clock', async (t) => {
  const h = await fixture(t),
    { page, scene, run, before } = h;
  for (const boundary of ['Start', 'Resume']) {
    const count = h.prepares.length;
    await page.$('start-button').onclick();
    assert.equal(page.doc.body.dataset.flightState, 'running', boundary);
    assert.equal(page.doc.body.dataset.flightLayout, undefined);
    assert(scene.prepared());
    assert.equal(scene.displayCSSWidth, scene.game.canvas.clientWidth);
    assert.equal(scene.displayCSSHeight, scene.game.canvas.clientHeight);
    assert.equal(scene.displayCSSWidth, 320);
    assert(h.prepares.length > count);
    assert(
      h.prepares
        .slice(count)
        .every(
          (row) => row.layout === 'preparing' && row.flightState !== 'running' && row.width === 320,
        ),
    );
    const revision = scene.revision;
    // A real observer can report the already-reconciled size after the grant.
    h.resize();
    assert.equal(scene.revision, revision);
    assert(scene.prepared());
    page.frame(0);
    assert.deepEqual(authoritativeCheckpoint(run), before);
    page.$('pause-button').click();
    page.frame(0);
    assert.equal(page.doc.body.dataset.flightState, 'paused');
    h.resize();
    assert.equal(scene.displayCSSWidth, 360);
  }
  assert.deepEqual(page.errors, []);
});

test('a changed submitted geometry is re-prepared while paused before cadence and Start', async (t) => {
  const h = await fixture(t, { manual: true }),
    { page, scene } = h;
  const starting = page.$('start-button').onclick();
  await h.waitSubmission();
  h.geometry.width = 300;
  h.geometry.height = 225;
  // Deliberately withhold RO: the actual post-submission boundary must detect it.
  page.submitRender();
  await h.waitSubmission(2);
  assert.equal(h.prepares.at(-1).width, 300);
  h.geometry.height = 220;
  page.submitRender();
  await h.waitSubmission(3);
  assert.equal(scene.displayCSSHeight, 220, 'Height-only changes also need a fresh submission.');
  assert.equal(scene.cadence.ready, false);
  assert.equal(page.doc.body.dataset.flightLayout, 'preparing');
  await h.finish(starting);
  assert.equal(page.doc.body.dataset.flightState, 'running');
  assert.equal(page.doc.body.dataset.flightLayout, undefined);
  assert(scene.prepared());
  const revision = scene.revision;
  h.resize();
  assert.equal(scene.revision, revision);
  assert.deepEqual(authoritativeCheckpoint(h.run), h.before);
  assert.deepEqual(page.errors, []);
});

test('cancelled, blurred and hidden attempts release only their owned preparation layout', async (t) => {
  const h = await fixture(t, { manual: true }),
    { page } = h;
  for (const boundary of ['cancel', 'blur', 'hidden', 'renderer']) {
    const count = h.prepares.length;
    const starting = page.$('start-button').onclick();
    await h.waitSubmission(count + 1);
    assert.equal(page.doc.body.dataset.flightLayout, 'preparing');
    if (boundary === 'cancel') page.$('flight-preparation-cancel').click();
    if (boundary === 'blur') {
      page.doc.focused = false;
      page.win.emit('blur');
    }
    if (boundary === 'hidden') {
      page.doc.hidden = true;
      page.doc.emit('visibilitychange');
    }
    if (boundary === 'renderer') h.scene.game.canvas.emit('contextlost');
    assert.equal(page.doc.body.dataset.flightLayout, undefined);
    assert.equal(h.scene.displayCSSWidth, 360);
    h.resize();
    assert.equal(h.scene.displayCSSWidth, 360);
    assert.equal(h.scene.prepared(), false);
    await h.finish(starting);
    if (boundary === 'blur') {
      page.doc.focused = true;
      page.win.emit('focus');
    }
    if (boundary === 'hidden') {
      page.doc.hidden = false;
      page.doc.emit('visibilitychange');
    }
    if (boundary === 'renderer') h.scene.game.canvas.emit('contextrestored');
    page.frame(0);
    assert.notEqual(page.doc.body.dataset.flightState, 'running');
    assert.deepEqual(authoritativeCheckpoint(h.run), h.before);
  }
  const count = h.prepares.length;
  const stale = page.$('start-button').onclick();
  await h.waitSubmission(count + 1);
  page.$('flight-preparation-cancel').click();
  const fresh = page.$('start-button').onclick();
  await stale;
  await microtasks();
  assert.equal(
    page.doc.body.dataset.flightLayout,
    'preparing',
    'Old finally must not retire a new lease.',
  );
  await h.finish(fresh);
  assert.equal(page.doc.body.dataset.flightState, 'running');
  assert.equal(page.doc.body.dataset.flightLayout, undefined);
  assert.deepEqual(authoritativeCheckpoint(h.run), h.before);
  assert.deepEqual(page.errors, []);
});

test('permanent page retirement removes a held preparation layout without a late grant', async (t) => {
  const h = await fixture(t, { manual: true }),
    { page } = h;
  const starting = page.$('start-button').onclick();
  await h.waitSubmission();
  page.win.emit('pagehide', { persisted: false });
  await starting;
  assert.equal(page.doc.body.dataset.flightLayout, undefined);
  assert.notEqual(page.doc.body.dataset.flightState, 'running');
  assert.deepEqual(authoritativeCheckpoint(h.run), h.before);
});

test('preparation reserves eventual touch controls without granting their input scope', async (t) => {
  const h = await fixture(t, { manual: true }),
    { page, scene } = h;
  page.$('screen-controls').value = 'always';
  page.$('screen-controls').onchange();
  assert.equal(page.doc.body.dataset.screenControls, 'hidden');
  for (const cancel of [true, false]) {
    const count = h.prepares.length;
    const starting = page.$('start-button').onclick();
    await h.waitSubmission(count + 1);
    assert.equal(page.doc.body.dataset.screenControls, 'shown');
    assert.equal(h.prepares.at(-1).screenControls, 'shown');
    assert.equal(scene.displayCSSWidth, 300);
    page.key('ArrowDown');
    page.key('ArrowDown', false);
    assert.deepEqual(authoritativeCheckpoint(h.run), h.before);
    if (cancel) {
      page.$('flight-preparation-cancel').click();
      await h.finish(starting);
      assert.equal(page.doc.body.dataset.screenControls, 'hidden');
      assert.equal(page.doc.body.dataset.flightLayout, undefined);
      h.resize();
      assert.equal(scene.displayCSSWidth, 360);
    } else {
      await h.finish(starting);
      assert.equal(page.doc.body.dataset.flightState, 'running');
      assert.equal(page.doc.body.dataset.screenControls, 'shown');
      assert.equal(scene.displayCSSWidth, scene.game.canvas.clientWidth);
      assert(scene.prepared());
      page.frame(1000 / 60);
      page.frame(1000 / 60);
      assert.equal(h.run.player.x, h.initialPosition.x);
      assert.equal(h.run.player.y, h.initialPosition.y);
    }
  }
  assert.deepEqual(page.errors, []);
});

test('ordinary flight geometry selectors include the owned layout, retaining inactive control presentation', async () => {
  const alias =
    /:is\(\s*\[data-flight-state='running'\],\s*\[data-flight-layout='preparing'\]\s*\)/g;
  for (const name of [
    'handheld-play',
    'device-controls',
    'field-kit-compiled',
    'hunt-feedback',
    'pixel-theme',
    'journey',
  ]) {
    const css = await readFile(new URL(`../ui/${name}.css`, import.meta.url), 'utf8');
    assert(css.match(alias)?.length, `${name} includes the preparation geometry owner`);
    assert(
      !css.replace(alias, '').includes("[data-flight-state='running']"),
      `${name} has no late running-only geometry rule`,
    );
  }
  const controls = await readFile(new URL('../ui/device-controls.css', import.meta.url), 'utf8');
  assert.match(
    controls,
    /\.game-shell\[data-flight-layout='preparing'\] \.play-controls\s*\{\s*visibility: hidden;/,
  );
  assert.match(
    controls,
    /\.game-shell\[data-screen-controls='shown'\] \.play-controls\s*\{[^}]*position: fixed;/,
  );
  assert.match(
    controls,
    /\[data-flight-state='paused'\]:not\(\[data-flight-layout='preparing'\]\)/,
  );
  const pixel = await readFile(new URL('../ui/pixel-theme.css', import.meta.url), 'utf8');
  assert.match(pixel, /\[data-flight-state='paused'\] \.play-controls\s*\{\s*display: none;/);
});

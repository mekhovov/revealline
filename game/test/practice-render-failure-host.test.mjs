import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { Events } from './helpers/couch-dom.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { attachEnemyWorkshopReturnHost } from '../ui/enemy-workshop-return.mjs';
import { prepareScenario } from '../imports.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

const source = JSON.parse(
  await readFile(new URL('../content/scenarios/line-impact-demo.json', import.meta.url)),
);

// Execute real BoardPainter code; only Canvas2D/Phaser are modeled. This is
// exception ownership and gameplay-isolation evidence, not raster approval.
function rendering(onDraw) {
  const contexts = new WeakMap();
  return {
    onDraw,
    contextFor(canvas) {
      if (!contexts.has(canvas)) {
        const values = {},
          stack = [];
        contexts.set(
          canvas,
          new Proxy(
            { canvas },
            {
              get(target, key) {
                if (key in target) return target[key];
                if (key in values) return values[key];
                return () => {
                  if (key === 'save') stack.push({ ...values });
                  if (key === 'restore') Object.assign(values, stack.pop());
                  if (key === 'measureText') return { width: 0 };
                };
              },
              set(_target, key, value) {
                values[key] = value;
                return true;
              },
            },
          ),
        );
      }
      return contexts.get(canvas);
    },
  };
}

test('post-ready practice render failure latches, preserves native Return and allows a clean parent relaunch', async (t) => {
  const scenario = (await prepareScenario(source)).scenario;
  const storage = memoryStorage({ untouched: 'profile' });
  const previewStorage = memoryStorage({
    'revealline.playground.current': JSON.stringify(scenario),
  });
  const originalPreview = previewStorage.getItem('revealline.playground.current');
  const parent = new Events();
  parent.location = { href: 'http://localhost/game/' };
  parent.crypto = globalThis.crypto;
  const frame = { contentWindow: null, hidden: false, src: '' };
  let returned = 0;
  const owner = attachEnemyWorkshopReturnHost({
    window: parent,
    frame,
    returnTo: 'workshop',
    gameURL: 'http://localhost/game/',
    onReturn: () => returned++,
  });
  t.after(() => owner.dispose());
  await t.test(
    'failed child stops simulation, paint and flight input without calling the retired boot failure path',
    async (t) => {
      let armed = false,
        paintCalls = 0,
        bootFailures = 0;
      const pad = {
        index: 0,
        id: 'Practice failure controls',
        mapping: 'standard',
        connected: true,
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
      };
      const fault = new Error('Injected practice painter failure');
      const page = await soloPage(t, {
        storage,
        previewStorage,
        parentWindow: parent,
        readPads: () => [pad],
        search: new URL(owner.launchURL()).search,
        rendering: rendering(() => {
          paintCalls++;
          if (armed) throw fault;
        }),
        browserSetup({ document, globals }) {
          globals.RevealLineBoot = {
            ready() {
              document.documentElement.dataset.bootState = 'ready';
              for (const node of document.querySelectorAll('[data-boot-inert]')) node.inert = false;
              document.getElementById('boot-status').hidden = true;
            },
            fail() {
              bootFailures++;
              return false;
            },
          };
        },
      });
      frame.contentWindow = page.win;
      parent.postMessage = (data, origin) =>
        queueMicrotask(() => parent.emit('message', { data, origin, source: page.win }));
      page.$('start-button').click();
      await settle(() => page.doc.body.dataset.flightState === 'running');
      page.key('ArrowDown');
      for (let n = 0; n < 8; n++) page.frame(16);
      assert.ok(page.rendered.run.tick > 0);
      assert.equal(page.doc.documentElement.dataset.bootState, 'ready');
      const run = page.rendered.run;
      page.$('pause-button').click();
      page.frame(16); // Observe neutral input in the menu before a real Confirm press.
      assert.equal(page.doc.body.dataset.flightState, 'paused');
      pad.buttons[0] = { pressed: true, value: 1 };
      armed = true;
      assert.doesNotThrow(() => page.frame(16));
      pad.buttons[0] = { pressed: false, value: 0 };
      const checkpoint = authoritativeCheckpoint(run),
        failedPaints = paintCalls,
        failedPadReads = page.padReads;
      assert.equal(page.doc.documentElement.dataset.practiceRenderState, 'failed');
      assert.equal(page.doc.documentElement.dataset.bootState, 'ready');
      assert.equal(page.doc.body.dataset.flightState, 'paused');
      const alert = page.$('practice-render-failure');
      assert.equal(alert.getAttribute('role'), 'alert');
      assert.equal(
        alert.classList.contains('run-message'),
        false,
        'recovery copy must not use the two-line telemetry crop',
      );
      assert.match(alert.textContent, /Injected practice painter failure/);
      assert.match(alert.textContent, /Close preview and retry/);
      assert.equal(page.$('game-overlay').hidden, false);
      assert.equal(alert.parentNode, page.$('overlay-reading'));
      assert.equal(page.$('overlay-reading').hidden, false);
      assert.equal(page.$('overlay-reading').scrollTop, 0);
      assert.equal(page.$('start-button').disabled, true);
      assert.equal(page.$('retry-button').disabled, true);
      assert.equal(page.$('enemy-workshop-return').disabled, false);
      assert.equal(page.$('shell-menu').inert, false);
      assert.equal(bootFailures, 0);
      assert.deepEqual(page.errors, [fault]);
      page.key('ArrowRight');
      page.$('action-button').click();
      page.$('pickup-button').click();
      page.$('start-button').onclick(); // Even a previously queued activation cannot resume.
      const originalLocale = getLocale();
      setLocale('uk', { persist: false });
      assert.equal(page.$('start-button').disabled, true);
      assert.match(alert.textContent, /Закрийте|Закрий|закрий/i);
      setLocale(originalLocale, { persist: false });
      for (let n = 0; n < 8; n++) page.frame(16);
      assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
      assert.equal(paintCalls, failedPaints);
      assert.equal(page.padReads, failedPadReads);
      assert.equal(page.doc.querySelectorAll('#practice-render-failure').length, 1);
      assert.deepEqual(page.errors, [fault]);
      assert.equal(storage.writes.length, 0);
      assert.equal(previewStorage.getItem('revealline.playground.current'), originalPreview);
      // Confirm was held at failure. No blur or visibility reset may be needed
      // to release its native echo guard after controller polling has stopped.
      const returnButton = page.$('enemy-workshop-return');
      returnButton.focus();
      const enter = returnButton.emit('keydown', {
        key: 'Enter',
        code: 'Enter',
        repeat: false,
      });
      assert.equal(
        enter.defaultPrevented,
        false,
        'released Confirm must not swallow native Return',
      );
      returnButton.click(); // Model the native button activation after unconsumed Enter.
      returnButton.emit('keyup', { key: 'Enter', code: 'Enter' });
      await Promise.resolve();
      assert.equal(returned, 1);
      assert.equal(frame.src, 'about:blank');
      assert.equal(frame.hidden, true);
      page.win.emit('blur', { bubbles: false });
      page.win.emit('pagehide', { persisted: true });
      page.win.emit('pageshow', { persisted: true });
      for (let n = 0; n < 8; n++) page.frame(16);
      assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
      assert.equal(paintCalls, failedPaints);
      assert.equal(page.padReads, failedPadReads);
    },
  );
  await t.test(
    'a deliberately fresh practice child is not poisoned by the previous latch',
    async (t) => {
      const page = await soloPage(t, {
        storage,
        previewStorage,
        parentWindow: parent,
        search: new URL(owner.launchURL()).search,
      });
      assert.equal(page.$('practice-render-failure'), null);
      assert.notEqual(page.doc.documentElement.dataset.practiceRenderState, 'failed');
      assert.equal(page.rendered.run.tick, 0);
      page.$('start-button').click();
      await settle(() => page.doc.body.dataset.flightState === 'running');
      page.key('ArrowDown');
      for (let n = 0; n < 8; n++) page.frame(16);
      assert.ok(page.rendered.run.tick > 0);
      assert.deepEqual(page.errors, []);
      assert.equal(storage.writes.length, 0);
      assert.equal(previewStorage.getItem('revealline.playground.current'), originalPreview);
    },
  );
});

test('ordinary Solo render exceptions retain the existing propagation path', async (t) => {
  let armed = false;
  const fault = new Error('Injected ordinary Solo renderer failure');
  const page = await soloPage(t, {
    rendering: rendering(() => {
      if (armed) throw fault;
    }),
  });
  armed = true;
  assert.throws(
    () => page.frame(16),
    (error) => error === fault,
  );
  assert.equal(page.$('practice-render-failure'), null);
  assert.notEqual(page.doc.documentElement.dataset.practiceRenderState, 'failed');
});

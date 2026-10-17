// Actual public owners in a modeled DOM/audio boundary; no native actionability or audibility claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage } from './helpers/solo-dom.mjs';
import { PNGImage } from './helpers/png-image.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { audioHarness } from './helpers/soundtrack-audio.mjs';
import { verifyReplay, authoritativeCheckpoint } from '../replay.mjs';
import { observeOptionalAudioSettlement } from '../../scripts/solo-qualification-readiness.mjs';
const flush = () => new Promise((r) => setImmediate(r));
for (const width of [400, 1024])
  test(
    `${width}: public unmute and Featured Start observe missing exact optional sample and retain gameplay/replay`,
    { timeout: 60000 },
    async (t) => {
      const audio = audioHarness();
      t.after(() => audio.soundscape.dispose());
      const requests = [];
      let modeledStarts = 0,
        modeledMediaPlayResolved = 0,
        modeledMediaPlayRejected = 0;
      const createSource = audio.context.createOscillator.bind(audio.context);
      audio.context.createOscillator = () => {
        const node = createSource(),
          start = node.start;
        node.start = function (...args) {
          modeledStarts++;
          return start.apply(this, args);
        };
        return node;
      };
      audio.context.decodeAudioData = async () => {
        return {
          duration: 0.1,
          length: 800,
          numberOfChannels: 1,
          getChannelData: () => new Float32Array(800),
        };
      };
      const page = await soloPage(t, {
        search: '?journey=opening&performance=1',
        titleScreen: true,
        pictures: { Image: PNGImage },
        journeyIndexedDB: managedIndexedDB().indexedDB,
        audio,
        browserSetup({ globals, window, document }) {
          const createElement = document.createElement.bind(document);
          document.createElement = (tag) => {
            const element = createElement(tag);
            if (tag.toLowerCase() === 'audio') {
              const play = element.play;
              element.play = async function (...args) {
                try {
                  const result = await play.apply(this, args);
                  modeledMediaPlayResolved++;
                  return result;
                } catch (error) {
                  modeledMediaPlayRejected++;
                  throw error;
                }
              };
            }
            return element;
          };
          globals.innerWidth = window.innerWidth = width;
          globals.innerHeight = window.innerHeight = 850;
        },
        fetchResponse: async (path, options) => {
          if (String(path).endsWith('/audio/effects/start.wav')) {
            requests.push({ path: String(path), signal: !!options.signal });
            return new Response(new Uint8Array(), { status: 404 });
          }
          if (String(path).includes('/audio/effects/'))
            return new Response(
              await readFile(String(path).startsWith('file:') ? new URL(String(path)) : path),
            );
          if (String(path).includes('/content-design/assets/'))
            return new Response(await readFile(path));
        },
      });
      const visible = (node) => {
        assert(node?.isConnected, 'connected public control');
        for (let ancestor = node; ancestor?.tagName; ancestor = ancestor.parentNode) {
          assert(!ancestor.hidden, `hidden ancestor ${ancestor.id}`);
          if (ancestor.tagName === 'DIALOG') assert(ancestor.open, `closed dialog ${ancestor.id}`);
        }
        // The actual Settings owner opens above Home; DOM order is not top-layer order.
        const current = page.$('settings-dialog').open
          ? page.$('settings-dialog')
          : page.$('shell-home').open
            ? page.$('shell-home')
            : null;
        if (current) assert(current.contains(node), `current ${current.id} owns ${node.id}`);
        assert(!node.disabled, 'enabled public control');
        return node;
      };
      // The lightweight selector model does not parse #id[attribute]. Model only
      // this exact existing optional selector through its explicit open property.
      const locate = (selector) =>
        selector === '#settings-dialog[open] .dialog-close'
          ? page.$('settings-dialog').open
            ? page.$('settings-dialog').querySelector('.dialog-close')
            : null
          : page.doc.querySelector(selector);
      const click = (selector) => visible(locate(selector)).click();
      assert.equal(requests.length, 0);
      assert.throws(
        () => visible(page.$('shell-play-options').querySelector('summary')),
        /hidden ancestor|closed dialog/,
      );
      const fixture = JSON.parse(
        await readFile(
          new URL(
            '../../docs/performance/fixtures/solo-readiness-media/optional-audio-start-missing-settings-v2.qualification.fixture',
            import.meta.url,
          ),
        ),
      );
      for (const action of fixture.actions.slice(0, 6)) {
        if (action.type === 'click') {
          if (action.optional && !page.$('settings-dialog').open) continue;
          click(action.selector);
          if (action.selector === '#settings-dialog .dialog-close') {
            assert.equal(page.$('settings-dialog').open, width === 400);
            if (width === 400)
              assert.equal(page.$('settings-dialog').dataset.settingsView, 'categories');
          }
        } else if (action.type === 'select') {
          visible(page.doc.querySelector(action.selector));
          await page.change('menu-actor-style', action.value);
          assert.equal(page.$('menu-actor-style').value, 'campaign');
        } else {
          assert.equal(action.type, 'expect');
          assert.equal(page.$('settings-dialog').open, false);
        }
      }
      assert.equal(page.$('shell-home').open, true);
      visible(page.$('shell-sound'));
      assert.equal(page.$('shell-sound').getAttribute('aria-pressed'), 'false');
      click('#shell-sound');
      assert.equal(page.$('shell-sound').getAttribute('aria-pressed'), 'true');
      const before = page.win.RevealLineSoloPerformance.export();
      assert.equal(before.audio.muted, false);
      click('#shell-featured');
      await waitFor(() => page.doc.body.dataset.flightState === 'running', { timeoutMs: 15000 });
      await waitFor(() => requests.length > 0, { timeoutMs: 5000 });
      page.frame(0);
      assert.equal(page.rendered.actorAppearance.style, 'campaign');
      const initialPlayer = { x: page.rendered.run.player.x, y: page.rendered.run.player.y };
      page.key('ArrowLeft');
      for (let i = 0; i < 75; i++) {
        page.frame(16);
        await flush();
      }
      page.key('ArrowLeft', false);
      click('#pause-button');
      page.frame(0);
      await flush();
      const settle = new Function(
        'globalThis',
        `return (${observeOptionalAudioSettlement.toString()});`,
      )({ document: page.doc, RevealLineSoloPerformance: page.win.RevealLineSoloPerformance });
      const unsettled = settle(true);
      assert.equal(unsettled.phase, 'paused');
      await waitFor(() => settle(false), { timeoutMs: 10000 });
      const final = page.win.RevealLineSoloPerformance.export();
      assert.equal(page.doc.body.dataset.flightState, 'paused');
      assert.equal(final.audio.muted, false);
      t.diagnostic(
        JSON.stringify({
          modeledStarts,
          modeledMediaPlayResolved,
          modeledMediaPlayRejected,
          state: audio.context.state,
          sources: audio.sources.length,
          elements: page.audioElements.map((e) => ({ plays: e.plays, src: e.src })),
          audio: final.audio,
          effects: final.resources.pcm.effects,
        }),
      );
      assert(
        modeledStarts + modeledMediaPlayResolved >= fixture.expectAudio.nativeStartsAtLeast,
        'same node-start plus fulfilled media-play categories as the native gate; no audibility claim',
      );
      assert.equal(modeledMediaPlayRejected, 0);
      t.diagnostic(
        JSON.stringify({ modeledStarts, modeledMediaPlayResolved, modeledMediaPlayRejected }),
      );
      assert.equal(requests.length, 1);
      assert(requests[0].signal);
      assert.equal(final.resources.pcm.effects.loading, 0);
      assert.equal(final.resources.media.queued, 0);
      assert(Object.values(final.resources.media.active).every((v) => v === 0));
      assert.equal(final.resources.media.reservedDecodeBytes, 0);
      assert(page.rendered.run.tick >= 120);
      assert.notDeepEqual(
        { x: page.rendered.run.player.x, y: page.rendered.run.player.y },
        initialPlayer,
      );
      assert.deepEqual(page.errors, []);
      const timers = [],
        set = globalThis.setTimeout;
      t.mock.method(globalThis, 'setTimeout', (cb, ms, ...args) => {
        const id = set(cb, ms, ...args);
        if (ms === 60000) {
          id.unref();
          timers.push(id);
        }
        return id;
      });
      t.after(() => timers.forEach(clearTimeout));
      await page.$('export-replay').onclick();
      const out = JSON.parse(page.$('replay-json').value),
        replay = out.replay ?? out;
      assert.equal(verifyReplay(replay).match, true);
      assert.deepEqual(replay.checkpoint, authoritativeCheckpoint(page.rendered.run));
    },
  );

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage } from './helpers/solo-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { PNGImage } from './helpers/png-image.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { installThemeHost } from '../presentation/theme-host.mjs';
import { canvasPresentation } from '../presentation/runtime.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

const microtasks = () => new Promise((resolve) => setImmediate(resolve));

async function fixture(t) {
  const prepares = [];
  let painter, scene;
  const original = BoardPainter.prototype.prepare;
  BoardPainter.prototype.prepare = async function (...args) {
    painter = this;
    const result = await original.apply(this, args);
    prepares.push({
      run: args[1],
      appearance: this.acceptedAttemptAppearance,
      generation: this.preparationGeneration,
      paintRevision: this.paintRevision,
    });
    return result;
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
    automaticPreparationFrames: false,
    browserSetup({ globals, document }) {
      globals.innerWidth = 1280;
      globals.innerHeight = 720;
      // The minimal host has no CSS loader. Complete only that native boundary
      // so the real theme host accepts its presentation and notifies subscribers.
      const append = document.head.append.bind(document.head);
      document.head.append = (...nodes) => {
        append(...nodes);
        for (const node of nodes) {
          if (node.tagName === 'LINK' && node.rel === 'stylesheet')
            queueMicrotask(() => node.emit('load'));
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
  const theme = installThemeHost({ document: page.doc, window: page.win });
  t.after(() => theme.dispose());
  await theme.ready;
  const run = page.rendered.run;
  const checkpoint = authoritativeCheckpoint(run);
  async function prepared(count) {
    try {
      await waitFor(
        () => {
          page.frame(0, { dispatchRender: false });
          return (
            (prepares.length >= count && scene.preparedFrame) ||
            page.doc.body.dataset.flightState === 'running'
          );
        },
        { timeoutMs: 20000, message: `Preparation ${count} must finish before visible submission` },
      );
    } catch (error) {
      error.message += ` ${JSON.stringify({
        prepared: prepares.length,
        phase: page.doc.body.dataset.flightState,
        preparation: page.$('flight-preparation-status').textContent,
        paintRevision: painter?.paintRevision,
        generation: painter?.preparationGeneration,
        accepted: prepares.map(({ paintRevision, generation }) => ({ paintRevision, generation })),
        sceneRevision: scene.revision,
        waitingForSubmission: !!scene.preparedFrame,
      })}`;
      throw error;
    }
    await microtasks();
    page.frame(0, { dispatchRender: false });
    assert.notEqual(page.doc.body.dataset.flightState, 'running');
    assert.ok(prepares.length >= count);
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  }
  async function invalidatePreparedStart() {
    page.$('start-button').click();
    await prepared(1);
    const first = prepares[0];
    const revision = scene.revision;
    // Refresh the actual installed theme owner without changing the accepted
    // appearance, matching the native handoff's asynchronous accept boundary.
    await theme.refresh();
    assert.ok(scene.revision > revision, 'Theme acceptance must invalidate the active scene');
    page.frame(0, { dispatchRender: false });
    page.submitRender();
    await prepared(2);
    assert.equal(prepares[1].run, first.run);
    assert.equal(prepares[1].appearance, first.appearance);
    assert.equal(prepares[1].generation, first.generation);
    assert.equal(prepares[1].paintRevision, first.paintRevision);
  }
  async function running() {
    page.submitRender();
    await waitFor(() => page.doc.body.dataset.flightState === 'running', { timeoutMs: 20000 });
    assert.equal(page.rendered.run, run);
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  }
  async function invalidatePreparedPresentation() {
    page.$('start-button').click();
    await prepared(1);
    const first = prepares[0];
    const compiled = JSON.parse(
      await readFile(new URL('../presentation/compiled/runtime.json', import.meta.url)),
    );
    // Apply the production compiled canvas presentation at the controlled late
    // boundary. The inert host keeps image drawing at its established fallback.
    painter.setPresentation({ canvas: canvasPresentation(compiled.resolved), image: () => null });
    assert(painter.paintRevision > first.paintRevision);
    page.frame(0, { dispatchRender: false });
    page.submitRender();
    await prepared(2);
    assert.equal(prepares[1].run, first.run);
    assert.equal(prepares[1].appearance, first.appearance);
    assert.equal(prepares[1].generation, first.generation);
    assert(prepares[1].paintRevision > first.paintRevision);
  }
  return {
    page,
    run,
    checkpoint,
    prepares,
    prepared,
    invalidatePreparedStart,
    invalidatePreparedPresentation,
    running,
  };
}

test('a late presentation acceptance during Start is prepared again before fresh visible submission', async (t) => {
  const host = await fixture(t);
  await host.invalidatePreparedPresentation();
  await host.running();
  assert.deepEqual(host.page.errors, []);
});

test('blur during late-presentation preparation still requires explicit fresh Start', async (t) => {
  const host = await fixture(t);
  const { page, run, checkpoint } = host;
  await host.invalidatePreparedPresentation();
  page.doc.focused = false;
  page.win.emit('blur');
  await microtasks();
  page.submitRender();
  page.doc.focused = true;
  page.win.emit('focus');
  page.frame(1000);
  await microtasks();
  assert.notEqual(page.doc.body.dataset.flightState, 'running');
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  assert.equal(page.win.RevealLineSoloPerformance.export().failures.count, 0);
  const next = host.prepares.length + 1;
  page.$('start-button').click();
  await host.prepared(next);
  await host.running();
  assert.deepEqual(page.errors, []);
});

test('a theme refresh during Start is prepared again and needs a fresh visible submission', async (t) => {
  const host = await fixture(t);
  await host.invalidatePreparedStart();
  await host.running();
  assert.deepEqual(host.page.errors, []);
});

test('blur cancels the refreshed preparation without media failure or automatic Resume', async (t) => {
  const host = await fixture(t);
  const { page, run, checkpoint } = host;
  await host.invalidatePreparedStart();
  page.doc.focused = false;
  page.win.emit('blur');
  await microtasks();
  page.submitRender();
  page.doc.focused = true;
  page.win.emit('focus');
  page.frame(1000);
  await microtasks();
  assert.notEqual(page.doc.body.dataset.flightState, 'running');
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  assert.doesNotMatch(page.$('flight-preparation-status').textContent, /picture unavailable/i);
  assert.equal(page.win.RevealLineSoloPerformance.export().failures.count, 0);
  const next = host.prepares.length + 1;
  page.$('start-button').click();
  await host.prepared(next);
  await host.running();
  assert.deepEqual(page.errors, []);
});

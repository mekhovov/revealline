import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, memoryStorage, installSoloStylesheets } from './helpers/solo-dom.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { PNGImage } from './helpers/png-image.mjs';
import { audioHarness } from './helpers/soundtrack-audio.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { canvasPresentation } from '../presentation/runtime.mjs';
import { installThemeHost } from '../presentation/theme-host.mjs';
const microtasks = () => new Promise((resolve) => setImmediate(resolve));
async function fixture(t, options = {}) {
  let scene,
    work = 1000;
  const page = await soloPage(t, {
    pictures: { Image: PNGImage },
    fetchResponse: async (path) =>
      String(path).includes('/content-design/assets/')
        ? new Response(await readFile(path))
        : undefined,
    search: '?journey=opening&performance=1',
    journeyIndexedDB: managedIndexedDB().indexedDB,
    automaticPreparationFrames: false,
    ...options,
    browserSetup({ globals }) {
      globals.performance = { now: () => work };
      globals.innerWidth = 1280;
      globals.innerHeight = 720;
      const Scene = globals.Phaser.Scene;
      globals.Phaser.Scene = class extends Scene {
        constructor(...args) {
          super(...args);
          scene = this;
        }
      };
    },
  });
  async function waitCadence() {
    await waitFor(
      () => {
        page.frame(0);
        return scene.cadence.waiting;
      },
      { timeoutMs: 20000, message: 'Actual Start must reach its owned quiet readiness stage' },
    );
  }
  async function fill(hz = 90) {
    for (let i = 0; i < 30; i++) {
      page.frame(1000 / hz);
      await microtasks();
    }
  }
  return {
    page,
    get scene() {
      return scene;
    },
    waitCadence,
    fill,
    async finish(action) {
      let completed = false;
      const observed = Promise.resolve(action).finally(() => (completed = true));
      await waitFor(
        () => {
          page.frame(0);
          return completed;
        },
        {
          timeoutMs: 20000,
          message: 'Owned preparation action must settle without advancing play',
        },
      );
      await observed;
    },
    advanceWork(ms) {
      work += ms;
    },
  };
}
test('rapid public Start waits for its own quiet cadence and cached Resume reuses it without simulation debt', async (t) => {
  const audio = audioHarness();
  let gesture = false,
    gestureResumes = 0;
  const resume = audio.context.resume;
  audio.context.resume = function () {
    if (gesture) gestureResumes++;
    return resume.call(this);
  };
  const h = await fixture(t, {
      audio,
      storage: memoryStorage({
        'revealline.audio-master.v1': JSON.stringify({ muted: false, volume: 0.65 }),
      }),
    }),
    { page } = h,
    run = page.rendered.run,
    before = authoritativeCheckpoint(run);
  for (let i = 0; i < 9; i++) page.frame(1000 / 60);
  assert.equal(h.scene.cadence.samples, 9);
  assert.equal(
    h.scene.readyCount,
    9,
    'The existing native observer sample-count alias is retained.',
  );
  gesture = true;
  const starting = page.$('start-button').onclick();
  gesture = false;
  assert(gestureResumes > 0, 'Native context resume remains inside the original Start gesture.');
  await h.waitCadence();
  assert.equal(h.scene.cadence.samples, 0);
  assert.equal(h.scene.cadence.snapshot().restartedSamples, 9);
  assert.notEqual(page.doc.body.dataset.flightState, 'running');
  for (let i = 0; i < 29; i++) page.frame(1000 / 90);
  await microtasks();
  assert.equal(h.scene.cadence.ready, false);
  assert.deepEqual(authoritativeCheckpoint(run), before);
  page.key('ArrowDown');
  page.key('ArrowDown', false);
  page.frame(1000 / 90);
  await h.finish(starting);
  page.frame(0);
  assert.equal(page.doc.body.dataset.flightState, 'running');
  assert.deepEqual(authoritativeCheckpoint(run), before);
  page.$('pause-button').click();
  page.frame(0);
  const exported = page.win.RevealLineSoloPerformance.export();
  assert.equal(exported.secureContext, null);
  assert.equal(exported.protocol, 'http:');
  const calibrated = exported.cadenceCalibration;
  assert.equal(calibrated.status, 'measured-before-play');
  assert(Math.abs(calibrated.baselineMs - 1000 / 90) < 1e-8);
  page.frame(500);
  await page.$('start-button').onclick();
  page.frame(0);
  assert.equal(page.doc.body.dataset.flightState, 'running');
  assert.deepEqual(authoritativeCheckpoint(run), before);
  page.$('pause-button').click();
  page.frame(0);
  assert.deepEqual(page.win.RevealLineSoloPerformance.export().cadenceCalibration, calibrated);
  assert.deepEqual(page.errors, []);
});
test('blur, explicit cancellation and renderer loss cannot release a stale calibration owner', async (t) => {
  const h = await fixture(t),
    { page } = h,
    run = page.rendered.run,
    before = authoritativeCheckpoint(run);
  for (const boundary of ['blur', 'hidden', 'cancel', 'renderer']) {
    const starting = page.$('start-button').onclick();
    await h.waitCadence();
    for (let i = 0; i < 10; i++) page.frame(1000 / 120);
    if (boundary === 'blur') {
      page.doc.focused = false;
      page.win.emit('blur');
    } else if (boundary === 'hidden') {
      page.doc.hidden = true;
      page.doc.emit('visibilitychange');
    } else if (boundary === 'cancel') page.$('flight-preparation-cancel').click();
    else page.$('game-canvas').querySelector('canvas').emit('contextlost');
    await h.finish(starting);
    assert.equal(h.scene.cadence.waiting, false);
    assert.equal(h.scene.cadence.ready, false);
    if (boundary === 'blur') {
      page.doc.focused = true;
      page.win.emit('focus');
    }
    if (boundary === 'hidden') {
      page.doc.hidden = false;
      page.doc.emit('visibilitychange');
    }
    if (boundary === 'renderer')
      page.$('game-canvas').querySelector('canvas').emit('contextrestored');
    page.frame(0);
    await microtasks();
    assert.notEqual(page.doc.body.dataset.flightState, 'running');
    assert.deepEqual(authoritativeCheckpoint(run), before);
  }
  const starting = page.$('start-button').onclick();
  await h.waitCadence();
  await h.fill(120);
  await h.finish(starting);
  page.frame(0);
  assert.equal(page.doc.body.dataset.flightState, 'running');
  assert.deepEqual(authoritativeCheckpoint(run), before);
  assert.deepEqual(page.errors, []);
});
test('readiness timeout remains paused with accurate localized feedback and can be retried', async (t) => {
  const h = await fixture(t),
    { page } = h,
    run = page.rendered.run,
    before = authoritativeCheckpoint(run);
  const starting = page.$('start-button').onclick();
  await h.waitCadence();
  h.advanceWork(10000);
  page.frame(1000 / 60);
  await h.finish(starting);
  assert.equal(h.scene.cadence.ready, false);
  assert.notEqual(page.doc.body.dataset.flightState, 'running');
  assert.deepEqual(authoritativeCheckpoint(run), before);
  assert.match(
    page.$('flight-preparation-status').textContent,
    /The game is not ready yet.*Start or Resume again/,
  );
  assert.doesNotMatch(page.$('flight-preparation-status').textContent, /picture.*unavailable/i);
  const next = page.$('start-button').onclick();
  await h.waitCadence();
  await h.fill(60);
  await h.finish(next);
  page.frame(0);
  assert.equal(page.doc.body.dataset.flightState, 'running');
  assert.deepEqual(authoritativeCheckpoint(run), before);
  assert.deepEqual(page.errors, []);
});
test('a freshly loaded saved run measures cadence before its first explicit Resume', async (t) => {
  const storage = memoryStorage();
  let checkpoint;
  await t.test('create saved authoritative run', async (t) => {
    const h = await fixture(t, { search: '?journey=legacy&performance=1', storage });
    const p = h.page;
    const starting = p.$('start-button').onclick();
    await h.waitCadence();
    await h.fill(60);
    await h.finish(starting);
    p.frame(0);
    p.key('ArrowDown');
    for (let i = 0; i < 12; i++) p.frame();
    p.key('ArrowDown', false);
    p.$('pause-button').click();
    p.frame(0);
    checkpoint = authoritativeCheckpoint(p.rendered.run);
    assert(storage.getItem('revealline.suspended.dev.v1'));
  });
  await t.test('restore then explicitly Resume', async (t) => {
    const h = await fixture(t, { search: '?journey=legacy&performance=1', storage });
    const p = h.page;
    await p.$('continue-saved').onclick();
    p.frame(0);
    assert.deepEqual(authoritativeCheckpoint(p.rendered.run), checkpoint);
    const starting = p.$('start-button').onclick();
    await h.waitCadence();
    assert.notEqual(p.doc.body.dataset.flightState, 'running');
    await h.fill(144);
    await h.finish(starting);
    p.frame(0);
    assert.equal(p.doc.body.dataset.flightState, 'running');
    assert.deepEqual(authoritativeCheckpoint(p.rendered.run), checkpoint);
    assert(Math.abs(h.scene.cadence.snapshot().baselineMs - 1000 / 144) < 1e-8);
    assert.deepEqual(p.errors, []);
  });
});

test('a late paint during quiet readiness is rebuilt and visibly submitted before the first simulation tick', async (t) => {
  const original = BoardPainter.prototype.prepare;
  let painter,
    prepares = 0;
  BoardPainter.prototype.prepare = async function (...args) {
    painter = this;
    const result = await original.apply(this, args);
    prepares++;
    return result;
  };
  t.after(() => {
    BoardPainter.prototype.prepare = original;
  });
  const h = await fixture(t),
    { page } = h,
    run = page.rendered.run,
    before = authoritativeCheckpoint(run);
  const starting = page.$('start-button').onclick();
  await h.waitCadence();
  for (let i = 0; i < 4; i++) page.frame(1000 / 90);
  const compiled = JSON.parse(
    await readFile(new URL('../presentation/compiled/runtime.json', import.meta.url)),
  );
  const preparedBeforeChange = prepares;
  painter.setPresentation({ canvas: canvasPresentation(compiled.resolved), image: () => null });
  assert.equal(h.scene.prepared(), false);
  for (let i = 4; i < 30; i++) page.frame(1000 / 90);
  await waitFor(
    () => {
      page.frame(0, { dispatchRender: false });
      return prepares > preparedBeforeChange && h.scene.preparedFrame;
    },
    { timeoutMs: 20000, message: 'Changed paint must await its replacement visible submission' },
  );
  assert.equal(h.scene.cadence.ready, true);
  assert.equal(h.scene.cadence.samples, 30);
  assert.notEqual(page.doc.body.dataset.flightState, 'running');
  assert.deepEqual(authoritativeCheckpoint(run), before);
  page.submitRender();
  await h.finish(starting);
  page.frame(0);
  assert.equal(page.doc.body.dataset.flightState, 'running');
  assert.deepEqual(authoritativeCheckpoint(run), before);
  assert.deepEqual(page.errors, []);
});

test('public Start and cached Resume wait for selected shared theme fonts before accepting play', async (t) => {
  const h = await fixture(t),
    { page } = h;
  const themeHost = installThemeHost({ document: page.doc, window: page.win });
  t.after(() => themeHost.dispose());
  await themeHost.ready;
  const checkpoint = authoritativeCheckpoint(page.rendered.run);
  let calibrated;
  for (const family of ['dnipro-porcelain', 'vyshyvanka']) {
    let release;
    const fonts = new Promise((resolve) => {
      release = resolve;
    });
    let requested = 0;
    page.doc.fonts = {
      load: () => {
        requested++;
        return fonts;
      },
    };
    page.$(`theme-card-${family}`).click();
    const selected = themeHost.ready;
    await waitFor(() => requested > 0, { timeoutMs: 5000 });
    assert.equal(themeHost.preparing, true);
    const accepted = themeHost.snapshot();
    const starting = page.$('start-button').onclick();
    for (let i = 0; i < 40; i++) {
      page.frame(1000 / 90);
      await microtasks();
    }
    assert.notEqual(page.doc.body.dataset.flightState, 'running');
    assert.equal(themeHost.snapshot(), accepted);
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
    release([]);
    await selected;
    assert.equal(themeHost.snapshot().familyId, family);
    if (!h.scene.cadence.ready) {
      await h.waitCadence();
      await h.fill(90);
    }
    await h.finish(starting);
    page.frame(0);
    assert.equal(page.doc.body.dataset.flightState, 'running');
    assert.equal(page.doc.documentElement.dataset.interfaceTheme, family);
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
    const revision = h.scene.revision;
    await microtasks();
    page.frame(0);
    assert.equal(h.scene.revision, revision, 'The selected theme settled before play.');
    page.$('pause-button').click();
    page.frame(0);
    if (calibrated) assert.deepEqual(h.scene.cadence.snapshot(), calibrated);
    else calibrated = h.scene.cadence.snapshot();
  }
  assert.deepEqual(page.errors, []);
});

test('cancelling Start while selected fonts prepare does not cancel shared fonts or resume later', async (t) => {
  const h = await fixture(t),
    { page } = h;
  const themeHost = installThemeHost({ document: page.doc, window: page.win });
  t.after(() => themeHost.dispose());
  await themeHost.ready;
  let release,
    requested = 0;
  const fonts = new Promise((resolve) => {
    release = resolve;
  });
  page.doc.fonts = {
    load: () => {
      requested++;
      return fonts;
    },
  };
  page.$('theme-card-dnipro-porcelain').click();
  const selected = themeHost.ready;
  await waitFor(() => requested > 0, { timeoutMs: 5000 });
  const checkpoint = authoritativeCheckpoint(page.rendered.run);
  const starting = page.$('start-button').onclick();
  await waitFor(() => page.$('flight-preparation-status').textContent.includes('Getting ready.'), {
    timeoutMs: 20000,
  });
  page.$('flight-preparation-cancel').click();
  await h.finish(starting);
  assert.equal(themeHost.preparing, true, 'Attempt cancellation does not cancel the shared owner.');
  release([]);
  await selected;
  page.frame(0);
  assert.notEqual(page.doc.body.dataset.flightState, 'running');
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  const resumed = page.$('start-button').onclick();
  await h.waitCadence();
  await h.fill(120);
  await h.finish(resumed);
  page.frame(0);
  assert.equal(page.doc.body.dataset.flightState, 'running');
  assert.equal(themeHost.snapshot().familyId, 'dnipro-porcelain');
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.deepEqual(page.errors, []);
});

test('the inert host loads only its known local stylesheet and preserves explicit event overrides', async () => {
  const doc = new Document(),
    href = new URL('../presentation/industrial-workshop.css', import.meta.url).href;
  let reads = 0,
    loads = 0,
    errors = 0;
  const stop = installSoloStylesheets(doc, {
    read: async (...args) => {
      reads++;
      return readFile(...args);
    },
  });
  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.addEventListener('load', () => loads++);
  link.addEventListener('error', () => errors++);
  doc.head.append(link);
  await waitFor(() => loads === 1);
  assert.equal(reads, 1);
  assert.equal(errors, 0);
  assert(link.sheet.cssRules.length > 0);
  const unknown = doc.createElement('link');
  unknown.rel = 'stylesheet';
  unknown.href = 'https://invalid.example/unknown.css';
  doc.head.append(unknown);
  await microtasks();
  assert.equal(reads, 1);
  // A browserSetup-style replacement controls its own fault without the model forwarding it.
  const prior = doc.head.append;
  doc.head.append = (...nodes) => {
    for (const node of nodes) node.emit('error');
  };
  const failed = doc.createElement('link');
  failed.rel = 'stylesheet';
  failed.href = href;
  failed.addEventListener('error', () => errors++);
  doc.head.append(failed);
  assert.equal(errors, 1);
  assert.equal(reads, 1);
  stop();
  assert.notEqual(doc.head.append, prior, 'Cleanup does not overwrite a caller override.');
});

test('the stylesheet model retains failures and ignores detached, replaced or disposed link completions', async () => {
  for (const boundary of ['failed', 'detached', 'replaced', 'disposed']) {
    const doc = new Document();
    let release,
      reject,
      signal,
      loads = 0,
      errors = 0;
    const pending = new Promise((resolve, fail) => {
      release = resolve;
      reject = fail;
    });
    const stop = installSoloStylesheets(doc, {
      read: (_url, options) => {
        signal = options.signal;
        return pending;
      },
    });
    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('../presentation/industrial-workshop.css', import.meta.url).href;
    link.addEventListener('load', () => loads++);
    link.addEventListener('error', () => errors++);
    doc.head.append(link);
    await microtasks();
    if (boundary === 'detached') link.remove();
    if (boundary === 'replaced') link.href = 'https://invalid.example/replaced.css';
    if (boundary === 'disposed') {
      stop();
      assert.equal(signal.aborted, true);
    }
    if (boundary === 'failed') reject(new Error('Source read failed.'));
    else release(new Uint8Array([1]));
    await microtasks();
    await microtasks();
    assert.equal(loads, 0, boundary);
    assert.equal(errors, boundary === 'failed' ? 1 : 0, boundary);
    stop();
  }
});

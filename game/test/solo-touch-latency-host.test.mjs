// Actual Solo host diagnostics; injected DOM events are correctness fixtures, not native latency evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { PNGImage } from './helpers/png-image.mjs';

async function fixture(t, mode = 'stick') {
  const page = await soloPage(t, {
    pictures: { Image: PNGImage },
    fetchResponse: async (path) => String(path).includes('/content-design/assets/')
      ? new Response(await readFile(path)) : undefined,
    search: '?journey=opening&performance=1',
    journeyIndexedDB: managedIndexedDB().indexedDB,
    browserSetup({ globals }) { globals.innerWidth = 1280; globals.innerHeight = 720; },
  });
  page.change('touch-mode', mode);
  page.change('screen-controls', 'always');
  const surface = page.$('touch-surface');
  const pad = page.doc.querySelector('.direction-controls');
  surface._rect = pad._rect = { x: 0, y: 0, width: 156, height: 156 };
  const start = async () => {
    page.$('start-button').click();
    await settle(() => page.doc.body.dataset.flightState === 'running', 'Prepared public Start', { timeoutMs: 20000 });
    page.frame(0);
  };
  const pause = () => { page.$('pause-button').click(); return page.win.RevealLineSoloPerformance.export(); };
  await start();
  return { page, surface, pad, start, pause };
}
const pointer = (element, type, overrides = {}) => element.emit(type, {
  pointerId: 7, pointerType: 'touch', button: 0, buttons: 1,
  clientX: 78, clientY: 78, ...overrides,
});

for (const mode of ['stick', 'swipe']) {
  test(`${mode}: accepted surface descendant events reach tick and visible submission`, async (t) => {
    const { page, surface, pause } = await fixture(t, mode);
    const target = surface.children[0];
    assert(target, 'Actual nested touch surface label exists');
    assert.equal(pointer(target, 'pointerdown').defaultPrevented, true);
    assert.equal(pointer(surface, 'pointermove', { clientX: 120 }).defaultPrevented, true);
    const x = page.rendered.run.player.x;
    page.frame(100);
    assert(page.rendered.run.player.x > x, 'Accepted gesture actually changes movement');
    pointer(surface, 'pointerup', { buttons: 0 });
    const result = pause();
    assert.equal(result.inputLatency.byKind.touch.toTick.count, 2);
    assert.equal(result.inputLatency.byKind.touch.toRender.count, 2);
    assert.equal(result.inputLatency.byKind.pointer.toRender.count, 0);
    assert.deepEqual(page.errors, []);
  });
}

test('captured D-pad container motion is counted, ignored modality/hover/UI is not', async (t) => {
  const { page, surface, pad, pause } = await fixture(t, 'dpad');
  assert.equal(pointer(pad, 'pointerdown', { clientX: 140 }).defaultPrevented, true);
  assert.equal(pointer(pad, 'pointermove', { clientX: 12 }).defaultPrevented, true);
  pointer(pad, 'pointerup', { buttons: 0 });
  pointer(surface, 'pointermove', { buttons: 0 });
  pointer(page.$('run-message'), 'pointerdown');
  page.frame(100);
  const result = pause();
  assert.equal(result.inputLatency.byKind.touch.toRender.count, 2);
  pointer(surface, 'pointerdown');
  pointer(surface, 'pointermove', { clientX: 120 });
  page.frame(100);
  assert.equal(page.win.RevealLineSoloPerformance.export().inputLatency.byKind.touch.toRender.count, 2);
  assert.deepEqual(page.errors, []);
});

test('new surface targets require acceptance, keep mouse kind, and retire unsubmitted touch tokens', async (t) => {
  const { page, surface, pad, start, pause } = await fixture(t);
  assert.equal(pointer(pad, 'pointerdown').defaultPrevented, false, 'Wrong modality is ignored');
  assert.equal(pointer(surface, 'pointerdown', { button: 2 }).defaultPrevented, false);
  pointer(surface, 'pointermove', { clientX: 120, buttons: 0 });
  page.frame(100);
  assert.equal(pause().inputLatency.byKind.touch.toRender.count, 0);
  await start();
  pointer(surface, 'pointerdown');
  pointer(surface, 'pointermove', { clientX: 120 });
  page.frame(100, { dispatchRender: false });
  const retired = pause();
  assert.equal(retired.inputLatency.byKind.touch.toTick.count, 2);
  assert.equal(retired.inputLatency.byKind.touch.toRender.count, 0, 'No display submission occurred');
  assert.equal(retired.inputLatency.cancelled, 2);
  await start();
  pointer(surface, 'pointerdown', { pointerType: 'mouse', pointerId: 8 });
  pointer(surface, 'pointermove', { pointerType: 'mouse', pointerId: 8, clientX: 120 });
  page.frame(100);
  pointer(surface, 'pointerup', { pointerType: 'mouse', pointerId: 8, buttons: 0 });
  const result = pause();
  assert.equal(result.inputLatency.byKind.touch.toRender.count, 0, 'Canceled tokens never publish later');
  assert.equal(result.inputLatency.byKind.pointer.toRender.count, 2);
  assert.deepEqual(page.errors, []);
});

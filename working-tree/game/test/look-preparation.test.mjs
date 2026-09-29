import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BoardPainter } from '../ui/render.mjs';
import { prepareLookImages } from '../ui/look-preparation.mjs';
const presets = JSON.parse(
  readFileSync(new URL('../../authoring/motion-lab/presets.json', import.meta.url)),
);
const themes = JSON.parse(readFileSync(new URL('../content/themes.json', import.meta.url))).themes;
const retro = themes.find((item) => item.id === 'retro');
const fpv = themes.find((item) => item.id === 'fpv');
function fixture(t) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'Image'),
    pending = [];
  globalThis.Image = class {
    naturalWidth = 64;
    naturalHeight = 64;
    removed = false;
    constructor() {
      pending.push(this);
    }
    set src(value) {
      this.source = value;
    }
    decode() {
      return Promise.resolve();
    }
    removeAttribute() {
      this.removed = true;
    }
  };
  t.after(() =>
    previous ? Object.defineProperty(globalThis, 'Image', previous) : delete globalThis.Image,
  );
  const painter = new BoardPainter(presets);
  painter.makeArt = (theme) => ({ theme });
  return { painter, pending };
}
async function ready(painter, pending, theme = retro, body = 'retro-craft') {
  const result = painter.prepareLook(theme, body);
  pending.at(-1).onload();
  const look = await result;
  look.accept();
  look.dispose();
  return painter.image;
}
test('required look retains old body and pixels until decoding finishes, then adopts once', async (t) => {
  const { painter, pending } = fixture(t);
  const old = await ready(painter, pending);
  const runBackground = painter.background;
  const preparation = painter.prepareLook(fpv, 'fpv-scout-v1');
  const image = pending.at(-1);
  let decoded;
  image.decode = () =>
    new Promise((resolve) => {
      decoded = resolve;
    });
  image.onload();
  assert.equal(painter.image, old);
  assert.equal(painter.theme, retro);
  assert.equal(painter.background, runBackground);
  decoded();
  const look = await preparation;
  assert.equal(painter.image, old, 'Completing preparation does not adopt it');
  look.accept();
  assert.equal(painter.image, image);
  assert.equal(painter.theme, fpv);
  assert.throws(() => look.accept(), { name: 'AbortError' });
  look.dispose();
  assert.equal(image.removed, false, 'Adopted image remains drawable');
});
test('same exact source is reused across a theme change without reloading or losing pixels', async (t) => {
  const { painter, pending } = fixture(t),
    old = await ready(painter, pending);
  const theme = { ...retro, id: 'new-horizon' };
  const look = await painter.prepareLook(theme, 'retro-craft');
  assert.equal(pending.length, 1);
  look.accept();
  look.dispose();
  assert.equal(painter.image, old);
  assert.equal(painter.theme, theme);
});
test('load failure and decode failure preserve previous look and release only abandoned images', async (t) => {
  const { painter, pending } = fixture(t),
    old = await ready(painter, pending);
  const failed = painter.prepareLook(fpv, 'fpv-scout-v1');
  pending.at(-1).onerror();
  await assert.rejects(failed, /could not be loaded/);
  assert.equal(painter.image, old);
  assert.equal(old.removed, false);
  assert.equal(pending.at(-1).removed, true);
  const failedDecode = painter.prepareLook(fpv, 'fpv-scout-v1');
  pending.at(-1).decode = async () => {
    throw Error('decoder rejected');
  };
  pending.at(-1).onload();
  await assert.rejects(failedDecode, /decoder rejected/);
  assert.equal(painter.image, old);
});
test('abort settles even a never-loading image, drops its callbacks, and keeps previous pixels', async (t) => {
  const { painter, pending } = fixture(t),
    old = await ready(painter, pending),
    controller = new AbortController();
  const result = painter.prepareLook(fpv, 'fpv-scout-v1', {}, { signal: controller.signal });
  controller.abort();
  await assert.rejects(result, { name: 'AbortError' });
  assert.equal(painter.image, old);
  assert.equal(pending.at(-1).onload, null);
  assert.equal(pending.at(-1).removed, true);
});
test('finite deadline preserves old look and is an error rather than a player cancellation', async (t) => {
  const { painter, pending } = fixture(t),
    old = await ready(painter, pending);
  await assert.rejects(
    painter.prepareLook(fpv, 'fpv-scout-v1', {}, { timeoutMs: 5 }),
    /did not become ready/,
  );
  assert.equal(painter.image, old);
  assert.equal(pending.at(-1).removed, true);
});
test('a superseding look makes the staged adoption stale without damaging newer pixels', async (t) => {
  const { painter, pending } = fixture(t);
  await ready(painter, pending);
  const preparation = painter.prepareLook(fpv, 'fpv-scout-v1');
  pending.at(-1).onload();
  const look = await preparation;
  await painter.setLook(retro, 'neutral-marker');
  assert.equal(look.current(), false);
  assert.throws(() => look.accept(), { name: 'AbortError' });
  look.dispose();
  assert.equal(painter.bodyId, 'neutral-marker');
  assert.equal(painter.image, null);
});
test('complete compiled player skips unused source, while a missing compact variant requires it', async (t) => {
  const { painter, pending } = fixture(t);
  const sprites = { 'player.scout.compact': { image: {} }, 'player.scout.detailed': { image: {} } };
  painter.setPresentation({ image: (slot) => sprites[slot] });
  const look = await painter.prepareLook(fpv, 'fpv-scout-v1');
  assert.equal(pending.length, 0);
  look.accept();
  look.dispose();
  delete sprites['player.scout.compact'];
  const preparation = painter.prepareLook(fpv, 'fpv-scout-v1');
  assert.equal(pending.length, 1);
  pending[0].onload();
  const required = await preparation;
  required.accept();
  required.dispose();
  assert.equal(painter.image, pending[0]);
});
test('explicit player override remains required even with decoded compiled sprites', async (t) => {
  const { painter, pending } = fixture(t);
  painter.setPresentation({ image: () => ({ image: {} }) });
  const preparation = painter.prepareLook(fpv, 'fpv-scout-v1', {
    player: { dataUrl: 'data:image/png;base64,required' },
  });
  assert.equal(pending.length, 1);
  assert.equal(pending[0].source, 'data:image/png;base64,required');
  pending[0].onerror();
  await assert.rejects(preparation, /could not be loaded/);
});
test('an aborted prepared look cannot adopt and unknown bodies never silently substitute', async (t) => {
  const { painter, pending } = fixture(t),
    controller = new AbortController();
  const preparation = painter.prepareLook(retro, 'retro-craft', {}, { signal: controller.signal });
  pending[0].onload();
  const look = await preparation;
  controller.abort();
  assert.throws(() => look.accept(), { name: 'AbortError' });
  look.dispose();
  assert.equal(pending[0].removed, true);
  await assert.rejects(painter.prepareLook(retro, 'missing'), /not registered/);
});
test('zero-sized decoded art and invalid deadlines fail visibly', async (t) => {
  const { pending } = fixture(t);
  const result = prepareLookImages([{ role: 'player', src: 'bad.png' }]);
  pending[0].naturalWidth = 0;
  pending[0].onload();
  await assert.rejects(result, /no drawable pixels/);
  await assert.rejects(prepareLookImages([], { timeoutMs: Infinity }), /Invalid.*deadline/);
});

test('readiness is invalidated by a cosmetic look or a changed compiled snapshot', async (t) => {
  const { painter, pending } = fixture(t);
  assert.equal(painter.requiredLookReady(), false);
  await ready(painter, pending);
  assert.equal(painter.requiredLookReady(), true);
  const changed = painter.setLook(retro, 'retro-craft');
  assert.equal(painter.requiredLookReady(), false);
  pending.at(-1).onload();
  await changed;
  assert.equal(
    painter.requiredLookReady(),
    false,
    'Legacy cosmetic completion does not adopt a required look',
  );
  const snapshot = { image: () => ({ image: {} }) };
  painter.setPresentation(snapshot);
  const prepared = await painter.prepareLook(fpv, 'fpv-scout-v1');
  prepared.accept();
  prepared.dispose();
  assert.equal(painter.requiredLookReady(), true);
  painter.setPresentation({ image: snapshot.image });
  assert.equal(painter.requiredLookReady(), false);
});
test('a compiled snapshot arriving during source preparation cannot silently change its owner', async (t) => {
  const { painter, pending } = fixture(t);
  const preparation = painter.prepareLook(fpv, 'fpv-scout-v1');
  pending[0].onload();
  const look = await preparation;
  painter.setPresentation({ image: () => ({ image: {} }) });
  assert.equal(look.current(), false);
  assert.throws(() => look.accept(), { name: 'AbortError' });
  look.dispose();
  assert.equal(pending[0].removed, true);
});

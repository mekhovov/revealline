import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { authoritativeCheckpoint, verifyReplay } from '../replay.mjs';
import { emptyLibrary, updatePreferences, saveLibrary, loadLibrary } from '../library.mjs';

const profileKey = 'revealline.library.dev.v1',
  sessionKey = 'revealline.suspended.dev.v1';
const campaign = JSON.parse(await readFile(new URL('../content/campaign.json', import.meta.url)));
const pack = JSON.parse(
  await readFile(new URL('../content/packs/fpv-arcade-r5.json', import.meta.url)),
);
const ticks = (page, count) => {
  for (let n = 0; n < count; n++) page.frame();
};
const storageWith = (patch) => {
  const storage = memoryStorage();
  assert.equal(saveLibrary(storage, profileKey, updatePreferences(emptyLibrary(), patch)).ok, true);
  return storage;
};
function touch(target, pointerType = 'touch') {
  const steering = target.dataset.move || target.id === 'touch-surface';
  if (steering) target = target.ownerDocument.getElementById('touch-surface');
  target.emit('pointerdown', { pointerType, pointerId: 1, button: 0, clientX: 100, clientY: 100 });
  if (steering)
    target.emit('pointermove', { pointerType, pointerId: 1, clientX: 100, clientY: 130 });
  target.emit('pointerup', { pointerType, pointerId: 1, button: 0 });
}
function controls(page, expected) {
  assert.equal(page.doc.body.dataset.screenControls, expected);
}
function closeSettings(page) {
  page.doc.querySelector('button[data-close="settings-dialog"]').click();
}
function imageBoundary(t) {
  const original = globalThis.Image;
  const images = new Map(
    pack.levelVisuals.map(({ visualOverrides }) => {
      const data = visualOverrides.background.dataUrl,
        bytes = Buffer.from(data.split(',')[1], 'base64');
      return [data, [bytes.readUInt32BE(16), bytes.readUInt32BE(20)]];
    }),
  );
  globalThis.Image = class {
    set src(data) {
      const size = images.get(data);
      assert.ok(size, 'Only exact original First Light image headers are accepted.');
      [this.naturalWidth, this.naturalHeight] = size;
      queueMicrotask(() => this.onload());
    }
  };
  t.after(() => {
    if (original === undefined) delete globalThis.Image;
    else globalThis.Image = original;
  });
}

const FEATURED_ORIGINALS_TIMEOUT_MS = 180000;

async function featuredPictureReady(page) {
  // This action imports and authenticates the complete original-image pack.
  // Keep the same bounded allowance as other bulk-original hosts; input waits
  // retain their shared deadline and no application timeout is changed.
  try {
    await waitFor(
      () => !page.$('shell-featured').disabled && page.doc.body.dataset.pictureState === 'ready',
      {
        timeoutMs: FEATURED_ORIGINALS_TIMEOUT_MS,
        message: 'Featured mission must finish its exact picture preparation before Deploy.',
      },
    );
  } catch (error) {
    error.message += `\n${JSON.stringify({
      timeoutMs: FEATURED_ORIGINALS_TIMEOUT_MS,
      pack: page.$('pack-select').value,
      pictureState: page.doc.body.dataset.pictureState,
      packStatus: page.$('pack-status').textContent,
      runMessage: page.$('run-message').textContent,
      errors: page.errors.map((value) => String(value?.stack ?? value)),
    })}`;
    throw error;
  }
}

// Actual app/input/core/recorder/storage handlers. Modeled events and DOM expose
// presentation state, not CSS geometry, native focus defaults or physical devices.
test('pause updates flight presentation before another animation frame can run', async (t) => {
  const page = await soloPage(t, { campaign });
  page.$('start-button').click();
  page.frame(0);
  touch(page.$('game-canvas'));
  touch(page.doc.querySelector('[data-move="down"]'));
  ticks(page, 13);
  controls(page, 'shown');
  const checkpoint = authoritativeCheckpoint(page.rendered.run);
  page.$('pause-button').click();
  assert.equal(page.doc.body.dataset.flightState, 'paused');
  assert.equal(page.$('flight-state').textContent, 'Paused');
  controls(page, 'hidden');
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.deepEqual(page.errors, []);
});

test('featured pressure chapter hides manual actions and actual keyboard action attempts cannot change its flight', async (t) => {
  imageBoundary(t);
  const page = await soloPage(t, { titleScreen: true });
  controls(page, 'hidden');
  page.$('shell-featured').click();
  await featuredPictureReady(page);
  assert.equal(page.$('pack-select').value, 'fpv-arcade-r5');
  for (const id of ['action-button', 'pickup-button', 'boost-button', 'ability-state'])
    assert.equal(page.$(id).hidden, true, id);
  page.$('shell-deploy').click();
  assert.equal(page.$('shell-missions').open, false, 'Deploy leaves the mission browser.');
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.frame(); // Consume the explicit-start neutral tick before fresh action attempts.
  page.key('ArrowDown');
  page.key('KeyE');
  page.key('KeyR');
  page.key('ShiftLeft');
  ticks(page, 13);
  for (const key of ['ArrowDown', 'KeyE', 'KeyR', 'ShiftLeft']) page.key(key, false);
  page.$('pause-button').click();
  page.frame(0);
  const saved = JSON.parse(page.storage.getItem(sessionKey));
  const original = verifyReplay(saved.replay);
  assert.equal(original.match, true);
  assert.ok(saved.replay.segments.some((s) => s.input.action));
  assert.ok(saved.replay.segments.some((s) => s.input.pickup));
  assert.ok(saved.replay.segments.some((s) => s.input.boost));
  const clean = structuredClone(saved.replay);
  for (const segment of clean.segments)
    Object.assign(segment.input, { action: false, pickup: false, boost: false });
  const withoutActions = verifyReplay(clean);
  assert.equal(withoutActions.match, true, 'The recorded manual attempts have no core effect.');
  assert.deepEqual(
    authoritativeCheckpoint(original.state),
    authoritativeCheckpoint(withoutActions.state),
  );
  assert.equal(page.rendered.run.rules.moveSpeed, 15);
  assert.equal(page.rendered.run.ability.cooldownUntil, 0);
  controls(page, 'hidden');
  assert.deepEqual(page.errors, []);
});

for (const turnPolicy of ['immediate', 'grid-center']) {
  test(`${turnPolicy}: first Arcade Down cut keeps rendering and saves after a batched capture`, async (t) => {
    imageBoundary(t);
    const page = await soloPage(t, { titleScreen: true, storage: storageWith({ turnPolicy }) });
    page.$('shell-featured').click();
    await featuredPictureReady(page);
    page.$('shell-deploy').click();
    assert.equal(page.$('shell-missions').open, false, 'Deploy leaves the mission browser.');
    await settle(() => page.doc.body.dataset.flightState === 'running');
    page.frame(0);
    page.key('ArrowDown');
    page.key('ArrowDown', false);
    for (let frame = 0; frame < 240 && page.rendered.run.coverage === 0; frame++)
      page.frame(1000 / 60);
    const run = page.rendered.run;
    assert.ok(run.coverage > 0.5, 'The ordinary first cut closes through the central slow field.');
    assert.equal(run.player.cutting, false);
    const stopped = { x: run.player.x, y: run.player.y };
    for (let frame = 0; frame < 60; frame++) page.frame(1000 / 60);
    assert.deepEqual({ x: run.player.x, y: run.player.y }, stopped);
    assert.equal(run.status, 'running');
    assert.equal(page.$('coverage').textContent, `${(run.coverage * 100).toFixed(1)}%`);
    assert.equal(page.$('score').textContent, String(run.score).padStart(5, '0'));
    page.$('pause-button').click();
    const saved = JSON.parse(page.storage.getItem(sessionKey));
    assert.equal(verifyReplay(saved.replay).match, true);
    assert.deepEqual(saved.replay.checkpoint, authoritativeCheckpoint(run));
    assert.deepEqual(page.errors, []);
  });

  test(`${turnPolicy}: Auto appears for actual touch flight, hides after keyboard use and preserves the logical heading`, async (t) => {
    const page = await soloPage(t, { campaign, storage: storageWith({ turnPolicy }) });
    assert.equal(page.$('screen-controls').value, 'auto');
    assert.equal(page.doc.body.dataset.inputMode, 'keyboard');
    controls(page, 'hidden');
    page.$('start-button').click();
    page.frame(0);
    controls(page, 'hidden');
    touch(page.$('game-canvas'));
    assert.equal(page.doc.body.dataset.inputMode, 'touch');
    controls(page, 'shown');
    touch(page.doc.querySelector('[data-move="down"]'));
    ticks(page, 13);
    const run = page.rendered.run,
      before = authoritativeCheckpoint(run),
      y = run.player.y;
    assert.equal(run.player.cutting, true);
    page.key('KeyV'); // Unbound key changes modality, never the intended direction.
    page.key('KeyV', false);
    page.frame(0);
    assert.equal(page.doc.body.dataset.inputMode, 'keyboard');
    controls(page, 'hidden');
    assert.deepEqual(authoritativeCheckpoint(run), before);
    ticks(page, 12);
    assert.ok(run.player.y > y, 'A modality change keeps the existing downward flight intent.');
    touch(page.$('game-canvas'));
    controls(page, 'shown');
    page.$('pause-button').click();
    page.frame(0);
    controls(page, 'hidden');
    const paused = authoritativeCheckpoint(run);
    touch(page.$('game-overlay'));
    ticks(page, 5);
    controls(page, 'hidden');
    assert.equal(page.rendered.paused, true);
    assert.deepEqual(authoritativeCheckpoint(run), paused);
    const saved = JSON.parse(page.storage.getItem(sessionKey));
    assert.equal(saved.continuation.direction, 'down');
    assert.equal(verifyReplay(saved.replay).match, true);
    assert.deepEqual(page.errors, []);
  });
}

test('Always enables actual mouse steering and survives a complete backup; omitted old preference restores Auto', async (t) => {
  const page = await soloPage(t, { campaign, storage: storageWith({}) });
  page.$('settings-button').click();
  page.change('screen-controls', 'always');
  controls(page, 'hidden');
  assert.equal(
    loadLibrary(page.storage, profileKey, { campaigns: [campaign] }).library.preferences
      .screenControls,
    'always',
  );
  closeSettings(page);
  page.$('start-button').click();
  page.frame(0);
  controls(page, 'shown');
  touch(page.doc.querySelector('[data-move="down"]'), 'mouse');
  ticks(page, 13);
  assert.equal(page.doc.body.dataset.inputMode, 'pointer');
  assert.equal(page.rendered.run.player.cutting, true);
  controls(page, 'shown');
  page.$('library-button').click();
  page.frame(0);
  controls(page, 'hidden');
  const slot = page.storage.getItem(sessionKey);
  page.$('export-backup').click();
  await settle(() => !page.$('export-backup').disabled);
  const backup = JSON.parse(page.$('save-json').value);
  assert.equal(backup.library.preferences.screenControls, 'always');
  assert.deepEqual(
    { ...backup.session, savedAt: JSON.parse(slot).savedAt },
    JSON.parse(slot),
    'Export may refresh savedAt; run identity, continuation and complete replay remain exact.',
  );
  const older = structuredClone(backup);
  delete older.library.preferences.screenControls;
  page.$('save-json').value = JSON.stringify(older);
  page.$('import-save').click();
  await settle(() => !page.$('import-save').disabled);
  assert.match(page.$('save-status').textContent, /Game data restored/);
  assert.equal(page.$('screen-controls').value, 'auto');
  assert.equal(
    loadLibrary(page.storage, profileKey, { campaigns: [campaign] }).library.preferences
      .screenControls,
    'auto',
  );
  assert.deepEqual(JSON.parse(page.storage.getItem(sessionKey)), backup.session);
  page.$('save-json').value = JSON.stringify(backup);
  page.$('import-save').click();
  await settle(() => !page.$('import-save').disabled);
  assert.equal(page.$('screen-controls').value, 'always');
  assert.equal(
    loadLibrary(page.storage, profileKey, { campaigns: [campaign] }).library.preferences
      .screenControls,
    'always',
  );
  page.doc.querySelector('button[data-close="library-dialog"]').click();
  page.$('settings-button').click();
  page.change('screen-controls', 'off');
  closeSettings(page);
  page.$('start-button').click();
  touch(page.$('game-canvas'));
  page.frame(0);
  controls(page, 'hidden');
  assert.deepEqual(page.errors, []);
});

test('an already joined controller takes its first fresh turn after touch without cancelling that sampled command', async (t) => {
  const page = await soloPage(t, { campaign, storage: storageWith({ turnPolicy: 'immediate' }) });
  let buttons = [];
  globalThis.navigator.getGamepads = () => [
    {
      id: 'owned-standard-controller',
      index: 0,
      connected: true,
      mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, (_, i) => ({
        pressed: buttons.includes(i),
        value: buttons.includes(i) ? 1 : 0,
      })),
    },
  ];
  const sample = (next, ms = 0) => {
    buttons = next;
    page.frame(ms);
  };
  sample([]);
  // Automatic connection is neutral and must not start the flight.
  assert.equal(page.rendered.paused, true);
  assert.match(page.$('input-status').textContent, /controller|joined/i);
  sample([]);
  page.$('start-button').click();
  sample([], 1000 / 120); // The ordinary Resume neutral tick remains intact.
  const down = page.$('touch-surface');
  down.emit('pointerdown', {
    pointerType: 'touch',
    pointerId: 7,
    button: 0,
    clientX: 100,
    clientY: 100,
  });
  down.emit('pointermove', { pointerType: 'touch', pointerId: 7, clientX: 100, clientY: 130 });
  ticks(page, 13);
  assert.equal(page.doc.body.dataset.inputMode, 'touch');
  assert.equal(down.hasPointerCapture(7), true);
  const run = page.rendered.run,
    x = run.player.x;
  sample([15], 1000 / 120);
  assert.equal(page.doc.body.dataset.inputMode, 'controller');
  controls(page, 'hidden');
  assert.equal(
    down.hasPointerCapture(7),
    false,
    'Old touch capture is released when controller takes ownership.',
  );
  assert.ok(
    run.player.x > x,
    'The first freshly sampled Right moves immediately; no second press is required.',
  );
  down.emit('pointerup', { pointerType: 'touch', pointerId: 7, button: 0 });
  ticks(page, 12);
  const rightward = run.player.x,
    y = run.player.y;
  touch(down);
  ticks(page, 2); // The controller remains held Right; it cannot reclaim the new local Down.
  assert.equal(run.player.x, rightward);
  assert.ok(run.player.y > y);
  assert.equal(page.rendered.paused, false);
  page.$('pause-button').click();
  const saved = JSON.parse(page.storage.getItem(sessionKey));
  assert.equal(saved.continuation.direction, 'down');
  assert.equal(verifyReplay(saved.replay).match, true);
  assert.deepEqual(page.errors, []);
});

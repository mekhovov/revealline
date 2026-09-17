import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { authoritativeCheckpoint, verifyReplay } from '../replay.mjs';
import { emptyLibrary, updatePreferences, saveLibrary, loadLibrary } from '../library.mjs';
import { BACKUP_FORMAT } from '../backup.mjs';
import { emptyPackLibrary } from '../packs.mjs';
import { resolveTouchControls } from '../touch-controls.mjs';

const profileKey = 'revealline.library.dev.v1',
  sessionKey = 'revealline.suspended.dev.v1';
const campaign = JSON.parse(await readFile(new URL('../content/campaign.json', import.meta.url)));
const pack = JSON.parse(
  await readFile(new URL('../content/packs/fpv-arcade-r5.json', import.meta.url)),
);
const PRESSURE_ORIGINALS_TIMEOUT_MS = 180000;
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

async function choosePressureChapter(page) {
  // Title Start now launches the selected mission. Choose this chapter explicitly
  // through Missions before testing its authored Arcade rules.
  page.$('shell-play').click();
  assert.equal(page.$('shell-missions').open, true);
  page.$('shell-prepare').click();
  assert.equal(page.$('mission-picker-setup').open, true);
  page.change('pack-select', pack.id);
  // This action imports and authenticates the complete original-image pack.
  // Keep the same bounded allowance as other bulk-original hosts; input waits
  // retain their shared deadline and no application timeout is changed.
  try {
    await waitFor(
      () =>
        !page.$('pack-select').disabled &&
        page.$('pack-select').value === pack.id &&
        page.doc.body.dataset.pictureState === 'ready',
      {
        timeoutMs: PRESSURE_ORIGINALS_TIMEOUT_MS,
        message:
          'Selected Pressure Lines mission must finish its exact picture preparation before Deploy.',
      },
    );
  } catch (error) {
    error.message += `\n${JSON.stringify({
      timeoutMs: PRESSURE_ORIGINALS_TIMEOUT_MS,
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

test('selected pressure chapter hides manual actions and actual keyboard action attempts cannot change its flight', async (t) => {
  imageBoundary(t);
  const page = await soloPage(t, { titleScreen: true });
  controls(page, 'hidden');
  await choosePressureChapter(page);
  assert.equal(page.$('pack-select').value, 'fpv-arcade-r5');
  assert.equal(page.$('manual-equipment-help').hidden, true);
  assert.doesNotMatch(page.$('keyboard-help').textContent, /supply/i);
  assert.doesNotMatch(page.$('controller-help').textContent, /: supply/i);
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
    await choosePressureChapter(page);
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
  page.$('settings-tab-controls').click();
  assert.equal(page.$('settings-panel-controls').hidden, false);
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
  page.$('settings-tab-controls').click();
  assert.equal(page.$('settings-panel-controls').hidden, false);
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

const handPreferences = (side) => ({
  screenSteeringHand: side,
  touchControls: { ...resolveTouchControls(null), side },
});
function steeringHand(page, expected) {
  assert.equal(page.$('touch-side').value, expected);
  assert.equal(page.doc.body.dataset.screenSteeringHand, expected);
  assert.equal(page.doc.body.dataset.touchSide, expected);
  assert.equal(
    page.doc.getElementById('screen-steering-hand'),
    null,
    'There is one placement selector.',
  );
  const groups = page.doc.querySelector('.play-controls').children;
  assert.deepEqual(
    [...groups].map((group) => group.id || group.className),
    expected === 'right'
      ? ['ability-buttons', 'touch-surface', 'direction-controls']
      : ['touch-surface', 'direction-controls', 'ability-buttons'],
    'Native DOM traversal follows the visible left-to-right group order.',
  );
}
const currentProfile = (storage) => loadLibrary(storage, profileKey, { campaigns: [campaign] });
function startHandCut(page) {
  page.$('start-button').click();
  page.frame(0);
  const down = page.doc.querySelector('[data-move="down"]');
  touch(down);
  ticks(page, 13);
  assert.equal(page.rendered.run.player.cutting, true);
  return down;
}
function pauseForHand(page) {
  page.$('settings-button').click();
  page.$('settings-tab-controls').click();
  assert.equal(page.$('settings-panel-controls').hidden, false);
  page.frame(0);
  assert.equal(page.$('settings-dialog').open, true);
  assert.equal(page.rendered.paused, true);
  return {
    run: page.rendered.run,
    checkpoint: authoritativeCheckpoint(page.rendered.run),
    slot: page.storage.getItem(sessionKey),
    slotWrites: page.storage.writes.filter(([key]) => key === sessionKey).length,
  };
}
function assertHandPaused(page, before) {
  page.frame(0); // Observe the actual host, not a potentially stale render reference.
  assert.strictEqual(page.rendered.run, before.run);
  assert.equal(page.rendered.paused, true);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), before.checkpoint);
  assert.equal(page.storage.getItem(sessionKey), before.slot);
  assert.equal(page.storage.writes.filter(([key]) => key === sessionKey).length, before.slotWrites);
  controls(page, 'hidden');
}

for (const turnPolicy of ['immediate', 'grid-center']) {
  test(`${turnPolicy}: changing steering hand retains the original pad, paused cut and exact continuation`, async (t) => {
    const page = await soloPage(t, {
      campaign,
      storage: storageWith({ ...handPreferences('left'), turnPolicy, screenControls: 'always' }),
    });
    steeringHand(page, 'left');
    const down = startHandCut(page),
      before = pauseForHand(page),
      original = JSON.parse(before.slot),
      library = currentProfile(page.storage).library;
    assert.equal(verifyReplay(original.replay).match, true);
    const strip = page.doc.querySelector('.play-controls'),
      append = strip.append;
    let groupMoves = 0,
      previousHand = 'left';
    t.mock.method(strip, 'append', function (...nodes) {
      groupMoves++;
      return append.apply(this, nodes);
    });
    for (const hand of ['right', 'right', 'left', 'left', 'right']) {
      const previousMoves = groupMoves;
      const padReads = page.padReads;
      page.$('touch-side').focus();
      page.change('touch-side', hand);
      assert.equal(
        groupMoves - previousMoves,
        Number(hand !== previousHand),
        'Move groups once when changing hand; repeated synchronization leaves their native order intact.',
      );
      previousHand = hand;
      steeringHand(page, hand);
      assert.strictEqual(page.doc.activeElement, page.$('touch-side'));
      assert.equal(page.padReads, padReads, 'Placement never polls hardware.');
      assert.strictEqual(page.doc.querySelector('[data-move="down"]'), down);
      assert.equal(page.$('screen-controls').value, 'always');
      assert.deepEqual(
        currentProfile(page.storage).library,
        updatePreferences(library, handPreferences(hand)),
      );
      assert.match(page.$('screen-steering-status').textContent, /Steering hand saved/);
      assert.equal(page.$('screen-steering-status').hidden, false);
      assertHandPaused(page, before);
    }
    closeSettings(page);
    assertHandPaused(page, before);
    page.$('start-button').click();
    page.frame(0);
    controls(page, 'shown');
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), before.checkpoint);
    const y = before.run.player.y;
    ticks(page, 12);
    assert.ok(before.run.player.y > y, 'Explicit Resume retains the accepted Down direction.');
    page.$('pause-button').click();
    page.frame(0);
    const continued = JSON.parse(page.storage.getItem(sessionKey));
    assert.equal(continued.runId, original.runId);
    assert.equal(continued.campaignKey, original.campaignKey);
    assert.equal(continued.continuation.direction, 'down');
    assert.equal(before.run.turnPolicy, turnPolicy);
    assert.deepEqual(continued.replay.segments, [
      { ...original.replay.segments[0], ticks: original.replay.ticks + 12 },
    ]);
    assert.deepEqual(continued.replay.checkpoint, authoritativeCheckpoint(before.run));
    assert.equal(verifyReplay(continued.replay).match, true);
    assert.deepEqual(page.errors, []);
  });
}

test('Right hand survives actual app reload while Auto still hides keyboard controls', async (t) => {
  const storage = storageWith(handPreferences('left')),
    lifetime = { after: (callback) => (dispose = callback) };
  let dispose;
  t.after(async () => dispose?.());
  const page = await soloPage(lifetime, { campaign, storage });
  pauseForHand(page);
  page.change('touch-side', 'right');
  steeringHand(page, 'right');
  controls(page, 'hidden');
  const close = dispose;
  dispose = null;
  await close();
  const before = new Map(storage.map),
    writes = storage.writes.length;
  const reloaded = await soloPage(lifetime, { campaign, storage });
  steeringHand(reloaded, 'right');
  assert.equal(reloaded.$('screen-controls').value, 'auto');
  controls(reloaded, 'hidden');
  assert.deepEqual(storage.map, before);
  assert.equal(storage.writes.length, writes, 'Startup does not resave an unchanged preference.');
  reloaded.$('start-button').click();
  reloaded.frame(0);
  controls(reloaded, 'hidden');
  touch(reloaded.$('game-canvas'));
  controls(reloaded, 'shown');
  reloaded.key('KeyV');
  reloaded.key('KeyV', false);
  controls(reloaded, 'hidden');
  steeringHand(reloaded, 'right');
  assert.deepEqual(reloaded.errors, []);
});

test('unrelated saves apply the actual merged hand, and a deliberate Left remains explicit', async (t) => {
  const storage = storageWith(handPreferences('left')),
    page = await soloPage(t, { campaign, storage });
  startHandCut(page);
  const before = pauseForHand(page),
    current = currentProfile(storage);
  assert.equal(
    saveLibrary(
      storage,
      profileKey,
      updatePreferences(current.library, handPreferences('right')),
      null,
      { baseline: current.library, generation: current.generation },
    ).ok,
    true,
  );
  steeringHand(page, 'left');
  page.$('settings-tab-display').click();
  page.$('settings-grid').click();
  steeringHand(page, 'right');
  assert.equal(currentProfile(storage).library.preferences.showGrid, true);
  assertHandPaused(page, before);
  page.$('settings-tab-controls').click();
  page.change('touch-side', 'left');
  steeringHand(page, 'left');
  assert.equal(currentProfile(storage).library.preferences.screenSteeringHand, 'left');
  assertHandPaused(page, before);
  assert.deepEqual(page.errors, []);
});

test('quota refusal keeps the session hand and exact stored bytes with visible feedback', async (t) => {
  const storage = storageWith(handPreferences('left')),
    page = await soloPage(t, { campaign, storage });
  startHandCut(page);
  const before = pauseForHand(page),
    raw = storage.getItem(profileKey),
    setItem = storage.setItem.bind(storage);
  let deny = true;
  storage.setItem = (key, value) => {
    if (deny && key === profileKey) throw new DOMException('Storage is full', 'QuotaExceededError');
    setItem(key, value);
  };
  page.change('touch-side', 'right');
  steeringHand(page, 'right');
  assert.equal(storage.getItem(profileKey), raw);
  assert.match(page.$('screen-steering-status').textContent, /selected for this session/i);
  assert.equal(page.$('screen-steering-status').hidden, false);
  assertHandPaused(page, before);
  deny = false;
  page.$('settings-tab-display').click();
  page.$('settings-grid').click();
  steeringHand(page, 'right');
  assert.equal(currentProfile(storage).library.preferences.screenSteeringHand, 'right');
  assert.equal(page.$('screen-steering-status').hidden, true, 'Old denial feedback is cleared.');
  assertHandPaused(page, before);
  assert.deepEqual(page.errors, []);
});

test('practice hand placement stays session-only without changing profile or saved flight', async (t) => {
  const page = await soloPage(t, { campaign, storage: storageWith(handPreferences('left')) });
  page.$('demo-button').click();
  pauseForHand(page);
  const before = new Map(page.storage.map),
    writes = page.storage.writes.length;
  page.change('touch-side', 'right');
  steeringHand(page, 'right');
  assert.match(page.$('screen-steering-status').textContent, /selected for this session.*Practice/);
  assert.deepEqual(page.storage.map, before);
  assert.equal(page.storage.writes.length, writes);
  page.frame(0);
  assert.equal(page.rendered.paused, true);
  assert.deepEqual(page.errors, []);
});

test('complete-backup import and Undo adopt hand placement without rewriting the saved attempt', async (t) => {
  const page = await soloPage(t, { campaign, storage: storageWith(handPreferences('left')) });
  startHandCut(page);
  page.$('library-button').click();
  page.frame(0);
  const original = JSON.parse(page.storage.getItem(sessionKey)),
    library = currentProfile(page.storage).library;
  page.$('save-json').value = JSON.stringify({
    format: BACKUP_FORMAT,
    library: updatePreferences(library, handPreferences('right')),
    packs: emptyPackLibrary(),
    session: original,
  });
  page.$('import-save').click();
  await settle(() => !page.$('import-save').disabled);
  assert.match(page.$('save-status').textContent, /Game data restored/);
  steeringHand(page, 'right');
  assert.equal(currentProfile(page.storage).library.preferences.screenSteeringHand, 'right');
  assert.deepEqual(JSON.parse(page.storage.getItem(sessionKey)), original);
  assert.equal(page.$('undo-backup').disabled, false);
  page.$('undo-backup').click();
  await settle(() => !page.$('import-save').disabled);
  assert.match(
    page.$('save-status').textContent,
    /Previous collection, packs and saved flight restored/,
  );
  steeringHand(page, 'left');
  assert.equal(currentProfile(page.storage).library.preferences.screenSteeringHand, 'left');
  const undone = JSON.parse(page.storage.getItem(sessionKey));
  assert.deepEqual(
    { ...undone, savedAt: original.savedAt },
    original,
    'The existing Undo snapshot may refresh savedAt; every attempt, replay and continuation field stays exact.',
  );
  page.frame(0);
  assert.equal(page.rendered.paused, true);
  assert.equal(page.rendered.run.tick, 0);
  assert.equal(verifyReplay(original.replay).match, true);
  assert.deepEqual(page.errors, []);
});

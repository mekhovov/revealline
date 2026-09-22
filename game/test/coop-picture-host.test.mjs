import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';
import { deferred, waitFor } from './helpers/coop-presentation-fixture.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import { COOP_PICTURE_BINDINGS } from '../couch/coop-picture-bindings.mjs';
import { JOURNEY_REACTION_PREFERENCES_KEY as reactionKey } from '../journey/reaction-preferences.mjs';

// Actual Team entry/markup/core/input/painter and exact release bytes. The shared
// page's injected reader/decoder and finite DOM are not native image/layout proof.
const state = (f) => f.$('coop-picture-status').dataset.state;
const settle = (f, expected = 'ready') =>
  waitFor(
    () => state(f) === expected,
    () => f.$('coop-picture-status').textContent,
  );
const hud = (f) =>
  [
    'coop-stage',
    'coop-clock',
    'coop-coverage',
    'coop-reserves',
    'coop-objective',
    'coop-state-0',
    'coop-state-1',
  ].map((id) => f.$(id).textContent);
const lastImage = (f) => f.drawImages.at(-1);
const options = { nativeFocus: true, nativeVisibility: true, capturePaint: true };
function start(f) {
  f.$('coop-start').focus();
  f.tap('Enter');
  assert.equal(f.$('coop-menu').hidden, true);
  assert.equal(f.$('coop-overlay').hidden, true);
  f.tick(4);
}
function pause(f) {
  f.$('coop-pause').click();
  assert.equal(f.$('coop-overlay').hidden, false);
}

test('initial exact Relay Yard preparation exposes Cancel, then Ready and only explicit Start draws the accepted original', async (t) => {
  const gate = deferred();
  const f = await page(t, {
    ...options,
    waitPicture: false,
    beforeImport({ $ }) {
      $('coop-level').value = 'relay-yard';
      $('coop-level').emit('change');
    },
    presentation: { read: () => gate.promise },
  });
  assert.equal(f.doc.documentElement.dataset.toolState, 'ready');
  assert.equal(state(f), 'preparing');
  assert.equal(f.doc.activeElement.id, 'coop-picture-cancel');
  assert.equal(f.$('coop-start').disabled, true);
  assert.equal(f.$('coop-tools').contains(f.doc.activeElement), true);
  f.tick(60);
  assert.equal(f.drawImages.length, 0);
  gate.resolve();
  await settle(f);
  assert.equal(f.doc.activeElement.id, 'coop-start');
  assert.equal(f.$('coop-menu').hidden, false);
  assert.equal(f.$('coop-level').value, 'relay-yard');
  assert.equal(f.artwork.calls.loads, 1);
  assert.equal(f.artwork.calls.reads.length, 1);
  start(f);
  assert.equal(lastImage(f).sha256, COOP_PICTURE_BINDINGS[1].picture.sha256);
  assert.equal(f.$('coop-stage').textContent, 'RELAY YARD');
});

test('actual arena selection prepares Relay Yard independently and releases the unadopted First Connection picture once', async (t) => {
  const f = await page(t, options);
  const first = f.artwork.calls.urls[0];
  f.$('coop-level').focus();
  await f.choose('coop-level', 'relay-yard');
  assert.equal(f.doc.activeElement.id, 'coop-start');
  assert.deepEqual(f.artwork.calls.releases, [first]);
  assert.equal(f.$('coop-menu').hidden, false);
  start(f);
  assert.equal(lastImage(f).sha256, COOP_PICTURE_BINDINGS[1].picture.sha256);
  assert.equal(f.$('coop-stage').textContent, 'RELAY YARD');
});

test('Back cancels the initial actual picture read; late bytes cannot ready the arena and explicit Retry retains the exact identity', async (t) => {
  const gate = deferred();
  const f = await page(t, {
    ...options,
    waitPicture: false,
    presentation: { read: ({ calls }) => (calls.reads.length === 1 ? gate.promise : undefined) },
  });
  await waitFor(() => f.artwork.calls.reads.length === 1);
  f.tap('Escape');
  assert.equal(state(f), 'cancelled');
  assert.equal(f.doc.activeElement.id, 'coop-picture-retry');
  assert.equal(f.visits.length, 0);
  gate.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(state(f), 'cancelled');
  assert.equal(f.artwork.calls.decodes.length, 0);
  f.tap('Enter');
  await settle(f);
  assert.equal(f.artwork.calls.reads.length, 2);
  assert.equal(f.artwork.calls.reads[0].slot, f.artwork.calls.reads[1].slot);
  assert.equal(
    f.artwork.calls.reads[0].options.snapshot,
    f.artwork.calls.reads[1].options.snapshot,
  );
  assert.equal(f.$('coop-menu').hidden, false);
  start(f);
});

test('Cancel during decode releases only that image; its late decode cannot replace or release a newer Retry', async (t) => {
  const gate = deferred();
  const f = await page(t, {
    ...options,
    waitPicture: false,
    presentation: {
      decode: ({ calls }) => (calls.decodes.length === 1 ? gate.promise : undefined),
    },
  });
  await waitFor(() => f.artwork.calls.decodes.length === 1);
  const old = f.artwork.calls.urls[0];
  f.$('coop-picture-cancel').focus();
  f.tap('Enter');
  assert.deepEqual(f.artwork.calls.releases, [old]);
  f.tap('Enter');
  await settle(f);
  const next = f.artwork.calls.urls[1];
  gate.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(f.artwork.calls.releases, [old]);
  assert.equal(state(f), 'ready');
  start(f);
  assert.equal(lastImage(f).source, next);
});

test('a new actual arena choice supersedes a held old read without adopting or focusing from its late completion', async (t) => {
  const gate = deferred();
  const f = await page(t, {
    ...options,
    waitPicture: false,
    presentation: { read: ({ calls }) => (calls.reads.length === 1 ? gate.promise : undefined) },
  });
  await waitFor(() => f.artwork.calls.reads.length === 1);
  f.$('coop-level').focus();
  await f.choose('coop-level', 'relay-yard');
  f.$('coop-versus').focus();
  gate.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.doc.activeElement.id, 'coop-versus');
  assert.equal(state(f), 'ready');
  assert.equal(f.artwork.calls.decodes.length, 1);
  start(f);
  assert.equal(lastImage(f).sha256, COOP_PICTURE_BINDINGS[1].picture.sha256);
});

for (const interruption of ['blur', 'hidden', 'pagehide']) {
  test(`${interruption} retires preparation and cannot revive Start or focus after returning`, async (t) => {
    const gate = deferred();
    const f = await page(t, {
      ...options,
      waitPicture: false,
      presentation: { read: ({ calls }) => (calls.reads.length === 1 ? gate.promise : undefined) },
    });
    await waitFor(() => f.artwork.calls.reads.length === 1);
    if (interruption === 'hidden') {
      f.doc.hidden = true;
      f.doc.emit('visibilitychange');
    } else f.win.emit(interruption, { persisted: true });
    f.doc.hidden = false;
    f.doc.focused = true;
    f.win.emit('pageshow', { persisted: true });
    f.$('coop-versus').focus();
    gate.resolve();
    await new Promise((resolve) => setImmediate(resolve));
    f.tick(60);
    assert.equal(state(f), 'cancelled');
    assert.equal(f.$('coop-start').disabled, true);
    assert.equal(f.doc.activeElement.id, 'coop-versus');
    assert.equal(f.drawImages.length, 0);
    f.$('coop-picture-retry').focus();
    f.tap('Enter');
    await settle(f);
    assert.equal(f.$('coop-menu').hidden, false);
    start(f);
  });
}

test('deliberate keyboard traversal away from pending Cancel keeps its chosen mode link when Ready', async (t) => {
  const gate = deferred();
  const f = await page(t, {
    ...options,
    waitPicture: false,
    presentation: { read: () => gate.promise },
  });
  for (let n = 0; n < 30 && f.doc.activeElement.id !== 'coop-versus'; n++) f.tap('Tab');
  assert.equal(f.doc.activeElement.id, 'coop-versus');
  gate.resolve();
  await settle(f);
  assert.equal(f.doc.activeElement.id, 'coop-versus');
  assert.equal(f.visits.length, 0);
  assert.equal(f.$('coop-menu').hidden, false);
});

for (const intent of ['pointer', 'keyboard']) {
  test(`fresh ${intent} intent without a focus change vetoes the pending Ready focus handoff`, async (t) => {
    const gate = deferred();
    const f = await page(t, {
      ...options,
      waitPicture: false,
      presentation: { read: () => gate.promise },
    });
    const focus = f.doc.activeElement;
    assert.equal(focus.id, 'coop-picture-cancel');
    if (intent === 'pointer')
      f.$('coop-intro').emit('pointerdown', { button: 0, pointerType: 'mouse' });
    else f.press('Shift');
    assert.equal(f.doc.activeElement, focus, 'This intent does not itself change focus.');
    const attempts = f.focusAttempts.length;
    gate.resolve();
    await settle(f);
    assert.equal(
      f.focusAttempts.length,
      attempts,
      'Ready must not add programmatic focus after fresh intent.',
    );
    assert.equal(f.$('coop-menu').hidden, false);
    assert.equal(f.drawImages.length, 0);
  });
}

test('required decode failure exposes Retry with no procedural fallback or automatic start', async (t) => {
  const faults = [],
    refusal = new Error('Modeled decoder refusal');
  t.mock.method(console, 'error', (...args) => faults.push(args));
  let fail = true;
  const f = await page(t, {
    ...options,
    waitPicture: false,
    presentation: {
      decode: () => {
        if (fail) throw refusal;
      },
    },
  });
  await settle(f, 'error');
  assert.equal(
    f.$('coop-picture-status').textContent,
    'Team picture unavailable. Retry picture or choose another arena.',
  );
  assert.deepEqual(faults, [['Team picture preparation failed.', refusal]]);
  assert.equal(f.doc.activeElement.id, 'coop-picture-retry');
  assert.equal(f.$('coop-start').disabled, true);
  assert.equal(f.drawImages.length, 0);
  assert.deepEqual(f.artwork.calls.releases, f.artwork.calls.urls);
  fail = false;
  f.tap('Enter');
  await settle(f);
  assert.equal(f.$('coop-menu').hidden, false);
  start(f);
});

test('confirmed Retry retains the immutable authored arena and exact accepted picture after live enemy mutation', async (t) => {
  const f = await page(t, options);
  await f.choose('coop-level', 'relay-yard');
  f.$('coop-start').click();
  const firstPaint = f.lastPaint,
    image = lastImage(f);
  f.tick(120);
  pause(f);
  const before = hud(f),
    beforePaint = f.lastPaint;
  f.$('coop-retry').focus();
  f.tap('Enter');
  f.tap('Escape');
  f.tick(60);
  assert.deepEqual(hud(f), before);
  assert.equal(f.lastPaint, beforePaint);
  f.$('coop-retry').focus();
  f.tap('Enter');
  f.$('coop-discard-confirm').focus();
  f.tap('Enter');
  assert.equal(f.$('coop-clock').textContent, '0:00');
  assert.equal(f.lastPaint, firstPaint);
  assert.equal(lastImage(f), image);
  assert.equal(f.artwork.calls.reads.length, 2);
  assert.deepEqual(f.artwork.calls.releases, [f.artwork.calls.urls[0]]);
});

test('changed accepted asset authority refuses Retry before replacing the paused run or image', async (t) => {
  const f = await page(t, options);
  await f.choose('coop-level', 'relay-yard');
  start(f);
  f.tick(90);
  pause(f);
  const before = hud(f),
    image = lastImage(f);
  const asset = f.artwork.snapshot.resolved.assets[COOP_PICTURE_BINDINGS[1].picture.slot];
  const old = asset.revision;
  asset.revision++;
  f.$('coop-retry').click();
  f.$('coop-discard-confirm').click();
  assert.match(f.$('coop-message').textContent, /could not be replaced/);
  f.tick(90);
  assert.deepEqual(hud(f), before);
  assert.equal(lastImage(f), image);
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(f.artwork.calls.reads.length, 2);
  asset.revision = old;
  f.$('coop-resume').click();
  f.tick(90);
  assert.notDeepEqual(hud(f), before);
});

test('changed starter imports leave the ready arena intact; renamed historical imports receive the approved generic picture', async (t) => {
  const f = await page(t, options),
    changed = structuredClone(COOP_STARTER_PACK);
  changed.name += ' changed';
  await f.selectFile(JSON.stringify(changed));
  assert.equal(state(f), 'ready');
  assert.match(f.$('coop-pack-status').textContent, /No exact Team picture binding/);
  assert.equal(f.artwork.calls.reads.length, 1);
  assert.equal(f.$('coop-start').disabled, false);
  assert.equal(f.$('coop-level').value, 'first-connection');
  assert.equal(f.drawImages.length, 0);
  changed.id = 'legacy-player-team';
  await f.selectFile(JSON.stringify(changed));
  assert.equal(state(f), 'ready');
  assert.match(f.$('coop-picture-status').textContent, /Imported Team picture ready/);
  start(f);
  assert.ok(f.drawImages.length > 0);
  assert.equal(f.artwork.calls.reads.length, 2);
});

test('BFCache suspension keeps accepted artwork and shared preferences; terminal cleanup releases it exactly once', async (t) => {
  const faults = [];
  t.mock.method(console, 'error', (error) => faults.push(error.message));
  const f = await page(t, options);
  start(f);
  f.tick(90);
  f.win.emit('pagehide', { persisted: true });
  const before = hud(f),
    image = lastImage(f);
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(f.artwork.calls.releases.length, 0);
  assert.equal(f.artwork.calls.closes, 0);
  f.win.emit('pageshow', { persisted: true });
  f.tick(120);
  assert.deepEqual(hud(f), before);
  f.$('coop-settings-open').click();
  f.choose('coop-text-face', 'plain');
  assert.equal(f.doc.body.dataset.textFace, 'plain');
  f.$('coop-settings-close').click();
  f.$('coop-resume').click();
  f.tick(90);
  assert.equal(lastImage(f), image);
  assert.notDeepEqual(hud(f), before);
  f.win.emit('pagehide', { persisted: false });
  f.win.emit('pagehide', { persisted: false });
  assert.deepEqual(f.artwork.calls.releases, f.artwork.calls.urls);
  assert.equal(f.artwork.calls.closes, 1);
  assert.deepEqual(
    faults,
    [],
    'Terminal cleanup must not repaint an already released page snapshot.',
  );
});

test('paused menu/display edits retain HUD continuity and the accepted picture with only shared preference reads/writes', async (t) => {
  const savedReaction = JSON.stringify({ format: 'JourneyReactionPreferencesV1', enabled: false });
  const writes = [],
    storageReads = [],
    values = new Map([[reactionKey, savedReaction]]);
  const f = await page(t, {
    ...options,
    beforeImport: ({ install }) =>
      install('localStorage', {
        value: {
          getItem: (key) => {
            storageReads.push(key);
            return values.get(key) ?? null;
          },
          setItem: (key, value) => {
            writes.push(key);
            values.set(key, value);
          },
        },
      }),
  });
  start(f);
  f.tick(90);
  pause(f);
  const before = hud(f),
    image = lastImage(f),
    reads = f.artwork.calls.reads.length;
  f.$('coop-settings-open').click();
  f.choose('coop-text-face', 'plain');
  f.choose('coop-text-size', 'large');
  for (const [id, value] of [
    ['coop-menu-palette', 'ukrainian'],
    ['coop-menu-ornaments', 'off'],
  ]) {
    f.$(id).value = value;
    f.$(id).emit('change');
  }
  f.$('coop-reduced').checked = true;
  f.$('coop-reduced').onchange();
  f.tick(90);
  assert.deepEqual(hud(f), before);
  assert.equal(lastImage(f), image);
  assert.equal(f.artwork.calls.reads.length, reads);
  assert.equal(f.doc.body.dataset.textFace, 'plain');
  assert.equal(f.doc.body.dataset.textSize, 'large');
  assert.equal(f.doc.body.dataset.menuOrnaments, 'off');
  assert.equal(f.$('coop-journey-reactions-enabled').checked, false);
  assert.equal(values.get(reactionKey), savedReaction);
  assert.deepEqual([...new Set(storageReads)].sort(), [
    'revealline.audio-master.v1',
    'revealline.display.v1',
    reactionKey,
    'revealline.menu-style.v1',
    'revealline.team-arena.v1',
    'revealline.touch.v1',
  ]);
  assert.deepEqual([...new Set(writes)].sort(), [
    'revealline.display.v1',
    'revealline.menu-style.v1',
  ]);
});

test('picture waiting and checked mode departure have separate owners with reachable Cancel and fixed links', async (t) => {
  const gate = deferred();
  const f = await page(t, {
    ...options,
    waitPicture: false,
    href: 'http://localhost/game/couch/relay-rescue.html?return=solo&journey=legacy',
    presentation: { read: () => gate.promise },
  });
  f.$('coop-solo').focus();
  const waiting = f.$('coop-solo').emit('click', { button: 0 });
  assert.equal(waiting.defaultPrevented, true);
  assert.equal(f.$('coop-discard-dialog').open, false);
  f.$('coop-picture-cancel').focus();
  f.tap('Enter');
  f.$('coop-solo').focus();
  f.tap('Enter');
  assert.deepEqual(f.visits, ['http://localhost/game/?journey=legacy']);
  gate.resolve();
});

test('terminal pagehide during decode releases candidate resources and never focuses or adopts late completion', async (t) => {
  const gate = deferred();
  const f = await page(t, {
    ...options,
    waitPicture: false,
    presentation: { decode: () => gate.promise },
  });
  await waitFor(() => f.artwork.calls.decodes.length === 1);
  f.win.emit('pagehide', { persisted: false });
  const focusCount = f.focusAttempts.length;
  gate.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(f.artwork.calls.releases, f.artwork.calls.urls);
  assert.equal(f.artwork.calls.closes, 1);
  assert.equal(f.focusAttempts.length, focusCount);
  assert.equal(f.drawImages.length, 0);
});

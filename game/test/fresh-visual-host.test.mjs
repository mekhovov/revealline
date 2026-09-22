import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { FRESH_SOLO_VISUAL_RELEASE } from '../presentation/fresh-visual-theme.mjs';
const slot = 'revealline.suspended.dev.v1';
const ticks = (h, n) => {
  for (let i = 0; i < n; i++) h.frame();
};
const checkpoint = (h) => {
  h.frame(0);
  return authoritativeCheckpoint(h.rendered.run);
};
const start = async (h) => {
  h.$('shell-featured').click();
  await settle(() => h.doc.body.dataset.flightState === 'running');
};
function saved(h) {
  h.$('pause-button').click();
  const value = JSON.parse(h.storage.getItem(slot));
  assert.equal(value.format, 'xonix-session.v5');
  assert.deepEqual(value.visualThemePin.selection, FRESH_SOLO_VISUAL_RELEASE.selection);
  assert.equal(
    value.visualThemePin.presentation.sha256,
    h.doc.documentElement.dataset.presentationManifest,
  );
  return value;
}

test('a fresh released mission pins verified visuals and restores its exact checkpoint without rewriting artwork', async (t) => {
  const storage = memoryStorage(),
    assetIndexedDB = memoryIndexedDB().indexedDB;
  let original, before;
  await t.test('fresh first capture setup saves a real v5 attempt', async (t) => {
    const h = await soloPage(t, { storage, assetIndexedDB, titleScreen: true });
    const run = h.rendered.run;
    await start(h);
    assert.equal(run.tick, 0, 'Theme preparation must not advance simulation');
    h.key('ArrowDown');
    ticks(h, 12);
    h.key('ArrowDown', false);
    original = saved(h);
    before = checkpoint(h);
    assert.equal(original.visualThemePin.content.level.id, 'signal-01');
    assert(original.presentationPins, 'Exact picture ownership accompanies the visual collection');
  });
  await t.test('Continue independently verifies and restores both owners', async (t) => {
    const h = await soloPage(t, { storage, assetIndexedDB, titleScreen: true });
    h.$('shell-continue').click();
    await settle(() => h.doc.body.dataset.flightState === 'running');
    assert.deepEqual(checkpoint(h), before);
    const resumed = saved(h);
    assert.deepEqual(resumed.visualThemePin, original.visualThemePin);
    assert.deepEqual(resumed.presentationPins, original.presentationPins);
    assert.deepEqual(h.errors, []);
  });
});

test('real victory Retry retains visuals and failed Next keeps results before one retry starts the successor', async (t) => {
  let rejectNext = false;
  const diagnostics = [];
  t.mock.method(console, 'warn', (...args) => diagnostics.push(args));
  const h = await soloPage(t, {
    titleScreen: true,
    fetchResponse: async (url) => {
      if (rejectNext && String(url).endsWith('/visual-themes.json'))
        return new Response(
          JSON.stringify({
            format: 'revealline-visual-theme-catalogue.v1',
            id: 'test',
            revision: 1,
            entries: [],
          }),
        );
    },
  });
  await start(h);
  const firstPin = saved(h).visualThemePin;
  h.$('start-button').click();
  await settle(() => h.doc.body.dataset.flightState === 'running');
  h.key('ArrowDown');
  ticks(h, 460);
  h.key('ArrowDown', false);
  h.frame(0);
  assert.equal(h.rendered.run.status, 'won', 'A full vertical cut wins the actual opening mission');
  const won = h.rendered.run;
  h.$('retry-button').click();
  await settle(() => {
    h.frame(0);
    return h.doc.body.dataset.flightState === 'running' && h.rendered.run !== won;
  });
  assert.deepEqual(saved(h).visualThemePin, firstPin);
  h.$('start-button').click();
  await settle(() => h.doc.body.dataset.flightState === 'running');
  h.key('ArrowDown');
  ticks(h, 460);
  h.key('ArrowDown', false);
  h.frame(0);
  assert.equal(h.rendered.run.status, 'won');
  await settle(() =>
    [...h.$('missions').children].every((button) => button.dataset.pictureState !== 'loading'),
  );
  const result = h.rendered.run,
    before = checkpoint(h),
    savedBefore = h.storage.getItem(slot),
    profileBefore = h.storage.getItem('revealline.library.dev.v1');
  rejectNext = true;
  h.$('next-button').click();
  await settle(() =>
    h.$('flight-preparation-status').textContent.includes('Could not prepare this mission'),
  );
  assert.deepEqual(checkpoint(h), before);
  assert.equal(h.rendered.run, result);
  assert.equal(h.storage.getItem(slot), savedBefore);
  assert.equal(h.storage.getItem('revealline.library.dev.v1'), profileBefore);
  assert.equal(diagnostics.length, 1);
  assert.match(String(diagnostics[0][1]), /selected release theme is unavailable/);
  rejectNext = false;
  h.$('next-button').click();
  assert.equal(h.rendered.run, result, 'The old result remains before staged readiness');
  await settle(() => {
    h.frame(0);
    return h.doc.body.dataset.flightState === 'running' && h.rendered.run.levelId === 'signal-02';
  });
  assert.equal(h.rendered.run.tick, 0);
  const next = saved(h);
  assert.equal(next.visualThemePin.content.level.id, 'signal-02');
  assert.notEqual(next.visualThemePin.content.level.sha256, firstPin.content.level.sha256);
  assert.deepEqual(next.visualThemePin.presentation, firstPin.presentation);
  assert.deepEqual(h.errors, []);
});

test('Gentle fresh play pins the original mission while keeping its transformed checkpoint', async (t) => {
  const h = await soloPage(t, { titleScreen: true });
  h.change('difficulty-select', 'gentle');
  await settle(() => h.doc.body.dataset.pictureState === 'ready');
  await start(h);
  h.key('ArrowDown');
  ticks(h, 12);
  h.key('ArrowDown', false);
  const value = saved(h);
  assert.equal(
    value.visualThemePin.content.owner.baseCampaignKey,
    FRESH_SOLO_VISUAL_RELEASE.campaignKey,
  );
  assert.equal(value.visualThemePin.content.level.id, 'signal-01');
  assert.notEqual(value.campaignKey, FRESH_SOLO_VISUAL_RELEASE.campaignKey);
  assert.equal(h.rendered.run.status, 'running');
});

test('cancelled fresh-theme preparation keeps the current paused run and can retry deliberately', async (t) => {
  let waiting = false,
    aborted = false,
    hold = true;
  const h = await soloPage(t, {
    titleScreen: true,
    fetchResponse: async (url, options) => {
      if (hold && String(url).endsWith('/visual-themes.json')) {
        waiting = true;
        return new Promise((resolve, reject) =>
          options.signal.addEventListener(
            'abort',
            () => {
              aborted = true;
              reject(new DOMException('Cancelled.', 'AbortError'));
            },
            { once: true },
          ),
        );
      }
    },
  });
  const before = checkpoint(h),
    run = h.rendered.run;
  h.$('shell-featured').click();
  await settle(() => waiting);
  assert.notEqual(h.doc.body.dataset.flightState, 'running');
  assert.equal(run.tick, 0);
  h.$('shell-flight-cancel').click();
  await settle(() => aborted);
  assert.equal(h.rendered.run, run);
  assert.deepEqual(checkpoint(h), before);
  assert.equal(h.storage.getItem(slot), null);
  hold = false;
  h.$('shell-featured').click();
  await settle(() => h.doc.body.dataset.flightState === 'running');
  saved(h);
});

test('an unavailable declared fresh collection fails visibly instead of falling back to page appearance', async (t) => {
  let fail = true;
  const h = await soloPage(t, {
    titleScreen: true,
    fetchResponse: async (url) => {
      if (fail && String(url).endsWith('/visual-themes.json'))
        return new Response(
          JSON.stringify({
            format: 'revealline-visual-theme-catalogue.v1',
            id: 'test',
            revision: 1,
            entries: [],
          }),
        );
    },
  });
  h.$('shell-featured').click();
  await settle(() =>
    h.$('shell-flight-status').textContent.includes('selected release theme is unavailable'),
  );
  assert.notEqual(h.doc.body.dataset.flightState, 'running');
  assert.equal(h.storage.getItem(slot), null);
  fail = false;
  h.$('shell-featured').click();
  await settle(() => h.doc.body.dataset.flightState === 'running');
  saved(h);
});

test('First Flight checked departure keeps the complete accepted visual reference and original picture', async (t) => {
  const h = await soloPage(t, { titleScreen: true });
  // Model only native document navigation; the actual checked save runs first.
  h.win.location.assign = (url) => {
    h.win.location.href = url;
  };
  await start(h);
  h.key('ArrowDown');
  ticks(h, 12);
  h.key('ArrowDown', false);
  const before = saved(h),
    beforeCheckpoint = checkpoint(h);
  h.$('shell-help').click();
  h.$('first-flight-help-enter').click();
  await settle(() => h.win.location.href.includes('course=first-flight'));
  const retained = JSON.parse(h.storage.getItem(slot));
  assert.equal(retained.format, 'xonix-session.v5');
  assert.deepEqual(retained.visualThemePin, before.visualThemePin);
  assert.deepEqual(retained.presentationPins, before.presentationPins);
  assert.deepEqual(retained.replay.checkpoint, before.replay.checkpoint);
  assert.deepEqual(checkpoint(h), beforeCheckpoint);
  assert.deepEqual(h.errors, []);
});

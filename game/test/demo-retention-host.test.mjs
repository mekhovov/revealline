import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createRun, FIXED_DT, stepRun } from '../core/index.mjs';
import { createDemoIndexedDBStorage, demoRecordingQuality } from '../demo-library.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { campaignKey, loadLibrary, progressFor } from '../library.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  exportReplay,
  recordInput,
  verifyReplay,
} from '../replay.mjs';
import { saveSession, suspendSession } from '../sessions.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { memoryStorage, settle, soloPage } from './helpers/solo-dom.mjs';

const read = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const campaign = await read('../content/campaign.json');
campaign.classRecipes = await read('../content/classes.json');
const trace = await read('../demo-data/first-signal-left.replay.json');
const DATABASE = 'revealline-demo-recordings-v1',
  PROFILE = 'revealline.library.dev.v1',
  SESSION = 'revealline.suspended.dev.v1',
  SETTINGS = 'revealline.demo.dev.v1',
  PREFIX_TICKS = 49;
const keys = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };

function unfinishedFlight() {
  const level = applyGameplayTuning(campaign.levels[0], resolveGameplayTuning('standard'));
  assert.deepEqual(
    level,
    trace.level,
    'Use the real installed First Signal with current Standard tuning.',
  );
  const run = createRun(level, trace.options),
    recorder = createRecorder(level, trace.options),
    inputs = trace.segments.flatMap(({ ticks, input, releaseBefore }) => {
      assert.equal(releaseBefore, false);
      return Array(ticks).fill(input);
    });
  // This is a real early ordinary save, not a fabricated terminal checkpoint.
  // The reviewed route's seed35 is restored through Continue Saved. The frozen
  // cross-engine final checkpoint is not trusted; this host records its own win.
  for (const input of inputs.slice(0, PREFIX_TICKS)) {
    stepRun(run, input, FIXED_DT);
    recordInput(recorder, input);
  }
  assert.equal(run.status, 'running');
  assert.equal(run.coverage, 0);
  const saved = suspendSession({
    run,
    recorder,
    campaignKey: campaignKey(campaign),
    themeId: 'fpv',
    bodyId: 'fpv-body',
    runId: 'demo-retention-ordinary-first-signal',
    savedAt: '2026-09-29T12:00:00.000Z',
    continuation: { direction: null },
  });
  assert.equal(verifyReplay(saved.replay).match, true);
  return { run, recorder, inputs, saved };
}

async function mountedFlight(t) {
  const f = unfinishedFlight(),
    storage = memoryStorage(),
    database = managedIndexedDB(),
    requests = [];
  assert.equal(saveSession(storage, SESSION, f.saved).ok, true);
  // The app, recorder and production demo IndexedDB adapter are unchanged.
  // Only IndexedDB transaction ordering/storage is modeled, not browser disk
  // persistence or quota. Other host databases retain the existing fixture.
  const page = await soloPage(t, {
    storage,
    titleScreen: true,
    browserSetup({ globals }) {
      const ordinary = globals.indexedDB;
      globals.indexedDB = {
        open(name, ...args) {
          if (name !== DATABASE) return ordinary.open(name, ...args);
          requests.push(name);
          return database.indexedDB.open(name, ...args);
        },
      };
    },
  });
  return { ...f, page, database, requests };
}

function openKeep(page) {
  if (!page.$('shell-home').open) page.$('shell-menu').click();
  page.$('shell-workshop').click();
  assert.equal(page.$('shell-workshop-dialog').open, true);
  page.$('demo-keep').closest('details').open = true;
  assert.equal(page.$('demo-keep').disabled, false);
  page.$('demo-keep').click();
}

function setCollection(page, enabled) {
  page.$('shell-options').click();
  page.$('settings-tab-extras').click();
  assert.equal(page.$('settings-dialog').open, true);
  assert.equal(page.$('demo-collect').checked, !enabled);
  page.$('demo-collect').checked = enabled;
  page.$('demo-collect').emit('change');
  assert.equal(JSON.parse(page.storage.getItem(SETTINGS)).collect, enabled);
  page.doc.querySelector('[data-close="settings-dialog"]').click();
}

async function completeOrdinary(f) {
  const { page, run, recorder, inputs, saved } = f;
  assert.equal(page.$('shell-continue').hidden, false);
  page.$('shell-continue').click();
  await settle(() => {
    page.frame(0);
    return page.doc.body.dataset.flightState === 'running';
  });
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), saved.replay.checkpoint);
  let direction = null,
    frames = 0;
  const flush = () => {
    if (!frames) return;
    page.frame(frames * FIXED_DT * 1000);
    frames = 0;
    assert.equal(page.rendered.run.tick, run.tick);
    assert.equal(page.rendered.run.status, run.status);
  };
  for (const input of inputs.slice(PREFIX_TICKS)) {
    if (input.action || (input.direction && input.direction !== direction)) flush();
    if (input.direction && input.direction !== direction) {
      page.key(keys[input.direction]);
      page.key(keys[input.direction], false);
      direction = input.direction;
    }
    if (input.action) {
      page.key('KeyE');
      page.key('KeyE', false);
    }
    assert.equal(input.boost, false);
    assert.equal(input.pickup, false);
    assert.equal(input.switchClass, null);
    // Ordinary continuous steering retains its last heading on key release.
    // The authored route waits on the top border; use the actual retained
    // heading in the independent reference instead of injecting a stop.
    const command = { ...input, direction };
    stepRun(run, command, FIXED_DT);
    recordInput(recorder, command);
    frames++;
    const capture = run.events.some((event) => event.type === 'capture.stopped');
    if (input.action || capture || frames === 12 || run.status === 'won') flush();
    if (capture) direction = null;
    if (run.status === 'won') break;
  }
  flush();
  assert.equal(
    page.rendered.run.status,
    'won',
    'Ordinary keys complete the actual restored flight.',
  );
  assert.equal(page.rendered.run.lives, 3);
  assert.equal(page.rendered.run.tick, trace.ticks);
  const checkpoint = authoritativeCheckpoint(run);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  const replay = exportReplay(recorder, run);
  assert.equal(verifyReplay(replay).match, true);
  assert.equal(demoRecordingQuality(replay).eligible, true);
  const earned = loadLibrary(page.storage, PROFILE).library;
  assert.ok(progressFor(earned, campaign).clears['signal-01']);
  assert.equal(earned.gallery.length, 1, 'The ordinary win still earns its picture.');
  assert.equal(earned.scores.length, 1, 'The ordinary win still earns its score.');
  assert.equal(page.storage.getItem(SESSION), null, 'Only the completed owned save is cleared.');
  page.$('skip-celebration').click();
  assert.equal(page.$('game-overlay').dataset.kind, 'won');
  return { checkpoint, earned };
}

async function readCache(database) {
  const adapter = createDemoIndexedDBStorage({ indexedDB: database.indexedDB });
  try {
    return await adapter.read();
  } finally {
    adapter.close();
  }
}

function assertRetained(document, checkpoint) {
  assert.equal(document.items.length, 1);
  const saved = JSON.parse(document.items[0].replayText);
  assert.equal(verifyReplay(saved).match, true, 'The app produced a strictly verifiable replay.');
  assert.deepEqual(saved.checkpoint, checkpoint);
  assert.equal(document.items[0].descriptor.campaignKey, campaignKey(campaign));
}

test('mounted ordinary restored win is kept manually without enabling automatic collection', async (t) => {
  const f = await mountedFlight(t),
    { page, database, requests } = f;
  assert.equal(page.$('demo-collect').checked, false);
  openKeep(page);
  assert.match(page.$('demo-keep-status').textContent, /Complete a normal run/);
  assert.deepEqual(requests, [], 'An unfinished Keep does not open the demo database.');
  page.doc.querySelector('[data-close="shell-workshop-dialog"]').click();
  const { checkpoint, earned } = await completeOrdinary(f);
  assert.deepEqual(requests, [], 'A normal win does not silently opt into automatic collection.');
  assert.equal(page.storage.getItem(SETTINGS), null);
  openKeep(page);
  await settle(() => page.$('demo-keep-status').textContent.includes('kept for demos'));
  assert.equal(page.$('demo-collect').checked, false);
  assert.equal(page.storage.getItem(SETTINGS), null, 'Manual Keep does not change the preference.');
  assertRetained(await readCache(database), checkpoint);
  assert.deepEqual(loadLibrary(page.storage, PROFILE).library, earned);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.equal(page.storage.getItem(SESSION), null);
  assert.deepEqual(page.errors, []);
});

test('mounted ordinary restored win is retained automatically only after the real Settings opt-in', async (t) => {
  const f = await mountedFlight(t),
    { page, database, requests } = f;
  setCollection(page, true);
  assert.deepEqual(
    requests,
    [],
    'Enabling collection does not create a cache before an eligible win.',
  );
  const { checkpoint, earned } = await completeOrdinary(f);
  await settle(() => database.allPuts.length === 1);
  assertRetained(await readCache(database), checkpoint);
  assert.equal(page.$('demo-keep-status').textContent, '', 'No manual Keep action was used.');
  assert.equal(JSON.parse(page.storage.getItem(SETTINGS)).collect, true);
  page.$('shell-menu').click();
  setCollection(page, false);
  assertRetained(await readCache(database), checkpoint);
  assert.deepEqual(loadLibrary(page.storage, PROFILE).library, earned);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.equal(page.storage.getItem(SESSION), null);
  assert.deepEqual(page.errors, []);
});

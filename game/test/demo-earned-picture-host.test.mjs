import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createExecutionCatalog } from '../campaign-contexts.mjs';
import { createRun, FIXED_DT, getSummary, releaseInputs, stepRun } from '../core/index.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import {
  campaignKey,
  emptyLibrary,
  loadLibrary,
  recordLibraryCompletion,
  saveLibrary,
  updatePreferences,
} from '../library.mjs';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { createMediaIdentityCatalog } from '../media-library.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { PRESENTATION_PINS_FORMAT, snapshotPresentationPins } from '../presentation-pins.mjs';
import { authoritativeCheckpoint, createRecorder, recordInput, verifyReplay } from '../replay.mjs';
import { saveSession, suspendSession } from '../sessions.mjs';
import { demoPage, demoKey } from './helpers/demo-host-fixture.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { memoryStorage, settle } from './helpers/solo-dom.mjs';

const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const campaign = await json('../content/campaign.json');
campaign.classRecipes = await json('../content/classes.json');
const themes = await json('../content/themes.json');
const catalog = createExecutionCatalog([
    { campaign, classRecipes: campaign.classRecipes, themes: themes.themes, sourcePackId: null },
  ]),
  identityCatalog = createMediaIdentityCatalog(catalog),
  PROFILE = 'revealline.library.dev.v1',
  SESSION = 'revealline.suspended.dev.v1';

async function winningRecording() {
  for (const suffix of ['', '.chromium-macos']) {
    const replay = await json(`../demo-data/first-signal-left${suffix}.replay.json`),
      verified = verifyReplay(replay);
    if (!verified.match) continue;
    assert.equal(verified.state.status, 'won');
    assert.equal(verified.state.lives, 3);
    assert.deepEqual(
      verified.state.level,
      applyGameplayTuning(campaign.levels[0], resolveGameplayTuning('standard')),
      'The frozen win belongs to the actual installed Standard level and current tuning.',
    );
    return { replay, verified };
  }
  assert.fail('A frozen First Signal replay must strictly verify on this runtime.');
}

function pendingSave(replay) {
  const run = createRun(replay.level, replay.options),
    recorder = createRecorder(replay.level, replay.options);
  assert.equal(replay.segments[0].releaseBefore, false);
  for (let tick = 0; tick < 49; tick++) {
    const input = replay.segments[0].input;
    stepRun(run, input, FIXED_DT);
    recordInput(recorder, input);
  }
  assert.equal(run.status, 'running');
  return suspendSession({
    run,
    recorder,
    campaignKey: campaignKey(campaign),
    themeId: 'fpv',
    bodyId: 'fpv-body',
    runId: 'earned-picture-unfinished-ordinary-flight',
    savedAt: '2026-09-29T12:00:00.000Z',
    continuation: { direction: null },
  });
}

async function mediaMetadata(database) {
  const manager = createManagedMediaStore({
      indexedDB: database.indexedDB,
      soundtrackCatalogue: true,
    }),
    store = createStillMediaStore({ managedStore: manager });
  try {
    return await store.readMetadata();
  } finally {
    store.close();
    manager.close();
  }
}

const stored = (page) => [...page.storage.map];
const frames = (page, count, ms = 100) => {
  for (let index = 0; index < count; index++) page.frame(ms);
};

test('mounted demo uses an earned release original without a durable assignment and never earns practice rewards', async (t) => {
  const database = managedIndexedDB(),
    { replay, verified } = await winningRecording(),
    saved = pendingSave(replay);
  assert.equal(verifyReplay(saved.replay).match, true);
  let pin;
  // The real host downloads and verifies its real release PNG. Only the DOM,
  // browser image decoder and IndexedDB transaction/storage boundary are modeled.
  await t.test('ordinary Ready materializes the release still without an assignment', async (t) => {
    const page = await demoPage(t, { soundtrackIndexedDB: database.indexedDB });
    pin = page.rendered.backdrop?.pin;
    assert.equal(pin?.kind, 'still');
    assert.equal(pin.identity.levelId, 'signal-01');
    assert.equal(pin.identity.themeId, 'fpv');
    const metadata = await mediaMetadata(database);
    assert.deepEqual(metadata.document.library.assignments, []);
    assert.ok(
      metadata.document.library.presentations.some((item) => item.id === pin.presentationId),
    );
    assert.deepEqual(page.errors, []);
  });
  assert.ok(pin, 'The setup must retain the real ordinary picture choice.');
  const pins = snapshotPresentationPins({
      format: PRESENTATION_PINS_FORMAT,
      executionKey: campaignKey(campaign),
      levelId: campaign.levels[0].id,
      levelRevision: campaign.levels[0].revision,
      choices: [pin],
    }),
    result = getSummary(verified.state);
  // Match the ordinary award boundary: after exact tuning reconstruction above,
  // project only its revision back to the authored level. The win is simulated.
  result.revision = campaign.levels[0].revision;
  const earned = recordLibraryCompletion(emptyLibrary(), {
    campaign,
    result,
    runId: 'verified-first-signal-earned-picture',
    themeId: 'fpv',
    bodyId: 'fpv-body',
    completedAt: '2026-09-29T12:01:00.000Z',
    presentationPins: pins,
    mediaIdentityCatalog: identityCatalog,
  });
  assert.equal(earned.gallery.length, 1);
  assert.deepEqual(earned.pictureReceipts[0].presentationPin, pin);

  for (const difficulty of ['standard', 'gentle'])
    await t.test(
      `${difficulty} host: earned original stays clear during takeover and completed playback`,
      async (t) => {
        const storage = memoryStorage();
        assert.equal(
          saveLibrary(
            storage,
            PROFILE,
            updatePreferences(earned, { campaignDifficulty: difficulty }),
          ).ok,
          true,
        );
        assert.equal(saveSession(storage, SESSION, saved).ok, true);
        const page = await demoPage(t, { storage, soundtrackIndexedDB: database.indexedDB }),
          ordinary = page.rendered.run,
          checkpoint = authoritativeCheckpoint(ordinary),
          before = stored(page);
        await page.open();
        assert.equal(page.demoFrame.options.pictureVisibility, 'clear');
        assert.deepEqual(page.demoFrame.options.backdrop.pin, pin);
        assert.equal(page.demoFrame.options.fullReveal, false);
        frames(page, 8);
        page.$('demo-interrupt').click();
        page.frame(0);
        const recording = page.demoFrame.run,
          recordedCheckpoint = authoritativeCheckpoint(recording),
          recordedTick = recording.tick,
          neutralPractice = structuredClone(recording);
        // Practice adopts the exact board and explicitly releases inherited input.
        releaseInputs(neutralPractice);
        page.$('demo-takeover').click();
        await settle(() => !page.$('demo-practice-controls').hidden);
        page.frame(0);
        assert.notEqual(page.demoFrame.run, recording);
        assert.deepEqual(
          authoritativeCheckpoint(page.demoFrame.run),
          authoritativeCheckpoint(neutralPractice),
        );
        assert.equal(page.demoFrame.options.pictureVisibility, 'clear');
        assert.deepEqual(page.demoFrame.options.backdrop.pin, pin);
        demoKey(page, 'ArrowDown');
        demoKey(page, 'ArrowDown', false);
        frames(page, 2);
        assert.ok(page.demoFrame.run.tick > recordedTick);
        assert.deepEqual(authoritativeCheckpoint(recording), recordedCheckpoint);
        page.$('demo-return').click();
        page.frame(0);
        for (let index = 0; index < 260 && page.demoFrame.run.status !== 'won'; index++)
          page.frame(250);
        assert.equal(
          page.demoFrame.run.status,
          'won',
          'The real recorded inputs finish their win.',
        );
        assert.equal(page.demoFrame.options.fullReveal, true);
        assert.equal(page.demoFrame.options.pictureVisibility, 'clear');
        assert.deepEqual(page.demoFrame.options.backdrop.pin, pin);
        page.$('demo-back').click();
        page.frame(0);
        assert.deepEqual(authoritativeCheckpoint(ordinary), checkpoint);
        assert.deepEqual(
          stored(page),
          before,
          'Demo and practice do not alter profile or saved flight.',
        );
        assert.equal(loadLibrary(storage, PROFILE).library.gallery.length, 1);
        assert.deepEqual(page.errors, []);
      },
    );

  await t.test(
    'another unearned level stays obscured in fresh practice despite the existing receipt',
    async (t) => {
      const storage = memoryStorage();
      assert.equal(saveLibrary(storage, PROFILE, earned).ok, true);
      assert.equal(saveSession(storage, SESSION, saved).ok, true);
      const page = await demoPage(t, {
          clipId: 'crosswind-openings',
          storage,
          soundtrackIndexedDB: database.indexedDB,
        }),
        ordinary = page.rendered.run,
        checkpoint = authoritativeCheckpoint(ordinary),
        before = stored(page);
      await page.open();
      assert.equal(page.demoFrame.run.levelId, 'signal-03');
      assert.equal(page.demoFrame.options.pictureVisibility, 'blurred');
      page.$('demo-interrupt').click();
      page.$('demo-fresh').click();
      await settle(() => !page.$('demo-practice-controls').hidden);
      page.frame(0);
      assert.equal(page.demoFrame.run.tick, 0);
      assert.equal(page.demoFrame.run.levelId, 'signal-03');
      assert.equal(page.demoFrame.options.pictureVisibility, 'blurred');
      demoKey(page, 'ArrowDown');
      demoKey(page, 'ArrowDown', false);
      frames(page, 2);
      assert.ok(page.demoFrame.run.tick > 0);
      page.$('demo-back').click();
      page.frame(0);
      assert.deepEqual(authoritativeCheckpoint(ordinary), checkpoint);
      assert.deepEqual(stored(page), before);
      assert.deepEqual(page.errors, []);
    },
  );
  assert.deepEqual((await mediaMetadata(database)).document.library.assignments, []);
});

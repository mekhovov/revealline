import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { soloPage, SoloElement, settle, memoryStorage } from './helpers/solo-dom.mjs';
import { activateHostAction } from './helpers/host-action.mjs';
import { memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';
import {
  emptyPackLibrary,
  installPack,
  preparePack,
  exportPackLibrary,
  resolvePackCampaign,
} from '../packs.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { createRecorder, recordInput, authoritativeCheckpoint } from '../replay.mjs';
import { suspendSession, saveSession } from '../sessions.mjs';
import { campaignKey, emptyLibrary, exportLibrary, importLibrary } from '../library.mjs';

// Node host correctness only: fake DOM/Canvas time is not native performance.
// The reward is earned by the shipped legal route. Only the real verifier's
// cooperative timer is held; no run status, award, progress or verifier result
// is replaced. An outer serial runner supplies a 600-second/4-GiB group bound.
const PACKS = 'revealline.packs.dev.v1';
const PROFILE = 'revealline.library.dev.v1';
const SESSION = 'revealline.suspended.dev.v1';
const read = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url)));
const source = await read('../content/packs/homeward-skies.json');
// As in backup-pending-mastery-host, this case excludes optional artwork. The
// complete shipped gameplay, roster, mastery rule and route stay unchanged.
source.visualOverrides = {};
source.levelVisuals = [];
const pack = (await preparePack(source)).pack;
const route = (await read('../replays/homeward-routes.json')).routes.find(
  (value) => value.id === 'homeward-01/immediate/specialty/fiber',
);
const packBytes = exportPackLibrary(installPack(emptyPackLibrary(), pack));
const RUN_ID = 'pending-overlap-historical-homeward';

function historicalFlight() {
  // Fresh tuned flights intentionally do not award historical mastery. A valid
  // untuned save is a supported public restore path and reconstructs eligibility
  // from its actual inputs; it does not inject an observer or earned outcome.
  const { campaign } = resolvePackCampaign(pack, pack.campaigns[0].id);
  const level = campaign.levels.find((value) => value.id === route.levelId);
  const options = {
    seed: route.seed,
    classId: route.classId,
    turnPolicy: route.turnPolicy,
    classRecipes: campaign.classRecipes,
  };
  const run = createRun(level, options);
  const recorder = createRecorder(level, options);
  for (let tick = 0; tick < 180; tick++) {
    stepRun(run, route.segments[0].input, FIXED_DT);
    recordInput(recorder, route.segments[0].input);
  }
  assert.equal(run.status, 'running');
  assert(run.trail.length > 0);
  return suspendSession({
    run,
    recorder,
    campaignKey: campaignKey(campaign),
    themeId: 'fpv',
    bodyId: 'fpv-body',
    runId: RUN_ID,
    savedAt: '2026-10-16T09:00:00.000Z',
  });
}

async function seed(memory) {
  const db = await new Promise((resolve, reject) => {
    const request = memory.indexedDB.open('revealline-assets-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('assets');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction('assets', 'readwrite');
      transaction.objectStore('assets').put(packBytes, PACKS);
      transaction.oncomplete = resolve;
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

function holdVerifier(t) {
  const nativeTimer = globalThis.setTimeout;
  const held = [];
  let holding = true,
    admitted = 0;
  globalThis.setTimeout = function (callback, delay, ...args) {
    if (holding && delay === 0 && new Error().stack.includes('/replay.mjs:')) {
      admitted++;
      held.push(() => callback(...args));
      return { unref() {} };
    }
    return nativeTimer(callback, delay, ...args);
  };
  const release = () => {
    holding = false;
    for (const callback of held.splice(0)) callback();
  };
  t.after(() => {
    globalThis.setTimeout = nativeTimer;
    release();
  });
  return {
    get pending() {
      return held.length;
    },
    get admitted() {
      return admitted;
    },
    step() {
      assert.equal(held.length, 1, 'Only the one real earned-run verifier may be held.');
      held.shift()();
    },
    release,
  };
}

function finishLegalRoute(page, savedTicks) {
  let direction = null,
    freshGesture = true;
  const tick = () => {
    if (freshGesture) {
      page.key(direction, false);
      page.key('ShiftLeft', false);
      page.key(direction);
      page.key('ShiftLeft');
      freshGesture = false;
    }
    page.frame();
    if (page.rendered.run.events.some((event) => event.type === 'capture.stopped'))
      freshGesture = true;
  };
  let prefix = savedTicks;
  for (const segment of route.segments) {
    const consumed = Math.min(prefix, segment.ticks);
    prefix -= consumed;
    if (consumed === segment.ticks) continue;
    if (direction) page.key(direction, false);
    direction =
      'Arrow' + segment.input.direction[0].toUpperCase() + segment.input.direction.slice(1);
    freshGesture = true;
    for (let n = consumed; n < segment.ticks && page.rendered.run.status !== 'won'; n++) tick();
  }
  // Public Resume suppresses boost on its first simulation tick. Preserve the
  // existing bounded legal continuation, not a mutated checkpoint or fake win.
  for (let n = 0; n < 120 && page.rendered.run.status !== 'won'; n++) tick();
  page.key(direction, false);
  page.key('ShiftLeft', false);
  page.frame(0);
  assert.equal(page.rendered.run.status, 'won');
  assert.equal(page.rendered.run.lives, route.expected.lives);
}

for (const action of ['next', 'retry']) {
  test(
    `a real pending earned verifier crosses public ${action} and commits only its original reward during new gameplay`,
    { timeout: 180000 },
    async (t) => {
      const show = SoloElement.prototype.showModal;
      t.mock.method(SoloElement.prototype, 'showModal', function () {
        if (this.open) return;
        this.emit('beforetoggle', { oldState: 'closed', newState: 'open', bubbles: false });
        show.call(this);
      });
      const memory = memoryIndexedDB();
      await seed(memory);
      const saved = historicalFlight();
      const storage = memoryStorage({ [PROFILE]: exportLibrary(emptyLibrary()) });
      assert.equal(saveSession(storage, SESSION, saved).ok, true);
      const page = await soloPage(t, {
        titleScreen: true,
        assetIndexedDB: memory.indexedDB,
        storage,
      });
      Object.assign(page.win, page.doc.defaultView);
      page.doc.defaultView = page.win;
      await activateHostAction(page.$('shell-continue'));
      await settle(() => page.doc.body.dataset.flightState === 'running');
      page.frame(0);
      assert.deepEqual(authoritativeCheckpoint(page.rendered.run), saved.replay.checkpoint);

      const verifier = holdVerifier(t);
      finishLegalRoute(page, saved.replay.ticks);
      const completedRun = page.rendered.run;
      const completedCheckpoint = authoritativeCheckpoint(completedRun);
      assert.equal(
        verifier.pending,
        1,
        'Verification must actually remain unfinished at its real host yield.',
      );
      assert.match(page.$('mastery-overlay').textContent, /Checking/);
      const earned = importLibrary(storage.getItem(PROFILE));
      assert.equal(earned.masteries.length, 0);
      assert.equal(
        earned.gallery.length,
        1,
        'The ordinary picture reward precedes optional verification.',
      );

      // Submit the ordinary terminal animation until its real public result
      // control appears. The won simulation and pending verifier stay unchanged.
      for (let frame = 0; frame < 240 && page.$('show-result').hidden; frame++)
        page.frame(1000 / 60);
      assert.equal(page.$('show-result').hidden, false);
      await activateHostAction(page.$('show-result'));
      assert.equal(page.$('game-overlay').dataset.kind, 'won');
      const beforeActivation = performance.now();
      await activateHostAction(page.$(`${action}-button`));
      await settle(
        () => page.rendered.run !== completedRun && page.doc.body.dataset.flightState === 'running',
      );
      page.frame(0);
      const active = page.rendered.run;
      assert.equal(active.status, 'running');
      assert.equal(
        active.tick,
        0,
        'Preparation submits zero-time frames before the new clock advances.',
      );
      assert.equal(active.levelId === completedRun.levelId, action === 'retry');
      assert.equal(
        verifier.pending,
        1,
        'The new flight must start before the pending reward is released.',
      );
      assert.equal(importLibrary(storage.getItem(PROFILE)).masteries.length, 0);

      const reference = structuredClone(active);
      const advance = () => {
        page.key('ArrowRight');
        page.frame(4 * FIXED_DT * 1000);
        for (let n = 0; n < 4; n++) stepRun(reference, { direction: 'right' }, FIXED_DT);
        assert.equal(page.rendered.run === active, true);
        assert.equal(active.status, 'running');
        assert.deepEqual(authoritativeCheckpoint(active), authoritativeCheckpoint(reference));
      };
      for (let n = 0; n < 15; n++) advance();
      assert.equal(active.tick, 60);
      const priorAdmitted = verifier.admitted;
      verifier.step();
      await settle(() => verifier.admitted > priorAdmitted && verifier.pending === 1);
      assert.equal(
        importLibrary(storage.getItem(PROFILE)).masteries.length,
        0,
        'A real verification chunk ran after new gameplay began, and still has work left.',
      );
      for (let n = 0; n < 15; n++) advance();
      assert.equal(active.tick, 120);
      assert.deepEqual(authoritativeCheckpoint(completedRun), completedCheckpoint);

      verifier.release();
      await settle(() => {
        advance();
        return importLibrary(storage.getItem(PROFILE)).masteries.length === 1;
      }, 'The original earned seal must finish and persist while the next flight can step.');
      const committed = importLibrary(storage.getItem(PROFILE));
      assert.equal(committed.masteries[0].runId, RUN_ID);
      assert.equal(committed.masteries[0].levelId, completedRun.levelId);
      assert.deepEqual(
        committed.gallery,
        earned.gallery,
        'No second completion or reward may be fabricated.',
      );
      assert.equal(page.rendered.run === active, true);
      assert.equal(page.doc.body.dataset.flightState, 'running');
      assert.equal(page.$('game-overlay').hidden, true);
      assert.equal(page.$('journey-best').hidden, true);
      assert.doesNotMatch(
        page.$('mastery-announcement').textContent,
        /earned and saved/,
        "The old result must not announce itself as the new attempt's award.",
      );
      assert.deepEqual(authoritativeCheckpoint(active), authoritativeCheckpoint(reference));
      assert.deepEqual(authoritativeCheckpoint(completedRun), completedCheckpoint);
      page.key('ArrowRight', false);
      assert.equal(
        page.errors.length,
        0,
        page.errors.map((error) => String(error).slice(0, 512)).join('\n'),
      );
      t.diagnostic(
        JSON.stringify({
          scope: 'node-host-correctness-only-not-native-timing',
          action,
          completedTicks: completedRun.tick,
          newFlightTicksWhileVerifierPending: 120,
          newFlightTicksAtDurableReward: active.tick,
          heldVerifierYields: verifier.admitted,
          activationThroughRewardElapsedMs: performance.now() - beforeActivation,
          memoryUsage: process.memoryUsage(),
        }),
      );
    },
  );
}

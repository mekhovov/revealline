import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { combatView } from '../ui/combat-view.mjs';
import { combatLevel } from './helpers/combat-fixture.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';

const solo = readFileSync(new URL('../app.mjs', import.meta.url), 'utf8');
const theater = readFileSync(new URL('../replay-theater/app.mjs', import.meta.url), 'utf8');
function section(source, start, end) {
  const from = source.indexOf(start);
  const until = source.indexOf(end, from + start.length);
  assert(from >= 0 && until > from, `Missing host boundary ${start}`);
  return source.slice(from, until);
}
function controls() {
  const nodes = new Map();
  const document = { hidden: false, hasFocus: () => true, activeElement: null };
  const $ = (id) => {
    if (!nodes.has(id))
      nodes.set(id, {
        hidden: false,
        disabled: false,
        checked: false,
        value: '',
        textContent: '',
        focus() {
          document.activeElement = this;
        },
        scrollIntoView() {},
        addEventListener(kind, action) {
          this[kind] = action;
        },
      });
    return nodes.get(id);
  };
  return { document, $ };
}
function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** Actual result-operation functions, with preparation held at their async
 * boundary. Selection and ownership checks execute, not text-match assertions. */
function attemptFixture(overrides = {}) {
  const ui = controls();
  const theme = { id: 'test' };
  const edition = (id) => ({
    executionKey: id,
    difficulty: 'standard',
    themes: [theme],
    classRecipes: [{ id: 'scout' }],
    campaign: {
      id,
      levels: [
        { id: 'one', name: 'One' },
        { id: 'two', name: 'Two' },
      ],
    },
  });
  const active = edition('combat-on');
  const next = edition('combat-off');
  const gate = deferred();
  const requests = [];
  let selects = 0,
    cancelled = 0,
    taken = 0;
  const context = {
    ...ui,
    AbortController,
    DOMException,
    resultAttempt: null,
    resultAttemptEpoch: 0,
    practice: false,
    scenario: null,
    courseSession: false,
    courseEntry: null,
    courseBlocked: () => false,
    dialogOpen: () => false,
    modeDeparture: null,
    missionReplacement: null,
    restartRequest: null,
    contentSwitchBusy: false,
    backupBusy: false,
    sessionBusy: false,
    pictureThemePending: false,
    run: { status: 'running' },
    recorder: {},
    runId: 'existing-run',
    flightPictures: {},
    activeEntry: active,
    campaign: active.campaign,
    levelIndex: 0,
    theme,
    seed: 17,
    turnPolicy: 'immediate',
    classId: 'scout',
    themeOverride: null,
    library: { preferences: { campaignDifficulty: 'standard' } },
    journeyPreferences: { snapshot: () => ({ revision: 2, difficulty: 'standard' }) },
    combatSnapshot: { mode: 'off', gameplayRevision: 3, showScrap: true, revision: 4 },
    combatPreferences: { snapshot: () => context.combatSnapshot },
    libraryGeneration: 0,
    libraryKey: 'library',
    sessionKey: 'saved',
    localStorage: { getItem: () => null },
    packs: {},
    writer: { writable: true },
    persistenceReady: true,
    combatStudy: true,
    journeyEnabled: true,
    paused: true,
    journeyMission: () => ({ id: 'route/one' }),
    beginPreparation: () => ({ update() {}, finish() {} }),
    executionForEntry() {
      throw new Error('Combat ownership must not fall through to Legacy.');
    },
    candidateHost: {
      owns: (entry) => [active, next].includes(entry),
      select() {
        selects++;
        return next;
      },
      mission: (_entry, index) => ({ id: `route/${index === 0 ? 'one' : 'two'}` }),
      preparer: {
        prepare(request) {
          requests.push(request);
          return gate.promise;
        },
        current: () => true,
        cancel() {
          cancelled++;
        },
        take() {
          taken++;
          throw new Error('Test preparation must be invalidated before adoption.');
        },
      },
    },
    ...overrides,
  };
  const api = runInNewContext(
    section(solo, '  function resultAttemptCurrent(', '  function prepare({') +
      '\n({ prepareResultAttempt, resultAttemptCurrent, cancelResultAttempt });',
    context,
  );
  return {
    ...api,
    context,
    active,
    next,
    requests,
    selects: () => selects,
    cancelled: () => cancelled,
    taken: () => taken,
    async cancel(operation) {
      api.cancelResultAttempt();
      gate.resolve({});
      await operation;
    },
    release: gate.resolve,
  };
}

test('actual Solo restart preparation requires the combat study and a paused existing run', async () => {
  for (const patch of [
    { combatStudy: false },
    { paused: false },
    { run: null },
    { practice: true },
  ]) {
    const f = attemptFixture(patch);
    await f.prepareResultAttempt('restart');
    assert.equal(f.requests.length, 0);
    assert.equal(f.context.resultAttempt, null);
  }
  const f = attemptFixture();
  const operation = f.prepareResultAttempt('restart');
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].executionKey, 'combat-off');
  assert.equal(f.context.resultAttempt.combatRevision, 3);
  await f.cancel(operation);
});

test('recovery pins the active execution while explicit retry and Next select pending intent', async () => {
  for (const [kind, status, index, key, selections] of [
    ['recover', 'lost', 0, 'combat-on', 0],
    ['retry', 'lost', 0, 'combat-off', 1],
    ['next', 'won', 1, 'combat-off', 1],
  ]) {
    const f = attemptFixture({ run: { status } });
    const operation = f.prepareResultAttempt(kind, index);
    assert.equal(f.requests.length, 1, kind);
    assert.equal(f.requests[0].executionKey, key, kind);
    assert.equal(f.requests[0].missionId, `route/${index ? 'two' : 'one'}`, kind);
    assert.equal(f.requests[0].seed, 17, kind);
    assert.equal(f.selects(), selections, kind);
    assert.equal(f.context.activeEntry, f.active);
    await f.cancel(operation);
  }
});

test('actual result ownership ignores scrap-only edits but rejects a stale combat intent before take', async () => {
  const f = attemptFixture();
  const before = f.context.run;
  const operation = f.prepareResultAttempt('restart');
  const ticket = f.context.resultAttempt;
  assert(f.resultAttemptCurrent(ticket));
  f.context.combatSnapshot = { ...f.context.combatSnapshot, showScrap: false, revision: 5 };
  assert(f.resultAttemptCurrent(ticket), 'Cosmetic preference cannot cancel a pinned attempt.');
  f.context.combatSnapshot = { ...f.context.combatSnapshot, mode: 'on', gameplayRevision: 4 };
  assert.equal(f.resultAttemptCurrent(ticket), false);
  f.release({});
  await operation;
  assert.equal(f.taken(), 0);
  assert.equal(f.cancelled(), 1);
  assert.equal(f.context.run, before);
  assert.equal(f.context.activeEntry, f.active);
});

test('unrelated Journey preparations ignore cross-tab combat intent changes', async () => {
  const f = attemptFixture({ combatStudy: false, run: { status: 'won' } });
  const operation = f.prepareResultAttempt('next', 1);
  const ticket = f.context.resultAttempt;
  assert.equal(f.requests[0].executionKey, undefined);
  f.context.combatSnapshot = { ...f.context.combatSnapshot, mode: 'on', gameplayRevision: 4 };
  assert(
    f.resultAttemptCurrent(ticket),
    'Optional robot intent cannot invalidate an unrelated mission.',
  );
  await f.cancel(operation);
});

test('post-adoption combat revision checks are scoped to the combat study', async () => {
  for (const combatStudy of [false, true]) {
    const f = attemptFixture({ combatStudy, run: { status: 'won' } });
    let resumes = 0;
    const pictures = { async ensure() {}, dispose() {} };
    Object.assign(f.context, {
      crypto: { randomUUID: () => 'next-run' },
      newFlightPictures: () => pictures,
      activateAudio: async () => {},
      started: true,
      resume() {
        resumes++;
        f.context.paused = false;
      },
      prepare({ preparedAttempt: attempt }) {
        assert(f.resultAttemptCurrent(attempt.ticket));
        // Model adoption's explicit state handoff. A synchronous callback
        // changes the preference after preparation, before the resume guard.
        Object.assign(f.context, {
          run: attempt.run,
          runId: attempt.runId,
          recorder: attempt.recorder,
          flightPictures: pictures,
          activeEntry: attempt.entry,
          campaign: attempt.entry.campaign,
          levelIndex: attempt.levelIndex,
          theme: attempt.theme,
          classId: attempt.classId,
          resultAttempt: null,
          combatSnapshot: { ...f.context.combatSnapshot, gameplayRevision: 4 },
        });
        attempt.ticket.adoptionEpoch = ++f.context.resultAttemptEpoch;
        return true;
      },
    });
    f.context.candidateHost.preparer.take = () => {};
    const operation = f.prepareResultAttempt('next', 1);
    f.release({ run: { status: 'running' }, recorder: {}, picture: {} });
    await operation;
    assert.equal(f.context.activeEntry, f.next);
    assert.equal(resumes, combatStudy ? 0 : 1);
    assert.equal(f.context.paused, combatStudy);
  }
});

test('automatic defeat recovery pins editions only for the combat study', () => {
  for (const combatStudy of [false, true]) {
    const requests = [];
    const context = {
      combatStudy,
      defeatActive: true,
      defeatPaused: false,
      defeatRemaining: 1,
      journeyEnabled: true,
      journeyMission: () => ({ id: 'one' }),
      practice: false,
      scenario: null,
      clearInput() {},
      show() {},
      overlay() {},
      warning() {},
      prepareResultAttempt: (kind) => requests.push(kind),
    };
    runInNewContext(
      section(solo, '  function finishDefeatPresentation()', '  function defeatEffectsRunning()') +
        '\nfinishDefeatPresentation(); finishDefeatPresentation();',
      context,
    );
    assert.deepEqual(requests, [combatStudy ? 'recover' : 'retry']);
    assert.equal(context.defeatActive, false);
  }
});

test('actual preference subscription cancels prospective replacements, never Continue restoration', () => {
  const ui = controls();
  let listener,
    cancelled = 0,
    restoresCancelled = 0;
  const checkpoint = { id: 'current checkpoint' };
  const context = {
    ...ui,
    combatStudy: true,
    combatPreferences: {
      snapshot: () => ({ gameplayRevision: 0 }),
      subscribe(next) {
        listener = next;
      },
    },
    show() {},
    journeyChooser: { refresh() {} },
    cancelResultAttempt: () => cancelled++,
    cancelRestore: () => restoresCancelled++,
    restoreController: new AbortController(),
    run: checkpoint,
  };
  runInNewContext(
    section(solo, "  show('combat-preferences', combatStudy);", "  $('combat-mode').onchange"),
    context,
  );
  listener({ gameplayRevision: 0, mode: 'authored', showScrap: true, durable: true, error: '' });
  assert.equal(cancelled, 0);
  listener({ gameplayRevision: 1, mode: 'off', showScrap: true, durable: true, error: '' });
  assert.equal(cancelled, 1);
  listener({ gameplayRevision: 1, mode: 'off', showScrap: false, durable: true, error: '' });
  assert.equal(cancelled, 1);
  assert.equal(restoresCancelled, 0);
  assert.equal(context.restoreController.signal.aborted, false);
  assert.equal(context.run, checkpoint);
});

function sceneFixture() {
  const ui = controls();
  const warnings = [];
  const updates = [];
  let draws = 0,
    cancellations = 0;
  const context = {
    ...ui,
    Phaser: { Scene: class {} },
    clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
    run: createRun(combatLevel()),
    presentationFailureRun: null,
    paused: false,
    combatView,
    update(dt) {
      updates.push(dt);
    },
    boardPaintSizeForRun: () => ({ width: 1152, height: 576 }),
    painter: { draw: () => draws++ },
    displayPreferences: { snapshot: () => ({ textFace: 'pixel', effectiveReducedEffects: true }) },
    combatPreferences: { snapshot: () => ({ showScrap: false }) },
    scenario: null,
    library: { preferences: { showGrid: false } },
    flightPictures: { current: () => null },
    dialogOpen: () => false,
    defeatEffectsRunning: () => false,
    advanceDefeatPresentation() {},
    cancelResultAttempt: () => cancellations++,
    clearInput() {},
    sound: { pause() {} },
    overlay() {},
    warning: (message) => warnings.push(message),
  };
  const Scene = runInNewContext(
    section(solo, '  class FieldScene extends Phaser.Scene', '  new Phaser.Game(') +
      '\nFieldScene;',
    context,
  );
  const scene = new Scene();
  scene.boardSize = { width: 1152, height: 576 };
  scene.boardTexture = { context: {} };
  scene.game = { canvas: { clientWidth: 1152 } };
  return {
    context,
    scene,
    updates,
    warnings,
    draws: () => draws,
    cancellations: () => cancellations,
  };
}

test('actual Solo scene rejects malformed active threats before update and keeps menu ticks alive', () => {
  const f = sceneFixture();
  f.context.run.classic.combatPatrols.actors[0].x = NaN;
  const tick = f.context.run.tick;
  f.scene.update(100, 16);
  assert.deepEqual(f.updates, [], 'Presentation validation precedes the simulation update.');
  assert.equal(f.draws(), 0);
  assert.equal(f.context.presentationFailureRun, f.context.run);
  assert.equal(f.context.paused, true);
  assert.equal(f.cancellations(), 1);
  assert.equal(f.context.$('combat-presentation-error').hidden, false);
  f.scene.update(116, 16);
  f.scene.update(132, 16);
  assert.deepEqual(f.updates, [0, 0], 'Controller/menu service continues with no elapsed time.');
  assert.equal(f.context.run.tick, tick);
  assert.equal(f.cancellations(), 1);
});

test('actual Solo scene latches painter failure and a fresh run can draw again', () => {
  const f = sceneFixture();
  f.context.painter.draw = () => {
    throw new Error('Fault-injected renderer failure');
  };
  f.scene.update(100, 16);
  assert.equal(f.context.presentationFailureRun, f.context.run);
  assert.deepEqual(f.updates, [0.016]);
  f.scene.update(116, 16);
  assert.deepEqual(f.updates, [0.016, 0]);
  let painted = 0;
  f.context.painter.draw = () => painted++;
  f.context.run = createRun(combatLevel());
  f.scene.update(132, 16);
  assert.equal(painted, 1);
  assert.equal(f.warnings.length, 1);
});

function replayFixture() {
  const ui = controls();
  let navigationOptions;
  let steps = 0,
    plays = 0,
    sampled = 0,
    draws = 0;
  const player = () => ({
    state: createRun(combatLevel()),
    info: { seed: 1 },
    phase: 'paused',
    play() {
      plays++;
      this.phase = 'playing';
      return [];
    },
    pause() {
      this.phase = 'paused';
      return [];
    },
    step() {
      steps++;
      stepRun(this.state, { direction: null }, FIXED_DT);
      return [];
    },
    advance() {
      return this.step();
    },
    reset() {
      this.state = createRun(combatLevel());
      this.phase = 'paused';
    },
  });
  const context = {
    ...ui,
    player: player(),
    presentationFailurePlayer: null,
    presentationFailureMessage: '',
    pending: false,
    disposed: false,
    lastFrame: 0,
    frameId: 0,
    eventLines: [],
    combatView,
    clipped: (value) => value,
    consume() {
      api.updateControls();
    },
    readouts() {},
    displayEvents() {},
    painter: { draw: () => draws++, setLevel() {}, setLook() {} },
    chosenTheme: () => ({ id: 'another-theme' }),
    bodyFor: () => ({ id: 'test-body' }),
    cancelLoad() {},
    attachReplayNavigation(options) {
      navigationOptions = options;
      return { sample: () => sampled++ };
    },
    replayDisplay: { snapshot: () => ({}) },
    combatPreferences: { snapshot: () => ({ showScrap: false }) },
    requestAnimationFrame: () => 1,
    context: {},
  };
  const api = runInNewContext(
    section(theater, '  function updateControls()', '  function readouts()') +
      section(theater, '  function togglePlay()', "  $('load-example').addEventListener") +
      section(theater, "  $('restart').addEventListener", "  $('speed').addEventListener") +
      section(theater, "  $('theme').addEventListener", '  onNativeInactive(navigation.suspend)') +
      section(theater, '  function frame(now)', '  exampleBrief();') +
      '\n({ updateControls, togglePlay, safely, step, frame });',
    context,
  );
  return {
    ...api,
    context,
    counts: () => ({ steps, plays, sampled, draws }),
    inactive: () => navigationOptions.onInactive(),
    loadAnother: () => (context.player = player()),
  };
}

test('actual replay controls block Play and Step after invalid combat until Restart or new load', () => {
  const f = replayFixture();
  f.context.player.state.classic.combatPatrols.actors[0].x = NaN;
  f.safely(f.step);
  assert.equal(f.counts().steps, 0);
  assert.equal(f.context.presentationFailurePlayer, f.context.player);
  assert.equal(f.context.$('play-pause').disabled, true);
  assert.equal(f.context.$('step').disabled, true);
  assert.equal(f.context.$('restart').disabled, false);
  f.safely(f.togglePlay);
  f.safely(f.step);
  assert.equal(f.counts().plays, 0);
  assert.equal(f.counts().steps, 0);
  f.frame(100);
  assert.equal(f.counts().sampled, 1, 'Replay controller navigation remains available.');
  assert.equal(f.counts().draws, 0);
  f.context.$('restart').click();
  assert.equal(f.context.presentationFailurePlayer, null);
  f.safely(f.step);
  assert.equal(f.counts().steps, 1);
  f.context.presentationFailurePlayer = f.context.player;
  f.loadAnother();
  f.updateControls();
  assert.equal(f.context.$('step').disabled, false);
  f.safely(f.togglePlay);
  assert.equal(f.counts().plays, 1);
});

test('actual replay frame validates before advance and latches rendering faults', () => {
  const f = replayFixture();
  f.context.player.phase = 'playing';
  f.context.player.state.classic.combatPatrols.actors[0].x = NaN;
  f.frame(100);
  assert.equal(f.counts().steps, 0);
  assert.equal(f.context.player.phase, 'paused');
  assert.equal(f.context.presentationFailurePlayer, f.context.player);
  f.context.$('restart').click();
  f.context.painter.draw = () => {
    throw new Error('Broken sprite renderer');
  };
  f.frame(116);
  assert.equal(f.context.presentationFailurePlayer, f.context.player);
  assert.equal(f.context.$('play-pause').disabled, true);
});

test('replay inactivity and theme changes preserve the quarantine diagnostic until Restart', () => {
  for (const failure of ['invalid-combat', 'renderer']) {
    const f = replayFixture();
    if (failure === 'invalid-combat')
      f.context.player.state.classic.combatPatrols.actors[0].x = NaN;
    else
      f.context.painter.draw = () => {
        throw new Error('Fault-injected missing robot sprite');
      };
    f.frame(100);
    const diagnostic = f.context.$('transport-status').textContent;
    assert(diagnostic.length > 0);
    assert.equal(f.context.presentationFailureMessage, diagnostic);
    assert.equal(f.context.presentationFailurePlayer, f.context.player);
    for (const action of [f.inactive, () => f.context.$('theme').change(), f.inactive]) {
      action();
      assert.equal(f.context.$('transport-status').textContent, diagnostic);
      assert.equal(f.context.$('play-pause').disabled, true);
      assert.equal(f.context.$('step').disabled, true);
      assert.equal(f.counts().steps, 0);
    }
    f.context.$('restart').click();
    assert.equal(f.context.presentationFailureMessage, '');
    assert.equal(f.context.presentationFailurePlayer, null);
    assert.notEqual(f.context.$('transport-status').textContent, diagnostic);
    f.inactive();
    assert.notEqual(f.context.$('transport-status').textContent, diagnostic);
    assert.equal(f.context.$('play-pause').disabled, false);
    assert.equal(f.context.$('step').disabled, false);
  }
});

async function livePage(t, { storage: savedStorage } = {}) {
  const { soloPage, settle, memoryStorage } = await import('./helpers/solo-dom.mjs');
  class Picture {
    width = 1774;
    height = 887;
    naturalWidth = 1774;
    naturalHeight = 887;
    set src(value) {
      this.source = value;
      queueMicrotask(() => this.onload?.());
    }
    async decode() {}
    removeAttribute() {
      this.source = '';
    }
  }
  const storage = savedStorage ?? memoryStorage();
  const p = await soloPage(t, {
    search: '?journey=combat-study',
    titleScreen: true,
    storage,
    journeyIndexedDB: managedIndexedDB().indexedDB,
    pictures: { Image: Picture },
    fetchResponse: async (path) => {
      if (String(path).includes('/content-design/assets/'))
        return new Response(await readFile(path));
    },
  });
  return { p, storage, settle };
}

test('actual Solo host keeps checkpoint on pending Off and uses Off for explicit Restart', async (t) => {
  const { p, storage, settle } = await livePage(t);
  p.$('shell-featured').click();
  await settle(() => {
    p.frame(0);
    return p.doc.body.dataset.flightState === 'running';
  });
  p.$('pause-button').click();
  p.frame(0);
  p.$('shell-settings').click();
  p.$('settings-tab-controls').click();
  assert.equal(p.$('settings-dialog').open, true);
  assert.equal(p.$('settings-panel-controls').hidden, false);
  assert(p.$('settings-panel-controls').contains(p.$('combat-mode')));
  assert.equal(p.$('combat-mode').closest('[hidden],[inert],dialog:not([open])'), null);
  const old = p.rendered.run;
  const checkpoint = authoritativeCheckpoint(old);
  const saved = storage.getItem('revealline.suspended.journey-combat-study.v1');
  assert.equal(old.level.classic.combatPatrols.enabled, true);
  p.change('combat-mode', 'off');
  p.frame(0);
  assert.equal(p.rendered.run, old);
  assert.deepEqual(authoritativeCheckpoint(old), checkpoint);
  assert.equal(storage.getItem('revealline.suspended.journey-combat-study.v1'), saved);
  p.doc.querySelector('button[data-close="settings-dialog"]').click();
  // Fault injection exercises the actual update/renderer boundary. Never used
  // to manufacture a gameplay clear or native playability evidence.
  old.classic.combatPatrols.actors[0].x = NaN;
  const failedTick = old.tick;
  p.frame();
  assert.equal(p.$('combat-presentation-error').hidden, false);
  const padReads = p.padReads;
  p.frame();
  p.frame();
  assert.equal(old.tick, failedTick);
  assert(p.padReads > padReads, 'Controller navigation remains serviced after the failure.');
  p.$('overlay-restart').click();
  p.$('restart-confirm').click();
  await settle(() => {
    p.frame(0);
    return p.rendered.run !== old && p.doc.body.dataset.flightState === 'running';
  });
  assert.equal(p.rendered.run.level.classic.combatPatrols.enabled, false);
  assert.equal(p.rendered.run.classic.combatPatrols, undefined);
  assert.deepEqual(p.errors, []);
});

test('reload and ordinary Continue restore the saved On edition while Off stays pending', async (t) => {
  let storage, checkpoint, saved;
  const slot = 'revealline.suspended.journey-combat-study.v1';
  await t.test('save an active authored On attempt and choose next-attempt Off', async (t) => {
    const page = await livePage(t);
    const { p, settle } = page;
    storage = page.storage;
    p.$('shell-featured').click();
    await settle(() => {
      p.frame(0);
      return p.doc.body.dataset.flightState === 'running';
    });
    p.key('ArrowDown');
    for (let i = 0; i < 4; i++) p.frame();
    p.key('ArrowDown', false);
    p.$('pause-button').click();
    p.frame(0);
    checkpoint = authoritativeCheckpoint(p.rendered.run);
    p.$('shell-settings').click();
    p.$('settings-tab-controls').click();
    saved = storage.getItem('revealline.suspended.journey-combat-study.v1');
    assert(saved, 'Pause must own a real suspended checkpoint.');
    p.change('combat-mode', 'off');
    assert.equal(storage.getItem('revealline.suspended.journey-combat-study.v1'), saved);
  });
  await t.test('fresh page resolves On from the save rather than its Off preference', async (t) => {
    const { p, settle } = await livePage(t, { storage });
    assert.equal(p.$('combat-mode').value, 'off');
    assert.equal(p.rendered.run.level.classic.combatPatrols.enabled, false);
    assert.equal(p.$('shell-continue').hidden, false);
    p.$('shell-continue').click();
    await settle(() => {
      p.frame(0);
      return p.doc.body.dataset.flightState === 'running';
    });
    assert.equal(p.rendered.run.level.classic.combatPatrols.enabled, true);
    assert.equal(p.$('combat-mode').value, 'off');
    assert.deepEqual(authoritativeCheckpoint(p.rendered.run), checkpoint);
    // Pagehide and Continue may refresh the timestamp, but never the saved
    // edition, replay, checkpoint, or continuation authority.
    const withoutTimestamp = (raw) => {
      const { savedAt, ...authority } = JSON.parse(raw);
      return authority;
    };
    assert.deepEqual(withoutTimestamp(storage.getItem(slot)), withoutTimestamp(saved));
    // A matching live checkpoint alone is not enough: restore must also own
    // the On campaign when the next pause serializes the restored run again.
    p.$('pause-button').click();
    p.frame(0);
    const resaved = JSON.parse(storage.getItem(slot));
    assert.equal(resaved.campaignKey, JSON.parse(saved).campaignKey);
    assert.equal(resaved.replay.level.classic.combatPatrols.enabled, true);
    assert.deepEqual(authoritativeCheckpoint(p.rendered.run), checkpoint);
    assert.deepEqual(p.errors, []);
  });
  await t.test(
    'the restored and resaved On edition can Continue again and recover On after exhaustion',
    async (t) => {
      const { p, settle } = await livePage(t, { storage });
      assert.equal(p.$('combat-mode').value, 'off');
      assert.equal(p.$('shell-continue').hidden, false);
      assert.equal(p.$('shell-continue').disabled, false);
      p.$('shell-continue').click();
      await settle(() => {
        p.frame(0);
        return p.doc.body.dataset.flightState === 'running';
      });
      const restored = p.rendered.run;
      assert.equal(restored.level.classic.combatPatrols.enabled, true);
      assert.deepEqual(authoritativeCheckpoint(restored), checkpoint);
      // Deliberate input reversals cause real self-contact failures. No outcome,
      // life count, authored geometry, or recorder state is manufactured here.
      for (let attempt = 0; attempt < 5 && restored.status !== 'lost'; attempt++) {
        for (let wait = 0; wait < 300 && restored.status !== 'running'; wait++) p.frame();
        assert.equal(restored.status, 'running');
        p.key('ArrowDown');
        for (let frame = 0; frame < 24 && restored.status === 'running'; frame++) p.frame();
        p.key('ArrowDown', false);
        p.key('ArrowUp');
        for (let frame = 0; frame < 100 && restored.status === 'running'; frame++) p.frame();
        p.key('ArrowUp', false);
      }
      assert.equal(restored.status, 'lost');
      assert.equal(restored.lives, 0);
      for (let frame = 0; frame < 100; frame++) p.frame();
      await settle(() => {
        p.frame(0);
        return p.rendered.run !== restored && p.doc.body.dataset.flightState === 'running';
      });
      assert.equal(p.rendered.run.level.classic.combatPatrols.enabled, true);
      assert.equal(p.$('combat-mode').value, 'off');
      assert.equal(p.rendered.run.lives, p.rendered.run.level.rules.lives);
      p.$('pause-button').click();
      p.frame(0);
      const recovered = JSON.parse(storage.getItem(slot));
      assert.equal(recovered.campaignKey, JSON.parse(saved).campaignKey);
      assert.equal(recovered.replay.level.classic.combatPatrols.enabled, true);
      assert.deepEqual(p.errors, []);
    },
  );
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script } from 'node:vm';
import { parse } from 'acorn';
import { observePreviewReadiness } from '../studio/preview-readiness.mjs';
import { compileContentProject } from '../content-design/project.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { createStarterProject } from '../content-design/starter.mjs';
import { createCombatCandidates } from '../content-design/combat-candidates.mjs';
import { freezeDesign } from '../content-design/catalogs.mjs';

function fixture({ watchPractice = false } = {}) {
  let clock = 0,
    current = true,
    callback,
    reads = 0,
    throws = false;
  const document = {
    URL: 'https://fixture/game/?practice=1&revision=studio-1',
    documentElement: { dataset: { bootState: 'loading' } },
  };
  const events = [],
    cancelled = [];
  const stop = observePreviewReadiness({
    expectedURL: document.URL,
    watchPractice,
    readDocument: () => {
      reads++;
      if (throws) throw new Error('inaccessible');
      return document;
    },
    isCurrent: () => current,
    notify: (state) => events.push(state),
    now: () => clock,
    schedule: (fn, ms) => {
      assert.equal(ms, 250);
      callback = fn;
      return 17;
    },
    cancel: (id) => cancelled.push(id),
  });
  return {
    document,
    events,
    cancelled,
    stop,
    tick: (ms = 250) => {
      clock += ms;
      callback();
    },
    expire: () => {
      current = false;
    },
    inaccessible: () => {
      throws = true;
    },
    reads: () => reads,
  };
}

test('Studio slow preview warns once, then accepts later exact-document readiness', () => {
  const f = fixture();
  f.tick(19999);
  assert.deepEqual(f.events, []);
  f.tick(1);
  assert.deepEqual(f.events, ['slow']);
  assert.deepEqual(f.cancelled, []);
  f.tick(20000);
  assert.deepEqual(f.events, ['slow']);
  f.document.documentElement.dataset.bootState = 'ready';
  f.tick();
  assert.deepEqual(f.events, ['slow', 'ready']);
  assert.deepEqual(f.cancelled, [17]);
  f.tick();
  f.stop();
  assert.deepEqual(f.events, ['slow', 'ready']);
  assert.deepEqual(f.cancelled, [17]);
});

test('Studio accepts ready without depending on the iframe load event', () => {
  const f = fixture();
  f.document.documentElement.dataset.bootState = 'ready';
  f.tick();
  assert.deepEqual(f.events, ['ready']);
  assert.deepEqual(f.cancelled, [17]);
});

test('Studio terminal boot failure settles even after a slow warning', () => {
  const f = fixture();
  f.tick(20000);
  f.document.documentElement.dataset.bootState = 'failed';
  f.tick();
  f.document.documentElement.dataset.bootState = 'ready';
  f.tick();
  assert.deepEqual(f.events, ['slow', 'failed']);
  assert.deepEqual(f.cancelled, [17]);
});

test('stale, blank and foreign preview documents cannot report ready', () => {
  for (const URL of [
    'about:blank',
    'https://fixture/game/?practice=1&revision=studio-0',
    'https://other.test/game/?practice=1&revision=studio-1',
  ]) {
    const f = fixture();
    f.document.URL = URL;
    f.document.documentElement.dataset.bootState = 'ready';
    f.tick();
    assert.deepEqual(f.events, []);
    f.tick(20000);
    assert.deepEqual(f.events, ['slow']);
    f.stop();
  }
});

test('replaced previews stop before reading or notifying, including queued callbacks', () => {
  const f = fixture();
  f.expire();
  f.document.documentElement.dataset.bootState = 'ready';
  f.tick();
  f.tick();
  assert.equal(f.reads(), 0);
  assert.deepEqual(f.events, []);
  assert.deepEqual(f.cancelled, [17]);
});

test('closing or leaving Studio cancels the owned monitor and late callbacks', () => {
  const f = fixture();
  f.tick(20000);
  f.stop();
  const reads = f.reads();
  f.document.documentElement.dataset.bootState = 'ready';
  f.tick();
  assert.equal(f.reads(), reads);
  assert.deepEqual(f.events, ['slow']);
  assert.deepEqual(f.cancelled, [17]);
});

test('inaccessible frame remains unknown and does not throw or claim successful boot', () => {
  const f = fixture();
  f.inaccessible();
  f.tick(20000);
  assert.deepEqual(f.events, ['slow']);
  f.stop();
});

test('owned practice observes a post-ready render failure without repeating readiness', () => {
  const f = fixture({ watchPractice: true });
  f.document.documentElement.dataset.bootState = 'ready';
  f.tick();
  f.tick(30000);
  assert.deepEqual(f.events, ['ready']);
  assert.deepEqual(f.cancelled, []);
  f.document.documentElement.dataset.practiceRenderState = 'failed';
  f.tick();
  f.tick();
  assert.deepEqual(f.events, ['ready', 'failed']);
  assert.deepEqual(f.cancelled, [17]);
  assert.equal(f.document.documentElement.dataset.bootState, 'ready');
});

test('foreign or replaced practice cannot overwrite an accepted ready status with failure', () => {
  for (const ending of ['foreign', 'replaced', 'closed']) {
    const f = fixture({ watchPractice: true });
    f.document.documentElement.dataset.bootState = 'ready';
    f.tick();
    f.document.documentElement.dataset.practiceRenderState = 'failed';
    if (ending === 'foreign') f.document.URL = 'https://other.test/practice';
    if (ending === 'replaced') f.expire();
    if (ending === 'closed') f.stop();
    f.tick();
    assert.deepEqual(f.events, ['ready']);
    f.stop();
    assert.deepEqual(f.cancelled, [17]);
  }
});

test('practice render failure before first readiness is visible without a ready flash', () => {
  const f = fixture({ watchPractice: true });
  Object.assign(f.document.documentElement.dataset, {
    bootState: 'ready',
    practiceRenderState: 'failed',
  });
  f.tick();
  assert.deepEqual(f.events, ['failed']);
  assert.deepEqual(f.cancelled, [17]);
});

// Execute the actual Studio launch/retirement functions and pagehide binding.
// The bounded media/DOM/timer adapters avoid mounting unrelated editors; project
// compilation and scenario preparation remain the real production functions.
async function studioLifecycle() {
  const source = await readFile(new URL('../studio/studio.mjs', import.meta.url), 'utf8');
  const tree = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const functions = ['launchPreview', 'retirePreview', 'closePreview', 'inspectBoard'];
  const nodes = tree.body.filter(
    (node) =>
      (node.type === 'FunctionDeclaration' && functions.includes(node.id.name)) ||
      (node.type === 'ExpressionStatement' &&
        node.expression.type === 'CallExpression' &&
        node.expression.callee.object?.name === 'window' &&
        node.expression.callee.property?.name === 'addEventListener' &&
        node.expression.arguments[0]?.value === 'pagehide'),
  );
  assert.equal(nodes.length, 5);
  const themes = JSON.parse(
    await readFile(new URL('../content-design/themes.json', import.meta.url)),
  ).themes;
  const media = [],
    writes = [],
    messages = [],
    timers = new Set(),
    callbacks = [],
    handlers = new Map();
  let focus = 'outside-preview',
    draft = createStarterProject();
  const element = () => ({
    hidden: false,
    disabled: false,
    value: '',
    options: [],
    replaceChildren(...options) {
      this.options = options;
    },
  });
  const elements = {
    preview: { src: 'about:blank', contentDocument: null },
    'preview-panel': { hidden: true, scrollIntoView() {} },
    'preview-status': {},
    'preview-show-remains': { checked: true, disabled: true },
    'preview-remains-options': { hidden: true },
    mission: { value: 'nearby-shore' },
    difficulty: { value: 'standard' },
    play: {
      focus() {
        focus = 'play';
      },
    },
  };
  const $ = (id) => (elements[id] ??= element());
  const syncEditor = { sync() {} };
  const context = {
    URL,
    AbortController,
    location: { href: 'https://fixture/game/studio/' },
    $,
    document: { createElement: element },
    window: { addEventListener: (type, handler) => handlers.set(type, handler) },
    session: { current: () => draft },
    freezeDesign,
    syncStudioDifficulty() {},
    acceptanceInspector: syncEditor,
    actorEditor: syncEditor,
    combatEditor: syncEditor,
    geometryEditor: syncEditor,
    bonusEditor: syncEditor,
    timedBonusEditor: syncEditor,
    objectiveEditor: syncEditor,
    relayEditor: syncEditor,
    directionalEditor: syncEditor,
    encounterEditor: syncEditor,
    traceRecovery: syncEditor,
    setBoardAvailability() {},
    draw() {},
    inspectEffectiveGameplay() {},
    bindStudioPreviewCopy() {},
    studioGameplayText() {},
    studioDiagnosticText() {},
    studioItemCaption() {},
    t: (key) => key,
    compileContentProject,
    prepareContentPreview,
    loadPreviewTheme: ({ signal, themeId }) =>
      new Promise((resolve) =>
        media.push({
          signal,
          resolve: () => resolve(themes.find((theme) => theme.id === themeId)),
        }),
      ),
    sessionStorage: { setItem: (...args) => writes.push(args) },
    localizedMessage: (key) => key,
    localizedText: (node, value) => {
      node.textContent = typeof value === 'function' ? value() : value;
      messages.push(node.textContent);
    },
    studioPreviewFailureText: (error) => error.message,
    studioPreviewLoadingText: () => 'loading',
    observePreviewReadiness: (options) =>
      observePreviewReadiness({
        ...options,
        schedule: (callback) => {
          timers.add(callback);
          callbacks.push(callback);
          return callback;
        },
        cancel: (callback) => timers.delete(callback),
      }),
    stopGameplayTuning() {},
    stopSpatialReviews() {},
    gameplayTuning: { dispose() {}, status: () => ({ overrides: {} }) },
    stopMapLocale() {},
    imageWorkbench: { ...syncEditor, dispose() {} },
    clearTimeout() {},
  };
  new Script(
    `'use strict';
     let previewRevision = 0, previewController = null, stopPreviewReadiness = () => {},
         paintedPreview = null, saveTimer, inspectedTrail = [], tuningRevision = null;
     ${nodes.map((node) => source.slice(node.start, node.end)).join('\n')}
     globalThis.previewActions = { launchPreview, closePreview, inspectBoard };`,
  ).runInNewContext(context);
  return {
    elements,
    media,
    writes,
    messages,
    timers,
    callbacks,
    focus: () => focus,
    launch: (source = createStarterProject(), missionId = 'nearby-shore') =>
      context.previewActions.launchPreview(source, missionId),
    inspect: (source, missionId) => {
      draft = source;
      elements.mission.value = missionId;
      return context.previewActions.inspectBoard();
    },
    close: () => context.previewActions.closePreview(),
    pagehide: (persisted) => handlers.get('pagehide')({ persisted }),
  };
}

for (const persisted of [false, true])
  test(`Studio pagehide persisted=${persisted} retires pending media without focus or late launch`, async () => {
    const f = await studioLifecycle();
    const pending = f.launch();
    assert.equal(f.elements['preview-panel'].hidden, false);
    assert.equal(f.media.length, 1);
    f.pagehide(persisted);
    assert.equal(f.media[0].signal.aborted, true);
    assert.equal(f.elements.preview.src, 'about:blank');
    assert.equal(f.elements['preview-panel'].hidden, true);
    assert.equal(f.focus(), 'outside-preview');
    // Even a loader which ignores its aborted signal cannot adopt stale media.
    f.media[0].resolve();
    await pending;
    assert.equal(f.writes.length, 0);
    assert.equal(f.elements.preview.src, 'about:blank');
    assert.equal(f.elements['preview-panel'].hidden, true);
    assert.equal(f.timers.size, 0);
    assert.equal(f.focus(), 'outside-preview');
  });

test('Studio BFcache retirement stops post-ready monitoring and deliberate relaunch gets a fresh owner', async () => {
  const f = await studioLifecycle();
  const first = f.launch();
  f.media[0].resolve();
  await first;
  const oldURL = f.elements.preview.src;
  const child = {
    URL: oldURL,
    documentElement: { dataset: { bootState: 'ready' } },
  };
  f.elements.preview.contentDocument = child;
  f.callbacks[0]();
  assert.equal(f.messages.at(-1), 'tools:studio.preview.ready');
  assert.equal(f.timers.size, 1);
  f.pagehide(true);
  assert.equal(f.timers.size, 0);
  assert.equal(f.elements.preview.src, 'about:blank');
  assert.equal(f.elements['preview-panel'].hidden, true);
  assert.equal(f.focus(), 'outside-preview');
  const messages = [...f.messages];
  child.documentElement.dataset.practiceRenderState = 'failed';
  f.callbacks[0](); // A queued timer from the retired document cannot notify.
  assert.deepEqual(f.messages, messages);
  const second = f.launch();
  f.media[1].resolve();
  await second;
  assert.notEqual(f.elements.preview.src, oldURL);
  assert.equal(f.elements['preview-panel'].hidden, false);
  assert.equal(f.timers.size, 1);
  assert.equal(f.writes.length, 2);
  assert.equal(f.writes[0][1], f.writes[1][1], 'Relaunch preserves the exact authored scenario.');
  f.close();
  assert.equal(f.timers.size, 0);
  assert.equal(f.elements.preview.src, 'about:blank');
  assert.equal(f.elements['preview-panel'].hidden, true);
  assert.equal(f.focus(), 'play', 'Only deliberate Close returns focus to the opener.');
});

test('Studio exposes the remains option only for a validated enabled Solo mission and remembers its choice', async () => {
  const f = await studioLifecycle();
  const source = createCombatCandidates(),
    before = JSON.stringify(source),
    checkbox = f.elements['preview-show-remains'],
    options = f.elements['preview-remains-options'];
  assert.equal(checkbox.checked, true);
  f.inspect(source, 'workshop-sweep');
  assert.equal(options.hidden, false);
  assert.equal(checkbox.disabled, false);
  checkbox.checked = false;

  for (const [project, mission] of [
    [createStarterProject(), 'nearby-shore'],
    [source, 'absent-mission'],
    [
      {
        ...structuredClone(source),
        missions: source.missions.map((m) => ({ ...m, combat: { ...m.combat, enabled: false } })),
      },
      'workshop-sweep',
    ],
    [
      {
        ...structuredClone(source),
        missions: source.missions.map((m) => ({ ...m, modes: ['versus'] })),
      },
      'workshop-sweep',
    ],
  ]) {
    f.inspect(project, mission);
    assert.equal(options.hidden, true);
    assert.equal(checkbox.disabled, true);
    assert.equal(
      checkbox.checked,
      false,
      'Changing eligibility must preserve the document choice.',
    );
  }
  f.inspect(source, 'sentry-detour');
  assert.equal(options.hidden, false);
  assert.equal(checkbox.disabled, false);
  assert.equal(checkbox.checked, false);

  const invalid = structuredClone(source);
  invalid.missions[0].coverage = 2;
  assert.throws(() => f.inspect(invalid, 'workshop-sweep'));
  assert.equal(options.hidden, true, 'Rejected input cannot leave an accepted control exposed.');
  assert.equal(checkbox.disabled, true);
  assert.equal(checkbox.checked, false);
  assert.equal(JSON.stringify(source), before);
  assert.deepEqual(f.writes, [], 'A display choice or mission inspection writes no scenario.');
});

test('Studio snapshots remains before media awaits and transports it outside byte-identical scenario data', async () => {
  const f = await studioLifecycle(),
    source = createCombatCandidates(),
    before = JSON.stringify(source),
    checkbox = f.elements['preview-show-remains'];
  checkbox.checked = false;
  const hidden = f.launch(source, 'workshop-sweep');
  assert.equal(f.media.length, 1);
  assert.equal(f.writes.length, 0);
  checkbox.checked = true;
  f.media[0].resolve();
  await hidden;
  assert.equal(new URL(f.elements.preview.src).searchParams.get('preview-remains'), 'hide');

  const shown = f.launch(source, 'workshop-sweep');
  checkbox.checked = false;
  f.media[1].resolve();
  await shown;
  assert.equal(new URL(f.elements.preview.src).searchParams.get('preview-remains'), 'show');
  assert.equal(f.writes.length, 2);
  assert.equal(f.writes[0][1], f.writes[1][1]);
  assert.equal(JSON.stringify(source), before);
  f.close();
});

test('Studio ignores the remembered hidden-remains choice for ordinary and disabled previews', async () => {
  const f = await studioLifecycle();
  f.elements['preview-show-remains'].checked = false;
  const disabled = createCombatCandidates();
  disabled.missions[0].combat.enabled = false;
  for (const [source, missionId] of [
    [createStarterProject(), 'nearby-shore'],
    [disabled, 'workshop-sweep'],
  ]) {
    const pending = f.launch(source, missionId);
    f.media.at(-1).resolve();
    await pending;
    assert.equal(new URL(f.elements.preview.src).searchParams.has('preview-remains'), false);
    assert.equal(f.elements['preview-show-remains'].checked, false);
  }
  f.close();
});

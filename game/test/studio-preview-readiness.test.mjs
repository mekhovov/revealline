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
import {
  getLocale,
  localizedMessage,
  localizedText,
  setLocale,
  t as translate,
} from '../i18n/index.mjs';
import { captureStudioActionFocus } from '../studio/action-focus.mjs';
import { createStudioDraftSnapshot } from '../studio/draft-snapshot.mjs';
import { studioPreviewFailureText, studioPreviewLoadingText } from '../studio/preview-copy.mjs';
import { Document } from './helpers/couch-dom.mjs';

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
async function studioLifecycle({ localized = false } = {}) {
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
    voiceSuspensions = 0,
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
  const document = localized ? new Document() : { createElement: element };
  if (localized) {
    for (const [id, tag] of [
      ['preview-status', 'p'],
      ['preview-panel', 'section'],
      ['play', 'button'],
    ]) {
      elements[id] = document.createElement(tag);
      elements[id].id = id;
      document.body.append(elements[id]);
    }
    elements['preview-panel'].hidden = true;
  }
  const $ = (id) => (elements[id] ??= element());
  const syncEditor = { sync() {} };
  const session = { current: () => draft, export: () => JSON.stringify(draft) };
  const context = {
    URL,
    URLSearchParams,
    AbortController,
    location: { href: 'https://fixture/game/studio/', search: '' },
    $,
    document,
    window: { addEventListener: (type, handler) => handlers.set(type, handler) },
    session,
    currentDraftSnapshot: createStudioDraftSnapshot(() => session),
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
    teamEnvironmentEditor: syncEditor,
    directionalEditor: syncEditor,
    encounterEditor: syncEditor,
    traceRecovery: syncEditor,
    discoveryEditor: { ...syncEditor, suspend() {}, dispose() {} },
    reactionVoiceEditor: {
      suspend() {
        voiceSuspensions++;
      },
      dispose() {},
    },
    huntEditor: { ...syncEditor, dispose() {} },
    sourceDiscard: { destroy() {} },
    stopSpatialReviews() {},
    captureStudioActionFocus,
    setBoardAvailability() {},
    draw() {},
    inspectEffectiveGameplay() {},
    bindStudioPreviewCopy() {},
    studioGameplayText() {},
    studioDiagnosticText() {},
    studioItemCaption() {},
    t: localized ? translate : (key) => key,
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
    localizedMessage: localized ? localizedMessage : (key) => key,
    localizedText: (node, value) => {
      if (localized) localizedText(node, value);
      else node.textContent = typeof value === 'function' ? value() : value;
      messages.push(node.textContent);
    },
    studioPreviewFailureText: localized ? studioPreviewFailureText : (error) => error.message,
    studioPreviewLoadingText: localized ? studioPreviewLoadingText : () => 'loading',
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
    document,
    elements,
    media,
    writes,
    messages,
    timers,
    callbacks,
    focus: () => (localized ? document.activeElement.id : focus),
    voiceSuspensions: () => voiceSuspensions,
    launch: (source = createStarterProject(), missionId = 'nearby-shore', difficulty) =>
      context.previewActions.launchPreview(source, missionId, difficulty),
    inspect: (source, missionId) => {
      draft = source;
      elements.mission.value = missionId;
      return context.previewActions.inspectBoard();
    },
    close: () => context.previewActions.closePreview(),
    pagehide: (persisted) => handlers.get('pagehide')({ persisted }),
  };
}

test('Studio held mission preparation translates without restarting or changing custom draft content', async (context) => {
  const locale = getLocale(),
    previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document'),
    f = await studioLifecycle({ localized: true }),
    source = createStarterProject('my-localized-preview'),
    customName = 'Relay Orchard / ҐЄІЇ',
    missionId = source.missions[0].id;
  source.missions[0].name = customName;
  const authored = JSON.stringify(source);
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    writable: true,
    value: f.document,
  });
  let pending;
  context.after(async () => {
    f.close();
    for (const media of f.media) media.resolve();
    await pending?.catch(() => {});
    f.document.documentElement.remove();
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else delete globalThis.document;
    setLocale(locale, { persist: false });
  });
  setLocale('en', { persist: false });
  f.elements.mission.value = missionId;
  f.elements.difficulty.value = 'expert';
  f.elements.play.focus();
  pending = f.launch(source, missionId, 'expert');
  assert.equal(f.media.length, 1);
  const signal = f.media[0].signal,
    input = f.document.createElement('textarea');
  input.value = '{"unapplied":"My draft ҐЄІЇ"}';
  input.selectionStart = 3;
  input.selectionEnd = 14;
  input.scrollTop = 57;
  f.document.body.append(input);
  input.focus();
  f.document.documentElement.scrollTop = 89;
  const raw = input.value;
  const unchanged = () => {
    assert.equal(f.media.length, 1);
    assert.equal(f.media[0].signal, signal);
    assert.equal(signal.aborted, false);
    assert.equal(JSON.stringify(source), authored);
    assert.equal(f.elements.mission.value, missionId);
    assert.equal(f.elements.difficulty.value, 'expert');
    assert.equal(input.value, raw);
    assert.equal(input.selectionStart, 3);
    assert.equal(input.selectionEnd, 14);
    assert.equal(input.scrollTop, 57);
    assert.equal(f.document.documentElement.scrollTop, 89);
    assert.equal(f.document.activeElement, input);
    assert.equal(f.elements['preview-panel'].scrolled ?? 0, 0);
  };
  for (const language of ['en', 'uk', 'en', 'uk']) {
    setLocale(language, { persist: false });
    assert.equal(
      f.elements['preview-status'].textContent,
      language === 'uk' ? 'Готуємо попередній перегляд місії…' : 'Preparing the mission preview…',
    );
    assert.doesNotMatch(f.elements['preview-status'].textContent, /\{\{|\}\}|tools:|undefined/);
    assert.equal(f.elements.preview.src, 'about:blank');
    assert.equal(f.writes.length, 0);
    assert.equal(f.timers.size, 0);
    assert.equal(f.voiceSuspensions(), 1);
    unchanged();
  }
  f.media[0].resolve();
  await pending;
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0][0], 'revealline.playground.current');
  const stored = f.writes[0][1],
    scenario = JSON.parse(stored),
    url = f.elements.preview.src;
  assert.equal(scenario.level.name, customName);
  assert.equal(scenario.metadata.title, customName);
  assert.equal(new URL(url).searchParams.get('revision'), 'studio-1');
  assert.equal(f.timers.size, 1);
  for (const language of ['en', 'uk', 'en']) {
    setLocale(language, { persist: false });
    assert.match(
      f.elements['preview-status'].textContent,
      language === 'uk' ? /^Завантаження:/ : /^Loading /,
    );
    assert.ok(
      f.elements['preview-status'].textContent.includes(
        `${customName} · ${translate('interface:missionLibrary.difficulty.expert')}`,
      ),
    );
    assert.doesNotMatch(f.elements['preview-status'].textContent, /\{\{|\}\}|tools:|undefined/);
    assert.equal(f.elements.preview.src, url);
    assert.equal(f.writes.length, 1);
    assert.equal(f.writes[0][1], stored);
    assert.equal(f.voiceSuspensions(), 2);
    unchanged();
  }
});

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

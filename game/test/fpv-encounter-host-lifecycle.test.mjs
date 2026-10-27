import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'acorn';
import { createEncounterPreferences } from '../../optional-practice/civilian-fpv/encounter-controls.mjs';

const source = await readFile(
  new URL('../../optional-practice/civilian-fpv/world-app.mjs', import.meta.url),
  'utf8',
);
const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
function find(node, accept) {
  if (!node || typeof node !== 'object') return null;
  if (accept(node)) return node;
  for (const value of Object.values(node)) {
    for (const child of Array.isArray(value) ? value : [value]) {
      if (child?.type) {
        const result = find(child, accept);
        if (result) return result;
      }
    }
  }
  return null;
}
const named = (name) =>
  find(ast, (node) => node.type === 'FunctionDeclaration' && node.id.name === name);
const bind = (node, state) => {
  state.readFlightState ??= (selected = state.flight) =>
    selected?.frameSnapshot?.() ?? selected?.snapshot?.();
  state.configureReplayRates ??= () => {};
  return new Function('state', `with (state) { return (${source.slice(node.start, node.end)}); }`)(
    state,
  );
};
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

test('host rendering uses the bounded frame view while public inspection remains defensive', () => {
  const view = { ticks: 5 },
    fallback = { ticks: 6 };
  let fullReads = 0;
  const state = {
    flight: {
      frameSnapshot: () => view,
      snapshot: () => {
        fullReads++;
        return fallback;
      },
    },
  };
  const read = bind(named('readFlightState'), state);
  assert.equal(read(), view);
  assert.equal(fullReads, 0);
  state.flight = { snapshot: () => fallback };
  assert.equal(read(), fallback);
  state.flight = null;
  assert.equal(read(), undefined);
  const publicReturn = source.lastIndexOf('snapshot: () => ({');
  assert.ok(source.slice(publicReturn).includes('state: flight?.snapshot()'));
});

test('combat health visibility governs every overlay and leaves original-course health unchanged', () => {
  const update = named('updateHUD');
  const telemetry = find(
    update,
    (node) =>
      node.type === 'CallExpression' &&
      node.callee.object?.name === 'flightHud' &&
      node.callee.property?.name === 'update',
  );
  const instruments = find(
    update,
    (node) =>
      node.type === 'CallExpression' &&
      node.callee.name === 'paintText' &&
      node.arguments[0]?.value === 'flight-instruments',
  );
  const paint = named('paintCombatHUD');
  const status = find(
    paint,
    (node) =>
      node.type === 'AssignmentExpression' &&
      node.left.object?.name === 'combatHUD' &&
      node.left.property?.name === 'textContent',
  );
  for (const preference of ['off', 'damaged', 'always'])
    for (const health of [0, 80, 100])
      for (const original of [false, true])
        for (const learning of [false, true]) {
          const state = {
            health,
            position: { y: 0 },
            velocity: { x: 0, y: 0, z: 0 },
            ticks: 50,
            status: 'active',
            ...(original
              ? {}
              : {
                  encounter: {
                    health,
                    maxHealth: 100,
                    activity: 'survival',
                    ticks: 50,
                    actors: [],
                    kills: 0,
                    shots: 0,
                    hits: 0,
                    outsideArea: true,
                  },
                }),
          };
          const context = {
            state,
            combatFeedback: { playerHealth: preference },
            current: { beginner: learning, freeFlight: learning, regional: true },
            guidance: {},
            navigation: null,
            hudVisible: true,
            activeHud: true,
            replayProof: null,
            combatReplaySource: null,
            checkpointSession: null,
            numeric: null,
            $: () => ({ textContent: '' }),
            flightHud: {
              update: (_guidance, options) => {
                context.telemetry = options;
              },
            },
            paintText: (_id, text) => {
              context.instruments = text;
            },
          };
          context.flightHealthText = bind(named('flightHealthText'), context);
          context.healthText = context.flightHealthText(state);
          for (const node of [telemetry, instruments])
            new Function('context', `with (context) { ${source.slice(node.start, node.end)}; }`)(
              context,
            );
          const combatVisible =
            preference === 'always' || (preference === 'damaged' && health < 100);
          assert.equal(context.instruments.includes('♥'), original || combatVisible);
          assert.equal(
            context.telemetry.telemetry.includes('♥'),
            original ? !learning || health < 100 : combatVisible,
          );
          if (!original) {
            assert.equal(context.telemetry.visible, true, 'regional return HUD is covered');
            Object.assign(context, {
              c: state.encounter,
              combatHUD: {},
              txt: (en) => en,
              encounterActivityLabel: () => 'Survival',
              locale: 'en',
            });
            new Function(
              'context',
              `with (context) { ${source.slice(status.start, status.end)}; }`,
            )(context);
            assert.equal(context.combatHUD.textContent.includes('♥'), combatVisible);
          }
        }
});

test('combat result cards render saved loadout, ammo and independent assistance in both languages', async () => {
  for (const locale of ['en', 'uk'])
    for (const ammoPreset of ['balanced', 'arcade', 'tactical'])
      for (const [playerAssisted, enemyAssisted] of [
        [false, false],
        [true, false],
        [false, true],
        [true, true],
      ]) {
        const definition = {
          format: 'FPVEncounterDefinition.v2',
          baseIdentity: 'course',
          seed: 7,
          loadout: ['autocannon', 'rocket'],
          payload: 'remote',
          ammoPreset,
          playerDamage: playerAssisted ? 'invulnerable' : 'normal',
          enemyDamage: enemyAssisted ? 'one-hit' : 'normal',
          survivalMode: 'timed',
        };
        const encounter = {
          status: 'complete',
          activity: 'survival',
          difficulty: 'normal',
          population: 64,
          actors: [],
          wave: 1,
          kills: 3,
          shots: 4,
          hits: 3,
          ticks: 18000,
          bestStreak: 3,
        };
        const panel = {
          replaceChildren(...children) {
            this.children = children;
          },
        };
        let stored;
        const context = {
          finished: false,
          flightToken: 1,
          combatReplaySource: null,
          replayProof: null,
          enemyStatistics: { finish() {} },
          input: { enable() {} },
          fire: false,
          radio: { freeze() {} },
          flight: {
            combatDefinition: () => definition,
            identity: { encounter: 'encounter', base: { model: 'native' } },
            snapshot: () => ({ encounter, combatRecording: {}, advanced: false }),
          },
          finishCombatArchive: async () => {},
          storage: {
            getItem: () => null,
            setItem: (_key, value) => {
              stored = JSON.parse(value)[0];
            },
          },
          clone: structuredClone,
          $: () => panel,
          el: (tag, text) => ({ tag, text }),
          button: (text) => ({ tag: 'button', text }),
          txt: (en, uk) => (locale === 'uk' ? uk : en),
          encounterActivityLabel: () => 'Survival',
          locale,
        };
        context.combatResultSettings = bind(named('combatResultSettings'), context);
        await bind(named('finishFlight'), context)(1);
        const text = panel.children.map((node) => node.text).join('\n');
        assert.ok(
          text.includes(
            locale === 'uk' ? 'Озброєння: Автогармата / Ракети' : 'Loadout: Autocannon / Rockets',
          ),
        );
        assert.ok(
          text.includes(locale === 'uk' ? 'Заряд: Дистанційний заряд' : 'Payload: Remote charge'),
        );
        const ammo = {
          balanced: ['Balanced', 'Збалансовано'],
          arcade: ['Arcade', 'Аркада'],
          tactical: ['Tactical', 'Тактичний'],
        }[ammoPreset][locale === 'uk' ? 1 : 0];
        assert.ok(text.includes(`${locale === 'uk' ? 'Боєприпаси' : 'Ammunition'}: ${ammo}`));
        assert.ok(text.includes(locale === 'uk' ? 'Пошкодження гравця:' : 'Player damage:'));
        assert.ok(text.includes(locale === 'uk' ? 'Пошкодження ворогів:' : 'Enemy damage:'));
        assert.equal(
          text.includes(locale === 'uk' ? 'Невразливість · допомога' : 'Invulnerable · assisted'),
          playerAssisted,
        );
        assert.equal(
          text.includes(locale === 'uk' ? 'Одне влучання · допомога' : 'One hit · assisted'),
          enemyAssisted,
        );
        assert.equal(stored.configuration.ammoPreset, ammoPreset);
        assert.equal(stored.configuration.playerDamage, definition.playerDamage);
        assert.equal(stored.configuration.enemyDamage, definition.enemyDamage);
        assert.deepEqual(
          context.combatResultSettings({}),
          [],
          'historical results invent no settings',
        );
      }
});

test('accepted host observers reuse one boundary snapshot and include Strike aftermath', () => {
  for (const [accepted, frameMode] of [
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ]) {
    let reads = 0,
      combatTick = 5,
      observed = 0,
      saves = 0;
    const read = () => ({
      status: 'active',
      ticks: 250,
      encounter: { ticks: combatTick, phase: 'aftermath' },
      combatRecording: { retainedTo: combatTick },
    });
    const state = {
      disposed: false,
      combatReplaySource: null,
      sceneReady: true,
      flight: {
        combatDefinition: () => ({}),
        snapshot: () => {
          reads++;
          return read();
        },
        step: () => {
          if (accepted) combatTick++;
          return read();
        },
      },
      $: (id) => (id === 'flight-dialog' ? { open: true, dataset: {} } : { value: 'keyboard' }),
      doc: { visibilityState: 'visible', hasFocus: () => true, querySelector: () => null },
      flightMenuOpen: () => false,
      beginnerCoach: { blocksArm: () => false },
      win: { performance: { now: () => 0 } },
      lastExecutionTime: 0,
      accumulator: 20,
      flightToken: 1,
      pauseRevision: 0,
      input: {
        sample: () => ({ roll: 0, pitch: 0, yaw: 0, throttle: 0 }),
        diagnostics: () => ({}),
      },
      inputDiagnostics: {
        record: (_flight, _source, _controls, _diagnostics, saved) => {
          assert.equal(saved.encounter.ticks, 6);
        },
      },
      replayProof: null,
      replayKind: null,
      fire: false,
      current: { legacy: false, regional: false },
      observeCombat: (saved) => {
        observed++;
        assert.equal(saved.encounter.ticks, 6);
      },
      renderer: { observePresentation: () => {} },
      audio: { update: () => {} },
      recorder: null,
      saveRecovery: async () => {
        saves++;
      },
      reportError: (error) => {
        throw error;
      },
    };
    if (frameMode) {
      state.flight.frameSnapshot = state.flight.snapshot;
      state.flight.stepFrame = state.flight.step;
      state.flight.snapshot = state.flight.step = () => {
        throw new Error('Frame consumers must not copy the full public state');
      };
    }
    bind(named('pumpFlightSteps'), state)();
    assert.equal(reads, 2, 'one before and one after snapshot per synchronous step');
    assert.equal(observed, accepted ? 1 : 0);
    assert.equal(saves, 0, 'a frozen aircraft tick must not repeatedly save during aftermath');
  }
});

test('combat recovery never applies a late presentation to a replacement flight', async () => {
  for (const reject of [false, true]) {
    const pending = deferred();
    let restored = 0,
      observed = 0;
    const state = {
      flight: { restoreCombatRecovery: () => pending.promise },
      renderer: { restoreCombatPresentation: () => restored++ },
      observeCombat: () => observed++,
    };
    const restore = bind(named('restoreCombat'), state),
      job = restore({});
    state.flight = { combatDefeats: () => [] };
    if (reject) pending.reject(new Error('Previous worker disposed'));
    else pending.resolve({ state: { encounter: { runId: 'old', ticks: 1 } }, presentation: {} });
    assert.equal(await job, false);
    assert.equal(restored, 0);
    assert.equal(observed, 0);
  }
  const directAssignment = find(
    ast,
    (node) =>
      node.type === 'AssignmentExpression' &&
      node.left.name === 'flight' &&
      node.right.type === 'AwaitExpression' &&
      node.right.argument.callee?.name === 'createEncounterSession',
  );
  assert.equal(
    directAssignment,
    null,
    'Encounter construction must remain local until ownership is checked',
  );
  const regional = named('startRegionalFlight'),
    native = named('startFlight');
  const compactBody = (node) => source.slice(node.start, node.end).replace(/\s+/g, ' ');
  assert.ok(
    compactBody(regional).includes('if (!ownsLaunch() || flight !== regionalBase)'),
    'Regional construction checks both launch and base-session ownership',
  );
  assert.ok(
    compactBody(native).includes(
      'if (!ownsLaunch()) { await candidateFlight.dispose?.(); return; }',
    ),
    'A stale native candidate is disposed before adoption',
  );
});

test('public unscored map launches keep combat defaults and remembered activity while authoring remains original', () => {
  const preferences = createEncounterPreferences();
  const state = {
    encounterUnavailable: '',
    encounterPreferences: preferences,
    learningEntries: new Map([['school', {}]]),
    freshEncounterSeed: () => 17,
  };
  const select = bind(named('selectEncounter'), state);
  const publicEntries = [
    {
      id: 'railway',
      regional: true,
      regionalReview: false,
      freeFlight: true,
      packIdentity: 'regional-installed:exact',
    },
    { id: 'free-flight', freeFlight: true, packIdentity: 'fpv-pack:exact' },
    { id: 'ordinary-world', packIdentity: 'fpv-pack:exact' },
  ];
  for (const entry of publicEntries)
    for (const preview of [false, true])
      assert.equal(select(entry, { preview }).activity, 'continuous');
  preferences.update({ activity: 'hunting' });
  for (const entry of publicEntries)
    assert.equal(select(entry, { preview: true }).activity, 'hunting');
  assert.equal(select({ id: 'school', beginner: true }, { preview: true }).activity, 'original');
  preferences.update({ activity: 'elimination' }, true);
  assert.equal(select({ id: 'school', beginner: true }, {}).activity, 'elimination');
  for (const [entry, options] of [
    [{ id: 'draft', packIdentity: 'authoring' }, { preview: true }],
    [{ id: 'review', regional: true, regionalReview: true }, {}],
    [publicEntries[0], { preview: true, tuningDraft: {} }],
    [publicEntries[0], { replayProof: {} }],
    [publicEntries[1], { checkpoint: {} }],
  ])
    assert.equal(select(entry, options).activity, 'original');
  assert.equal(
    select(
      { id: 'draft', packIdentity: 'authoring' },
      { preview: true, encounter: { activity: 'elimination' } },
    ).activity,
    'elimination',
  );
});

test('Studio carries a companion baseline across edits to the same source, but not another map', () => {
  const mounted = [];
  const state = {
    editor: { id: 'map-one', title: 'Before' },
    editingProject: { id: 'project-one' },
    encounterEditor: null,
    encounterEditorIdentity: null,
    encounterEditorSource: null,
    encounterEditorReady: true,
    encounterEditorContainer: {},
    dataIdentity: JSON.stringify,
    savedEncounterBundle: () => null,
    createNativeEncounterGeometry: () => ({ admitActor: () => true, dispose() {} }),
    locale: 'en',
    mountEncounterEditor: (options) => {
      mounted.push(options);
      const bundle = `baseline:${state.editor.id}:${state.editor.title}`;
      return { refresh() {}, exportBundle: () => bundle, dispose() {} };
    },
  };
  const refresh = bind(named('refreshEncounterEditor'), state);
  refresh();
  assert.equal(mounted.at(-1).bundle, null);
  state.editor = { ...state.editor, title: 'After' };
  refresh();
  assert.equal(mounted.at(-1).bundle, 'baseline:map-one:Before');
  state.editor = { id: 'map-two', title: 'Other' };
  refresh();
  assert.equal(mounted.at(-1).bundle, null);
  state.editingProject = { id: 'different-project' };
  state.editor = { ...state.editor, title: 'Imported' };
  refresh();
  assert.equal(mounted.at(-1).bundle, null);
});

function previewFixture(art = null) {
  const preparing = deferred(),
    counts = { dispose: 0, remove: 0, draw: 0, frames: 0, prepare: 0, ticks: [], now: 0 };
  const dialog = new EventTarget();
  Object.assign(dialog, {
    append() {},
    showModal() {},
    remove() {
      counts.remove++;
    },
    close() {
      dialog.dispatchEvent(new Event('close'));
    },
  });
  const view = {
    setCourse() {},
    configureCombatPresentation() {},
    setCombatActors(_actors, context) {
      counts.ticks.push(context.tick);
    },
    observeCombat(facts) {
      counts.fact = facts[0];
    },
    exportCombatPresentation: () => ({ records: [counts.fact] }),
    resetCombatPresentation() {},
    resources: () => ({ combat: { moving: 1, settled: 0 } }),
    prepare: () => {
      counts.prepare++;
      return preparing.promise;
    },
    draw() {
      counts.draw++;
    },
    dispose() {
      counts.dispose++;
    },
  };
  const node = () => ({
    style: {},
    append() {},
    setAttribute() {},
    replaceChildren() {},
    addEventListener() {},
  });
  const state = {
    el: (tag) => (tag === 'dialog' ? dialog : node()),
    txt: (en) => en,
    button: () => ({}),
    doc: { body: { append() {} }, createElementNS: () => node() },
    rendererFactory: () => view,
    editor: {},
    encounterPhysicsCourse: (x) => x,
    createCombatPresentation() {},
    createCombatActorPresentation() {},
    huntPresentationControls: { preferences: { snapshot: () => ({}) } },
    disposed: false,
    applyCombatArt: async () => (art ? art.promise : true),
    win: {
      performance: { now: () => counts.now },
      requestAnimationFrame(fn) {
        counts.frames++;
        counts.next = fn;
        return counts.frames;
      },
      cancelAnimationFrame() {},
    },
  };
  const previewNode = find(
    named('refreshEncounterEditor'),
    (node) => node.type === 'Property' && node.key.name === 'onPreview',
  );
  const preview = bind(previewNode.value, state);
  return {
    preparing,
    counts,
    dialog,
    preview: () =>
      preview({
        definition: {
          actors: [
            { id: 'a', position: { x: 0, y: 0, z: 0 }, radius: 350, height: 1800, appearance: {} },
          ],
        },
        actorId: 'a',
        destruction: {},
      }),
  };
}

test('closing Studio preview during preparation disposes once and never starts a hidden frame loop', async () => {
  const fixture = previewFixture(),
    job = fixture.preview();
  fixture.dialog.close();
  assert.equal(fixture.counts.dispose, 1);
  fixture.preparing.resolve();
  await job;
  assert.equal(fixture.counts.remove, 1);
  assert.equal(fixture.counts.draw, 0);
  assert.equal(fixture.counts.frames, 0);
});

test('closing Studio during optional art preparation never prepares a disposed renderer', async () => {
  const art = deferred(),
    fixture = previewFixture(art),
    job = fixture.preview();
  fixture.dialog.close();
  art.resolve(false);
  await job;
  assert.equal(fixture.counts.dispose, 1);
  assert.equal(fixture.counts.remove, 1);
  assert.equal(fixture.counts.prepare, 0);
  assert.equal(fixture.counts.frames, 0);
});

test('Studio preview failures clean up and animation uses the simulator fifty-Hz clock', async () => {
  const failed = previewFixture(),
    failedJob = failed.preview();
  failed.preparing.reject(new Error('Graphics failed'));
  await assert.rejects(failedJob, /Graphics failed/);
  assert.equal(failed.counts.dispose, 1);
  assert.equal(failed.counts.remove, 1);
  const active = previewFixture(),
    activeJob = active.preview();
  active.preparing.resolve();
  await activeJob;
  active.counts.now = 40;
  active.counts.next();
  assert.equal(active.counts.ticks.at(-1), 2);
  active.dialog.close();
  assert.equal(active.counts.dispose, 1);
});

function playbackFixture() {
  const counts = { steps: 0, observed: 0, finished: 0, disposed: 0, paused: 0 };
  const session = {
    pause() {
      counts.paused++;
    },
  };
  const selected = {
    playing: true,
    pending: null,
    session,
    controller: new AbortController(),
    job: {
      snapshot: () => ({ done: counts.steps >= 4 }),
      step: async () => {
        counts.steps++;
        return { accepted: true, state: {} };
      },
      dispose: async () => {
        counts.disposed++;
      },
    },
  };
  const state = {
    combatPlayback: selected,
    combatReplaySource: {},
    combatReplayPreparation: null,
    flight: session,
    disposed: false,
    finished: false,
    sceneReady: true,
    accumulator: 0,
    replayRate: 1,
    doc: { visibilityState: 'visible', hasFocus: () => true, querySelector: () => null },
    flightMenuOpen: () => false,
    $: () => ({ dataset: {} }),
    observeCombat: () => {
      counts.observed++;
    },
    finishCombatPlayback: async () => {
      counts.finished++;
      selected.playing = false;
    },
    pauseFlight() {},
    reportError(error) {
      throw error;
    },
    txt: (en) => en,
  };
  return {
    state,
    selected,
    counts,
    advance: bind(named('advanceCombatPlayback'), state),
    stop: bind(named('stopCombatPlayback'), state),
  };
}

test('combat-only fast playback choices reset elapsed debt and remain unavailable to original recordings', () => {
  const classes = new Set();
  const dialog = {
    classList: {
      toggle(name, enabled) {
        if (enabled) classes.add(name);
        else classes.delete(name);
      },
    },
  };
  const select = {
    value: '1',
    options: [0.25, 0.5, 1].map((rate) => ({ value: String(rate) })),
    append(option) {
      this.options.push(option);
    },
  };
  const context = {
    combatReplaySource: {},
    replayRate: 1,
    accumulator: 77,
    lastTime: 10,
    lastExecutionTime: 10,
    win: { performance: { now: () => 99 } },
    $: (id) => (id === 'flight-dialog' ? dialog : select),
    el: (_tag, textContent) => ({ textContent }),
  };
  const configure = bind(named('configureReplayRates'), context),
    change = bind(named('changeReplayRate'), context);
  configure();
  configure();
  assert.equal(classes.has('combat-playback'), true);
  assert.deepEqual(
    select.options.map((option) => Number(option.value)),
    [0.25, 0.5, 1, 2, 4],
  );
  for (const rate of [2, 4]) {
    const option = select.options.find((item) => Number(item.value) === rate);
    assert.equal(option.hidden, false);
    assert.equal(option.disabled, false);
    select.value = String(rate);
    context.accumulator = 77;
    change();
    assert.equal(context.replayRate, rate);
    assert.equal(context.accumulator, 0);
    assert.equal(context.lastTime, null);
    assert.equal(context.lastExecutionTime, 99);
  }
  select.value = '8';
  change();
  assert.equal(context.replayRate, 4);
  assert.equal(select.value, '4');
  context.combatReplaySource = null;
  configure();
  assert.equal(classes.has('combat-playback'), false);
  assert.equal(context.replayRate, 1);
  assert.equal(select.value, '1');
  assert.ok(
    select.options
      .filter((option) => Number(option.value) > 1)
      .every((option) => option.hidden && option.disabled),
  );
  select.value = '4';
  change();
  assert.equal(context.replayRate, 1);
  assert.equal(select.value, '1');
});

test('combat replay speed remains visible in the compact shell and yields to its result screen', async () => {
  const css = await readFile(
    new URL('../../optional-practice/civilian-fpv/style.css', import.meta.url),
    'utf8',
  );
  assert.match(
    css,
    /@layer legacy\s*\{\s*html\s+body\.sim-worlds\s+#flight-dialog\.combat-playback:not\(:has\(#result-panel:not\(\[hidden\]\)\)\)\s*>\s*#world-replay-controls:not\(\[hidden\]\)\s*\{[^}]*display:\s*flex\s*!important/s,
  );
  assert.match(css, /#flight-dialog\.combat-playback[^}]*min-height:\s*44px/s);
});

test('fast combat playback keeps accepted fifty-Hz intervals bounded and serialized', async () => {
  for (const rate of [2, 4]) {
    const { state, selected, counts, advance } = playbackFixture();
    state.replayRate = rate;
    selected.job.snapshot = () => ({ done: false });
    advance(20);
    await selected.pending;
    await Promise.resolve();
    assert.equal(counts.steps, rate);
    assert.equal(counts.observed, rate);
    advance(10000);
    await selected.pending;
    await Promise.resolve();
    assert.equal(counts.steps, rate + 5, 'only five accepted intervals of catch-up are retained');
    const waiting = deferred();
    selected.job.step = () => {
      counts.steps++;
      return waiting.promise;
    };
    advance(20);
    const pending = selected.pending,
      before = counts.steps;
    advance(10000);
    advance(10000);
    assert.equal(selected.pending, pending);
    assert.equal(counts.steps, before, 'pending accepted steps cannot overlap');
    assert.equal(state.accumulator, 100);
    selected.playing = false;
    waiting.resolve({ accepted: true, state: {} });
    await pending;
    assert.equal(counts.steps, before, 'pause prevents a further accepted step');
    assert.equal(counts.paused, 1);
    advance(1000);
    assert.equal(counts.steps, before);
  }
});

test('combat playback owns one accepted fifty-Hz step stream, rate control and pause', async () => {
  const fixture = playbackFixture(),
    { state, selected, counts, advance } = fixture;
  state.replayRate = 0.25;
  advance(40);
  await selected.pending;
  await Promise.resolve();
  assert.equal(counts.steps, 0);
  advance(40);
  await selected.pending;
  await Promise.resolve();
  assert.equal(counts.steps, 1);
  selected.playing = false;
  advance(100);
  assert.equal(counts.steps, 1);
  selected.playing = true;
  state.replayRate = 1;
  advance(60);
  await selected.pending;
  await Promise.resolve();
  assert.equal(counts.steps, 4);
  assert.equal(counts.observed, 4);
  assert.equal(counts.finished, 1);
});

test('combat playback retries rejected steps and never overlaps a pending worker', async () => {
  const { state, selected, counts, advance } = playbackFixture();
  const waiting = deferred();
  selected.job.step = async () => {
    counts.steps++;
    return waiting.promise;
  };
  advance(20);
  const first = selected.pending;
  advance(20);
  assert.equal(selected.pending, first);
  assert.equal(counts.steps, 1);
  waiting.resolve({ accepted: false });
  await first;
  await Promise.resolve();
  assert.equal(state.accumulator, 20);
  assert.equal(counts.observed, 0);
  selected.job.step = async () => ({ accepted: true, state: {} });
  advance(0);
  await selected.pending;
  assert.equal(counts.observed, 1);
});

test('stopping combat playback waits for its pending step and cannot dispose a replacement flight', async () => {
  const { state, selected, counts, advance, stop } = playbackFixture();
  const waiting = deferred();
  selected.job.step = () => waiting.promise;
  advance(20);
  const stopping = stop();
  assert.equal(state.combatReplaySource, null);
  assert.equal(state.combatPlayback, null);
  assert.equal(selected.controller.signal.aborted, true);
  assert.equal(counts.disposed, 0);
  const replacement = {};
  state.flight = replacement;
  waiting.resolve({ accepted: true, state: {} });
  await stopping;
  assert.equal(state.flight, replacement);
  assert.equal(counts.disposed, 1);
  assert.equal(counts.observed, 0);
  assert.equal(counts.finished, 0);
});

test('combat playback prevents saving, rewards and live weapon commands without historical replay state', async () => {
  const state = {
    combatReplaySource: {},
    replayProof: null,
    flight: { snapshot: () => ({ status: 'active', encounter: {} }) },
    finished: false,
    flightToken: 7,
  };
  assert.equal(await bind(named('saveCombatSession'), state)(), undefined);
  assert.equal(await bind(named('saveRecovery'), state)(), undefined);
  assert.equal(await bind(named('finishFlight'), state)(7), undefined);
  assert.equal(bind(named('combatCommand'), state)('payload'), false);
  assert.equal(bind(named('canFire'), state)({ encounter: {} }), false);
});

test('combat watch rejects truncated chains before replacing the current flight', async () => {
  const state = {
    current: {},
    flight: {},
    flightToken: 1,
    txt: (en) => en,
    inspectCombatFile: () => ({
      definition: { format: 'FPVEncounterDefinition.v2' },
      saved: { gameplay: { format: 'FPVCombatRecovery.v2', recording: { retainedFrom: 3000 } } },
    }),
  };
  await assert.rejects(
    bind(named('watchCombatSession'), state)({}),
    /beginning.*no longer retained/,
  );
});

test('combat playback preparation cannot adopt a job after a new flight takes ownership', async () => {
  const waiting = deferred();
  let disposedJob = 0;
  const state = {
    flight: {},
    pauseRevision: 0,
    combatReplayPreparation: null,
    combatReplaySource: null,
    combatPlayback: null,
    input: { enable() {} },
    radio: { freeze() {} },
    gamepad: { reset() {} },
    createEncounterPlayback: () => waiting.promise,
  };
  const prepare = bind(named('prepareCombatPlayback'), state);
  const pending = prepare({}, () => true);
  const replacement = {};
  state.flight = replacement;
  waiting.resolve({
    dispose: async () => {
      disposedJob++;
    },
  });
  assert.equal(await pending, false);
  assert.equal(state.flight, replacement);
  assert.equal(state.combatPlayback, null);
  assert.equal(disposedJob, 1);
});

test('late combat playback verification cannot open results over another flight', async () => {
  const waiting = deferred();
  const selected = { job: { finish: () => waiting.promise }, session: {} };
  const state = { combatPlayback: selected, flight: selected.session, disposed: false };
  const finishing = bind(named('finishCombatPlayback'), state)();
  state.flight = {};
  waiting.resolve({ verified: true });
  await finishing;
  assert.equal(selected.verification, undefined);
});

test('payload UI distinguishes ready, deployed and armed states and preserves zero-reserve detonation', () => {
  const controls = bind(named('combatPayloadControls'), { txt: (en) => en });
  const ready = controls({ payloadAmmo: 1, ordnance: [] }, 'bomb');
  assert.match(ready.label, /Drop bomb/);
  assert.equal(ready.canDeploy, true);
  assert.equal(ready.canDetonate, false);
  const remote = controls(
    { payloadAmmo: 0, ordnance: [{ kind: 'remote', settled: true }] },
    'remote',
  );
  assert.equal(remote.canDeploy, false);
  assert.equal(remote.canDetonate, true);
  assert.match(remote.state, /Remote charge ready/);
  const falling = controls(
    { payloadAmmo: 1, ordnance: [{ kind: 'remote', settled: false }] },
    'remote',
  );
  assert.equal(falling.canDeploy, false);
  assert.equal(falling.canDetonate, false);
  const armed = controls({ payloadAmmo: 0, payloadArmed: true, ordnance: [] }, 'drone');
  assert.match(armed.label, /Arm drone charge/);
  assert.equal(armed.canDeploy, false);
  assert.equal(armed.canDetonate, true);
});

test('empty payload guidance follows the attempt ammunition preset and available pad in both languages', () => {
  const call = find(
    named('paintCombatHUD'),
    (node) => node.type === 'CallExpression' && node.callee.name === 'combatPayloadControls',
  );
  for (const locale of ['en', 'uk'])
    for (const ammoPreset of ['balanced', 'arcade', 'tactical'])
      for (const payload of ['bomb', 'remote', 'drone'])
        for (const hasPad of [false, true]) {
          const context = {
            txt: (en, uk) => (locale === 'uk' ? uk : en),
            c: {
              payloadAmmo: 0,
              ordnance: [],
              servicePad: hasPad ? { x: 0, y: 0, z: 0 } : null,
            },
            flight: { combatDefinition: () => ({ payload, ammoPreset }) },
            combatFeedbackDefinitions: new WeakMap(),
            encounterSelection: {
              payload: 'bomb',
              ammoPreset: ammoPreset === 'arcade' ? 'tactical' : 'arcade',
            },
          };
          context.combatFeedbackDefinition = bind(named('combatFeedbackDefinition'), context);
          context.feedbackDefinition = context.combatFeedbackDefinition();
          context.combatPayloadControls = bind(named('combatPayloadControls'), context);
          const expected = {
            tactical: context.txt(
              'Payload empty · replenish at the service pad',
              'Зарядів немає · поповніть їх на майданчику',
            ),
            arcade: context.txt(
              'Payload empty · release Fire for 11 s to recharge',
              'Зарядів немає · відпустіть «Вогонь» на 11 с для поповнення',
            ),
            balanced: hasPad
              ? context.txt(
                  'Payload empty · replenish at supplies or the service pad',
                  'Зарядів немає · зберіть припаси або відвідайте майданчик',
                )
              : context.txt(
                  'Payload empty · collect supplies to replenish',
                  'Зарядів немає · зберіть припаси для поповнення',
                ),
          };
          const empty = bind(call, context);
          assert.equal(empty.state, expected[ammoPreset]);
          assert.equal(empty.canDeploy, false);
          assert.equal(empty.canDetonate, false);
          context.flight = null;
          context.feedbackDefinition = context.combatFeedbackDefinition();
          assert.equal(bind(call, context).state, expected[context.encounterSelection.ammoPreset]);
        }
});

test('combat files retain launch settings independently of later workbench and regional location changes', async () => {
  const configuration = { response: { roll: 0.7 }, advanced: { controller: 'original' } };
  const state = {
    workbenchAttemptConfiguration: configuration,
    current: {
      regional: true,
      configuration: {
        spawnId: 'ridge',
        savedStart: { position: { x: 10, y: 20, z: 30 }, heading: 9000 },
        initialHeading: 4000,
        continuous: true,
        geometryProfile: 'balanced',
        source: 'not-copied',
      },
    },
    clone: structuredClone,
    $: () => ({ value: 'acro' }),
  };
  const launch = bind(named('combatLaunchMetadata'), state)();
  configuration.response.roll = 1;
  state.current.configuration.savedStart.heading = 18000;
  assert.equal(launch.configuration.response.roll, 0.7);
  assert.equal(launch.regional.savedStart.heading, 9000);
  assert.equal(launch.regional.source, undefined);
  const entry = { regional: true, configuration: { source: 'verified-source', savedStart: null } };
  const restored = bind(named('combatLaunchEntry'), state)(entry, launch);
  assert.equal(restored.configuration.source, 'verified-source');
  assert.equal(restored.configuration.savedStart.heading, 9000);
  assert.equal(entry.configuration.savedStart, null);
  const saved = {
    launch,
    gameplay: {
      identity: { base: {} },
      format: 'FPVCombatRecovery.v2',
      recording: { retainedFrom: 0 },
    },
  };
  const archivePacket = { format: 'FPVCombatArchive.v2', retainedFrom: 0 };
  let started,
    settingsOpen = true,
    settingsClosed = 0;
  Object.assign(state, {
    flight: {},
    flightToken: 1,
    combatActionStillCurrent: () => true,
    resolveCombatEntry: async () => entry,
    setCombatActionStatus: () => {},
    $: (id) => (id === 'sim-settings' ? { open: settingsOpen } : { value: 'acro' }),
    closeSettings: ({ force }) => {
      assert.equal(force, true);
      settingsOpen = false;
      settingsClosed++;
    },
    inspectCombatFile: () => ({
      saved,
      archive: { packet: archivePacket },
      definition: { format: 'FPVEncounterDefinition.v2', baseIdentity: 'exact-map' },
    }),
    combatBaseIdentity: () => 'exact-map',
    combatLaunchEntry: bind(named('combatLaunchEntry'), state),
    retainedDraftOptions: () => ({}),
    txt: (en) => en,
    startFlight: async (entry, options) => {
      assert.equal(settingsOpen, false, 'settings must not cover or block the restored flight');
      started = { entry, options };
    },
  });
  await bind(named('watchCombatSession'), state)(saved);
  assert.deepEqual(started.options.combatPlaybackConfiguration, launch.configuration);
  assert.equal(started.options.mode, 'acro');
  assert.equal(started.entry.configuration.savedStart.heading, 9000);
  settingsOpen = true;
  await bind(named('continueCombatRecovery'), state)(saved);
  assert.equal(settingsClosed, 2);
  assert.deepEqual(started.options.combatPlaybackConfiguration, launch.configuration);
  assert.equal(started.options.combatRecovery, saved);
  assert.equal(started.options.combatArchiveResume, archivePacket);
});

test('regional replay replaces launch hints and restores the recorded physics backend', () => {
  const state = { clone: structuredClone },
    entry = {
      regional: true,
      regionalAdvanced: true,
      configuration: {
        source: 'installed-source',
        spawnId: 'new-spawn',
        savedStart: { position: { x: 1, y: 2, z: 3 }, heading: 9 },
        initialHeading: 123,
      },
    };
  const restore = bind(named('combatLaunchEntry'), state);
  const standard = restore(
    entry,
    { regional: { spawnId: 'recorded-spawn' } },
    { format: 'FPVRegionalEncounterBase.v1' },
  );
  assert.equal(standard.regionalAdvanced, false);
  assert.equal(standard.configuration.spawnId, 'recorded-spawn');
  assert.equal(standard.configuration.savedStart, undefined);
  assert.equal(standard.configuration.initialHeading, undefined);
  assert.equal(standard.configuration.source, 'installed-source');
  assert.ok(entry.configuration.savedStart, 'original catalogue entry remains intact');
  const advanced = restore({ ...entry, regionalAdvanced: false }, null, {
    model: 'regional-aircraft-contact.v1',
  });
  assert.equal(advanced.regionalAdvanced, true);
});

test('closing an archived flight cannot dispose a replacement adopted during storage writes', async () => {
  const waiting = deferred();
  let disposed = 0,
    playbackStopped = 0;
  const state = {
    flightHud: { closeDetails() {} },
    enemyGuide: { close() {} },
    flightToken: 1,
    industrialPreparation: null,
    checkpointPreparation: null,
    qualityPreparing: false,
    scenePreparationGeneration: 0,
    abortSectorLookup() {},
    sceneReady: true,
    pauseFlight() {},
    saveRecovery: async () => {},
    disposed: false,
    regionalManifestRequest: null,
    retireCombatArchive: () => waiting.promise,
    stopCombatPlayback: async () => {
      playbackStopped++;
    },
    flight: {
      dispose: async () => {
        disposed++;
      },
    },
  };
  const closing = bind(named('closeFlight'), state)();
  await new Promise((resolve) => setImmediate(resolve));
  state.flightToken++;
  state.flight = {
    dispose: async () => {
      disposed++;
    },
  };
  waiting.resolve();
  await closing;
  assert.equal(playbackStopped, 0);
  assert.equal(disposed, 0);
});

test('archive initialization failures are reported once without interrupting accepted combat', () => {
  let attempts = 0,
    paints = 0;
  const state = {
    combatReplaySource: null,
    flight: { identity: { format: 'FPVEncounterSession.v2' } },
    combatArchiveOwner: null,
    combatArchive: null,
    combatArchivePoll: -1,
    combatArchiveError: null,
    combatArchiveResume: null,
    createEncounterArchive: () => {
      attempts++;
      throw Error('Storage unavailable');
    },
    combatArchives: () => ({}),
    label: () => 'Map',
    current: {},
    combatLaunchMetadata: () => null,
    paintCombatArchive: () => {
      paints++;
    },
    reportError: () => {},
  };
  const update = bind(named('updateCombatArchive'), state);
  update({ encounter: {}, combatRecording: { retainedTo: 1 } });
  update({ encounter: {}, combatRecording: { retainedTo: 51 } });
  assert.equal(attempts, 1);
  assert.equal(paints, 1);
  assert.equal(state.combatArchiveError, 'Storage unavailable');
});

test('continued archives forward their complete verified prefix to recording once', async () => {
  const prefix = { format: 'FPVCombatArchive.v2' };
  let captures = 0;
  const state = {
    combatReplaySource: null,
    flight: { identity: { format: 'FPVEncounterSession.v2' } },
    combatArchiveOwner: null,
    combatArchive: null,
    combatArchivePoll: -1,
    combatArchiveError: null,
    combatArchiveResume: prefix,
    createEncounterArchive: ({ resumeFrom }) => {
      assert.equal(resumeFrom, prefix);
      return { capture: async () => captures++ };
    },
    combatArchives: () => ({}),
    label: () => 'Map',
    current: {},
    combatLaunchMetadata: () => null,
    disposed: false,
    paintCombatArchive() {},
    reportError: (error) => {
      throw error;
    },
  };
  const update = bind(named('updateCombatArchive'), state);
  update({ encounter: {}, combatRecording: { retainedTo: 39001 } });
  update({ encounter: {}, combatRecording: { retainedTo: 39002 } });
  await Promise.resolve();
  assert.equal(captures, 1);
  assert.equal(state.combatArchiveResume, null);
});

test('combat file Watch checks its launch owner after reading without undefined captures', async () => {
  const call = find(
    ast,
    (node) =>
      node.type === 'CallExpression' &&
      node.callee?.object?.name === 'combatReplayInput' &&
      node.callee?.property?.name === 'addEventListener',
  );
  for (const replaced of [false, true]) {
    const pending = deferred();
    let watched = 0;
    const state = {
      combatReplayInput: { files: [{ size: 12, text: () => pending.promise }] },
      flight: {},
      flightToken: 1,
      disposed: false,
      txt: (en) => en,
      watchCombatSession: async () => {
        watched++;
      },
      reportError: (error) => {
        throw error;
      },
      runCombatAction: (_message, action) => action(),
    };
    state.combatActionStillCurrent = (selected, token) =>
      selected === state.flight && token === state.flightToken && !state.disposed;
    state.readCombatFile = async (file) => JSON.parse(await file.text());
    const reading = bind(call.arguments[1], state)();
    if (replaced) {
      state.flightToken++;
      state.flight = {};
    }
    pending.resolve('{}');
    await reading;
    assert.equal(watched, replaced ? 0 : 1);
  }
});

test('closing playback completes scene cleanup when playback disposal clears its flight', async () => {
  let dialogClosed = 0,
    disposals = 0;
  const node = {
    classList: { remove() {} },
    dataset: {},
    close: () => {
      dialogClosed++;
    },
    querySelector: () => null,
  };
  const state = {
    flightHud: { closeDetails() {}, setWorldCue() {} },
    enemyGuide: { close() {} },
    flightToken: 1,
    industrialPreparation: null,
    checkpointPreparation: null,
    qualityPreparing: false,
    scenePreparationGeneration: 0,
    abortSectorLookup() {},
    sceneReady: true,
    pauseFlight() {},
    saveRecovery: async () => {},
    disposed: false,
    regionalManifestRequest: null,
    retireCombatArchive: async () => {},
    flight: {
      dispose: async () => {
        disposals++;
      },
    },
    activeTuningDraft: null,
    learningDemoReturn: null,
    returnToLesson: {},
    $: () => node,
    current: {},
    refreshEnemyGuide() {},
    recorder: null,
    checkpointSession: null,
    checkpointRequest: null,
    modePractice: false,
    beginnerCoach: { close() {} },
    restoreLearningPreferences() {},
    sectorReferenceProof: null,
    playShell: null,
    replayProof: null,
    presentation: { resume() {} },
    renderCatalogue() {},
    renderPacks() {},
    paintLessonReturn() {},
  };
  state.stopCombatPlayback = async () => {
    await state.flight.dispose();
    state.flight = null;
  };
  await bind(named('closeFlight'), state)();
  assert.equal(disposals, 1);
  assert.equal(dialogClosed, 1);
  assert.equal(state.current, null);
});

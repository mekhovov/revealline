import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { parse } from 'acorn';
import { canonicalJSON } from '../data-json.mjs';
import { createOverflightProject, compileOverflightProject } from '../overflight/project.mjs';
import { createOverflightRun, pauseOverflight } from '../overflight/core.mjs';
const source = await readFile(new URL('../overflight/app.mjs', import.meta.url), 'utf8');
const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
const fn = (name) => {
  const node = ast.body.find(
    (node) => node.type === 'FunctionDeclaration' && node.id.name === name,
  );
  return source.slice(node.start, node.end);
};
const mountNode = ast.body.find(
  (node) =>
    node.type === 'IfStatement' &&
    source.slice(node.start, node.end).includes('suspendView = createSurvivalSuspendView'),
);
const mount = source.slice(mountNode.start, mountNode.end);
const noop = () => {};

function prepareFixture() {
  const project = createOverflightProject({ rulesVersion: 4, world: 'field-crossing', seed: 7 });
  const compiled = compileOverflightProject(project);
  const original = createOverflightRun(compiled, { airframes: 1 });
  original.phase = 'paused';
  const nodes = new Map();
  const $ = (name) => {
    if (!nodes.has(name)) nodes.set(name, { open: false, close: noop });
    return nodes.get(name);
  };
  const renderer = { present: noop, resetMeasurements: noop };
  const themeSnapshot = {
    identity: 'theme',
    familyId: 'family',
    familyRevision: 'family1',
    interfaceId: 'interface',
    revision: 'ui1',
    materialStyle: 'default',
    materialVariant: 'base',
  };
  const base = { manifestSha256: 'a'.repeat(64), source: 'test-source' };
  let acquired = 0;
  const context = {
    project,
    compiled,
    run: original,
    seed: 7,
    selectedInstalled: false,
    options: {
      characterId: 'balanced',
      airframes: 1,
      slowResume: true,
      flightTraits: true,
      difficulty: 'standard',
    },
    projectForSortie: () => project,
    canonicalJSON: (value) => canonicalJSON(JSON.parse(JSON.stringify(value))),
    mode: {
      compileProject: compileOverflightProject,
      resetPresentation: noop,
      pause: pauseOverflight,
      createRun: createOverflightRun,
    },
    epoch: 0,
    clipRecorder: null,
    runtimeFailed: false,
    preparing: false,
    retired: false,
    rewardTimer: null,
    win: { clearTimeout: noop },
    $,
    updateRecoveryControl: noop,
    updateShell: noop,
    releaseInput: noop,
    sound: { pause: noop },
    commentator: null,
    showStatus: noop,
    text: (key) => key,
    theme: {
      ready: Promise.resolve(),
      snapshot: () => themeSnapshot,
      effectivePreferences: () => ({}),
    },
    overflightWorldImageSlots: () => [],
    worldSources: { use: async (_slots, callback) => callback(base) },
    selectedArcadeCollection: () => null,
    castPreferences: { snapshot: () => ({ cast: null }) },
    resolveOverflightCharacter: () => ({ id: 'balanced', playerSlot: 'player' }),
    rendererOwner: {
      invalidate: noop,
      acquire: async () => {
        acquired++;
        return renderer;
      },
    },
    renderer,
    preparationIdentity: null,
    music: null,
    overflightMusicContext: noop,
    fixture: null,
    studio: false,
    review: { active: () => false, reset: noop },
    audio: { reset: noop },
    clock: { reset: noop, clearMeasurements: noop },
    benchmarkProtocol: null,
    completedMeasurement: null,
    resourceSamples: [],
    nextResourceSample: 0,
    lastPhase: null,
    offerKey: '',
    hudBuildKey: null,
    lastFrame: null,
    frames: [],
    simulation: [],
    longFrames: 0,
    rawOverflow: 0,
    clipCaptureUsed: false,
    rawPages: null,
    refreshCharacters: noop,
    updateHUD: noop,
    refreshOperationView: noop,
    restoreSortieControls: noop,
    params: new URLSearchParams(),
    shell: { enterPlay: noop, open: noop },
    start: noop,
  };
  const appearance = {
    projectIdentity: compiled.projectIdentity,
    manifestSha256: base.manifestSha256,
    presentation: base.source,
    themeIdentity: themeSnapshot.identity,
    familyId: themeSnapshot.familyId,
    familyRevision: themeSnapshot.familyRevision,
    interfaceId: themeSnapshot.interfaceId,
    interfaceRevision: themeSnapshot.revision,
    arcade: null,
    actorArtRevision: compiled.resources.actorArtRevision,
    equipment: compiled.resources.effects,
    materialStyle: themeSnapshot.materialStyle,
    materialVariant: themeSnapshot.materialVariant,
    characterId: 'balanced',
    playerSlot: 'player',
    cast: null,
    visualIdentity: compiled.visualIdentity,
  };
  const prepare = runInNewContext(`${fn('prepare')}; prepare`, context);
  return { context, prepare, appearance, acquired: () => acquired };
}

test('actual native preparation adopts the admitted paused state and never launches it', async () => {
  const f = prepareFixture();
  const restored = createOverflightRun(f.context.compiled, { airframes: 3 });
  restored.phase = 'paused';
  const result = await f.prepare({
    nextProject: f.context.project,
    nextSeed: 7,
    retainedRun: restored,
    restoreOptions: { ...f.context.options, airframes: 3 },
    expectedAppearance: f.appearance,
  });
  assert.equal(result, true);
  assert.equal(f.context.run, restored);
  assert.equal(f.context.run.phase, 'paused');
  assert.equal(f.context.options.airframes, 3);
  assert.equal(f.acquired(), 1);
  assert.equal(
    canonicalJSON(JSON.parse(JSON.stringify(f.context.run.appearance))),
    canonicalJSON(f.appearance),
  );
});

test('actual native preparation rejects changed appearance before retiring the current renderer or adopting settings', async () => {
  const f = prepareFixture(),
    oldRun = f.context.run,
    oldOptions = f.context.options;
  await assert.rejects(
    f.prepare({
      nextProject: f.context.project,
      nextSeed: 7,
      retainedRun: structuredClone(oldRun),
      restoreOptions: { ...oldOptions, airframes: 3 },
      expectedAppearance: { ...f.appearance, familyRevision: 'different' },
    }),
    /appearance differs/,
  );
  assert.equal(f.context.run, oldRun);
  assert.equal(f.context.options, oldOptions);
  assert.equal(f.acquired(), 0);
  assert.equal(f.context.runtimeFailed, false);
});

test('native save entry is scoped to player Single Drone and requires retained appearance before adoption', async () => {
  for (const patch of [
    {},
    { mode: { id: 'overflight-riy' } },
    { mode: { id: 'overflight-hunt' } },
    { mode: { id: 'overflight', prototype: true } },
    { studio: true },
    { fixture: 'reference' },
    { reviewBuild: 'fan' },
  ]) {
    let mounted = null,
      adopted = 0,
      prepared = 0;
    const context = {
      mode: { id: 'overflight' },
      studio: false,
      fixture: null,
      reviewBuild: null,
      suspendView: null,
      doc: {},
      shell: { elements: { buttons: { 'home-extra': {} } } },
      text: (key) => key,
      pause: noop,
      run: { phase: 'paused' },
      preparing: false,
      runtimeFailed: false,
      createSurvivalSuspendView: (options) => {
        mounted = options;
        return { opener: {} };
      },
      homeSetup: { after: noop },
      withSuspend: (work) => work(),
      ensureSuspend: async () => ({
        prepareRestore: async () => ({ appearance: null }),
        admitRestore: async () => adopted++,
      }),
      prepare: async () => prepared++,
      ...patch,
    };
    runInNewContext(mount, context);
    if (!Object.keys(patch).length) {
      assert.ok(mounted);
      assert.equal(mounted.opener, context.shell.elements.buttons['home-extra']);
      await assert.rejects(mounted.restore(), /appearance is missing/);
      assert.equal(adopted, 0);
      assert.equal(prepared, 0);
    } else assert.equal(mounted, null);
  }
});

test('native result ownership reuses one durable journal promise across label refreshes', async () => {
  let writes = 0;
  const owner = { phase: 'won' },
    expected = { records: {}, mastery: {} };
  const context = {
    suspendCoordinator: {
      owns: (run) => run === owner,
      finish: async () => {
        writes++;
        return expected;
      },
    },
    savedResultPromises: new WeakMap(),
    retired: false,
    run: owner,
    showStatus: noop,
    text: (key) => key,
  };
  const savedResult = runInNewContext(`${fn('savedResult')}; savedResult`, context);
  assert.equal(savedResult({ phase: 'won' }), null);
  const first = savedResult(owner),
    second = savedResult(owner);
  assert.equal(first, second);
  assert.equal(await first, expected);
  assert.equal(writes, 1);
});

test('renderer preparation failure keeps the old run and setup while exposing existing graphics recovery', async () => {
  const f = prepareFixture(),
    oldRun = f.context.run,
    oldOptions = f.context.options;
  f.context.rendererOwner.acquire = async () => {
    throw new Error('render preparation failed');
  };
  await assert.rejects(
    f.prepare({
      nextProject: f.context.project,
      nextSeed: 7,
      retainedRun: structuredClone(oldRun),
      restoreOptions: { ...oldOptions, airframes: 3 },
      expectedAppearance: f.appearance,
    }),
    /render preparation failed/,
  );
  assert.equal(f.context.run, oldRun);
  assert.equal(f.context.options, oldOptions);
  assert.equal(f.context.runtimeFailed, true);
});

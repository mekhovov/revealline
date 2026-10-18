import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { parse } from 'acorn';
import {
  survivalDemoInventory,
  survivalDemoProject,
  survivalDemoLaunchURL,
  readSurvivalDemoLaunch,
  survivalDemoSessionOptions,
  SURVIVAL_DEMO_SEED,
} from '../demo-modes/survival-catalog.mjs';
import { demoLaunchURL } from '../demo-launch.mjs';
import { createOverflightRun, startOverflight, overflightSummary } from '../overflight/core.mjs';
import { createOverflightRendererOwner } from '../overflight/host-loop.mjs';
import { createOverflightProject, compileOverflightProject } from '../overflight/project.mjs';

const entry = survivalDemoInventory()[0];
const saved = {
  difficulty: 'veteran',
  airframes: 1,
  slowResume: false,
  characterId: 'interceptor',
  flightTraits: true,
};
const source = { ...entry, launchURL: survivalDemoLaunchURL(entry) };

test('Survival Fresh marker admits only finite authored standard setups', () => {
  const params = new URL(source.launchURL).searchParams;
  assert.equal(readSurvivalDemoLaunch(params).levelId, entry.levelId);
  for (const addition of [
    'layout=custom',
    'survival-demo=standard',
    'community=custom',
    'prototype=riy',
    'operation=marathon',
    'studio=overflight',
    'fixture=stress',
    'reviewBuild=fan',
  ]) {
    const invalid = new URLSearchParams(params);
    const [key, value] = addition.split('=');
    invalid.append(key, value);
    assert.equal(readSurvivalDemoLaunch(invalid), null);
  }
  const custom = new URLSearchParams(params);
  custom.set('layout', 'custom');
  assert.equal(readSurvivalDemoLaunch(custom), null);
  assert.throws(() => survivalDemoLaunchURL({ levelId: 'custom' }));
  const options = survivalDemoSessionOptions(saved);
  const project = survivalDemoProject(entry);
  const run = createOverflightRun(compileOverflightProject(project), options);
  assert.equal(project.difficulty, 'standard');
  assert.equal(run.seed, SURVIVAL_DEMO_SEED);
  assert.equal(run.airframes, 3);
  assert.equal(run.slowResume, true);
  assert.equal(run.flight.id, 'balanced');
  assert.equal(options.characterId, saved.characterId, 'cosmetic appearance remains selected');
  assert.equal(saved.difficulty, 'veteran');
});

const app = await readFile(new URL('../overflight/app.mjs', import.meta.url), 'utf8');
const ast = parse(app, { ecmaVersion: 'latest', sourceType: 'module' });
const stack = [ast];
let fresh;
while (stack.length) {
  const node = stack.pop();
  if (node?.type === 'Property' && node.key?.name === 'onFreshStart') {
    fresh = app.slice(node.start, node.end);
    break;
  }
  if (node && typeof node === 'object') stack.push(...Object.values(node).flat());
}
assert.ok(fresh);

for (const preparation of ['success', 'refused', 'failed', 'cancelled'])
  test(`native Survival Fresh ${preparation} preserves saved preferences and guarded ownership`, async () => {
    const bytes = JSON.stringify(saved);
    const project = createOverflightProject({ difficulty: 'veteran', seed: 42, rulesVersion: 4 });
    const compiled = compileOverflightProject(project);
    const original = createOverflightRun(compiled, saved);
    const context = {
      options: { ...saved },
      seed: 42,
      project,
      compiled,
      run: original,
      preparationIdentity: { id: 'origin' },
      selectedInstalled: true,
      epoch: 0,
      retired: false,
      confirmSortieChange: async () => preparation !== 'refused',
      demoLaunchURL,
      readSurvivalDemoLaunch,
      survivalDemoProject,
      survivalDemoSessionOptions,
      URL,
      restoreSortieControls() {},
      refreshOperationView() {},
      updateShell() {},
      shell: { open() {} },
      persistOptions() {
        throw new Error('Fresh cannot persist tuning options.');
      },
      async prepare({ nextProject, nextSeed, launch, retainedRun }) {
        context.epoch++;
        assert.equal(launch, false);
        if (retainedRun) {
          assert.equal(retainedRun, original);
          assert.deepEqual(context.options, saved);
          context.run = retainedRun;
          return true;
        }
        assert.equal(context.options.difficulty, 'standard');
        assert.equal(context.options.airframes, 3);
        assert.equal(context.options.flightTraits, false);
        context.project = nextProject;
        context.compiled = compileOverflightProject(nextProject);
        context.seed = nextSeed;
        context.run = createOverflightRun(context.compiled, context.options);
        if (preparation === 'failed') throw Error('Renderer unavailable');
        return preparation !== 'cancelled';
      },
    };
    const handler = runInNewContext(`({${fresh}}).onFreshStart`, context);
    if (preparation === 'failed')
      await assert.rejects(
        handler(source, () => true),
        /Renderer unavailable/,
      );
    else assert.equal(await handler(source, () => true), preparation === 'success');
    if (preparation === 'success') {
      assert.equal(context.run.phase, 'ready');
      assert.equal(context.run.seed, SURVIVAL_DEMO_SEED);
      assert.equal(
        context.run.compiled.projectIdentity,
        compileOverflightProject(survivalDemoProject(entry)).projectIdentity,
      );
      assert.equal(context.run.airframes, 3);
      assert.equal(context.run.flight.id, 'balanced');
      assert.equal(context.options.airframes, context.run.airframes);
      startOverflight(context.run);
      assert.equal(context.run.phase, 'playing');
      assert.equal(context.run.seed, SURVIVAL_DEMO_SEED);
    } else {
      assert.equal(context.run, original);
      assert.equal(context.seed, 42);
      assert.equal(context.project, project);
      assert.deepEqual(context.options, saved);
    }
    assert.equal(JSON.stringify(saved), bytes);
  });

const prepareNode = ast.body.find(
  (node) => node.type === 'FunctionDeclaration' && node.id.name === 'prepare',
);
assert.ok(prepareNode);
const nativePrepareSource = app.slice(prepareNode.start, prepareNode.end);

async function freshPreparationHarness() {
  let live = true,
    boundary = null,
    reached,
    release;
  const renderers = [];
  const nodes = new Map();
  const noop = () => {};
  const checkpoint = async (stage) => {
    if (boundary !== stage) return;
    boundary = null;
    reached();
    await new Promise((resolve) => (release = resolve));
  };
  const origin = survivalDemoInventory().at(-1);
  const project = createOverflightProject({
    difficulty: 'veteran',
    seed: 42,
    rulesVersion: 4,
    layout: origin.levelId,
    world: origin.world,
  });
  const compiled = compileOverflightProject(project);
  const run = createOverflightRun(compiled, saved);
  startOverflight(run);
  run.phase = 'paused';
  const context = {
    epoch: 0,
    retired: false,
    options: { ...saved },
    seed: 42,
    project,
    compiled,
    run,
    preparationIdentity: null,
    selectedInstalled: true,
    preparing: false,
    runtimeFailed: false,
    renderer: null,
    rendererOwner: createOverflightRendererOwner(),
    mode: { compileProject: compileOverflightProject, createRun: createOverflightRun, pause: noop },
    clipRecorder: null,
    rewardTimer: null,
    win: { clearTimeout: noop },
    $(id) {
      if (!nodes.has(id)) nodes.set(id, { open: false, close: noop });
      return nodes.get(id);
    },
    updateRecoveryControl: noop,
    updateShell: noop,
    releaseInput: noop,
    sound: { pause: noop },
    commentator: null,
    showStatus(message) {
      context.status = message;
    },
    text: (key) => key,
    theme: {
      get ready() {
        return checkpoint('theme');
      },
      snapshot: () => ({ identity: 'theme' }),
      effectivePreferences: () => ({}),
    },
    overflightWorldImageSlots: (presentation) => [presentation.worldId],
    worldSources: {
      async use(slots, consume) {
        await checkpoint('world');
        return consume({ manifestSha256: slots.join(':'), source: 'fixture' });
      },
    },
    selectedArcadeCollection: () => null,
    castPreferences: { snapshot: () => ({ cast: {} }) },
    resolveOverflightCharacter: (_base, id) => ({ id, playerSlot: 'player' }),
    contextGuard: { restore: noop },
    arcade: { clear: noop, setReviewRevision: noop, resolve: (base) => base },
    prepareOverflightCharacters: () => [],
    display: { snapshot: () => ({ effectiveReducedEffects: false }) },
    encounterDisplay: { snapshot: () => ({}) },
    async createOverflightRenderer() {
      const renderer = {
        destroyed: false,
        present: noop,
        destroy() {
          this.destroyed = true;
        },
      };
      renderers.push(renderer);
      await checkpoint('renderer');
      return renderer;
    },
    onFrame: noop,
    music: null,
    fixture: null,
    studio: false,
    review: { active: () => false, reset: noop },
    audio: { reset: noop },
    clock: { reset: noop, clearMeasurements: noop },
    benchmarkProtocol: null,
    refreshCharacters: noop,
    updateHUD: noop,
    refreshOperationView: noop,
    params: new URLSearchParams(),
    shell: { open: noop },
    confirmSortieChange: async () => true,
    demoLaunchURL,
    readSurvivalDemoLaunch,
    survivalDemoProject,
    survivalDemoSessionOptions,
    URL,
    restoreSortieControls: noop,
    persistOptions() {
      throw new Error('Fresh cannot persist tuning options.');
    },
  };
  context.prepare = runInNewContext(`(${nativePrepareSource})`, context);
  const handler = runInNewContext(`({${fresh}}).onFreshStart`, context);
  assert.equal(
    await context.prepare({ nextProject: project, nextSeed: 42, retainedRun: run }),
    true,
  );
  return {
    context,
    renderers,
    run,
    handler: () => handler(source, () => live),
    delay(stage) {
      boundary = stage;
      return new Promise((resolve) => (reached = resolve));
    },
    cancel() {
      live = false;
      release();
    },
  };
}

for (const boundary of ['theme', 'world', 'renderer'])
  test(`Survival Fresh loses ownership during ${boundary} readiness and restores its paused run`, async () => {
    const harness = await freshPreparationHarness();
    const { context, run, renderers } = harness;
    const before = overflightSummary(run);
    const reached = harness.delay(boundary);
    const pending = harness.handler();
    await reached;
    harness.cancel();
    assert.equal(await pending, false);
    assert.equal(context.run, run);
    assert.deepEqual(overflightSummary(context.run), before);
    assert.equal(context.run.phase, 'paused');
    assert.deepEqual(context.options, saved);
    assert.equal(context.seed, 42);
    assert.equal(context.preparing, false);
    assert.equal(context.runtimeFailed, false);
    assert.equal(renderers.filter((renderer) => !renderer.destroyed).length, 1);
    assert.equal(context.renderer.destroyed, false);
    await context.rendererOwner.dispose();
    assert.ok(renderers.every((renderer) => renderer.destroyed));
  });

test('a cancelled Fresh restoration cannot replace a newer ordinary preparation', async () => {
  const harness = await freshPreparationHarness();
  const reached = harness.delay('theme');
  const pending = harness.handler();
  await reached;
  const replacement = { id: 'newer-ordinary-run' };
  harness.context.epoch++;
  harness.context.run = replacement;
  harness.cancel();
  assert.equal(await pending, false);
  assert.equal(harness.context.run, replacement);
  await harness.context.rendererOwner.dispose();
});

test('a failed renderer restoration retains the paused run behind explicit recovery state', async () => {
  const harness = await freshPreparationHarness();
  const reached = harness.delay('renderer');
  const pending = harness.handler();
  await reached;
  harness.context.createOverflightRenderer = async () => {
    throw new Error('Restoration unavailable');
  };
  harness.cancel();
  await assert.rejects(pending, /Restoration unavailable/);
  assert.equal(harness.context.run, harness.run);
  assert.equal(harness.run.phase, 'paused');
  assert.deepEqual(harness.context.options, saved);
  assert.equal(harness.context.preparing, false);
  assert.equal(harness.context.runtimeFailed, true);
  assert.match(harness.context.status, /prepareFailed.*Restoration unavailable/);
  await harness.context.rendererOwner.dispose();
  assert.ok(harness.renderers.every((renderer) => renderer.destroyed));
});

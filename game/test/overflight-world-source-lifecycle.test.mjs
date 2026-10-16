import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { parse } from 'acorn';
import {
  createOverflightWorldSourceQueue,
  createOverflightRendererOwner,
} from '../overflight/host-loop.mjs';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
function sources({ ready = Promise.resolve(), wait = new Map() } = {}) {
  let accepted = { world: 'A', closed: false, manifestSha256: 'custom-manifest', source: {} };
  const calls = [];
  const queue = createOverflightWorldSourceQueue({
    ready,
    initialSlots: ['A'],
    current: () => accepted,
    async load(slots) {
      const world = slots[0];
      calls.push(world);
      await wait.get(world)?.promise;
      accepted.closed = true;
      accepted = { ...accepted, world, closed: false };
    },
  });
  return { queue, calls, current: () => accepted };
}

test('overlapping A→B→A requests restore actual A sources after the obsolete B load', async () => {
  const gate = deferred();
  const source = sources({ wait: new Map([['B', gate]]) });
  const first = source.queue.use(['B'], () => false); // Obsolete app epoch.
  await flush();
  const latest = source.queue.use(['A'], (snapshot) => snapshot.world);
  await flush();
  assert.deepEqual(source.calls, ['B']);
  gate.resolve();
  assert.equal(await first, false);
  assert.equal(await latest, 'A');
  assert.equal(source.current().world, 'A');
  assert.deepEqual(source.calls, ['B', 'A']);
  await source.queue.dispose();
});

test('a pending atlas consumer keeps its decoded images alive until preparation completes', async () => {
  const bake = deferred();
  const source = sources();
  const original = source.current();
  const first = source.queue.use(['A'], async (snapshot) => {
    await bake.promise;
    assert.equal(snapshot.closed, false);
    return snapshot.world;
  });
  await flush();
  const next = source.queue.use(['B'], (snapshot) => snapshot.world);
  await flush();
  assert.deepEqual(source.calls, []);
  assert.equal(original.closed, false);
  bake.resolve();
  assert.equal(await first, 'A');
  assert.equal(await next, 'B');
  assert.equal(original.closed, true);
  await source.queue.dispose();
});

test('load rejection preserves the accepted scene and neither poisons retries nor initial-load recovery', async () => {
  const gate = deferred();
  const wait = new Map([['B', gate]]);
  const source = sources({ wait });
  const rejected = assert.rejects(
    source.queue.use(['B'], () => {}),
    /decode failed/,
  );
  gate.reject(Error('decode failed'));
  await rejected;
  assert.equal(source.current().world, 'A');
  assert.equal(source.current().closed, false);
  wait.delete('B');
  assert.equal(await source.queue.use(['B'], (s) => s.world), 'B');
  assert.deepEqual(source.calls, ['B', 'B']);
  await source.queue.dispose();
  const initial = sources({ ready: Promise.reject(Error('initial decode failed')) });
  assert.equal(await initial.queue.use(['A'], (s) => s.world), 'A');
  assert.deepEqual(initial.calls, ['A']);
  await initial.queue.dispose();
});

test('disposal drains loading work without admitting its consumer or later requests', async () => {
  const gate = deferred();
  const source = sources({ wait: new Map([['B', gate]]) });
  let consumed = false;
  const pending = assert.rejects(
    source.queue.use(['B'], () => {
      consumed = true;
    }),
    /closed/,
  );
  await flush();
  const disposed = source.queue.dispose();
  gate.resolve();
  await Promise.all([pending, disposed]);
  assert.equal(consumed, false);
  await assert.rejects(
    source.queue.use(['A'], () => {}),
    /closed/,
  );
  await assert.rejects(source.queue.settled(), /closed/);
});

test('accepted audio reads wait for preparation and recover after the initial source load fails', async () => {
  const bake = deferred();
  const source = sources({ ready: Promise.reject(Error('initial decode failed')) });
  const app = await readFile(new URL('../overflight/app.mjs', import.meta.url), 'utf8');
  const audio = parse(app, { ecmaVersion: 'latest', sourceType: 'module' })
    .body.flatMap((node) => node.declarations ?? [])
    .find((node) => node.id.name === 'audio');
  const presentation = audio.init.arguments[1].properties.find(
    (node) => node.key.name === 'presentation',
  );
  const method = presentation.value.properties.find((node) => node.key.name === 'readAudio');
  const reads = [];
  const readAudio = runInNewContext(`({${app.slice(method.start, method.end)}}).readAudio`, {
    worldSources: source.queue,
    artwork: {
      readAudio(slot) {
        reads.push([slot, source.current().world]);
        return 'custom audio bytes';
      },
    },
    DESTRUCTION_CUES: ['destroy-human'],
    HUMAN_REACTION_CUES: [],
  });
  const prepared = source.queue.use(['B'], async () => bake.promise);
  const audioBytes = readAudio('audio.destroy-human');
  await flush();
  assert.deepEqual(reads, [], 'Custom audio must not read while source preparation is pending.');
  bake.resolve();
  await prepared;
  assert.equal(await audioBytes, 'custom audio bytes');
  assert.deepEqual(reads, [['audio.destroy-human', 'B']]);
  assert.equal(await readAudio('unsupported.slot'), null);
  await source.queue.dispose();
});

async function nativePreparationFixture({ wait = new Map(), bake = null } = {}) {
  const source = sources({ wait });
  const owner = createOverflightRendererOwner();
  const app = await readFile(new URL('../overflight/app.mjs', import.meta.url), 'utf8');
  const definition = parse(app, { ecmaVersion: 'latest', sourceType: 'module' }).body.find(
    (node) => node.type === 'FunctionDeclaration' && node.id.name === 'prepare',
  );
  const noop = () => {};
  const nodes = new Map();
  const created = [];
  const starts = [];
  const context = {
    run: null,
    project: null,
    compiled: null,
    seed: 42,
    epoch: 0,
    retired: false,
    runtimeFailed: false,
    renderer: null,
    preparing: false,
    worldSources: source.queue,
    rendererOwner: owner,
    options: { characterId: 'carrier', airframes: 3 },
    mode: {
      compileProject: (project) => ({
        ...project,
        projectIdentity: project.world,
        visualIdentity: project.world,
        presentation: { world: project.world },
        resources: { actorArtRevision: 2, effects: {} },
        arena: { width: 2880, height: 1080 },
      }),
      pause: noop,
      createRun: (compiled) => ({ phase: 'ready', compiled }),
    },
    clipRecorder: null,
    win: { clearTimeout: noop },
    rewardTimer: null,
    $: (id) => {
      if (!nodes.has(id)) nodes.set(id, { open: false });
      return nodes.get(id);
    },
    updateRecoveryControl: noop,
    updateShell: noop,
    releaseInput: noop,
    showStatus: noop,
    sound: { pause: noop },
    commentator: null,
    theme: {
      ready: Promise.resolve(),
      snapshot: () => ({ identity: 'accepted-theme' }),
      effectivePreferences: noop,
    },
    overflightWorldImageSlots: (presentation) => [presentation.world],
    selectedArcadeCollection: () => null,
    castPreferences: { snapshot: () => ({ cast: 'authored' }) },
    resolveOverflightCharacter: () => ({ id: 'carrier', playerSlot: 'player.carrier' }),
    contextGuard: { restore: noop },
    arcade: { clear: noop, setReviewRevision: noop, resolve: (base) => base },
    prepareOverflightCharacters: () => [],
    display: { snapshot: () => ({ effectiveReducedEffects: false }) },
    encounterDisplay: { snapshot: () => ({}) },
    createOverflightRenderer: async ({ appearance }) => {
      await bake?.promise;
      assert.equal(
        appearance.snapshot.closed,
        false,
        'Decoded sources must survive atlas preparation.',
      );
      const renderer = { appearance, present: noop, destroy: noop };
      created.push(renderer);
      return renderer;
    },
    onFrame: noop,
    music: null,
    fixture: null,
    studio: false,
    params: new URLSearchParams(),
    review: { active: () => false, reset: noop },
    audio: { reset: noop },
    clock: { reset: noop, clearMeasurements: noop },
    benchmarkProtocol: null,
    refreshCharacters: noop,
    updateHUD: noop,
    refreshOperationView: noop,
    text: (key) => key,
    shell: { enterPlay: noop },
    start: (options) => starts.push(options),
  };
  runInNewContext(
    `${app.slice(definition.start, definition.end)}; globalThis.prepare = prepare;`,
    context,
  );
  return { context, source, owner, created, starts };
}

test('native prepare serializes world changes through asynchronous renderer creation', async () => {
  const bake = deferred();
  const fixture = await nativePreparationFixture({ bake });
  const first = fixture.context.prepare({ nextSeed: 42, nextProject: { world: 'A' } });
  await flush();
  const second = fixture.context.prepare({ nextSeed: 42, nextProject: { world: 'B' } });
  await flush();
  assert.deepEqual(fixture.source.calls, []);
  bake.resolve();
  assert.equal(await first, false);
  assert.equal(await second, true);
  assert.equal(fixture.context.compiled.presentation.world, 'B');
  assert.equal(fixture.context.appearance.snapshot.world, 'B');
  await fixture.source.queue.dispose();
  await fixture.owner.dispose();
});

test('ten native retries retain custom appearance; Marathon scene preparation preserves the carried run', async () => {
  const fixture = await nativePreparationFixture();
  for (let retry = 0; retry < 10; retry++)
    assert.equal(
      await fixture.context.prepare({ nextSeed: 42, nextProject: { world: 'A' } }),
      true,
    );
  assert.equal(fixture.created.length, 1);
  assert.deepEqual(fixture.source.calls, []);
  assert.equal(fixture.context.preparationIdentity.manifestSha256, 'custom-manifest');
  assert.equal(fixture.context.preparationIdentity.characterId, 'carrier');
  const retainedRun = {
    phase: 'ready',
    player: { hull: 37 },
    build: { hunt: { 'boost-duration': 2 } },
    raidVariant: { contract: 2, seed: 42, escrow: 1000 },
  };
  assert.equal(
    await fixture.context.prepare({
      nextSeed: 104771,
      nextProject: { world: 'B' },
      retainedRun,
      launch: true,
    }),
    true,
  );
  assert.equal(fixture.context.run, retainedRun);
  assert.equal(retainedRun.player.hull, 37);
  assert.equal(fixture.starts.at(-1)?.retainRun, true);
  assert.equal(retainedRun.raidVariant.seed, 42);
  await fixture.source.queue.dispose();
  await fixture.owner.dispose();
});

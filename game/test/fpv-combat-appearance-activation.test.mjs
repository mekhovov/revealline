import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../optional-practice/civilian-fpv/vendor/three.module.js';
import { clone as cloneSkeleton } from '../../optional-practice/civilian-fpv/vendor/addons/utils/SkeletonUtils.js';
import { createCombatActorPresentation } from '../../optional-practice/civilian-fpv/combat-actors.mjs';
import { createCombatPresentation } from '../../optional-practice/civilian-fpv/combat-presentation.mjs';
import { createCombatAppearanceActivation } from '../../optional-practice/civilian-fpv/renderer.mjs';

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => (resolve = done));
  return { promise, resolve };
};

function fixture(options = {}) {
  const log = [],
    models = [],
    scenes = [],
    ledger = Object.freeze(['accepted-defeat-1']);
  let generation = 'scene:1',
    serial = 0;
  function consumer(kind, scene) {
    let leases = [];
    const collections = [];
    const method = kind === 'actors' ? 'setAppearanceTemplates' : 'setAppearancePartsTemplates';
    const result = {
      ledger,
      [method](next) {
        for (const lease of leases) lease.release();
        leases = [];
        if (!next) {
          log.push(`${scene.name}:${kind}:clear`);
          return true;
        }
        const incoming = kind === 'actors' ? next.flatMap((item) => item.lods) : next;
        log.push(`${scene.name}:${kind}:accept:${incoming[0]?.pack}`);
        if (options.reject?.({ kind, scene, next })) return false;
        leases = incoming;
        collections.push(next);
        return true;
      },
      prepareMaterials() {
        log.push(`${scene.name}:${kind}:materials`);
        return () => log.push(`${scene.name}:${kind}:restore-materials`);
      },
      prepareTextures(upload) {
        upload(`${scene.name}:${kind}:texture`);
      },
      dispose() {
        result[method](null);
        log.push(`${scene.name}:${kind}:dispose`);
      },
      active: () => leases[0]?.pack ?? null,
      collections,
    };
    scene[kind] = result;
    return result;
  }
  const liveScene = { name: 'live' };
  const live = {
    actors: consumer('actors', liveScene),
    presentation: consumer('parts', liveScene),
  };
  function model(pack) {
    let references = 0,
      ownerDisposed = false;
    const leases = [];
    function lease(kind, index, lod) {
      options.acquire?.({ kind, index, lod });
      const item = {
        pack,
        kind,
        index,
        lod,
        released: false,
        release() {
          assert.equal(item.released, false, 'every acquired lease releases exactly once');
          item.released = true;
          references--;
          log.push(`${pack}:${kind}:${lod}:release`);
        },
      };
      references++;
      leases.push(item);
      return item;
    }
    const result = {
      sha256: `${pack}-hash`,
      manifest: {
        characters: options.characters ?? [
          { file: 'person.glb', root: 'close', lods: ['medium', 'low'], parts: {} },
        ],
      },
      createActorLease(index, { lod }) {
        return lease('actor', index, lod);
      },
      createPartsLease(index) {
        return lease('parts', index, 0);
      },
      prepareTextures(upload) {
        upload(`${pack}:atlas`);
      },
      dispose() {
        assert.equal(ownerDisposed, false, 'owner releases exactly once');
        assert.equal(references, 0, 'consumers release before model owner');
        ownerDisposed = true;
        log.push(`${pack}:owner:dispose`);
      },
      leases,
      references: () => references,
      disposed: () => ownerDisposed,
    };
    models.push(result);
    return result;
  }
  const activation = createCombatAppearanceActivation({
    generation: () => generation,
    targets: () => live,
    makeScene() {
      const scene = { name: `stage-${++serial}` };
      scenes.push(scene);
      return scene;
    },
    createActors: (scene) => consumer('actors', scene),
    createPresentation: (scene) => consumer('parts', scene),
    upload: (texture) => log.push(`upload:${texture}`),
    async prepareModels(pack, { signal }) {
      log.push(`prepare:${pack}`);
      await options.decode?.(pack, signal);
      return model(pack);
    },
    async prepareScene(scene, { signal }) {
      log.push(`${scene.name}:compile`);
      await options.compile?.(scene, signal);
    },
  });
  return {
    activation,
    log,
    models,
    scenes,
    live,
    ledger,
    setGeneration: (value) => (generation = value),
  };
}

function assertReleased(f) {
  for (const model of f.models) {
    assert.equal(model.disposed(), true);
    assert.equal(model.references(), 0);
    assert.ok(model.leases.every((lease) => lease.released));
  }
}

test('optional appearance prewarms every LOD before live activation and preserves accepted records', async () => {
  const gate = deferred();
  const f = fixture({ compile: () => gate.promise });
  const pending = f.activation.set('realistic');
  for (let i = 0; i < 20 && f.scenes.length < 1; i++) await Promise.resolve();
  assert.equal(f.scenes.length, 1);
  assert.equal(f.live.actors.active(), null);
  assert.equal(f.live.presentation.active(), null);
  assert.deepEqual(f.activation.status(), { state: 'loading', error: null });
  gate.resolve();
  assert.equal(await pending, true);
  assert.equal(f.live.actors.active(), 'realistic');
  assert.equal(f.live.presentation.active(), 'realistic');
  assert.equal(f.live.presentation.ledger, f.ledger);
  assert.deepEqual(f.ledger, ['accepted-defeat-1']);
  assert.deepEqual(f.activation.status(), {
    state: 'ready',
    error: null,
    sha256: 'realistic-hash',
    characterIndex: null,
    characters: 1,
  });
  assert.deepEqual(
    f.models[0].leases.filter((item) => item.kind === 'actor').map((item) => item.lod),
    [0, 1, 2, 0, 1, 2],
  );
  assert.equal(f.models[0].references(), 4);
  for (const scene of f.scenes) {
    assert.ok(
      f.log.indexOf(`upload:${scene.name}:actors:texture`) < f.log.indexOf(`${scene.name}:compile`),
    );
    assert.ok(
      f.log.indexOf(`upload:${scene.name}:parts:texture`) < f.log.indexOf(`${scene.name}:compile`),
    );
    assert.ok(f.log.includes(`${scene.name}:actors:restore-materials`));
    assert.ok(f.log.includes(`${scene.name}:parts:restore-materials`));
  }
  assert.equal(await f.activation.set(null), true);
  assert.equal(f.live.actors.active(), null);
  assert.equal(f.live.presentation.active(), null);
  assertReleased(f);
  f.activation.reset();
  assert.deepEqual(f.activation.status(), { state: 'current', error: null });
});

test('staging shader failure retains Current and releases all staging resources', async () => {
  const f = fixture({
    compile: () => {
      throw new Error('Shader compile failed');
    },
  });
  assert.equal(await f.activation.set('bad'), false);
  assert.deepEqual(f.activation.status(), { state: 'error', error: 'Shader compile failed' });
  assert.equal(f.live.actors.active(), null);
  assert.equal(f.live.presentation.active(), null);
  assert.ok(f.log.includes('stage-1:actors:restore-materials'));
  assert.ok(f.log.includes('stage-1:parts:restore-materials'));
  assertReleased(f);
});

for (const stage of ['staging', 'live']) {
  test(`rejected ${stage} parts release both incoming and transferred actor leases`, async () => {
    const f = fixture({
      reject: ({ kind, scene }) =>
        kind === 'parts' && (stage === 'live' ? scene.name === 'live' : scene.name !== 'live'),
    });
    assert.equal(await f.activation.set('unsupported'), false);
    assert.equal(f.activation.status().state, 'error');
    assert.equal(f.live.actors.active(), null);
    assert.equal(f.live.presentation.active(), null);
    assertReleased(f);
  });
}

test('already cancelled appearance never starts decoding', async () => {
  const f = fixture(),
    controller = new AbortController();
  controller.abort();
  assert.equal(await f.activation.set('cancelled', { signal: controller.signal }), false);
  assert.equal(f.log.includes('prepare:cancelled'), false);
  assert.deepEqual(f.activation.status(), { state: 'current', error: null });
});

test('cancellation while staging cannot activate and releases the candidate', async () => {
  const gate = deferred(),
    controller = new AbortController();
  const f = fixture({ compile: () => gate.promise });
  const pending = f.activation.set('cancelled', { signal: controller.signal });
  for (let i = 0; i < 10 && !f.scenes.length; i++) await Promise.resolve();
  controller.abort();
  gate.resolve();
  assert.equal(await pending, false);
  assert.equal(f.live.actors.active(), null);
  assert.deepEqual(f.activation.status(), { state: 'current', error: null });
  assertReleased(f);
});

test('a superseded decoder cannot replace or clear newer ready art', async () => {
  const gate = deferred();
  const f = fixture({ decode: (pack) => (pack === 'old' ? gate.promise : undefined) });
  const old = f.activation.set('old');
  assert.equal(await f.activation.set('new'), true);
  gate.resolve();
  assert.equal(await old, false);
  assert.equal(f.live.actors.active(), 'new');
  assert.equal(f.live.presentation.active(), 'new');
  assert.equal(f.activation.status().sha256, 'new-hash');
  assert.equal(f.models.find((model) => model.sha256 === 'old-hash').disposed(), true);
  assert.equal(f.models.find((model) => model.sha256 === 'new-hash').disposed(), false);
  f.activation.reset();
  assertReleased(f);
});

for (const reason of ['reset', 'generation', 'context-loss']) {
  test(`${reason} during loading leaves Current and releases stale resources`, async () => {
    const gate = deferred();
    const f = fixture({ decode: () => gate.promise });
    const pending = f.activation.set('stale');
    if (reason === 'reset') f.activation.reset();
    else f.setGeneration(reason === 'context-loss' ? null : 'scene:2');
    gate.resolve();
    assert.equal(await pending, false);
    assert.equal(f.live.actors.active(), null);
    assert.deepEqual(f.activation.status(), { state: 'current', error: null });
    assertReleased(f);
  });
}

test('invalid character and decode errors are plain bounded status with no live activation', async () => {
  const f = fixture();
  assert.equal(await f.activation.set('bad-index', { characterIndex: -1 }), false);
  assert.equal(f.activation.status().error, 'Unknown appearance character.');
  assertReleased(f);
  const bad = fixture({
    decode: () => {
      throw new Error('x'.repeat(500));
    },
  });
  assert.equal(await bad.activation.set('invalid'), false);
  assert.equal(bad.activation.status().error.length, 240);
  assert.equal(bad.live.actors.active(), null);
  assert.equal(bad.models.length, 0);
});

// Older presentation factories can still serve the default art without optional
// appearance setters. Clearing/resetting must remain compatible with those hosts.
test('default-only presentation consumers remain valid when optional art is cleared', async () => {
  const activation = createCombatAppearanceActivation({
    targets: () => ({ actors: {}, presentation: {} }),
  });
  activation.reset();
  assert.equal(await activation.set(null), true);
  assert.deepEqual(activation.status(), { state: 'current', error: null });
});

test('full roster defaults to every character, prewarms shared roots once, and shares one decoded owner', async () => {
  const characters = [
    {
      family: 'courier',
      cast: 'rivals',
      file: 'person.glb',
      root: 'close',
      lods: ['medium', 'low'],
      parts: { head: { mesh: 'head', cap: 'head-cap' } },
    },
    {
      family: 'patroller',
      cast: 'tactical',
      file: 'person.glb',
      root: 'close',
      lods: ['medium', 'low'],
      parts: { head: { mesh: 'head', cap: 'head-cap' } },
    },
    {
      family: 'lookout',
      cast: 'arcade',
      file: 'second.glb',
      root: 'close',
      lods: ['medium', 'low'],
      parts: { head: { mesh: 'head', cap: 'head-cap' } },
    },
  ];
  const f = fixture({ characters });
  assert.equal(await f.activation.set('roster'), true);
  assert.equal(f.models.length, 1);
  assert.equal(f.scenes.length, 1);
  assert.equal(f.scenes[0].actors.collections[0].flatMap((item) => item.lods).length, 6);
  assert.equal(f.scenes[0].parts.collections[0].length, 2);
  assert.deepEqual(
    f.live.actors.collections[0].map((item) => [item.characterIndex, item.lods.length]),
    [
      [0, 3],
      [1, 3],
      [2, 3],
    ],
  );
  assert.equal(f.live.presentation.collections[0].length, 3);
  assert.equal(f.models[0].references(), 12);
  assert.equal(f.activation.status().characters, 3);
  assert.equal(f.activation.status().characterIndex, null);
  assert.equal(f.log.filter((line) => line === 'upload:roster:atlas').length, 1);
  f.activation.reset();
  assertReleased(f);
});

test('explicit representative character retains every LOD without loading other characters', async () => {
  const f = fixture({
    characters: [
      { file: 'shared.glb', root: 'first', lods: ['first-far'], parts: {} },
      { file: 'shared.glb', root: 'second', lods: ['second-far'], parts: {} },
    ],
  });
  assert.equal(await f.activation.set('representative', { characterIndex: 1 }), true);
  assert.deepEqual(
    f.live.actors.collections[0].map((item) => item.characterIndex),
    [1],
  );
  assert.ok(f.models[0].leases.every((lease) => lease.index === 1));
  assert.equal(f.activation.status().characterIndex, 1);
  assert.equal(f.activation.status().characters, 1);
  assert.deepEqual(
    f.live.actors.collections[0][0].lods.map((lease) => lease.lod),
    [0, 1],
  );
  f.activation.reset();
  assertReleased(f);
});

test('partial roster lease acquisition failure releases previously acquired leases', async () => {
  const f = fixture({
    acquire: ({ kind, lod }) => {
      if (kind === 'actor' && lod === 2) throw new Error('LOD unavailable');
    },
  });
  assert.equal(await f.activation.set('partial'), false);
  assert.deepEqual(f.activation.status(), { state: 'error', error: 'LOD unavailable' });
  assert.equal(f.live.actors.active(), null);
  assertReleased(f);
});

test('cancellation releases staged resources even when graphics compilation never completes', async () => {
  const controller = new AbortController();
  const f = fixture({ compile: () => new Promise(() => {}) });
  const pending = f.activation.set('interrupted-graphics', { signal: controller.signal });
  for (let i = 0; i < 20 && !f.log.includes('stage-1:compile'); i++) await Promise.resolve();
  assert.ok(f.log.includes('stage-1:compile'));
  controller.abort();
  assert.equal(await pending, false);
  assert.deepEqual(f.activation.status(), { state: 'current', error: null });
  assertReleased(f);
});

// Real Three.js rigs and the actual presentation consumers exercise the lease
// boundary; this is a CPU lifecycle/LOD test, not a GPU or visual-quality gate.
test('full-roster activation drives real consumers, changes LOD without reloading, and preserves remains', async () => {
  const source = new THREE.Group(),
    geometry = [],
    skeletons = [],
    parts = {};
  const texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  const material = new THREE.MeshStandardMaterial({ map: texture });
  const rig = (name, width) => {
    const root = new THREE.Group(),
      hip = new THREE.Bone();
    root.name = name;
    hip.name = 'hip';
    root.add(hip);
    const shape = new THREE.BoxGeometry(width, 1, 0.3);
    shape.translate(0, 0.5, 0);
    geometry.push(shape);
    const count = shape.attributes.position.count,
      weights = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) weights[i * 4] = 1;
    shape.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(count * 4), 4));
    shape.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
    const mesh = new THREE.SkinnedMesh(shape, material),
      skeleton = new THREE.Skeleton([hip]);
    root.add(mesh);
    source.add(root);
    root.updateMatrixWorld(true);
    mesh.bind(skeleton);
    skeletons.push(skeleton);
    return root;
  };
  const roots = [rig('close', 0.5), rig('far', 0.4)];
  for (const name of ['head', 'torso', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg']) {
    const shape = new THREE.BoxGeometry(0.2, 0.25, 0.2),
      capShape = new THREE.BoxGeometry(0.2, 0.01, 0.2);
    const mesh = new THREE.Mesh(shape, material),
      cap = new THREE.Mesh(capShape, material);
    mesh.name = name;
    cap.name = `${name}-cap`;
    mesh.position.y = 0.5;
    cap.position.y = 0.625;
    source.add(mesh, cap);
    geometry.push(shape, capShape);
    parts[name] = { mesh, cap };
  }
  source.updateMatrixWorld(true);
  const clips = ['idle', 'walk', 'warning'].map(
    (name) =>
      new THREE.AnimationClip(name, 1, [
        new THREE.VectorKeyframeTrack('hip.position', [0, 1], [0, 0, 0, 0.01, 0, 0]),
      ]),
  );
  const characters = ['courier', 'patroller'].map((family) => ({
    family,
    cast: 'tactical',
    file: 'shared.glb',
    root: 'close',
    lods: ['far'],
    parts: Object.fromEntries(
      Object.entries(parts).map(([name, part]) => [
        name,
        { mesh: part.mesh.name, cap: part.cap.name },
      ]),
    ),
  }));
  let references = 0,
    decodes = 0,
    released = 0,
    prepared = 0;
  const lease = (index) => {
    references++;
    let active = true;
    return {
      ready: true,
      sha256: 'a'.repeat(64),
      family: characters[index].family,
      cast: 'tactical',
      height: 1,
      radius: 0.25,
      release() {
        assert.equal(active, true);
        active = false;
        references--;
      },
    };
  };
  const models = {
    manifest: { characters },
    sha256: 'a'.repeat(64),
    createActorLease(index, { lod }) {
      return {
        ...lease(index),
        scene: roots[lod],
        clips,
        clone: cloneSkeleton,
        motion: { idle: 'idle', walk: 'walk', warning: 'warning' },
      };
    },
    createPartsLease(index) {
      return { ...lease(index), scene: source, parts };
    },
    prepareTextures(upload) {
      upload(texture);
    },
    dispose() {
      assert.equal(references, 0);
      released++;
      for (const shape of geometry) shape.dispose();
      for (const skeleton of skeletons) skeleton.dispose();
      material.dispose();
      texture.dispose();
    },
  };
  const scene = new THREE.Scene();
  const createActors = (scene) => createCombatActorPresentation({ THREE, scene });
  const createPresentation = (scene) =>
    createCombatPresentation({
      THREE,
      scene,
      detail: 'high',
      preferences: () => ({ blood: true, brutal: true, showRemains: true }),
    });
  const live = { actors: createActors(scene), presentation: createPresentation(scene) };
  const fact = {
    type: 'defeat',
    eventId: 'run:1',
    sourceId: 'courier-source',
    spawnId: 'courier-old',
    tick: 1,
    position: { x: 2000, y: 0, z: 0 },
    normal: { x: 0, y: 1, z: 0 },
    velocity: { x: 8000, y: 0, z: 0 },
    material: 'organic',
    appearance: { family: 'courier', cast: 'tactical', type: 'patrol' },
    surface: { position: { x: 2000, y: 0, z: 0 }, normal: { x: 0, y: 1, z: 0 } },
  };
  live.presentation.observe([fact], { runId: 'run', tick: 1 });
  const records = structuredClone(live.presentation.export().records);
  const activation = createCombatAppearanceActivation({
    generation: () => 'scene',
    targets: () => live,
    createActors,
    createPresentation,
    prepareModels: async () => {
      decodes++;
      return models;
    },
    upload() {},
    prepareScene(stage) {
      let count = 0;
      stage.traverse((node) => {
        if (node.isSkinnedMesh) count++;
      });
      assert.equal(count, 2, 'only the two unique shared rigs are prepared');
      prepared++;
    },
  });
  try {
    assert.equal(await activation.set({}), true);
    assert.equal(prepared, 1);
    assert.equal(decodes, 1);
    assert.equal(references, 6);
    assert.deepEqual(live.presentation.export().records, records);
    const actors = characters.map((appearance, index) => ({
      id: `actor-${index}`,
      sourceId: `source-${index}`,
      position: { x: (index + 1) * 2000, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      radius: 250,
      height: 1000,
      health: 100,
      status: 'active',
      type: 'patrol',
      material: 'organic',
      spawnTick: 0,
      appearance,
    }));
    const before = structuredClone(actors);
    live.actors.setActors(actors, { tick: 50 });
    const render = (x) =>
      live.actors.update({
        tick: 50,
        cameraPosition: new THREE.Vector3(x, 1, 4),
        graphicsQuality: 'high',
      });
    const actorGeometry = () => {
      const result = [];
      scene.traverse((node) => {
        if (node.isSkinnedMesh) result.push(node.geometry);
      });
      return result;
    };
    render(0);
    assert.equal(live.actors.resources().skinnedActors, 2);
    assert.deepEqual(actorGeometry(), [geometry[0], geometry[0]]);
    render(500);
    assert.deepEqual(actorGeometry(), [geometry[1], geometry[1]]);
    render(0);
    assert.deepEqual(actorGeometry(), [geometry[0], geometry[0]]);
    assert.equal(decodes, 1, 'distance changes reuse the decoded owner');
    assert.deepEqual(actors, before, 'LOD never changes accepted actors');
    assert.deepEqual(live.presentation.export().records, records);
    assert.equal(await activation.set(null), true);
    assert.equal(released, 1);
    assert.equal(references, 0);
    assert.deepEqual(live.presentation.export().records, records);
  } finally {
    activation.reset();
    live.actors.dispose();
    live.presentation.dispose();
  }
});

test('prewarming includes differing equipment on otherwise shared body roots', async () => {
  const character = { file: 'shared.glb', root: 'body', lods: ['far'], parts: {} };
  const f = fixture({
    characters: [
      { ...character, equipment: [{ root: 'helmet' }] },
      { ...character, equipment: [{ root: 'shield' }] },
      { ...character, equipment: [{ root: 'shield' }] },
    ],
  });
  assert.equal(await f.activation.set('equipment'), true);
  assert.equal(f.scenes[0].actors.collections[0].flatMap((item) => item.lods).length, 4);
  assert.equal(f.scenes[0].parts.collections[0].length, 2);
  f.activation.reset();
  assertReleased(f);
});

test('prewarming includes distinct v2 region sets on the same shared character rig', async () => {
  const character = { file: 'shared.glb', root: 'body', lods: ['far'] };
  const f = fixture({
    characters: [
      { ...character, regionSet: 'light-uniform' },
      { ...character, regionSet: 'armored-uniform' },
      { ...character, regionSet: 'armored-uniform' },
    ],
  });
  assert.equal(await f.activation.set('regions'), true);
  assert.equal(f.scenes[0].actors.collections[0].flatMap((item) => item.lods).length, 2);
  assert.equal(f.scenes[0].parts.collections[0].length, 2);
  f.activation.reset();
  assertReleased(f);
});

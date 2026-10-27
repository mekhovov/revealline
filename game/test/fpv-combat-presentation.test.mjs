import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../optional-practice/civilian-fpv/vendor/three.module.js';
import { clone as cloneSkinned } from '../../optional-practice/civilian-fpv/vendor/addons/utils/SkeletonUtils.js';
import { ACTOR_FAMILIES, ACTOR_CASTS, actorVisual } from '../hunt/actor-catalog.mjs';
import { INDUSTRIAL_SOLDIER_KITS } from '../hunt/industrial-soldier-kit.mjs';
import {
  COMBAT_EFFECT_LIMITS,
  COMBAT_PRESENTATION_KEY,
  combatFragmentRecipe,
  createCombatPresentation,
  createCombatPresentationPreferences,
  createCombatRemainsLedger,
  normalizeCombatDefeat,
} from '../../optional-practice/civilian-fpv/combat-presentation.mjs';
import {
  createCombatActorPresentation,
  COMBAT_CROWD_PALETTE_BYTES,
} from '../../optional-practice/civilian-fpv/combat-actors.mjs';
import { COMBAT_APPEARANCE_LIMITS } from '../../optional-practice/civilian-fpv/combat-appearance.mjs';
import { updateFlightProjectileBatches } from '../../optional-practice/civilian-fpv/renderer.mjs';

const fact = (index = 1, overrides = {}) => ({
  type: 'defeat',
  eventId: `run:${index}`,
  sourceId: `subject-${index}`,
  spawnId: `life-${index}`,
  tick: index,
  position: { x: index * 20, y: 0, z: 0 },
  normal: { x: 0, y: 1, z: 0 },
  velocity: { x: 8000, y: 0, z: 2000 },
  material: 'organic',
  appearance: { family: 'courier', cast: 'tactical', type: 'patrol' },
  surface: { position: { x: index * 20, y: 0, z: 0 }, normal: { x: 0, y: 1, z: 0 } },
  ...overrides,
});
const snapshot = (scene) =>
  scene.children
    .flatMap((group) => group.children)
    .filter((mesh) => mesh.isInstancedMesh)
    .map((mesh) => ({
      name: mesh.name,
      count: mesh.count,
      matrix: Array.from(mesh.instanceMatrix.array.slice(0, mesh.count * 16)),
      colors: Array.from(mesh.instanceColor?.array.slice(0, mesh.count * 3) ?? []),
    }));

const acceptedFacts = (archive) => ({
  ...archive,
  presentationClock: undefined,
  records: archive.records.map(({ presentation, ...fact }) => fact),
  impactRecords: archive.impactRecords?.map(({ presentation, ...fact }) => fact),
});

test('native and regional pulses share bounded pools and subtract the current render origin', () => {
  const batches = new Map(),
    geometry = new THREE.SphereGeometry(0.055),
    material = new THREE.MeshBasicMaterial();
  const createBatch = (owner) => {
    const key = owner === 'player' ? 'player' : 'other';
    if (!batches.has(key)) {
      const batch = new THREE.InstancedMesh(geometry, material, 64);
      batch.count = 0;
      batches.set(key, batch);
    }
    return batches.get(key);
  };
  const state = {
    projectiles: [
      { id: 1, owner: 'player', position: { x: 193000, y: 2500, z: 66000 } },
      { id: 2, owner: 'enemy', position: { x: 194000, y: 3500, z: 67000 } },
    ],
  };
  const before = structuredClone(state);
  try {
    updateFlightProjectileBatches(state, { batches, createBatch });
    const matrix = new THREE.Matrix4();
    batches.get('player').getMatrixAt(0, matrix);
    assert.deepEqual(new THREE.Vector3().setFromMatrixPosition(matrix).toArray(), [193, 2.5, 66]);
    updateFlightProjectileBatches(state, {
      batches,
      createBatch,
      originMm: { x: 192000, y: 1000, z: 64000 },
    });
    batches.get('player').getMatrixAt(0, matrix);
    assert.deepEqual(new THREE.Vector3().setFromMatrixPosition(matrix).toArray(), [1, 1.5, 2]);
    batches.get('other').getMatrixAt(0, matrix);
    assert.deepEqual(new THREE.Vector3().setFromMatrixPosition(matrix).toArray(), [2, 2.5, 3]);
    assert.deepEqual(state, before);
    assert.throws(
      () =>
        updateFlightProjectileBatches(
          {
            projectiles: Array.from({ length: 100 }, (_, id) => ({ ...state.projectiles[0], id })),
          },
          { batches, createBatch },
        ),
      /capacity exceeded/,
      'an unrenderable projectile is rejected instead of silently hidden',
    );
    assert.equal(batches.get('player').count, 64);
    assert.equal(batches.get('other').count, 0);
    updateFlightProjectileBatches({}, { batches, createBatch });
    assert.ok([...batches.values()].every((batch) => batch.count === 0 && !batch.visible));
  } finally {
    for (const batch of batches.values()) batch.dispose();
    geometry.dispose();
    material.dispose();
  }
});

test('shader preparation exposes every empty colored pool without fabricating actors or remains', () => {
  const scene = new THREE.Scene();
  const effects = createCombatPresentation({ THREE, scene });
  const actors = createCombatActorPresentation({ THREE, scene });
  try {
    const pools = scene.children.flatMap((group) => group.children);
    assert.equal(pools.length, 17);
    assert.ok(
      pools.every(
        (mesh) =>
          mesh.count === 0 &&
          !mesh.visible &&
          (mesh.instanceColor || mesh.name.startsWith('combat-health-')),
      ),
    );
    const finishEffects = effects.prepareMaterials(),
      finishActors = actors.prepareMaterials();
    assert.ok(pools.every((mesh) => mesh.visible && mesh.count === 0));
    finishEffects();
    finishActors();
    assert.ok(pools.every((mesh) => !mesh.visible && mesh.count === 0));
    assert.equal(effects.resources().stored, 0);
    assert.equal(actors.resources().actors, 0);
  } finally {
    effects.dispose();
    actors.dispose();
  }
});

test('combat remains are bounded independent facts, survive restore, and reject a foreign attempt atomically', () => {
  const ledger = createCombatRemainsLedger();
  for (let i = 1; i <= 1100; i++) ledger.add([fact(i)], { runId: 'run', tick: i });
  assert.equal(ledger.snapshot().stored, 1024);
  assert.equal(ledger.snapshot().evicted, 76);
  assert.equal(ledger.records()[0].eventId, 'run:77');
  assert.deepEqual(ledger.add([fact(1100)], { runId: 'run', tick: 1100 }), []);
  const saved = ledger.export(),
    restored = createCombatRemainsLedger();
  restored.restore(saved, { runId: 'run' });
  assert.deepEqual(restored.export(), saved);
  saved.records[0].position.x = 12345;
  assert.notEqual(restored.records()[0].position.x, 12345);
  const before = restored.export();
  assert.throws(() => restored.restore(saved, { runId: 'other' }), /Invalid/);
  assert.deepEqual(restored.export(), before);
  ledger.add([fact(1)], { runId: 'next', tick: 1 });
  assert.equal(ledger.snapshot().stored, 1);
});

test('all shared families and casts keep their wardrobe and exact equipment in clean and graphic recipes', () => {
  for (const family of ACTOR_FAMILIES)
    for (const cast of ACTOR_CASTS) {
      const record = normalizeCombatDefeat(
        fact(1, { appearance: { family: family.id, cast: cast.id } }),
      );
      const palette = actorVisual(family.id, cast.id).palette;
      const bloody = combatFragmentRecipe(record, { brutal: true, blood: true });
      assert.ok(bloody.some((piece) => piece.tint === palette.coat));
      assert.ok(bloody.some((piece) => piece.shape === 'wound'));
      assert.ok(bloody.some((piece) => piece.shape === 'bone'));
      for (const settings of [
        { brutal: false, blood: true },
        { brutal: true, blood: false },
      ]) {
        const clean = combatFragmentRecipe(record, settings);
        assert.ok(clean.length > INDUSTRIAL_SOLDIER_KITS[family.id].rectangles.length + 6);
        assert.ok(clean.some((piece) => piece.shape === 'limb'));
        assert.ok(clean.some((piece) => piece.shape === 'round'));
        assert.ok(clean.every((piece) => !['wound', 'bone'].includes(piece.shape)));
        for (const part of clean) assert.ok(part.attachment < clean.length);
      }
    }
  for (const material of ['metal', 'wood', 'glass', 'electronic']) {
    const recipe = combatFragmentRecipe(normalizeCombatDefeat(fact(1, { material })), {
      brutal: true,
      blood: true,
    });
    assert.ok(recipe.every((piece) => !['wound', 'bone'].includes(piece.shape)));
  }
});

test('ledger ordering revisions change only with accepted membership or a successful reset/restore', () => {
  const ledger = createCombatRemainsLedger();
  let revision = ledger.revision();
  ledger.add([], { tick: 20 });
  assert.equal(ledger.revision(), revision);
  ledger.add([fact(1)]);
  assert.ok(ledger.revision() > revision);
  revision = ledger.revision();
  ledger.add([fact(1)], { tick: 30 });
  assert.equal(ledger.revision(), revision, 'duplicate facts and elapsed time do not resort rings');
  for (let i = 2; i <= 1024; i++) ledger.add([fact(i)]);
  revision = ledger.revision();
  ledger.add([fact(1025)]);
  assert.equal(ledger.snapshot().stored, 1024);
  assert.ok(ledger.revision() > revision, 'replacement at full capacity invalidates ordering');
  const saved = ledger.export();
  revision = ledger.revision();
  assert.throws(() => ledger.restore({ ...saved, tick: -1 }), /Invalid/);
  assert.equal(ledger.revision(), revision, 'failed restoration leaves the existing order valid');
  ledger.restore(saved);
  assert.ok(ledger.revision() > revision);
  revision = ledger.revision();
  ledger.reset();
  assert.ok(ledger.revision() > revision);
});

test('nearest cosmetic ordering follows new facts, camera motion, recentering and restore', () => {
  const scene = new THREE.Scene(),
    view = createCombatPresentation({
      THREE,
      scene,
      preferences: () => ({ blood: false, brutal: false, showRemains: true }),
    });
  const mark = (i, x) =>
    fact(i, {
      type: 'surface-impact',
      material: 'metal',
      weapon: 'autocannon',
      position: { x, y: 0, z: 0 },
      surface: { position: { x, y: 0, z: 0 }, normal: { x: 0, y: 1, z: 0 } },
    });
  const firstX = () => {
    const matrix = new THREE.Matrix4();
    scene.getObjectByName('combat-mark').getMatrixAt(0, matrix);
    return matrix.elements[12];
  };
  try {
    view.observe([mark(1, -1000), mark(2, 1000)], { tick: 100 });
    view.update({ cameraPosition: { x: -2, y: 0, z: 0 } });
    assert.equal(firstX(), -1);
    view.update({ cameraPosition: { x: -2, y: 0, z: 0 } });
    assert.equal(firstX(), -1, 'unchanged camera and membership reuse the same ordering');
    view.observe([mark(3, -1500)], { tick: 100 });
    view.update({ cameraPosition: { x: -2, y: 0, z: 0 } });
    assert.equal(firstX(), -1.5, 'new records are prioritized at the current camera');
    view.update({ cameraPosition: { x: 2, y: 0, z: 0 } });
    assert.equal(firstX(), 1);
    view.update({ cameraPosition: { x: 1, y: 0, z: 0 }, originMm: { x: 1000, y: 0, z: 0 } });
    assert.equal(firstX(), 0, 'recentered camera keeps the same world-space nearest record');
    view.update();
    assert.equal(firstX(), -1.5, 'without a camera, newer accepted records have priority');
    const archive = view.export();
    archive.impactRecords[2] = mark(3, 4000);
    view.restore(archive);
    view.update();
    assert.equal(firstX(), 4, 'restore with reused IDs invalidates cached record references');
    view.reset();
    view.update();
    assert.equal(scene.getObjectByName('combat-mark').count, 0);
  } finally {
    view.dispose();
  }
});

test('full bullet-mark quota avoids querying invisible impact support', () => {
  let queries = 0;
  const scene = new THREE.Scene(),
    view = createCombatPresentation({
      THREE,
      scene,
      preferences: () => ({ blood: false, brutal: false, showRemains: true }),
      groundQuery: (point) => {
        queries++;
        return { position: { ...point, y: 0 }, normal: { x: 0, y: 1, z: 0 } };
      },
    });
  try {
    view.observe(
      Array.from({ length: 100 }, (_, i) =>
        fact(i, {
          type: 'surface-impact',
          material: 'metal',
          weapon: 'autocannon',
        }),
      ),
      { tick: 100 },
    );
    queries = 0;
    view.update({ graphicsQuality: 'low', presentationClock: 5 });
    assert.equal(view.resources().marks, 6);
    assert.equal(queries, 30, 'six visible marks require one center and four corner checks each');
    assert.equal(view.resources().storedImpacts, 100, 'culling keeps every logical impact');
  } finally {
    view.dispose();
  }
});

test('effect tiers bound complete clusters, motion, surface marks, and draw calls at full ledger capacity', () => {
  for (const [detail, graphicsQuality, tier] of [
    ['ultra', 'low', 'low'],
    ['high', 'balanced', 'high'],
    ['ultra', 'high', 'ultra'],
  ]) {
    const scene = new THREE.Scene(),
      view = createCombatPresentation({
        THREE,
        scene,
        detail,
        preferences: () => ({ brutal: true, blood: true, showRemains: true }),
      });
    try {
      const facts = Array.from({ length: 1024 }, (_, i) =>
        fact(i + 1, { tick: i < 1016 ? 10 : 100 }),
      );
      view.observe(facts, { runId: 'run', tick: 105 });
      const limits = COMBAT_EFFECT_LIMITS[tier];
      for (const presentationClock of [2.1, 3]) {
        view.update({ tick: 105, presentationClock, graphicsQuality });
        const result = view.resources();
        assert.equal(result.stored, 1024);
        assert.equal(result.tier, tier);
        assert.ok(result.moving <= limits.moving);
        assert.ok(result.settled <= limits.settled);
        assert.ok(result.marks <= limits.marks);
        assert.ok(result.bursts <= limits.bursts);
        assert.ok(result.calls <= limits.calls);
        assert.ok(result.moving + result.settled > 0);
      }
      // Low detail keeps complete connected bodies. Their travel time is not
      // a missing-ground failure; verify actual settling after that travel.
      const result = view.resources();
      assert.ok(result.settled > 0);
      assert.ok(result.marks > 0);
      assert.equal(scene.getObjectByName('combat-cloth').castShadow, false);
    } finally {
      view.dispose();
    }
    assert.equal(scene.children.length, 0);
  }
});

test('pause and camera rendering do not advance motion; reduced effects retains grounded remains', () => {
  const scene = new THREE.Scene(),
    prefs = { brutal: true, blood: true, showRemains: true };
  const view = createCombatPresentation({ THREE, scene, preferences: () => prefs });
  try {
    view.observe([fact()], { runId: 'run', tick: 8 });
    view.update({ tick: 8 });
    const first = snapshot(scene);
    view.update({ tick: 8 });
    assert.deepEqual(snapshot(scene), first);
    view.update({ tick: 8, reducedMotion: true });
    assert.equal(view.resources().moving, 0);
    assert.ok(view.resources().settled > 0);
    prefs.showRemains = false;
    view.update({ tick: 8 });
    assert.equal(view.resources().settled, 0);
    assert.equal(view.resources().marks, 0);
    assert.ok(view.resources().moving > 0);
    prefs.blood = false;
    view.update({ tick: 8 });
    assert.equal(scene.getObjectByName('combat-wound').count, 0);
    assert.equal(scene.getObjectByName('combat-bone').count, 0);
  } finally {
    view.dispose();
  }
});

test('effect detail can be supplied by the host preference getter without recreating presentation', () => {
  let detail = 'high';
  const scene = new THREE.Scene();
  const view = createCombatPresentation({ THREE, scene, detail: () => detail });
  try {
    view.update({ graphicsQuality: 'high' });
    assert.equal(view.resources().tier, 'high');
    detail = 'ultra';
    view.update({ graphicsQuality: 'high' });
    assert.equal(view.resources().tier, 'ultra');
    view.configure({ detail: () => 'high' });
    view.update({ graphicsQuality: 'high' });
    assert.equal(view.resources().tier, 'high');
  } finally {
    view.dispose();
  }
});

test('automatic detail recovers at ordinary 60 Hz while retaining the overall graphics cap', () => {
  const view = createCombatPresentation({ THREE, scene: new THREE.Scene(), detail: 'auto' });
  try {
    for (let frame = 0; frame < 95; frame++) view.update({ graphicsQuality: 'high', frameMs: 30 });
    assert.equal(view.resources().tier, 'high');
    assert.equal(view.resources().pressureReduced, true);
    for (let frame = 0; frame < 305; frame++)
      view.update({ graphicsQuality: 'high', frameMs: 1000 / 60 });
    assert.equal(view.resources().tier, 'high');
    assert.equal(view.resources().pressureReduced, false);
    view.update({ graphicsQuality: 'low', frameMs: 1000 / 60 });
    assert.equal(view.resources().tier, 'low');
  } finally {
    view.dispose();
  }
});

test('archive restore rebuilds settled pieces without replaying an historical burst and rebases every matrix', () => {
  const scene = new THREE.Scene(),
    view = createCombatPresentation({
      THREE,
      scene,
      preferences: () => ({ brutal: true, blood: true, showRemains: true }),
    });
  try {
    view.observe([fact()], { runId: 'run', tick: 2 });
    view.update({ tick: 2, presentationClock: 4 });
    const saved = view.export();
    view.restore(saved, { runId: 'run' });
    view.update({ tick: 2, presentationClock: 4 });
    assert.equal(view.resources().moving, 0);
    const old = scene.getObjectByName('combat-cloth').instanceMatrix.array.slice(0, 16);
    view.update({ tick: 2, originMm: { x: 100000, y: 2000, z: -3000 } });
    const next = scene.getObjectByName('combat-cloth').instanceMatrix.array;
    assert.ok(Math.abs(next[12] - old[12] + 100) < 0.00001);
    assert.ok(Math.abs(next[13] - old[13] + 2) < 0.00001);
    assert.ok(Math.abs(next[14] - old[14] - 3) < 0.00001);
    assert.deepEqual(view.export(), saved);
  } finally {
    view.dispose();
  }
});

test('unknown surfaces receive no blood decals; accepted ground queries and direction produce deterministic effects', () => {
  const scene = new THREE.Scene(),
    source = fact(1, { surface: null }),
    original = structuredClone(source);
  const view = createCombatPresentation({
    THREE,
    scene,
    preferences: () => ({ brutal: true, blood: true, showRemains: true }),
  });
  try {
    view.observe([source], { runId: 'run', tick: 2 });
    view.update({ tick: 2 });
    assert.equal(view.resources().marks, 0);
    view.reset('other');
    view.configure({
      groundQuery: (point) => ({
        position: { x: point.x, y: 200 - ((point.x - 20) * 0.2) / 0.98, z: point.z },
        normal: { x: 0.2, y: 0.98, z: 0 },
      }),
    });
    view.observe([source], { runId: 'other', tick: 2 });
    view.update({ tick: 2 });
    assert.equal(
      view.resources().marks,
      0,
      'spray reaches the surface before its wet mark appears',
    );
    view.update({ tick: 2, presentationClock: 0.2 });
    assert.ok(view.resources().marks > 0);
    assert.deepEqual(source, original);
  } finally {
    view.dispose();
  }
});

test('new detail preferences do not rewrite strict shared gore preferences and restore chosen detail', () => {
  const data = new Map([
    [
      'revealline.destruction.v1',
      '{"format":"DestructionPreferencesV1","brutal":true,"blood":false,"vocals":true}',
    ],
  ]);
  const storage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
  const before = data.get('revealline.destruction.v1');
  const prefs = createCombatPresentationPreferences({ storage, window: {} });
  assert.equal(prefs.snapshot().detail, 'auto');
  prefs.set({ detail: 'ultra' });
  assert.equal(data.get('revealline.destruction.v1'), before);
  assert.ok(data.has(COMBAT_PRESENTATION_KEY));
  const reloaded = createCombatPresentationPreferences({ storage, window: {} });
  assert.equal(reloaded.snapshot().detail, 'ultra');
  assert.throws(() => prefs.set({ artStyle: 'realistic' }), /Unsupported/);
  prefs.dispose();
  reloaded.dispose();
});

test('accepted nonfatal hits provide material feedback without awarding persistent defeat remains', () => {
  const scene = new THREE.Scene(),
    view = createCombatPresentation({
      THREE,
      scene,
      preferences: () => ({ brutal: true, blood: true, showRemains: false }),
    });
  try {
    const hit = fact(1, { type: 'impact', impactPosition: { x: 400, y: 1700, z: 50 } });
    view.observe([hit], { runId: 'run', tick: 1 });
    view.update({ tick: 1 });
    assert.equal(view.resources().stored, 0);
    assert.ok(view.resources().moving > 0);
    assert.ok(scene.getObjectByName('combat-wound').count > 0);
    const matrix = new THREE.Matrix4();
    scene.getObjectByName('combat-wound').getMatrixAt(0, matrix);
    const point = new THREE.Vector3().setFromMatrixPosition(matrix);
    assert.ok(
      point.distanceTo(new THREE.Vector3(0.4, 1.7, 0.05)) < 0.00001,
      'hit particles originate at the accepted contact point rather than the actor foot anchor',
    );
    const saved = normalizeCombatDefeat({ ...hit, type: 'defeat' });
    hit.impactPosition.y = 0;
    assert.equal(saved.impactPosition.y, 1700, 'presentation copies accepted hit facts');
    view.update({ tick: 40 });
    assert.equal(view.resources().moving, 0);
    assert.equal(view.resources().settled, 0);
  } finally {
    view.dispose();
  }
});

test('native family rigs render in four shared batches, animate from ticks, retire dead actors, and release resources', () => {
  const scene = new THREE.Scene(),
    view = createCombatActorPresentation({ THREE, scene });
  const actors = ACTOR_FAMILIES.map((family, i) => ({
    id: `actor-${i}`,
    sourceId: family.id,
    type: 'patrol',
    material: 'organic',
    radius: 350,
    height: 1800,
    position: { x: i * 3000, y: 0, z: 0 },
    velocity: { x: 1000, y: 0, z: 0 },
    heading: { x: 1, y: 0, z: 0 },
    status: 'active',
    health: 50,
    appearance: { family: family.id, cast: 'tactical' },
  }));
  try {
    for (const cast of ACTOR_CASTS) {
      for (const actor of actors) actor.appearance.cast = cast.id;
      view.setActors(actors, { tick: 10 });
      view.update({ tick: 10 });
      assert.equal(view.resources().actors, 12);
      assert.ok(view.resources().calls <= 4);
      const first = snapshot(scene);
      view.update({ tick: 10 });
      assert.deepEqual(snapshot(scene), first);
    }
    actors[0].status = 'defeated';
    view.setActors(actors, { tick: 20 });
    view.update({ tick: 20, originMm: { x: 2000, y: 0, z: 0 } });
    assert.equal(view.resources().actors, 11);
    view.setActors(null);
    view.update();
    assert.equal(view.resources().actors, 0);
    assert.equal(view.resources().templates, 0);
  } finally {
    view.dispose();
  }
  assert.equal(scene.children.length, 0);
});

test('live vehicle rigs follow accepted appearance model changes for the same actor identity', () => {
  const view = createCombatActorPresentation({ THREE, scene: new THREE.Scene() });
  const actor = {
    id: 'vehicle',
    sourceId: 'vehicle',
    type: 'vehicle',
    material: 'metal',
    position: { x: 0, y: 0, z: 0 },
    radius: 900,
    height: 1800,
    status: 'active',
    health: 100,
    appearance: { family: 'patroller', cast: 'tactical', model: 'field-tank' },
  };
  try {
    view.setActors([actor]);
    view.update();
    const tank = view.resources().instances;
    actor.appearance.model = 'cargo-truck';
    view.setActors([actor]);
    view.update();
    assert.notEqual(
      view.resources().instances,
      tank,
      'accepted appearance changes rebuild the model-specific hull and equipment',
    );
    assert.equal(view.resources().templates, 1);
  } finally {
    view.dispose();
  }
});

function syntheticAppearance() {
  const source = new THREE.Group(),
    hip = new THREE.Bone(),
    hinge = new THREE.Bone();
  hip.name = 'hip';
  hinge.name = 'hinge';
  hinge.position.y = 0.5;
  hip.add(hinge);
  source.add(hip);
  const geometry = new THREE.BoxGeometry(0.5, 1, 0.35);
  geometry.translate(0, 0.5, 0);
  const count = geometry.attributes.position.count;
  geometry.setAttribute(
    'skinIndex',
    new THREE.Uint16BufferAttribute(new Uint16Array(count * 4), 4),
  );
  const weights = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) weights[i * 4] = 1;
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  const texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  const material = new THREE.MeshStandardMaterial({ map: texture });
  const mesh = new THREE.SkinnedMesh(geometry, material),
    skeleton = new THREE.Skeleton([hip, hinge]);
  source.add(mesh);
  source.updateMatrixWorld(true);
  mesh.bind(skeleton);
  skeleton.computeBoneTexture();
  const counts = { clones: 0, skeletons: 0, lease: 0, geometry: 0, material: 0, texture: 0 };
  geometry.addEventListener('dispose', () => counts.geometry++);
  material.addEventListener('dispose', () => counts.material++);
  texture.addEventListener('dispose', () => counts.texture++);
  const clip = (name, x) =>
    new THREE.AnimationClip(name, 2, [
      new THREE.VectorKeyframeTrack('hinge.position', [0, 1, 2], [0, 0.5, 0, x, 0.5, 0, 0, 0.5, 0]),
    ]);
  const template = {
    ready: true,
    sha256: 'a'.repeat(64),
    family: 'courier',
    scene: source,
    height: 1,
    radius: 0.25,
    clips: [clip('idle', 0.1), clip('walk', 0.4), clip('run', 0.8)],
    clone(root) {
      counts.clones++;
      const next = cloneSkinned(root);
      next.traverse((node) => {
        if (!node.isSkinnedMesh) return;
        const dispose = node.skeleton.dispose.bind(node.skeleton);
        node.skeleton.dispose = () => {
          counts.skeletons++;
          dispose();
        };
      });
      return next;
    },
    release() {
      counts.lease++;
      skeleton.dispose();
      geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
  const actor = (id) => ({
    id,
    sourceId: 'courier-prototype',
    type: 'patrol',
    material: 'organic',
    radius: 500,
    height: 2000,
    position: { x: 193000, y: 2500, z: 66000 },
    velocity: { x: 1000, y: 0, z: 0 },
    heading: { x: 0, y: 0, z: -1 },
    spawnTick: 50,
    status: 'active',
    health: 50,
    appearance: { family: 'courier', cast: 'tactical' },
  });
  return { source, hip, hinge, geometry, material, texture, skeleton, counts, template, actor };
}

test('admitted appearance leases share model assets, bound skinning, rebase and release each ownership layer', () => {
  const fixture = syntheticAppearance(),
    scene = new THREE.Scene();
  const view = createCombatActorPresentation({ THREE, scene });
  try {
    assert.equal(view.setAppearanceTemplate(fixture.template), true);
    const uploads = [];
    view.prepareTextures((texture) => uploads.push(texture));
    assert.equal(uploads.length, 2, 'one shared map and one owned probe bone texture');
    const finish = view.prepareMaterials();
    const actors = Array.from({ length: 6 }, (_, i) => fixture.actor(`skin-${i}`));
    const before = structuredClone(actors);
    view.setActors(actors, { tick: 75 });
    view.update({ tick: 75, originMm: { x: 192000, y: 1000, z: 64000 } });
    finish();
    assert.equal(view.resources().actors, 6);
    assert.equal(view.resources().skinnedActors, 6);
    assert.equal(view.resources().maxSkinnedActors, 20);
    assert.ok(view.resources().calls <= 8);
    const group = scene.getObjectByName('combat-appearance-skin-0');
    assert.deepEqual(group.position.toArray(), [1, 1.5, 2]);
    const model = group.children[0],
      skin = model.children.find((node) => node.isSkinnedMesh);
    assert.deepEqual(model.scale.toArray(), [2, 2, 2]);
    assert.equal(skin.geometry, fixture.geometry);
    assert.equal(skin.material, fixture.material);
    assert.notEqual(skin.skeleton, fixture.skeleton);
    assert.notEqual(skin.skeleton.bones[0], fixture.hip);
    assert.ok(group.parent, 'preparation cleanup must not detach a probe adopted by a live actor');
    assert.deepEqual(actors, before);
    actors[0].health = 0;
    view.setActors(actors);
    view.update({ tick: 80 });
    assert.equal(view.resources().actors, 5);
    assert.equal(view.resources().skinnedActors, 5);
    assert.equal(fixture.counts.skeletons, 1);
    assert.equal(fixture.counts.geometry, 0);
    assert.equal(fixture.counts.material, 0);
    assert.equal(fixture.counts.texture, 0);
    view.setActors([]);
    view.update();
    assert.equal(fixture.counts.skeletons, fixture.counts.clones);
    assert.equal(fixture.counts.lease, 0, 'empty population retains the transferred cache lease');
  } finally {
    view.dispose();
  }
  assert.equal(fixture.counts.lease, 1);
  assert.equal(fixture.counts.geometry, 1);
  assert.equal(fixture.counts.material, 1);
  assert.equal(fixture.counts.texture, 1);
  assert.equal(scene.children.length, 0);
});

test('skinned animation uses accepted spawn-relative ticks, pauses, rewinds, and honors reduced motion', () => {
  const fixture = syntheticAppearance(),
    scene = new THREE.Scene();
  const view = createCombatActorPresentation({
    THREE,
    scene,
    appearanceTemplate: fixture.template,
  });
  try {
    view.setActors([fixture.actor('animated')]);
    const sample = (tick, reducedMotion = false) => {
      view.update({ tick, reducedMotion });
      return scene.getObjectByName('combat-appearance-animated').getObjectByName('hinge').position
        .x;
    };
    assert.equal(sample(50), 0);
    const moving = sample(75);
    assert.ok(Math.abs(moving - 0.2) < 0.00001);
    assert.equal(sample(75), moving);
    assert.equal(sample(50), 0);
    assert.equal(sample(300, true), 0);
    assert.equal(sample(600, true), 0);
    assert.equal(sample(75), moving);
    assert.equal(fixture.hinge.position.x, 0, 'template and other clones are never animated');
  } finally {
    view.dispose();
  }
});

test('optional positive-Z art follows accepted headings without rotating the source or Current rigs', () => {
  const fixture = syntheticAppearance(),
    scene = new THREE.Scene();
  const view = createCombatActorPresentation({ THREE, scene });
  try {
    assert.equal(view.setAppearanceTemplate({ ...fixture.template, forward: '+z' }), true);
    const actor = { ...fixture.actor('forward'), heading: { x: 1, y: 0, z: 0 } };
    const before = structuredClone(actor);
    view.setActors([actor]);
    view.update({ tick: 100 });
    scene.updateMatrixWorld(true);
    const group = scene.getObjectByName('combat-appearance-forward'),
      model = group.children[0].children[0];
    const direction = new THREE.Vector3(0, 0, 1).transformDirection(model.matrixWorld);
    assert.ok(direction.distanceTo(new THREE.Vector3(1, 0, 0)) < 0.00001);
    assert.equal(fixture.source.rotation.y, 0);
    assert.deepEqual(actor, before);
  } finally {
    view.dispose();
  }
});

test('missing, unready, malformed and failed clone templates fall back atomically to current art', () => {
  const fixture = syntheticAppearance(),
    scene = new THREE.Scene();
  const view = createCombatActorPresentation({ THREE, scene });
  try {
    view.setActors([fixture.actor('fallback')]);
    assert.equal(view.setAppearanceTemplate({ ...fixture.template, ready: false }), false);
    assert.equal(fixture.counts.lease, 0, 'rejected input lease remains owned by caller');
    view.update();
    assert.equal(view.resources().skinnedActors, 0);
    assert.ok(view.resources().calls <= 4);
    assert.equal(
      view.setAppearanceTemplate({ ...fixture.template, clone: () => fixture.source }),
      false,
    );
    assert.equal(fixture.counts.geometry, 0);
    assert.ok(fixture.skeleton.boneTexture);
    assert.equal(view.setAppearanceTemplate(fixture.template), true);
    const clone = fixture.template.clone;
    fixture.template.clone = () => {
      throw new Error('fixture clone failure');
    };
    view.setActors([fixture.actor('first'), fixture.actor('second')]);
    view.update();
    assert.equal(view.resources().appearanceReady, false);
    assert.equal(view.resources().skinnedActors, 0);
    assert.equal(view.resources().actors, 2);
    assert.ok(view.resources().calls <= 4);
    assert.equal(fixture.counts.lease, 1);
    assert.equal(fixture.counts.skeletons, fixture.counts.clones);
    fixture.template.clone = clone;
  } finally {
    view.dispose();
  }
  assert.equal(fixture.counts.lease, 1);
});

test('representative admission rejects excess draws and releases rejected clone-only allocations', () => {
  const fixture = syntheticAppearance(),
    scene = new THREE.Scene();
  const view = createCombatActorPresentation({ THREE, scene });
  let rejectedGeometry = 0,
    rejectedMaterial = 0,
    rejectedTexture = 0,
    closedImage = 0;
  try {
    fixture.texture.source.data = { close: () => closedImage++ };
    const mesh = fixture.source.children.find((node) => node.isSkinnedMesh);
    mesh.material = [fixture.material, fixture.material, fixture.material];
    assert.equal(
      view.setAppearanceTemplate(fixture.template),
      false,
      'six geometry material groups exceed the two-draw ceiling',
    );
    mesh.material = fixture.material;
    const clone = fixture.template.clone;
    assert.equal(
      view.setAppearanceTemplate({
        ...fixture.template,
        clone(root) {
          const copy = clone(root),
            skin = copy.children.find((node) => node.isSkinnedMesh);
          skin.geometry = skin.geometry.clone();
          skin.geometry.addEventListener('dispose', () => rejectedGeometry++);
          skin.material = skin.material.clone();
          skin.material.addEventListener('dispose', () => rejectedMaterial++);
          skin.material.map = skin.material.map.clone();
          skin.material.map.addEventListener('dispose', () => rejectedTexture++);
          return copy;
        },
      }),
      false,
    );
    assert.equal(rejectedGeometry, 1);
    assert.equal(rejectedMaterial, 1);
    assert.equal(rejectedTexture, 1);
    assert.equal(closedImage, 0, 'a copied texture must not close its shared source image');
    assert.equal(fixture.counts.skeletons, 1);
    assert.equal(fixture.counts.geometry, 0);
    assert.equal(fixture.counts.material, 0);
    assert.equal(
      fixture.counts.texture,
      0,
      'shared source texture survives rejection of a copied material',
    );
    assert.equal(fixture.counts.lease, 0);
    assert.equal(view.setAppearanceTemplate(fixture.template), true);
    view.setActors([
      {
        ...fixture.actor('different-family'),
        appearance: { family: 'patroller', cast: 'tactical' },
      },
    ]);
    view.update();
    assert.equal(view.resources().actors, 1);
    assert.equal(view.resources().skinnedActors, 0);
  } finally {
    view.dispose();
  }
  assert.equal(fixture.counts.lease, 1);
});

function syntheticParts() {
  const scene = new THREE.Group(),
    texture = new THREE.Texture(),
    material = new THREE.MeshStandardMaterial({ map: texture }),
    parts = {},
    sourceGeometry = [],
    counts = { lease: 0, geometry: 0, material: 0, texture: 0 };
  material.addEventListener('dispose', () => counts.material++);
  texture.addEventListener('dispose', () => counts.texture++);
  const positions = {
    head: [0, 1.62, 0],
    torso: [0, 1.1, 0],
    leftArm: [-0.35, 1.15, 0],
    rightArm: [0.35, 1.15, 0],
    leftLeg: [-0.15, 0.4, 0],
    rightLeg: [0.15, 0.4, 0],
  };
  for (const [region, position] of Object.entries(positions)) {
    const joint = new THREE.Group(),
      body = new THREE.Group();
    joint.position.set(...position);
    const geometry = new THREE.BoxGeometry(0.2, region === 'head' ? 0.25 : 0.6, 0.2),
      capGeometry = new THREE.CylinderGeometry(0.09, 0.09, 0.02, 8);
    const mesh = new THREE.Mesh(geometry, material),
      cap = new THREE.Mesh(capGeometry, material);
    cap.position.y = region === 'head' ? -0.125 : 0.3;
    body.add(mesh);
    if (region === 'head') {
      const hairGeometry = new THREE.BoxGeometry(0.21, 0.05, 0.21),
        hair = new THREE.Mesh(hairGeometry, material);
      hair.position.y = 0.13;
      body.add(hair);
      sourceGeometry.push(hairGeometry);
    }
    sourceGeometry.push(geometry, capGeometry);
    joint.add(body, cap);
    scene.add(joint);
    parts[region] = { mesh: body, cap };
  }
  for (const geometry of sourceGeometry)
    geometry.addEventListener('dispose', () => counts.geometry++);
  return {
    scene,
    parts,
    sourceGeometry,
    material,
    texture,
    counts,
    lease: {
      ready: true,
      sha256: 'c'.repeat(64),
      family: 'courier',
      cast: 'tactical',
      scene,
      parts,
      height: 1.8,
      radius: 0.35,
      release: () => counts.lease++,
    },
    dispose() {
      for (const geometry of sourceGeometry) geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}

test('authored rigid regions share pack paints, keep caps attached, and preserve archives across art changes', () => {
  const fixture = syntheticParts(),
    scene = new THREE.Scene();
  const effects = createCombatPresentation({
    THREE,
    scene,
    preferences: () => ({ brutal: true, blood: true, showRemains: true }),
    detail: 'high',
  });
  try {
    assert.equal(effects.setAppearanceParts(fixture.lease), true);
    assert.equal(effects.resources().appearanceDrawCalls, 13);
    const uploads = [];
    effects.prepareTextures((map) => uploads.push(map));
    assert.equal(uploads.length, 2);
    assert.equal(uploads[0], fixture.texture);
    assert.ok(uploads[1].isDataTexture, 'clean caps prepare a neutral texture before arming');
    const prepared = effects.prepareMaterials();
    const allBatches = scene.children[0].children.filter((node) =>
      node.name.includes('appearance:'),
    );
    const batches = allBatches.filter((node) => !node.name.endsWith('clean-cap'));
    assert.equal(allBatches.length, 13);
    assert.equal(batches.length, 13);
    assert.ok(
      batches.every(
        (node) => node.visible && node.count === 0 && node.material === fixture.material,
      ),
    );
    assert.ok(batches.every((node) => !fixture.sourceGeometry.includes(node.geometry)));
    prepared();
    effects.observe([fact()], { runId: 'run', tick: 100 });
    effects.update({ tick: 100 });
    assert.ok(batches.every((node) => node.count === 1));
    assert.equal(effects.resources().moving, 0);
    assert.ok(
      effects.resources().settled > 13,
      'the complete base also receives attached wound layers',
    );
    assert.ok(effects.resources().calls >= 14 && effects.resources().calls <= 24);
    const archive = effects.export(),
      before = snapshot(scene);
    effects.update({ tick: 100 });
    assert.deepEqual(snapshot(scene), before);
    const body = batches.find((node) => node.name.includes('leftArm:mesh')),
      cap = batches.find((node) => node.name.includes('leftArm:cap')),
      bodyMatrix = new THREE.Matrix4(),
      capMatrix = new THREE.Matrix4();
    body.getMatrixAt(0, bodyMatrix);
    cap.getMatrixAt(0, capMatrix);
    assert.ok(
      bodyMatrix.elements.every(
        (value, index) => Math.abs(value - capMatrix.elements[index]) < 1e-6,
      ),
      'body and cap share a centered rigid pose, allowing quaternion/Euler roundoff',
    );
    effects.update({ tick: 100, originMm: { x: 128000, y: 0, z: 64000 } });
    const rebased = new THREE.Matrix4();
    body.getMatrixAt(0, rebased);
    assert.ok(Math.abs(rebased.elements[12] - bodyMatrix.elements[12] + 128) < 0.00001);
    assert.ok(Math.abs(rebased.elements[14] - bodyMatrix.elements[14] + 64) < 0.00001);
    assert.equal(effects.setAppearanceParts(null), true);
    assert.equal(fixture.counts.lease, 1);
    assert.equal(fixture.counts.geometry, 0);
    assert.equal(fixture.counts.material, 0);
    assert.equal(fixture.counts.texture, 0);
    effects.update({ tick: 100 });
    assert.equal(effects.resources().moving, 0);
    assert.deepEqual(acceptedFacts(effects.export()), acceptedFacts(archive));
    assert.equal(effects.setAppearanceParts({ ...fixture.lease }), true);
    effects.restore(archive, { runId: 'run' });
    effects.update({ tick: 100 });
    assert.equal(effects.resources().moving, 0, 'restore or new appearance never replays a defeat');
    assert.deepEqual(acceptedFacts(effects.export()), acceptedFacts(archive));
  } finally {
    effects.dispose();
    assert.equal(fixture.counts.geometry, 0);
    fixture.dispose();
  }
  assert.equal(fixture.counts.lease, 2);
});

test('authored remains obey full-ledger budgets, clean treatment and conservative low-detail fallback', () => {
  const fixture = syntheticParts(),
    scene = new THREE.Scene();
  const prefs = { brutal: true, blood: true, showRemains: true };
  const effects = createCombatPresentation({
    THREE,
    scene,
    preferences: () => prefs,
    detail: 'ultra',
  });
  try {
    assert.equal(effects.setAppearanceParts(fixture.lease), true);
    effects.restore(
      Array.from({ length: 1024 }, (_, i) =>
        fact(i + 1, {
          material: i % 3 === 0 ? 'metal' : 'organic',
        }),
      ),
      { runId: 'run', tick: 2000 },
    );
    for (const [graphicsQuality, tier] of [
      ['low', 'low'],
      ['balanced', 'high'],
      ['high', 'ultra'],
    ]) {
      effects.update({ tick: 2000, graphicsQuality });
      const resources = effects.resources(),
        bounds = COMBAT_EFFECT_LIMITS[tier];
      assert.equal(resources.stored, 1024);
      assert.ok(resources.calls <= bounds.calls);
      assert.ok(resources.settled <= bounds.settled);
      assert.ok(resources.marks <= bounds.marks);
      const authored = snapshot(scene).filter((row) => row.name.includes('appearance:'));
      assert.equal(
        authored.some((row) => row.count > 0),
        tier !== 'low',
      );
    }
    prefs.blood = false;
    effects.update({ tick: 2000, graphicsQuality: 'high' });
    assert.ok(
      snapshot(scene)
        .filter((row) => row.name.includes('appearance:') && !row.name.endsWith(':cap'))
        .some((row) => row.count > 0),
    );
    assert.equal(effects.resources().marks, 0);
    prefs.blood = true;
    prefs.brutal = false;
    effects.update({ tick: 2000, graphicsQuality: 'high' });
    assert.ok(
      snapshot(scene)
        .filter((row) => row.name.includes('appearance:') && !row.name.endsWith(':cap'))
        .some((row) => row.count > 0),
    );
    assert.equal(effects.resources().stored, 1024);
  } finally {
    effects.dispose();
    fixture.dispose();
  }
});

test('rejected or missing authored regions retain caller ownership and fall back without losing remains', () => {
  const fixture = syntheticParts(),
    scene = new THREE.Scene();
  const effects = createCombatPresentation({
    THREE,
    scene,
    preferences: () => ({ brutal: true, blood: true }),
  });
  try {
    effects.observe([fact()], { runId: 'run', tick: 100 });
    const archive = effects.export();
    assert.equal(
      effects.setAppearanceParts({ ...fixture.lease, parts: { ...fixture.parts, rightLeg: null } }),
      false,
    );
    assert.equal(fixture.counts.lease, 0);
    assert.equal(effects.resources().registeredPools, 11);
    assert.equal(effects.setAppearanceParts(fixture.lease), true);
    assert.equal(effects.setAppearanceParts({ ...fixture.lease, ready: false }), false);
    assert.equal(fixture.counts.lease, 1);
    assert.equal(effects.resources().registeredPools, 11);
    effects.update({ tick: 100 });
    assert.ok(effects.resources().settled > 0);
    assert.deepEqual(acceptedFacts(effects.export()), acceptedFacts(archive));
    assert.equal(fixture.counts.geometry, 0);
    assert.equal(fixture.counts.material, 0);
  } finally {
    effects.dispose();
    fixture.dispose();
  }
});

test('settled authored regions and their caps remain above an inclined accepted surface', () => {
  const fixture = syntheticParts(),
    scene = new THREE.Scene();
  const effects = createCombatPresentation({
    THREE,
    scene,
    preferences: () => ({ brutal: true, blood: true }),
    detail: 'high',
  });
  try {
    effects.setAppearanceParts(fixture.lease);
    const surface = { position: { x: 20, y: 0, z: 0 }, normal: { x: 0.5, y: 1, z: 0.2 } };
    effects.observe([fact(1, { surface })], { runId: 'slope', tick: 100 });
    effects.update({ tick: 100 });
    const matrix = new THREE.Matrix4(),
      point = new THREE.Vector3(),
      origin = new THREE.Vector3(0.02, 0, 0),
      normal = new THREE.Vector3(0.5, 1, 0.2).normalize();
    for (const mesh of scene.children[0].children.filter(
      (node) => node.name.includes('appearance:') && !node.name.endsWith('clean-cap'),
    )) {
      assert.equal(mesh.count, 1);
      mesh.getMatrixAt(0, matrix);
      const positions = mesh.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i).applyMatrix4(matrix).sub(origin);
        assert.ok(point.dot(normal) >= -0.00001, `${mesh.name} intersects its ground plane`);
      }
    }
  } finally {
    effects.dispose();
    fixture.dispose();
  }
});

test('all 128 Realistic soldiers share bounded baked poses and retain family equipment beyond the skinning limit', () => {
  const fixture = syntheticAppearance(),
    scene = new THREE.Scene();
  const view = createCombatActorPresentation({ THREE, scene });
  for (let i = 0; i < fixture.geometry.attributes.skinIndex.count; i++)
    fixture.geometry.attributes.skinIndex.setX(i, 1);
  const gear = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.2, 0.08),
    new THREE.MeshStandardMaterial(),
  );
  let releases = 0,
    geometryDisposals = 0,
    poolDisposals = 0;
  const entries = ACTOR_FAMILIES.flatMap(({ id: family }) =>
    ACTOR_CASTS.map(({ id: cast }) => ({
      lods: [
        {
          ...fixture.template,
          family,
          cast,
          release: () => releases++,
          equipment: [
            {
              mesh: gear,
              bone: 'hinge',
              bindMatrix: new THREE.Matrix4().makeTranslation(0.1, 0, 0),
              color: [0.25, 0.4, 0.3],
              role: 'kit',
            },
          ],
        },
      ],
    })),
  );
  const actors = Array.from({ length: 128 }, (_, i) => ({
    ...fixture.actor(`crowd-${String(i).padStart(3, '0')}`),
    position: { x: i * 500, y: 0, z: 0 },
    appearance: {
      family: entries[i % entries.length].lods[0].family,
      cast: entries[i % entries.length].lods[0].cast,
    },
  }));
  try {
    const bind = fixture.hinge.position.clone();
    assert.equal(view.setAppearanceTemplates(entries), true);
    assert.deepEqual(
      fixture.hinge.position.toArray(),
      bind.toArray(),
      'baking never changes the shared source rig',
    );
    assert.equal(view.resources().crowdPalettes, 1, 'all36 identities share one body palette');
    assert.ok(
      view.resources().crowdPaletteBytes > 0 &&
        view.resources().crowdPaletteBytes <= COMBAT_CROWD_PALETTE_BYTES,
    );
    assert.ok(view.resources().crowdPoses <= 10);
    const pools = scene.children[0].children.filter(
      (mesh) => mesh.name === 'combat-live-crowd-body',
    );
    for (const mesh of pools) {
      mesh.geometry.addEventListener('dispose', () => geometryDisposals++);
      mesh.addEventListener('dispose', () => poolDisposals++);
      assert.equal(mesh.material, fixture.material);
      assert.notEqual(mesh.geometry, fixture.geometry);
      assert.equal(mesh.geometry.attributes.skinIndex, undefined);
    }
    const finish = view.prepareMaterials();
    assert.ok(
      pools.every((mesh) => mesh.visible),
      'every pose shader is prepared before arming',
    );
    finish();
    assert.ok(pools.every((mesh) => !mesh.visible));
    view.setActors(actors, { tick: 75 });
    view.update({ tick: 75, cameraPosition: { x: 0, y: 0, z: 0 } });
    assert.equal(view.resources().actors, 128);
    assert.equal(view.resources().skinnedActors, 20);
    assert.equal(view.resources().crowdActors, 108);
    assert.equal(view.resources().crowdInstances, 108);
    assert.equal(
      view.resources().instances,
      0,
      'valid Realistic soldiers never fall back to Current primitives',
    );
    const gearBatch = scene.children[0].children.find(
      (mesh) => mesh.name === 'combat-live-equipment',
    );
    assert.equal(gearBatch.count, 128);
    const gearPose = new THREE.Matrix4();
    gearBatch.getMatrixAt(127, gearPose);
    assert.ok(
      Math.abs(gearPose.elements[12] - 64.1) < 0.001,
      'distant equipment uses the body pose sample',
    );
    const before = snapshot(scene);
    view.update({ tick: 75, cameraPosition: { x: 0, y: 0, z: 0 } });
    assert.deepEqual(snapshot(scene), before, 'paused actors retain the same pose allocation');
    view.update({ tick: 100, cameraPosition: { x: 0, y: 0, z: 0 } });
    assert.notDeepEqual(
      snapshot(scene),
      before,
      'accepted time advances the shared motion palette',
    );
    view.update({ tick: 75, cameraPosition: { x: 0, y: 0, z: 0 } });
    assert.deepEqual(snapshot(scene), before, 'replay rewind chooses the same deterministic pose');
    const skin = scene.getObjectByName('combat-appearance-crowd-019');
    actors[20].position.x = 9400;
    view.setActors(actors, { tick: 75 });
    view.update({ tick: 75, cameraPosition: { x: 0, y: 0, z: 0 } });
    assert.equal(
      scene.getObjectByName('combat-appearance-crowd-019'),
      skin,
      'small boundary changes retain skinning hysteresis',
    );
    view.update({ tick: 75, cameraPosition: { x: 70, y: 0, z: 0 }, reducedMotion: true });
    assert.equal(view.resources().actors, 128);
    assert.equal(view.resources().crowdActors, 108);
    assert.equal(view.resources().instances, 0);
    assert.ok(
      scene.getObjectByName('combat-appearance-crowd-127'),
      'nearest actors receive full rigs after camera travel',
    );
    view.setAppearanceTemplate(null);
    assert.equal(geometryDisposals, pools.length);
    assert.equal(poolDisposals, pools.length);
    assert.equal(releases, 36);
    assert.equal(view.resources().crowdPaletteBytes, 0);
    assert.equal(
      fixture.counts.geometry,
      0,
      'palette cleanup never destroys shared source geometry',
    );
  } finally {
    view.dispose();
    gear.geometry.dispose();
    gear.material.dispose();
    fixture.template.release();
  }
});

test('crowd resource admission includes the whole pack and falls back atomically when either limit is exceeded', () => {
  for (const over of ['decodedBytes', 'gpuBytes']) {
    const fixture = syntheticAppearance(),
      scene = new THREE.Scene();
    const view = createCombatActorPresentation({ THREE, scene });
    let released = 0;
    const baseline = { decodedBytes: 107334216, gpuBytes: 129733792 };
    try {
      assert.equal(
        view.setAppearanceTemplate({
          ...fixture.template,
          resourceMetrics: baseline,
          release: () => released++,
        }),
        true,
      );
      const metrics = view.resources().appearanceResourceMetrics;
      assert.equal(
        metrics.decodedBytes,
        baseline.decodedBytes + view.resources().crowdPaletteBytes,
      );
      assert.equal(metrics.gpuBytes, baseline.gpuBytes + view.resources().crowdPaletteGpuBytes);
      assert.ok(metrics.decodedBytes <= COMBAT_APPEARANCE_LIMITS.decodedBytes);
      assert.ok(metrics.gpuBytes <= COMBAT_APPEARANCE_LIMITS.gpuBytes);
      assert.equal(
        view.setAppearanceTemplate({
          ...fixture.template,
          resourceMetrics: { ...baseline, [over]: COMBAT_APPEARANCE_LIMITS[over] },
          release: () => {
            throw new Error('Rejected leases stay with their caller');
          },
        }),
        false,
      );
      assert.equal(released, 1);
      assert.equal(view.resources().appearanceReady, false);
      assert.equal(view.resources().crowdPaletteBytes, 0);
      view.setActors(Array.from({ length: 128 }, (_, i) => fixture.actor(`fallback-${i}`)));
      view.update();
      assert.equal(view.resources().actors, 128);
      assert.equal(view.resources().skinnedActors, 0);
      assert.equal(view.resources().crowdActors, 0);
      assert.ok(view.resources().instances > 0, 'fallback is a complete Current-art crowd');
      assert.equal(fixture.counts.geometry, 0, 'rejection does not release borrowed assets');
    } finally {
      view.dispose();
      fixture.template.release();
    }
  }
});

test('bulk actor palettes cover twenty accepted identities with shared gear, stable LOD and recovery-only braces', () => {
  const live = syntheticAppearance(),
    lod = syntheticAppearance(),
    scene = new THREE.Scene();
  const view = createCombatActorPresentation({ THREE, scene });
  const gear = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.2, 0.08),
    new THREE.MeshStandardMaterial(),
  );
  let released = 0;
  const entries = ACTOR_FAMILIES.flatMap(({ id: family }) =>
    ACTOR_CASTS.map(({ id: cast }) => ({
      lods: [live, lod].map((f) => ({
        ...f.template,
        family,
        cast,
        release: () => released++,
        equipment: [
          {
            mesh: gear,
            bone: 'hinge',
            bindMatrix: new THREE.Matrix4().makeTranslation(0.1, 0, 0),
            color: [0.4, 0.6, 0.8],
            role: 'brace',
            openOffset: [0.2, 0, 0],
          },
        ],
      })),
    })),
  );
  try {
    assert.equal(view.setAppearanceTemplates(entries), true);
    assert.equal(view.resources().appearanceCharacters, 36);
    const actors = entries.slice(0, 20).map((entry, i) => ({
      ...live.actor(`bulk-${i}`),
      position: { x: i * 100, y: 0, z: 0 },
      appearance: { family: entry.lods[0].family, cast: entry.lods[0].cast },
      pursuit: { phase: 'guarding', phaseTicks: 10 },
    }));
    view.setActors(actors, { runId: 'bulk', tick: 100 });
    view.update({ tick: 100, cameraPosition: { x: 0, y: 0, z: 0 }, graphicsQuality: 'high' });
    assert.equal(view.resources().skinnedActors, 20);
    assert.equal(view.resources().equipmentCalls, 1);
    const object = scene.getObjectByName('combat-appearance-bulk-0');
    let mesh;
    object.traverse((n) => {
      if (n.isSkinnedMesh) mesh = n;
    });
    assert.equal(mesh.geometry, live.geometry);
    const gearBatch = scene.children[0].children.find(
      (n) => n.isInstancedMesh && n.geometry === gear.geometry,
    );
    assert.equal(gearBatch.count, 20);
    assert.equal(gearBatch.material, gear.material);
    const closed = new THREE.Matrix4();
    gearBatch.getMatrixAt(0, closed);
    actors[0].warning = true;
    view.setActors(actors, { tick: 100 });
    view.update({ tick: 100, cameraPosition: { x: 0, y: 0, z: 0 }, graphicsQuality: 'high' });
    const warning = new THREE.Matrix4();
    gearBatch.getMatrixAt(0, warning);
    assert.deepEqual(warning.elements, closed.elements);
    actors[0].pursuit = { phase: 'recovering', phaseTicks: 8 };
    view.setActors(actors, { tick: 100 });
    view.update({ tick: 100, cameraPosition: { x: 0, y: 0, z: 0 }, graphicsQuality: 'high' });
    const opened = new THREE.Matrix4();
    gearBatch.getMatrixAt(0, opened);
    assert.ok(opened.elements[12] > closed.elements[12] + 0.3);
    delete actors[0].pursuit;
    actors[0].spawnTick = 0;
    actors[0].warning = false;
    for (const [acceptedTick, expectedOffset] of [
      [59, 0.1],
      [68, 0.3],
      [159, 0.3],
      [160, 0.1],
    ]) {
      view.setActors(actors, { tick: acceptedTick });
      view.update({
        tick: acceptedTick,
        cameraPosition: { x: 0, y: 0, z: 0 },
        graphicsQuality: 'high',
      });
      const gearMatrix = new THREE.Matrix4();
      gearBatch.getMatrixAt(0, gearMatrix);
      const bone = scene.getObjectByName('combat-appearance-bulk-0').getObjectByName('hinge');
      gearMatrix.premultiply(bone.matrixWorld.clone().invert());
      assert.ok(
        Math.abs(gearMatrix.elements[12] - expectedOffset) < 0.00001,
        'unrouted brace follows accepted protection window',
      );
    }

    view.update({ tick: 100, cameraPosition: { x: 0, y: 0, z: 25 }, graphicsQuality: 'high' });
    assert.equal(
      scene.getObjectByName('combat-appearance-bulk-0'),
      object,
      'distance band must keep the existing clone',
    );
    view.update({ tick: 100, cameraPosition: { x: 0, y: 0, z: 500 }, graphicsQuality: 'high' });
    scene.getObjectByName('combat-appearance-bulk-0').traverse((n) => {
      if (n.isSkinnedMesh) mesh = n;
    });
    assert.equal(mesh.geometry, lod.geometry);
    view.update({ tick: 100, cameraPosition: { x: 0, y: 0, z: 0 }, graphicsQuality: 'high' });
    scene.getObjectByName('combat-appearance-bulk-0').traverse((n) => {
      if (n.isSkinnedMesh) mesh = n;
    });
    assert.equal(mesh.geometry, live.geometry);
    assert.equal(view.resources().skinnedActors, 20);
    let incomingReleased = 0;
    assert.equal(
      view.setAppearanceTemplates([
        { lods: [{ ...live.template, release: () => incomingReleased++ }] },
        { lods: [{ ...live.template, release: () => incomingReleased++ }] },
      ]),
      false,
    );
    assert.equal(incomingReleased, 0);
    assert.equal(released, 72);
    assert.equal(view.resources().appearanceReady, false);
  } finally {
    view.dispose();
    live.template.release();
    lod.template.release();
    gear.geometry.dispose();
    gear.material.dispose();
  }
});

test('all-family remains share source geometry, keep clean clothed regions and enforce whole-cluster budgets', () => {
  const fixture = syntheticParts(),
    scene = new THREE.Scene(),
    prefs = { brutal: true, blood: true, showRemains: true };
  const effects = createCombatPresentation({
    THREE,
    scene,
    preferences: () => prefs,
    detail: 'ultra',
  });
  let released = 0;
  const entries = ACTOR_FAMILIES.flatMap(({ id: family }) =>
    ACTOR_CASTS.map(({ id: cast }) => ({
      ...fixture.lease,
      family,
      cast,
      release: () => released++,
    })),
  );
  try {
    assert.equal(effects.setAppearancePartsTemplates(entries), true);
    assert.equal(effects.resources().appearanceCharacters, 36);
    assert.equal(
      effects.resources().registeredPools,
      24,
      '11 Current plus 13 shared authored primitives',
    );
    const facts = Array.from({ length: 1024 }, (_, i) =>
      fact(i, {
        appearance: { family: entries[i % 36].family, cast: entries[i % 36].cast, type: 'patrol' },
      }),
    );
    effects.restore(facts, { runId: 'run', tick: 2000 });
    const accepted = effects.export();
    for (const quality of ['low', 'balanced', 'high']) {
      effects.update({ tick: 2000, graphicsQuality: quality });
      const stats = effects.resources();
      assert.ok(stats.calls <= stats.maxDrawCalls);
      assert.ok(stats.triangles <= stats.maxAppearanceTriangles);
      assert.equal(stats.stored, 1024);
    }
    for (const treatment of [
      { brutal: true, blood: false },
      { brutal: false, blood: true },
    ]) {
      Object.assign(prefs, treatment);
      effects.update({ tick: 2000, graphicsQuality: 'high' });
      const rows = snapshot(scene);
      assert.ok(rows.filter((r) => r.name.endsWith(':mesh')).every((r) => r.count > 0));
      const caps = scene.children[0].children.filter((n) => n.name.endsWith(':cap'));
      assert.ok(caps.every((n) => (treatment.brutal ? n.count > 0 : n.count === 0)));
      assert.ok(caps.every((n) => !n.material.transparent));
      if (!treatment.blood) {
        assert.ok(caps.every((n) => n.material === n.userData.combatCleanMaterial));
        assert.ok(caps.every((n) => n.material.map !== fixture.texture));
        assert.ok(caps.every((n) => n.material.color.getHexString() === '797764'));
      } else assert.ok(caps.every((n) => n.material === fixture.material));
      assert.equal(effects.resources().marks > 0, treatment.blood);
      assert.deepEqual(acceptedFacts(effects.export()), acceptedFacts(accepted));
    }
    let incomingReleased = 0;
    assert.equal(
      effects.setAppearancePartsTemplates([
        { ...fixture.lease, release: () => incomingReleased++ },
        { ...fixture.lease, release: () => incomingReleased++ },
      ]),
      false,
    );
    assert.equal(incomingReleased, 0);
    assert.equal(released, 36);
    assert.equal(effects.resources().appearanceReady, false);
    assert.deepEqual(acceptedFacts(effects.export()), acceptedFacts(accepted));
  } finally {
    effects.dispose();
    fixture.dispose();
  }
});

test('terrain marks reject unsupported corners and revalidate support across streaming recovery', () => {
  let probes = 0,
    available = true;
  const scene = new THREE.Scene(),
    fx = createCombatPresentation({
      THREE,
      scene,
      preferences: () => ({ brutal: true, blood: true, showRemains: true }),
      groundQuery(point, normal, sweep) {
        if (sweep) return admittedPlane(point, normal, sweep);
        probes++;
        return available && point.x < 100
          ? { position: { ...point, y: 0 }, normal: { x: 0, y: 1, z: 0 } }
          : null;
      },
    });
  try {
    fx.observe(
      [
        fact(1, {
          position: { x: 0, y: 0, z: 0 },
          surface: { position: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 1, z: 0 } },
        }),
      ],
      { runId: 'run', tick: 100 },
    );
    fx.update({ tick: 100 });
    // Initial footprint admission is bounded per rendered frame. Drain the
    // small pending queue at a fixed clock before testing cached revalidation.
    for (let frame = 0; frame < 3; frame++) fx.update({ tick: 100 });
    const rows = snapshot(scene),
      mark = rows.find((r) => r.name === 'combat-mark');
    assert.ok(probes > 1);
    assert.ok(mark.count < 4, 'a supported center cannot admit a mark that crosses an edge');
    const after = probes,
      archive = fx.export();
    available = false;
    fx.update({ tick: 100, originMm: { x: 128000, y: 0, z: 0 } });
    assert.equal(probes, after, 'support checks are cached while the clock is paused');
    fx.update({ tick: 100, presentationClock: 2.3 });
    assert.equal(snapshot(scene).find((r) => r.name === 'combat-mark').count, 0);
    fx.restore(archive, { runId: 'run' });
    fx.update({ tick: 100 });
    assert.equal(snapshot(scene).find((r) => r.name === 'combat-mark').count, 0);
    available = true;
    fx.update({ tick: 100, presentationClock: 2.3 });
    assert.equal(snapshot(scene).find((r) => r.name === 'combat-mark').count, mark.count);
  } finally {
    fx.dispose();
  }
});

test('explicit accepted cast matches the live model and survives later global cast changes', async () => {
  const { sharedActorAppearance } = await import('../hunt/preferences.mjs');
  const preference = sharedActorAppearance(),
    previous = preference.snapshot().cast,
    fixture = syntheticAppearance(),
    scene = new THREE.Scene();
  const view = createCombatActorPresentation({ THREE, scene });
  const ledger = createCombatRemainsLedger();
  try {
    await preference.set({ cast: 'arcade' });
    assert.equal(view.setAppearanceTemplate({ ...fixture.template, cast: 'tactical' }), true);
    view.setActors([fixture.actor('cast')], { tick: 100 });
    view.update({ tick: 100 });
    assert.equal(
      view.resources().skinnedActors,
      1,
      'accepted tactical actor must retain its model despite arcade preference',
    );
    ledger.add([fact()], { runId: 'run', tick: 100 });
    const saved = ledger.export();
    assert.equal(saved.records[0].appearance.cast, 'tactical');
    await preference.set({ cast: 'rivals' });
    ledger.restore(saved);
    assert.equal(ledger.export().records[0].appearance.cast, 'tactical');
  } finally {
    view.dispose();
    await preference.set({ cast: previous });
  }
});

test('clean Current bodies use one connected settled transform and keep their clothing', () => {
  const recipe = combatFragmentRecipe(normalizeCombatDefeat(fact()), {
    brutal: false,
    blood: false,
  });
  assert.equal(recipe.filter((part) => part.attachment < 0).length, 1);
  assert.ok(recipe[0].supportSize);
  assert.ok(recipe.some((part) => part.shape === 'limb'));
  assert.ok(recipe.every((part) => !['wound', 'bone'].includes(part.shape)));
});

test('same-region equipment merges without losing any family or cast at High detail', () => {
  const fixture = syntheticParts(),
    scene = new THREE.Scene(),
    effects = createCombatPresentation({
      THREE,
      scene,
      preferences: () => ({ brutal: true, blood: true, showRemains: true }),
      detail: 'high',
    });
  const equipment = Array.from({ length: 8 }, (_, i) => {
    const geometry = new THREE.BoxGeometry(0.12, 0.2, 0.05),
      mesh = new THREE.Mesh(geometry, fixture.material);
    mesh.position.set((i % 2) * 0.05, 1 + i * 0.01, 0.15);
    fixture.scene.add(mesh);
    fixture.sourceGeometry.push(geometry);
    return {
      mesh,
      region: i < 4 ? 'torso' : i < 6 ? 'leftArm' : 'rightArm',
      color: [0.4, 0.5, 0.6],
    };
  });
  let released = 0;
  const entries = ACTOR_FAMILIES.flatMap(({ id: family }) =>
    ACTOR_CASTS.map(({ id: cast }) => ({
      ...fixture.lease,
      family,
      cast,
      equipment,
      release: () => released++,
    })),
  );
  try {
    assert.equal(effects.setAppearancePartsTemplates(entries), true);
    assert.equal(
      effects.resources().registeredPools,
      27,
      '13 body/cap plus three shared equipment pools and11 Current',
    );
    for (const entry of entries) {
      effects.restore(
        [fact(1, { appearance: { family: entry.family, cast: entry.cast, type: 'patrol' } })],
        { runId: 'run', tick: 100 },
      );
      effects.update({ tick: 100, graphicsQuality: 'balanced' });
      const authoredInstances = scene.children[0].children
        .filter((node) => node.name.includes('appearance:'))
        .reduce((sum, node) => sum + node.count, 0);
      assert.equal(authoredInstances, 16, 'all original region and equipment instances remain');
      assert.ok(effects.resources().settled > 16, 'optional attached wounds augment the base');
      assert.ok(effects.resources().calls >= 17 && effects.resources().calls <= 24);
    }
  } finally {
    effects.dispose();
    assert.equal(released, 36);
    fixture.dispose();
  }
});

test('clean remains bake the declared settled gear branch transform into the connected body pose', () => {
  const fixture = syntheticParts(),
    scene = new THREE.Scene(),
    prefs = { brutal: true, blood: false, showRemains: true },
    effects = createCombatPresentation({ THREE, scene, preferences: () => prefs, detail: 'ultra' });
  const gearRoot = new THREE.Group(),
    gearShape = new THREE.BoxGeometry(0.22, 0.66, 0.22),
    gear = new THREE.Mesh(gearShape, fixture.material);
  gearRoot.position.set(-0.35, 1.15, 0);
  gearRoot.rotation.z = 0.7;
  gear.rotation.z = -0.7;
  gearRoot.add(gear);
  fixture.scene.add(gearRoot);
  fixture.lease.equipment = [{ mesh: gearRoot, region: 'leftArm', color: [1, 1, 1] }];
  try {
    assert.equal(effects.setAppearanceParts(fixture.lease), true);
    effects.restore(
      [fact(0, { appearance: { family: 'courier', cast: 'tactical', type: 'patrol' } })],
      { runId: 'run', tick: 2000 },
    );
    effects.update({ tick: 2000, graphicsQuality: 'high' });
    const root = scene.getObjectByName('combat-presentation'),
      body = root.children.find((m) => m.count && m.name.includes(':leftArm:mesh')),
      sleeve = root.children.find((m) => m.count && m.name.includes(':leftArm:gear'));
    const placedBox = (mesh) => {
      const matrix = new THREE.Matrix4();
      mesh.getMatrixAt(0, matrix);
      return mesh.geometry.boundingBox.clone().applyMatrix4(matrix);
    };
    const bodyBox = placedBox(body),
      sleeveBox = placedBox(sleeve);
    assert.ok(
      bodyBox.getCenter(new THREE.Vector3()).distanceTo(sleeveBox.getCenter(new THREE.Vector3())) <
        1e-6,
    );
    assert.ok(
      bodyBox
        .getSize(new THREE.Vector3())
        .multiplyScalar(1.1)
        .distanceTo(sleeveBox.getSize(new THREE.Vector3())) < 1e-5,
      'Full settled gear root and child transforms keep clothing aligned with the body region',
    );
    assert.equal(fixture.counts.geometry, 0);
  } finally {
    effects.dispose();
    gearShape.dispose();
    fixture.dispose();
  }
});

function admittedPlane(point, normal, sweep) {
  if (sweep?.attachment) return { ...sweep.attachment, attached: true };
  const surface = {
    position: { x: point.x, y: 0, z: point.z },
    normal: { x: 0, y: 1, z: 0 },
    surfaceId: 'ground',
    localPosition: { x: point.x, y: 0, z: point.z },
  };
  if (!sweep) return surface;
  return sweep.toMm.y <= sweep.radiusMm && sweep.fromMm.y >= -sweep.radiusMm
    ? surface
    : { clear: true };
}

test('physics surface identities resolve to separate exact renderer attachments for blood and impacts', () => {
  const physical = {
    position: { x: 20, y: 0, z: 0 },
    normal: { x: 0, y: 1, z: 0 },
    surfaceId: 'regional/chunk-12/collider-4',
  };
  const event = fact(1, { surface: physical });
  const before = structuredClone(event);
  const normalized = normalizeCombatDefeat(event, admittedPlane);
  assert.deepEqual(normalized.surface, physical, 'accepted physics contact is unchanged');
  assert.equal(normalized.renderSurface.surfaceId, 'ground');
  assert.deepEqual(event, before, 'render attachment resolution never mutates gameplay events');
  assert.equal(
    normalizeCombatDefeat(event, (point) => ({
      ...admittedPlane(point),
      position: { ...point, y: -4000 },
    })).renderSurface,
    null,
    'an unrelated lower floor cannot replace the accepted impact surface',
  );
  const scene = new THREE.Scene();
  const view = createCombatPresentation({
    THREE,
    scene,
    groundQuery: admittedPlane,
    preferences: () => ({ blood: true, brutal: false, showRemains: true }),
  });
  try {
    view.observe(
      [
        event,
        fact(2, {
          type: 'surface-impact',
          material: 'metal',
          weapon: 'autocannon',
          surface: physical,
        }),
      ],
      { runId: 'regional-marks', tick: 2 },
    );
    view.update({ tick: 2, presentationClock: 5 });
    assert.ok(view.resources().marks >= 5, 'both blood pools and the bullet mark remain visible');
    const archive = view.export();
    assert.equal(archive.records[0].surface.surfaceId, physical.surfaceId);
    assert.equal(archive.impactRecords[0].surface.surfaceId, physical.surfaceId);
    assert.equal(archive.records[0].renderSurface.surfaceId, 'ground');
    assert.equal(archive.impactRecords[0].renderSurface.surfaceId, 'ground');
  } finally {
    view.dispose();
  }
});

test('surface marks follow their exact support and wait through missing geometry and renderer rebuilds', () => {
  let available = false,
    shift = 0,
    queries = 0;
  const query = (point, normal, options) => {
    queries++;
    if (!available) return null;
    const local = options?.attachment?.localPosition ?? { x: point.x - shift, y: 0, z: point.z };
    return {
      position: { x: local.x + shift, y: 0, z: local.z },
      normal: { x: 0, y: 1, z: 0 },
      surfaceId: 'ground',
      localPosition: { x: point.x - shift, y: 0, z: point.z },
      ...(options?.attachment ? { localPosition: local, attached: true } : {}),
    };
  };
  const prefs = () => ({ blood: false, brutal: false, showRemains: true });
  const scene = new THREE.Scene();
  const view = createCombatPresentation({ THREE, scene, groundQuery: query, preferences: prefs });
  let rebuilt;
  try {
    view.observe(
      [
        fact(1, {
          type: 'surface-impact',
          material: 'metal',
          weapon: 'autocannon',
          surface: {
            position: { x: 20, y: 0, z: 0 },
            normal: { x: 0, y: 1, z: 0 },
            surfaceId: 'physics-floor',
          },
        }),
      ],
      { runId: 'attachment', tick: 1 },
    );
    view.update({ tick: 1, presentationClock: 5 });
    assert.equal(view.resources().marks, 0);
    available = true;
    view.update({ tick: 1, presentationClock: 5.3 });
    assert.equal(
      view.resources().marks,
      1,
      'deferred accepted contact resolves when streaming completes',
    );
    shift = 500;
    view.update({ tick: 1, presentationClock: 5.6 });
    const archived = view.export();
    assert.equal(archived.impactRecords[0].surface.position.x, 20);
    assert.equal(archived.impactRecords[0].renderSurface.position.x, 520);
    assert.equal(view.resources().marks, 1, 'attached mark follows translated support');
    const matrix = new THREE.Matrix4();
    scene.getObjectByName('combat-mark').getMatrixAt(0, matrix);
    assert.ok(Math.abs(matrix.elements[12] - 0.52) < 0.001);
    available = false;
    rebuilt = createCombatPresentation({
      THREE,
      scene: new THREE.Scene(),
      groundQuery: query,
      preferences: prefs,
    });
    const before = queries;
    rebuilt.restore(archived);
    assert.equal(queries, before, 'archive restoration defers all geometry work');
    rebuilt.update({ tick: 1, presentationClock: 5.9 });
    assert.equal(rebuilt.resources().marks, 0);
    available = true;
    rebuilt.update({ tick: 1, presentationClock: 6.2 });
    assert.equal(
      rebuilt.resources().marks,
      1,
      'returning exact support restores the mark without a new impact',
    );
  } finally {
    view.dispose();
    rebuilt?.dispose();
  }
});

test('high airborne debris falls beyond the old lifetime and settles on actual geometry after terminal gameplay', () => {
  const scene = new THREE.Scene();
  const view = createCombatPresentation({
    THREE,
    scene,
    groundQuery: admittedPlane,
    preferences: () => ({ brutal: true, blood: true, showRemains: true }),
  });
  try {
    view.observe(
      [
        fact(1, {
          tick: 10,
          material: 'metal',
          position: { x: 0, y: 20000, z: 0 },
          appearance: {
            family: 'courier',
            cast: 'tactical',
            type: 'drone',
            archetype: 'interceptor-uav',
          },
        }),
      ],
      { tick: 10, runId: 'air' },
    );
    view.update({ tick: 10, presentationClock: 2 });
    const airborne = view.export();
    assert.ok(
      Object.values(airborne.records[0].presentation.pieces).some((p) => !p.settled && p.at[1] > 3),
    );
    view.update({ tick: 10, presentationClock: 6 });
    const landed = view.export();
    assert.equal(landed.tick, 10, 'cosmetic motion does not advance accepted gameplay');
    assert.ok(
      Object.values(landed.records[0].presentation.pieces).every((p) => p.settled && p.at[1] < 1),
    );
    assert.ok(
      Object.values(landed.records[0].presentation.pieces).every(
        (p) => p.surface.surfaceId === 'ground',
      ),
    );
    assert.equal(view.resources().moving, 0);
    view.update({ tick: 10, presentationClock: 6 });
    assert.deepEqual(view.export(), landed, 'a paused presentation clock does not advance debris');
  } finally {
    view.dispose();
  }
});

test('missing streamed geometry preserves pending motion without inventing a floor, including a fresh renderer restore', () => {
  let admitted = false;
  const query = (...args) => (admitted ? admittedPlane(...args) : null);
  const options = {
    THREE,
    groundQuery: query,
    preferences: () => ({ brutal: true, blood: true, showRemains: true }),
  };
  const first = createCombatPresentation({ ...options, scene: new THREE.Scene() });
  let second;
  try {
    first.observe([fact(1, { position: { x: 0, y: 8000, z: 0 }, surface: null })], {
      tick: 1,
      runId: 'stream',
    });
    first.update({ tick: 1, presentationClock: 3 });
    const archive = first.export();
    assert.ok(first.resources().pendingFragments > 0);
    assert.equal(
      first.resources().moving,
      0,
      'missing support never displays frozen airborne pieces',
    );
    assert.equal(first.resources().settled, 0);
    assert.ok(
      Object.values(archive.records[0].presentation.pieces).every(
        (p) => !p.settled && p.time === 0,
      ),
    );
    second = createCombatPresentation({ ...options, scene: new THREE.Scene() });
    second.restore(archive, { runId: 'stream' });
    second.update({ tick: 1, presentationClock: 3 });
    assert.deepEqual(second.export(), archive);
    admitted = true;
    second.update({ tick: 1, presentationClock: 5 });
    assert.ok(
      Object.values(second.export().records[0].presentation.pieces).every((p) => p.settled),
    );
    assert.equal(
      second.resources().bursts,
      0,
      'recovery resumes gravity without replaying the explosion',
    );
  } finally {
    first.dispose();
    second?.dispose();
  }
});

test('settled poses survive a different renderer and recentering after support revalidation', () => {
  const scene = new THREE.Scene();
  const prefs = () => ({ brutal: true, blood: true, showRemains: true });
  const first = createCombatPresentation({
    THREE,
    scene,
    groundQuery: admittedPlane,
    preferences: prefs,
  });
  let second;
  try {
    first.observe([fact(1, { tick: 1, outcome: 'explosive' })], { runId: 'rebuild', tick: 1 });
    first.update({ tick: 1, presentationClock: 5 });
    const saved = first.export();
    const before = snapshot(scene).filter((p) => p.name !== 'combat-mark');
    const newScene = new THREE.Scene();
    second = createCombatPresentation({
      THREE,
      scene: newScene,
      groundQuery: admittedPlane,
      preferences: prefs,
    });
    second.restore(saved);
    second.update({ tick: 1, presentationClock: 5 });
    const after = snapshot(newScene).filter((p) => p.name !== 'combat-mark');
    assert.equal(after.length, before.length);
    for (const [index, row] of after.entries()) {
      assert.equal(row.name, before[index].name);
      assert.equal(row.count, before[index].count);
      assert.deepEqual(row.colors, before[index].colors);
      assert.ok(
        row.matrix.every((value, j) => Math.abs(value - before[index].matrix[j]) < 0.001),
        'cosmetic export preserves the visible pose within one millimetre',
      );
    }
    assert.deepEqual(second.export(), saved);
    second.update({ tick: 1, presentationClock: 5, originMm: { x: 64000, y: 0, z: 128000 } });
    assert.deepEqual(
      second.export(),
      saved,
      'world-space pose archive is independent of render origin',
    );
  } finally {
    first.dispose();
    second?.dispose();
  }
});

test('settled remains wait for their original support instead of snapping to a different floor', () => {
  let available = true,
    wrongFloor = false,
    shift = 0,
    queries = 0;
  const query = (point, normal, options) => {
    if (!options?.attachment) return admittedPlane(point, normal, options);
    queries++;
    if (!available) return null;
    return {
      ...options.attachment,
      position: { ...options.attachment.position, y: wrongFloor ? -4000 : shift },
      ...(shift ? { attached: true } : {}),
    };
  };
  const view = createCombatPresentation({
    THREE,
    scene: new THREE.Scene(),
    groundQuery: query,
    preferences: () => ({ brutal: true, blood: false, showRemains: true }),
  });
  try {
    view.observe([fact(1, { outcome: 'explosive' })], { runId: 'support', tick: 1 });
    view.update({ tick: 1, presentationClock: 5 });
    const archive = view.export(),
      poses = Object.values(archive.records[0].presentation.pieces);
    assert.ok(view.resources().settled > 0);
    available = false;
    view.update({ tick: 1, presentationClock: 5.3 });
    assert.equal(view.resources().settled, 0);
    assert.ok(view.resources().pendingFragments > 0);
    const checked = queries;
    view.update({ tick: 1, presentationClock: 5.3 });
    assert.equal(queries, checked, 'same paused frame does not repeat support queries');
    available = true;
    wrongFloor = true;
    view.update({ tick: 1, presentationClock: 5.6 });
    assert.equal(view.resources().settled, 0, 'unrelated lower floor cannot claim saved poses');
    assert.deepEqual(
      Object.values(view.export().records[0].presentation.pieces).map((p) => p.at),
      poses.map((p) => p.at),
    );
    wrongFloor = false;
    view.update({ tick: 1, presentationClock: 5.9 });
    assert.ok(view.resources().settled > 0, 'returning support restores the complete cluster');
    shift = 500;
    view.update({ tick: 1, presentationClock: 6.2 });
    assert.ok(
      Object.values(view.export().records[0].presentation.pieces).every(
        (piece, i) => Math.abs(piece.at[1] - poses[i].at[1] - 0.5) < 0.002,
      ),
      'an authoritative stable attachment can move its grounded cluster',
    );
  } finally {
    view.dispose();
  }
});

test('blood remains independent of dismemberment and all twelve connected current-art regions are authored', () => {
  const scene = new THREE.Scene(),
    prefs = { brutal: false, blood: true, showRemains: true };
  const view = createCombatPresentation({
    THREE,
    scene,
    groundQuery: admittedPlane,
    preferences: () => prefs,
  });
  try {
    const record = normalizeCombatDefeat(fact());
    const recipe = combatFragmentRecipe(record, { brutal: false, blood: true });
    assert.equal(new Set(recipe.filter((p) => p.region).map((p) => p.region)).size, 12);
    assert.equal(recipe.filter((p) => p.attachment < 0).length, 1, 'clean body remains connected');
    view.observe([fact()], { runId: 'blood', tick: 1 });
    view.update({ tick: 1 });
    assert.ok(
      scene.getObjectByName('combat-wound').count > 0,
      'blood spray still appears with Brutal off',
    );
    view.update({ tick: 1, presentationClock: 5 });
    assert.ok(view.resources().marks > 0);
    const records = acceptedFacts(view.export());
    prefs.blood = false;
    view.update({ tick: 1, presentationClock: 5 });
    assert.equal(scene.getObjectByName('combat-wound').count, 0);
    assert.equal(scene.getObjectByName('combat-bone').count, 0);
    assert.equal(view.resources().marks, 0);
    assert.deepEqual(acceptedFacts(view.export()), records);
  } finally {
    view.dispose();
  }
});

test('settled bodies reproject changed recipe bounds and follow the normal of their exact support', () => {
  const prefs = { brutal: true, blood: false, showRemains: true };
  let normal = { x: 0, y: 1, z: 0 };
  const query = (point, direction, options) =>
    options?.attachment
      ? { ...options.attachment, normal, attached: true }
      : admittedPlane(point, direction, options);
  const view = createCombatPresentation({
    THREE,
    scene: new THREE.Scene(),
    groundQuery: query,
    preferences: () => prefs,
  });
  const clearance = (state, size) => {
    const rotation = new THREE.Matrix4().makeRotationFromEuler(
      new THREE.Euler(...state.rotation),
    ).elements;
    const n = state.surface.normal;
    const extent =
      (Math.abs(n.x * rotation[0] + n.y * rotation[1] + n.z * rotation[2]) * size[0] +
        Math.abs(n.x * rotation[4] + n.y * rotation[5] + n.z * rotation[6]) * size[1] +
        Math.abs(n.x * rotation[8] + n.y * rotation[9] + n.z * rotation[10]) * size[2]) /
      2;
    return (
      ['x', 'y', 'z'].reduce(
        (sum, axis, i) => sum + (state.at[i] - state.surface.position[axis] / 1000) * n[axis],
        0,
      ) - extent
    );
  };
  try {
    view.observe([fact(1, { outcome: 'explosive' })], { runId: 'bounds', tick: 1 });
    view.update({ tick: 1, presentationClock: 5 });
    const initial = view.export();
    prefs.brutal = false;
    view.update({ tick: 1, presentationClock: 5 });
    let saved = view.export();
    const root = combatFragmentRecipe(saved.records[0], prefs).find(
      (part) => part.region === 'chest',
    );
    assert.ok(
      Math.abs(clearance(saved.records[0].presentation.pieces.chest, root.supportSize) - 0.006) <
        0.002,
      'connected clean body receives clearance for its complete replacement silhouette',
    );
    normal = { x: 0, y: Math.SQRT1_2, z: Math.SQRT1_2 };
    view.update({ tick: 1, presentationClock: 5.3 });
    saved = view.export();
    assert.ok(
      Math.abs(clearance(saved.records[0].presentation.pieces.chest, root.supportSize) - 0.006) <
        0.002,
      'a tilted stable support keeps the complete body above its new plane',
    );
    assert.notDeepEqual(
      saved.records[0].presentation.pieces.chest.rotation,
      initial.records[0].presentation.pieces.chest.rotation,
    );
    assert.equal(saved.tick, initial.tick);
    assert.equal(saved.records[0].eventId, initial.records[0].eventId);
    assert.equal(view.resources().bursts, 0);
    assert.deepEqual(
      acceptedFacts(saved),
      acceptedFacts({ ...initial, presentationClock: saved.presentationClock }),
    );
  } finally {
    view.dispose();
  }
});

test('changing settled Current remains to thicker appearance geometry preserves real floor clearance', () => {
  const fixture = syntheticParts(),
    scene = new THREE.Scene();
  for (const geometry of fixture.sourceGeometry) geometry.scale(1, 1, 4);
  const view = createCombatPresentation({
    THREE,
    scene,
    groundQuery: admittedPlane,
    preferences: () => ({ brutal: false, blood: false, showRemains: true }),
  });
  try {
    view.observe([fact()], { runId: 'thicker-art', tick: 1 });
    view.update({ tick: 1, presentationClock: 5 });
    const accepted = acceptedFacts(view.export());
    assert.equal(view.setAppearanceParts(fixture.lease), true);
    view.update({ tick: 1, presentationClock: 5 });
    let visibleVertices = 0;
    const point = new THREE.Vector3(),
      transform = new THREE.Matrix4();
    for (const mesh of scene.children.flatMap((group) => group.children)) {
      if (!mesh.name.includes('appearance:') || !mesh.count) continue;
      const vertices = mesh.geometry.attributes.position;
      for (let instance = 0; instance < mesh.count; instance++) {
        mesh.getMatrixAt(instance, transform);
        for (let index = 0; index < vertices.count; index++) {
          point.fromBufferAttribute(vertices, index).applyMatrix4(transform);
          assert.ok(
            point.y >= -0.001,
            `replacement body must remain above its real floor (${point.y})`,
          );
          visibleVertices++;
        }
      }
    }
    assert.ok(visibleVertices > 0);
    assert.equal(view.resources().bursts, 0);
    assert.deepEqual(acceptedFacts(view.export()), accepted);
  } finally {
    view.dispose();
    fixture.dispose();
  }
});

test('surface impacts have a separate 1024-record ring and restore marks without a new burst', () => {
  const ledger = createCombatRemainsLedger();
  for (let i = 0; i < 1100; i++)
    ledger.add(
      [
        fact(i, {
          type: 'surface-impact',
          eventId: `impact:${i}`,
          material: 'metal',
          weapon: 'autocannon',
        }),
        fact(i),
      ],
      { runId: 'impacts', tick: i },
    );
  assert.equal(ledger.snapshot().stored, 1024);
  assert.equal(ledger.snapshot().storedImpacts, 1024);
  const scene = new THREE.Scene();
  const view = createCombatPresentation({
    THREE,
    scene,
    groundQuery: admittedPlane,
    preferences: () => ({ blood: false, brutal: false, showRemains: true }),
  });
  try {
    view.restore(ledger.export());
    view.update({ tick: 1100 });
    assert.ok(view.resources().marks > 0, 'metal bullet marks remain visible with blood disabled');
    assert.equal(view.resources().bursts, 0);
    const saved = view.export();
    assert.equal(saved.impactRecords[0].eventId, 'impact:76');
    assert.equal(saved.records[0].eventId, 'run:76');
    saved.records[0].presentation = { born: Infinity, pieces: { bad: true } };
    assert.doesNotThrow(
      () => view.restore(saved),
      'malformed cosmetic pose data does not reject valid defeat facts',
    );
  } finally {
    view.dispose();
  }
});

test('surface contacts with numeric collider handles remain valid cosmetic records', () => {
  const ledger = createCombatRemainsLedger();
  ledger.add([fact(1, { type: 'surface-impact', sourceId: 42, eventId: 'surface:42' })]);
  assert.equal(ledger.impacts()[0].sourceId, '42');
  assert.doesNotThrow(() => ledger.restore(ledger.export()));
});

test('unsupported full impact rings cannot spend an unbounded frame on surface revalidation', () => {
  let queries = 0;
  const view = createCombatPresentation({
    THREE,
    scene: new THREE.Scene(),
    groundQuery: () => {
      queries++;
      return null;
    },
    preferences: () => ({ blood: true, brutal: true, showRemains: true }),
  });
  try {
    view.observe(
      Array.from({ length: 1024 }, (_, i) =>
        fact(i, {
          type: 'surface-impact',
          eventId: `impact:${i}`,
          material: 'metal',
          weapon: 'autocannon',
        }),
      ),
      { runId: 'bounded-rays', tick: 1024 },
    );
    queries = 0;
    for (let frame = 0; frame < 5; frame++) {
      const before = queries;
      view.update({ tick: 1024 + frame * 13 });
      assert.ok(queries - before <= 64, 'missing support retries are spread across frames');
      assert.equal(view.resources().marks, 0);
      assert.equal(view.resources().storedImpacts, 1024);
    }
  } finally {
    view.dispose();
  }
});

test('a blocked shield impact emits a metallic contact instead of a false blood wound', () => {
  const scene = new THREE.Scene();
  const view = createCombatPresentation({
    THREE,
    scene,
    preferences: () => ({ brutal: true, blood: true, showRemains: true }),
  });
  try {
    view.observe(
      [
        fact(1, {
          type: 'impact',
          protected: true,
          damage: 0,
          material: 'organic',
          weapon: 'autocannon',
        }),
      ],
      { tick: 1, runId: 'shield' },
    );
    view.update({ tick: 1 });
    assert.equal(scene.getObjectByName('combat-wound').count, 0);
    assert.ok(scene.getObjectByName('combat-spark').count > 0);
    assert.equal(view.resources().stored, 0);
  } finally {
    view.dispose();
  }
});

test('full remains rings bound reconstruction queries and retry missing support at a controlled rate', () => {
  let queries = 0;
  const fx = createCombatPresentation({
    THREE,
    scene: new THREE.Scene(),
    detail: 'ultra',
    preferences: () => ({ brutal: true, blood: true, showRemains: true }),
    groundQuery() {
      queries++;
      return null;
    },
  });
  try {
    fx.restore(
      Array.from({ length: 1024 }, (_, i) => fact(i, { severity: 'explosive' })),
      { runId: 'bounded', tick: 2000 },
    );
    fx.update({ tick: 2000, presentationClock: 40, graphicsQuality: 'high' });
    assert.ok(queries < 1200, `first visible clusters use bounded queries (${queries})`);
    queries = 0;
    fx.update({ tick: 2000, presentationClock: 40.02, graphicsQuality: 'high' });
    assert.ok(queries < 1200, `new visible clusters remain bounded (${queries})`);
    assert.equal(fx.resources().stored, 1024);
    assert.ok(fx.resources().pendingFragments > 0);
  } finally {
    fx.dispose();
  }
});

test('full twelve-region and impact archives fit the independently bounded cosmetic envelope', () => {
  const fx = createCombatPresentation({
    THREE,
    scene: new THREE.Scene(),
    preferences: () => ({ brutal: true, blood: true }),
    groundQuery: admittedPlane,
  });
  try {
    fx.observe([fact(1, { severity: 'explosive' })], { runId: 'budget', tick: 1 });
    fx.update({ tick: 1, presentationClock: 5 });
    const archive = fx.export(),
      first = archive.records[0];
    assert.equal(Object.keys(first.presentation.pieces).length, 12);
    archive.records = Array.from({ length: 1024 }, (_, i) => ({
      ...structuredClone(first),
      eventId: `budget:${i}`,
    }));
    archive.impactRecords = Array.from({ length: 1024 }, (_, i) => ({
      ...structuredClone(first),
      eventId: `impact:${i}`,
      kind: 'surface-impact',
      presentation: { born: 0, pieces: {} },
    }));
    const bytes = Buffer.byteLength(JSON.stringify(archive));
    assert.ok(
      bytes < 6 * 1024 * 1024,
      `compact cosmetics leave at least 2 MiB headroom (${bytes})`,
    );
    fx.restore(archive);
    assert.equal(fx.resources().storedImpacts, 1024);
    assert.equal(fx.resources().stored, 1024);
  } finally {
    fx.dispose();
  }
});

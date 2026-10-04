import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { parse } from 'acorn';
import * as THREE from '../../optional-practice/civilian-fpv/vendor/three.module.js';
import * as soldiers from '../../optional-practice/civilian-fpv/industrial-soldiers.mjs';
import * as vehicles from '../../optional-practice/civilian-fpv/industrial-vehicles.mjs';
import * as visuals from '../../optional-practice/civilian-fpv/world-visuals.mjs';
import * as themes from '../../optional-practice/civilian-fpv/world-themes.mjs';
import { NATIVE_PURSUIT_COURSES } from '../../optional-practice/civilian-fpv/native-pursuit-courses.mjs';
import { actorVisual } from '../hunt/actor-catalog.mjs';
import { actorArtReviewRevision } from '../hunt/preferences.mjs';
import {
  INDUSTRIAL_SOLDIER_REVISION,
  INDUSTRIAL_SOLDIER_FAMILIES,
  INDUSTRIAL_SOLDIER_CASTS,
  INDUSTRIAL_SOLDIER_LIMITS,
  industrialSoldierPaintKeys,
  buildIndustrialSoldier,
  sampleIndustrialSoldierPose,
  applyIndustrialSoldierPose,
  resolveIndustrialSoldierFamily,
} from '../../optional-practice/civilian-fpv/industrial-soldiers.mjs';
import { INDUSTRIAL_SOLDIER_KITS } from '../hunt/industrial-soldier-kit.mjs';
import { PURSUIT_FAMILIES } from '../../optional-practice/civilian-fpv/world-pursuit.mjs';

const qualities = ['low', 'balanced', 'high'];
const radius = 0.3;
const height = 1.8;

async function nativeRendererFixture(revision = INDUSTRIAL_SOLDIER_REVISION) {
  let source = await fs.readFile(
    new URL('../../optional-practice/civilian-fpv/renderer.mjs', import.meta.url),
    'utf8',
  );
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  for (const item of ast.body.filter((item) => item.type === 'ImportDeclaration').reverse())
    source = source.slice(0, item.start) + source.slice(item.end);
  source = source.replaceAll('export function ', 'function ');
  let scene;
  class Scene extends THREE.Scene {
    constructor() {
      super();
      scene = this;
    }
  }
  class Renderer {
    constructor() {
      this.shadowMap = {};
      this.capabilities = { getMaxAnisotropy: () => 4 };
      this.info = { programs: [], memory: {}, render: {} };
    }
    dispose() {}
    forceContextLoss() {}
    getContext() {
      return { isContextLost: () => false };
    }
    setPixelRatio() {}
    setSize() {}
  }
  // Exercise production dispatch, bindings, materials and ownership. Only the
  // browser renderer, surrounding environment and unrelated drone are modeled.
  const create = vm.runInNewContext(`${source}; createFlightRenderer`, {
    ...visuals,
    ...themes,
    ...soldiers,
    ...vehicles,
    actorVisual,
    actorArtReviewRevision,
    sharedActorAppearance: () => ({ snapshot: () => ({ cast: 'tactical' }) }),
    THREE: { ...THREE, Scene, WebGLRenderer: Renderer },
    structuredClone,
    buildWorldVisuals: ({ course, presentation }) => {
      const profile = themes.resolveSimThemeProfile(course, presentation);
      return {
        theme: profile.palette,
        profile,
        indoor: true,
        center: [0, 0],
        width: 20,
        depth: 20,
      };
    },
    createEnvironmentLight: () => ({ texture: null, dispose() {} }),
    buildDroneVisual: ({ material }) => ({ tint: material(0xffffff), rotors: [] }),
  });
  const renderer = create({
    canvas: {
      addEventListener() {},
      removeEventListener() {},
      ownerDocument: { createElement: () => ({ getContext: () => null }) },
    },
    window: {
      devicePixelRatio: 1,
      location: {
        href: `https://example.test/optional-practice/civilian-fpv/${revision ? `?artReview=${revision}` : ''}`,
      },
    },
  });
  assert.equal(renderer.available, true);
  return { renderer, scene };
}

function armorWindowsCourse(collectionId = 'military-field') {
  const course = structuredClone(
    NATIVE_PURSUIT_COURSES.find((item) => item.id === 'native-pursuit-armor-windows'),
  );
  const themeProfile = themes.snapshotSimThemeProfile(course, { collectionId });
  course.world = { ...course.world, themeProfile, theme: themeProfile.id };
  return course;
}

function watchActorResources(groups) {
  const resources = new Map();
  for (const group of groups)
    group.traverse((node) => {
      const values = [
        node.geometry,
        ...[node.material].flat(),
        node.customDepthMaterial,
        node.customDistanceMaterial,
        ...visuals.ownedSimMaterials(node),
      ].filter(Boolean);
      for (const resource of [
        ...values,
        ...values.flatMap((value) => Object.values(value).filter((item) => item?.isTexture)),
      ])
        if (!resources.has(resource)) {
          resources.set(resource, 0);
          resource.addEventListener('dispose', () =>
            resources.set(resource, resources.get(resource) + 1),
          );
        }
    });
  return resources;
}

function fixture(family, cast = 'tactical', quality = 'balanced', dimensions = {}) {
  const rigRadius = dimensions.radius ?? radius,
    rigHeight = dimensions.height ?? height;
  const parent = new THREE.Group(),
    paints = Object.fromEntries(
      industrialSoldierPaintKeys(family).map((role) => [
        role,
        new THREE.MeshBasicMaterial({ name: role }),
      ]),
    ),
    registered = new Set();
  const rig = buildIndustrialSoldier({
    THREE,
    parent,
    family,
    cast,
    quality,
    radius: rigRadius,
    height: rigHeight,
    paints,
    part(shape, paint, at, owner) {
      const mesh = new THREE.Mesh(shape, paint);
      mesh.position.set(...at);
      owner.add(mesh);
      registered.add(mesh);
      return mesh;
    },
  });
  return {
    parent,
    paints,
    registered,
    rig,
    dispose() {
      const geometries = new Set([...registered].map((mesh) => mesh.geometry));
      for (const shape of geometries) shape.dispose();
      for (const paint of Object.values(paints)) paint.dispose();
      parent.clear();
    },
  };
}

function measure(parent, dimensions = {}) {
  parent.updateMatrixWorld(true);
  const point = new THREE.Vector3();
  let reach = 0,
    bottom = Infinity,
    top = -Infinity;
  parent.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const position = mesh.geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
      reach = Math.max(reach, Math.hypot(point.x, point.z));
      bottom = Math.min(bottom, point.y);
      top = Math.max(top, point.y);
    }
  });
  return {
    reach: reach / (dimensions.radius ?? radius),
    bottom: bottom / (dimensions.height ?? height),
    top: top / (dimensions.height ?? height),
  };
}

function boundsFailures(parent, label, dimensions) {
  const bounds = measure(parent, dimensions);
  return bounds.reach > 1.7 + 1e-6 || bounds.bottom < -1e-6 || bounds.top > 1.06 + 1e-6
    ? [{ label, ...bounds }]
    : [];
}

function geometryIdentity(parent) {
  parent.updateMatrixWorld(true);
  const hash = createHash('sha256');
  parent.traverse((mesh) => {
    if (!mesh.isMesh) return;
    // Compare real geometry and placement, independent of names, palette or UUIDs.
    hash.update(JSON.stringify(mesh.matrixWorld.elements));
    hash.update(Buffer.from(mesh.geometry.attributes.position.array.buffer));
    hash.update(Buffer.from(mesh.geometry.index.array.buffer));
  });
  return hash.digest('hex');
}

function transforms(parent) {
  parent.updateMatrixWorld(true);
  const result = [];
  parent.traverse((node) => result.push([...node.matrixWorld.elements]));
  return result;
}

test('all 12 soldier families and three casts borrow registered meshes and paints at every quality', () => {
  assert.equal(INDUSTRIAL_SOLDIER_FAMILIES.length, 12);
  assert.equal(INDUSTRIAL_SOLDIER_CASTS.length, 3);
  const failures = [];
  for (const family of INDUSTRIAL_SOLDIER_FAMILIES)
    for (const cast of INDUSTRIAL_SOLDIER_CASTS)
      for (const quality of qualities) {
        const value = fixture(family, cast, quality),
          { parent, rig, paints, registered } = value,
          label = `${family}/${cast}/${quality}`;
        try {
          let count = 0;
          parent.traverse((mesh) => {
            if (!mesh.isMesh) return;
            count++;
            assert.ok(registered.has(mesh), `${label} mesh bypassed host registration`);
            assert.ok(
              Object.values(paints).includes(mesh.material),
              `${label} allocated its own paint`,
            );
          });
          assert.equal(count, registered.size);
          assert.ok(
            count <=
              (quality === 'low'
                ? INDUSTRIAL_SOLDIER_LIMITS.lowMeshes
                : INDUSTRIAL_SOLDIER_LIMITS.detailedMeshes),
            `${label} exceeds mesh budget with ${count}`,
          );
          assert.equal(rig.legs.length, 2);
          assert.equal(rig.arms.length, 2);
          assert.equal(rig.kitId, INDUSTRIAL_SOLDIER_KITS[family].id);
          assert.equal(rig.material, INDUSTRIAL_SOLDIER_KITS[family].material);
          assert.equal(rig.equipment.userData.kitId, rig.kitId);
          assert.equal(rig.equipment.userData.material, rig.material);
          assert.ok(rig.equipment.children.length > 0, `${label} has visible equipment`);
          failures.push(...boundsFailures(parent, label));
        } finally {
          value.dispose();
        }
      }
  assert.equal(
    failures.length,
    0,
    `Standing models exceed 1.7r or 0..1.06h: ${JSON.stringify(failures.slice(0, 3))}`,
  );
});

test('family equipment and field, worn and winter kits have distinct native geometry', () => {
  for (const quality of qualities) {
    const familiesByCast = new Map(INDUSTRIAL_SOLDIER_CASTS.map((cast) => [cast, new Set()])),
      allShapes = new Set();
    for (const family of INDUSTRIAL_SOLDIER_FAMILIES) {
      const castShapes = new Set();
      for (const cast of INDUSTRIAL_SOLDIER_CASTS) {
        const value = fixture(family, cast, quality);
        try {
          const identity = geometryIdentity(value.parent);
          castShapes.add(identity);
          allShapes.add(identity);
          familiesByCast.get(cast).add(identity);
        } finally {
          value.dispose();
        }
      }
      assert.equal(
        castShapes.size,
        3,
        `${family}/${quality} must change kit geometry, not just color`,
      );
    }
    for (const [cast, identities] of familiesByCast)
      assert.equal(identities.size, 12, `${cast}/${quality} needs 12 distinct family silhouettes`);
    assert.equal(allShapes.size, 36, `${quality} needs 36 distinct family/cast geometries`);
  }
});

test('native soldier gait and phase equipment stay within bounds across all casts and qualities', () => {
  const failures = [];
  for (const family of INDUSTRIAL_SOLDIER_FAMILIES)
    for (const cast of INDUSTRIAL_SOLDIER_CASTS)
      for (const quality of qualities) {
        const value = fixture(family, cast, quality);
        try {
          for (const ticks of [0, 8, 24, 39])
            for (const phase of [
              'committed',
              'flee',
              'burst',
              'warning',
              'notice',
              'turning',
              'waiting',
              'recovering',
            ]) {
              applyIndustrialSoldierPose(value.rig, {
                ticks,
                phase,
                moving: ['committed', 'flee', 'burst'].includes(phase),
              });
              failures.push(
                ...boundsFailures(value.parent, `${family}/${cast}/${quality}/${phase}@${ticks}`),
              );
            }
        } finally {
          value.dispose();
        }
      }
  assert.equal(
    failures.length,
    0,
    `Animated models exceed 1.7r or 0..1.06h: ${JSON.stringify(failures.slice(0, 3))}`,
  );
});

test('Courier and Shield equipment borrow the exact shared kit material keys across casts', () => {
  for (const cast of INDUSTRIAL_SOLDIER_CASTS)
    for (const quality of qualities)
      for (const [family, pieces] of [
        [
          'courier',
          [
            ['satchel', '#795e3f'],
            ['satchel-flap', '#be9b65'],
            ['satchel-clasp', '#d9c296'],
          ],
        ],
        [
          'shield-bearer',
          [
            ['front-plate', '#192820'],
            ['shield-face', '#84928a'],
            ['shield-rim', '#c8d0bd'],
            ['shield-view', '#384c46'],
          ],
        ],
      ]) {
        const value = fixture(family, cast, quality);
        try {
          const sharedKeys = INDUSTRIAL_SOLDIER_KITS[family].rectangles.map(([key]) => key);
          for (const [name, key] of pieces) {
            assert.ok(sharedKeys.includes(key));
            assert.equal(
              value.parent.getObjectByName(`industrial-soldier-${name}`).material,
              value.paints[key],
            );
          }
        } finally {
          value.dispose();
        }
      }
});

test('admitted extreme capsule proportions preserve the same standing and animated bounds', () => {
  const failures = [];
  for (const [actorRadius, actorHeight] of [
    [0.1, 0.2],
    [0.1, 5],
    [2, 4],
    [2, 5],
  ])
    for (const family of INDUSTRIAL_SOLDIER_FAMILIES)
      for (const cast of INDUSTRIAL_SOLDIER_CASTS)
        for (const quality of qualities) {
          const dimensions = { radius: actorRadius, height: actorHeight },
            value = fixture(family, cast, quality, dimensions),
            label = `${family}/${cast}/${quality}/r${actorRadius}h${actorHeight}`;
          try {
            failures.push(...boundsFailures(value.parent, `${label}/standing`, dimensions));
            for (const ticks of [8, 24])
              for (const phase of ['warning', 'committed', 'recovering']) {
                applyIndustrialSoldierPose(value.rig, {
                  ticks,
                  phase,
                  moving: phase === 'committed',
                });
                failures.push(
                  ...boundsFailures(value.parent, `${label}/${phase}@${ticks}`, dimensions),
                );
              }
          } finally {
            value.dispose();
          }
        }
  assert.equal(
    failures.length,
    0,
    `Extreme native proportions exceed 1.7r or 0..1.06h: ${JSON.stringify(failures.slice(0, 12))}`,
  );
});

test('poses are pure samples and repeated or paused draws cannot accumulate joint motion', () => {
  for (const family of INDUSTRIAL_SOLDIER_FAMILIES) {
    const value = fixture(family),
      state = Object.freeze({ family, ticks: 24, phase: 'committed', moving: true });
    try {
      const expected = sampleIndustrialSoldierPose(state),
        snapshot = JSON.stringify(state);
      assert.deepEqual(sampleIndustrialSoldierPose(state), expected);
      assert.ok(Object.isFrozen(expected));
      applyIndustrialSoldierPose(value.rig, state);
      const first = transforms(value.parent);
      applyIndustrialSoldierPose(value.rig, state);
      assert.deepEqual(transforms(value.parent), first, `${family} same-tick/pause pose`);
      applyIndustrialSoldierPose(value.rig, { ticks: 91, phase: 'recovering', moving: false });
      applyIndustrialSoldierPose(value.rig, state);
      assert.deepEqual(
        transforms(value.parent),
        first,
        `${family} seek back reconstructs the same pose`,
      );
      assert.equal(JSON.stringify(state), snapshot);
    } finally {
      value.dispose();
    }
  }
});

test('blocked, inactive and reduced motion stop gait while reduced effects retain readable phase and armor poses', () => {
  for (const family of INDUSTRIAL_SOLDIER_FAMILIES) {
    const walking = { family, ticks: 8, moving: true, phase: 'committed' };
    assert.notEqual(sampleIndustrialSoldierPose(walking).cycle, 0);
    for (const condition of [{ blocked: true }, { active: false }, { reducedMotion: true }])
      assert.equal(sampleIndustrialSoldierPose({ ...walking, ...condition }).cycle, 0);
    const reduced = { family, ticks: 8, moving: true, phase: 'recovering', reducedMotion: true };
    assert.deepEqual(
      sampleIndustrialSoldierPose(reduced),
      sampleIndustrialSoldierPose({ ...reduced, ticks: 900 }),
    );
  }
  for (const family of ['sprinter', 'brace-trooper']) {
    const warning = { family, phase: 'warning', ticks: 8 };
    assert.ok(sampleIndustrialSoldierPose(warning).sink > 0);
    assert.equal(
      sampleIndustrialSoldierPose({ ...warning, reducedMotion: true }).sink,
      sampleIndustrialSoldierPose(warning).sink,
    );
  }
  const brace = fixture('brace-trooper');
  try {
    applyIndustrialSoldierPose(brace.rig, { ticks: 10, phase: 'recovering', reducedMotion: true });
    assert.equal(brace.rig.accessories.armor.rotation.x, Math.PI / 3);
    applyIndustrialSoldierPose(brace.rig, { ticks: 10, phase: 'warning', reducedMotion: true });
    assert.equal(brace.rig.accessories.armor.rotation.x, 0);
    applyIndustrialSoldierPose(brace.rig, {
      ticks: 11,
      phase: 'burst',
      moving: true,
      reducedMotion: true,
    });
    assert.equal(brace.rig.accessories.armor.rotation.x, 0);
  } finally {
    brace.dispose();
  }
});

test('shield poses preserve the current native heading, including warned turns and reduced motion', () => {
  const value = fixture('shield-bearer'),
    heading = { x: 1000000, z: 0 },
    nextHeading = { x: 0, z: 1000000 };
  value.parent.position.set(4, 2, -6);
  value.parent.rotation.y = Math.atan2(-heading.x, -heading.z);
  const rootPosition = value.parent.position.clone(),
    rootQuaternion = value.parent.quaternion.toArray();
  try {
    for (const phase of ['idle', 'turning', 'committed', 'recovering'])
      for (const reducedMotion of [false, true]) {
        applyIndustrialSoldierPose(value.rig, {
          ticks: 18,
          phase,
          moving: phase === 'committed',
          heading,
          nextHeading,
          reducedMotion,
        });
        assert.deepEqual(value.parent.position, rootPosition);
        assert.deepEqual(value.parent.quaternion.toArray(), rootQuaternion);
        assert.equal(value.rig.accessories.armor.rotation.x, 0);
        assert.equal(value.rig.accessories.armor.rotation.y, 0);
        value.parent.updateMatrixWorld(true);
        const front = new THREE.Vector3(0, 0, -1).transformDirection(
          value.rig.accessories.armor.matrixWorld,
        );
        assert.ok(
          front.distanceTo(new THREE.Vector3(1, 0, 0)) < 1e-9,
          'Shield stays on the accepted protected front',
        );
      }
  } finally {
    value.dispose();
  }
});

test('only the ten unarmed native families enter the exact approved built-in soldier binding', () => {
  const admitted = {
    revision: INDUSTRIAL_SOLDIER_REVISION,
    actor: Object.freeze({ type: 'patrol', role: 'hostile', fireEveryTicks: 0 }),
    family: 'runner',
    huntTarget: true,
    collectionId: 'military-field',
    collectionRevision: 'r1',
    assetRole: 'builtin:military-field-soldier',
  };
  const accepted = INDUSTRIAL_SOLDIER_FAMILIES.filter((family) =>
    resolveIndustrialSoldierFamily({ ...admitted, family }),
  );
  assert.deepEqual([...accepted].sort(), [...PURSUIT_FAMILIES].sort());
  for (const type of ['patrol', 'sentry'])
    for (const family of PURSUIT_FAMILIES)
      assert.equal(
        resolveIndustrialSoldierFamily({ ...admitted, family, actor: { ...admitted.actor, type } }),
        family,
      );
  for (const family of ['guard', 'relay-warden', 'unknown'])
    assert.equal(resolveIndustrialSoldierFamily({ ...admitted, family }), null);
  for (const revision of [
    undefined,
    null,
    'r1',
    'industrial-pilot-v1',
    'industrial-overhead-v2',
    'industrial-roster-v4',
  ])
    assert.equal(resolveIndustrialSoldierFamily({ ...admitted, revision }), null);
  for (const change of [
    { collectionId: 'company' },
    { collectionId: 'authored' },
    { collectionRevision: 'r2' },
    { assetRole: 'company:military-field-soldier' },
    { assetRole: 'builtin:sentry' },
    { assetRole: undefined },
    { huntTarget: false },
    { actor: { ...admitted.actor, type: 'vehicle' } },
    { actor: { ...admitted.actor, role: 'civilian' } },
    { actor: { ...admitted.actor, role: 'rival' } },
    { actor: { ...admitted.actor, fireEveryTicks: 100 } },
    { actor: { ...admitted.actor, fireEveryTicks: undefined } },
  ])
    assert.equal(resolveIndustrialSoldierFamily({ ...admitted, ...change }), null);
  assert.equal(resolveIndustrialSoldierFamily(), null);
});

test('unsupported native rig input fails before host allocation', () => {
  const parent = new THREE.Group();
  let calls = 0;
  const args = {
    THREE,
    parent,
    part: () => calls++,
    family: 'runner',
    cast: 'tactical',
    radius,
    height,
  };
  assert.throws(() => buildIndustrialSoldier({ ...args, family: 'unknown' }), /identity/);
  assert.throws(() => buildIndustrialSoldier({ ...args, cast: 'custom' }), /identity/);
  assert.throws(() => buildIndustrialSoldier({ ...args, radius: 0 }), /dimensions/);
  assert.throws(() => buildIndustrialSoldier({ ...args, height: NaN }), /dimensions/);
  assert.throws(() => buildIndustrialSoldier({ ...args, quality: 'unknown' }), /dimensions/);
  assert.throws(() => buildIndustrialSoldier(args), /paint/);
  const courierPaints = Object.fromEntries(
    industrialSoldierPaintKeys('courier').map((key) => [key, {}]),
  );
  delete courierPaints['#795e3f'];
  assert.throws(
    () => buildIndustrialSoldier({ ...args, family: 'courier', paints: courierPaints }),
    /Missing industrial soldier paint: #795e3f/,
  );
  assert.equal(calls, 0);
  assert.equal(parent.children.length, 0);
});

test('production renderer dispatches Armor Windows to native v3 rigs and releases their owned resources exactly once', async () => {
  const { renderer, scene } = await nativeRendererFixture(),
    course = armorWindowsCourse(),
    original = JSON.stringify(course);
  const actors = () => course.actors.map((actor) => scene.getObjectByName(`actor-${actor.id}`));
  try {
    renderer.setCourse(course);
    for (const [index, family] of ['shield-bearer', 'brace-trooper'].entries()) {
      const group = actors()[index];
      assert.equal(group.userData.soldierRevision, INDUSTRIAL_SOLDIER_REVISION);
      assert.equal(group.userData.soldierFamily, family);
      assert.equal(group.userData.soldierKit, INDUSTRIAL_SOLDIER_KITS[family].id);
      assert.equal(group.userData.collectionId, 'military-field');
      assert.equal(group.userData.assetRole, 'builtin:military-field-soldier');
      assert.ok(group.getObjectByName('industrial-soldier-head'));
      assert.ok(
        group.getObjectByName(
          family === 'shield-bearer'
            ? 'industrial-soldier-front-plate'
            : 'industrial-soldier-brace-panel',
        ),
      );
    }
    const oldGroups = actors(),
      retired = watchActorResources(oldGroups);
    assert.ok([...retired.keys()].some((item) => item.isBufferGeometry));
    assert.ok([...retired.keys()].some((item) => item.isMaterial));
    assert.ok([...retired.keys()].some((item) => item.isTexture));
    assert.ok(renderer.resources().registered.geometries > 0);
    renderer.setCourse(course);
    for (const count of retired.values()) assert.equal(count, 1);
    for (const group of oldGroups) assert.equal(group.parent, null);
    const current = watchActorResources(actors());
    assert.notEqual(actors()[0], oldGroups[0]);
    renderer.dispose();
    for (const count of current.values()) assert.equal(count, 1);
    for (const count of retired.values()) assert.equal(count, 1);
    assert.equal(renderer.resources().registered.geometries, 0);
    assert.equal(renderer.resources().registered.materials, 0);
    assert.equal(renderer.resources().registered.textures, 0);
    renderer.dispose();
    for (const count of current.values()) assert.equal(count, 1);
    assert.equal(JSON.stringify(course), original);
  } finally {
    renderer.dispose();
  }
});

test('production renderer preserves authored, historical and custom soldier ownership gates', async () => {
  const custom = armorWindowsCourse('authored');
  custom.world.themeProfile.id = 'company-field';
  custom.world.themeProfile.assets.enemy = 'company:field-soldier';
  const rejectedBinding = armorWindowsCourse();
  rejectedBinding.world.themeProfile.assets.enemy = 'company:field-soldier';
  for (const { revision, course, rejects = false } of [
    { revision: null, course: armorWindowsCourse() },
    { revision: 'industrial-overhead-v2', course: armorWindowsCourse() },
    { revision: INDUSTRIAL_SOLDIER_REVISION, course: armorWindowsCourse('authored') },
    { revision: INDUSTRIAL_SOLDIER_REVISION, course: custom },
    { revision: INDUSTRIAL_SOLDIER_REVISION, course: rejectedBinding, rejects: true },
  ]) {
    const { renderer, scene } = await nativeRendererFixture(revision),
      original = JSON.stringify(course);
    try {
      if (rejects)
        assert.throws(() => renderer.setCourse(course), /Unsupported SIM asset binding for enemy/);
      else renderer.setCourse(course);
      for (const actor of course.actors) {
        const group = scene.getObjectByName(`actor-${actor.id}`);
        if (rejects && !group) continue;
        assert.ok(group);
        assert.equal(group.userData.themeAsset, course.world.themeProfile.assets.enemy);
        assert.equal(group.userData.soldierRevision, undefined);
        assert.equal(group.userData.soldierFamily, undefined);
        assert.equal(group.getObjectByName('industrial-soldier-head'), undefined);
        if (!rejects) assert.ok(group.children.some((node) => node.isMesh));
      }
      assert.equal(JSON.stringify(course), original);
    } finally {
      renderer.dispose();
      assert.equal(renderer.resources().registered.geometries, 0);
      assert.equal(renderer.resources().registered.materials, 0);
    }
  }
});

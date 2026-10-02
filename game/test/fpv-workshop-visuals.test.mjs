import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../optional-practice/civilian-fpv/vendor/three.module.js';
import * as sharedCollectionContract from '../presentation/theme-system.mjs';
import {
  normalizeSimPresentation,
  resolveSimThemeProfile,
  resolveThemeProfile,
  BUILTIN_SIM_VISUAL_COLLECTIONS,
  SIM_MODEL_ROLES,
  SIM_MATERIAL_ROLES,
  SIM_EFFECT_ROLES,
  validateSimVisualCollection,
  resolveSimVisualCollection,
  playableSimAppearance,
  resolveSimEffects,
} from '../../optional-practice/civilian-fpv/world-themes.mjs';
import {
  WORLD_COURSES,
  ADVENTURE_COURSES,
  FLIGHT_WORLDS,
} from '../../optional-practice/civilian-fpv/world-catalogue.mjs';
import { FLIGHT_COURSES } from '../../optional-practice/civilian-fpv/catalogue.mjs';
import {
  buildWorldVisuals,
  buildDroneVisual,
} from '../../optional-practice/civilian-fpv/world-visuals.mjs';
import {
  createWorkshopTexture,
  createWorkshopBevelNormalTexture,
  configureSimTextureSampling,
  createWorkshopCalibration,
  disposeSimVisualGroup,
  SIM_VISUAL_COLLECTIONS,
  getSimVisualCollection,
  bindSimModelRole,
  validateSimMaterialBinding,
  applySimMaterialBindings,
} from '../../optional-practice/civilian-fpv/world-visuals.mjs';

const presentation = { collectionId: 'industrial-workshop', revision: 'r1' };
const courses = [...FLIGHT_COURSES, ...WORLD_COURSES, ...ADVENTURE_COURSES];
function builders(parent = new THREE.Group()) {
  const material = (color, props = {}) => new THREE.MeshStandardMaterial({ color, ...props });
  const mesh = (geometry, paint, target = parent) => {
    const item = new THREE.Mesh(geometry, paint);
    target.add(item);
    return item;
  };
  const box = (size, at, color, target = parent) => {
    const item = mesh(new THREE.BoxGeometry(...size), material(color), target);
    item.position.set(...at);
    return item;
  };
  return { world: parent, parent, mesh, material, box };
}

test('optional SIM re-exports the same shared offline collection authority', () => {
  assert.equal(
    sharedCollectionContract.BUILTIN_SIM_VISUAL_COLLECTIONS,
    BUILTIN_SIM_VISUAL_COLLECTIONS,
  );
  assert.equal(sharedCollectionContract.validateSimVisualCollection, validateSimVisualCollection);
  assert.equal(sharedCollectionContract.resolveSimVisualCollection, resolveSimVisualCollection);
  assert.equal(sharedCollectionContract.resolveSimEffects, resolveSimEffects);
  assert.equal(sharedCollectionContract.SIM_MODEL_ROLES, SIM_MODEL_ROLES);
  assert.equal(sharedCollectionContract.SIM_MATERIAL_ROLES, SIM_MATERIAL_ROLES);
  assert.equal(sharedCollectionContract.SIM_EFFECT_ROLES, SIM_EFFECT_ROLES);
});

test('versioned SIM collection descriptors are bounded immutable role-complete data with safe fallback', () => {
  for (const descriptor of Object.values(BUILTIN_SIM_VISUAL_COLLECTIONS)) {
    const roundtrip = validateSimVisualCollection(JSON.stringify(descriptor));
    assert.deepEqual(roundtrip, descriptor);
    assert.deepEqual(Object.keys(roundtrip.models), SIM_MODEL_ROLES);
    assert.deepEqual(Object.keys(roundtrip.assets), SIM_MODEL_ROLES);
    assert.deepEqual(Object.keys(roundtrip.materials), SIM_MATERIAL_ROLES);
    assert.deepEqual(Object.keys(roundtrip.effects), SIM_EFFECT_ROLES);
    assert.equal(Object.isFrozen(roundtrip.provenance), true);
    const missing = structuredClone(descriptor);
    delete missing.assets.drone;
    assert.throws(() => validateSimVisualCollection(missing), /role: drone/);
  }
  const prototype = structuredClone(BUILTIN_SIM_VISUAL_COLLECTIONS['industrial-workshop']);
  prototype.provenance.credit = 'x'.repeat(300);
  assert.throws(() => validateSimVisualCollection(prototype), /budget/);
  prototype.provenance.credit = 'Project source';
  prototype.provenance.source = '../outside.mjs';
  assert.throws(() => validateSimVisualCollection(prototype), /source path/);
  const unsupported = { collectionId: 'industrial-workshop', revision: 'r2', drone: 'pixel' },
    selected = resolveSimVisualCollection(unsupported);
  assert.equal(selected.collection.id, 'authored');
  assert.equal(selected.fallbackReason, 'revision-unavailable');
  assert.deepEqual(selected.requested, { collectionId: 'industrial-workshop', revision: 'r2' });
  assert.deepEqual(playableSimAppearance(unsupported).appearance, {
    collectionId: 'authored',
    revision: 'r1',
    drone: 'pixel',
  });
  assert.equal(unsupported.revision, 'r2');
  assert.equal(resolveSimVisualCollection({ collectionId: '__proto__' }).collection.id, 'authored');
  assert.equal(
    SIM_VISUAL_COLLECTIONS['industrial-workshop'].descriptor,
    BUILTIN_SIM_VISUAL_COLLECTIONS['industrial-workshop'],
  );
});

test('collection effect palettes are immutable semantic cues with exact-revision fallback', () => {
  const authored = resolveSimEffects({ id: 'academy', revision: 'r1' }),
    workshop = resolveSimEffects({ id: 'industrial-workshop', revision: 'r1' });
  assert.equal(authored, BUILTIN_SIM_VISUAL_COLLECTIONS.authored.effects);
  assert.equal(workshop, BUILTIN_SIM_VISUAL_COLLECTIONS['industrial-workshop'].effects);
  assert.equal(Object.isFrozen(workshop), true);
  assert.notEqual(workshop.playerPulse, workshop.hostilePulse);
  assert.notEqual(workshop.goalActive, workshop.goalComplete);
  assert.notEqual(workshop.goalActive, workshop.goalInactive);
  assert.equal(resolveSimEffects({ id: 'industrial-workshop', revision: 'r2' }), authored);
  const invalid = structuredClone(BUILTIN_SIM_VISUAL_COLLECTIONS['industrial-workshop']);
  invalid.effects.playerPulse = '#ffffff';
  assert.throws(() => validateSimVisualCollection(invalid), /effect role: playerPulse/);
  invalid.effects.playerPulse = 0x1000000;
  assert.throws(() => validateSimVisualCollection(invalid), /effect role: playerPulse/);
  invalid.effects.playerPulse = 0xffffff;
  delete invalid.effects.ghost;
  assert.throws(() => validateSimVisualCollection(invalid), /effect role: ghost/);
});

test('SIM appearance resolution preserves authored profiles and never mutates course data', () => {
  for (const world of FLIGHT_WORLDS) {
    const course = courses.find((item) => item.environment === world.id),
      before = JSON.stringify(course);
    assert.deepEqual(resolveSimThemeProfile(course), resolveThemeProfile(course));
    const profile = resolveSimThemeProfile(course, presentation);
    assert.equal(profile.id, 'industrial-workshop');
    assert.equal(JSON.stringify(course), before);
    profile.palette.wall = 0;
    assert.notEqual(resolveSimThemeProfile(course, presentation).palette.wall, 0);
    const pinned = {
      ...course,
      world: {
        ...course.world,
        theme: 'industrial-workshop',
        themeProfile: resolveSimThemeProfile(course, presentation),
      },
    };
    assert.equal(resolveSimThemeProfile(pinned).id, 'industrial-workshop');
  }
  assert.throws(() => normalizeSimPresentation({ collectionId: 'missing' }), /Unknown/);
  assert.throws(() => normalizeSimPresentation({ ...presentation, revision: 'r2' }), /revision/);
});

test('industrial textures are deterministic local sRGB art with quality-capped world filtering', () => {
  const a = createWorkshopTexture('steel', { quality: 'high', maxAnisotropy: 16 }),
    b = createWorkshopTexture('steel', { quality: 'low', maxAnisotropy: 16 });
  assert.deepEqual(a.image.data, b.image.data, 'quality changes sampling, not source art');
  assert.equal(a.colorSpace, THREE.SRGBColorSpace);
  assert.equal(a.minFilter, THREE.LinearMipmapLinearFilter);
  assert.equal(a.generateMipmaps, true);
  assert.equal(a.anisotropy, 8);
  assert.equal(b.anisotropy, 1);
  configureSimTextureSampling(a, 'balanced', 2);
  assert.equal(a.anisotropy, 2);
  assert.throws(() => configureSimTextureSampling(a, 'unknown'), /quality/);
  a.dispose();
  b.dispose();
});

test('bevel calibration normals are bounded deterministic linear tangent-space data', () => {
  const texture = createWorkshopBevelNormalTexture({ quality: 'high', maxAnisotropy: 4 }),
    second = createWorkshopBevelNormalTexture();
  assert.equal(texture.colorSpace, THREE.NoColorSpace);
  assert.equal(texture.image.width, 128);
  assert.equal(texture.image.height, 128);
  assert.equal(texture.anisotropy, 4);
  assert.equal(texture.generateMipmaps, true);
  assert.deepEqual(texture.image.data, second.image.data);
  const normals = texture.image.data;
  for (let at = 0; at < normals.length; at += 4) {
    const normal = [0, 1, 2].map((offset) => (normals[at + offset] / 255) * 2 - 1);
    assert.ok(Math.abs(Math.hypot(...normal) - 1) < 0.01);
    assert.ok(normal[2] > 0);
    assert.equal(normals[at + 3], 255);
  }
  assert.notEqual(normals[(32 * 128 + 2) * 4], 128, 'bevel has a sloped X normal');
  texture.dispose();
  second.dispose();
});

test('all built-in environments have industrial materials without moving world geometry', () => {
  const shape = (group) => {
    const rows = [];
    group.traverse((item) => {
      if (item.geometry && !item.userData.cosmeticDetail)
        rows.push({
          type: item.geometry.type,
          position: item.position.toArray(),
          parameters: item.geometry.parameters,
        });
    });
    return rows;
  };
  for (const world of FLIGHT_WORLDS) {
    const course = courses.find((item) => item.environment === world.id),
      original = builders(),
      themed = builders(),
      before = JSON.stringify(course);
    buildWorldVisuals({ ...original, course });
    const result = buildWorldVisuals({ ...themed, course, presentation });
    assert.deepEqual(shape(themed.world), shape(original.world), world.id);
    assert.equal(result.profile.id, 'industrial-workshop');
    assert.equal(result.obstacleMap.userData.simSurface, true);
    assert.equal(
      result.obstacleMap.userData.materialRole,
      ['field', 'woodland', 'orchard'].includes(world.id) ? 'timber' : 'steel',
    );
    assert.equal(JSON.stringify(course), before);
    disposeSimVisualGroup(original.world);
    disposeSimVisualGroup(themed.world);
  }
});

test('flight and hangar share industrial models, preserving explicit drone kind and exterior bounds', () => {
  for (const kind of ['racer', 'pixel', 'utility']) {
    const authored = builders(),
      themed = builders();
    const a = buildDroneVisual({ ...authored, kind });
    const b = buildDroneVisual({
      ...themed,
      kind,
      profile: resolveSimThemeProfile({}, presentation),
    });
    assert.equal(a.rotors.length, 4);
    assert.equal(b.rotors.length, 4);
    assert.equal(themed.parent.userData.modelRole, 'drone');
    assert.equal(themed.parent.userData.droneKind, kind);
    const first = new THREE.Box3().setFromObject(authored.parent),
      second = new THREE.Box3().setFromObject(themed.parent);
    assert.ok(
      first.equals(second),
      `${kind} cosmetic details must remain inside the existing hull`,
    );
    assert.ok(
      themed.parent.children.some((item) => item.material?.userData?.materialRole === 'copper'),
    );
    disposeSimVisualGroup(authored.parent);
    disposeSimVisualGroup(themed.parent);
  }
});

test('container detail batches retain all fittings outside flight bounds without per-container draws', () => {
  const course = courses.find((item) => item.environment === 'container-yard'),
    build = builders(),
    { backdrop } = buildWorldVisuals({ ...build, course, presentation }),
    batches = backdrop.children.filter((item) => item.isInstancedMesh),
    matrix = new THREE.Matrix4(),
    position = new THREE.Vector3();
  assert.equal(batches.length, 2, 'one shared rib batch and one casting batch');
  assert.deepEqual(
    batches.map((item) => item.count).sort((a, b) => a - b),
    [144, 360],
  );
  let released = 0;
  for (const batch of batches) {
    assert.equal(batch.castShadow, false);
    batch.addEventListener('dispose', () => released++);
    for (let index = 0; index < batch.count; index++) {
      batch.getMatrixAt(index, matrix);
      position.setFromMatrixPosition(matrix);
      assert.ok(
        position.x < course.bounds.min.x / 1000 ||
          position.x > course.bounds.max.x / 1000 ||
          position.z < course.bounds.min.z / 1000 ||
          position.z > course.bounds.max.z / 1000,
      );
    }
  }
  disposeSimVisualGroup(build.world);
  assert.equal(released, 2);
});

test('specimen collections bind the same model roles and geometry to distinct material palettes', () => {
  let reference;
  const palettes = new Set();
  for (const collectionId of Object.keys(SIM_VISUAL_COLLECTIONS)) {
    const collection = getSimVisualCollection(collectionId),
      group = createWorkshopCalibration({ collectionId });
    assert.deepEqual(Object.keys(collection.models), [
      'drone',
      'gate',
      'marker',
      'landing-pad',
      'vehicle',
      'enemy',
      'obstacle',
      'scenery',
    ]);
    for (const role of Object.keys(collection.models)) {
      const object = bindSimModelRole(new THREE.Group(), role, collectionId);
      assert.equal(object.userData.modelRole, role);
      assert.equal(object.userData.assetRole, collection.assets[role]);
      assert.equal(object.userData.sourceModel, collection.models[role]);
    }
    assert.ok(Object.isFrozen(collection.materials.steel));
    const geometry = group.children.map((item) => item.geometry.parameters);
    if (reference) assert.deepEqual(geometry, reference);
    else reference = geometry;
    palettes.add(collection.materials.steel.color);
    disposeSimVisualGroup(group);
  }
  assert.equal(palettes.size, 8);
  assert.throws(() => getSimVisualCollection('__proto__'), /Unknown/);
  assert.throws(() => bindSimModelRole(new THREE.Group(), 'missing'), /Missing/);
  const invalid = new THREE.Group();
  invalid.userData.assetRole = 'builtin:missing';
  assert.throws(() => bindSimModelRole(invalid, 'gate'), /Unsupported SIM asset/);
});

test('calibration disposal releases shared resources exactly once', () => {
  const group = createWorkshopCalibration(),
    materials = new Set(),
    textures = new Set(),
    geometries = new Set(),
    counts = new Map();
  assert.equal(group.children.length, 7);
  group.traverse((item) => {
    if (item.geometry) geometries.add(item.geometry);
    if (item.material) materials.add(item.material);
    if (item.material?.map) textures.add(item.material.map);
  });
  group.add(new THREE.Mesh(group.children[0].geometry, group.children[0].material));
  for (const resource of [...materials, ...textures, ...geometries]) {
    counts.set(resource, 0);
    resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1));
  }
  disposeSimVisualGroup(group);
  assert.equal(group.children.length, 0);
  assert.ok([...counts.values()].every((value) => value === 1));
});

test('imported mesh material bindings are opt-in, bounded and revision-specific', () => {
  const root = new THREE.Group(),
    original = new THREE.MeshStandardMaterial({ color: 0xaa55cc, side: THREE.DoubleSide }),
    originalMap = new THREE.DataTexture(new Uint8Array([255, 0, 255, 255]), 1, 1),
    geometry = new THREE.BoxGeometry(2, 3, 4),
    unbound = new THREE.Mesh(geometry, original),
    bound = new THREE.Mesh(geometry, original),
    future = new THREE.Mesh(geometry, original),
    glass = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.3 }),
    ),
    binding = {
      format: 'SimMaterialBinding.v1',
      collectionId: 'industrial-workshop',
      revision: 'r1',
      role: 'steel',
    };
  bound.userData.reveallineTheme = binding;
  original.map = originalMap;
  future.userData.reveallineTheme = { ...binding, revision: 'r2' };
  glass.userData.reveallineTheme = binding;
  bound.position.set(4, 5, 6);
  bound.rotation.y = 0.5;
  root.add(unbound, bound, future, glass);
  root.updateMatrixWorld(true);
  const transform = bound.matrixWorld.clone(),
    originalColor = original.color.getHex(),
    glassMaterial = glass.material;
  const dormant = applySimMaterialBindings(root);
  assert.equal(dormant.applied, 0);
  assert.equal(bound.material, original);
  const report = applySimMaterialBindings(root, { collectionId: 'industrial-workshop' });
  assert.equal(report.applied, 1);
  assert.deepEqual(
    report.diagnostics.map((item) => item.code),
    ['revision-unavailable', 'transparency-protected'],
  );
  assert.equal(unbound.material, original);
  assert.equal(unbound.material.color.getHex(), originalColor);
  assert.equal(unbound.material.map, originalMap);
  assert.deepEqual(originalMap.image.data, new Uint8Array([255, 0, 255, 255]));
  assert.equal(future.material, original);
  assert.equal(glass.material, glassMaterial);
  assert.equal(bound.geometry, geometry);
  assert.deepEqual(bound.matrixWorld, transform);
  assert.equal(bound.material.side, THREE.DoubleSide);
  assert.equal(bound.material.userData.materialRole, 'steel');
  assert.equal(bound.material.map.name, 'workshop-steel-r1');
  assert.deepEqual(bound.userData.reveallineTheme, binding);
  assert.throws(() => validateSimMaterialBinding({ ...binding, role: 'missing' }), /material role/);
  assert.throws(() => validateSimMaterialBinding({ ...binding, code: 'execute' }), /not supported/);
  const maps = new Set([bound.material.map, originalMap]),
    paints = new Set([original, glassMaterial, bound.material, ...root.userData.ownedMaterials]);
  const counts = new Map();
  for (const item of [...maps, ...paints, geometry]) {
    counts.set(item, 0);
    item.addEventListener('dispose', () => counts.set(item, counts.get(item) + 1));
  }
  disposeSimVisualGroup(root);
  assert.ok([...counts.values()].every((count) => count === 1));
});

test('transparent imports require explicit replacement approval and non-mesh bindings do not inherit', () => {
  const root = new THREE.Group(),
    original = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.3 }),
    child = new THREE.Mesh(new THREE.BoxGeometry(), original),
    binding = {
      format: 'SimMaterialBinding.v1',
      collectionId: 'industrial-workshop',
      revision: 'r1',
      role: 'copper',
    };
  root.userData.reveallineTheme = binding;
  root.add(child);
  assert.equal(
    applySimMaterialBindings(root, { collectionId: 'industrial-workshop' }).diagnostics[0].code,
    'mesh-node-required',
  );
  assert.equal(child.material, original);
  child.userData.reveallineTheme = { ...binding, allowTransparencyReplacement: true };
  const result = applySimMaterialBindings(root, { collectionId: 'industrial-workshop' });
  assert.equal(result.applied, 1);
  assert.equal(child.material.transparent, false);
  assert.equal(child.material.opacity, 1);
  assert.equal(child.material.userData.materialRole, 'copper');
  disposeSimVisualGroup(root);
});

test('a glTF mesh-node binding covers only its own loader-identified primitives', () => {
  const root = new THREE.Group(),
    group = new THREE.Group(),
    original = new THREE.MeshStandardMaterial(),
    first = new THREE.Mesh(new THREE.BoxGeometry(), original),
    second = new THREE.Mesh(first.geometry, original),
    authoredChild = new THREE.Mesh(first.geometry, original),
    associations = new Map([
      [group, { nodes: 0, meshes: 0 }],
      [first, { meshes: 0, primitives: 0 }],
      [second, { meshes: 0, primitives: 1 }],
      [authoredChild, { nodes: 1, meshes: 0, primitives: 0 }],
    ]);
  group.userData.reveallineTheme = {
    format: 'SimMaterialBinding.v1',
    collectionId: 'industrial-workshop',
    revision: 'r1',
    role: 'steel',
  };
  group.add(first, second, authoredChild);
  root.add(group);
  const report = applySimMaterialBindings(root, {
    collectionId: 'industrial-workshop',
    associations,
  });
  assert.equal(report.applied, 2);
  assert.deepEqual(report.diagnostics, []);
  assert.equal(first.material, second.material);
  assert.equal(authoredChild.material, original);
  disposeSimVisualGroup(root);
});

test('eight collections cover every environment with protected course data and exterior dressing', () => {
  const matrix = new THREE.Matrix4(),
    box = new THREE.Box3();
  for (const collectionId of Object.keys(SIM_VISUAL_COLLECTIONS)) {
    for (const world of FLIGHT_WORLDS) {
      const course = courses.find((item) => item.environment === world.id),
        before = JSON.stringify(course),
        build = builders();
      const result = buildWorldVisuals({
        ...build,
        course,
        presentation: { collectionId, revision: 'r1' },
      });
      assert.equal(result.profile.id, collectionId);
      assert.equal(build.world.userData.collectionId, collectionId);
      const dressing = build.world.getObjectByName('environment-dressing');
      assert.ok(dressing);
      dressing.traverse((item) => {
        if (!item.isInstancedMesh || !item.userData.outsideFlightBounds) return;
        item.geometry.computeBoundingBox();
        for (let i = 0; i < item.count; i++) {
          item.getMatrixAt(i, matrix);
          box.copy(item.geometry.boundingBox).applyMatrix4(matrix);
          assert.ok(
            box.max.x < course.bounds.min.x / 1000 ||
              box.min.x > course.bounds.max.x / 1000 ||
              box.max.z < course.bounds.min.z / 1000 ||
              box.min.z > course.bounds.max.z / 1000,
            `${collectionId}/${world.id} scenery is outside gameplay volume`,
          );
        }
      });
      assert.equal(JSON.stringify(course), before);
      disposeSimVisualGroup(build.world);
    }
  }
});

test('family surface recipes provide distinct luminance structure beyond a global tint', () => {
  const signatures = new Set();
  for (const collectionId of Object.keys(SIM_VISUAL_COLLECTIONS)) {
    const texture = createWorkshopTexture('enamel', { collectionId });
    const values = texture.image.data,
      average = (at) => values[at] + values[at + 1] + values[at + 2];
    const mean =
      Array.from({ length: 128 * 128 }, (_, i) => average(i * 4)).reduce((a, b) => a + b, 0) /
      (128 * 128);
    signatures.add(
      Array.from({ length: 128 * 128 }, (_, i) => (average(i * 4) > mean ? '1' : '0')).join(''),
    );
    assert.equal(texture.image.width, 128);
    texture.dispose();
  }
  assert.equal(signatures.size, 8, 'all enamel recipes have a unique light/dark motif');
});

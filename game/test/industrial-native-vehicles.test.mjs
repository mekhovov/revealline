import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../optional-practice/civilian-fpv/vendor/three.module.js';
import {
  INDUSTRIAL_VEHICLE_MODELS,
  buildIndustrialVehicle,
  resolveIndustrialVehicleModel,
} from '../../optional-practice/civilian-fpv/industrial-vehicles.mjs';
import { WORLD_VEHICLE_MODELS } from '../../optional-practice/civilian-fpv/world-pursuit.mjs';

function fixture(model, quality = 'balanced', radius = 0.9) {
  const parent = new THREE.Group(),
    paints = Object.fromEntries(
      ['armor', 'dark', 'metal', 'glass', 'threat'].map((role) => [
        role,
        new THREE.MeshBasicMaterial(),
      ]),
    ),
    registered = new Set();
  const result = buildIndustrialVehicle({
    THREE,
    parent,
    model,
    quality,
    radius,
    paints,
    part(shape, paint, at, owner) {
      const mesh = new THREE.Mesh(shape, paint);
      mesh.position.set(...at);
      owner.add(mesh);
      registered.add(mesh);
      return mesh;
    },
  });
  return { parent, paints, registered, result };
}

function vertices(parent) {
  parent.updateMatrixWorld(true);
  const values = [];
  parent.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const position = mesh.geometry.attributes.position;
    for (let i = 0; i < position.count; i++)
      values.push(
        new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld),
      );
  });
  return values;
}

test('native machinery keeps every mesh registered, bounded and inside its quality budget', () => {
  assert.deepEqual(INDUSTRIAL_VEHICLE_MODELS, WORLD_VEHICLE_MODELS);
  for (const model of INDUSTRIAL_VEHICLE_MODELS)
    for (const quality of ['low', 'balanced', 'high']) {
      const radius = 0.9,
        { parent, paints, registered } = fixture(model, quality, radius);
      let count = 0;
      parent.traverse((mesh) => {
        if (!mesh.isMesh) return;
        count++;
        assert.ok(registered.has(mesh), `${model} uses the host ownership boundary`);
        assert.ok(Object.values(paints).includes(mesh.material), `${model} borrows host materials`);
      });
      assert.ok(count <= (quality === 'low' ? 45 : 90), `${model}/${quality}: ${count} meshes`);
      assert.ok(count >= 25, `${model}/${quality} has distinct articulated parts`);
      for (const point of vertices(parent)) {
        assert.ok(
          Math.hypot(point.x, point.z) <= radius * 1.15 + 1e-6,
          `${model}/${quality} footprint`,
        );
        assert.ok(
          point.y >= -1e-6 && point.y <= radius * 1.6 + 1e-6,
          `${model}/${quality} marker clearance`,
        );
      }
    }
});

test('native vehicle silhouettes retain their specific equipment and animation axes', () => {
  const expectedWheels = {
    'field-utility': 4,
    'cargo-truck': 6,
    'armored-carrier': 8,
    'field-tank': 8,
    'relay-truck': 6,
  };
  for (const [model, count] of Object.entries(expectedWheels)) {
    const { parent, result } = fixture(model);
    assert.equal(result.wheels.length, count);
    for (const axle of result.wheels) {
      assert.ok(axle.isGroup);
      assert.equal(axle.getObjectByName('industrial-tire').rotation.z, Math.PI / 2);
      axle.rotation.x = Math.PI * 0.37;
    }
    if (model === 'field-tank') {
      assert.equal(result.accessories.tracks.length, 2);
      assert.ok(result.accessories.cupola);
      assert.ok(result.accessories.barrel.position.z < 0, 'fixed barrel points forward along -Z');
      assert.ok(parent.getObjectByName('industrial-engine-grille'));
    } else if (model === 'field-utility') {
      assert.ok(result.accessories.spare);
      assert.ok(result.accessories.rack);
    } else if (model === 'armored-carrier') {
      assert.ok(parent.getObjectByName('industrial-carrier-armor'));
      assert.ok(parent.getObjectByName('industrial-rear-ramp'));
    } else {
      assert.ok(parent.getObjectByName('industrial-canopy'));
      assert.ok(parent.getObjectByName('industrial-canopy-strap'));
    }
    if (model === 'relay-truck') {
      assert.ok(result.radar.isGroup);
      assert.ok(result.accessories.reel);
      result.radar.rotation.y = Math.PI * 0.43;
    } else assert.equal(result.radar, null);
    for (const point of vertices(parent)) {
      assert.ok(Math.hypot(point.x, point.z) <= 0.9 * 1.15 + 1e-6, `${model} animated footprint`);
      assert.ok(point.y >= -1e-6 && point.y <= 0.9 * 1.6 + 1e-6, `${model} animated height`);
    }
  }
});

test('native machinery is repeatable and scales with the existing collision proxy without changing it', () => {
  const descriptor = Object.freeze({ type: 'vehicle', vehicleModel: 'cargo-truck', radius: 900 });
  const first = vertices(
      fixture(descriptor.vehicleModel, 'balanced', descriptor.radius / 1000).parent,
    ),
    repeated = vertices(
      fixture(descriptor.vehicleModel, 'balanced', descriptor.radius / 1000).parent,
    ),
    doubled = vertices(
      fixture(descriptor.vehicleModel, 'balanced', descriptor.radius / 500).parent,
    );
  assert.deepEqual(first, repeated);
  assert.equal(first.length, doubled.length);
  for (let i = 0; i < first.length; i++)
    assert.ok(first[i].clone().multiplyScalar(2).distanceTo(doubled[i]) < 1e-6);
  assert.deepEqual(descriptor, { type: 'vehicle', vehicleModel: 'cargo-truck', radius: 900 });
});

test('native model resolution preserves explicit v3 appearance and exact collection ownership', () => {
  const builtin = {
    actor: { type: 'vehicle' },
    courseFormat: 'FlightCourse.v2',
    collectionId: 'military-field',
    collectionRevision: 'r1',
    assetRole: 'builtin:military-utility-car',
  };
  assert.equal(resolveIndustrialVehicleModel(builtin), 'field-utility');
  for (const model of INDUSTRIAL_VEHICLE_MODELS)
    assert.equal(
      resolveIndustrialVehicleModel({
        ...builtin,
        actor: { type: 'vehicle', vehicleModel: model },
        courseFormat: 'FlightCourse.v3',
      }),
      model,
    );
  for (const value of [
    { ...builtin, actor: { type: 'drone' } },
    { ...builtin, actor: { type: 'vehicle', vehicleModel: 'field-tank' } },
    {
      ...builtin,
      actor: { type: 'vehicle', vehicleModel: 'company-tank' },
      courseFormat: 'FlightCourse.v3',
    },
    { ...builtin, collectionId: 'company' },
    { ...builtin, collectionRevision: 'r2' },
    { ...builtin, assetRole: 'company:military-utility-car' },
    { ...builtin, assetRole: undefined },
  ])
    assert.equal(resolveIndustrialVehicleModel(value), null);
});

test('unsupported builder input fails before allocating geometry or changing its parent', () => {
  const parent = new THREE.Group();
  let calls = 0;
  const args = { THREE, parent, part: () => calls++, model: 'unknown', radius: 1 };
  assert.throws(() => buildIndustrialVehicle(args), /Unsupported industrial vehicle model/);
  assert.throws(
    () => buildIndustrialVehicle({ ...args, model: 'field-tank', radius: 0 }),
    /radius/,
  );
  assert.throws(
    () => buildIndustrialVehicle({ ...args, model: 'field-tank', quality: 'unknown' }),
    /quality/,
  );
  assert.throws(() => buildIndustrialVehicle({ ...args, model: 'field-tank' }), /paint/);
  assert.equal(calls, 0);
  assert.equal(parent.children.length, 0);
});

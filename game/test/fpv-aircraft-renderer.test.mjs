import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../optional-practice/civilian-fpv/vendor/three.module.js';
import {
  buildPhysicalAircraftVisual,
  createAircraftReferenceVisual,
  createFlightViewFrame,
} from '../../optional-practice/civilian-fpv/renderer.mjs';
import {
  listAircraftPresets,
  createPresetConfiguration,
} from '../../optional-practice/civilian-fpv/aircraft-presets.mjs';

function visual(configuration, kind = 'racer') {
  const parent = new THREE.Group();
  const result = buildPhysicalAircraftVisual({
    configuration,
    parent,
    kind,
    material: (color, options) => new THREE.MeshStandardMaterial({ color, ...options }),
    mesh: (geometry, material, group) => {
      const mesh = new THREE.Mesh(geometry, material);
      group.add(mesh);
      return mesh;
    },
  });
  // The surrounding flight renderer applies this historical scale each frame.
  parent.scale.setScalar((configuration.radius * 1000) / 220);
  parent.updateMatrixWorld(true);
  return { parent, result };
}
const close = (actual, expected, label) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, `${label}: ${actual} != ${expected}`);

test('all catalog aircraft render their physical rotor positions and dimensions after legacy scale normalization', () => {
  const bounds = new Set();
  for (const preset of listAircraftPresets()) {
    const { aircraft } = createPresetConfiguration(preset.id),
      { parent, result } = visual(aircraft);
    assert.equal(result.rotors.length, 4);
    assert.equal(result.root.userData.aircraftId, preset.id);
    for (const [index, rotor] of result.rotors.entries()) {
      const actual = rotor.getWorldPosition(new THREE.Vector3()),
        expected = aircraft.geometry.rotors[index];
      for (const axis of ['x', 'y', 'z'])
        close(actual[axis], expected.position[axis], `${preset.id} rotor ${index} ${axis}`);
      close(rotor.userData.radius, aircraft.geometry.propellerRadius, 'physical prop radius');
      assert.equal(rotor.userData.spin, -expected.spin);
      assert.equal(
        Boolean(parent.getObjectByName(`aircraft-duct-${index}`)),
        aircraft.geometry.ducted,
      );
    }
    const body = parent.getObjectByName('aircraft-body');
    const battery = parent.getObjectByName('aircraft-battery');
    assert.ok(body && battery);
    const bodyBounds = new THREE.Box3().setFromObject(body),
      batteryBounds = new THREE.Box3().setFromObject(battery);
    const underslung = ['mobula8-analog-2023', 'cetus-x-betaflight-2022'].includes(preset.id);
    close(
      (underslung ? batteryBounds : bodyBounds).min.y,
      -aircraft.geometry.bodyHalfExtents.y,
      'aircraft support height',
    );
    close(
      batteryBounds.max.y,
      aircraft.geometry.bodyHalfExtents.y * (underslung ? -0.4 : 1),
      'battery top fits physical envelope',
    );
    bounds.add(
      new THREE.Box3().setFromObject(parent).getSize(new THREE.Vector3()).toArray().join(','),
    );
  }
  assert.equal(bounds.size, listAircraftPresets().length);
});

test('skins retain physical size and rotor geometry while changing cosmetic color', () => {
  const { aircraft } = createPresetConfiguration('meteor75-analog-2022');
  const original = visual(aircraft, 'racer'),
    pixel = visual(aircraft, 'pixel');
  assert.notEqual(original.result.tint.color.getHex(), pixel.result.tint.color.getHex());
  assert.deepEqual(
    new THREE.Box3().setFromObject(original.parent),
    new THREE.Box3().setFromObject(pixel.parent),
  );
  assert.deepEqual(
    original.result.rotors.map((r) => r.position.toArray()),
    pixel.result.rotors.map((r) => r.position.toArray()),
  );
});

test('civilian Mobula8 appearance uses guarded three-blade props and an orange canopy without changing physics', () => {
  const configuration = createPresetConfiguration('mobula8-analog-2023').aircraft;
  const before = JSON.stringify(configuration);
  const { parent, result } = visual(configuration);
  assert.equal(JSON.stringify(configuration), before);
  assert.equal(result.tint.color.getHex(), 0xf06632);
  assert.ok(parent.getObjectByName('aircraft-canopy'));
  const canopyBounds = new THREE.Box3().setFromObject(parent.getObjectByName('aircraft-canopy'));
  const batteryBounds = new THREE.Box3().setFromObject(parent.getObjectByName('aircraft-battery'));
  assert.ok(
    canopyBounds.min.y > batteryBounds.max.y,
    'canopy remains visible above underslung battery',
  );
  for (const [index, rotor] of result.rotors.entries()) {
    assert.equal(rotor.children.filter((part) => part.name === 'propeller-blade').length, 3);
    assert.equal(
      parent.getObjectByName(`aircraft-duct-${index}`).material.color.getHex(),
      0x30343b,
    );
    assert.equal(parent.getObjectByName(`aircraft-duct-${index}`).material.side, THREE.DoubleSide);
  }
});

test('two-blade reference aircraft retain their actual blade count in the visual model', () => {
  for (const id of ['meteor75-analog-2022', 'meteor85-analog', 'holybro-x650-v2']) {
    const { result } = visual(createPresetConfiguration(id).aircraft);
    for (const rotor of result.rotors)
      assert.equal(rotor.children.filter((part) => part.name === 'propeller-blade').length, 2, id);
  }
});

test('rendered fuselage and rotors use the same center-of-mass coordinate convention', () => {
  const { aircraft } = createPresetConfiguration('nazgul-eco-xl5-v11');
  aircraft.geometry.centerOfMass = { x: 0.01, y: 0.008, z: -0.006 };
  for (const rotor of aircraft.geometry.rotors)
    for (const axis of ['x', 'y', 'z'])
      rotor.position[axis] -= aircraft.geometry.centerOfMass[axis];
  const { parent, result } = visual(aircraft);
  const body = parent.getObjectByName('aircraft-body').getWorldPosition(new THREE.Vector3());
  close(body.x, -0.01, 'body x');
  close(body.z, 0.006, 'body z');
  const rotor = result.rotors[0].getWorldPosition(new THREE.Vector3());
  close(rotor.x, aircraft.geometry.rotors[0].position.x, 'rotor x');
  close(rotor.y, aircraft.geometry.rotors[0].position.y, 'rotor y');
});

test('view frame uses actual support height independently of collision radius and camera offsets', () => {
  const camera = new THREE.PerspectiveCamera(82, 1, 0.035, 300),
    aircraft = new THREE.Group();
  const frame = createFlightViewFrame({ camera, aircraft });
  const state = {
    ticks: 0,
    position: { x: 2000, y: 0, z: 3000 },
    orientation: [0, 0, 0, 1000000],
    aircraftSupportHeightMm: 18,
    aircraftRadiusMm: 58,
  };
  frame.originMm = { x: 1000, y: 0, z: 2000 };
  frame.cameraOffsetMm = { x: 0, y: 5, z: -20 };
  frame.draw(state);
  close(aircraft.position.y, 0.018, 'COM uses support height rather than radius');
  close(aircraft.scale.x, 58 / 220, 'actual radius scale');
  close(camera.position.y, 0.023, 'camera height');
  close(camera.position.z, 0.98, 'camera mount');
  frame.cameraOffsetMm = null;
  frame.radiusMm = 220;
  frame.draw({ ticks: 1, position: state.position, orientation: state.orientation });
  close(aircraft.position.y, 0.22, 'legacy center offset');
  close(aircraft.scale.x, 1, 'legacy scale');
  close(camera.position.y, 0.22, 'legacy camera height');
});

test('physical rotor animation honors each motor direction and does not advance while paused', () => {
  const camera = new THREE.PerspectiveCamera(82, 1, 0.035, 300),
    aircraft = new THREE.Group();
  const frame = createFlightViewFrame({ camera, aircraft });
  frame.rotors = [1, -1, 1, -1].map((spin) => {
    const rotor = new THREE.Group();
    rotor.userData.spin = spin;
    return rotor;
  });
  const state = {
    ticks: 0,
    position: { x: 0, y: 0, z: 0 },
    orientation: [0, 0, 0, 1000000],
    lastInput: { throttle: 500 },
  };
  frame.draw(state);
  state.ticks = 5;
  frame.draw(state);
  const angles = frame.rotors.map((rotor) => rotor.rotation.y);
  assert.ok(angles[0] > 0 && angles[1] < 0 && angles[2] > 0 && angles[3] < 0);
  frame.draw(state);
  assert.deepEqual(
    frame.rotors.map((rotor) => rotor.rotation.y),
    angles,
  );
});

test('new civilian whoops use original guarded geometry, distinct canopies and correct blade counts', () => {
  const colors = new Set();
  for (const [id, blades] of [
    ['cetus-x-betaflight-2022', 4],
    ['protos-16-aio-1-0', 3],
  ]) {
    const aircraft = createPresetConfiguration(id).aircraft;
    const before = structuredClone(aircraft);
    const { parent, result } = visual(aircraft);
    colors.add(result.tint.color.getHex());
    assert.deepEqual(aircraft, before);
    assert.ok(parent.getObjectByName('aircraft-canopy'));
    for (const [index, rotor] of result.rotors.entries()) {
      assert.ok(parent.getObjectByName(`aircraft-duct-${index}`));
      assert.equal(rotor.children.filter((part) => part.name === 'propeller-blade').length, blades);
    }
    const canopy = new THREE.Box3().setFromObject(parent.getObjectByName('aircraft-canopy'));
    const battery = new THREE.Box3().setFromObject(parent.getObjectByName('aircraft-battery'));
    if (id === 'cetus-x-betaflight-2022') assert.ok(canopy.min.y > battery.max.y);
    else {
      assert.ok(battery.min.y > 0, 'Protos battery stays in the upper/integrated bay');
      assert.ok(
        battery.getCenter(new THREE.Vector3()).z > canopy.getCenter(new THREE.Vector3()).z,
        'Protos battery is behind the front camera canopy',
      );
    }
  }
  assert.equal(colors.size, 2);
});

const presentation = (id = 'meteor75-analog-2022', end = 2) => ({
  format: 'AircraftCoursePresentation.v1',
  aircraft: createPresetConfiguration(id).aircraft,
  completedAtTick: end,
  pathStride: end === 2 ? 1 : 65536,
  sourceSampleCount: end + 1,
  maxPathSamples: 8192,
  path:
    end === 2
      ? [
          [0, 1, 2, 3, 0, 0, 0, 1],
          [1, 2, 3, 4, 0, 0, 0, 1],
          [2, 3, 4, 5, 0, 0, 0, 1],
        ]
      : [
          [0, 1, 2, 3, 0, 0, 0, 1],
          [end, 3, 4, 5, 0, 0, 0, 1],
        ],
});
function referenceVisual({ fail = false, failRelease = () => false } = {}) {
  const parent = new THREE.Group(),
    live = new Set(),
    disposed = new Set();
  const legacy = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  legacy.name = 'legacy-pb';
  parent.add(legacy);
  const own = (resource) => {
    live.add(resource);
    resource.addEventListener('dispose', () => {
      live.delete(resource);
      disposed.add(resource);
    });
    return resource;
  };
  const ref = createAircraftReferenceVisual({
    parent,
    material: (color, extras) => own(new THREE.MeshStandardMaterial({ color, ...extras })),
    mesh: (shape, paint, group) => {
      own(shape);
      const part = new THREE.Mesh(shape, paint);
      group.add(part);
      if (fail) throw new Error('preview build failed');
      return part;
    },
    release: (group) => {
      if (failRelease()) throw new Error('preview cleanup failed');
      const owned = new Set(group.userData.ownedMaterials ?? []);
      group.traverse((part) => {
        if (part.geometry) owned.add(part.geometry);
        if (part.material) owned.add(part.material);
      });
      for (const item of owned) item.dispose();
      group.userData.ownedMaterials = [];
      group.clear();
    },
  });
  return {
    ref,
    parent,
    legacy,
    live,
    disposed,
    root: parent.getObjectByName('aircraft-practice-reference'),
  };
}
test('all aircraft reference models use metre COM poses, exact rotor geometry and independent resources', () => {
  for (const preset of listAircraftPresets()) {
    const f = referenceVisual(),
      source = presentation(preset.id),
      aircraft = structuredClone(source.aircraft);
    assert.equal(f.ref.set(source), true);
    source.path[1][1] = 999;
    source.aircraft.geometry.propellerRadius = 999;
    f.ref.draw(1, { view: 'chase' });
    f.parent.updateMatrixWorld(true);
    assert.deepEqual(f.ref.snapshot().pose.position, [2, 3, 4]);
    assert.equal(f.ref.snapshot().aircraftId, preset.id);
    assert.equal(f.root.visible, true);
    const rotors = [];
    f.root.traverse((part) => {
      if (part.userData.spin) rotors.push(part);
    });
    assert.equal(rotors.length, 4);
    for (const [index, rotor] of rotors.entries()) {
      const world = rotor.getWorldPosition(new THREE.Vector3());
      for (const [axis, origin] of [
        ['x', 2],
        ['y', 3],
        ['z', 4],
      ])
        close(
          world[axis],
          origin + aircraft.geometry.rotors[index].position[axis],
          preset.id + axis,
        );
      close(rotor.rotation.y, 0.72 * rotor.userData.spin, 'physical spin direction');
    }
    f.ref.draw(1, { view: 'chase', reducedMotion: true });
    for (const rotor of rotors) assert.equal(rotor.rotation.y, 0);
    const count = f.live.size;
    assert.ok(count > 0);
    f.ref.set(presentation(preset.id));
    assert.equal(f.live.size, count, 'replacement releases old resources');
    f.ref.clear();
    assert.equal(f.live.size, 0);
    assert.ok(f.disposed.size > count);
    assert.equal(f.legacy.parent, f.parent);
    assert.equal(f.legacy.material.opacity, 1);
    assert.equal(f.ref.snapshot().samples, 0);
    assert.equal(f.root.visible, false);
  }
});
test('reference orientation/COM, overlap, long clocks, finish hold and clear are presentation only', () => {
  const f = referenceVisual(),
    source = presentation('holybro-x650-v2', 40000);
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  source.path[1].splice(4, 4, ...q.toArray());
  f.ref.set(source);
  f.ref.draw(50000, { view: 'chase' });
  assert.deepEqual(f.ref.snapshot().pose.position, [3, 4, 5]);
  assert.equal(f.ref.snapshot().pose.finished, true);
  assert.equal(f.ref.snapshot().pose.tick, 40000);
  f.parent.updateMatrixWorld(true);
  const rotor = [];
  f.root.traverse((p) => {
    if (p.userData.spin) rotor.push(p);
  });
  const p = source.aircraft.geometry.rotors[0].position;
  const expected = new THREE.Vector3(p.x, p.y, p.z)
    .applyQuaternion(q)
    .add(new THREE.Vector3(3, 4, 5));
  assert.ok(rotor[0].getWorldPosition(new THREE.Vector3()).distanceTo(expected) < 1e-8);
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(3, 4, 5);
  f.ref.draw(40000, { camera, view: 'fpv' });
  assert.equal(f.root.visible, false);
  camera.position.set(30, 40, 50);
  f.ref.draw(40000, { camera, view: 'fpv' });
  assert.equal(f.root.visible, true);
  f.ref.draw(40000, { camera, view: 'editor' });
  assert.equal(f.root.visible, false);
  const before = f.ref.snapshot();
  assert.throws(() => f.ref.set({ ...source, path: [] }), /presentation/);
  assert.deepEqual(f.ref.snapshot(), before, 'invalid replacement retains the accepted visual');
  f.ref.clear();
  f.ref.draw(1);
  assert.equal(f.ref.snapshot().samples, 0);
  const failed = referenceVisual({ fail: true });
  assert.equal(failed.ref.set(presentation()), false);
  assert.equal(failed.live.size, 0);
  assert.equal(failed.ref.snapshot().samples, 0);
});

test('optional reference draw and cleanup failures cannot escape into flight rendering', () => {
  const f = referenceVisual();
  f.ref.set(presentation());
  f.root.position.fromArray = () => {
    throw new Error('presentation failure');
  };
  assert.doesNotThrow(() => f.ref.draw(1, { view: 'chase' }));
  assert.equal(f.ref.active(), false);
  assert.equal(f.root.visible, false);
  assert.equal(f.live.size, 0);
  let failRelease = false;
  const g = referenceVisual({ failRelease: () => failRelease });
  g.ref.set(presentation());
  failRelease = true;
  assert.doesNotThrow(() => g.ref.clear());
  assert.equal(g.ref.active(), false);
  assert.equal(g.root.visible, false);
  assert.equal(g.root.children.length, 0);
  const allocated = g.live.size;
  assert.equal(g.ref.set(presentation()), false);
  assert.equal(g.live.size, allocated, 'failed cleanup prevents further optional allocations');
  assert.equal(g.legacy.parent, g.parent);
});

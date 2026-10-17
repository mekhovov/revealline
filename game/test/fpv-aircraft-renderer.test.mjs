import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../optional-practice/civilian-fpv/vendor/three.module.js';
import {
  buildPhysicalAircraftVisual,
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

test('all twelve aircraft render their physical rotor positions and dimensions after legacy scale normalization', () => {
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
    close(bodyBounds.min.y, -aircraft.geometry.bodyHalfExtents.y, 'body support height');
    close(
      batteryBounds.max.y,
      aircraft.geometry.bodyHalfExtents.y,
      'battery top fits physical envelope',
    );
    bounds.add(
      new THREE.Box3().setFromObject(parent).getSize(new THREE.Vector3()).toArray().join(','),
    );
  }
  assert.equal(bounds.size, 12);
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

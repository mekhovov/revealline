import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { parse } from 'acorn';
import * as THREE from '../../optional-practice/civilian-fpv/vendor/three.module.js';
import {
  buildPhysicalAircraftVisual,
  createAircraftReferenceVisual,
  createFlightViewFrame,
  createCombatSurfaceAttachments,
  combatWeaponVisualOffset,
  combatMuzzleActive,
  combatProjectileStyle,
  positionFpvAircraftVisual,
} from '../../optional-practice/civilian-fpv/renderer.mjs';
import {
  aircraftAppearance,
  buildFpvAircraftVisual,
} from '../../optional-practice/civilian-fpv/aircraft-appearance.mjs';

async function analogRendererFunctions() {
  const source = await readFile(
    new URL('../../optional-practice/civilian-fpv/renderer.mjs', import.meta.url),
    'utf8',
  );
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const create = ast.body.find(
    (node) =>
      node.type === 'ExportNamedDeclaration' &&
      node.declaration?.id?.name === 'createFlightRenderer',
  ).declaration;
  const pass = ast.body.find(
    (node) => node.type === 'FunctionDeclaration' && node.id.name === 'createAnalogVideoPass',
  );
  const render = create.body.body.find(
    (node) => node.type === 'FunctionDeclaration' && node.id.name === 'renderFlight',
  );
  return {
    pass: source.slice(pass.start, pass.end),
    render: source.slice(render.start, render.end),
  };
}

test('Analog video pass bounds memory, keeps reduced-motion noise still and releases GPU resources', async () => {
  const source = await analogRendererFunctions();
  const create = vm.runInNewContext(`${source.pass}; createAnalogVideoPass`, { THREE });
  let target, material;
  const renderer = {
    extensions: { has: () => true },
    getDrawingBufferSize: (size) => size.set(3840, 2160),
    setRenderTarget(value) {
      target = value;
    },
    render(stage) {
      material = stage.children[0].material;
    },
  };
  const pass = create(renderer);
  pass.begin(0.35, 8, false);
  const feed = target;
  assert.equal(feed.width, 1920);
  assert.equal(feed.height, 1080);
  assert.equal(feed.texture.type, THREE.HalfFloatType);
  const destination = {};
  pass.finish(destination);
  assert.equal(target, destination);
  assert.equal(material.uniforms.clock.value, 8);
  assert.equal(material.uniforms.motion.value, 1);
  assert.equal(material.uniforms.strength.value, 0.35);
  pass.begin(0.7, 12, true);
  assert.equal(material.uniforms.clock.value, 0);
  assert.equal(material.uniforms.motion.value, 0);
  assert.equal(material.uniforms.strength.value, 0.7);
  let released = 0;
  feed.addEventListener('dispose', () => released++);
  material.addEventListener('dispose', () => released++);
  pass.dispose();
  assert.equal(released, 2);
});

test('Analog render gate follows the current native or regional camera and releases its pass outside FPV', async () => {
  const source = await analogRendererFunctions();
  const calls = [],
    destination = {};
  let target = destination,
    disposed = 0;
  const context = vm.createContext({
    renderer: {
      info: { reset() {} },
      getRenderTarget: () => target,
      setRenderTarget(value) {
        target = value;
      },
      render(scene) {
        calls.push(scene);
      },
    },
    scene: {},
    camera: {},
    fpvVisual: null,
    view: 'chase',
    flightViewFrame: { view: 'fpv' },
    analogPass: null,
    analogAmount: 0.35,
    analogClock: 3,
    reducedMotion: true,
    createAnalogVideoPass: () => ({
      begin(...args) {
        calls.push(args);
        target = {};
      },
      finish(value) {
        assert.equal(value, destination);
      },
      dispose() {
        disposed++;
      },
    }),
  });
  vm.runInContext(source.render, context);
  context.renderFlight();
  assert.deepEqual(calls[0], [0.35, 3, true], 'Regional FPV ignores a stale native Chase mode');
  assert.equal(target, destination);
  for (const mode of ['chase', 'overview', 'editor']) {
    context.flightViewFrame.view = mode;
    context.view = 'fpv';
    calls.length = 0;
    context.renderFlight();
    assert.deepEqual(calls, [context.scene], `${mode} renders without video degradation`);
    assert.equal(target, destination);
  }
  assert.equal(disposed, 1);
  context.flightViewFrame.view = 'fpv';
  context.analogAmount = 0;
  calls.length = 0;
  context.renderFlight();
  assert.deepEqual(calls, [context.scene], 'Zero strength bypasses the extra render target');
});

test('projectile families have distinct readable silhouettes and hostile colors', () => {
  const rifle = combatProjectileStyle('enemy-rifle', 'enemy'),
    energy = combatProjectileStyle('enemy-energy', 'enemy'),
    heavy = combatProjectileStyle('enemy-heavy', 'enemy');
  assert.equal(new Set([rifle.color, energy.color, heavy.color]).size, 3);
  assert.ok(energy.scale[0] > rifle.scale[0]);
  assert.ok(heavy.scale[2] > rifle.scale[2]);
  assert.ok(
    combatProjectileStyle('scatter').scale[2] < combatProjectileStyle('autocannon').scale[2],
  );
  assert.ok(
    combatProjectileStyle('precision').scale[2] > combatProjectileStyle('autocannon').scale[2],
  );
  assert.equal(combatProjectileStyle('bomb').emissive, 0);
  assert.equal(combatProjectileStyle('remote').emissive, 0);
  assert.equal(combatProjectileStyle('enemy-rifle', 'enemy', { hostilePulse: 123 }).color, 123);
});

test('all weapon barrels and flashes align with the simulated muzzle across aircraft sizes', () => {
  for (const radius of [60, 115, 220, 340])
    for (const weapon of ['autocannon', 'scatter', 'precision', 'rocket']) {
      const offset = combatWeaponVisualOffset(radius, weapon),
        scale = radius / 220;
      const barrelEnd = weapon === 'precision' ? 0.3 : 0.26;
      assert.ok(Math.abs((offset.z - barrelEnd) * scale * 1000 + radius + 40) < 1e-9);
      assert.equal(offset.y - 0.035, 0);
      assert.equal(offset.flashZ + 0.07, -barrelEnd);
    }
});

test('weapon flashes match the fired weapon and cannot freeze on the terminal result', () => {
  const encounter = {
    status: 'active',
    ticks: 40,
    events: [{ type: 'fire', actor: 'player', weapon: 'autocannon', tick: 40 }],
  };
  assert.equal(combatMuzzleActive(encounter, 'autocannon'), true);
  assert.equal(combatMuzzleActive(encounter, 'rocket'), false);
  assert.equal(combatMuzzleActive({ ...encounter, status: 'victory' }, 'autocannon'), false);
  assert.equal(combatMuzzleActive({ ...encounter, ticks: 43 }, 'autocannon'), false);
});

test('remains attachments survive renderer replacement and recentering without snapping to a lower floor', () => {
  const root = new THREE.Group();
  let origin = { x: 0, y: 0, z: 0 };
  const floor = (name, y) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshBasicMaterial());
    mesh.name = name;
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = y;
    root.add(mesh);
    root.updateMatrixWorld(true);
    return mesh;
  };
  const lower = floor('lower-floor', 0);
  let upper = floor('elevated-cell', 5);
  const attachments = createCombatSurfaceAttachments({
    roots: () => [['region', root]],
    originMm: () => origin,
  });
  const saved = {
    position: { x: 0, y: 5000, z: 0 },
    normal: { x: 0, y: 1, z: 0 },
    ...attachments.read({ object: upper, point: new THREE.Vector3(0, 5, 0) }),
  };
  assert.equal(attachments.resolve(saved).position.y, 5000);
  upper.removeFromParent();
  assert.equal(
    attachments.resolve(saved),
    null,
    'absent upper floor cannot become the lower floor',
  );
  upper = floor('elevated-cell', 5);
  root.remove(lower);
  root.add(lower);
  assert.equal(
    attachments.resolve(saved).position.y,
    5000,
    'named support survives changed streaming order',
  );
  upper.position.y = 6;
  assert.equal(
    attachments.resolve(saved).position.y,
    6000,
    'admitted moving support carries its attachment',
  );
  origin = { x: 0, y: 1000, z: 0 };
  upper.position.y = 5;
  assert.equal(
    attachments.resolve(saved).position.y,
    6000,
    'recenter keeps global contact unchanged',
  );
  upper.visible = false;
  assert.equal(attachments.resolve(saved), null);
  root.traverse((object) => {
    object.geometry?.dispose();
    object.material?.dispose();
  });
});

test('combat surface rays ignore sprites and hidden scene branches', () => {
  const root = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshBasicMaterial());
  floor.rotation.x = -Math.PI / 2;
  const label = new THREE.Sprite(new THREE.SpriteMaterial());
  label.raycast = () => {
    throw new Error('A label is not supporting geometry');
  };
  root.add(label, floor);
  root.updateMatrixWorld(true);
  const attachments = createCombatSurfaceAttachments({
    roots: () => [['world', root]],
    originMm: () => ({ x: 0, y: 0, z: 0 }),
  });
  const ray = new THREE.Raycaster(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, -1, 0));
  assert.equal(attachments.intersections(ray)[0].object, floor);
  root.visible = false;
  assert.equal(attachments.intersections(ray).length, 0);
  floor.geometry.dispose();
  floor.material.dispose();
  label.material.dispose();
});
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
    assert.ok(
      rotor.children
        .filter((part) => part.name === 'propeller-blade')
        .every((part) => part.material.color.getHex() === 0xbac1c8),
      'the physical Mobula8 keeps its original propeller colour',
    );
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
    for (const rotor of result.rotors) {
      const blades = rotor.children.filter((part) => part.name === 'propeller-blade');
      assert.equal(blades.length, 2, id);
      assert.ok(
        blades.every((part) => part.material.color.getHex() === 0xa1d9e7),
        `${id}: foreground black props do not recolour the physical aircraft`,
      );
    }
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

test('close chase camera preserves heading through roll, clamps distance and respects collision resolution', () => {
  const camera = new THREE.PerspectiveCamera(),
    aircraft = new THREE.Group();
  const frame = createFlightViewFrame({ camera, aircraft });
  const state = { ticks: 0, position: { x: 0, y: 1000, z: 0 }, orientation: [0, 0, 0, 1000000] };
  frame.view = 'chase';
  frame.draw(state);
  close(camera.position.z, 1.6, 'default distance');
  close(camera.position.y - aircraft.position.y, 0.6, 'default height');
  const before = camera.position.clone();
  frame.draw({ ...state, orientation: [0, 0, 707107, 707107] });
  assert.ok(camera.position.distanceTo(before) < 1e-6, 'roll cannot orbit the chase camera');
  frame.chaseDistance = 20;
  frame.draw(state);
  close(camera.position.z, 6, 'far clamp');
  frame.chaseDistance = 0;
  frame.draw(state);
  close(camera.position.z, 0.75, 'near clamp');
  frame.resolveChase = (from, to) => to.lerp(from, 0.5);
  frame.draw(state);
  close(camera.position.z, 0.375, 'wall clearance');
  frame.view = 'fpv';
  frame.draw(state);
  assert.equal(aircraft.visible, false);
  const fpvPosition = camera.position.clone(),
    fpvRotation = camera.quaternion.clone();
  frame.showFpvProps = true;
  frame.draw(state);
  assert.equal(aircraft.visible, false, 'FPV never exposes the full world-sized chase model');
  assert.deepEqual(camera.position, fpvPosition, 'A cosmetic toggle cannot move the camera');
  assert.deepEqual(camera.quaternion.toArray(), fpvRotation.toArray());
});

function fpvVisual(configuration = null, kind = 'racer', quality = 'high') {
  const parent = new THREE.Group();
  const result = buildFpvAircraftVisual({
    configuration,
    parent,
    kind,
    quality,
    material: (color, options) => new THREE.MeshStandardMaterial({ color, ...options }),
    mesh: (geometry, material, group) => {
      const item = new THREE.Mesh(geometry, material);
      group.add(item);
      return item;
    },
  });
  return {
    ...result,
    dispose() {
      const geometry = new Set(),
        materials = new Set();
      parent.traverse((item) => {
        if (item.geometry) geometry.add(item.geometry);
        for (const paint of Array.isArray(item.material) ? item.material : [item.material])
          if (paint) materials.add(paint);
      });
      for (const item of geometry) item.dispose();
      for (const item of materials) item.dispose();
    },
  };
}

function projectedFpvBounds(visual, camera) {
  camera.updateMatrixWorld(true);
  visual.root.updateMatrixWorld(true);
  const vertex = new THREE.Vector3(),
    parts = [];
  visual.root.traverse((item) => {
    if (!item.isMesh) return;
    for (let owner = item; owner; owner = owner.parent) if (!owner.visible) return;
    const vertices = item.geometry.getAttribute('position'),
      bounds = new THREE.Box3();
    for (let index = 0; index < vertices.count; index++)
      bounds.expandByPoint(
        vertex.fromBufferAttribute(vertices, index).applyMatrix4(item.matrixWorld).project(camera),
      );
    parts.push({ name: item.name, bounds });
  });
  return parts;
}

test('FPV foreground uses black three-blade ten-inch props without changing aircraft identity or spin', () => {
  for (const configuration of [
    null,
    ...listAircraftPresets().map((row) => createPresetConfiguration(row.id).aircraft),
  ])
    for (const kind of ['racer', 'pixel', 'utility']) {
      const source = configuration && structuredClone(configuration),
        visual = fpvVisual(configuration, kind),
        paint = aircraftAppearance(configuration?.id),
        front = [...(configuration?.geometry.rotors ?? [])]
          .sort((a, b) => a.position.z - b.position.z)
          .slice(0, 2)
          .sort((a, b) => a.position.x - b.position.x);
      try {
        assert.equal(visual.root.userData.aircraftId, configuration?.id ?? kind);
        assert.equal(visual.rotors.length, 2);
        for (const [index, rotor] of visual.rotors.entries()) {
          assert.equal(rotor.userData.bladeCount, 3);
          close(rotor.userData.radius, 0.127, 'ten-inch foreground prop radius');
          assert.equal(
            rotor.userData.spin,
            front[index] ? -front[index].spin : index === 0 ? -1 : 1,
          );
          assert.deepEqual(
            visual.sides[index].children,
            [rotor],
            'only the rotating propeller belongs in each camera peripheral group',
          );
          assert.deepEqual(
            rotor.children.map((part) => part.name).sort(),
            ['fpv-propeller-motion-blur', 'fpv-swept-propeller-blades'],
            'foreground excludes motors, bells, hubs, nuts, arms and stationary guards',
          );
        }
        assert.equal(visual.armorGroups.length, 0, 'guards remain on the physical aircraft only');
        assert.equal(visual.propPaint.color.getHex(), 0x0b0e12);
        assert.ok(
          visual.blurMaterials.every((material) => material.color.getHex() === 0x0b0e12),
          'blur inherits the black foreground prop colour',
        );
        const expectedColor =
          kind === 'pixel' ? 0xf3a870 : kind === 'utility' ? 0xaec8af : paint.canopyColor;
        assert.equal(visual.tint.color.getHex(), new THREE.Color(expectedColor).getHex());
        assert.deepEqual(configuration, source);
      } finally {
        visual.dispose();
      }
    }
});

test('all FPV quality tiers retain three curved black blades, invisible pivots and bounded transparent blur', () => {
  for (const quality of ['low', 'balanced', 'high']) {
    const visual = fpvVisual(null, 'racer', quality),
      camera = new THREE.PerspectiveCamera(82, 16 / 9, 0.035, 300);
    try {
      for (const rotor of visual.rotors) {
        const props = rotor.children.filter((part) => part.name === 'fpv-swept-propeller-blades');
        assert.equal(props.length, 1, `${quality}: blades share one material and mesh`);
        assert.equal(rotor.userData.bladeCount, 3);
        close(rotor.userData.radius, 0.127, `${quality}: ten-inch prop radius`);
        assert.ok(
          props.some((part) => part.geometry.getAttribute('position').count > 100),
          `${quality}: curved solid blades replace the rectangle primitive`,
        );
        for (const part of props) {
          assert.equal(part.geometry.type, 'BufferGeometry');
          for (const attribute of ['position', 'normal', 'uv'])
            assert.ok([...part.geometry.getAttribute(attribute).array].every(Number.isFinite));
          assert.equal(part.castShadow, false);
          assert.equal(part.material.color.getHex(), 0x0b0e12);
          assert.equal(part.material.transparent, true);
          assert.equal(part.material.depthWrite, false);
          assert.equal(part.material.fog, false);
          const positions = part.geometry.getAttribute('position'),
            bladeVertices = positions.count / 3,
            axis = new THREE.Vector3(0, 1, 0),
            base = new THREE.Vector3(),
            rotated = new THREE.Vector3();
          assert.ok(Number.isInteger(bladeVertices));
          let outerRadius = 0;
          for (let i = 0; i < bladeVertices; i++) {
            base.fromBufferAttribute(positions, i);
            const radius = Math.hypot(base.x, base.z);
            assert.ok(radius > 0.01, `${quality}: no visible hub fills the propeller pivot`);
            outerRadius = Math.max(outerRadius, radius);
            for (let blade = 1; blade < 3; blade++) {
              rotated.copy(base).applyAxisAngle(axis, (blade * Math.PI * 2) / 3);
              const actual = new THREE.Vector3().fromBufferAttribute(
                positions,
                i + bladeVertices * blade,
              );
              assert.ok(
                rotated.distanceTo(actual) < 1e-6,
                `${quality}: three equal blades have distinct 120-degree positions`,
              );
            }
          }
          assert.ok(
            outerRadius > 0.12 && outerRadius < 0.131,
            `${quality}: nominal ten-inch sweep`,
          );
        }
      }
      positionFpvAircraftVisual(visual, camera, { throttle: 1000 });
      assert.ok(visual.blurMaterials.every((paint) => paint.opacity > 0 && paint.opacity <= 0.2));
      close(visual.propPaint.opacity, 0.32, `${quality}: spinning blades stay translucent`);
      assert.ok(
        visual.blurMaterials.every((paint) => paint.depthWrite === false && paint.fog === false),
      );
      positionFpvAircraftVisual(visual, camera, { throttle: 0 });
      assert.ok(visual.blurMaterials.every((paint) => paint.opacity === 0));
      close(visual.propPaint.opacity, 0.7, `${quality}: stopped blades stay readable`);
      positionFpvAircraftVisual(visual, camera, { throttle: 1000, reducedMotion: true });
      assert.ok(visual.blurMaterials.every((paint) => paint.opacity === 0));
      close(
        visual.propPaint.opacity,
        0.7,
        `${quality}: reduced motion keeps the still presentation`,
      );
    } finally {
      visual.dispose();
    }
  }
});

test('FPV foreground stays peripheral across every preset, skin, lens and screen shape', () => {
  const configurations = [
      null,
      ...listAircraftPresets().map((row) => createPresetConfiguration(row.id).aircraft),
    ],
    camera = new THREE.PerspectiveCamera(82, 1, 0.035, 300);
  camera.position.set(12, 3, -7);
  camera.rotation.set(0.12, 0.41, -0.18);
  for (const configuration of configurations)
    for (const kind of ['racer', 'pixel', 'utility']) {
      const source = configuration && structuredClone(configuration),
        visual = fpvVisual(configuration, kind);
      try {
        assert.equal(visual.sides.length, 2);
        assert.equal(visual.rotors.length, 2);
        for (const fov of [60, 82, 120])
          for (const aspect of [0.6, 1, 16 / 9, 21 / 9]) {
            camera.fov = fov;
            camera.aspect = aspect;
            camera.updateProjectionMatrix();
            const position = camera.position.clone(),
              rotation = camera.quaternion.clone();
            positionFpvAircraftVisual(visual, camera, {
              visible: true,
              phase: 0.43,
              throttle: 800,
              encounter: { weapons: [{ id: 'precision' }, { id: 'scatter' }], weaponIndex: 0 },
            });
            assert.deepEqual(camera.position, position);
            assert.deepEqual(camera.quaternion.toArray(), rotation.toArray());
            const parts = projectedFpvBounds(visual, camera),
              context = `${configuration?.id ?? 'generic'}/${kind}/${fov}/${aspect}`;
            assert.ok(parts.length > 0, context);
            let visibleParts = 0;
            for (const { name, bounds } of parts) {
              assert.ok(
                [...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite),
                `${context}/${name}`,
              );
              assert.ok(
                bounds.min.z > -1 && bounds.max.z < 1,
                `${context}/${name}: no near/far clipping`,
              );
              const intersectsCenter =
                bounds.min.x < 0.5 &&
                bounds.max.x > -0.5 &&
                bounds.max.y > -0.4 &&
                bounds.min.y < 1;
              assert.equal(
                intersectsCenter,
                false,
                `${context}/${name}: aim and flight corridor stay clear`,
              );
              if (bounds.min.x < 1 && bounds.max.x > -1 && bounds.min.y < 1 && bounds.max.y > -1)
                visibleParts++;
            }
            assert.ok(visibleParts >= 2, `${context}: both front assemblies are visible`);
          }
        assert.deepEqual(configuration, source, 'FPV framing never changes aircraft physics');
      } finally {
        visual.dispose();
      }
    }
});

test('FPV swept props and cosmetic knife preserve the central half at every phase and camera tilt', () => {
  for (const quality of ['low', 'balanced', 'high']) {
    const visual = fpvVisual(null, 'racer', quality),
      camera = new THREE.PerspectiveCamera(82, 16 / 9, 0.035, 300);
    try {
      assert.equal(visual.knife.userData.cosmeticOnly, true);
      for (const fov of [60, 82, 120])
        for (const aspect of [0.6, 1, 16 / 9, 21 / 9])
          for (const tilt of [-20, 0, 60])
            for (let phase = 0; phase < Math.PI * 2; phase += Math.PI / 6) {
              camera.fov = fov;
              camera.aspect = aspect;
              camera.updateProjectionMatrix();
              positionFpvAircraftVisual(visual, camera, {
                phase,
                tilt,
                throttle: 800,
                showKnife: true,
                encounter: { weapons: [{ id: 'rocket' }, { id: 'precision' }], weaponIndex: 0 },
              });
              assert.equal(visual.knife.visible, true);
              for (const { name, bounds } of projectedFpvBounds(visual, camera)) {
                assert.equal(
                  bounds.min.x < 0.5 &&
                    bounds.max.x > -0.5 &&
                    bounds.min.y < 0.5 &&
                    bounds.max.y > -0.5,
                  false,
                  `${quality}/${fov}/${aspect}/${tilt}/${phase}/${name}: middle 50% × 50% is clear`,
                );
                assert.ok(bounds.min.z > -1 && bounds.max.z < 1);
              }
            }
      positionFpvAircraftVisual(visual, camera, { showKnife: false });
      assert.equal(visual.knife.visible, false);
      positionFpvAircraftVisual(visual, camera, { visible: false, showKnife: true });
      assert.equal(visual.root.visible, false, 'knife is subordinate to the foreground preference');
    } finally {
      visual.dispose();
    }
  }
});

test('FPV nose stays 22–28 percent wide and 8–10 percent high without raising the flight camera', () => {
  for (const kind of ['racer', 'pixel', 'utility']) {
    const visual = fpvVisual(null, kind),
      camera = new THREE.PerspectiveCamera(82, 16 / 9, 0.035, 300);
    try {
      for (const fov of [60, 82, 120])
        for (const aspect of [0.6, 1, 16 / 9, 21 / 9]) {
          camera.fov = fov;
          camera.aspect = aspect;
          camera.updateProjectionMatrix();
          positionFpvAircraftVisual(visual, camera, { showKnife: true });
          const shell = new THREE.Box3();
          for (const { name, bounds } of projectedFpvBounds(visual, camera))
            if (name.startsWith('fpv-canopy-shell')) shell.union(bounds);
          const width = (shell.max.x - shell.min.x) / 2,
            height = (shell.max.y - Math.max(-1, shell.min.y)) / 2;
          assert.ok(width >= 0.22 && width <= 0.28, `${kind}/${fov}/${aspect}: ${width}`);
          assert.ok(height >= 0.08 && height <= 0.1, `${kind}/${fov}/${aspect}: ${height}`);
          assert.deepEqual(camera.position.toArray(), [0, 0, 0]);
          assert.deepEqual(camera.quaternion.toArray(), [0, 0, 0, 1]);
        }
    } finally {
      visual.dispose();
    }
  }
});

test('FPV prop preference preserves camera pose, pauses rotor phase and follows view visibility', () => {
  const camera = new THREE.PerspectiveCamera(82, 16 / 9, 0.035, 300),
    aircraft = new THREE.Group(),
    visual = fpvVisual(),
    frame = createFlightViewFrame({ camera, aircraft }),
    state = {
      ticks: 0,
      position: { x: 2000, y: 1000, z: 3000 },
      orientation: [0, 0, 0, 1000000],
      lastInput: { throttle: 800 },
    };
  frame.fpvVisual = visual;
  try {
    frame.draw(state);
    const position = camera.position.clone(),
      rotation = camera.quaternion.clone();
    assert.equal(visual.root.visible, false);
    frame.showFpvProps = true;
    frame.draw(state);
    assert.equal(visual.root.visible, true);
    assert.equal(aircraft.visible, false);
    assert.deepEqual(camera.position, position);
    assert.deepEqual(camera.quaternion.toArray(), rotation.toArray());
    state.ticks = 4;
    frame.draw(state);
    const angles = visual.rotors.map((rotor) => rotor.rotation.y);
    assert.ok(angles.some((angle) => angle !== 0));
    frame.draw(state);
    assert.deepEqual(
      visual.rotors.map((rotor) => rotor.rotation.y),
      angles,
      'Paused accepted time cannot spin the props',
    );
    frame.reducedMotion = true;
    state.ticks++;
    frame.draw(state);
    assert.deepEqual(
      visual.rotors.map((rotor) => rotor.rotation.y),
      angles,
    );
    assert.ok(visual.blurMaterials.every((paint) => paint.opacity === 0));
    frame.view = 'chase';
    frame.draw(state);
    assert.equal(visual.root.visible, false);
    assert.equal(aircraft.visible, true);
    frame.view = 'fpv';
    frame.showFpvProps = false;
    frame.draw(state);
    assert.equal(visual.root.visible, false);
  } finally {
    visual.dispose();
  }
});

test('FPV shows only the two equipped weapon mounts and only the active accepted muzzle flash', () => {
  const visual = fpvVisual(),
    camera = new THREE.PerspectiveCamera(82, 16 / 9, 0.035, 300),
    weapons = ['autocannon', 'scatter', 'precision', 'rocket'];
  try {
    assert.equal(visual.weaponGroups.length, 2);
    for (const first of weapons)
      for (const second of weapons.filter((id) => id !== first)) {
        const encounter = {
          weapons: [{ id: first }, { id: second }],
          weaponIndex: 1,
          ticks: 42,
          status: 'active',
          events: [{ type: 'fire', actor: 'player', weapon: second, tick: 42 }],
        };
        const before = structuredClone(encounter);
        positionFpvAircraftVisual(visual, camera, { encounter });
        for (const [slot, mounts] of visual.weaponGroups.entries())
          for (const [id, mount] of Object.entries(mounts)) {
            assert.equal(mount.visible, encounter.weapons[slot].id === id);
            const flash = mount.getObjectByName('muzzle-flash');
            if (flash) assert.equal(flash.visible, slot === 1 && id === second);
          }
        assert.deepEqual(encounter, before);
        encounter.status = 'victory';
        positionFpvAircraftVisual(visual, camera, { encounter });
        for (const mounts of visual.weaponGroups)
          for (const mount of Object.values(mounts))
            assert.notEqual(mount.getObjectByName('muzzle-flash')?.visible, true);
      }
    positionFpvAircraftVisual(visual, camera, { encounter: null });
    assert.ok(
      visual.weaponGroups.every((mounts) => Object.values(mounts).every((mount) => !mount.visible)),
    );
    const frame = createFlightViewFrame({ camera, aircraft: new THREE.Group() }),
      state = {
        ticks: 0,
        position: { x: 0, y: 1000, z: 0 },
        orientation: [0, 0, 0, 1000000],
      };
    frame.fpvVisual = visual;
    frame.showFpvProps = true;
    frame.draw({
      ...state,
      encounter: { weapons: [{ id: 'rocket' }, { id: 'scatter' }], weaponIndex: 0 },
    });
    assert.equal(visual.weaponGroups[0].rocket.visible, true);
    assert.equal(visual.weaponGroups[1].scatter.visible, true);
    frame.draw(state);
    assert.equal(visual.root.visible, true);
    assert.ok(
      visual.weaponGroups.every((mounts) => Object.values(mounts).every((mount) => !mount.visible)),
      'A noncombat flight frame clears stale equipped pods without hiding the front arms',
    );
  } finally {
    visual.dispose();
  }
});

/** Exact historical camera/aircraft presentation comparison; no GPU or physics claims. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as THREE from "../../../optional-practice/civilian-fpv/vendor/three.module.js";
import { createFlightViewFrame } from "../../../optional-practice/civilian-fpv/renderer.mjs";
import {
  buildDroneVisual,
  disposeSimVisualGroup,
} from "../../../optional-practice/civilian-fpv/world-visuals.mjs";
const baseline = "07cf04c4052b1118b644f63809ef6840acb45e08";
const original = execFileSync(
  "git",
  ["show", baseline + ":optional-practice/civilian-fpv/renderer.mjs"],
  {
    cwd: fileURLToPath(new URL("../../../", import.meta.url)),
    maxBuffer: 1024 * 1024,
  },
).toString();
const start = original.indexOf("    const displayFov = mapView"),
  end = original.indexOf("    if (currentStep !== state.step)", start);
assert(start > 0 && end > start);
const historicalFactory = new Function(
  "THREE",
  "camera",
  "aircraft",
  "droneVisual",
  `
 const framePosition=new THREE.Vector3(),frameRotation=new THREE.Quaternion(),cameraOffset=new THREE.Vector3(),cameraTiltRotation=new THREE.Quaternion(),cameraTiltAxis=new THREE.Vector3(1,0,0);
 let rotorTick=null,rotorPhase=0;
 return {reset(){rotorTick=null;rotorPhase=0;},draw(state,view,fov,tilt,course,editorCamera,reducedMotion){const mapView=view==="overview"||view==="editor";
 ${original.slice(start, end)}
 }};
`,
);
const make = () => ({
  camera: new THREE.PerspectiveCamera(82, 1, 0.035, 900),
  aircraft: new THREE.Group(),
  rotors: Array.from({ length: 4 }, () => new THREE.Object3D()),
});
const receipt = (value) => {
  value.camera.updateMatrixWorld();
  value.aircraft.updateMatrixWorld();
  return {
    camera: value.camera.position.toArray(),
    quaternion: value.camera.quaternion.toArray(),
    up: value.camera.up.toArray(),
    projection: value.camera.projectionMatrix.toArray(),
    cameraMatrix: value.camera.matrixWorld.toArray(),
    aircraft: value.aircraft.position.toArray(),
    rotation: value.aircraft.quaternion.toArray(),
    scale: value.aircraft.scale.toArray(),
    visible: value.aircraft.visible,
    rotors: value.rotors.map((rotor) => rotor.rotation.y),
  };
};
let comparisons = 0;
for (const aspect of [390 / 844, 844 / 390, 1280 / 800, 16 / 9])
  for (const radius of [220, 350]) {
    const a = make(),
      b = make(),
      current = createFlightViewFrame(b),
      historical = historicalFactory(THREE, a.camera, a.aircraft, {
        rotors: a.rotors,
      });
    a.camera.aspect = b.camera.aspect = aspect;
    a.camera.updateProjectionMatrix();
    b.camera.updateProjectionMatrix();
    current.rotors = b.rotors;
    const course = {
        bounds: {
          min: { x: -80000, y: 0, z: -60000 },
          max: { x: 100000, y: 40000, z: 90000 },
        },
        rules: { droneRadius: radius },
      },
      editor = { yaw: 0.65, pitch: 0.72, distance: null };
    current.bounds = course.bounds;
    current.radiusMm = radius;
    current.editorCamera = editor;
    for (const orientation of [
      [0, 0, 0, 1000000],
      [707107, 0, 0, 707107],
      [0, 707107, 0, 707107],
      [0, 0, 1000000, 0],
      [100000, -230000, 170000, 950000],
    ])
      for (const view of ["fpv", "chase", "overview", "editor"]) {
        for (const reduced of [false, true])
          for (const ticks of [0, 1, 2, 2, 9, 3, 12]) {
            const state = {
              position: { x: -17453, y: 2389, z: 12307 },
              orientation,
              ticks,
              lastInput: { throttle: (ticks % 3) * 500 },
            };
            current.view = view;
            current.fov = 106;
            current.tilt = 24;
            current.reducedMotion = reduced;
            historical.draw(state, view, 106, 24, course, editor, reduced);
            current.draw(state);
            assert.deepEqual(
              receipt(b),
              receipt(a),
              `${aspect}/${radius}/${view}/${ticks}/${reduced}`,
            );
            comparisons++;
          }
        historical.reset();
        current.reset();
      }
  }
// Floating origin changes local translations only. Angles, projection and prop phases agree.
for (const view of ["fpv", "chase", "overview", "editor"]) {
  const a = make(),
    b = make(),
    first = createFlightViewFrame(a),
    shifted = createFlightViewFrame(b),
    origin = { x: 256000, y: 128000, z: 384000 };
  const state = {
      position: { x: 300123, y: 180456, z: 450789 },
      orientation: [0, 382683, 0, 923880],
      ticks: 21,
      lastInput: { throttle: 700 },
    },
    bounds = {
      min: { x: 256000, y: 0, z: 384000 },
      max: { x: 640000, y: 250000, z: 768000 },
    };
  for (const frame of [first, shifted]) {
    frame.view = view;
    frame.bounds = bounds;
    frame.rotors = frame === first ? a.rotors : b.rotors;
  }
  shifted.originMm = origin;
  first.draw(state);
  shifted.draw(state);
  const before = receipt(a),
    after = receipt(b);
  for (let i = 0; i < 3; i++) {
    assert(
      Math.abs(
        after.camera[i] + Object.values(origin)[i] / 1000 - before.camera[i],
      ) < 1e-10,
    );
    assert(
      Math.abs(
        after.aircraft[i] +
          Object.values(origin)[i] / 1000 -
          before.aircraft[i],
      ) < 1e-10,
    );
  }
  // lookAt subtraction after recentering may differ by floating-point rounding.
  for (let i = 0; i < 4; i++)
    assert(
      Math.abs(after.quaternion[i] - before.quaternion[i]) < 1e-12,
      view + "/quaternion",
    );
  for (const key of [
    "up",
    "projection",
    "rotation",
    "scale",
    "visible",
    "rotors",
  ])
    assert.deepEqual(after[key], before[key], view + "/" + key);
}
// Same production aircraft builder and ownership cleanup, without a WebGL context.
const parent = new THREE.Group(),
  material = (color, extras = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extras });
const mesh = (geometry, paint, root = parent) => {
  const value = new THREE.Mesh(geometry, paint);
  root.add(value);
  return value;
};
const box = (size, at, color, root = parent) => {
  const value = mesh(new THREE.BoxGeometry(...size), material(color), root);
  value.position.set(...at);
  return value;
};
const drone = buildDroneVisual({
  parent,
  mesh,
  material,
  box,
  kind: "racer",
  quality: "balanced",
});
assert.equal(drone.rotors.length, 4);
const owned = new Set();
parent.traverse((item) => {
  if (item.geometry) owned.add(item.geometry);
  if (item.material) owned.add(item.material);
  for (const paint of item.userData.ownedMaterials ?? []) owned.add(paint);
});
let disposed = 0;
for (const item of owned) item.addEventListener("dispose", () => disposed++);
disposeSimVisualGroup(parent);
assert.equal(disposed, owned.size);
assert.equal(parent.children.length, 0);
console.log(
  JSON.stringify({
    baseline,
    exactHistoricalFrames: comparisons,
    originViews: 4,
    disposedOwnedObjects: disposed,
    runtime: process.version,
    gpuVerified: false,
  }),
);

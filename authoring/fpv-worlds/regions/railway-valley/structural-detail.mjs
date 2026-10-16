/** Original structural landmarks. Every solid is both visible and collidable. */
import * as THREE from '../../../../optional-practice/civilian-fpv/vendor/three.module.js';

export function createStructuralDetail() {
  const pieces = [];
  const steel = [0.16, 0.23, 0.27],
    amber = [0.75, 0.47, 0.12],
    blue = [0.14, 0.39, 0.49],
    hallSteel = [0.58, 0.63, 0.6],
    serviceBlue = [0.25, 0.56, 0.65];
  function box(id, color, centre, size, quaternion) {
    const geometry = new THREE.BoxGeometry(...size);
    if (quaternion) geometry.applyQuaternion(quaternion);
    geometry.translate(...centre);
    pieces.push({
      id,
      color,
      centre,
      positionsMm: Array.from(geometry.attributes.position.array, (v) => Math.round(v * 1000)),
      indices: Array.from(geometry.index.array),
    });
    geometry.dispose();
  }
  function beam(id, color, a, b, width = 0.3) {
    const delta = new THREE.Vector3(...b).sub(new THREE.Vector3(...a));
    const rotation = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      delta.clone().normalize(),
    );
    box(
      id,
      color,
      a.map((v, i) => (v + b[i]) / 2),
      [width, delta.length(), width],
      rotation,
    );
  }
  // Side-plane Warren braces leave the full central above-deck route open.
  for (const x of [187, 197]) {
    for (const [a, b] of [
      [144, 176],
      [176, 208],
    ]) {
      beam(`trestle-diagonal-up-${x}-${a}`, steel, [x, 16.8, a], [x, 27.5, b]);
      beam(`trestle-diagonal-down-${x}-${a}`, steel, [x, 27.5, a], [x, 16.8, b]);
    }
    beam(`trestle-top-chord-${x}`, blue, [x, 27.5, 144], [x, 27.5, 208], 0.4);
  }
  for (const z of [144, 176, 208]) {
    // Cross bracing stays overhead; pilots can read the next open portal below it.
    beam(`trestle-roof-left-${z}`, steel, [187, 27.4, z], [192, 27.4, z + 8]);
    beam(`trestle-roof-right-${z}`, steel, [197, 27.4, z], [192, 27.4, z + 8]);
    for (const x of [187, 197])
      box(`trestle-foot-mark-${x}-${z}`, amber, [x, 17.5, z], [0.45, 1.2, 0.45]);
  }
  // Deep exposed roof frames provide scale above the retained 20 m centre flight line.
  for (const z of [50, 70, 90]) {
    beam(`hall-tie-${z}`, hallSteel, [280.8, 22.8, z], [319.2, 22.8, z], 0.26);
    beam(`hall-truss-west-${z}`, hallSteel, [280.8, 22.8, z], [300, 25.8, z]);
    beam(`hall-truss-east-${z}`, hallSteel, [300, 25.8, z], [319.2, 22.8, z]);
    for (const x of [290, 300, 310]) {
      const top = 25.8 - (Math.abs(300 - x) * 3) / 19.2;
      beam(`hall-truss-hanger-${x}-${z}`, hallSteel, [x, 22.8, z], [x, top, z], 0.18);
    }
  }
  // Side-wall service runs and workshop stations stay well outside the clear centre lane.
  beam('hall-service-trunk', serviceBlue, [281.5, 21.8, 46], [281.5, 21.8, 94], 0.38);
  for (const z of [54, 70, 86]) {
    beam(`hall-service-drop-${z}`, serviceBlue, [281.5, 17, z], [281.5, 21.8, z], 0.25);
    box(`hall-service-cabinet-${z}`, serviceBlue, [282, 15.7, z], [1.4, 3.4, 2]);
    box(`hall-workbench-${z}`, [0.43, 0.29, 0.16], [316.5, 15.6, z], [3, 0.35, 4]);
    for (const x of [315.4, 317.6])
      for (const dz of [-1.5, 1.5])
        box(`hall-bench-leg-${z}-${x}-${dz}`, hallSteel, [x, 14.75, z + dz], [0.2, 1.5, 0.2]);
  }
  for (const z of [41.5, 98.5])
    for (const x of [292.3, 307.7])
      box(`hall-door-jamb-${x}-${z}`, amber, [x, 19, z], [0.3, 10, 0.35]);
  return pieces;
}

export const structuralProbes = [
  { id: 'trestle-side-brace', from: [184, 22.15, 160], to: [190, 22.15, 160], clear: false },
  { id: 'trestle-open-side-triangle', from: [184, 19, 160], to: [190, 19, 160], clear: true },
  { id: 'hall-roof-tie', from: [300, 21, 70], to: [300, 24, 70], clear: false },
  { id: 'hall-service-cabinet', from: [282, 16, 51], to: [282, 16, 57], clear: false },
  { id: 'hall-workbench', from: [316.5, 18, 54], to: [316.5, 14.5, 54], clear: false },
  { id: 'hall-below-roof', from: [284, 20, 70], to: [316, 20, 70], clear: true },
];

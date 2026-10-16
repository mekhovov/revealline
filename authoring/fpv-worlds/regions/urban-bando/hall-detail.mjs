/** Original industrial service/roof composition. Metres; exact mesh surfaces also collide. */
import * as THREE from '../../../../optional-practice/civilian-fpv/vendor/three.module.js';

export function createHallDetail() {
  const groups = new Map();
  function add(name, color, geometry) {
    if (!groups.has(name))
      groups.set(name, { id: `hall-${name}`, color, positionsMm: [], indices: [] });
    const group = groups.get(name),
      offset = group.positionsMm.length / 3;
    for (const value of geometry.attributes.position.array)
      group.positionsMm.push(Math.round(value * 1000));
    for (const index of geometry.index.array) group.indices.push(offset + index);
    geometry.dispose();
  }
  function member(name, color, a, b, radius, round = false) {
    const from = new THREE.Vector3(...a),
      to = new THREE.Vector3(...b),
      direction = to.clone().sub(from);
    const length = direction.length();
    const geometry = round
      ? new THREE.CylinderGeometry(radius, radius, length, 12, 1, false)
      : new THREE.BoxGeometry(radius, length, radius);
    geometry.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()),
    );
    geometry.translate(...from.add(to).multiplyScalar(0.5).toArray());
    add(name, color, geometry);
  }
  const steel = [0.22, 0.31, 0.35],
    duct = [0.47, 0.53, 0.54],
    collar = [0.56, 0.35, 0.13];
  // Rounded service trunks sit above the outer floor lanes, not the central hall route.
  for (const x of [176, 204]) {
    member('ducts', duct, [x, 8.8, 34], [x, 8.8, 94], 0.58, true);
    for (const z of [40, 64, 88]) {
      member('collars', collar, [x, 8.8, z - 0.09], [x, 8.8, z + 0.09], 0.67, true);
    }
    for (const z of [38, 64, 90]) member('hangers', steel, [x, 9.35, z], [x, 11.2, z], 0.12, true);
  }
  // Two open gable trusses change the silhouette while retaining the existing vertical dive at z=50.
  for (const z of [44, 84]) {
    member('roof-frames', steel, [167.8, 12.5, z], [190, 16, z], 0.3);
    member('roof-frames', steel, [190, 16, z], [212.2, 12.5, z], 0.3);
    member('roof-frames', steel, [167.8, 12.5, z], [212.2, 12.5, z], 0.25);
    for (const x of [179, 201]) {
      member('roof-frames', steel, [x, 12.5, z], [x, 14.3, z], 0.18);
      member('roof-frames', steel, [x, 12.5, z], [190, 16, z], 0.18);
    }
  }
  for (const x of [179, 201]) member('roof-frames', steel, [x, 14.3, 44], [x, 14.3, 84], 0.2);
  for (const z of [26.5, 101.5]) {
    const canopy = new THREE.BoxGeometry(17, 0.22, 6.5);
    canopy.rotateX(z < 64 ? -0.05 : 0.05);
    canopy.translate(190, 9.3, z);
    add('door-canopies', [0.18, 0.28, 0.32], canopy);
    for (const x of [182, 198])
      member(
        'canopy-braces',
        steel,
        [x, 7.8, z < 64 ? 29.5 : 98.5],
        [x, 9.1, z < 64 ? 24 : 104],
        0.16,
      );
  }
  return [...groups.values()];
}

export const hallDetailProbes = [
  { id: 'central-floor-lane', from: [190, 4, 20], to: [190, 4, 108], clear: true },
  { id: 'central-upper-lane', from: [190, 8, 20], to: [190, 8, 108], clear: true },
  { id: 'existing-sky-dive', from: [190, 3, 50], to: [190, 20, 50], clear: true },
  { id: 'duct-body', from: [172, 8.8, 52], to: [180, 8.8, 52], clear: false },
  { id: 'under-duct-clearance', from: [172, 7.5, 52], to: [180, 7.5, 52], clear: true },
  { id: 'roof-chord', from: [190, 11.5, 44], to: [190, 13.5, 44], clear: false },
  { id: 'roof-frame-opening', from: [185, 13.4, 42], to: [185, 13.4, 46], clear: true },
  { id: 'north-canopy', from: [190, 8, 26], to: [190, 11, 26], clear: false },
];

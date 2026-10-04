// Original fictional Ukrainian quay; metre geometry and millimetre solids share coordinates.
import * as THREE from '../../../../optional-practice/civilian-fpv/vendor/three.module.js';
import { createArtwork, xyz } from './art.mjs';
import { lettering } from './lettering.mjs';

export const bounds = { min: xyz([-44, 0, -48]), max: xyz([40, 28, 46]) };
export const spawn = xyz([-2, 2.25, 34]);
export function createScene() {
  const raw = createArtwork({
    asphalt: ['#555d60', 0.97, 0, 'ground', true],
    concrete: ['#a1a096', 0.96, 0, 'ground', true],
    blue: ['#315b72', 0.76, 0.16, 'paint', true],
    ochre: ['#b99746', 0.83, 0.1, 'paint', true],
    oxide: ['#854c40', 0.88, 0.1, 'paint', true],
    chalk: ['#d9d7c7', 0.86, 0, false, true],
    steel: ['#75888b', 0.6, 0.3, false, true],
    dark: ['#233238', 0.86, 0.12, false, true],
    water: ['#355f67', 0.42, 0.1],
    ripple: ['#486f76', 0.5, 0.05],
  });
  // The renderer's broad background floor stays below water; a real2m raised
  // quay supports the entire playable land. No over-water gameplay is implied.
  let land = true;
  const art = {
    encode: raw.encode,
    add(shape, role, at = [0, 0, 0], rotation) {
      raw.add(shape, role, [at[0], at[1] + (land ? 2 : 0), at[2]], rotation);
    },
    box(role, size, at, rotation) {
      this.add(new THREE.BoxGeometry(...size), role, at, rotation);
    },
  };
  const obstacles = [];
  const solid = (id, min, max) => {
    const lift = (p) => [p[0], p[1] + 2, p[2]];
    obstacles.push({ id, min: xyz(lift(min)), max: xyz(lift(max)) });
  };
  // Rectangular inlays partition each canonical face. The already-supported,
  // required opaque coating provides one fixed bias against the canonical solid;
  // imported paint regions never overlap one another or imply an entrance.
  function face(role, axis, plane, u0, v0, u1, v1, sign = 1) {
    const point = (u, v) =>
      axis === 'x' ? [plane, v, u] : axis === 'y' ? [u, plane, v] : [u, v, plane];
    const vertices = [point(u0, v0), point(u1, v0), point(u1, v1), point(u0, v1)];
    const normal = new THREE.Vector3()
      .subVectors(new THREE.Vector3(...vertices[1]), new THREE.Vector3(...vertices[0]))
      .cross(
        new THREE.Vector3().subVectors(
          new THREE.Vector3(...vertices[2]),
          new THREE.Vector3(...vertices[0]),
        ),
      );
    const indices = normal[axis] * sign > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        indices.flatMap((i) => vertices[i]),
        3,
      ),
    );
    art.add(geometry, role);
  }
  function closed(id, min, max, role, topRole = role) {
    solid(id, min, max);
    for (const side of [-1, 1]) {
      face(role, 'x', side < 0 ? min[0] : max[0], min[2], min[1], max[2], max[1], side);
      face(role, 'z', side < 0 ? min[2] : max[2], min[0], min[1], max[0], max[1], side);
    }
    face(topRole, 'y', max[1], min[0], min[2], max[0], max[2]);
  }
  function bar(role, start, end, width = 0.08) {
    const direction = new THREE.Vector3(...end).sub(new THREE.Vector3(...start));
    const shape = new THREE.CylinderGeometry(width, width, direction.length(), 6);
    shape.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()),
    );
    art.add(
      shape,
      role,
      start.map((v, i) => (v + end[i]) / 2),
    );
  }
  // Continuous land-side apron. Contrasting road lanes are nonoverlapping inlays.
  solid('platform-quay', [-47, -2, -52], [43, 0, 50]);
  const xs = [-47, -7, 9, 36, 43],
    zs = [-52, -32, 27, 50];
  for (let x = 0; x < xs.length - 1; x++)
    for (let z = 0; z < zs.length - 1; z++)
      face(x === 1 || z === 2 ? 'asphalt' : 'concrete', 'y', 0, xs[x], zs[z], xs[x + 1], zs[z + 1]);
  // Expansion joints/road marks are thin paint, with the same opaque finish contract.
  // Tiny separated markings sit above the base paint; their distinct physical plane
  // is 12mm and they are not meant to be obstacles or flyable gaps.
  for (let z = -43; z < 42; z += 6) {
    art.box('chalk', [0.12, 0.004, 2.4], [1, 0.014, z]);
    for (const x of [-7, 9]) art.box('ochre', [0.14, 0.004, 3.6], [x, 0.014, z]);
  }
  for (let x = -40; x < 36; x += 8)
    for (let z = -44; z < 25; z += 10)
      if (x < -7 || x > 9) art.box('dark', [6.8, 0.004, 0.018], [x, 0.014, z]);
  for (const x of [-2.8, -1.2]) art.box('chalk', [0.15, 0.005, 2.6], [x, 0.016, 34]);
  art.box('chalk', [1.7, 0.005, 0.15], [-2, 0.016, 34]);
  // Twelve real closed containers: lower groups and selected supported upper tiers.
  const containers = [
    [-33, 0, -19, 'blue'],
    [-29.6, 0, -19, 'oxide'],
    [-33, 2.9, -19, 'ochre'],
    [-33, 0, 1, 'oxide'],
    [-29.6, 0, 1, 'blue'],
    [-29.6, 2.9, 1, 'chalk'],
    [-20, 0, -26, 'ochre'],
    [-16.6, 0, -26, 'blue'],
    [-20, 2.9, -26, 'oxide'],
    [-20, 0, -5, 'blue'],
    [-16.6, 0, -5, 'ochre'],
    [-20, 2.9, -5, 'blue'],
  ];
  containers.forEach(([x, y, z, role], index) => {
    const min = [x - 1.5, y, z - 6.1],
      max = [x + 1.5, y + 2.9, z + 6.1];
    solid('container-harbor-' + index, min, max);
    for (const side of [-1, 1]) {
      const plane = x + side * 1.5;
      face('steel', 'x', plane, z - 6.1, y, z + 6.1, y + 0.12, side);
      face('steel', 'x', plane, z - 6.1, y + 2.78, z + 6.1, y + 2.9, side);
      face(role, 'x', plane, z - 6.1, y + 0.12, z + 6.1, y + 2.78, side);
    }
    face(role, 'y', y + 2.9, x - 1.5, z - 6.1, x + 1.5, z + 6.1);
    for (const side of [-1, 1]) {
      const plane = z + side * 6.1,
        columns = [-1.5, -1.38, -0.04, 0.04, 1.38, 1.5];
      for (let i = 0; i < columns.length - 1; i++) {
        face('steel', 'z', plane, x + columns[i], y, x + columns[i + 1], y + 0.12, side);
        face(
          i === 1 || i === 3 ? role : 'dark',
          'z',
          plane,
          x + columns[i],
          y + 0.12,
          x + columns[i + 1],
          y + 2.78,
          side,
        );
        face('steel', 'z', plane, x + columns[i], y + 2.78, x + columns[i + 1], y + 2.9, side);
      }
      for (const dx of [-0.9, -0.4, 0.4, 0.9])
        bar(
          'steel',
          [x + dx, y + 0.3, plane + side * 0.025],
          [x + dx, y + 2.6, plane + side * 0.025],
          0.022,
        );
    }
  });
  // Four columns and exact top solids create a clear 16.6m-wide portal.
  for (const x of [14, 32])
    for (const z of [-23, -5]) {
      closed(
        'platform-gantry-foot-' + x + '-' + z,
        [x - 1.05, 0, z - 1.6],
        [x + 1.05, 0.6, z + 1.6],
        'concrete',
      );
      closed(
        'post-gantry-' + x + '-' + z,
        [x - 0.7, 0.6, z - 0.7],
        [x + 0.7, 18.2, z + 0.7],
        'blue',
      );
      // Attached straps indicate structure; no false diagonal passage is added.
      for (let y = 1; y < 18; y += 3.4) art.box('ochre', [1.42, 0.24, 0.018], [x, y, z + 0.713]);
    }
  for (const z of [-23, -5]) {
    closed('beam-gantry-cross-' + z, [12.95, 18.2, z - 0.8], [33.05, 20.3, z + 0.8], 'blue');
    for (let x = 14; x < 32; x += 3) {
      // Flush diagonal beam articulation is attached to its closed blue fascia.
      bar('ochre', [x, 18.45, z + 0.82], [x + 2.5, 20.05, z + 0.82], 0.055);
      bar('steel', [x, 20.05, z + 0.83], [x + 2.5, 18.45, z + 0.83], 0.03);
    }
  }
  for (const x of [14, 32])
    closed('beam-gantry-rail-' + x, [x - 0.7, 18.2, -24.1], [x + 0.7, 19.3, -3.9], 'blue');
  closed('beam-quayside-boom', [23, 19.4, -15.1], [59, 20.8, -12.9], 'ochre');
  closed('gantry-operator-cab', [30.5, 15.5, -7.9], [34, 18.2, -5.2], 'chalk');
  face('dark', 'z', -5.2 + 0.012, 30.7, 16.1, 33.8, 17.7);
  lettering(art, '01', [23, 19.2, -4.18], 0.7);
  // Closed service house with grounded annex and a supported flat inspection deck.
  closed('harbor-service-house', [-32, 0, 26], [-21, 4.8, 37], 'concrete');
  closed('harbor-service-annex', [-39, 0, 29], [-32, 2.8, 37], 'oxide');
  closed('platform-service-deck', [-21, 3.2, 27], [-10, 3.5, 36], 'chalk');
  for (const x of [-20.6, -10.4])
    for (const z of [27.4, 35.6])
      closed(
        'post-service-deck-' + x + '-' + z,
        [x - 0.18, 0, z - 0.18],
        [x + 0.18, 3.2, z + 0.18],
        'blue',
      );
  // Solid facade glazing/door are explicit attached inlays, no implied opening.
  for (const x of [-29.5, -24.5]) {
    art.box('blue', [3.3, 1.9, 0.024], [x, 2.75, 37.014]);
    art.box('dark', [2.95, 1.55, 0.024], [x, 2.75, 37.044]);
    art.box('steel', [0.06, 1.55, 0.024], [x, 2.75, 37.074]);
  }
  art.box('blue', [2.1, 2.4, 0.04], [-35.5, 1.2, 37.027]);
  lettering(art, 'ПОРТ', [-26.5, 4.1, 37.03], 0.55);
  for (const x of [-16.3, -14.7]) art.box('blue', [0.15, 0.005, 2.6], [x, 3.512, 31.5]);
  art.box('blue', [1.7, 0.005, 0.15], [-15.5, 3.512, 31.5]);
  // Land boundary is visibly continuous. Water and vessel are strictly outside it.
  closed('wall-quay-boundary', [39, 0, -48], [40, 0.8, 46], 'concrete');
  for (let z = -43; z < 44; z += 8) art.box('ochre', [1.02, 0.012, 1], [39.5, 0.807, z]);
  for (const z of [-34, 19, 39]) {
    closed('bollard-' + z, [35.7, 0, z - 0.35], [36.3, 0.75, z + 0.35], 'dark', 'steel');
  }
  land = false;
  face('water', 'y', 0.22, 43, -170, 260, 170);
  face('concrete', 'x', 43, -52, 0, 50, 2, 1);
  for (let i = 0; i < 26; i++) {
    const x = 49 + (i % 5) * 12.2,
      z = -90 + i * 7.1;
    face('ripple', 'y', 0.23, x, z, x + 5.4 + (i % 3), z + 0.06);
  }
  // Stationary out-of-bounds utility vessel gives scale; no over-water gameplay.
  art.box('dark', [11, 2.8, 34], [65, -0.2, -3]);
  art.box('oxide', [10.6, 0.8, 33.6], [65, 1.2, -3]);
  art.box('concrete', [9.6, 0.2, 29], [65, 1.7, -3]);
  art.box('chalk', [7, 4.6, 8], [65, 4.1, 6]);
  art.box('blue', [7.2, 0.35, 8.2], [65, 6.55, 6]);
  art.box('dark', [7.04, 1.1, 0.03], [65, 5.5, 10.02]);
  const anchors = [
    { id: 'quay-pad', kind: 'spawn', position: [-2, 2.25, 34] },
    { id: 'arrival-apron', kind: 'checkpoint', position: [-2, 6, 20], order: 1 },
    { id: 'container-lane-lookout', kind: 'checkpoint', position: [-3, 7, -4], order: 2 },
    { id: 'gantry-lookout', kind: 'checkpoint', position: [24, 9, -14], order: 3 },
    { id: 'quay-return', kind: 'landing', position: [-2, 2.25, 34], order: 4 },
  ];
  return { ...art.encode(obstacles, anchors, 'r1'), obstacles, anchors };
}

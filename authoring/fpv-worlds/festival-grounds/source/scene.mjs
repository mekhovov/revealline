// Original fictional Ukrainian festival. Solids and art share metre coordinates.
import * as THREE from '../../../../optional-practice/civilian-fpv/vendor/three.module.js';
import { createArtwork, xyz, noise } from './art.mjs';
import { lettering } from './lettering.mjs';

export const bounds = { min: xyz([-42, 0, -42]), max: xyz([42, 24, 42]) };
export const spawn = xyz([0, 0.25, 25]);
export function createScene() {
  const art = createArtwork({
    canvas: ['#c2b389', 1, 0, true],
    blue: ['#245c72', 0.9, 0, true],
    ochre: ['#b27d2c', 0.9, 0, true],
    brick: ['#99553c', 0.9, 0, true],
    timber: ['#6d4935', 0.94, 0, true],
    dark: ['#15272f', 0.77],
    metal: ['#8a9491', 0.6, 0.25],
    chalk: ['#e8e2c7', 0.88],
    gravel: ['#a18e6f', 1, 0, 'ground'],
    paving: ['#878e87', 1, 0, 'ground'],
    leaves: ['#476444', 1],
    leavesLight: ['#6c794a', 1],
  });
  const boxes = [];
  function solid(id, min, max, rotation) {
    boxes.push({ id, min: xyz(min), max: xyz(max), ...(rotation ? { rotation } : {}) });
  }
  function rotated(id, size, centre, angle) {
    solid(
      id,
      centre.map((v, i) => v - size[i] / 2),
      centre.map((v, i) => v + size[i] / 2),
      [0, 0, Math.sin(angle / 2), Math.cos(angle / 2)],
    );
  }
  function rod(role, start, end, width = 0.08) {
    const direction = new THREE.Vector3(...end).sub(new THREE.Vector3(...start));
    const geometry = new THREE.CylinderGeometry(width, width, direction.length(), 6);
    geometry.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()),
    );
    art.add(
      geometry,
      role,
      start.map((v, i) => (v + end[i]) / 2),
    );
  }
  // Let the existing field profile show its metre-scaled grass and soil detail;
  // r1's flat imported lawn sheet hid that material. Paths remain flush paint.
  art.box('gravel', [6, 0.008, 71], [-32, 0.014, -1]);
  art.box('gravel', [6, 0.008, 71], [32, 0.014, -1]);
  art.box('gravel', [70, 0.008, 5], [0, 0.014, 34]);
  art.box('gravel', [70, 0.008, 5], [0, 0.014, -35]);
  art.box('gravel', [9, 0.008, 28], [0, 0.014, 13]);
  art.box('gravel', [48, 0.008, 5], [0, 0.014, -10]);
  art.box('paving', [25, 0.008, 4.2], [0, 0.025, -15.4]);
  for (let x = -12; x <= 12; x += 1.5) art.box('dark', [0.025, 0.005, 4.2], [x, 0.032, -15.4]);
  for (let z = -17.5; z <= -13.3; z += 1.4) art.box('dark', [25, 0.005, 0.025], [0, 0.033, z]);
  // Supported stage: a true open front/side volume, closed rear and two roof solids.
  solid('platform-stage-deck', [-12, 0, -30], [12, 0.8, -18]);
  solid('building-stage-back', [-11.8, 0.8, -29.9], [11.8, 5.7, -29.55]);
  art.box('timber', [24, 0.012, 12], [0, 0.809, -24]);
  for (let x = -11.7; x <= 11.7; x += 0.6) art.box('dark', [0.018, 0.008, 12], [x, 0.82, -24]);
  for (const x of [-11.5, 11.5])
    for (const z of [-29.4, -18.6]) {
      solid(
        'post-stage-' + (x < 0 ? 'west' : 'east') + '-' + (z < -24 ? 'back' : 'front'),
        [x - 0.22, 0.8, z - 0.22],
        [x + 0.22, 5.95, z + 0.22],
      );
      art.box('timber', [0.455, 5.15, 0.455], [x, 3.375, z]);
    }
  const slope = Math.atan2(2.8, 12),
    roofLength = Math.hypot(12, 2.8);
  for (const side of [-1, 1]) {
    const angle = -side * slope,
      centre = [side * 6, 7.3, -24];
    rotated('platform-stage-roof-' + side, [roofLength, 0.2, 13], centre, angle);
    const normal = [-Math.sin(angle), Math.cos(angle), 0];
    art.box(
      'canvas',
      [roofLength, 0.018, 13],
      centre.map((v, i) => v + normal[i] * 0.112),
      [0, 0, angle],
    );
    for (const z of [-29.3, -25.8, -22.3, -18.8])
      art.box(
        z < -25 ? 'blue' : 'ochre',
        [roofLength, 0.012, 1.35],
        [centre[0] + normal[0] * 0.13, centre[1] + normal[1] * 0.13, z],
        [0, 0, angle],
      );
    for (const z of [-30.1, -27, -24, -21, -17.9]) {
      rod('timber', [side * 0.1, 8.55, z], [side * 11.85, 5.8, z], 0.095);
    }
  }
  // Four supported solid beams make the frame legible. Flush diagonal metal
  // straps and lens artwork stay within their opaque envelope, not false gaps.
  for (const z of [-29.4, -18.6]) {
    solid(
      'beam-stage-' + (z < -24 ? 'rear' : 'front'),
      [-11.7, 5.35, z - 0.18],
      [11.7, 5.93, z + 0.18],
    );
    art.box('blue', [23.4, 0.58, 0.025], [0, 5.64, z + 0.199]);
    for (let x = -11.25; x < 11; x += 1.5) {
      const pennant = new THREE.BufferGeometry();
      pennant.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(
          [x, 5.9, z + 0.216, x + 0.65, 5.38, z + 0.216, x + 1.3, 5.9, z + 0.216],
          3,
        ),
      );
      art.add(pennant, 'ochre');
      rod('metal', [x, 5.4, z + 0.231], [x + 1.25, 5.87, z + 0.231], 0.028);
    }
    for (const x of [-9, -6, -3, 3, 6, 9]) {
      art.add(new THREE.CircleGeometry(0.2, 12), 'dark', [x, 5.64, z + 0.237]);
      art.add(new THREE.CircleGeometry(0.11, 12), 'chalk', [x, 5.64, z + 0.242]);
    }
  }
  for (const x of [-11.5, 11.5]) {
    solid(
      'beam-stage-side-' + (x < 0 ? 'west' : 'east'),
      [x - 0.18, 5.35, -29.5],
      [x + 0.18, 5.93, -18.5],
    );
    art.box('timber', [0.37, 0.59, 11], [x, 5.64, -24]);
  }
  lettering(art, 'СЦЕНА', [0, 5.63, -18.347], 0.43);
  // Flush closed backdrop panels; nothing looks like an exit through the wall.
  for (const x of [-8, -4, 0, 4, 8]) {
    art.box(x === 0 ? 'ochre' : 'blue', [3.9, 4.2, 0.018], [x, 3.15, -29.528]);
    for (const y of [1.25, 5.05]) art.box('canvas', [3.55, 0.06, 0.025], [x, y, -29.51]);
  }
  lettering(art, 'СВЯТО', [0, 4.2, -29.483], 1.05);
  // A desk is a closed supported landing surface, not a painted floating target.
  solid('platform-sound-desk', [-4, 0.8, -24], [0, 1.65, -21]);
  art.box('dark', [4.02, 0.018, 3.02], [-2, 1.665, -22.5]);
  for (const x of [-2.5, -1.5]) art.box('chalk', [0.1, 0.012, 1.4], [x, 1.681, -22.5]);
  art.box('chalk', [1.1, 0.012, 0.1], [-2, 1.682, -22.5]);
  for (const x of [-9, 9]) {
    solid('building-stage-speaker-' + x, [x - 0.8, 0.8, -28.2], [x + 0.8, 3.5, -26.7]);
    art.box('dark', [1.61, 2.7, 0.02], [x, 2.15, -26.678]);
    for (let y = 1.1; y < 3.4; y += 0.35) art.box('metal', [1.3, 0.025, 0.025], [x, y, -26.662]);
    for (const y of [1.5, 2.7]) {
      art.add(new THREE.CircleGeometry(0.48, 20), 'dark', [x, y, -26.642]);
      art.add(new THREE.RingGeometry(0.28, 0.31, 20), 'metal', [x, y, -26.637]);
    }
  }
  // Four closed stalls; opposite rows leave the lawn and service lanes open.
  for (const [i, x, z, role] of [
    [1, -22, -2, 'ochre'],
    [2, -22, 12, 'blue'],
    [3, 22, -2, 'brick'],
    [4, 22, 12, 'ochre'],
  ]) {
    solid('building-market-' + i, [x - 3.8, 0, z - 2.8], [x + 3.8, 2.9, z + 2.8]);
    // Finish every closed face; r1 only treated the inward shutter and left
    // generic corrugated walls dominating the wide approach.
    for (const side of [-1, 1]) {
      art.box('canvas', [7.62, 2.88, 0.025], [x, 1.45, z + side * 2.823]);
      art.box(role, [7.62, 0.6, 0.035], [x, 0.35, z + side * 2.842]);
      for (const dx of [-3.6, 0, 3.6])
        art.box('timber', [0.1, 2.84, 0.04], [x + dx, 1.45, z + side * 2.85]);
      if (side === Math.sign(x)) art.box('canvas', [0.025, 2.88, 5.6], [x + side * 3.823, 1.45, z]);
    }
    const angle = Math.atan2(1.2, 4.15),
      length = Math.hypot(4.15, 1.2);
    for (const side of [-1, 1]) {
      const tilt = -side * angle,
        centre = [x + side * 2.075, 3.55, z];
      rotated('platform-market-roof-' + i + '-' + side, [length, 0.14, 6.4], centre, tilt);
      art.box(
        role,
        [length, 0.018, 6.4],
        [centre[0] - Math.sin(tilt) * 0.085, centre[1] + Math.cos(tilt) * 0.085, z],
        [0, 0, tilt],
      );
    }
    const faceX = x < 0 ? x + 3.819 : x - 3.819;
    art.box(role, [0.026, 2.75, 5.55], [faceX, 1.4, z]);
    lettering(
      art,
      ['КАВА', 'ЧАЙ', 'СМАК', 'КРАМ'][i - 1],
      [faceX + Math.sign(-x) * 0.046, 2.66, z],
      0.35,
      [0, (Math.sign(-x) * Math.PI) / 2, 0],
    );
    // A solid shutter and counter reveal a closed kiosk, never a fly-through.
    art.box('dark', [0.03, 1.25, 3.65], [faceX + Math.sign(-x) * 0.02, 1.85, z]);
    for (let dz = -1.6; dz <= 1.6; dz += 0.4)
      art.box('timber', [0.036, 1.17, 0.06], [faceX + Math.sign(-x) * 0.04, 1.85, z + dz]);
    art.box('canvas', [0.04, 0.18, 4.4], [faceX + Math.sign(-x) * 0.045, 1.15, z]);
    for (const dz of [-2.55, 2.55])
      art.box('chalk', [0.04, 2.7, 0.12], [faceX + Math.sign(-x) * 0.04, 1.4, z + dz]);
    for (let dz = -2.3; dz < 2.4; dz += 0.6)
      art.box(
        i % 2 ? 'blue' : 'ochre',
        [0.045, 0.34, 0.25],
        [faceX + Math.sign(-x) * 0.046, 0.35, z + dz],
      );
  }
  // The east service tower is one honest solid, with clock artwork on its face.
  solid('building-clock-tower', [25.5, 0, -20], [28.5, 8.4, -17]);
  art.box('blue', [3.01, 8.35, 0.025], [27, 4.2, -16.978]);
  for (const x of [25.481, 28.519]) art.box('blue', [0.025, 8.35, 3.02], [x, 4.2, -18.5]);
  art.add(new THREE.CircleGeometry(1.05, 24), 'canvas', [27, 6.8, -16.96]);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    art.box(
      'dark',
      [0.06, 0.17, 0.02],
      [27 + Math.sin(a) * 0.86, 6.8 + Math.cos(a) * 0.86, -16.943],
      [0, 0, -a],
    );
  }
  art.box('dark', [0.075, 0.72, 0.025], [27, 7.1, -16.925]);
  art.box('dark', [0.53, 0.075, 0.025], [27.23, 6.8, -16.924]);
  solid('platform-clock-cap', [25.35, 8.4, -20.15], [28.65, 8.49, -16.85]);
  art.box('canvas', [3.3, 0.012, 3.3], [27, 8.499, -18.5]);
  // Entry arch's 11m opening stays obvious and clear. No unsupported bunting spans.
  for (const x of [-6, 6]) {
    solid('post-entry-' + x, [x - 0.3, 0, 29.7], [x + 0.3, 5.1, 30.3]);
    art.box('blue', [0.62, 4.9, 0.62], [x, 2.5, 30]);
  }
  solid('beam-entry', [-6.3, 4.8, 29.7], [6.3, 5.5, 30.3]);
  art.box('ochre', [12.65, 0.72, 0.03], [0, 5.15, 30.323]);
  for (let x = -5.4; x <= 5.4; x += 1.2)
    if (Math.abs(x) > 1.2) art.box('blue', [0.7, 0.4, 0.04], [x, 5.15, 30.35]);
  lettering(art, 'СВЯТО', [0, 5.15, 30.375], 0.48);
  for (const x of [-14, 14]) {
    solid('building-ticket-' + x, [x - 2, 0, 29], [x + 2, 2.8, 32]);
    art.box('blue', [4.03, 2.65, 0.025], [x, 1.4, 32.025]);
    art.box('dark', [2.5, 0.9, 0.03], [x, 1.75, 32.046]);
    solid('platform-ticket-roof-' + x, [x - 2.2, 2.8, 28.8], [x + 2.2, 2.89, 32.2]);
    art.box('canvas', [4.4, 0.012, 3.4], [x, 2.899, 30.5]);
  }
  // Two perimeter benches, each with a seat, two ground-supported legs and
  // backrest as separate solids. The central lawn and32m service lanes stay clear.
  for (const side of [-1, 1]) {
    const x = side * 37,
      z = 16,
      prefix = 'bench-' + (side < 0 ? 'west' : 'east');
    solid(prefix + '-seat', [x - 0.42, 0.5, z - 2.25], [x + 0.42, 0.66, z + 2.25]);
    art.box('timber', [0.84, 0.012, 4.5], [x, 0.669, z]);
    for (const dz of [-1.7, 1.7])
      solid(
        prefix + '-leg-' + (dz < 0 ? 'a' : 'b'),
        [x - 0.34, 0, z + dz - 0.14],
        [x + 0.34, 0.5, z + dz + 0.14],
      );
    solid(
      prefix + '-back',
      [x + side * 0.42 - 0.07, 0.5, z - 2.25],
      [x + side * 0.42 + 0.07, 1.4, z + 2.25],
    );
    art.box('timber', [0.15, 0.9, 4.5], [x + side * 0.42, 0.95, z]);
    for (const dz of [-1.5, -0.75, 0, 0.75, 1.5])
      art.box('dark', [0.845, 0.007, 0.018], [x, 0.678, z + dz]);
  }
  // Worn launch mark and horizontal navigation paint do not add impact obstacles.
  for (const x of [-0.8, 0.8]) art.box('chalk', [0.15, 0.012, 2.6], [x, 0.027, 25]);
  art.box('chalk', [1.7, 0.012, 0.15], [0, 0.028, 25]);
  // All trees are outside bounds. Clustered deciduous silhouettes give scale.
  for (let i = 0; i < 22; i++) {
    const x = i < 11 ? -48 - noise(i, 1) * 7 : 48 + noise(i, 1) * 7;
    const z = -43 + (i % 11) * 8.4 + noise(i, 4) * 3;
    const h = 5 + noise(i, 7) * 3.5;
    art.add(new THREE.CylinderGeometry(0.16, 0.28, h * 0.7, 7), 'timber', [x, h * 0.35, z]);
    for (let crown = 0; crown < 3; crown++) {
      const shape = new THREE.IcosahedronGeometry(2.6, 1);
      shape.scale(0.85 + noise(i, crown) * 0.35, 0.65, 0.85);
      art.add(shape, crown === 1 ? 'leavesLight' : 'leaves', [
        x + Math.sin(crown * 2.3) * 1.2,
        h - 0.5 + crown * 0.5,
        z + Math.cos(crown * 2.3),
      ]);
    }
  }
  const anchors = [
    { id: 'entry-pad', kind: 'spawn', position: [0, 0.25, 25] },
    { id: 'lawn-overlook', kind: 'checkpoint', position: [0, 4, 12], order: 1 },
    { id: 'stage-lookout', kind: 'checkpoint', position: [0, 4.2, -10], order: 2 },
    { id: 'service-lookout', kind: 'checkpoint', position: [31.5, 4.5, -9], order: 3 },
    { id: 'entry-return', kind: 'landing', position: [0, 0.25, 25], order: 4 },
  ];
  return { ...art.encode(boxes, anchors), obstacles: boxes, anchors };
}

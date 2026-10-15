/** Original open parking approach: three distinguishable ramps form an ascending flight line. */
import * as THREE from '../../../../optional-practice/civilian-fpv/vendor/three.module.js';

export function createParkingCirculation() {
  const groups = new Map();
  function add(name, color, geometry) {
    if (!groups.has(name))
      groups.set(name, { id: `parking-${name}`, color, positionsMm: [], indices: [] });
    const group = groups.get(name),
      offset = group.positionsMm.length / 3;
    for (const value of geometry.attributes.position.array)
      group.positionsMm.push(Math.round(value * 1000));
    for (const index of geometry.index.array) group.indices.push(offset + index);
    geometry.dispose();
  }
  function box(name, color, centre, size, angle = 0) {
    const geometry = new THREE.BoxGeometry(...size);
    geometry.rotateX(angle);
    geometry.translate(...centre);
    add(name, color, geometry);
  }
  const concrete = [0.53, 0.51, 0.45],
    steel = [0.22, 0.29, 0.32];
  const ramps = [
    { id: 'lower', x: 44, start: 0.4, end: 6.1, color: [0.15, 0.45, 0.54] },
    { id: 'middle', x: 64, start: 12.1, end: 6.1, color: [0.68, 0.43, 0.12] },
    { id: 'upper', x: 84, start: 12.1, end: 18.1, color: [0.69, 0.69, 0.61] },
  ];
  for (const ramp of ramps) {
    const rise = ramp.end - ramp.start,
      angle = -Math.atan2(rise, 30),
      length = Math.hypot(30, rise);
    box(
      'ramp-concrete',
      concrete,
      [ramp.x, (ramp.start + ramp.end) / 2, 203],
      [8, 0.5, length],
      angle,
    );
    for (const side of [-1, 1]) {
      box(
        `rail-${ramp.id}`,
        ramp.color,
        [ramp.x + side * 3.8, (ramp.start + ramp.end) / 2 + 1.15, 203],
        [0.14, 0.18, length],
        angle,
      );
      for (const z of [190, 203, 216]) {
        const y = ramp.start + (rise * (z - 188)) / 30;
        box('rail-posts', steel, [ramp.x + side * 3.8, y + 0.7, z], [0.14, 1.4, 0.14]);
      }
    }
    // Supports are outside the 4 m wide clear flight corridor.
    for (const z of [195, 211]) {
      const top = ramp.start + (rise * (z - 188)) / 30 - 0.25;
      for (const side of [-1, 1])
        box('supports', steel, [ramp.x + side * 3.2, top / 2, z], [0.35, top, 0.35]);
    }
  }
  // The upper turning landing links the opposed middle and upper ramps.
  box('landing', concrete, [74, 12.1, 186], [28, 0.5, 5]);
  for (const x of [61, 87]) box('supports', steel, [x, 5.925, 184], [0.5, 11.85, 0.5]);
  box('rail-middle', [0.68, 0.43, 0.12], [74, 13.25, 183.7], [28, 0.18, 0.14]);
  return [...groups.values()];
}

export const parkingFlightLine = [
  [44, 2.5, 182],
  [44, 8.5, 220],
  [64, 8.5, 220],
  [64, 14.5, 186],
  [84, 14.5, 186],
  [84, 20.5, 220],
];
export const parkingCirculationProbes = [
  { id: 'retained-side-entry', from: [10, 3, 245], to: [118, 3, 245], clear: true },
  { id: 'retained-vertical-shaft', from: [64, 2, 260], to: [64, 25, 260], clear: true },
  { id: 'lower-ramp-surface', from: [44, 8, 203], to: [44, 0.5, 203], clear: false },
  { id: 'middle-ramp-surface', from: [64, 14, 203], to: [64, 4, 203], clear: false },
  { id: 'upper-ramp-surface', from: [84, 22, 203], to: [84, 10, 203], clear: false },
  { id: 'turning-landing', from: [74, 16, 186], to: [74, 10, 186], clear: false },
  { id: 'under-middle-ramp', from: [58, 4, 203], to: [70, 4, 203], clear: true },
];

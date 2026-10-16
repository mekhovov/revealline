/** Exact original v3 live accessory geometry. Data only: positions are artwork
 * pixels, never collider dimensions, capability declarations or simulation state.
 * Both live renderers and defeat presentation resolve color roles from the same
 * accepted actor palette. Historical art continues using its original recipes. */
export const INDUSTRIAL_SOLDIER_KIT_REVISION = 'industrial-roster-v3';
const freeze = (value) => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
export const INDUSTRIAL_SOLDIER_KITS = freeze({
  lookout: {
    id: 'binoculars',
    material: 'optics',
    anchor: [9, 8],
    size: [14, 4],
    rectangles: [
      ['#192820', 0, 0, 6, 4],
      ['#192820', 8, 0, 6, 4],
      ['#81b1ac', 1, 0, 3, 2],
      ['#b7d9cf', 9, 0, 3, 2],
    ],
  },
  patroller: {
    id: 'bedroll',
    material: 'cloth',
    anchor: [9, 21],
    size: [14, 5],
    rectangles: [
      ['#192820', 0, 0, 14, 5],
      ['coat', 1, 1, 12, 3],
      ['trim', 2, 1, 2, 3],
      ['trim', 10, 1, 2, 3],
    ],
  },
  runner: {
    id: 'harness',
    material: 'cloth',
    anchor: [11, 19],
    size: [10, 6],
    rectangles: [
      ['#192820', 0, 0, 3, 6],
      ['#192820', 7, 0, 3, 6],
      ['trim', 1, 1, 1, 4],
      ['trim', 8, 1, 1, 4],
      ['dark', 2, 1, 6, 2],
    ],
  },
  sprinter: {
    id: 'headset',
    material: 'electronics',
    anchor: [8, 12],
    size: [16, 5],
    rectangles: [
      ['#192820', 0, 0, 3, 5],
      ['#192820', 13, 0, 3, 5],
      ['trim', 1, 0, 1, 4],
      ['trim', 14, 0, 1, 4],
    ],
  },
  courier: {
    id: 'satchel',
    material: 'canvas',
    anchor: [22, 17],
    size: [7, 7],
    rectangles: [
      ['#192820', 0, 0, 7, 7],
      ['#795e3f', 1, 1, 5, 5],
      ['#be9b65', 1, 1, 5, 2],
      ['#d9c296', 3, 1, 1, 5],
    ],
  },
  guard: {
    id: 'pouches',
    material: 'cloth',
    anchor: [10, 20],
    size: [14, 4],
    rectangles: [
      ['#192820', 0, 0, 4, 4],
      ['trim', 1, 1, 2, 2],
      ['#192820', 5, 0, 4, 4],
      ['trim', 6, 1, 2, 2],
      ['#192820', 10, 0, 4, 4],
      ['trim', 11, 1, 2, 2],
    ],
  },
  'refuge-seeker': {
    id: 'shelter-roll',
    material: 'cloth',
    anchor: [9, 20],
    size: [14, 7],
    rectangles: [
      ['#192820', 0, 0, 14, 7],
      ['dark', 1, 1, 12, 5],
      ['light', 1, 1, 12, 2],
      ['trim', 4, 1, 2, 5],
      ['trim', 10, 1, 2, 5],
    ],
  },
  switchback: {
    id: 'scarf',
    material: 'cloth',
    anchor: [23, 20],
    size: [5, 4],
    rectangles: [
      ['#192820', 0, 0, 5, 4],
      ['trim', 0, 0, 4, 2],
      ['patch', 1, 2, 2, 2],
    ],
  },
  'rendezvous-pair': {
    id: 'radio',
    material: 'electronics',
    anchor: [11, 20],
    size: [11, 6],
    rectangles: [
      ['#192820', 0, 0, 11, 6],
      ['dark', 1, 1, 9, 4],
      ['trim', 1, 1, 9, 2],
    ],
  },
  'shield-bearer': {
    id: 'front-plate',
    material: 'armor',
    anchor: [5, 5],
    size: [22, 5],
    rectangles: [
      ['#192820', 0, 0, 22, 5],
      ['#84928a', 1, 0, 20, 3],
      ['#c8d0bd', 2, 0, 18, 1],
      ['#384c46', 6, 1, 10, 2],
      ['dark', 2, 3, 4, 2],
      ['dark', 16, 3, 4, 2],
    ],
  },
  'brace-trooper': {
    id: 'brace-pack',
    material: 'armor',
    anchor: [11, 21],
    size: [10, 5],
    rectangles: [
      ['#192820', 0, 0, 10, 5],
      ['dark', 1, 1, 8, 3],
    ],
  },
  'relay-warden': {
    id: 'command-pack',
    material: 'electronics',
    anchor: [10, 19],
    size: [13, 8],
    rectangles: [
      ['#192820', 0, 0, 13, 8],
      ['dark', 1, 1, 11, 6],
      ['trim', 2, 1, 9, 2],
      ['light', 2, 4, 3, 1],
    ],
  },
});

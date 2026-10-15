/** Connected arrival deck; original settlement and every licensed model stay unchanged. */
import * as base from './settlement-design.mjs';
export * from './settlement-design.mjs';
export const region = {
  ...base.region,
  revision: 'harbour-r3',
  scope: 'Bounded connected harbour source study; appearance and player admission pending',
};
// All dimensions are metres. Decks join the existing covered piers and reach the shore.
// Posts sit outside the open central flight line; no foliage/material reclassification.
export const harbourBoxes = [
  ...Array.from({ length: 18 }, (_, i) => ({
    id: `cross-deck-${i}`,
    min: [104 + (i * 71) / 18, 1.8, 148],
    max: [104 + ((i + 1) * 71) / 18, 2.2, 152],
  })),
  ...Array.from({ length: 15 }, (_, i) => ({
    id: `shore-deck-${i}`,
    min: [106, 1.8, 152 + (i * 58) / 15],
    max: [110, 2.2, 152 + ((i + 1) * 58) / 15],
  })),
  ...[108, 120, 132, 144, 156, 168].flatMap((x) =>
    [147.9, 152.1].map((z) => ({
      id: `cross-pile-${x}-${z}`,
      min: [x - 0.16, -5, z - 0.16],
      max: [x + 0.16, 2.85, z + 0.16],
    })),
  ),
  ...[164, 178, 192, 206].flatMap((z) =>
    [105.9, 110.1].map((x) => ({
      id: `shore-pile-${x}-${z}`,
      min: [x - 0.16, -5, z - 0.16],
      max: [x + 0.16, 2.85, z + 0.16],
    })),
  ),
];
export function extraSurfaces({ x, z, models }) {
  if (x !== 0 || z !== 0) return [];
  const model = models.get('covered-jetty');
  const material = model.bindings.find((b) => b.surfaceId === 'surface-0');
  const original = model.cell.surfaces.find((s) => s.id === material.surfaceId);
  const positionsMm = [],
    indices = [],
    normals = [],
    uvs = [];
  for (const box of harbourBoxes) {
    const [a, b, c] = box.min,
      [d, e, f] = box.max;
    const faces = [
      {
        n: [0, 1, 0],
        p: [
          [a, e, c],
          [a, e, f],
          [d, e, f],
          [d, e, c],
        ],
      },
      {
        n: [0, -1, 0],
        p: [
          [a, b, f],
          [a, b, c],
          [d, b, c],
          [d, b, f],
        ],
      },
      {
        n: [1, 0, 0],
        p: [
          [d, b, c],
          [d, e, c],
          [d, e, f],
          [d, b, f],
        ],
      },
      {
        n: [-1, 0, 0],
        p: [
          [a, b, f],
          [a, e, f],
          [a, e, c],
          [a, b, c],
        ],
      },
      {
        n: [0, 0, 1],
        p: [
          [a, b, f],
          [d, b, f],
          [d, e, f],
          [a, e, f],
        ],
      },
      {
        n: [0, 0, -1],
        p: [
          [d, b, c],
          [a, b, c],
          [a, e, c],
          [d, e, c],
        ],
      },
    ];
    for (const face of faces) {
      const offset = positionsMm.length / 3;
      for (const p of face.p) {
        positionsMm.push(...p.map((v) => Math.round(v * 1000)));
        normals.push(...face.n);
      }
      // Existing clamped wood image, mapped per face; no new texture allocation.
      uvs.push(0, 0, 0, 1, 1, 1, 1, 0);
      indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
    }
  }
  const surfaceId = 'harbour-connected-arrival';
  return [
    {
      surface: { id: surfaceId, positionsMm, indices, color: original.color },
      binding: { ...material, surfaceId, normals, uvs, colors: [], collision: 'solid' },
      texture: model.textures.find((t) => t.id === material.textureId),
    },
  ];
}
export const flightRoutes = [
  ...base.flightRoutes,
  {
    id: 'connected-harbour-arrival',
    halfWidth: 1.5,
    points: [
      [108, 4.4, 206],
      [108, 4.4, 156],
      [112, 4.4, 150],
      [163, 4.4, 150],
    ],
  },
];
export const verificationProbes = [
  ...base.verificationProbes,
  { id: 'arrival-deck-solid', from: [130, 5, 150], to: [130, 0, 150], clear: false },
  { id: 'arrival-open-above-deck', from: [110, 4.4, 150], to: [165, 4.4, 150], clear: true },
  { id: 'arrival-shoreline-clear', from: [108, 4.4, 156], to: [108, 4.4, 210], clear: true },
  { id: 'arrival-pile-solid', from: [119, 0, 147.9], to: [121, 0, 147.9], clear: false },
];
export const contactProbes = [
  ...base.contactProbes,
  { id: 'arrival-deck', from: [130, 4.4, 150], falling: true, minY: 2.2 },
];

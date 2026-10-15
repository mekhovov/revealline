/** Denser authored settlement; original district revision remains reproducible. */
import * as base from './district-design.mjs';
export * from './district-design.mjs';
export const region = {
  ...base.region,
  revision: 'districts-r2',
  scope: 'Bounded 768 m settlement composition study; not final archipelago/player admission',
};
export const placements = [
  ...base.placements,
  ...[
    [366, 328, 0],
    [366, 414, Math.PI / 2],
    [400, 355, Math.PI],
  ].map(([x, z, yaw], i) => ({
    id: 'village-street-hut-' + i,
    asset: 'jungle-hut',
    x,
    z,
    y: 14,
    scale: 1,
    yaw,
  })),
  ...[[78, 400]].map(([x, z], i) => ({
    id: 'valley-return-palm-' + i,
    asset: 'palm',
    x,
    z,
    y: 5,
    scale: 1,
    yaw: i * 0.8,
  })),
  ...Array.from({ length: 10 }, (_, i) => {
    const x = 100 + (i % 5) * 9,
      z = 570 + Math.floor(i / 5) * 32;
    return {
      id: 'dune-corridor-grass-' + i,
      asset: 'beach-grass',
      x,
      z,
      y: base.coastalHeightMm(x, z) / 1000,
      scale: 2.5,
      yaw: i * 0.7,
    };
  }),
];

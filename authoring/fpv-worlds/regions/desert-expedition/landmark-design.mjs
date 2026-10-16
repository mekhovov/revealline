/** Distinct close-range compositions; metre coordinates on unchanged natural-r1 terrain. */
export const compositions = [
  {
    id: 'dune-windstones',
    district: 'crescent-dunes',
    center: [2800, 3240],
    color: [0.64, 0.45, 0.25],
    purpose: 'A low winding line between three unequal windstones; dunes remain open.',
  },
  {
    id: 'wash-sentinels',
    district: 'dry-wash',
    center: [6980, 5250],
    color: [0.55, 0.27, 0.15],
    purpose: 'A bank-side passage framed by unequal towers and low talus.',
  },
  {
    id: 'playa-window',
    district: 'salt-basin',
    center: [2910, 11120],
    color: [0.78, 0.74, 0.62],
    purpose: 'One isolated pale natural arch above the flat playa, with a clear approach.',
  },
  {
    id: 'scarp-ribs',
    district: 'sunrise-escarpment',
    center: [11420, 2890],
    color: [0.4, 0.28, 0.2],
    purpose: 'Staggered climbing ribs along the toe slope, with an open weaving line.',
  },
  {
    id: 'mesa-crown',
    district: 'mesa-corridor',
    center: [11920, 9050],
    color: [0.65, 0.38, 0.23],
    purpose: 'A broad broken crown for orbiting and elevation changes beside the main corridor.',
  },
  {
    id: 'plain-slalom',
    district: 'rocky-plain',
    center: [10360, 13560],
    color: [0.33, 0.3, 0.28],
    purpose:
      'Four individually spaced tors form a close-range slalom beyond the broad terrain saddles.',
  },
];

// id, composition, source visual node, global x/z, width/height, yaw radians.
export const placements = [
  ['windstone-low', 'dune-windstones', 'Rock_Formations_1', 2760, 3218, 22, 18, 0.3],
  ['windstone-tall', 'dune-windstones', 'Rock_Formations_6', 2810, 3262, 20, 30, -0.3],
  ['windstone-broken', 'dune-windstones', 'Rock_Formations_3', 2860, 3218, 24, 22, 0.7],
  ['windstone-foot', 'dune-windstones', 'Rock_Boulders_4', 2828, 3272, 10, 5, 0.5],
  ['wash-west-tower', 'wash-sentinels', 'Rock_Formations_6', 6953, 5250, 20, 42, 0.1],
  ['wash-east-tower', 'wash-sentinels', 'Rock_Formations_12', 7007, 5260, 22, 29, -0.4],
  ['wash-upstream-talus', 'wash-sentinels', 'Rock_Boulders_5', 6940, 5220, 14, 7, 0.2],
  ['wash-downstream-step', 'wash-sentinels', 'Rock_Formations_1', 7015, 5300, 24, 12, 0.8],
  ['playa-natural-window', 'playa-window', 'Rock_Formations_11', 2910, 11120, 70, 40, 0],
  ['playa-west-cairn', 'playa-window', 'Rock_Boulders_3', 2855, 11145, 13, 9, 0.2],
  ['playa-east-cairn', 'playa-window', 'Rock_Boulders_6', 2965, 11090, 10, 6, 0.7],
  ['scarp-low-rib', 'scarp-ribs', 'Rock_Formations_3', 11360, 2860, 30, 24, 0.4],
  ['scarp-tall-rib', 'scarp-ribs', 'Rock_Formations_7', 11420, 2920, 32, 46, 0.2],
  ['scarp-broken-rib', 'scarp-ribs', 'Rock_Formations_9', 11480, 2860, 28, 34, -0.7],
  ['scarp-talus', 'scarp-ribs', 'Rock_Boulders_2', 11450, 2935, 16, 9, 0.3],
  ['mesa-broken-crown', 'mesa-crown', 'Rock_Formations_5', 11920, 9050, 60, 36, 0.15],
  ['mesa-outer-step', 'mesa-crown', 'Rock_Formations_1', 11985, 9105, 26, 12, 0.4],
  ['mesa-crown-talus', 'mesa-crown', 'Rock_Boulders_4', 11890, 9085, 15, 8, 0.7],
  ['plain-first-tor', 'plain-slalom', 'Rock_Formations_6', 10295, 13535, 16, 24, 0.2],
  ['plain-second-tor', 'plain-slalom', 'Rock_Formations_12', 10340, 13585, 18, 35, -0.6],
  ['plain-third-tor', 'plain-slalom', 'Rock_Formations_3', 10390, 13535, 20, 18, 0.5],
  ['plain-last-tor', 'plain-slalom', 'Rock_Formations_7', 10445, 13585, 18, 41, -0.2],
  ['plain-low-scree', 'plain-slalom', 'Rock_Boulders_5', 10455, 13605, 12, 5, 0.4],
];

// Flight clearance studies, not scored missions or an auto-pilot in the player.
export const routes = [
  {
    id: 'windstone-weave',
    composition: 'dune-windstones',
    halfWidthM: 3,
    clearanceM: 12,
    points: [
      [2725, 3240],
      [2780, 3242],
      [2830, 3238],
      [2900, 3240],
    ],
  },
  {
    id: 'wash-tower-passage',
    composition: 'wash-sentinels',
    halfWidthM: 3,
    clearanceM: 14,
    points: [
      [6980, 5190],
      [6980, 5250],
      [6980, 5330],
    ],
  },
  {
    id: 'playa-window-crossing',
    composition: 'playa-window',
    halfWidthM: 2.5,
    clearanceM: 13,
    points: [
      [2910, 11065],
      [2910, 11120],
      [2910, 11175],
    ],
  },
  {
    id: 'scarp-rib-weave',
    composition: 'scarp-ribs',
    halfWidthM: 3,
    clearanceM: 15,
    points: [
      [11315, 2890],
      [11390, 2890],
      [11455, 2890],
      [11520, 2890],
    ],
  },
  {
    id: 'mesa-crown-orbit',
    composition: 'mesa-crown',
    halfWidthM: 3,
    clearanceM: 18,
    points: [
      [11860, 9050],
      [11875, 9005],
      [11920, 8990],
      [11965, 9005],
      [11980, 9050],
    ],
  },
  {
    id: 'plain-tor-slalom',
    composition: 'plain-slalom',
    halfWidthM: 3,
    clearanceM: 12,
    points: [
      [10260, 13560],
      [10315, 13560],
      [10365, 13560],
      [10420, 13560],
      [10480, 13560],
    ],
  },
];

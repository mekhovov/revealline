/** Authored placement in metres. Mesh-local shapes come from the pinned CC0 source. */
export const placements = [
  ['arrival-cairn', 'Rock_Formations_6', 61, 108, 12, 19, 0.2],
  ['arrival-scree', 'Rock_Boulders_4', 76, 114, 8, 4, 0.5],
  ['arrival-step', 'Rock_Boulders_1', 65, 94, 6, 3, 1.1],
  ['twin-west', 'Rock_Formations_6', 147, 104, 12, 28, -0.2],
  ['twin-east', 'Rock_Formations_12', 177, 104, 12, 24, 0.4],
  ['twin-foot', 'Rock_Boulders_5', 187, 114, 6, 4, 0.8],
  ['mesa-crown', 'Rock_Formations_11', 345, 65, 38, 32, 0.1],
  ['mesa-foreground', 'Rock_Boulders_2', 292, 91, 8, 8, 0.8],
  ['mesa-step', 'Rock_Formations_1', 342, 101, 18, 6, 0.6],
  ['basin-exit', 'Rock_Formations_7', 90, 221, 24, 28, 0.4],
  ['basin-exit-foot', 'Rock_Boulders_4', 110, 215, 9, 5, 0.2],
  ['basin-exit-talus', 'Rock_Boulders_6', 85, 205, 6, 4, 0.8],
  ['gorge-entry', 'Rock_Formations_3', 194, 218, 24, 25, 0.3],
  ['gorge-entry-foot', 'Rock_Boulders_1', 218, 240, 7, 4, 0.6],
  ['gorge-entry-talus', 'Rock_Boulders_5', 211, 250, 5, 4, 0.9],
  ['east-overlook', 'Rock_Formations_5', 331, 201, 37, 31, -0.2],
  ['east-overlook-foot', 'Rock_Boulders_3', 305, 217, 8, 10, 0.3],
  ['east-overlook-talus', 'Rock_Boulders_6', 348, 225, 6, 4, 0.7],
  ['west-ridge', 'Rock_Formations_11', 79, 321, 40, 31, 0.1],
  ['west-ridge-foot', 'Rock_Boulders_4', 103, 334, 8, 5, 0.3],
  ['west-ridge-talus', 'Rock_Boulders_2', 59, 340, 7, 8, 0.6],
  ['needle-bend', 'Rock_Formations_6', 184, 302, 14, 35, 0.2],
  ['needle-foot', 'Rock_Boulders_4', 200, 310, 8, 5, 0.3],
  ['needle-talus', 'Rock_Boulders_1', 196, 288, 6, 4, 0.8],
  ['south-saddle', 'Rock_Formations_9', 329, 342, 25, 27, 0.3],
  ['south-saddle-foot', 'Rock_Boulders_3', 349, 354, 9, 9, 0.8],
  ['south-saddle-talus', 'Rock_Boulders_6', 350, 366, 6, 4, 0.2],
];

// These are geometry clearance studies, not scored courses or recorded demonstrations.
export const routes = [
  {
    id: 'retained-basin-circuit',
    halfWidth: 8,
    points: [
      [90, 28, 70],
      [190, 28, 70],
      [210, 28, 145],
      [130, 28, 190],
      [90, 28, 70],
    ],
  },
  {
    id: 'retained-gorge-approach',
    halfWidth: 6,
    points: [
      [170, 34, 155],
      [240, 34, 220],
      [210, 34, 300],
      [280, 34, 360],
    ],
  },
  {
    id: 'twin-spire-gap',
    halfWidth: 6,
    points: [
      [162, 18, 80],
      [162, 18, 128],
      [170, 22, 155],
    ],
  },
];

/** Original arrangement of adapted CC0 containers; dimensions are metres. */
export const courtContainers = [
  { id: 'north-left', centre: [174, 0, 14], yaw: 0, color: [0.12, 0.25, 0.42] },
  { id: 'north-left-upper', centre: [174, 2.59, 14], yaw: 0, color: [0.16, 0.3, 0.46] },
  { id: 'north-right', centre: [206, 0, 14], yaw: 0, color: [0.12, 0.25, 0.42] },
  { id: 'south-left', centre: [174, 0, 115], yaw: 0, color: [0.58, 0.32, 0.1] },
  { id: 'south-right', centre: [206, 0, 115], yaw: 0, color: [0.58, 0.32, 0.1] },
  { id: 'approach-left', centre: [180, 0, 140], yaw: 90, color: [0.22, 0.34, 0.35] },
  { id: 'approach-right', centre: [200, 0, 160], yaw: 90, color: [0.58, 0.32, 0.1] },
];
export const courtRoute = {
  id: 'loading-court-line',
  title: { en: 'Loading courts and hall', uk: 'Вантажні двори та зал' },
  halfWidthM: 2,
  points: [
    [190, 2, 176],
    [189, 2, 160],
    [191, 2, 140],
    [190, 4, 108],
    [190, 4, 20],
  ],
};

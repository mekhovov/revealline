/** Original shallow earthworks between the preserved Urban architecture foundations. */
export const earthworks = Object.freeze([
  { id: 'mill-ridge', centre: [80, 140], radii: [36, 20], heightM: 6 },
  { id: 'yard-ridge', centre: [290, 140], radii: [48, 24], heightM: 4 },
  { id: 'service-berm', centre: [170, 200], radii: [36, 14], heightM: 2.5 },
]);
export function heightMm(x, z) {
  let height = 0;
  for (const { centre, radii, heightM } of earthworks) {
    const radius = ((x - centre[0]) / radii[0]) ** 2 + ((z - centre[1]) / radii[1]) ** 2;
    if (radius < 1) height += heightM * (1 - radius) ** 2;
  }
  return Math.round(height * 1000);
}
export const routes = Object.freeze([
  {
    id: 'service-road',
    title: { en: 'Open service road', uk: 'Відкрита службова дорога' },
    halfWidthM: 2,
    points: [
      [120, 4, 180],
      [270, 4, 180],
    ],
  },
  {
    id: 'ridge-loading-hall',
    title: { en: 'Ridge to loading hall', uk: 'Від пагорба до вантажного залу' },
    halfWidthM: 2,
    points: [
      [290, 10, 180],
      [290, 10, 140],
      [190, 12, 140],
      [190, 4, 108],
      [190, 4, 20],
    ],
  },
  {
    id: 'mill-ridge-approach',
    title: { en: 'Mill ridge approach', uk: 'Підхід до цеху через пагорб' },
    halfWidthM: 2,
    points: [
      [64, 10, 180],
      [80, 10, 140],
      [64, 12, 110],
      [64, 12, 64],
    ],
  },
]);

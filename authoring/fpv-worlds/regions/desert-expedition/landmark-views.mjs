/** Close-range composition review, independent of production camera/flight state. */
import { surfaceMm } from './desert-design.mjs';
export const desertLandmarkViews = [
  ['Dune windstones', 2800, 3240, [-105, 37, -100], [0, 16, 0]],
  ['Wash sentinels', 6980, 5250, [0, 25, -105], [0, 18, 15]],
  ['Playa window', 2910, 11120, [12, 20, -100], [0, 18, 0]],
  ['Escarpment ribs', 11420, 2890, [-145, 42, -90], [0, 24, 0]],
  ['Mesa crown', 11920, 9050, [-85, 48, -95], [0, 20, 0]],
  ['Plain tor slalom', 10360, 13560, [-145, 30, -25], [30, 18, 0]],
].map(([name, x, z, camera, target]) => {
  const y = surfaceMm(x, z) / 1000;
  return [
    name,
    [x, y + 25, z],
    [x + camera[0], y + camera[1], z + camera[2]],
    [x + target[0], y + target[1], z + target[2]],
  ];
});

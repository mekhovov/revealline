/** Additional transit scenarios against unchanged source; never rewrites the generated region. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { design, sampledHeight } from './relief.mjs';
assert(process.argv[2] && process.argv[3], 'Provide exact source directory and new scenario file');
const source = JSON.parse(await readFile(resolve(process.argv[2], 'preparation.json')));
const districts = new Map(design.districts.map((d) => [d.id, d]));
const routes = design.connections.map((connection) => {
  const a = districts.get(connection.fromDistrict).startXZMm.map((n) => n / 1000);
  const b = districts.get(connection.toDistrict).startXZMm.map((n) => n / 1000);
  const steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4);
  const points = Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const x = a[0] + (b[0] - a[0]) * t,
      z = a[1] + (b[1] - a[1]) * t;
    return [
      Math.round(x * 1000) / 1000,
      Math.round((sampledHeight(x, z) + 24) * 1000) / 1000,
      Math.round(z * 1000) / 1000,
    ];
  });
  for (const [id, prepend] of [
    [connection.fromDistrict, true],
    [connection.toDistrict, false],
  ]) {
    const spawn = source.spawns.find((value) => value.id === id);
    assert(spawn);
    const point = [spawn.position.x / 1000, spawn.position.y / 1000, spawn.position.z / 1000];
    if (prepend) points.unshift(point);
    else points.push(point);
  }
  return {
    id: connection.id,
    points,
    halfWidth: connection.minimumClearDiameterMm / 2000 - 0.25,
    altitudeAGLMm: 24000,
  };
});
await writeFile(
  resolve(process.argv[3]),
  JSON.stringify(
    {
      ...source,
      routes,
      scenario:
        'Seven 24 m-wide transit lines at 24 m AGL, including climbs/descents from exact authored starts; unchanged source geometry, not native acceptance.',
    },
    null,
    2,
  ) + '\n',
  { flag: 'wx' },
);
console.log(
  JSON.stringify({
    routes: routes.length,
    sourceGeometryUnchanged: true,
    scenarioFile: resolve(process.argv[3]),
  }),
);

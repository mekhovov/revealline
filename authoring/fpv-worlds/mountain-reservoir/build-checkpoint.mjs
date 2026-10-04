#!/usr/bin/env node
// One-course art/collision checkpoint only. This does not deliver the eight-course D5 world.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createScene, bounds, spawn, obstacles } from './source/scene.mjs';
import { prepareWorldFile } from '../../../scripts/fpv-content.mjs';
import { synchronizeDefinitions } from '../../../optional-practice/civilian-fpv/world-app.mjs';
import { validateWorldCourse } from '../../../optional-practice/civilian-fpv/world-model.mjs';
import {
  preparePack,
  inspectPack,
  canonicalWorldJSON,
} from '../../../optional-practice/civilian-fpv/world-content.mjs';
import {
  exportEditableZip,
  importEditableZip,
} from '../../../optional-practice/civilian-fpv/world-zip.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const assert = (value, message) => {
  if (!value) throw new Error(message);
};
const output = path.resolve(process.argv[2] ?? '');
assert(process.argv.length === 3 && output !== process.cwd(), 'Choose a new output directory.');
await mkdir(output, { recursive: false });
const source = createScene();
assert(
  source.bytes.length < 1.2 * 1024 * 1024 && source.statistics.triangles < 15000,
  'Initial art target exceeded',
);
assert(
  obstacles.length <= 48 && source.statistics.collisionTriangles <= 1000,
  'Initial collision target exceeded',
);
const sourceFile = path.join(output, 'mountain-reservoir-source.glb');
await writeFile(sourceFile, source.bytes, { flag: 'wx' });
const prepared = await prepareWorldFile({
  entry: sourceFile,
  outputDirectory: path.join(output, 'prepared'),
  id: 'mountain-reservoir',
  title: 'Mountain Reservoir · first shoreline checkpoint',
});
const project = prepared.project;
const revision = 'r3';
project.revision = revision;
function volume(type, centre, size, extra = {}) {
  return {
    type,
    min: Object.fromEntries(
      ['x', 'y', 'z'].map((k, i) => [k, Math.round((centre[i] - size[i] / 2) * 1000)]),
    ),
    max: Object.fromEntries(
      ['x', 'y', 'z'].map((k, i) => [k, Math.round((centre[i] + size[i] / 2) * 1000)]),
    ),
    ticks: 45,
    maxSpeed: type === 'land' ? 700 : 900,
    maxTilt: 2500,
    minTilt: 0,
    centred: false,
    heading: null,
    ...extra,
  };
}
const route = [
  volume('hold', [-30, 3.8, 24], [3, 1.6, 3]),
  volume('hold', [-10, 5, 15], [3, 1.8, 3]),
  volume('hold', [-10, 7, -12], [3, 1.8, 3]),
  volume('land', [-30, 0.9, 26], [5, 1.1, 5], { surface: 'platform-shore-pad' }),
];
const course = validateWorldCourse({
  format: 'FlightCourse.v2',
  id: 'mountain-reservoir-01',
  revision,
  environment: 'coast',
  world: { id: 'mountain-reservoir', theme: 'ukrainian', style: 'coast' },
  locales: {
    en: {
      title: 'Shoreline check-in',
      brief:
        'Lift from the marked shore pad, settle at two shoreline lookouts and return to the H. Stay on the land side of the yellow inspection rail; water and the distant ridges are scenery outside this first flight area.',
      lesson:
        'Establish height before turning, then brake to settle inside each hold. The closed maintenance hut and stone terraces have collision. Finish on the supported pad. This scene does not simulate swimming or buoyancy.',
    },
    uk: {
      title: 'Перевірка берегового маршруту',
      brief:
        'Злетіть із позначеного берегового майданчика, зупиніться біля двох оглядових точок і поверніться до літери H. Тримайтеся з боку суші від жовтої огорожі; вода й далекі хребти розташовані поза першою зоною польоту.',
      lesson:
        'Спершу наберіть висоту, потім повертайте й гальмуйте в кожній зоні утримання. Закрита службова будівля та кам’яні тераси мають зіткнення. Завершіть посадкою на твердому майданчику. Сцена не моделює плавання чи плавучість.',
    },
  },
  bounds,
  spawn,
  obstacles,
  actors: [],
  steps: { 'self-level': route, acro: structuredClone(route) },
  rules: { maxTicks: 18000, droneRadius: 220 },
  conditions: { profile: 'clear', revision: 'r1' },
});
project.courses = [course];
project.spawnBindings = { [course.id]: 'shore-pad' };
project.routeBindings = {
  [course.id]: {
    'self-level': [null, 'shore-lookout-south', 'shore-lookout-north', 'shore-return'],
    acro: [null, 'shore-lookout-south', 'shore-lookout-north', 'shore-return'],
  },
};
project.authoring = {
  format: 'FPVMountainReservoirCheckpoint.v1',
  revision,
  status: 'one-course scene review; seven courses and final sixteen demonstrations remain',
  coordinateReference: 'integer millimetres at drone lower point',
  visualBoundary:
    'yellow inspection rail at x=5.5m; course eastern bound x=6m; reservoir surface starts x=8m',
  water:
    'Scenery outside this first flight area; no water collision, buoyancy or water landing claim',
  collision:
    'Explicit course solids are rendered by the existing renderer. The imported GLB contains additional scenery and flush closed-face details only; its empty collider markers preserve box source identity. Terraced triangle geometry is generated from the same original source script.',
  nominalRouteMetres: [
    [-30, 0.45, 26],
    [-30, 3.8, 24],
    [-10, 5, 15],
    [-10, 7, -12],
    [-30, 7, 26],
    [-30, 0.45, 26],
  ],
  license: 'Original geometry and design, CC0-1.0; no third-party art used',
};
project.provenance = [
  {
    asset: project.world.modelAsset,
    author: 'RevealLine contributors',
    license: {
      id: 'CC0-1.0',
      author: 'RevealLine contributors',
      source: 'Original deterministic authoring/fpv-worlds/mountain-reservoir/source/scene.mjs',
    },
    sourceSHA256: hash(source.bytes),
    changes:
      'Original generated geometry; existing pinned prepare pipeline dedup/prune with semantic transform verification. No Blender execution or third-party asset reuse.',
  },
];
synchronizeDefinitions(project);
const root = path.join(output, 'prepared'),
  model = await readFile(path.join(root, project.world.modelAsset));
const assets = new Map([[project.world.modelAsset, model]]);
const pack = await preparePack(project, { assets }),
  zip = await exportEditableZip(project, { assets });
const packBytes = Buffer.from(await pack.arrayBuffer()),
  zipBytes = Buffer.from(await zip.arrayBuffer());
const inspected = await inspectPack(pack),
  roundTrip = await importEditableZip(zip);
assert(
  canonicalWorldJSON(inspected.project.courses) === canonicalWorldJSON(project.courses),
  'Pack course mismatch',
);
assert(
  canonicalWorldJSON(roundTrip.project) === canonicalWorldJSON(inspected.project),
  'Editable project round trip mismatch',
);
const coursePath = path.join(root, 'project.json');
await writeFile(coursePath, JSON.stringify(project, null, 2) + '\n');
await writeFile(path.join(root, `mountain-reservoir-checkpoint.${revision}.rlpack`), packBytes, {
  flag: 'wx',
});
await writeFile(path.join(root, `mountain-reservoir-checkpoint.${revision}.zip`), zipBytes, {
  flag: 'wx',
});
const sourceScript = await readFile(new URL('./source/scene.mjs', import.meta.url));
const materialSource = await readFile(new URL('./source/mineral.mjs', import.meta.url));
const receipt = {
  format: 'FPVMountainReservoirCheckpointBuild.v1',
  stage: 'one course, visual review and two-mode flight proofs pending',
  sourceScript: {
    path: 'authoring/fpv-worlds/mountain-reservoir/source/scene.mjs',
    sha256: hash(sourceScript),
  },
  materialSource: {
    path: 'authoring/fpv-worlds/mountain-reservoir/source/mineral.mjs',
    sha256: hash(materialSource),
  },
  source: { bytes: source.bytes.length, sha256: hash(source.bytes), ...source.statistics },
  prepared: {
    bytes: model.length,
    sha256: hash(model),
    validatorErrors: prepared.report.validation.after.issues.numErrors,
  },
  pack: {
    bytes: packBytes.length,
    sha256: hash(packBytes),
    identity: 'fpv-pack:' + inspected.sha256,
  },
  zip: { bytes: zipBytes.length, sha256: hash(zipBytes) },
  courses: project.courses.map((c) => c.id),
  runtimeChanges: 0,
  textures: source.statistics.textures,
  limitsUnchanged: true,
  sourcePipeline:
    'scripts/fpv-content.mjs prepareWorldFile; pinned glTF Transform 4.5.1 and Khronos Validator 2.0.0-dev.3.10',
  output: fileURLToPath(new URL('file://' + root + '/')),
};
await writeFile(
  path.join(output, 'checkpoint-build.json'),
  JSON.stringify(receipt, null, 2) + '\n',
  { flag: 'wx' },
);
console.log(JSON.stringify(receipt, null, 2));

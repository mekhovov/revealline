#!/usr/bin/env node
// One-course scene review only. The complete world needs eight final route pairs.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createScene, bounds, spawn } from './source/scene.mjs';
import { xyz } from './source/art.mjs';
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

const sha = (b) => createHash('sha256').update(b).digest('hex');
const check = (ok, message) => {
  if (!ok) throw Error(message);
};
const output = path.resolve(process.argv[2] ?? '');
check(process.argv.length === 3 && output !== process.cwd(), 'Choose a new output directory');
await mkdir(output, { recursive: false });
const source = createScene();
check(
  source.bytes.length <= 1.5 * 1024 * 1024 && source.statistics.triangles <= 15000,
  'Initial artwork budget',
);
check(
  source.statistics.colliders <= 44 &&
    source.statistics.materials <= 12 &&
    source.statistics.textures <= 2,
  'Initial scene ownership budget',
);
const sourceFile = path.join(output, 'harbor-docks-source.glb');
await writeFile(sourceFile, source.bytes, { flag: 'wx' });
const prepared = await prepareWorldFile({
  entry: sourceFile,
  outputDirectory: path.join(output, 'prepared'),
  id: 'harbor-docks',
  title: 'Harbor Docks · scene checkpoint',
});
const project = prepared.project,
  revision = 'r2';
project.revision = revision;
function volume(type, centre, size, extra = {}) {
  return {
    type,
    min: xyz(centre.map((v, i) => v - size[i] / 2)),
    max: xyz(centre.map((v, i) => v + size[i] / 2)),
    ticks: 45,
    maxSpeed: type === 'land' ? 700 : 1000,
    maxTilt: 2500,
    minTilt: 0,
    centred: false,
    heading: null,
    ...extra,
  };
}
const route = [
  volume('hold', [-2, 6, 20], [3, 1.8, 3]),
  volume('hold', [-3, 7, -4], [3, 1.8, 3]),
  volume('hold', [24, 9, -14], [3, 1.8, 3]),
  volume('hold', [24, 8, 25], [3, 1.8, 3]),
  volume('land', [-2, 2.6, 34], [4, 1.2, 4], { surface: 'platform-quay' }),
];
const course = validateWorldCourse({
  format: 'FlightCourse.v2',
  id: 'harbor-docks-01',
  revision,
  environment: 'container-yard',
  world: { id: 'harbor-docks', theme: 'operations', style: 'container-yard' },
  locales: {
    en: {
      title: 'Quay check-in',
      brief:
        'Lift from the quay H, identify the closed container groups and pass through the broad supported gantry approach before returning over the open apron. The water is beyond the visible east boundary and outside this flying area.',
      lesson:
        'Establish height above the raised quay before turning. Settle inside each hold. Doors and glazing are closed surfaces; use the real gantry opening, then land on the same solid quay pad.',
    },
    uk: {
      title: 'Огляд причалу',
      brief:
        'Злетіть із літери H на причалі, знайдіть групи закритих контейнерів і пройдіть широким підходом до порталу перед поверненням над відкритим майданчиком. Вода розташована за видимою східною межею, поза зоною польоту.',
      lesson:
        'Наберіть висоту над піднятим причалом перед поворотом. Зупиніться в кожній зоні утримання. Двері й скління закриті: використовуйте справжній отвір порталу та сідайте на той самий твердий майданчик причалу.',
    },
  },
  bounds,
  spawn,
  obstacles: source.obstacles,
  actors: [],
  steps: { 'self-level': route, acro: structuredClone(route) },
  rules: { maxTicks: 24000, droneRadius: 220 },
  conditions: { profile: 'clear', revision: 'r1' },
});
project.courses = [course];
project.spawnBindings = { [course.id]: 'quay-pad' };
project.routeBindings = {
  [course.id]: {
    'self-level': [
      'arrival-apron',
      'container-lane-lookout',
      'gantry-lookout',
      null,
      'quay-return',
    ],
    acro: ['arrival-apron', 'container-lane-lookout', 'gantry-lookout', null, 'quay-return'],
  },
};
project.authoring = {
  format: 'FPVHarborDocksCheckpoint.v1',
  revision,
  scope:
    'Initial original scene and one playable route; visual review and both ordinary-mode proofs pending. Seven routes remain.',
  coordinateReference: 'integer millimetres at drone lower point',
  collision:
    'A continuous real platform spans Y0–2m under all playable land; source marker and course box corners share exact coordinates. East water at Y0.22m starts X43m beyond playable X40m; north/south background water stays beyond quay Z−52/50m and playable Z−48/46m. No over-water course or water physics. Minor attached lock/strap relief is cosmetic; no flyable gaps are implied.',
  capabilities: [
    'REVEALLINE_surface_coating version1 opaque-finish: exact painted canonical planes, fixed host bias, fail-closed old-host refusal',
  ],
  nominalRouteMetres: [
    [-2, 2.25, 34],
    [-2, 6, 20],
    [-3, 7, -4],
    [24, 9, -14],
    [24, 8, 25],
    [-2, 8, 34],
    [-2, 2.25, 34],
  ],
  license: 'Original geometry, artwork and fictional layout; CC0-1.0; no copied harbor assets',
};
project.provenance = [
  {
    asset: project.world.modelAsset,
    author: 'RevealLine contributors',
    license: {
      id: 'CC0-1.0',
      author: 'RevealLine contributors',
      source: 'Original authoring/fpv-worlds/harbor-docks/source',
    },
    sourceSHA256: sha(source.bytes),
    changes:
      'Original deterministic GLB; existing pinned dedup/prune preparation and semantic-transform verification; no third-party art or runtime changes',
  },
];
synchronizeDefinitions(project);
const root = path.join(output, 'prepared'),
  model = await readFile(path.join(root, project.world.modelAsset)),
  assets = new Map([[project.world.modelAsset, model]]);
const pack = await preparePack(project, { assets }),
  zip = await exportEditableZip(project, { assets });
const packBytes = Buffer.from(await pack.arrayBuffer()),
  zipBytes = Buffer.from(await zip.arrayBuffer());
const inspected = await inspectPack(pack),
  restored = await importEditableZip(zip);
check(
  canonicalWorldJSON(inspected.project.courses) === canonicalWorldJSON(project.courses),
  'Pack course preservation',
);
check(
  canonicalWorldJSON(restored.project) === canonicalWorldJSON(inspected.project),
  'Editable ZIP round trip',
);
await writeFile(path.join(root, 'project.json'), JSON.stringify(project, null, 2) + '\n');
await writeFile(path.join(root, `harbor-docks-checkpoint.${revision}.rlpack`), packBytes, {
  flag: 'wx',
});
await writeFile(path.join(root, `harbor-docks-checkpoint.${revision}.zip`), zipBytes, {
  flag: 'wx',
});
const receipt = {
  format: 'FPVHarborDocksCheckpointBuild.v1',
  stage: 'one course; actual visual review and ordinary completion qualification pending',
  source: { bytes: source.bytes.length, sha256: sha(source.bytes), ...source.statistics },
  prepared: {
    bytes: model.length,
    sha256: sha(model),
    validatorErrors: prepared.report.validation.after.issues.numErrors,
  },
  pack: {
    bytes: packBytes.length,
    sha256: sha(packBytes),
    identity: 'fpv-pack:' + inspected.sha256,
  },
  zip: { bytes: zipBytes.length, sha256: sha(zipBytes) },
  sourceFiles: await Promise.all(
    ['source/scene.mjs', 'source/art.mjs', 'source/lettering.mjs', 'build-checkpoint.mjs'].map(
      async (p) => ({
        path: p,
        sha256: sha(await readFile(new URL(p, import.meta.url))),
      }),
    ),
  ),
  courses: [course.id],
  runtimeChanges: 0,
  limitsUnchanged: true,
};
await writeFile(
  path.join(output, 'checkpoint-build.json'),
  JSON.stringify(receipt, null, 2) + '\n',
  { flag: 'wx' },
);
console.log(JSON.stringify(receipt, null, 2));

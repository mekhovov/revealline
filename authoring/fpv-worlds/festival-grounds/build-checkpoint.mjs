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
  source.statistics.colliders <= 48 &&
    source.statistics.materials <= 16 &&
    source.statistics.textures <= 2,
  'Initial scene ownership budget',
);
const sourceFile = path.join(output, 'festival-grounds-source.glb');
await writeFile(sourceFile, source.bytes, { flag: 'wx' });
const prepared = await prepareWorldFile({
  entry: sourceFile,
  outputDirectory: path.join(output, 'prepared'),
  id: 'festival-grounds',
  title: 'Festival Grounds · scene checkpoint',
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
  volume('hold', [0, 4, 12], [3, 1.8, 3]),
  volume('hold', [0, 4.2, -10], [3, 1.8, 3]),
  volume('hold', [31.5, 4.5, -9], [3, 1.8, 3]),
  volume('hold', [31.5, 5.5, 25], [3, 1.8, 3]),
  volume('land', [0, 0.6, 25], [4, 1.2, 4], { surface: '$floor' }),
];
const course = validateWorldCourse({
  format: 'FlightCourse.v2',
  id: 'festival-grounds-01',
  revision,
  environment: 'field',
  world: { id: 'festival-grounds', theme: 'ukrainian', style: 'field' },
  locales: {
    en: {
      title: 'Entry check-in',
      brief:
        'Lift from the entry H, settle over the central lawn, identify the covered stage and clock tower, then follow the open east lane home. The market shutters and stage back are closed solids.',
      lesson:
        'Establish height before changing direction. Brake inside each hold and approach the final H over the open lawn. The stage has a real supported roof and clear sides; no route requires flying through a painted opening.',
    },
    uk: {
      title: 'Огляд від входу',
      brief:
        'Злетіть із літери H біля входу, зупиніться над центральною галявиною, знайдіть криту сцену й годинникову вежу, а тоді поверніться відкритою східною смугою. Віконниці крамничок і задня стіна сцени закриті.',
      lesson:
        'Наберіть висоту перед зміною напрямку. Гальмуйте в кожній зоні утримання та підходьте до літери H над відкритою галявиною. Дах сцени має справжні опори й відкриті боки; маршрут не потребує польоту крізь намальований отвір.',
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
project.spawnBindings = { [course.id]: 'entry-pad' };
project.routeBindings = {
  [course.id]: {
    'self-level': ['lawn-overlook', 'stage-lookout', 'service-lookout', null, 'entry-return'],
    acro: ['lawn-overlook', 'stage-lookout', 'service-lookout', null, 'entry-return'],
  },
};
project.authoring = {
  format: 'FPVFestivalGroundsCheckpoint.v1',
  revision,
  status:
    'one-course scene checkpoint; visual review and both-mode proofs pending; seven more courses remain',
  coordinateReference: 'integer millimetres at drone lower point',
  collision:
    'Explicit box and rotated-box course solids share source coordinates with GLB collider markers; the canonical renderer draws them. Imported surfaces add attached finish and out-of-bounds trees. Flat lawn uses the existing floor.',
  nominalRouteMetres: [
    [0, 0.25, 25],
    [0, 4, 12],
    [0, 4.2, -10],
    [31.5, 4.5, -9],
    [31.5, 5.5, 25],
    [0, 5.5, 25],
    [0, 0.25, 25],
  ],
  license: 'Original geometry, artwork and fictional layout; CC0-1.0; no copied festival assets',
};
project.provenance = [
  {
    asset: project.world.modelAsset,
    author: 'RevealLine contributors',
    license: {
      id: 'CC0-1.0',
      author: 'RevealLine contributors',
      source: 'Original authoring/fpv-worlds/festival-grounds/source',
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
await writeFile(path.join(root, `festival-grounds-checkpoint.${revision}.rlpack`), packBytes, {
  flag: 'wx',
});
await writeFile(path.join(root, `festival-grounds-checkpoint.${revision}.zip`), zipBytes, {
  flag: 'wx',
});
const receipt = {
  format: 'FPVFestivalGroundsCheckpointBuild.v1',
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

#!/usr/bin/env node
// Data-only five-course candidate; original accepted r4 artifacts stay immutable.
import { mkdir, readFile, writeFile, link } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { landRouteCandidates, landRouteSurveys } from './source/land-routes.mjs';
import { synchronizeDefinitions } from '../../../optional-practice/civilian-fpv/world-app.mjs';
import {
  validateWorldCourse,
  worldCourseRequiresAcro,
} from '../../../optional-practice/civilian-fpv/world-model.mjs';
import { splitCourseDefinition } from '../../../optional-practice/civilian-fpv/content-definitions.mjs';
import {
  preparePack,
  inspectPack,
  canonicalWorldJSON,
} from '../../../optional-practice/civilian-fpv/world-content.mjs';
import {
  exportEditableZip,
  importEditableZip,
} from '../../../optional-practice/civilian-fpv/world-zip.mjs';
const [sourceArg, outputArg] = process.argv.slice(2);
if (!sourceArg || !outputArg) throw Error('Use R4_PREPARED_DIRECTORY NEW_OUTPUT_DIRECTORY');
const hash = (b) => createHash('sha256').update(b).digest('hex');
const check = (value, message) => {
  if (!value) throw Error(message);
};
const project = JSON.parse(await readFile(path.join(sourceArg, 'project.json'))),
  baseline = structuredClone(project.courses[0]);
check(
  project.revision === 'r4' &&
    project.courses.length === 1 &&
    baseline.id === 'mountain-reservoir-01',
  'Exact one-course r4 input required',
);
const sourceModel = path.resolve(sourceArg, project.world.modelAsset),
  model = await readFile(sourceModel);
check(
  hash(model) === 'dfd964aedd7051450b4440cca590e1f17606282ffdc1607eef0477066e591ac1',
  'Accepted r4 model bytes required',
);
const candidates = landRouteCandidates(baseline).map(validateWorldCourse),
  world = canonicalWorldJSON(splitCourseDefinition(baseline).world);
for (const course of candidates) {
  check(
    canonicalWorldJSON(splitCourseDefinition(course).world) === world,
    'Shared World changed: ' + course.id,
  );
  check(!worldCourseRequiresAcro(course), 'Both modes must remain selectable: ' + course.id);
  project.spawnBindings[course.id] = 'shore-pad';
  project.routeBindings[course.id] = Object.fromEntries(
    ['self-level', 'acro'].map((mode) => [mode, course.steps[mode].map(() => null)]),
  );
}
project.revision = 'r5-land';
project.courses.push(...candidates);
project.authoring = {
  ...project.authoring,
  revision: project.revision,
  status:
    'Five land-side course candidates; four new routes need clearance, ordinary proofs and actual visual review. Intake, spillway and island remain absent. Not the final eight-course world.',
  localRouteCriteria:
    'Courses02/05/06/08 have independent per-mode local criteria with null source bindings. Reimport cannot move a shared anchor to two different mode positions.',
  routeSurveys: landRouteSurveys,
  checkpointDependency: 'fpv-pack:4c4a0aba2c6347f7670b86a40af5a0d9dd8a1be0e0b65e4a66465c4684136c6c',
};
synchronizeDefinitions(project);
check(
  project.courses.length === 5 &&
    project.definitions.worlds.length === 1 &&
    project.definitions.layouts.length === 5,
  'Five independent layouts over one World',
);
check(
  canonicalWorldJSON(project.courses[0]) === canonicalWorldJSON(baseline),
  'Original checkpoint course changed',
);
for (const course of project.courses)
  check(
    canonicalWorldJSON(splitCourseDefinition(course).world) === world,
    'Compiled shared geometry changed',
  );
const assets = new Map([[project.world.modelAsset, model]]),
  pack = await preparePack(project, { assets }),
  zip = await exportEditableZip(project, { assets }),
  inspected = await inspectPack(pack),
  imported = await importEditableZip(zip),
  packBytes = Buffer.from(await pack.arrayBuffer()),
  zipBytes = Buffer.from(await zip.arrayBuffer());
check(
  canonicalWorldJSON(inspected.project) === canonicalWorldJSON(imported.project),
  'Pack/ZIP full project mismatch',
);
check(
  canonicalWorldJSON(project) === canonicalWorldJSON(inspected.project),
  'Pack changed authoring project',
);
await mkdir(outputArg);
await mkdir(path.dirname(path.join(outputArg, project.world.modelAsset)), { recursive: true });
await link(sourceModel, path.join(outputArg, project.world.modelAsset));
await writeFile(path.join(outputArg, 'project.json'), JSON.stringify(project, null, 2) + '\n', {
  flag: 'wx',
});
for (const [name, bytes] of [
  ['mountain-reservoir.r5-land.rlpack', packBytes],
  ['mountain-reservoir.r5-land.zip', zipBytes],
])
  await writeFile(path.join(outputArg, name), bytes, { flag: 'wx' });
const receipt = {
  format: 'FPVReservoirLandRouteDraft.v1',
  status: 'transport-validated; flight/art qualification pending',
  courses: project.courses.map((c) => ({
    id: c.id,
    revision: c.revision,
    steps: Object.fromEntries(Object.entries(c.steps).map(([m, s]) => [m, s.length])),
  })),
  worldCount: project.definitions.worlds.length,
  layoutCount: project.definitions.layouts.length,
  model: { bytes: model.length, sha256: hash(model), exactAcceptedR4: true },
  pack: {
    bytes: packBytes.length,
    sha256: hash(packBytes),
    identity: 'fpv-pack:' + inspected.sha256,
  },
  zip: { bytes: zipBytes.length, sha256: hash(zipBytes) },
  limitsUnchanged: true,
  runtimeChanges: 0,
  geometryChanges: 0,
  collisionChanges: 0,
  limitations: [
    'Only five courses authored; no final eight-course delivery or final sixteen proofs.',
    'First-course r4 proofs remain historical and are not rebound to this new pack.',
    'Shared bounds remain land-side; absent intake/spillway/island require a later coherent world revision.',
  ],
};
await writeFile(
  path.join(outputArg, 'land-routes-build.json'),
  JSON.stringify(receipt, null, 2) + '\n',
  { flag: 'wx' },
);
console.log(JSON.stringify(receipt, null, 2));

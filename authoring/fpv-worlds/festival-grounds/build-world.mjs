#!/usr/bin/env node
// Reuse the exact accepted r3 art; author independent criteria in one shared World.
import { readFile, writeFile, mkdir, link } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { festivalCourses } from './source/courses.mjs';
import { synchronizeDefinitions } from '../../../optional-practice/civilian-fpv/world-app.mjs';
import { splitCourseDefinition } from '../../../optional-practice/civilian-fpv/content-definitions.mjs';
import {
  validateWorldCourse,
  worldCourseRequiresAcro,
} from '../../../optional-practice/civilian-fpv/world-model.mjs';
import {
  preparePack,
  inspectPack,
  canonicalWorldJSON,
} from '../../../optional-practice/civilian-fpv/world-content.mjs';
import {
  exportEditableZip,
  importEditableZip,
} from '../../../optional-practice/civilian-fpv/world-zip.mjs';

const [baselineArg, outputArg] = process.argv.slice(2);
if (!baselineArg || !outputArg) throw Error('Use ACCEPTED_R3_GENERATED_DIRECTORY NEW_OUTPUT');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const must = (ok, name) => {
  if (!ok) throw Error(name);
};
const project = JSON.parse(await readFile(path.join(baselineArg, 'prepared/project.json')));
const build = JSON.parse(await readFile(path.join(baselineArg, 'checkpoint-build.json')));
const source = await readFile(path.join(baselineArg, 'festival-grounds-source.glb'));
const model = await readFile(path.join(baselineArg, 'prepared', project.world.modelAsset));
must(
  project.revision === 'r3' && project.courses.length === 1,
  'Accepted single-course r3 baseline',
);
must(
  sha(source) === 'fe3ee76100ea7c62bd1fdcca7eabd3d9d560ff7a9f62932f62f5e6395a37eac8' &&
    sha(model) === 'e4ef61faebc4d4bc71d0ee62d13ad04ffd0b93196a5b61c69cf1ca8ba1c08db9',
  'Exact accepted source/prepared artwork',
);
const rows = festivalCourses(project.courses[0]);
const orientationBindings = structuredClone(project.routeBindings[project.courses[0].id]);
project.revision = 'r4';
project.title = 'Festival Grounds';
project.courses = rows.map(({ course }) => validateWorldCourse(course));
project.spawnBindings = {};
project.routeBindings = {};
delete project.definitions;
for (const c of project.courses) {
  must(!worldCourseRequiresAcro(c), 'Both ordinary modes required: ' + c.id);
  project.spawnBindings[c.id] = 'entry-pad';
  project.routeBindings[c.id] =
    c.id === 'festival-grounds-01'
      ? orientationBindings
      : Object.fromEntries(
          Object.entries(c.steps).map(([mode, steps]) => [mode, steps.map(() => null)]),
        );
}
project.authoring = {
  format: 'FPVFestivalGroundsWorldCandidate.v1',
  revision: 'r4',
  status:
    'Eight-course candidate; exact sixteen ordinary flights, actual imported Watch/editor and offline qualification pending',
  acceptedScene: {
    revision: 'r3',
    sourceCommit: 'a2c0c006e11b304296492a2110ec1647e6497f7c',
    sha256: sha(source),
  },
  allocation: rows.map(({ activity, course }) => ({ id: course.id, activity })),
  discoveryMetadata:
    'Imported catalogue cards currently use host defaults Explore/intermediate/4min. These activity names describe authored criteria, not new runtime card metadata.',
  collision:
    'One shared47-solid world. Closed kiosks, rear stage and roof remain solid; the actual front/side stage passages stay open. Lawn and path are supported by the existing floor.',
  actors:
    'Only follow/observe layouts contain one real civilian actor each. The cart must travel4m during continuous tracking; guide observation requires real range/relative-speed/nose/visibility without a travel minimum.',
  routeOwnership:
    'Eight independent ordered layouts, two independently cloned ordinary-mode arrays, unchanged shared World and spawn. Orientation preserves its original source anchors; the seven new layouts use null route bindings to own authored local criteria.',
  license: 'Original CC0 geometry/maps/marks; no third-party festival art or runtime changes',
};
synchronizeDefinitions(project);
must(
  project.courses.length === 8 &&
    project.definitions.worlds.length === 1 &&
    project.definitions.layouts.length === 8,
  'One World and eight layouts',
);
const world = canonicalWorldJSON(splitCourseDefinition(project.courses[0]).world);
must(
  project.courses.every((c) => canonicalWorldJSON(splitCourseDefinition(c).world) === world),
  'Exact shared world across all courses',
);
must(
  new Set(project.courses.map((c) => canonicalWorldJSON(c.steps))).size === 8,
  'Eight distinct criteria sequences',
);
const assets = new Map([[project.world.modelAsset, model]]);
const pack = await preparePack(project, { assets }),
  zip = await exportEditableZip(project, { assets });
const inspected = await inspectPack(pack),
  restored = await importEditableZip(zip);
must(
  canonicalWorldJSON(inspected.project) === canonicalWorldJSON(project) &&
    canonicalWorldJSON(restored.project) === canonicalWorldJSON(project),
  'Exact full project pack/ZIP round trip',
);
await mkdir(outputArg);
await mkdir(path.join(outputArg, 'prepared'));
await link(
  path.resolve(baselineArg, 'festival-grounds-source.glb'),
  path.resolve(outputArg, 'festival-grounds-source.glb'),
);
const dest = path.resolve(outputArg, 'prepared', project.world.modelAsset);
await mkdir(path.dirname(dest), { recursive: true });
await link(path.resolve(baselineArg, 'prepared', project.world.modelAsset), dest);
const packBytes = Buffer.from(await pack.arrayBuffer()),
  zipBytes = Buffer.from(await zip.arrayBuffer());
await writeFile(
  path.join(outputArg, 'prepared/project.json'),
  JSON.stringify(project, null, 2) + '\n',
  { flag: 'wx' },
);
await writeFile(path.join(outputArg, 'prepared/festival-grounds.r4.rlpack'), packBytes, {
  flag: 'wx',
});
await writeFile(path.join(outputArg, 'prepared/festival-grounds.r4.zip'), zipBytes, { flag: 'wx' });
const receipt = {
  format: 'FPVFestivalWorldBuild.v1',
  stage: 'Eight-course candidate, qualification pending',
  source: build.source,
  prepared: build.prepared,
  pack: {
    bytes: packBytes.length,
    sha256: sha(packBytes),
    identity: 'fpv-pack:' + inspected.sha256,
  },
  zip: { bytes: zipBytes.length, sha256: sha(zipBytes) },
  courses: rows.map(({ activity, course }) => ({
    id: course.id,
    title: course.locales.en.title,
    activity,
    steps: Object.fromEntries(
      Object.entries(course.steps).map(([mode, values]) => [mode, values.length]),
    ),
    actors: course.actors.length,
  })),
  sourcePins: await Promise.all(
    ['source/courses.mjs', 'build-world.mjs'].map(async (file) => {
      const bytes = await readFile(new URL(file, import.meta.url));
      return { path: file, bytes: bytes.length, sha256: sha(bytes) };
    }),
  ),
  worldCount: 1,
  layoutCount: 8,
  acceptedArtBytesUnchanged: true,
  runtimeChanges: 0,
  limitsUnchanged: true,
};
await writeFile(path.join(outputArg, 'world-build.json'), JSON.stringify(receipt, null, 2) + '\n', {
  flag: 'wx',
});
console.log(JSON.stringify(receipt, null, 2));

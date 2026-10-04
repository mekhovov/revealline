#!/usr/bin/env node
// Eight-course candidate. Qualification, not this generator, decides release readiness.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  createScene,
  includeLandEngineering,
  includeTerrainStitching,
  includeRetainingFaces,
  includeRootedVegetation,
  includeMaintenanceInlays,
  obstacles,
  bounds,
  spawn,
} from './source/scene.mjs';
import { landRouteCandidates } from './source/land-routes.mjs';
import { engineeringRouteCandidates } from './source/engineering-routes.mjs';
import { prepareWorldFile } from '../../../scripts/fpv-content.mjs';
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
const [baselineArg, outputArg, variant] = process.argv.slice(2);
if (!baselineArg || !outputArg)
  throw Error('Use ACCEPTED_R4_PREPARED_DIRECTORY NEW_OUTPUT_DIRECTORY');
if (
  variant &&
  ![
    '--terrain-stitching',
    '--material-scale',
    '--retaining-faces',
    '--surface-coatings',
    '--required-coating',
    '--rooted-vegetation',
    '--maintenance-inlays',
  ].includes(variant)
)
  throw Error('Unknown scene variant');
const hash = (b) => createHash('sha256').update(b).digest('hex');
const check = (ok, label) => {
  if (!ok) throw Error(label);
};
const baseline = JSON.parse(await readFile(path.join(baselineArg, 'project.json')));
check(
  baseline.revision === 'r4' &&
    baseline.courses.length === 1 &&
    baseline.courses[0].id === 'mountain-reservoir-01',
  'Exact accepted first-course baseline',
);
includeLandEngineering();
if (variant) includeTerrainStitching();
if (
  [
    '--retaining-faces',
    '--surface-coatings',
    '--required-coating',
    '--rooted-vegetation',
    '--maintenance-inlays',
  ].includes(variant)
)
  includeRetainingFaces({
    coating: [
      '--surface-coatings',
      '--required-coating',
      '--rooted-vegetation',
      '--maintenance-inlays',
    ].includes(variant),
    required: ['--required-coating', '--rooted-vegetation', '--maintenance-inlays'].includes(
      variant,
    ),
  });
const rootContact = ['--rooted-vegetation', '--maintenance-inlays'].includes(variant)
    ? includeRootedVegetation()
    : null,
  maintenance = variant === '--maintenance-inlays' ? includeMaintenanceInlays() : null;
const scene = createScene({
  groundMaterials: [
    '--material-scale',
    '--retaining-faces',
    '--surface-coatings',
    '--required-coating',
    '--rooted-vegetation',
    '--maintenance-inlays',
  ].includes(variant),
});
check(
  scene.bytes.length < 1.2 * 1024 * 1024 && scene.statistics.triangles < 15000,
  'Original artwork target exceeded',
);
check(
  obstacles.length <= 48 && scene.statistics.collisionTriangles <= 1000,
  'Original collision target exceeded',
);
await mkdir(outputArg);
const entry = path.join(outputArg, 'mountain-reservoir-source.glb');
await writeFile(entry, scene.bytes, { flag: 'wx' });
const prepared = await prepareWorldFile({
    entry,
    outputDirectory: path.join(outputArg, 'prepared'),
    id: 'mountain-reservoir',
    title: 'Mountain Reservoir · land-side world',
  }),
  project = prepared.project,
  revision =
    variant === '--maintenance-inlays'
      ? 'r16'
      : variant === '--rooted-vegetation'
        ? 'r15'
        : variant === '--required-coating'
          ? 'r14'
          : variant === '--surface-coatings'
            ? 'r13'
            : variant === '--retaining-faces'
              ? 'r12'
              : variant === '--material-scale'
                ? 'r11'
                : variant
                  ? 'r9'
                  : 'r8',
  first = validateWorldCourse({
    ...structuredClone(baseline.courses[0]),
    revision,
    bounds,
    spawn,
    obstacles,
  });
first.locales.en.brief =
  'Lift from the marked shore pad, settle at two shoreline lookouts and return to the H. Stay on the land side of the yellow inspection rail; water and the distant ridges are outside the flight boundary.';
first.locales.uk.brief =
  'Злетіть із позначеного берегового майданчика, зупиніться біля двох оглядових точок і поверніться до літери H. Тримайтеся з боку суші від жовтої огорожі; вода й далекі хребти розташовані поза межею польоту.';
project.revision = revision;
project.courses = [
  first,
  ...landRouteCandidates(first, { engineering: true }),
  ...engineeringRouteCandidates(first),
].sort((a, b) => a.id.localeCompare(b.id));
project.spawnBindings = {};
project.routeBindings = {};
delete project.definitions;
for (const course of project.courses) {
  validateWorldCourse(course);
  check(!worldCourseRequiresAcro(course), 'Both ordinary modes required: ' + course.id);
  project.spawnBindings[course.id] = 'shore-pad';
  project.routeBindings[course.id] =
    course.id === first.id
      ? structuredClone(baseline.routeBindings[first.id])
      : Object.fromEntries(
          Object.entries(course.steps).map(([mode, route]) => [mode, route.map(() => null)]),
        );
}
project.authoring = {
  format: 'FPVMountainReservoirWorldCandidate.v1',
  revision,
  status:
    'Eight authored route pairs; final scene review, collision sweeps, sixteen ordinary proofs, imported player and offline qualification pending. Not a released world.',
  coordinateReference: 'integer millimetres at drone lower point',
  visualBoundary:
    'yellow inspection rail at x=5.5m; all layouts share eastern bound x=6m; reservoir starts x=8m',
  water:
    'Decorative lake outside all eight playable land-side routes. No water landing, swimming, buoyancy or island-flight claim.',
  designRevision:
    'The provisional Island circuit is replaced by honestly named Shoreline circuit. Intake controls and dry spillway are real land-side works with matching solid collision.',
  collision:
    'Canonical course geometry renders every reachable solid. The original GLB adds outlying scenery and flush markings, with exact semantic box transforms. Three spillway pieces use solid rotated boxes; terrain retains explicit triangles.',
  routeOwnership:
    'One World, eight independent layouts, both mode arrays. New routes use local criteria and null source bindings; no anchor is silently moved for two modes.',
  checkpointDependency: 'fpv-pack:4c4a0aba2c6347f7670b86a40af5a0d9dd8a1be0e0b65e4a66465c4684136c6c',
  license: 'Original geometry/materials, CC0-1.0; no third-party art used',
};
project.provenance = [
  {
    asset: project.world.modelAsset,
    author: 'RevealLine contributors',
    license: {
      id: 'CC0-1.0',
      author: 'RevealLine contributors',
      source: 'Original deterministic authoring/fpv-worlds/mountain-reservoir/source/',
    },
    sourceSHA256: hash(scene.bytes),
    changes: ['--required-coating', '--maintenance-inlays'].includes(variant)
      ? 'Existing pinned prepare pipeline with registered REVEALLINE_surface_coating v1 preservation. One canonical opaque-finish extension is required; older hosts reject it. No physics changes.'
      : variant === '--surface-coatings'
        ? 'Existing pinned prepare pipeline; original land-side engineering over accepted r4 composition. No physics changes. The mineral material declares the fixed SimSurfaceCoating.v1 opaque-finish hint; this candidate requires the qualified coating-capable renderer.'
        : 'Existing pinned prepare pipeline; original land-side engineering over accepted r4 composition. No renderer or physics changes.',
  },
];
synchronizeDefinitions(project);
check(
  project.courses.length === 8 &&
    project.definitions.worlds.length === 1 &&
    project.definitions.layouts.length === 8,
  'One World and eight actual layouts',
);
const world = canonicalWorldJSON(splitCourseDefinition(project.courses[0]).world);
for (const course of project.courses)
  check(
    canonicalWorldJSON(splitCourseDefinition(course).world) === world,
    'Shared World mismatch: ' + course.id,
  );
const root = path.join(outputArg, 'prepared'),
  model = await readFile(path.join(root, project.world.modelAsset)),
  assets = new Map([[project.world.modelAsset, model]]),
  pack = await preparePack(project, { assets }),
  zip = await exportEditableZip(project, { assets }),
  inspected = await inspectPack(pack),
  imported = await importEditableZip(zip),
  packBytes = Buffer.from(await pack.arrayBuffer()),
  zipBytes = Buffer.from(await zip.arrayBuffer());
check(
  canonicalWorldJSON(project) === canonicalWorldJSON(inspected.project) &&
    canonicalWorldJSON(project) === canonicalWorldJSON(imported.project),
  'Full project pack/ZIP round trip',
);
await writeFile(path.join(root, 'project.json'), JSON.stringify(project, null, 2) + '\n');
await writeFile(path.join(root, `mountain-reservoir.${revision}.rlpack`), packBytes, {
  flag: 'wx',
});
await writeFile(path.join(root, `mountain-reservoir.${revision}.zip`), zipBytes, { flag: 'wx' });
const sourcePins = [];
for (const file of [
  'scene.mjs',
  'engineering.mjs',
  'land-routes.mjs',
  'engineering-routes.mjs',
  'mineral.mjs',
  'ground-maps.mjs',
  'retaining.mjs',
  'rooting.mjs',
  'maintenance.mjs',
]) {
  const bytes = await readFile(new URL('./source/' + file, import.meta.url));
  sourcePins.push({ path: file, bytes: bytes.length, sha256: hash(bytes) });
}
const receipt = {
  format: 'FPVReservoirWorldBuild.v1',
  stage: 'Eight-route land-side candidate; actual art/collision/flight acceptance pending',
  sourcePins,
  ...(rootContact ? { rootContact } : {}),
  ...(maintenance ? { maintenance } : {}),
  source: { bytes: scene.bytes.length, sha256: hash(scene.bytes), ...scene.statistics },
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
  courses: project.courses.map((c) => ({
    id: c.id,
    title: c.locales.en.title,
    steps: Object.fromEntries(Object.entries(c.steps).map(([mode, rows]) => [mode, rows.length])),
  })),
  bounds,
  worldCount: 1,
  layoutCount: 8,
  runtimeChanges: variant === '--required-coating' ? 4 : variant === '--surface-coatings' ? 2 : 0,
  ...([
    '--surface-coatings',
    '--required-coating',
    '--rooted-vegetation',
    '--maintenance-inlays',
  ].includes(variant)
    ? {
        rendererPrerequisite: [
          '--required-coating',
          '--rooted-vegetation',
          '--maintenance-inlays',
        ].includes(variant)
          ? 'REVEALLINE_surface_coating v1 support in renderer.mjs/world-visuals.mjs/world-content.mjs/world-themes.mjs; required capability rejects older hosts. This asset generation is not package admission.'
          : 'SimSurfaceCoating.v1 opaque-finish support in renderer.mjs/world-visuals.mjs; historical admitted renderers lack this feature. This asset generation is not package admission.',
      }
    : {}),
  textures: scene.statistics.textures,
  limitsUnchanged: true,
};
await writeFile(path.join(outputArg, 'world-build.json'), JSON.stringify(receipt, null, 2) + '\n', {
  flag: 'wx',
});
console.log(JSON.stringify(receipt, null, 2));

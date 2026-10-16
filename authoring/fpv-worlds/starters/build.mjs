#!/usr/bin/env node
// Authoring-only artifacts and functional qualification. Never imported by a player.
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canonicalWorldJSON,
  resolveProject,
  preparePack,
  inspectPack,
} from '../../../optional-practice/civilian-fpv/world-content.mjs';
import {
  exportEditableZip,
  importEditableZip,
} from '../../../optional-practice/civilian-fpv/world-zip.mjs';
import {
  validateWorldCourse,
  initWorldRuntime,
  createWorldFlight,
  createWorldRecorder,
  replayWorldFlight,
  worldStateIdentity,
} from '../../../optional-practice/civilian-fpv/world-model.mjs';
import { createWorldCollision } from '../../../optional-practice/civilian-fpv/world-collision.mjs';
import { adventureAuthoringPilot } from '../../../scripts/qualify-fpv-adventures.mjs';
import {
  splitCourseDefinition,
  compileContentProject,
} from '../../../optional-practice/civilian-fpv/content-definitions.mjs';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SOURCES = fileURLToPath(new URL('./projects/', import.meta.url));
const modes = ['self-level', 'acro'];
const axes = ['x', 'y', 'z'];
const hash = (value) => createHash('sha256').update(value).digest('hex');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const same = (left, right, message) =>
  assert(canonicalWorldJSON(left) === canonicalWorldJSON(right), message);
const bytes = async (blob) => Buffer.from(await blob.arrayBuffer());
const html = (value) => String(value).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function qualifyClearance(project, course, mode) {
  const notes = project.authoring.clearance;
  assert(notes.droneRadiusMm === course.rules.droneRadius, 'Clearance radius differs from rules');
  assert(notes.extraMarginMm === 500, 'Expected the authored 0.5 m nominal margin');
  const points = notes.nominalPaths[mode];
  assert(
    Array.isArray(points) && points.length >= 3 && points.length <= 128,
    'Invalid nominal path',
  );
  same(points[0], course.spawn, 'Nominal path must start at the course spawn');
  const expected = [course.spawn];
  for (const step of course.steps[mode]) {
    if (step.type === 'gate') {
      const center = {
        [step.axis]: step.at,
        [step.axis === 'x' ? 'z' : 'x']: (step.minSide + step.maxSide) / 2,
        y: (step.minY + step.maxY) / 2,
      };
      for (const offset of [-3000, 0, 3500])
        expected.push({ ...center, [step.axis]: step.at + offset * step.direction });
    } else {
      assert(['hold', 'land'].includes(step.type), 'Unsupported starter objective');
      expected.push(
        Object.fromEntries(
          axes.map((axis) => [
            axis,
            step.type === 'land' && axis === 'y'
              ? course.bounds.min.y
              : (step.min[axis] + step.max[axis]) / 2,
          ]),
        ),
      );
    }
  }
  same(points, expected, 'Nominal path metadata no longer matches the authored objectives');
  const collision = createWorldCollision(course);
  const radius = course.rules.droneRadius + notes.extraMarginMm;
  const grounded = (point) => point.y === course.bounds.min.y;
  const probe = (point, extra) => ({ ...point, y: point.y - extra });
  try {
    for (const [index, point] of points.entries()) {
      assert(
        axes.every((axis) => Number.isSafeInteger(point[axis])),
        'Nominal coordinates must be integer millimetres',
      );
      assert(
        ['x', 'z'].every(
          (axis) =>
            point[axis] - radius >= course.bounds.min[axis] &&
            point[axis] + radius <= course.bounds.max[axis],
        ) &&
          point.y >= course.bounds.min.y &&
          point.y + radius * 2 <= course.bounds.max.y,
        'Nominal route exceeds flight bounds with its margin',
      );
      assert(
        !grounded(point) || index === 0 || index === points.length - 1,
        'Only route endpoints may touch ground',
      );
      const extra = grounded(point) ? 0 : notes.extraMarginMm;
      assert(
        collision.clearSpawn(probe(point, extra), course.rules.droneRadius + extra),
        'Nominal route point intersects a collider',
      );
    }
    for (let i = 1; i < points.length; i++) {
      const start = points[i - 1];
      const end = points[i];
      const extra = grounded(start) || grounded(end) ? 0 : notes.extraMarginMm;
      const moved = collision.moveSphere(
        probe(start, extra),
        Object.fromEntries(axes.map((axis) => [axis, end[axis] - start[axis]])),
        course.rules.droneRadius + extra,
      );
      assert(
        moved.contacts.every((contact) => contact.id === '$floor' && end.y === course.bounds.min.y),
        `Nominal segment ${i} hits a collider: ${moved.contacts.map((c) => c.id).join(', ')}`,
      );
      assert(
        axes.every((axis) => Math.abs(moved.position[axis] - probe(end, extra)[axis]) <= 3),
        `Nominal segment ${i} does not reach its endpoint`,
      );
    }
    return {
      mode,
      points: points.length,
      segments: points.length - 1,
      airborneProbeRadiusMm: radius,
      groundEndpointSegmentsAtDroneRadius: 2,
      passed: true,
    };
  } finally {
    collision.dispose();
  }
}

async function qualifyFlight(course, mode, output) {
  const flight = createWorldFlight({ course, mode });
  const recorder = createWorldRecorder(flight, { session: 'authoring' });
  const memory = {};
  let state;
  try {
    flight.arm();
    state = flight.snapshot();
    while (state.status === 'active' && state.ticks < 15000) {
      const controls = adventureAuthoringPilot(state, course, memory, mode);
      state = flight.step(controls);
      recorder.record(controls);
    }
    const proof = recorder.export();
    const filename = `${course.id}-${mode}.proof.json`;
    const proofBytes = Buffer.from(canonicalWorldJSON(proof) + '\n');
    await writeFile(path.join(output, filename), proofBytes, { flag: 'wx' });
    assert(
      state.status === 'complete',
      `${course.id}/${mode}: ${state.status} at step ${state.step}`,
    );
    assert(state.contacts === 0, `${course.id}/${mode}: ${state.contacts} hard contacts`);
    const replay = await replayWorldFlight(course, proof);
    assert(replay.state.status === 'complete', `${course.id}/${mode}: replay is incomplete`);
    assert(
      worldStateIdentity(replay.state) === worldStateIdentity(state),
      'Independent replay differs',
    );
    return {
      mode,
      status: state.status,
      ticks: state.ticks,
      contacts: state.contacts,
      proof: { path: filename, sha256: hash(proofBytes), bytes: proofBytes.length },
      stateIdentity: worldStateIdentity(state),
      replayMatched: true,
    };
  } finally {
    flight.dispose();
  }
}

async function main() {
  let output = null;
  let fly = false;
  let only = null;
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === '--out' && process.argv[i + 1]) output = path.resolve(process.argv[++i]);
    else if (arg === '--fly') fly = true;
    else if (arg === '--id' && process.argv[i + 1]) only = process.argv[++i];
    else
      throw new Error(
        'Usage: node authoring/fpv-worlds/starters/build.mjs --out NEW_DIRECTORY [--fly] [--id PROJECT_ID]',
      );
  }
  assert(output && output !== ROOT && !output.startsWith(SOURCES), 'Choose a new output directory');
  const names = (await readdir(SOURCES)).filter((name) => name.endsWith('.json')).sort();
  assert(names.length === 10, 'Expected ten standalone starter project sources');
  const selected = only ? names.filter((name) => name === `${only}.json`) : names;
  assert(selected.length, 'Unknown starter ID');
  await mkdir(output, { recursive: false });
  await initWorldRuntime();
  const results = [];
  for (const name of selected) {
    const source = await readFile(path.join(SOURCES, name));
    const project = resolveProject(JSON.parse(source));
    assert(
      project.id + '.json' === name && project.courses.length === 1,
      'One course per project required',
    );
    assert(!project.world.modelAsset, 'Starter must reuse runtime scenery without packaged assets');
    const course = validateWorldCourse(project.courses[0]);
    assert(
      course.world.id === project.id && course.id === project.id + '-route',
      'Starter identity mismatch',
    );
    assert(course.revision === 'r1', 'Unexpected starter revision');
    const split = splitCourseDefinition(course, { layoutId: project.definitions.layouts[0].id });
    split.layout.spawn = structuredClone(course.spawn);
    const studioDefinitions = {
      worlds: [split.world],
      layouts: [split.layout],
      challenges: [split.challenge],
    };
    same(
      studioDefinitions,
      project.definitions,
      'Studio normalization changed authored definitions',
    );
    same(
      compileContentProject(studioDefinitions).map((row) => row.course),
      project.courses,
      'Studio compilation changed courses',
    );
    assert(
      canonicalWorldJSON(course.steps.acro) !== canonicalWorldJSON(course.steps['self-level']),
      'Starter routes must differ by mode',
    );
    const zip = await bytes(await exportEditableZip(project));
    const pack = await bytes(await preparePack(project));
    const zipped = await importEditableZip(new Blob([zip]));
    const packed = await inspectPack(new Blob([pack]));
    same(zipped.project, project, 'Editable ZIP changed the project');
    same(packed.project, project, 'World pack changed the project');
    assert(!zipped.assets.size && !packed.assets.size, 'Unexpected asset in starter');
    assert(
      zip.equals(await bytes(await exportEditableZip(zipped.project))),
      'ZIP is not reproducible',
    );
    assert(pack.equals(await bytes(await preparePack(packed.project))), 'Pack is not reproducible');
    const compiled = Buffer.from(canonicalWorldJSON(project) + '\n');
    const artifacts = {};
    for (const [extension, data] of [
      ['zip', zip],
      ['rlpack', pack],
      ['project.json', compiled],
    ]) {
      const filename = `${project.id}.${extension}`;
      await writeFile(path.join(output, filename), data, { flag: 'wx' });
      artifacts[extension] = { path: filename, sha256: hash(data), bytes: data.length };
    }
    const clearance = modes.map((mode) => qualifyClearance(project, course, mode));
    const flights = [];
    if (fly) for (const mode of modes) flights.push(await qualifyFlight(course, mode, output));
    results.push({
      id: project.id,
      title: project.authoring.title,
      source: {
        path: `authoring/fpv-worlds/starters/projects/${name}`,
        sha256: hash(source),
        bytes: source.length,
      },
      artifacts,
      clearance,
      flights,
    });
    console.log(
      `${project.id}: ZIP/pack round trips, nominal clearance${fly ? ', both-mode replay' : ''}`,
    );
  }
  const receipt = {
    format: 'FPVCreatorStarterQualification.v1',
    passed: true,
    projects: results.length,
    archiveRoundTrips: results.length * 2,
    reproducibleArchives: results.length * 2,
    stableStudioDefinitionSplits: results.length,
    nominalRoutes: results.length * 2,
    completedReplays: results.reduce((n, r) => n + r.flights.length, 0),
    runtimeSourceBytesAdded: 0,
    limitsChanged: false,
    browserQualification: 'pending',
    verificationSources: await Promise.all(
      [
        'authoring/fpv-worlds/starters/build.mjs',
        'scripts/qualify-fpv-adventures.mjs',
        'optional-practice/civilian-fpv/world-model.mjs',
        'optional-practice/civilian-fpv/world-collision.mjs',
        'optional-practice/civilian-fpv/content-definitions.mjs',
        'optional-practice/civilian-fpv/world-content.mjs',
        'optional-practice/civilian-fpv/world-zip.mjs',
      ].map(async (relative) => ({
        path: relative,
        sha256: hash(await readFile(path.join(ROOT, relative))),
      })),
    ),
    limitations: [
      'Nominal swept paths are guidance, not clearance guarantees for other flight lines.',
      'Airborne probes expand the sphere by 0.5 m around its original center. Takeoff/landing segments use the actual drone radius; floor contact is allowed only at landing.',
      'Current spatial editing targets Self-level when routes differ; Acro remains editable in Challenge JSON.',
      'No physical-device, novice, performance or complete D4 acceptance is claimed.',
    ],
    results,
  };
  await writeFile(
    path.join(output, 'qualification.json'),
    JSON.stringify(receipt, null, 2) + '\n',
    { flag: 'wx' },
  );
  await writeFile(
    path.join(output, 'index.html'),
    `<!doctype html><meta charset="utf-8"><title>FPV creator starters</title><h1>FPV creator starters · Шаблони маршрутів FPV</h1><p>Download an editable ZIP. In FPV World Studio, open World packs → Import .rlpack / editable project, then Edit. Current spatial controls edit Self-level; edit the independent Acro route in Challenge JSON.</p><p>Завантажте редагований ZIP. У FPV World Studio відкрийте Пакунки світів → Імпорт .rlpack / редагованого проєкту, потім Редагувати. Просторові засоби змінюють самовирівнювання; окремий маршрут Acro редагуйте в JSON завдання.</p><ul>${results.map((r) => `<li>${html(r.title.en)} / ${html(r.title.uk)}: <a download href="${html(r.artifacts.zip.path)}">Editable ZIP</a> · <a download href="${html(r.artifacts.rlpack.path)}">World pack</a></li>`).join('')}</ul><p>Nominal clearance and archive checks passed. Browser qualification remains pending. Перевірки номінального запасу та архівів пройдено. Перевірка в браузері ще очікується.</p>\n`,
    { flag: 'wx' },
  );
  console.log(
    JSON.stringify({
      output,
      projects: receipt.projects,
      completedReplays: receipt.completedReplays,
    }),
  );
}

main().catch((error) => {
  console.error(error.stack ?? error);
  process.exitCode = 1;
});

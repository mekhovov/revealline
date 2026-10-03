#!/usr/bin/env node
/** Qualify an exported creator course/project/pack with ordinary controls and independent replay. */
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { adventureAuthoringPilot } from './qualify-fpv-adventures.mjs';
import {
  initWorldRuntime,
  validateWorldCourse,
  createWorldFlight,
  createWorldRecorder,
  replayWorldFlight,
  worldStateIdentity,
} from '../optional-practice/civilian-fpv/world-model.mjs';
import { inspectPack } from '../optional-practice/civilian-fpv/world-content.mjs';
import { importEditableZip } from '../optional-practice/civilian-fpv/world-zip.mjs';
import { compileContentProject } from '../optional-practice/civilian-fpv/content-definitions.mjs';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function main() {
  let input = null,
    out = null,
    pilot = 'route';
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && args[i + 1]) input = args[++i];
    else if (args[i] === '--out' && args[i + 1]) out = args[++i];
    else if (args[i] === '--pilot' && args[i + 1]) pilot = args[++i];
    else if (args[i] === '--help') {
      console.log(
        'Usage: node scripts/qualify-fpv-tracking-editor.mjs --input exported-course.json|project.zip|pack.rlpack|browser-receipt.json --out NEW_DIRECTORY [--pilot route|hover]\nConsumes the actual export. Never installs content or overwrites previous receipts. Hover is the bounded airborne original-GLB fixture pilot; route uses the existing ordinary-command authoring pilot.',
      );
      return;
    } else throw Error('Unknown/incomplete option: ' + args[i]);
  }
  if (!input || !out || !['route', 'hover'].includes(pilot))
    throw Error('Provide --input, --out and optional --pilot route|hover.');
  input = path.resolve(input);
  out = path.resolve(out);
  if ((await stat(input)).size > 16 * 1024 * 1024)
    throw Error('Input exceeds 16 MiB qualification bound.');
  const bytes = await readFile(input);
  let courses, project;
  if (/\.zip$/i.test(input)) project = (await importEditableZip(new Blob([bytes]))).project;
  else if (/\.rlpack$/i.test(input)) project = (await inspectPack(new Blob([bytes]))).project;
  else {
    const value = JSON.parse(bytes.toString('utf8'));
    if (value.format === 'FPVTrackingEditorBrowserEvidence.v1') {
      if (value.status !== 'passed' || !value.authoredCourse)
        throw Error('Browser receipt must pass and include authoredCourse.');
      courses = [value.authoredCourse];
    } else if (value.format === 'FlightCourse.v2') courses = [value];
    else project = value;
  }
  if (project) {
    const compiled = project.definitions
      ? compileContentProject(project.definitions).map((row) => row.course)
      : project.courses;
    if (!Array.isArray(compiled) || !compiled.length || compiled.length > 16)
      throw Error('Expected 1–16 project courses.');
    courses = compiled;
  }
  courses = courses.map(validateWorldCourse);
  if (
    !courses.some((c) =>
      Object.values(c.steps).some((steps) => steps.some((s) => s.type === 'actor-track-v1')),
    )
  )
    throw Error('Export contains no tracking objective.');
  await mkdir(out, { recursive: false });
  await initWorldRuntime();
  const results = [];
  for (const course of courses)
    for (const mode of ['self-level', 'acro']) {
      const flight = createWorldFlight({ course, mode });
      flight.arm();
      const recorder = createWorldRecorder(flight, { session: 'authoring' }),
        memory = {};
      let state = flight.snapshot();
      try {
        while (state.status === 'active' && state.ticks < Math.min(course.rules.maxTicks, 18000)) {
          const controls =
            pilot === 'hover'
              ? {
                  roll: 0,
                  pitch: 0,
                  yaw: 0,
                  throttle:
                    state.target?.type === 'land'
                      ? state.grounded
                        ? 0
                        : Math.max(0, Math.min(1, (9810 + 2 * (-600 - state.velocity.y)) / 19620))
                      : 0.5,
                  actions: 0,
                }
              : adventureAuthoringPilot(state, course, memory, mode);
          state = flight.step(controls);
          recorder.record();
        }
        const proof = recorder.export(),
          played = await replayWorldFlight(course, proof, { yieldControl: async () => {} }),
          identity = worldStateIdentity(state),
          file = `${course.id}-${mode}.json`,
          text = JSON.stringify(proof) + '\n';
        await writeFile(path.join(out, file), text, { flag: 'wx' });
        results.push({
          course: course.id,
          mode,
          passed: state.status === 'complete' && worldStateIdentity(played.state) === identity,
          status: state.status,
          ticks: state.ticks,
          step: state.step,
          contacts: state.contacts,
          trackingCriteria: course.steps[mode].filter((s) => s.type === 'actor-track-v1').length,
          finalStateIdentity: identity,
          proofSha256: hash(text),
          proof: file,
        });
      } finally {
        flight.dispose();
      }
    }
  const paths = [
    'optional-practice/civilian-fpv/world-model.mjs',
    'optional-practice/civilian-fpv/world-actor-editor.mjs',
    'optional-practice/civilian-fpv/world-app.mjs',
    'optional-practice/civilian-fpv/world-content.mjs',
    'optional-practice/civilian-fpv/content-definitions.mjs',
    'scripts/qualify-fpv-tracking-editor.mjs',
    'scripts/qualify-fpv-adventures.mjs',
  ];
  const sources = Object.fromEntries(
    await Promise.all(paths.map(async (p) => [p, hash(await readFile(path.join(ROOT, p)))])),
  );
  const receipt = {
    format: 'FPVTrackingEditorFunctionalEvidence.v1',
    status: results.every((r) => r.passed) ? 'passed' : 'failed',
    inputSha256: hash(bytes),
    pilot,
    sources,
    results,
    scope:
      'Actual exported course/project/pack or passed browser receipt; canonical ordinary flight commands, independently verified replay. No player acceptance, physical-input, performance or new unit coverage claim.',
  };
  await writeFile(path.join(out, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n', {
    flag: 'wx',
  });
  console.log(
    JSON.stringify({
      status: receipt.status,
      passed: results.filter((r) => r.passed).length,
      total: results.length,
      receipt: path.join(out, 'receipt.json'),
    }),
  );
  if (receipt.status === 'failed') process.exitCode = 1;
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

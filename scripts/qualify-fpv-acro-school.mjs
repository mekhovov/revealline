#!/usr/bin/env node
// Offline authoring pilot: only ordinary commands advance the unchanged runtime.
// This produces replayable evidence, not a player autopilot or a unit-test suite.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { dataIdentity } from '../game/data-json.mjs';
import {
  BEGINNER_LESSONS,
  BEGINNER_CATALOGUE,
  ACRO_LESSON_ORDER,
} from '../optional-practice/civilian-fpv/world-catalogue.mjs';
import {
  createWorldFlight,
  createWorldRecorder,
  initWorldRuntime,
  replayWorldFlight,
  worldStateIdentity,
  validateWorldCourse,
} from '../optional-practice/civilian-fpv/world-model.mjs';
import {
  exportProofParts,
  importProofPart,
  worldRecordIdentity,
} from '../optional-practice/civilian-fpv/world-records.mjs';
import {
  DEFAULT_RESPONSE,
  responseCurve,
} from '../optional-practice/civilian-fpv/radio-profile.mjs';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const difference = (a, b) => ((a - b + 54000) % 36000) - 18000;
const digest = (value) => createHash('sha256').update(value).digest('hex');
const centre = (target) =>
  Object.fromEntries(['x', 'y', 'z'].map((key) => [key, (target.min[key] + target.max[key]) / 2]));
function rateInput(rate) {
  const shaped = clamp(rate / (DEFAULT_RESPONSE.maxRate * 100), -1, 1) * 1000;
  let lo = -1000,
    hi = 1000;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (responseCurve(mid, DEFAULT_RESPONSE.expo) < shaped) lo = mid + 1;
    else hi = mid;
  }
  return lo / 1000;
}
export function schoolAuthoringPilot(state, course, memory, mode = 'acro') {
  const target = state.target;
  if (!target) return { roll: 0, pitch: 0, yaw: 0, throttle: 0, actions: 0 };
  if (memory.step !== state.step) {
    memory.step = state.step;
    memory.start = state.ticks;
    memory.gateApproach = false;
    memory.tiltReleased = false;
  }
  let position;
  if (target.type === 'gate') {
    const side = (target.minSide + target.maxSide) / 2;
    const axis = target.axis;
    const lateral = axis === 'x' ? 'z' : 'x';
    if (
      Math.abs(state.position[lateral] - side) < 1800 &&
      Math.abs(state.position.y - (target.minY + target.maxY) / 2) < 1000
    )
      memory.gateApproach = true;
    position = {
      [axis]: target.at + (memory.gateApproach ? 3500 : -2500) * target.direction,
      [lateral]: side,
      y: (target.minY + target.maxY) / 2,
    };
  } else position = centre(target);
  if (target.type === 'land') {
    let surfaceY = course.bounds?.min?.y ?? 0;
    if (target.surface && target.surface !== '$floor') {
      const surface = course.obstacles.find((obstacle) => obstacle.id === target.surface);
      if (
        !surface ||
        (surface.type && surface.type !== 'box') ||
        surface.rotation?.slice(0, 3).some((value) => value !== 0) ||
        !Number.isFinite(surface.max?.y)
      )
        throw new Error(
          `Authoring pilot needs an axis-aligned named landing surface: ${target.surface}`,
        );
      surfaceY = surface.max.y;
    }
    // Aim just below physical support so descent settles onto the surface.
    // Existing floor courses retain their exact -100 mm command target.
    position.y = surfaceY - 100;
  }
  if (target.centred && target.max.y <= 800 && state.step === 0) position.y = 0;
  const yaw = (state.attitude.yaw * Math.PI) / 18000;
  const ax = clamp((position.x - state.position.x) * 0.8 - state.velocity.x * 1.9, -2600, 2600);
  const az = clamp((position.z - state.position.z) * 0.8 - state.velocity.z * 1.9, -2600, 2600);
  let roll = (Math.atan2(ax * Math.cos(yaw) + az * Math.sin(yaw), 9810) * 18000) / Math.PI;
  let pitch = (Math.atan2(ax * Math.sin(yaw) - az * Math.cos(yaw), 9810) * 18000) / Math.PI;
  // Deliberate short tilt phase followed by centred axes satisfies the same
  // rate/attitude objective a learner sees. No state or objective is patched.
  const tiltExercise = target.minTilt > 0;
  if (tiltExercise) {
    // Self-level returns toward the horizon after release. Start near the
    // authored upper bound so its real transient remains inside the same
    // centred-control dwell window; Acro commands stay byte-for-byte unchanged.
    const wanted =
      mode === 'self-level' ? target.maxTilt - 40 : (target.minTilt + target.maxTilt) / 2;
    roll = course.id === 'beginner-25' ? wanted : 0;
    pitch = course.id === 'beginner-25' ? 0 : wanted;
  }
  let heading = target.heading ?? memory.heading ?? 0;
  if (target.type === 'gate')
    heading = target.axis === 'x' ? target.direction * 9000 : target.direction < 0 ? 0 : 18000;
  memory.heading = heading;
  const angleRate = (key, wanted) =>
    (wanted - state.attitude[key]) * 4.2 - state.angular[key] * 0.8;
  const input = {
    roll: rateInput(
      mode === 'self-level'
        ? (roll / (DEFAULT_RESPONSE.maxTilt * 100)) * DEFAULT_RESPONSE.maxRate * 100
        : angleRate('roll', roll),
    ),
    pitch: rateInput(
      mode === 'self-level'
        ? (pitch / (DEFAULT_RESPONSE.maxTilt * 100)) * DEFAULT_RESPONSE.maxRate * 100
        : angleRate('pitch', pitch),
    ),
    yaw: rateInput(difference(heading, state.attitude.yaw) * 2.8 - state.angular.yaw * 0.65),
    throttle: clamp(
      (9810 + clamp((position.y - state.position.y) * 1.7 - state.velocity.y * 2.7, -4500, 4500)) /
        (19620 * Math.max(0.3, state.attitude.up.y / 1000000)),
      0,
      0.9,
    ),
    actions: 0,
  };
  if (tiltExercise) {
    const tilt = Math.max(Math.abs(state.attitude.roll), Math.abs(state.attitude.pitch));
    if (mode === 'self-level') {
      if (tilt >= target.maxTilt - 100) memory.tiltReleased = true;
      if (memory.tiltReleased && tilt < target.minTilt) memory.tiltReleased = false;
      if (memory.tiltReleased) input.roll = input.pitch = input.yaw = 0;
    } else if (tilt >= target.minTilt + 100) input.roll = input.pitch = input.yaw = 0;
  }
  if (
    (target.type === 'land' || (state.step === 0 && target.centred && target.max.y <= 800)) &&
    state.grounded
  )
    input.throttle = 0;
  return input;
}

export async function qualifyAcroSchool({
  output,
  ids = ACRO_LESSON_ORDER,
  diagnostic = false,
  installDemonstrations = false,
  recommendedModes = false,
  mode: requestedMode,
  proofArchive = false,
} = {}) {
  if (requestedMode !== undefined && !['acro', 'self-level'].includes(requestedMode))
    throw new Error('Explicit mode must be acro or self-level.');
  if (requestedMode !== undefined && recommendedModes)
    throw new Error('Choose an explicit mode or recommended modes, not both.');
  if (proofArchive && !output) throw new Error('Proof archive export requires --output.');
  if (installDemonstrations && (requestedMode !== undefined || proofArchive))
    throw new Error(
      'Explicit-mode recordings are optional archives; core registry installation is disabled.',
    );
  await initWorldRuntime();
  const results = [],
    demonstrations = [];
  for (const id of ids) {
    const lesson = BEGINNER_LESSONS.find((value) => value.id === id);
    if (!lesson) throw new Error(`Unknown lesson: ${id}`);
    const mode = requestedMode ?? (recommendedModes ? lesson.mode : 'acro');
    const flight = createWorldFlight({
      course: lesson.course,
      mode,
      response: DEFAULT_RESPONSE,
    });
    const recorder = createWorldRecorder(flight, { session: 'demonstration' });
    const memory = {};
    flight.arm();
    let state = flight.snapshot(),
      previousStep = -1;
    while (state.status === 'active' && state.ticks < 15000) {
      if (diagnostic && state.step !== previousStep) {
        console.error(
          JSON.stringify({
            id,
            step: state.step,
            tick: state.ticks,
            position: state.position,
            attitude: state.attitude,
          }),
        );
        previousStep = state.step;
      }
      const input = schoolAuthoringPilot(state, lesson.course, memory, mode);
      state = flight.step(input);
      recorder.record();
    }
    if (state.status !== 'complete') {
      flight.dispose();
      throw new Error(
        `${id} failed: ${JSON.stringify({ status: state.status, step: state.step, position: state.position, velocity: state.velocity, attitude: state.attitude, target: state.target })}`,
      );
    }
    if (state.contacts !== 0 || state.health !== state.maxHealth) {
      flight.dispose();
      throw new Error(`${id} completed with contacts or lost health`);
    }
    const proof = recorder.export();
    const replay = await replayWorldFlight(lesson.course, proof, { yieldControl: async () => {} });
    if (
      replay.state.status !== 'complete' ||
      worldStateIdentity(replay.state) !== proof.finalStateIdentity
    )
      throw new Error(`${id} independent replay did not complete identically`);
    const entry = BEGINNER_CATALOGUE.find((value) => value.id === id);
    const result = {
      id,
      mode,
      status: state.status,
      ticks: state.ticks,
      contacts: state.contacts,
      health: state.health,
      packIdentity: entry.packIdentity,
      finalStateIdentity: proof.finalStateIdentity,
      proofSha256: digest(JSON.stringify(proof)),
    };
    results.push(result);
    demonstrations.push({
      id,
      packIdentity: entry.packIdentity,
      sourceIdentity: dataIdentity(validateWorldCourse(lesson.course)),
      proof,
    });
    console.log(JSON.stringify(result));
    flight.dispose();
  }
  const archiveParts = [];
  if (proofArchive) {
    const records = demonstrations.map(({ id, packIdentity, proof }) => {
      const course = validateWorldCourse(
        BEGINNER_LESSONS.find((lesson) => lesson.id === id).course,
      );
      return {
        id: worldRecordIdentity({ course, proof }),
        course,
        proof,
        packIdentity,
        status: 'verified',
        diagnostic: 'complete',
        savedAt: 0,
        pinned: false,
      };
    });
    for (const part of await exportProofParts(records)) {
      const text = JSON.stringify(part);
      const imported = await importProofPart(text);
      for (const record of imported) {
        if (record.status !== 'missing-dependency')
          throw new Error('Imported archive must not trust its exported verification flag.');
        const replay = await replayWorldFlight(record.course, record.proof, {
          yieldControl: async () => {},
        });
        if (
          replay.state.status !== 'complete' ||
          worldStateIdentity(replay.state) !== record.proof.finalStateIdentity
        )
          throw new Error(
            `${record.course.id} archive round-trip replay did not complete identically`,
          );
      }
      archiveParts.push({ part, text, records: imported.length });
    }
  }
  const outputStem = requestedMode
    ? `fpv-school-${requestedMode}`
    : recommendedModes
      ? 'fpv-school'
      : 'fpv-acro-school';
  const receipt = {
    format:
      requestedMode || recommendedModes
        ? 'FPVSchoolPhysicsEvidence.v1'
        : 'FPVAcroSchoolPhysicsEvidence.v1',
    ...(requestedMode ? { mode: requestedMode } : {}),
    source: {
      path: 'optional-practice/civilian-fpv/world-catalogue.mjs',
      sha256: digest(
        await readFile(
          new URL('../optional-practice/civilian-fpv/world-catalogue.mjs', import.meta.url),
        ),
      ),
    },
    ...(requestedMode || proofArchive
      ? {
          sources: Object.fromEntries(
            await Promise.all(
              [
                'scripts/qualify-fpv-acro-school.mjs',
                'optional-practice/civilian-fpv/world-model.mjs',
                'optional-practice/civilian-fpv/world-records.mjs',
                'optional-practice/civilian-fpv/radio-profile.mjs',
              ].map(async (file) => [
                file,
                digest(await readFile(new URL('../' + file, import.meta.url))),
              ]),
            ),
          ),
        }
      : {}),
    response: DEFAULT_RESPONSE,
    method:
      'Offline pilot supplies normalized commands to the unchanged 50 Hz runtime; each exported demonstration is independently replayed against exact course and response. No state or course advancement is injected.',
    summary: {
      lessons: results.length,
      completed: results.length,
      independentlyReplayed: results.length,
      ...(proofArchive
        ? { archiveRoundTripReplayed: archiveParts.reduce((n, part) => n + part.records, 0) }
        : {}),
    },
    archives: archiveParts.map(({ part, text, records }) => ({
      file: `${outputStem}-proof-part-${part.part}-of-${part.parts}.json`,
      format: part.format,
      part: part.part,
      parts: part.parts,
      records,
      bytes: Buffer.byteLength(text + '\n'),
      archiveId: part.archiveId,
      payloadSha256: part.sha256,
      fileSha256: digest(text + '\n'),
    })),
    limitations: [
      'Controlled-input reachability is not novice usability or physical-radio acceptance.',
      'Unit coverage remains deferred. Public deployment and hardware performance are separate gates.',
    ],
    results,
  };
  if (output) {
    await mkdir(output, { recursive: true });
    await writeFile(
      resolve(
        output,
        requestedMode
          ? `${outputStem}-physics.json`
          : recommendedModes
            ? 'fpv-school-physics.json'
            : 'fpv-acro-school-physics-20261001.json',
      ),
      `${JSON.stringify(receipt, null, 2)}\n`,
      ...(requestedMode || proofArchive ? [{ flag: 'wx' }] : []),
    );
    await writeFile(
      resolve(
        output,
        requestedMode
          ? `${outputStem}-demonstrations.json`
          : recommendedModes
            ? 'fpv-school-demonstrations.json'
            : 'fpv-acro-school-demonstrations-20261001.json',
      ),
      `${JSON.stringify({ format: requestedMode ? 'FPVSchoolDemonstrations.v1' : 'FPVAcroDemonstrations.v1', demonstrations })}\n`,
      ...(requestedMode || proofArchive ? [{ flag: 'wx' }] : []),
    );
    for (const [index, archive] of archiveParts.entries())
      await writeFile(resolve(output, receipt.archives[index].file), archive.text + '\n', {
        flag: 'wx',
      });
  }
  if (installDemonstrations) {
    if (recommendedModes)
      throw new Error(
        'Use the emitted data file to append separately reviewed curriculum recordings.',
      );
    if (
      ids.length !== ACRO_LESSON_ORDER.length ||
      !ACRO_LESSON_ORDER.every((id) => ids.includes(id))
    )
      throw new Error('Install requires the complete primary curriculum.');
    const destination = new URL(
      '../optional-practice/civilian-fpv/world-demonstrations.mjs',
      import.meta.url,
    );
    const marker =
      '\n// Additive Acro school demonstrations. Generated by qualify-fpv-acro-school.mjs.\n';
    const source = await readFile(destination, 'utf8');
    const split = source.indexOf(marker);
    const prior = (split < 0 ? source : source.slice(0, split)).trimEnd();
    // Replace only this generated statement; retain later curriculum sections.
    const tail = split < 0 ? '' : source.slice(source.indexOf(');', split) + 2).trim();
    const rows = demonstrations.map(({ sourceIdentity, proof }) => ({ sourceIdentity, proof }));
    await writeFile(
      destination,
      `${prior}${marker}// prettier-ignore\nWORLD_DEMONSTRATIONS.push(...${JSON.stringify(rows)});\n${tail ? '\n' + tail + '\n' : ''}`,
    );
  }
  return receipt;
}
if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? '')).href) {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log(
      'Usage: node scripts/qualify-fpv-acro-school.mjs [--mode acro|self-level] [--proof-archive --output NEW_DIRECTORY] [--lesson ID | --all | --self-level] [--diagnostic]\nDefault: fourteen primary Acro lessons. --self-level selects the twelve optional Self-level lessons; --mode selects actual flight mode. Explicit-mode archives never modify the core registry and do not overwrite existing artifacts.',
    );
    process.exit(0);
  }
  const valueFlags = new Set(['--output', '--lesson', '--mode']),
    toggleFlags = new Set([
      '--all',
      '--self-level',
      '--diagnostic',
      '--proof-archive',
      '--install-demonstrations',
    ]),
    seen = new Set();
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if ((!valueFlags.has(flag) && !toggleFlags.has(flag)) || seen.has(flag))
      throw new Error(`Unknown or repeated option: ${flag}`);
    seen.add(flag);
    if (valueFlags.has(flag) && (!args[++index] || args[index].startsWith('--')))
      throw new Error(`${flag} requires a value.`);
  }
  if (['--lesson', '--all', '--self-level'].filter((flag) => seen.has(flag)).length > 1)
    throw new Error('Choose one lesson selection option.');
  const requestedMode = args.includes('--mode') ? args[args.indexOf('--mode') + 1] : undefined;
  if (args.includes('--mode') && !['acro', 'self-level'].includes(requestedMode))
    throw new Error('--mode requires acro or self-level.');
  if (
    args.includes('--output') &&
    (!args[args.indexOf('--output') + 1] || args[args.indexOf('--output') + 1].startsWith('--'))
  )
    throw new Error('--output requires a directory.');
  const output = args.includes('--output')
    ? resolve(args[args.indexOf('--output') + 1])
    : undefined;
  const ids = args.includes('--lesson')
    ? [args[args.indexOf('--lesson') + 1]]
    : args.includes('--all')
      ? BEGINNER_LESSONS.map((lesson) => lesson.id)
      : args.includes('--self-level')
        ? BEGINNER_LESSONS.filter((lesson) => lesson.mode === 'self-level').map(
            (lesson) => lesson.id,
          )
        : ACRO_LESSON_ORDER;
  await qualifyAcroSchool({
    output,
    ids,
    diagnostic: args.includes('--diagnostic'),
    recommendedModes:
      requestedMode === undefined && (args.includes('--all') || args.includes('--self-level')),
    mode: requestedMode,
    proofArchive: args.includes('--proof-archive'),
    installDemonstrations: args.includes('--install-demonstrations'),
  });
}

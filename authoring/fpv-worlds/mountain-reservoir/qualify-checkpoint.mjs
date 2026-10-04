#!/usr/bin/env node
// Manual functional authoring qualification, not a unit suite or a shipped autopilot.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { adventureAuthoringPilot } from '../../../scripts/qualify-fpv-adventures.mjs';
import {
  initWorldRuntime,
  createWorldFlight,
  createWorldRecorder,
  replayWorldFlight,
  worldStateIdentity,
  validateWorldCourse,
} from '../../../optional-practice/civilian-fpv/world-model.mjs';
import { createWorldCollision } from '../../../optional-practice/civilian-fpv/world-collision.mjs';
import {
  inspectPack,
  canonicalWorldJSON,
} from '../../../optional-practice/civilian-fpv/world-content.mjs';
import {
  worldRecordIdentity,
  exportProofParts,
  importProofPart,
} from '../../../optional-practice/civilian-fpv/world-records.mjs';
const [packArg, outArg] = process.argv.slice(2);
if (!packArg || !outArg) throw Error('Use EXACT_CHECKPOINT_PACK NEW_PROOF_DIRECTORY');
const output = path.resolve(outArg),
  hash = (b) => createHash('sha256').update(b).digest('hex');
await mkdir(output);
const packBytes = await readFile(packArg),
  inspected = await inspectPack(new Blob([packBytes])),
  project = inspected.project;
if (project.courses.length !== 1 || project.courses[0].id !== 'mountain-reservoir-01')
  throw Error('Only the first shoreline checkpoint is supported');
const course = validateWorldCourse(project.courses[0]),
  checks = [],
  modes = [],
  records = [];
const receipt = {
  format: 'FPVMountainReservoirCheckpointFlights.v1',
  pack: {
    path: path.resolve(packArg),
    bytes: packBytes.length,
    sha256: hash(packBytes),
    identity: 'fpv-pack:' + inspected.sha256,
  },
  checks,
  modes,
  status: 'running',
  scope:
    'One course/two modes; ordinary controls through unchanged runtime, independent complete and archive-import replays. No eight-course delivery, native browser, offline or hardware claim.',
};
async function save() {
  await writeFile(path.join(output, 'qualification.json'), JSON.stringify(receipt, null, 2) + '\n');
}
function check(name, passed, detail) {
  checks.push({ name, passed: !!passed, ...(detail ? { detail } : {}) });
  if (!passed) throw Error(name);
}
try {
  await initWorldRuntime();
  const collision = createWorldCollision(course);
  try {
    check(
      'Shore pad spawn has physical support',
      collision.support(course.spawn, course.rules.droneRadius, 5)?.id === 'platform-shore-pad',
    );
    check(
      'Closed maintenance hut rejects interior spawn',
      !collision.clearSpawn({ x: -36000, y: 1000, z: -13000 }, course.rules.droneRadius),
    );
    check(
      'Dam solid rejects interior spawn',
      !collision.clearSpawn({ x: 0, y: 5000, z: -28000 }, course.rules.droneRadius),
    );
    const points = [
      [-30, 2.7, 26],
      [-30, 3.8, 24],
      [-10, 5, 15],
      [-10, 7, -12],
      [-30, 7, 26],
      [-30, 2.7, 26],
    ].map((p) => Object.fromEntries(['x', 'y', 'z'].map((k, i) => [k, p[i] * 1000])));
    const radius = course.rules.droneRadius + 500;
    for (let i = 0; i < points.length; i++) {
      const from = { ...points[i], y: points[i].y - 500 };
      check(
        'Nominal airborne point ' + i + ' retains 0.5m extra margin',
        collision.clearSpawn(from, radius),
      );
      if (i) {
        const prev = { ...points[i - 1], y: points[i - 1].y - 500 },
          delta = Object.fromEntries(['x', 'y', 'z'].map((k) => [k, from[k] - prev[k]]));
        const moved = collision.moveSphere(prev, delta, radius);
        check(
          'Nominal airborne segment ' + i + ' retains swept margin',
          !moved.contacts.length &&
            ['x', 'y', 'z'].every((k) => Math.abs(moved.position[k] - from[k]) <= 3),
          { contacts: moved.contacts },
        );
      }
    }
    check(
      'Reservoir starts beyond the visible rail and first eastern bound',
      course.bounds.max.x === 6000 && project.authoring.visualBoundary.includes('x=8m'),
    );
  } finally {
    collision.dispose();
  }
  for (const mode of ['self-level', 'acro']) {
    const flight = createWorldFlight({ course, mode }),
      recorder = createWorldRecorder(flight, { session: 'demonstration' }),
      memory = {},
      milestones = [];
    try {
      flight.arm();
      let state = flight.snapshot(),
        lastStep = -1;
      while (state.status === 'active' && state.ticks < 15000) {
        if (state.step !== lastStep) {
          lastStep = state.step;
          milestones.push({ step: state.step, tick: state.ticks, position: state.position });
        }
        const controls = adventureAuthoringPilot(state, course, memory, mode);
        state = flight.step(controls);
        recorder.record(controls);
      }
      const proof = recorder.export(),
        bytes = Buffer.from(canonicalWorldJSON(proof) + '\n'),
        filename = 'mountain-reservoir-01-' + mode + '.proof.json';
      await writeFile(path.join(output, filename), bytes, { flag: 'wx' });
      const row = {
        mode,
        status: state.status,
        ticks: state.ticks,
        contacts: state.contacts,
        health: state.health,
        terminalSupport: state.support?.id,
        position: state.position,
        milestones,
        proof: { path: filename, bytes: bytes.length, sha256: hash(bytes) },
        finalStateIdentity: worldStateIdentity(state),
      };
      modes.push(row);
      await save();
      check(
        mode + ' completes all four ordinary objectives',
        state.status === 'complete' && state.step === 4,
      );
      check(
        mode + ' has no contacts and full health',
        state.contacts === 0 && state.health === course.rules.playerHealth,
      );
      check(
        mode + ' lands on the actual named shore pad',
        state.support?.id === 'platform-shore-pad',
      );
      const replay = await replayWorldFlight(course, proof, { sampleEvery: 50 });
      check(
        mode + ' independent replay is terminal-state exact',
        replay.state.status === 'complete' &&
          worldStateIdentity(replay.state) === worldStateIdentity(state),
      );
      row.path = replay.path;
      const record = {
        course,
        proof,
        status: 'verified',
        diagnostic: 'complete',
        packIdentity: receipt.pack.identity,
        savedAt: 0,
      };
      record.id = worldRecordIdentity(record);
      records.push(record);
    } finally {
      flight.dispose();
    }
  }
  const parts = await exportProofParts(records);
  check(
    'Checkpoint optional archive contains exactly two original modes',
    parts.length === 1 && parts[0].records.length === 2,
  );
  const archive = Buffer.from(canonicalWorldJSON(parts[0]) + '\n'),
    filename = 'mountain-reservoir-checkpoint-r1-proof-part-1-of-1.json';
  await writeFile(path.join(output, filename), archive, { flag: 'wx' });
  for (const record of await importProofPart(archive.toString())) {
    check(
      record.proof.mode + ' imported proof is untrusted until verification',
      record.status === 'missing-dependency' && record.packIdentity === receipt.pack.identity,
    );
    const replay = await replayWorldFlight(record.course, record.proof);
    check(
      record.proof.mode + ' imported proof independently completes exactly',
      replay.state.status === 'complete' &&
        worldStateIdentity(replay.state) === record.proof.finalStateIdentity,
    );
  }
  receipt.archive = { path: filename, bytes: archive.length, sha256: hash(archive) };
  receipt.status = 'passed';
  await save();
  console.log(
    JSON.stringify(
      {
        status: receipt.status,
        checks: checks.length,
        modes: modes.map(({ mode, ticks, contacts, health }) => ({
          mode,
          ticks,
          contacts,
          health,
        })),
        archive: receipt.archive,
      },
      null,
      2,
    ),
  );
} catch (error) {
  receipt.status = 'failed';
  receipt.error = error.stack;
  await save();
  throw error;
}

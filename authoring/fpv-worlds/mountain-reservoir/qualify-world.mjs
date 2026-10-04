#!/usr/bin/env node
// Manual content qualification through ordinary controls. No unit suite or shipped pilot.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { canonicalJSON } from '../../../game/data-json.mjs';
import { adventureAuthoringPilot } from '../../../scripts/qualify-fpv-adventures.mjs';
import {
  initWorldRuntime,
  createWorldFlight,
  createWorldRecorder,
  replayWorldFlight,
  worldStateIdentity,
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
import { colliderFromAnchor } from '../../../optional-practice/civilian-fpv/world-app.mjs';
import {
  Quaternion,
  Vector3,
} from '../../../optional-practice/civilian-fpv/vendor/three.module.js';

const [packArg, outputArg, option] = process.argv.slice(2);
if (!packArg || !outputArg || (option && option !== '--clearance-only'))
  throw Error('Use EXACT_PACK NEW_OUTPUT [--clearance-only]');
const output = path.resolve(outputArg),
  axes = ['x', 'y', 'z'],
  hash = (b) => createHash('sha256').update(b).digest('hex'),
  bytes = await readFile(packArg),
  inspected = await inspectPack(new Blob([bytes])),
  project = inspected.project;
if (
  project.courses.length !== 8 ||
  project.courses.some((c, i) => c.id !== 'mountain-reservoir-' + String(i + 1).padStart(2, '0'))
)
  throw Error('Eight actual Reservoir courses in stable order required');
await mkdir(output);
const checks = [],
  flights = [],
  records = [],
  receipt = {
    format: 'FPVReservoirWorldQualification.v1',
    status: 'running',
    pack: {
      path: path.resolve(packArg),
      bytes: bytes.length,
      sha256: hash(bytes),
      identity: 'fpv-pack:' + inspected.sha256,
    },
    checks,
    flights,
    scope:
      option === '--clearance-only'
        ? 'Static source/collision survey only; no ordinary-flight or visual acceptance.'
        : 'Eight exact courses, sixteen recorded ordinary flights, independent complete and archive replays. Browser, art, offline and hardware acceptance are separate.',
    pilot:
      'Existing adventureAuthoringPilot ordinary inputs. Explicit surveyed legs bypass its coarse AABB detour planner through empty authoring navigation boxes; actual flight retains every real collider. For flat-top terrain, navigation metadata supplies its measured maximum Y without changing the actual course. Gentle48% throttle replaces early motor cut only in the final65mm until contact.',
  };
const save = () =>
  writeFile(path.join(output, 'qualification.json'), JSON.stringify(receipt, null, 2) + '\n');
let collectStaticFailures = true;
function check(name, passed, detail) {
  checks.push({ name, passed: !!passed, ...(detail ? { detail } : {}) });
  if (!passed && !collectStaticFailures) throw Error(name);
}
const centre = (step) =>
  step.type === 'gate'
    ? {
        [step.axis]: step.at,
        [step.axis === 'x' ? 'z' : 'x']: (step.minSide + step.maxSide) / 2,
        y: (step.minY + step.maxY) / 2,
      }
    : Object.fromEntries(axes.map((k) => [k, (step.min[k] + step.max[k]) / 2]));
function obstacleBounds(obstacle) {
  if (obstacle.type !== 'trimesh') return { min: obstacle.min, max: obstacle.max };
  return Object.fromEntries(
    ['min', 'max'].map((which) => [
      which,
      Object.fromEntries(
        axes.map((axis, i) => [
          axis,
          Math[which](...obstacle.vertices.filter((_, n) => n % 3 === i)),
        ]),
      ),
    ]),
  );
}
function nominalPoints(course, mode) {
  const result = [{ ...course.spawn, y: course.spawn.y + 2200 }];
  for (const step of course.steps[mode]) {
    const point = centre(step);
    if (step.type === 'gate') {
      result.push({ ...point, [step.axis]: point[step.axis] - step.direction * 3000 });
      result.push({ ...point, [step.axis]: point[step.axis] + step.direction * 3500 });
    } else if (step.type === 'land') {
      const obstacle = course.obstacles.find((o) => o.id === step.surface),
        top = obstacleBounds(obstacle).max.y;
      result.push({ ...point, y: Math.max(result.at(-1).y, top + 2200) });
    } else result.push(point);
  }
  return result;
}
try {
  await initWorldRuntime();
  const course = project.courses[0],
    geometry = canonicalWorldJSON({ bounds: course.bounds, obstacles: course.obstacles }),
    collision = createWorldCollision(course);
  try {
    check(
      'One shared physical world across eight courses',
      project.courses.every(
        (c) => canonicalWorldJSON({ bounds: c.bounds, obstacles: c.obstacles }) === geometry,
      ),
    );
    check(
      'Lake outside all playable bounds',
      project.courses.every((c) => c.bounds.max.x === 6000) &&
        project.authoring.water.includes('outside'),
    );
    check(
      'Named shore pad supports all eight starts',
      project.courses.every(
        (c) => collision.support(c.spawn, c.rules.droneRadius, 5)?.id === 'platform-shore-pad',
      ),
    );
    for (const obstacle of course.obstacles.filter((o) => o.type !== 'trimesh')) {
      const point = Object.fromEntries(
        axes.map((k) => [k, (obstacle.min[k] + obstacle.max[k]) / 2]),
      );
      point.y -= course.rules.droneRadius;
      check(
        obstacle.id + ' solid interior rejects spawn',
        !collision.clearSpawn(point, course.rules.droneRadius),
      );
      const anchor = project.source.colliders.find((a) => a.id === obstacle.id);
      check(obstacle.id + ' retains a source collider marker', !!anchor);
      const imported = colliderFromAnchor(anchor).vertices,
        vertices = [],
        q = new Quaternion(...(obstacle.rotation ?? [0, 0, 0, 1]));
      const middle = axes.map((k) => (obstacle.min[k] + obstacle.max[k]) / 2);
      for (const z of [obstacle.min.z, obstacle.max.z])
        for (const y of [obstacle.min.y, obstacle.max.y])
          for (const x of [obstacle.min.x, obstacle.max.x]) {
            const p = new Vector3(x - middle[0], y - middle[1], z - middle[2]).applyQuaternion(q);
            vertices.push(...p.toArray().map((v, i) => Math.round(v + middle[i])));
          }
      check(
        obstacle.id + ' eight source corners match physical solid within1mm quantization',
        vertices.length === imported.length &&
          vertices.every((v, i) => Math.abs(v - imported[i]) <= 1),
      );
    }
    for (const c of project.courses)
      for (const mode of ['self-level', 'acro']) {
        const points = nominalPoints(c, mode),
          radius = c.rules.droneRadius + 500;
        for (let i = 0; i < points.length; i++) {
          const p = { ...points[i], y: points[i].y - 500 };
          check(
            c.id + '/' + mode + ' nominal point' + i + ' bounds/extra0.5m clearance',
            collision.clearSpawn(p, radius) &&
              p.x - radius >= c.bounds.min.x &&
              p.x + radius <= c.bounds.max.x &&
              p.z - radius >= c.bounds.min.z &&
              p.z + radius <= c.bounds.max.z,
            { lowerPoint: points[i] },
          );
          if (i) {
            const from = { ...points[i - 1], y: points[i - 1].y - 500 },
              delta = Object.fromEntries(axes.map((k) => [k, p[k] - from[k]])),
              moved = collision.moveSphere(from, delta, radius);
            check(
              c.id + '/' + mode + ' swept segment' + i + ' extra0.5m clearance',
              !moved.contacts.length && axes.every((k) => Math.abs(moved.position[k] - p[k]) <= 3),
              { from: points[i - 1], to: points[i], contacts: moved.contacts },
            );
          }
        }
        const target = c.steps[mode].at(-1),
          point = centre(target),
          top = obstacleBounds(c.obstacles.find((o) => o.id === target.surface)).max.y;
        check(
          c.id + '/' + mode + ' real named landing support',
          collision.support({ ...point, y: top + 1 }, c.rules.droneRadius, 5)?.id ===
            target.surface,
          { surface: target.surface, top },
        );
      }
  } finally {
    collision.dispose();
  }
  collectStaticFailures = false;
  if (checks.some((item) => !item.passed))
    throw Error('Static collision survey failed; see every failed check before flight generation');
  if (option === '--clearance-only') {
    receipt.status = 'passed';
    await save();
    console.log(JSON.stringify({ status: receipt.status, checks: checks.length, flights: 0 }));
  } else {
    for (const course of project.courses)
      for (const mode of ['self-level', 'acro']) {
        const courseIdentity = canonicalWorldJSON(course),
          navigation = structuredClone(course);
        for (const obstacle of navigation.obstacles)
          if (obstacle.type === 'trimesh') Object.assign(obstacle, obstacleBounds(obstacle));
        const flight = createWorldFlight({ course, mode }),
          recorder = createWorldRecorder(flight, { session: 'demonstration' }),
          memory = { boxes: [] },
          milestones = [];
        try {
          flight.arm();
          let state = flight.snapshot(),
            last = -1;
          while (state.status === 'active' && state.ticks < course.rules.maxTicks) {
            if (state.step !== last) {
              last = state.step;
              milestones.push({ step: last, tick: state.ticks, position: state.position });
            }
            const controls = adventureAuthoringPilot(state, navigation, memory, mode),
              target = course.obstacles.find((o) => o.id === state.target?.surface),
              top = target && obstacleBounds(target).max.y;
            if (
              state.target?.type === 'land' &&
              !state.grounded &&
              Number.isFinite(top) &&
              state.position.y > top &&
              state.position.y - top < 65 &&
              Math.hypot(state.velocity.x, state.velocity.z) < 450 &&
              controls.throttle === 0
            )
              controls.throttle = 0.48;
            state = flight.step(controls);
            recorder.record(controls);
          }
          const proof = recorder.export(),
            proofBytes = Buffer.from(canonicalWorldJSON(proof) + '\n'),
            filename = course.id + '-' + mode + '.proof.json';
          await writeFile(path.join(output, filename), proofBytes, { flag: 'wx' });
          const row = {
            course: course.id,
            revision: course.revision,
            mode,
            status: state.status,
            ticks: state.ticks,
            completedSteps: state.step,
            contacts: state.contacts,
            health: state.health,
            support: state.support?.id,
            landingSpeed: state.landingSpeed,
            landingTilt: state.landingTilt,
            position: state.position,
            milestones,
            proof: { path: filename, bytes: proofBytes.length, sha256: hash(proofBytes) },
            finalStateIdentity: worldStateIdentity(state),
          };
          flights.push(row);
          await save();
          check(
            course.id + '/' + mode + ' complete ordinary flight',
            state.status === 'complete' && state.step === course.steps[mode].length,
          );
          check(
            course.id + '/' + mode + ' zero contacts/full health',
            state.contacts === 0 && state.health === state.maxHealth,
          );
          check(
            course.id + '/' + mode + ' intended physical landing',
            state.support?.id === course.steps[mode].at(-1).surface &&
              state.landingSpeed <= course.steps[mode].at(-1).maxSpeed,
          );
          check(
            course.id + '/' + mode + ' original course remains exact',
            canonicalWorldJSON(course) === courseIdentity,
          );
          const replay = await replayWorldFlight(course, proof, { sampleEvery: 50 });
          check(
            course.id + '/' + mode + ' independent complete replay exact',
            replay.state.status === 'complete' &&
              worldStateIdentity(replay.state) === row.finalStateIdentity,
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
    const parts = await exportProofParts(records),
      archives = [];
    check(
      'Sixteen independently completed exact-pack records',
      records.length === 16 &&
        new Set(records.map((r) => r.course.id + ':' + r.proof.mode)).size === 16,
    );
    for (let i = 0; i < parts.length; i++) {
      const data = Buffer.from(canonicalJSON(parts[i]) + '\n'),
        filename = `mountain-reservoir-${project.revision}-proof-part-${i + 1}-of-${parts.length}.json`;
      await writeFile(path.join(output, filename), data, { flag: 'wx' });
      archives.push({
        path: filename,
        bytes: data.length,
        sha256: hash(data),
        records: parts[i].records.length,
      });
      for (const record of await importProofPart(data.toString())) {
        check(
          record.course.id +
            '/' +
            record.proof.mode +
            ' archive import requires dependency verification',
          record.status === 'missing-dependency' && record.packIdentity === receipt.pack.identity,
        );
        const replay = await replayWorldFlight(record.course, record.proof);
        check(
          record.course.id + '/' + record.proof.mode + ' imported archive independently exact',
          replay.state.status === 'complete' &&
            worldStateIdentity(replay.state) === record.proof.finalStateIdentity,
        );
      }
    }
    receipt.archives = archives;
    receipt.status = 'passed';
    await save();
    console.log(
      JSON.stringify(
        {
          status: receipt.status,
          checks: checks.length,
          flights: flights.map(({ course, mode, ticks }) => ({ course, mode, ticks })),
          archives,
        },
        null,
        2,
      ),
    );
  }
} catch (error) {
  receipt.status = 'failed';
  receipt.error = error.stack;
  await save();
  throw error;
}

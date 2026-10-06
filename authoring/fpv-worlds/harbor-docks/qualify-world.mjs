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
  WORLD_FLIGHT_HZ,
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
  supportLimit = 14,
  hash = (b) => createHash('sha256').update(b).digest('hex'),
  bytes = await readFile(packArg),
  inspected = await inspectPack(new Blob([bytes])),
  project = inspected.project;
if (
  project.revision !== 'r4' ||
  project.courses.length !== 8 ||
  project.courses.some(
    (c, i) => c.revision !== 'r4' || c.id !== 'harbor-docks-' + String(i + 1).padStart(2, '0'),
  )
)
  throw Error('Eight actual Harbor r4 courses in stable order required');
await mkdir(output);
const checks = [],
  flights = [],
  records = [],
  receipt = {
    format: 'FPVHarborWorldQualification.v1',
    status: 'running',
    pack: {
      path: path.resolve(packArg),
      bytes: bytes.length,
      sha256: hash(bytes),
      identity: 'fpv-pack:' + inspected.sha256,
    },
    checks,
    flights,
    tickHz: WORLD_FLIGHT_HZ,
    groundMotion: {
      policy: 'support-v1',
      prerequisite: '9b5c3d65e2877847126c87f263fbc7e9aca357fb',
      maxFlatSupportGapMm: supportLimit,
      equation:
        'Native controller10mm +1mm downward request +1mm integer clearance =12mm normal clearance. On these flat supports allow two further1mm native/support rounding steps, maximum14mm. Measure signed feetY minus authored solid.max.y independently, and retain native support-ray gap separately. No pose correction or objective tolerance change.',
    },
    runtime: await Promise.all(
      [
        'world-model.mjs',
        'world-collision.mjs',
        'world-records.mjs',
        'vendor/rapier/rapier.mjs',
      ].map(async (file) => {
        const bytes = await readFile(
          new URL('../../../optional-practice/civilian-fpv/' + file, import.meta.url),
        );
        return { file, bytes: bytes.length, sha256: hash(bytes) };
      }),
    ),
    scope:
      option === '--clearance-only'
        ? 'Static source/collision survey only; no ordinary-flight or visual acceptance.'
        : 'Eight exact courses, sixteen recorded ordinary flights, independent complete and archive replays. Browser, art, offline and hardware acceptance are separate.',
    pilot:
      'Existing adventureAuthoringPilot ordinary inputs. Explicit surveyed legs bypass its coarse AABB detour planner through empty authoring navigation boxes; actual flight retains every real collider. Gentle48% throttle replaces early motor cut only in the final65mm until contact.',
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
    if (step.type === 'actor-track-v1' || step.type === 'eliminate') {
      result.push(null);
      continue;
    }
    const point = centre(step);
    if (step.type === 'gate') {
      result.push({ ...point, [step.axis]: point[step.axis] - step.direction * 3000 });
      result.push({ ...point, [step.axis]: point[step.axis] + step.direction * 3500 });
    } else if (step.type === 'land') {
      const obstacle = course.obstacles.find((o) => o.id === step.surface),
        top = obstacle ? obstacleBounds(obstacle).max.y : course.bounds.min.y;
      result.push({ ...point, y: Math.max(result.at(-1)?.y ?? top + 2200, top + 2200) });
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
      'Exact eight-course allocation',
      canonicalWorldJSON(project.authoring.allocation.map((r) => r.activity)) ===
        canonicalWorldJSON([
          'orientation',
          'race',
          'race',
          'precision',
          'follow',
          'observe',
          'combat',
          'capstone',
        ]),
    );
    check(
      'Eight distinct actual ordered criteria sets',
      new Set(project.courses.map((c) => canonicalWorldJSON(c.steps))).size === 8,
    );
    check(
      'Accepted r2 scene source identity',
      project.authoring.acceptedScene.sha256 ===
        'c7609e2bb9b2371124a311e4128c3a3e6c81aaadd3613806bb6405270821d246',
    );
    check(
      'Only follow, observe and isolated training layouts own actors',
      project.courses.every((c, i) => c.actors.length === (i >= 4 && i <= 6 ? 1 : 0)),
    );
    check(
      'Only the two civilian ground subjects explicitly opt into support-v1',
      project.courses.every((c, i) =>
        c.actors.every((a) =>
          i === 4 || i === 5 ? a.groundMotion === 'support-v1' : a.groundMotion === undefined,
        ),
      ),
    );
    for (const c of project.courses.filter((c) => c.actors.some((a) => a.role === 'civilian'))) {
      const subject = c.actors[0],
        target = c.steps['self-level'].find((s) => s.type === 'actor-track-v1');
      collision.addActor(subject, subject.groundMotion);
      check(c.id + ' real actor spawn is clear', collision.clearActorSpawn(subject));
      check(
        c.id + ' actual civilian subject and tracking objective',
        subject.role === 'civilian' &&
          subject.fireEveryTicks === 0 &&
          subject.damage === 0 &&
          target.actorId === subject.id &&
          subject.speed > 0 &&
          subject.path.length > 1,
      );
      check(
        c.id + ' deliberate follow/observe criterion',
        c.id.endsWith('05')
          ? target.minTargetTravel === 4000 && target.ticks === 300
          : target.minTargetTravel === 0 &&
              target.ticks === 200 &&
              target.maxRelativeSpeed === 600 &&
              target.viewAngle === 2000,
      );
      const route = [subject.position, ...subject.path, subject.path[0]];
      for (let i = 1; i < route.length; i++) {
        let position = { ...route[i - 1] },
          blocked = false,
          maxSupportDeviation = 0;
        const goal = route[i],
          length = Math.hypot(...axes.map((k) => goal[k] - position[k])),
          // Nominal survey points use speed/Hz spacing. Catch-up to the next
          // point can exceed one real actor tick if movement is clipped; the
          // separate ordinary-flight proof is authoritative for actual motion.
          parts = Math.max(1, Math.ceil(length / (subject.speed / WORLD_FLIGHT_HZ)));
        for (let n = 1; n <= parts; n++) {
          const next = Object.fromEntries(
            axes.map((k) => [
              k,
              Math.round(route[i - 1][k] + ((goal[k] - route[i - 1][k]) * n) / parts),
            ]),
          );
          const moved = collision.moveGroundActor(
            { ...subject, position },
            Object.fromEntries(axes.map((k) => [k, next[k] - position[k]])),
          );
          blocked ||= !!moved.blocked;
          position = moved.position;
          maxSupportDeviation = Math.max(maxSupportDeviation, Math.abs(position.y - next.y));
        }
        check(
          c.id + ' real actor ground sweep' + i,
          !blocked &&
            Math.abs(position.x - goal.x) <= 3 &&
            Math.abs(position.z - goal.z) <= 3 &&
            // r4 opts into12mm normal clearance plus at most two1mm rounding
            // steps. Historical r3 <=12mm failures remain unchanged.
            maxSupportDeviation <= supportLimit,
          { goal, position, blocked, maxSupportDeviation },
        );
        const support = c.id.endsWith('05') ? 'platform-quay' : 'platform-service-deck';
        check(
          c.id + ' actor waypoint' + i + ' named raised support',
          collision.support({ ...goal, y: goal.y + 1 }, subject.radius, 5)?.id === support,
          { support, goal },
        );
      }
    }
    const training = project.courses[6],
      target = training.actors[0];
    collision.addActor(target);
    check(
      'Isolated training drone has a clear stationary nonfiring spawn',
      collision.clearActorSpawn(target) &&
        target.type === 'drone' &&
        target.role === 'hostile' &&
        target.path.length === 0 &&
        target.speed === 0 &&
        target.fireEveryTicks === 0 &&
        target.damage === 0 &&
        target.health === 50 &&
        project.courses.filter((c) => c.actors.some((a) => a.role === 'hostile')).length === 1,
    );
    check(
      'Training standoff has an unobstructed simulated pulse line',
      collision.visible({ x: 23000, y: 10500, z: -28000 }, { x: 23000, y: 10500, z: -38000 }),
    );
    check(
      'One shared physical world across eight courses',
      project.courses.every(
        (c) => canonicalWorldJSON({ bounds: c.bounds, obstacles: c.obstacles }) === geometry,
      ),
    );
    check(
      'All eight starts retain the clear entry H',
      project.courses.every(
        (c) =>
          collision.clearSpawn(c.spawn, c.rules.droneRadius) &&
          c.spawn.x === -2000 &&
          c.spawn.y === 2250 &&
          c.spawn.z === 34000,
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
          if (!points[i]) continue;
          const p = { ...points[i], y: points[i].y - 500 };
          check(
            c.id + '/' + mode + ' nominal point' + i + ' bounds/extra0.5m clearance',
            collision.clearSpawn(p, radius) &&
              p.x - radius >= c.bounds.min.x &&
              p.x + radius <= c.bounds.max.x &&
              p.y >= c.bounds.min.y &&
              p.y + 2 * radius <= c.bounds.max.y &&
              p.z - radius >= c.bounds.min.z &&
              p.z + radius <= c.bounds.max.z,
            { lowerPoint: points[i] },
          );
          if (i && points[i - 1]) {
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
          top =
            target.surface === '$floor'
              ? c.bounds.min.y
              : obstacleBounds(c.obstacles.find((o) => o.id === target.surface)).max.y;
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
          supportSurvey = createWorldCollision(course),
          recorder = createWorldRecorder(flight, { session: 'demonstration' }),
          memory = { boxes: [] },
          milestones = [],
          tracking = [],
          damage = [],
          supportTicks = Object.fromEntries(
            course.actors
              .filter((a) => a.role === 'civilian')
              .map((a) => [
                a.id,
                {
                  samples: 0,
                  failures: 0,
                  minFlatGap: null,
                  maxFlatGap: null,
                  minRayGap: null,
                  maxRayGap: null,
                  firstFailures: [],
                },
              ]),
          ),
          actorHeightDeviation = Object.fromEntries(course.actors.map((a) => [a.id, 0])),
          actorTravel = Object.fromEntries(course.actors.map((a) => [a.id, 0]));
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
              top =
                state.target?.surface === '$floor'
                  ? course.bounds.min.y
                  : target && obstacleBounds(target).max.y;
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
            const prior = state;
            state = flight.step(controls);
            recorder.record(controls);
            for (const actor of state.actors) {
              const before = prior.actors.find((a) => a.id === actor.id);
              actorTravel[actor.id] += Math.hypot(
                ...axes.map((k) => actor.position[k] - before.position[k]),
              );
              actorHeightDeviation[actor.id] = Math.max(
                actorHeightDeviation[actor.id],
                Math.abs(
                  actor.position.y - course.actors.find((a) => a.id === actor.id).position.y,
                ),
              );
              if (actor.role === 'civilian') {
                const expected = course.id.endsWith('05')
                    ? 'platform-quay'
                    : 'platform-service-deck',
                  actual = supportSurvey.support(
                    { ...actor.position, y: actor.position.y + supportLimit },
                    actor.radius,
                    30,
                  ),
                  solid = course.obstacles.find((o) => o.id === expected),
                  flatGap = actor.position.y - solid.max.y,
                  rayGap = actual && actor.position.y - actual.y,
                  summary = supportTicks[actor.id];
                summary.samples++;
                summary.minFlatGap = Math.min(summary.minFlatGap ?? flatGap, flatGap);
                summary.maxFlatGap = Math.max(summary.maxFlatGap ?? flatGap, flatGap);
                if (actual) {
                  summary.minRayGap = Math.min(summary.minRayGap ?? rayGap, rayGap);
                  summary.maxRayGap = Math.max(summary.maxRayGap ?? rayGap, rayGap);
                }
                if (
                  actual?.id !== expected ||
                  flatGap < 0 ||
                  flatGap > supportLimit ||
                  rayGap < 0 ||
                  rayGap > supportLimit
                ) {
                  summary.failures++;
                  if (summary.firstFailures.length < 16)
                    summary.firstFailures.push({
                      tick: state.ticks,
                      expected,
                      actual,
                      flatGap,
                      rayGap,
                      position: actor.position,
                    });
                }
              }
              if (actor.health !== before.health || actor.status !== before.status)
                damage.push({
                  tick: state.ticks,
                  actor: actor.id,
                  beforeHealth: before.health,
                  afterHealth: actor.health,
                  beforeStatus: before.status,
                  afterStatus: actor.status,
                  shots: state.shots,
                  hits: state.hits,
                  events: structuredClone(state.events),
                });
            }
            if (prior.target?.type === 'actor-track-v1' && state.step > prior.step)
              tracking.push({
                index: prior.step,
                tick: state.ticks,
                criterion: prior.target,
                continuousTicks: prior.hold + 1,
                result: structuredClone(state.actorTrack),
                actor: structuredClone(state.actors.find((a) => a.id === prior.target.actorId)),
              });
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
            shots: state.shots,
            hits: state.hits,
            actors: structuredClone(state.actors),
            support: state.support?.id,
            landingSpeed: state.landingSpeed,
            landingTilt: state.landingTilt,
            position: state.position,
            milestones,
            tracking,
            actorTravel,
            actorHeightDeviation,
            supportTicks,
            damage,
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
          if (course.actors.some((a) => a.role === 'civilian')) {
            const criterion = course.steps[mode].find((s) => s.type === 'actor-track-v1'),
              item = tracking[0];
            check(
              course.id + '/' + mode + ' actual tracking accepted with continuous ticks and travel',
              tracking.length === 1 &&
                item.result.status === 'complete' &&
                item.continuousTicks >= criterion.ticks &&
                item.result.travel >= criterion.minTargetTravel,
              item,
            );
            check(
              course.id + '/' + mode + ' real subject moved and remained civilian/active',
              actorTravel[criterion.actorId] > 1000 &&
                state.actors.every((a) => a.role === 'civilian' && a.status === 'active') &&
                state.shots === 0,
            );
            check(
              course.id +
                '/' +
                mode +
                ' actual raised-support height stays within controller margin',
              actorHeightDeviation[criterion.actorId] <= supportLimit,
              actorHeightDeviation,
            );
            check(
              course.id + '/' + mode + ' actual named support is retained on every actor tick',
              supportTicks[criterion.actorId].samples === state.ticks &&
                supportTicks[criterion.actorId].failures === 0,
              supportTicks,
            );
          }
          if (course.id.endsWith('07')) {
            check(
              course.id + '/' + mode + ' ordinary simulated pulses defeat only fictional target',
              state.shots > 0 &&
                state.hits >= 2 &&
                state.actors.length === 1 &&
                state.actors[0].id === 'harbor-training-drone' &&
                state.actors[0].role === 'hostile' &&
                state.actors[0].status === 'defeated' &&
                state.actors[0].health === 0,
            );
            check(
              course.id +
                '/' +
                mode +
                ' recorded damage uses ordinary player pulses and final defeat',
              damage.length === 2 &&
                damage[0].beforeHealth === 50 &&
                damage[0].afterHealth === 25 &&
                damage[1].beforeHealth === 25 &&
                damage[1].afterHealth === 0 &&
                damage[1].afterStatus === 'defeated' &&
                damage[1].events.some(
                  (e) => e.type === 'defeat' && e.actor === 'harbor-training-drone',
                ),
              damage,
            );
          }
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
          supportSurvey.dispose();
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
        filename = `harbor-docks-${project.revision}-proof-part-${i + 1}-of-${parts.length}.json`;
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

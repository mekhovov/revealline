// Run manually after source review; this does not add a default test gate.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { groundMotionCases } from './cases.mjs';
import RAPIER from '../../../optional-practice/civilian-fpv/vendor/rapier/rapier.mjs';
import {
  createWorldFlight,
  createWorldRecorder,
  initWorldRuntime,
  replayWorldFlight,
  worldStateIdentity,
} from '../../../optional-practice/civilian-fpv/world-model.mjs';
import { createWorldCollision } from '../../../optional-practice/civilian-fpv/world-collision.mjs';
const out = path.resolve(process.argv[2] ?? '');
assert(process.argv[2], 'Pass a new output directory');
await mkdir(out);
const sha = (b) => createHash('sha256').update(b).digest('hex');
const receipt = {
  format: 'FPVGroundMotionManual.v1',
  scope:
    'Ordinary native50Hz synthetic movement and independent partial-practice replay; no route completion or browser acceptance.',
  runtime: [],
  checks: [],
  cases: [],
  complete: false,
};
for (const file of [
  'world-model.mjs',
  'world-collision.mjs',
  'world-library.mjs',
  'world-reaction-runtime.mjs',
]) {
  const bytes = await readFile(
    new URL('../../../optional-practice/civilian-fpv/' + file, import.meta.url),
  );
  receipt.runtime.push({ file, bytes: bytes.length, sha256: sha(bytes) });
}
const check = (name, condition) => {
  receipt.checks.push({ name, pass: !!condition });
  assert(condition, name);
};
await initWorldRuntime();
const live = new Set(),
  World = RAPIER.World,
  free = World.prototype.free;
let created = 0,
  freed = 0;
const createCollider = World.prototype.createCollider;
World.prototype.createCollider = function (...args) {
  if (!live.has(this)) {
    created++;
    live.add(this);
  }
  return createCollider.apply(this, args);
};
World.prototype.free = function (...args) {
  const result = free.apply(this, args);
  if (live.delete(this)) freed++;
  return result;
};
try {
  for (const item of groundMotionCases()) {
    item.course.actors[0].groundMotion = 'support-v1';
    const mode = item.name.startsWith('sentry/') ? 'acro' : 'self-level';
    const flight = createWorldFlight({ course: item.course, mode }),
      survey = createWorldCollision(item.course),
      recorder = createWorldRecorder(flight);
    const row = {
      name: item.name,
      mode,
      ticks: 0,
      travel: 0,
      blocked: 0,
      maxStill: 0,
      missingSupport: 0,
      wrongSupport: 0,
      ceilingOverlap: 0,
      minSupportGap: null,
      maxSupportGap: null,
      maxGapAfterStep: null,
      supports: {},
    };
    let state = flight.snapshot(),
      still = 0,
      first60;
    const initial = state;
    try {
      flight.arm();
      for (let i = 0; i < 3000; i++) {
        const before = state.actors[0].position;
        state = flight.step({ roll: 0, pitch: 0, yaw: 0, throttle: 0, actions: 0 });
        recorder.record();
        const actor = state.actors[0],
          movement = Math.hypot(...['x', 'y', 'z'].map((k) => actor.position[k] - before[k]));
        row.travel += movement;
        still = movement === 0 ? still + 1 : 0;
        row.maxStill = Math.max(row.maxStill, still);
        row.blocked += Number(actor.blocked);
        const support = survey.support(
          { ...actor.position, y: actor.position.y + 20 },
          actor.radius,
          240,
        );
        if (!support) row.missingSupport++;
        else {
          row.supports[support.id] = (row.supports[support.id] ?? 0) + 1;
          if (item.surface && support.id !== item.surface) row.wrongSupport++;
          const gap = actor.position.y - support.y;
          row.minSupportGap = row.minSupportGap === null ? gap : Math.min(row.minSupportGap, gap);
          row.maxSupportGap = row.maxSupportGap === null ? gap : Math.max(row.maxSupportGap, gap);
          const step = item.course.obstacles.find((o) => o.id === 'step');
          if (
            step &&
            (actor.position.z > step.max.z + actor.radius + 20 ||
              actor.position.z < step.min.z - actor.radius - 20)
          )
            row.maxGapAfterStep = Math.max(row.maxGapAfterStep ?? 0, gap);
        }
        const ceiling = item.course.obstacles.find((o) => o.id === 'ceiling');
        if (
          ceiling &&
          actor.position.y + (actor.type === 'vehicle' ? actor.radius * 2 : actor.height) >
            ceiling.min.y
        )
          row.ceilingOverlap++;
        if (i === 59) first60 = worldStateIdentity(state);
      }
      row.ticks = state.ticks;
      row.final = state.actors[0];
      row.finalStateIdentity = worldStateIdentity(state);
      check(
        item.name + ': actual3000 active native ticks',
        state.ticks === 3000 && state.status === 'active',
      );
      check(
        item.name + ': support policy',
        row.missingSupport === (item.name.includes('30.1') ? 3000 : 0) && row.wrongSupport === 0,
      );
      check(item.name + ': no ceiling penetration', row.ceilingOverlap === 0);
      if (item.expect === 'travel')
        check(
          item.name + ': sustained actual travel',
          row.travel > item.minTravel && row.maxStill < 10,
        );
      else
        check(
          item.name + ': bounded refusal retains safe position',
          row.final.position.z >= item.minZ &&
            row.final.position.z <= item.maxZ &&
            row.final.blocked,
        );
      if (item.name.endsWith('/step') || item.name.endsWith('/step-down'))
        check(
          item.name + ': settles after complete body clears step',
          row.maxGapAfterStep !== null && row.maxGapAfterStep <= 14,
        );
      const proof = recorder.export(),
        proofBytes = Buffer.from(JSON.stringify(proof) + '\n');
      const file = item.name.replaceAll('/', '-') + '.json';
      await writeFile(path.join(out, file), proofBytes, { flag: 'wx' });
      row.proof = { file, bytes: proofBytes.length, sha256: sha(proofBytes) };
      const replay = await replayWorldFlight(item.course, proof, { yieldControl: async () => {} });
      check(
        item.name + ': independent exact replay',
        worldStateIdentity(replay.state) === row.finalStateIdentity,
      );
      flight.reset();
      check(
        item.name + ': reset returns exact original disarmed state',
        JSON.stringify(flight.snapshot()) === JSON.stringify(initial),
      );
      flight.arm();
      for (let i = 0; i < 60; i++)
        flight.step({ roll: 0, pitch: 0, yaw: 0, throttle: 0, actions: 0 });
      check(
        item.name + ': repeated initialization same60tick state',
        worldStateIdentity(flight.snapshot()) === first60,
      );
    } finally {
      flight.dispose();
      flight.dispose();
      survey.dispose();
      survey.dispose();
    }
    check(item.name + ': all owned native worlds freed', live.size === 0 && created === freed);
    receipt.cases.push(row);
  }
  receipt.complete = true;
} catch (error) {
  receipt.error = { name: error.name, message: error.message, stack: error.stack };
  throw error;
} finally {
  receipt.ownership = {
    created,
    freed,
    remaining: live.size,
    scope:
      'Observed each native World at its first collider creation and native free; not process memory or GPU resources.',
  };
  World.prototype.createCollider = createCollider;
  World.prototype.free = free;
  await writeFile(path.join(out, 'qualification.json'), JSON.stringify(receipt, null, 2) + '\n', {
    flag: 'wx',
  });
  console.log(
    JSON.stringify({
      complete: receipt.complete,
      checks: receipt.checks.length,
      cases: receipt.cases.length,
      ownership: receipt.ownership,
    }),
  );
}

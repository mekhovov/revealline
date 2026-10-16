// Bounded manual integration verification; not added to a unit runner or CI.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const [baseline, candidate, out] = process.argv.slice(2);
const revision = 'e03fdbb5cd73176a01df49347fbe9eab722f1882';
const env = { ...process.env, GIT_NO_LAZY_FETCH: '1' };
execFileSync('git', ['diff', '--exit-code', revision, '--', 'game', 'optional-practice'], { cwd: baseline, env });
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const load = (root, name) => import(pathToFileURL(path.join(root, 'optional-practice/civilian-fpv', name)));
const receipt = { format: 'FPVGroundP1IntegratedParity.v1', baselineRevision: revision, baseline, candidate, candidateRevision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: candidate, env }).toString().trim(), source: {}, checks: [], courses: [], shortFlights: [], replays: [], complete: false };
const check = (value, name) => { receipt.checks.push({ name, pass: !!value }); assert(value, name); };
const equal = (a, b, name) => { assert.deepEqual(a, b, name); check(true, name); };
const neutral = { throttle: 0, roll: 0, pitch: 0, yaw: 0, actions: 0 };
try {
  for (const name of ['world-model.mjs', 'world-collision.mjs', 'world-pursuit.mjs', 'content-definitions.mjs', 'native-pursuit-courses.mjs', 'world-catalogue.mjs']) {
    receipt.source[name] = {};
    for (const [label, root] of [['baseline', baseline], ['candidate', candidate]]) {
      const bytes = await fs.readFile(path.join(root, 'optional-practice/civilian-fpv', name));
      receipt.source[name][label] = { bytes: bytes.length, sha256: sha(bytes) };
    }
  }
  const old = await load(baseline, 'world-model.mjs'), next = await load(candidate, 'world-model.mjs');
  const oldDefs = await load(baseline, 'content-definitions.mjs'), defs = await load(candidate, 'content-definitions.mjs');
  const catalogue = await load(candidate, 'world-catalogue.mjs');
  equal(old.WORLD_RULES, next.WORLD_RULES, 'Existing global rules exact');
  equal(old.WORLD_FLIGHT_MODEL, next.WORLD_FLIGHT_MODEL, 'Existing flight model exact');
  const entries = [...catalogue.WORLD_CATALOGUE, ...catalogue.BEGINNER_CATALOGUE];
  for (const entry of entries) {
    if (!['FlightCourse.v2', 'FlightCourse.v3'].includes(entry.course.format)) continue;
    const before = JSON.stringify(entry.course);
    check(!entry.course.actors?.some((a) => Object.hasOwn(a, 'groundMotion')), 'Retained course absent flag ' + entry.id);
    equal(next.validateWorldCourse(entry.course), old.validateWorldCourse(entry.course), 'Normalized course exact ' + entry.id);
    equal(next.exportWorldCourse(entry.course), old.exportWorldCourse(entry.course), 'Exported course exact ' + entry.id);
    equal(defs.compileChallengeDefinition(defs.splitCourseDefinition(entry.course)), oldDefs.compileChallengeDefinition(oldDefs.splitCourseDefinition(entry.course)), 'Definitions exact ' + entry.id);
    equal(JSON.stringify(entry.course), before, 'Input source unchanged ' + entry.id);
    receipt.courses.push({ id: entry.id, format: entry.course.format, sha256: sha(before) });
  }
  await old.initWorldRuntime(); await next.initWorldRuntime();
  const pursuit = await load(candidate, 'native-pursuit-courses.mjs');
  const selected = [
    ...entries.filter((entry) => ['woodland-01', 'container-yard-04', 'container-yard-07'].includes(entry.id)).map((e) => e.course),
    ...pursuit.NATIVE_PURSUIT_COURSES, ...pursuit.NATIVE_PURSUIT_V2_COURSES,
  ];
  for (const course of selected) for (const mode of ['self-level', 'acro']) {
    const first = old.createWorldFlight({ course, mode }), second = next.createWorldFlight({ course, mode });
    try {
      equal(second.identity, first.identity, 'Exact prior identity ' + course.id + '/' + mode);
      first.arm(); second.arm();
      for (let tick = 0; tick < 150; tick++) {
        first.step(neutral); second.step(neutral);
        assert.deepEqual(second.snapshot(), first.snapshot(), course.id + '/' + mode + ' tick ' + tick);
      }
      check(true, 'All 150 native snapshots exact ' + course.id + '/' + mode);
      receipt.shortFlights.push({ id: course.id, mode, ticks: second.snapshot().ticks, identity: second.identity, finalStateIdentity: next.worldStateIdentity(second.snapshot()) });
    } finally { first.dispose(); second.dispose(); }
  }
  const { importProofPart } = await load(candidate, 'world-records.mjs');
  for (const [name, source, expected] of [
    ['Festival r5', '/tmp/fpv-festival-world-r5-proofs-v1/festival-grounds-r5-proof-part-1-of-1.json', '277503e86f3cb0b9cd60bc405ec41562bed1533c3f8a779391141ac3985884b6'],
    ['Harbor r4', '/tmp/fpv-harbor-r4-proofs-v1/harbor-docks-r4-proof-part-1-of-1.json', '7341d203aa2d3a61199a0000cc87a31f50553588dad610d878a5238aab433102'],
  ]) {
    const bytes = await fs.readFile(source);
    equal(sha(bytes), expected, name + ' exact retained archive');
    const records = await importProofPart(bytes.toString());
    equal(records.length, 16, name + ' complete sixteen records');
    for (const record of records) {
      const replay = await next.replayWorldFlight(record.course, record.proof, { yieldControl: async () => {} });
      equal(next.worldStateIdentity(replay.state), record.proof.finalStateIdentity, name + ' exact replay ' + record.course.id + '/' + record.proof.mode);
      equal(replay.state.status, 'complete', name + ' completed ' + record.course.id + '/' + record.proof.mode);
      receipt.replays.push({ source: name, course: record.course.id, mode: record.proof.mode, frames: record.proof.frames.length, identity: replay.identity, finalStateIdentity: record.proof.finalStateIdentity });
    }
    console.log(JSON.stringify({ completeArchive: name, records: 16 }));
  }
  receipt.complete = true;
} catch (error) {
  receipt.error = { message: error.message, stack: error.stack }; throw error;
} finally {
  await fs.writeFile(out, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ complete: receipt.complete, checks: receipt.checks.length, courses: receipt.courses.length, shortFlights: receipt.shortFlights.length, replays: receipt.replays.length }));
}

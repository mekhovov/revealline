#!/usr/bin/env node
/** Exact shipped-content combat admission/accepted-step matrix. No browser-performance claims. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dataIdentity } from '../game/data-json.mjs';
import {
  WORLD_CATALOGUE,
  BEGINNER_CATALOGUE,
} from '../optional-practice/civilian-fpv/world-catalogue.mjs';
import { WORLD_LIBRARY_CATALOGUE } from '../optional-practice/civilian-fpv/world-library.mjs';
import { REGIONAL_LIBRARY_PINS } from '../optional-practice/civilian-fpv/regional-library.mjs';
import { inspectPack } from '../optional-practice/civilian-fpv/world-content.mjs';
import {
  createWorldFlight,
  initWorldRuntime,
} from '../optional-practice/civilian-fpv/world-model.mjs';
import {
  createEncounterDefinition,
  createEncounterRuntime,
  createNativeEncounterGeometry,
  encounterPhysicsCourse,
  validateEncounterDefinition,
} from '../optional-practice/civilian-fpv/encounter-runtime.mjs';
import {
  createEncounterSession,
  replayEncounterSession,
} from '../optional-practice/civilian-fpv/encounter-session.mjs';
import { createRegionalEncounterGeometry } from '../optional-practice/civilian-fpv/encounter-geometry.mjs';
import {
  createRegionalSession,
  regionalReviewEntry,
} from '../optional-practice/civilian-fpv/regional-session.mjs';
import { createAdvancedRegionalSession } from '../optional-practice/civilian-fpv/advanced-regional.mjs';
import { createAircraftCourseSession } from '../optional-practice/civilian-fpv/aircraft-course-session.mjs';
import {
  createAdvancedSimulation,
  initAdvancedRuntime,
  verifyAdvancedRecovery,
  validateAdvancedPracticeRecovery,
} from '../optional-practice/civilian-fpv/advanced-simulation.mjs';
import {
  createPresetConfiguration,
  listAircraftPresets,
} from '../optional-practice/civilian-fpv/aircraft-presets.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const argument = (name, fallback) => {
  const i = process.argv.indexOf('--' + name);
  return i < 0 ? fallback : process.argv[i + 1];
};
const scope = argument('scope', 'all'),
  only = argument('only', ''),
  ticks = Number(argument('ticks', '3'));
const output = path.resolve(
  root,
  argument('out', 'docs/evidence/fpv-combat/overhaul-catalogue-matrix.json'),
);
const replay = process.argv.includes('--replay');
const shard = argument('shard', '0/1').split('/').map(Number);
assert.ok(
  shard.length === 2 &&
    shard.every(Number.isSafeInteger) &&
    shard[0] >= 0 &&
    shard[0] < shard[1] &&
    shard[1] <= 32,
  'Use --shard index/count',
);
let entryOrdinal = 0;
assert.ok(['all', 'native', 'regional'].includes(scope));
assert.ok(Number.isSafeInteger(ticks) && ticks > 0 && ticks <= 100);
const selections = [
  ...['continuous', 'hunting', 'elimination', 'strike'].map((activity) => ({
    activity,
    population: 12,
  })),
  ...['timed', 'endless'].flatMap((survivalMode) =>
    [64, 96, 128].map((population) => ({ activity: 'survival', survivalMode, population })),
  ),
];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const git = (revision, file) =>
  execFileSync('git', ['show', `${revision}:${file}`], { cwd: root, maxBuffer: 100 * 1024 * 1024 });
const preset = createPresetConfiguration(listAircraftPresets()[0].id);
const configuration = {
  response: preset.response,
  camera: preset.camera,
  advanced: { aircraft: preset.aircraft, controller: preset.controller },
};
const neutral = { roll: 0, pitch: 0, yaw: 0, throttle: 0, actions: 0 };
const report = {
  format: 'FPVCombatCatalogueMatrix.v2',
  createdAt: new Date().toISOString(),
  node: process.version,
  scope,
  filter: only || null,
  shard: { index: shard[0], count: shard[1] },
  ticksPerCase: ticks,
  methodology:
    'Each exact edition/start × activity/population × Standard/Advanced: production geometry admission, definition round-trip, real aircraft adapter, accepted simulation intervals and paired recovery. Advanced uses the production simulation through an in-process worker client.',
  replayRequested: replay,
  limitations: [
    'These short starts are admission/regression checks, not full activity victories or global navigation proofs.',
    'No renderer, audio, browser GPU, physical radio, human enjoyment, sustained frame-rate or memory qualification is claimed.',
    'Survival admits the requested capacity but its initial live formation follows the 40% schedule.',
    'Only the bundled and pinned downloadable editions enumerated by these source catalogues are included.',
  ],
  sources: {},
  editions: [],
  errors: [],
};
for (const file of [
  'scripts/qualify-fpv-combat-catalogue.mjs',
  'optional-practice/civilian-fpv/encounter-runtime.mjs',
  'optional-practice/civilian-fpv/encounter-session.mjs',
  'optional-practice/civilian-fpv/encounter-geometry.mjs',
  'optional-practice/civilian-fpv/world-catalogue.mjs',
  'optional-practice/civilian-fpv/world-library.mjs',
  'optional-practice/civilian-fpv/regional-library.mjs',
  'optional-practice/civilian-fpv/world-model.mjs',
  'optional-practice/civilian-fpv/aircraft-course-session.mjs',
  'optional-practice/civilian-fpv/regional-session.mjs',
  'optional-practice/civilian-fpv/advanced-regional.mjs',
  'optional-practice/civilian-fpv/regional/scenery-admission.mjs',
  'optional-practice/civilian-fpv/regional/restore-containment.mjs',
  'optional-practice/civilian-fpv/regional/verified-flight-geometry.mjs',
  'optional-practice/civilian-fpv/regional/verified-mixed-window.mjs',
  'optional-practice/civilian-fpv/regional/verified-scenery-window.mjs',
  'optional-practice/civilian-fpv/advanced-simulation.mjs',
])
  report.sources[file] = hash(await readFile(path.join(root, file)));
const resumed = new Map();
if (process.argv.includes('--resume')) {
  let retained;
  try {
    retained = JSON.parse(await readFile(output, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (retained) {
    for (const key of [
      'format',
      'scope',
      'filter',
      'shard',
      'ticksPerCase',
      'replayRequested',
      'sources',
      'node',
    ])
      assert.deepEqual(retained[key], report[key], `Cannot resume changed qualification ${key}`);
    assert.deepEqual(retained.errors, [], 'Resolve inventory errors before resuming');
    for (const row of retained.editions) {
      assert.equal(row.cases.length, selections.length * 2, 'Cannot resume incomplete entry');
      assert.ok(!resumed.has(row.ordinal), 'Duplicate resume entry');
      resumed.set(row.ordinal, row);
    }
    report.createdAt = retained.createdAt;
    report.resumedAt = new Date().toISOString();
    report.editions = retained.editions;
  }
}
await mkdir(path.dirname(output), { recursive: true });
async function save() {
  const cases = report.editions.flatMap((e) => e.cases ?? []),
    passed = cases.filter((c) => c.status === 'passed');
  report.summary = {
    editions: report.editions.length,
    cases: cases.length,
    passed: passed.length,
    failed: cases.length - passed.length,
    inventoryErrors: report.errors.length,
    bundledCourses: report.editions.filter((e) => e.kind === 'bundled' || e.kind === 'learning')
      .length,
    downloadedCourses: report.editions.filter((e) => e.kind === 'download').length,
    regionalStarts: report.editions.filter((e) => e.kind === 'regional').length,
    minAdmitted: passed.length ? Math.min(...passed.map((c) => c.admitted)) : 0,
    minRequired: passed.length ? Math.min(...passed.map((c) => c.required)) : 0,
    replayed: passed.filter((c) => c.replayVerified).length,
  };
  const temporary = `${output}.tmp-${process.pid}`;
  try {
    await writeFile(temporary, JSON.stringify(report) + '\n');
    await rename(temporary, output);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}
function createClient() {
  let simulation;
  return {
    async initialize(options) {
      simulation = createAdvancedSimulation(options);
      return { telemetry: simulation.telemetry() };
    },
    async stageTerrainFrame(frame) {
      return simulation.stageTerrainFrame(frame);
    },
    async commitTerrainFrame(value) {
      return simulation.commitTerrainFrame(value);
    },
    async propose(sample, motions) {
      simulation.enqueueInput(sample);
      return simulation.proposeMission({ motions });
    },
    async commit(value) {
      return simulation.commitMission(value);
    },
    async step(sample, motions) {
      simulation.enqueueInput(sample);
      return simulation.stepMission({ motions });
    },
    async telemetry() {
      return simulation.telemetry();
    },
    async snapshot() {
      return simulation.snapshot();
    },
    async restore(value) {
      return simulation.restore(await verifyAdvancedRecovery(value));
    },
    async restorePractice(value) {
      return simulation.restore(
        await validateAdvancedPracticeRecovery(value, {
          expectedIdentity: simulation.identity,
        }),
      );
    },
    async recording() {
      return simulation.recording();
    },
    dispose() {
      simulation?.dispose();
    },
  };
}
await initWorldRuntime();
await initAdvancedRuntime();

async function qualify(edition, { course, regionalConfiguration = null }) {
  if (only && !`${edition.id}/${edition.course}/${edition.start ?? ''}`.includes(only)) return;
  const ordinal = entryOrdinal++;
  if (ordinal % shard[1] !== shard[0]) return;
  edition = { ...edition, ordinal };
  const original = dataIdentity(course),
    row = { ...edition, courseIdentity: original, cases: [] };
  if (resumed.has(ordinal)) {
    const previous = resumed.get(ordinal);
    const { cases: ignored, ...metadata } = previous;
    void ignored;
    const { cases: empty, ...expected } = row;
    void empty;
    assert.deepEqual(metadata, expected, 'Resume inventory changed');
    resumed.delete(ordinal);
    console.log(JSON.stringify({ resumed: ordinal, edition: row.id, start: row.start }));
    return;
  }
  report.editions.push(row);
  const nativeDefinition = new Map();
  for (const selection of selections)
    for (const backend of ['standard', 'advanced']) {
      const result = { ...selection, backend, status: 'failed' };
      row.cases.push(result);
      let session, orphanBase, orphanGeometry;
      const factory = async ({ definition: retained, runId } = {}) => {
        let base, geometry, definition;
        try {
          if (regionalConfiguration) {
            const options = {
              ...regionalConfiguration,
              mode: 'acro',
              response: preset.response,
              ...(backend === 'advanced' ? { advanced: configuration.advanced } : {}),
            };
            base =
              backend === 'advanced'
                ? createAdvancedRegionalSession(options, { createClient })
                : createRegionalSession(options);
            orphanBase = base;
            await base.prepare();
            const spawn = Object.fromEntries(
              ['x', 'y', 'z'].map((axis) => [axis, Math.round(base.snapshot().position[axis])]),
            );
            geometry = createRegionalEncounterGeometry(base.encounterGeometry(), {
              bounds: course.bounds,
              player: spawn,
            });
            orphanGeometry = geometry;
            definition =
              retained ??
              createEncounterDefinition({
                course: { ...course, bounds: geometry.area, spawn },
                version: 2,
                baseIdentity: edition.baseIdentity,
                ...selection,
                admitActor: geometry.admitActor,
                admitServicePad: geometry.admitServicePad,
              });
          } else {
            geometry = createNativeEncounterGeometry(course);
            orphanGeometry = geometry;
            const key = dataIdentity(selection);
            definition =
              retained ??
              nativeDefinition.get(key) ??
              createEncounterDefinition({
                course,
                version: 2,
                baseIdentity: edition.baseIdentity,
                ...selection,
                admitActor: geometry.admitActor,
                admitServicePad: geometry.admitServicePad,
              });
            nativeDefinition.set(key, definition);
            const actors = createEncounterRuntime(definition, { geometry, runId }).snapshot()
              .actors;
            base =
              backend === 'advanced'
                ? createAircraftCourseSession(
                    {
                      course: encounterPhysicsCourse(course),
                      mode: 'acro',
                      configuration,
                      encounterActors: actors,
                    },
                    { createClient, createMission: createWorldFlight },
                  )
                : createWorldFlight({
                    course: encounterPhysicsCourse(course),
                    mode: 'acro',
                    configuration,
                    encounterPhysicsOnly: true,
                    unscoredPractice: true,
                  });
            orphanBase = base;
          }
          const wrapped = await createEncounterSession(base, {
            definition,
            geometry,
            runId,
            regional: Boolean(regionalConfiguration),
          });
          orphanBase = orphanGeometry = null;
          if (!regionalConfiguration) await wrapped.prepare?.();
          return wrapped;
        } catch (error) {
          await base?.dispose?.();
          geometry?.dispose?.();
          orphanBase = orphanGeometry = null;
          throw error;
        }
      };
      try {
        session = await factory();
        const definition = session.combatDefinition();
        assert.equal(definition.baseIdentity, edition.baseIdentity);
        assert.equal(
          dataIdentity(validateEncounterDefinition(JSON.parse(JSON.stringify(definition)))),
          dataIdentity(definition),
        );
        assert.ok(definition.actors.length > 0);
        assert.ok(definition.actors.some((actor) => actor.type !== 'prop'));
        assert.ok(
          definition.actors.every(
            (actor) =>
              actor.appearance.archetype &&
              ['tactical', 'rivals', 'arcade'].includes(actor.appearance.cast),
          ),
        );
        session.arm();
        for (let tick = 0; tick < ticks; tick++) {
          if (tick === 0) session.queueCombatCommand({ switchWeapon: 1 });
          await session.step({ ...neutral, actions: tick === 1 ? 1 : 0 });
          assert.equal(
            session.snapshot().encounter.ticks,
            tick + 1,
            'Encounter did not admit this interval',
          );
        }
        const saved = await session.exportCombatRecovery();
        result.definitionIdentity = dataIdentity(definition);
        result.baseIdentity = definition.baseIdentity;
        result.admitted = definition.actors.length;
        result.required = definition.actors.filter((actor) => actor.type !== 'prop').length;
        result.initialActive = session
          .snapshot()
          .encounter.actors.filter((actor) => actor.status === 'active').length;
        result.acceptedTicks = session.snapshot().encounter.ticks;
        result.sessionIdentity = saved.gameplay.identity;
        assert.equal(dataIdentity(course), original, 'Encounter modified the historical course');
        await session.restoreCombatRecovery(saved);
        assert.equal(
          session.snapshot().encounter.ticks,
          ticks,
          'Paired recovery lost accepted encounter progress',
        );
        result.recoveryRestored = true;
        await session.dispose();
        session = null;
        if (replay) {
          const proof = await replayEncounterSession(saved, { createSession: factory });
          result.replayVerified = proof.verified;
        }
        result.status = 'passed';
      } catch (error) {
        result.error = error.message;
      } finally {
        await session?.dispose?.();
        await orphanBase?.dispose?.();
        orphanGeometry?.dispose?.();
      }
    }
  await save();
  console.log(
    JSON.stringify({
      edition: row.id,
      course: row.course,
      start: row.start,
      cases: row.cases.length,
      failed: row.cases.filter((c) => c.status !== 'passed').length,
    }),
  );
}
if (scope !== 'regional') {
  for (const [kind, entries] of [
    ['bundled', WORLD_CATALOGUE],
    ['learning', BEGINNER_CATALOGUE],
  ])
    for (const entry of entries)
      await qualify(
        {
          id: entry.id,
          course: entry.course.id,
          kind,
          catalogueIdentity: entry.packIdentity,
          baseIdentity: dataIdentity(entry.course),
        },
        { course: entry.course },
      );
  for (const pin of WORLD_LIBRARY_CATALOGUE) {
    if (only && !pin.id.includes(only)) continue;
    try {
      const bytes = git(pin.commit, pin.path);
      assert.equal(bytes.length, pin.bytes);
      assert.equal(hash(bytes), pin.sha256);
      const pack = await inspectPack(new Uint8Array(bytes));
      assert.equal(pack.sha256, pin.sha256);
      assert.equal(pack.project.courses.length, pin.courses);
      for (const course of pack.project.courses)
        await qualify(
          {
            id: pin.id,
            course: course.id,
            kind: 'download',
            revision: pin.revision,
            sha256: pin.sha256,
            commit: pin.commit,
            baseIdentity: dataIdentity(course),
          },
          { course },
        );
    } catch (error) {
      report.errors.push({ id: pin.id, kind: 'download', error: error.message });
      await save();
    }
  }
}
if (scope !== 'native')
  for (const pin of REGIONAL_LIBRARY_PINS) {
    if (only && !pin.id.includes(only)) continue;
    try {
      const parts = new URL(pin.pin.url).pathname.split('/'),
        revision = parts[3],
        descriptorPath = parts.slice(4).join('/'),
        directory = descriptorPath.slice(0, descriptorPath.lastIndexOf('/') + 1),
        bytes = git(revision, descriptorPath);
      assert.equal(bytes.length, pin.pin.bytes);
      assert.equal(hash(bytes), pin.pin.sha256);
      const descriptor = JSON.parse(bytes),
        cache = new Map(),
        base = new URL('https://combat-qualification.invalid/');
      const load = (file) => {
        if (!cache.has(file)) {
          const declared = descriptor.files.find((row) => row.path === file);
          assert.ok(declared, 'Undeclared regional asset');
          const data = git(revision, directory + file);
          assert.equal(data.length, declared.bytes);
          assert.equal(hash(data), declared.sha256);
          cache.set(file, data);
        }
        return cache.get(file);
      };
      const source = (ref) => ({
        baseURL: new URL('.', new URL(ref.path, base)).href,
        fetchImpl: async (input) => new Response(load(new URL(input).pathname.slice(1))),
      });
      const manifest = JSON.parse(load(descriptor.terrain.path)),
        scenery = descriptor.scenery
          ? {
              manifest: JSON.parse(load(descriptor.scenery.path)),
              source: source(descriptor.scenery),
            }
          : null;
      const regionalConfiguration = {
        manifest,
        source: source(descriptor.terrain),
        scenery,
        geometryProfile: scenery ? 'terrain-scenery-v1' : 'terrain-v1',
      };
      const entry = regionalReviewEntry(regionalConfiguration, {
        installedIdentity: pin.pin.sha256,
      });
      const baseIdentity = dataIdentity({
        terrain: dataIdentity(manifest),
        scenery: scenery ? dataIdentity(scenery.manifest) : null,
      });
      for (const spawn of manifest.spawns)
        await qualify(
          {
            id: pin.id,
            course: entry.course.id,
            kind: 'regional',
            start: spawn.id,
            sha256: pin.pin.sha256,
            commit: revision,
            baseIdentity,
          },
          {
            course: entry.course,
            regionalConfiguration: { ...regionalConfiguration, spawnId: spawn.id },
          },
        );
    } catch (error) {
      report.errors.push({ id: pin.id, kind: 'regional', error: error.message });
      await save();
    }
  }
assert.equal(resumed.size, 0, 'Resume entries missing from current inventory');
report.completedAt = new Date().toISOString();
await save();
console.log(JSON.stringify(report.summary));
if (report.summary.failed || report.errors.length) process.exitCode = 1;
